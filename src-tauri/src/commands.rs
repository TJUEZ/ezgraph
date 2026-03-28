use crate::llm::LLMClient;
use crate::file_parser::parse_file;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub context: String,
    pub prompt: String,
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[tauri::command]
pub async fn parse_file_cmd(path: String) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(path);
    parse_file(&path)
        .map(|r| serde_json::to_value(r).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_drawio_xml_cmd(request: GenerateRequest) -> Result<String, String> {
    let client = LLMClient::new(
        &request.provider,
        &request.api_key,
        &request.model,
        request.base_url.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    let xml = client
        .generate_drawio_xml(&request.context, &request.prompt)
        .await
        .map_err(|e| e.to_string())?;

    Ok(xml)
}
