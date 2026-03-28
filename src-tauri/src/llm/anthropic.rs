use super::{LLMError, LLMProvider, Message};
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct AnthropicProvider {
    client: Client,
    api_key: String,
    model: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: u32,
    system: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

impl AnthropicProvider {
    pub fn new(api_key: &str, model: &str) -> Result<Self, LLMError> {
        Ok(Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
        })
    }
}

impl LLMProvider for AnthropicProvider {
    fn provider_name(&self) -> &str {
        "anthropic"
    }

    fn model(&self) -> &str {
        &self.model
    }

    async fn chat(&self, messages: Vec<Message>) -> Result<String, LLMError> {
        let (system, rest): (Option<String>, Vec<AnthropicMessage>) = messages
            .into_iter()
            .partition(|m| m.role == "system");

        let request = AnthropicRequest {
            model: self.model.clone(),
            messages: rest.into_iter().map(|m| AnthropicMessage {
                role: if m.role == "user" { "user".to_string() } else { "assistant".to_string() },
                content: m.content,
            }).collect(),
            max_tokens: 4096,
            system,
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::ApiError(format!(
                "Anthropic API error ({}): {}",
                response.status(),
                error_text
            )));
        }

        let anthropic_response: AnthropicResponse = response.json().await?;
        anthropic_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| LLMError::ParseError("No content in response".to_string()))
    }
}
