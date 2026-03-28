use super::{LLMError, LLMProvider, Message};
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct OllamaProvider {
    client: Client,
    api_key: String,
    model: String,
    base_url: String,
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

impl OllamaProvider {
    pub fn new(api_key: &str, model: &str, base_url: Option<&str>) -> Result<Self, LLMError> {
        let base_url = base_url
            .unwrap_or("http://localhost:11434")
            .trim_end_matches('/');

        Ok(Self {
            client: Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
            base_url: base_url.to_string(),
        })
    }
}

impl LLMProvider for OllamaProvider {
    fn provider_name(&self) -> &str {
        "ollama"
    }

    fn model(&self) -> &str {
        &self.model
    }

    async fn chat(&self, messages: Vec<Message>) -> Result<String, LLMError> {
        let request = OllamaRequest {
            model: self.model.clone(),
            messages,
            stream: false,
        };

        let mut req_builder = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .header("Content-Type", "application/json");

        if !self.api_key.is_empty() && self.api_key != "ollama" {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let response = req_builder.json(&request).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::ApiError(format!(
                "Ollama API error ({}): {}",
                response.status(),
                error_text
            )));
        }

        let ollama_response: OllamaResponse = response.json().await?;
        Ok(ollama_response.message.content)
    }
}
