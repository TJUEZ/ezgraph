use super::{LLMError, LLMProvider, Message};
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    model: String,
    base_url: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

impl OpenAIProvider {
    pub fn new(api_key: &str, model: &str, base_url: Option<&str>) -> Result<Self, LLMError> {
        let base_url = base_url
            .unwrap_or("https://api.openai.com/v1")
            .trim_end_matches('/');

        Ok(Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
            base_url: base_url.to_string(),
        })
    }
}

impl LLMProvider for OpenAIProvider {
    fn provider_name(&self) -> &str {
        "openai"
    }

    fn model(&self) -> &str {
        &self.model
    }

    async fn chat(&self, messages: Vec<Message>) -> Result<String, LLMError> {
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.7,
        };

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::ApiError(format!(
                "OpenAI API error ({}): {}",
                response.status(),
                error_text
            )));
        }

        let chat_response: ChatResponse = response.json().await?;
        chat_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| LLMError::ParseError("No choices in response".to_string()))
    }
}
