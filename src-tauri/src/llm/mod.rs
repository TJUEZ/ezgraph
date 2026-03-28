mod errors;
mod openai;
mod anthropic;
mod ollama;

pub use errors::LLMError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

pub trait LLMProvider: Send + Sync {
    fn provider_name(&self) -> &str;
    async fn chat(&self, messages: Vec<Message>) -> Result<String, LLMError>;
    fn model(&self) -> &str;
}

pub struct LLMClient {
    provider: Box<dyn LLMProvider>,
}

impl LLMClient {
    pub fn new(
        provider_name: &str,
        api_key: &str,
        model: &str,
        base_url: Option<&str>,
    ) -> Result<Self, LLMError> {
        let provider: Box<dyn LLMProvider> = match provider_name.to_lowercase().as_str() {
            "openai" => Box::new(openai::OpenAIProvider::new(api_key, model, base_url)?),
            "anthropic" => Box::new(anthropic::AnthropicProvider::new(api_key, model)?),
            "ollama" => Box::new(ollama::OllamaProvider::new(api_key, model, base_url)?),
            "groq" => Box::new(openai::OpenAIProvider::new(api_key, model, Some("https://api.groq.com/openai/v1"))?),
            "minimax" => Box::new(openai::OpenAIProvider::new(api_key, model, Some("https://api.minimax.chat/v1"))?),
            "custom" => Box::new(openai::OpenAIProvider::new(api_key, model, base_url)?),
            _ => return Err(LLMError::UnsupportedProvider(provider_name.to_string())),
        };

        Ok(Self { provider })
    }

    pub fn provider_name(&self) -> &str {
        self.provider.provider_name()
    }

    pub fn model(&self) -> &str {
        self.provider.model()
    }

    pub async fn chat(&self, messages: Vec<Message>) -> Result<String, LLMError> {
        self.provider.chat(messages).await
    }

    pub async fn generate_drawio_xml(&self, context: &str, prompt: &str) -> Result<String, LLMError> {
        let system_prompt = r#"You are a draw.io diagram generation expert. The user will provide content (context) and a requirement. Please generate draw.io XML format diagram code.

Requirements:
1. Output ONLY the XML code, no explanations or markdown code blocks
2. The XML must be valid draw.io format with proper <mxfile> root element
3. Create visually appealing and well-organized diagrams
4. Use appropriate shapes, colors, and layouts

Example format:
<mxfile>
  <diagram name="Page-1">
    <mxGraphModel dx="900" dy="600">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Hello" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="200" y="200" width="100" height="40" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"#;

        let user_prompt = format!(
            r#"## Context:
{}

## Requirement:
{}

Generate the draw.io XML diagram:"#,
            context, prompt
        );

        let messages = vec![
            Message { role: "system".to_string(), content: system_prompt.to_string() },
            Message { role: "user".to_string(), content: user_prompt },
        ];

        let response = self.chat(messages).await?;

        let cleaned = response
            .trim()
            .trim_start_matches("```xml")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
            .to_string();

        if !cleaned.contains("<mxfile") {
            return Err(LLMError::ParseError("Response does not contain valid draw.io XML".to_string()));
        }

        Ok(cleaned)
    }
}
