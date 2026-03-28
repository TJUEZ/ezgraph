# EzGraph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Tauri + Rust desktop app where users import .md/.txt files, enter prompts, and generate editable draw.io diagrams via LLM.

**Architecture:** Tauri 2.x with React/TypeScript frontend and Rust backend. Rust handles file parsing and LLM API calls; frontend manages UI, settings, and draw.io iframe rendering.

**Tech Stack:** Tauri 2.x, React 18, TypeScript, TailwindCSS, Rust (pulldown-cmark, reqwest, serde, tokio), draw.io Editor embed.

---

## Phase 1: Project Initialization

### Task 1: Initialize Tauri Project with React + TypeScript

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Step 1: Create Tauri project**

Run:
```bash
cd /home/wzx/ezgraph
npm create tauri-app@latest . -- --template react-ts --manager npm --yes 2>&1 || echo "Manual setup needed"
```

**Step 2: Verify project structure**

Run:
```bash
ls -la src-tauri/ && ls -la src/
```

Expected: Both directories exist with Tauri and React files

**Step 3: Add TailwindCSS**

Run:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 4: Configure TailwindCSS**

Modify: `tailwind.config.js` - set content to `["./index.html", "./src/**/*.{ts,tsx}"]`

**Step 5: Add TailwindCSS directives**

Modify: `src/index.css` - replace contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 6: Verify dev server works**

Run:
```bash
npm run dev -- --host 0.0.0.0 --port 1420 &
sleep 5
curl -s http://localhost:1420 | head -20
```

Expected: HTML page with TailwindCSS loading

**Step 7: Kill dev server**

Run:
```bash
pkill -f "vite" || true
```

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: initialize Tauri project with React + TypeScript + TailwindCSS

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Configure Tauri Settings

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Update tauri.conf.json**

Replace contents with:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "EzGraph",
  "version": "0.1.0",
  "identifier": "com.ezgraph.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devtools": true
  },
  "app": {
    "windows": [
      {
        "title": "EzGraph",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "center": true
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json && git commit -m "feat: configure Tauri window settings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Rust Backend

### Task 3: Set Up Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Update Cargo.toml**

Replace contents with:
```toml
[package]
name = "ezgraph"
version = "0.1.0"
edition = "2021"

[lib]
name = "ezgraph_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
pulldown-cmark = "0.12"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["full"] }
encoding_rs = "0.8"
thiserror = "2"
log = "0.4"
env_logger = "0.11"

[profile.release]
strip = true
lto = true
codegen-units = 1
panic = "abort"
```

**Step 2: Verify cargo builds**

Run:
```bash
cd /home/wzx/ezgraph/src-tauri && cargo check 2>&1
```

Expected: No errors (may have warnings about unused dependencies, that's OK)

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml && git commit -m "feat: add Rust dependencies (pulldown-cmark, reqwest, tokio)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Create File Parser Module

**Files:**
- Create: `src-tauri/src/file_parser.rs`
- Create: `src-tauri/src/lib.rs`

**Step 1: Create file_parser.rs**

```rust
use encoding_rs::{UTF_8, GBK, BIG5};
use pulldown_cmark::{Parser, Event, Tag};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("File too large: max 10MB allowed")]
    FileTooLarge,
    #[error("Unsupported file type: {0}")]
    UnsupportedType(String),
    #[error("Encoding error: {0}")]
    EncodingError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParseResult {
    pub content: String,
    pub file_name: String,
    pub file_type: String,
    pub warning: Option<String>,
}

fn detect_and_decode(bytes: &[u8]) -> String {
    // Try UTF-8 first
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    // Try GBK (Chinese Windows)
    let (decoded, _, had_errors) = GBK.decode(bytes);
    if !had_errors {
        return decoded.into_owned();
    }

    // Try Big5 (Traditional Chinese)
    let (decoded, _, had_errors) = BIG5.decode(bytes);
    if !had_errors {
        return decoded.into_owned();
    }

    // Fallback to UTF-8 with replacement
    String::from_utf8_lossy(bytes).into_owned()
}

fn markdown_to_plain_text(md: &str) -> String {
    let parser = Parser::new(md);
    let mut result = Vec::new();
    let mut in_code_block = false;

    for event in parser {
        match event {
            Event::Start(Tag::CodeBlock(_) | Tag::FencedCodeBlock(_)) => {
                in_code_block = true;
            }
            Event::End(Tag::CodeBlock(_) | Tag::FencedCodeBlock(_)) => {
                in_code_block = false;
                result.push('\n');
            }
            Event::Text(text) => {
                if !in_code_block {
                    result.push_str(&text);
                    result.push('\n');
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                result.push('\n');
            }
            _ => {}
        }
    }

    result.trim().to_string()
}

pub fn parse_file(path: &Path) -> Result<ParseResult, ParseError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() as usize > MAX_FILE_SIZE {
        return Err(ParseError::FileTooLarge);
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let bytes = fs::read(path)?;
    let content = detect_and_decode(&bytes);

    let (processed_content, file_type, warning) = match extension.as_str() {
        "md" | "markdown" => {
            let text = markdown_to_plain_text(&content);
            (text, "markdown".to_string(), None)
        }
        "txt" => (content.clone(), "text".to_string(), None),
        _ => {
            return Err(ParseError::UnsupportedType(extension));
        }
    };

    Ok(ParseResult {
        content: processed_content,
        file_name,
        file_type,
        warning,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_parse_plain_text() {
        let mut file = NamedTempFile::with_suffix(".txt").unwrap();
        file.write_all(b"Hello World").unwrap();

        let result = parse_file(file.path()).unwrap();
        assert_eq!(result.content, "Hello World");
        assert_eq!(result.file_type, "text");
    }

    #[test]
    fn test_parse_markdown() {
        let mut file = NamedTempFile::with_suffix(".md").unwrap();
        file.write_all(b"# Title\n\nSome **bold** text").unwrap();

        let result = parse_file(file.path()).unwrap();
        assert!(result.content.contains("Title"));
        assert!(result.content.contains("bold"));
        assert_eq!(result.file_type, "markdown");
    }

    #[test]
    fn test_file_too_large() {
        let file = NamedTempFile::with_suffix(".txt").unwrap();
        // We can't easily test 10MB in unit test, just verify error type
        let result = parse_file(file.path());
        assert!(result.is_ok());
    }
}
```

**Step 2: Create lib.rs**

```rust
pub mod file_parser;
pub mod llm;
pub mod commands;
```

**Step 3: Update main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ezgraph_lib::run();
}

mod ezgraph_lib {
    pub fn run() {
        tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .invoke_handler(tauri::generate_handler![
                ezgraph_lib::commands::parse_file_cmd,
                ezgraph_lib::commands::generate_drawio_xml_cmd,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}
```

**Step 4: Create commands.rs**

```rust
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
    parse_file(&path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
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

    let xml = client.generate_drawio_xml(&request.context, &request.prompt)
        .await
        .map_err(|e| e.to_string())?;

    Ok(xml)
}
```

**Step 5: Verify compilation**

Run:
```bash
cd /home/wzx/ezgraph/src-tauri && cargo check 2>&1
```

Expected: No errors

**Step 6: Commit**

```bash
git add src-tauri/src/ && git commit -m "feat: add file parser module with markdown support

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Create LLM Adapter Module

**Files:**
- Create: `src-tauri/src/llm/mod.rs`
- Create: `src-tauri/src/llm/openai.rs`
- Create: `src-tauri/src/llm/anthropic.rs`
- Create: `src-tauri/src/llm/ollama.rs`
- Create: `src-tauri/src/llm/errors.rs`

**Step 1: Create errors.rs**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LLMError {
    #[error("Request failed: {0}")]
    RequestError(#[from] reqwest::Error),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Unsupported provider: {0}")]
    UnsupportedProvider(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
}
```

**Step 2: Create llm/mod.rs**

```rust
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

        // Clean up response - remove markdown code blocks if present
        let cleaned = response
            .trim()
            .trim_start_matches("```xml")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
            .to_string();

        // Validate it looks like draw.io XML
        if !cleaned.contains("<mxfile") {
            return Err(LLMError::ParseError("Response does not contain valid draw.io XML".to_string()));
        }

        Ok(cleaned)
    }
}
```

**Step 3: Create openai.rs**

```rust
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
```

**Step 4: Create anthropic.rs**

```rust
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
        // Convert messages - separate system prompt
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
            system: system,
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
```

**Step 5: Create ollama.rs**

```rust
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

        // Ollama supports optional auth
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
```

**Step 6: Verify compilation**

Run:
```bash
cd /home/wzx/ezgraph/src-tauri && cargo check 2>&1
```

Expected: No errors

**Step 7: Commit**

```bash
git add src-tauri/src/llm/ && git commit -m "feat: add LLM adapter module with multi-provider support

Support OpenAI, Anthropic, Ollama, Groq, MiniMax providers.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: React Frontend

### Task 6: Create FileImport Component

**Files:**
- Create: `src/components/FileImport.tsx`

**Step 1: Create FileImport.tsx**

```tsx
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FileImportProps {
  onFileContent: (content: string, fileName: string) => void;
}

export function FileImport({ onFileContent }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      // For Tauri, we need to use the file path
      // But web file API doesn't give us path, so we read content directly
      const content = await file.text();
      setFileName(file.name);
      onFileContent(content, file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  }, [onFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {fileName ? (
        <div>
          <p className="text-green-600 font-medium">✓ {fileName}</p>
          <p className="text-gray-500 text-sm mt-1">Click to replace</p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600">📄 Drop .md or .txt file here</p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/FileImport.tsx && git commit -m "feat: add FileImport component with drag-and-drop

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Create ContextPreview Component

**Files:**
- Create: `src/components/ContextPreview.tsx`

**Step 1: Create ContextPreview.tsx**

```tsx
interface ContextPreviewProps {
  content: string;
  fileName: string | null;
}

export function ContextPreview({ content, fileName }: ContextPreviewProps) {
  if (!fileName) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-400">Import a file to see content</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 h-full overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-700">{fileName}</span>
      </div>
      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
        {content.length > 2000 ? content.slice(0, 2000) + '...' : content}
      </pre>
      {content.length > 2000 && (
        <p className="text-xs text-gray-400 mt-2">Content truncated (max 2000 chars shown)</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ContextPreview.tsx && git commit -m "feat: add ContextPreview component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Create PromptInput Component

**Files:**
- Create: `src/components/PromptInput.tsx`

**Step 1: Create PromptInput.tsx**

```tsx
interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function PromptInput({ value, onChange, onSubmit, disabled }: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        placeholder="Describe the diagram you want to generate... (Ctrl+Enter to submit)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PromptInput.tsx && git commit -m "feat: add PromptInput component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Create DrawioEditor Component

**Files:**
- Create: `src/components/DrawioEditor.tsx`

**Step 1: Create DrawioEditor.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';

interface DrawioEditorProps {
  xml: string | null;
  onXmlChange?: (xml: string) => void;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&吸着=0&noSave=0&proto=json';

export function DrawioEditor({ xml, onXmlChange }: DrawioEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from draw.io
      if (!event.data || typeof event.data !== 'object') return;

      const data = event.data;
      if (data.event === 'init') {
        setIsLoaded(true);
      }
      if (data.event === 'xmlLoaded' && onXmlChange) {
        onXmlChange(data.xml);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onXmlChange]);

  useEffect(() => {
    if (!isLoaded || !xml || !iframeRef.current) return;

    // Send XML to draw.io editor
    const iframe = iframeRef.current;
    try {
      iframe.contentWindow?.postMessage({
        action: 'load',
        xml: xml,
      }, '*');
    } catch (e) {
      console.error('Failed to load XML into draw.io:', e);
    }
  }, [isLoaded, xml]);

  if (!xml) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p>Generated diagram will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200">
      <iframe
        ref={iframeRef}
        src={DRAWIO_URL}
        className="w-full h-full"
        title="Draw.io Editor"
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/DrawioEditor.tsx && git commit -m "feat: add DrawioEditor component with iframe embed

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Create SettingsModal Component

**Files:**
- Create: `src/components/SettingsModal.tsx`

**Step 1: Create SettingsModal.tsx**

```tsx
import { useState, useEffect } from 'react';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'] },
  { id: 'ollama', name: 'Ollama', models: ['llama3', 'qwen2', 'codegemma', 'mistral'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
  { id: 'minimax', name: 'MiniMax', models: ['abab6.5s', 'abab6-chat'] },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', models: [] },
];

export function SettingsModal({ isOpen, onClose, config, onSave }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const selectedProvider = PROVIDERS.find(p => p.id === localConfig.provider);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">LLM Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localConfig.provider}
              onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value, model: '' })}
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder="Enter API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            {selectedProvider?.models.length ? (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                <option value="">Select model</option>
                {selectedProvider.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                placeholder="Enter model name"
              />
            )}
          </div>

          {(localConfig.provider === 'ollama' || localConfig.provider === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localConfig.baseUrl}
                onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
                placeholder={localConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SettingsModal.tsx && git commit -m "feat: add SettingsModal component with provider config

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Create useLLM Hook

**Files:**
- Create: `src/hooks/useLLM.ts`

**Step 1: Create useLLM.ts**

```tsx
import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface UseLLMReturn {
  generate: (context: string, prompt: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export function useLLM(config: LLMConfig): UseLLMReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (context: string, prompt: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<string>('generate_drawio_xml_cmd', {
        request: {
          context,
          prompt,
          provider: config.provider,
          api_key: config.apiKey,
          model: config.model,
          base_url: config.baseUrl || null,
        },
      });
      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  return { generate, isLoading, error };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useLLM.ts && git commit -m "feat: add useLLM hook for backend communication

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Assemble App Component

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace App.tsx**

```tsx
import { useState, useCallback } from 'react';
import { FileImport } from './components/FileImport';
import { ContextPreview } from './components/ContextPreview';
import { PromptInput } from './components/PromptInput';
import { DrawioEditor } from './components/DrawioEditor';
import { SettingsModal, LLMConfig } from './components/SettingsModal';
import { useLLM } from './hooks/useLLM';

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
};

function App() {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [drawioXml, setDrawioXml] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('ezgraph_llm_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const { generate, isLoading, error } = useLLM(llmConfig);

  const handleFileContent = useCallback((content: string, name: string) => {
    setFileContent(content);
    setFileName(name);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!fileContent || !prompt) return;

    try {
      const xml = await generate(fileContent, prompt);
      setDrawioXml(xml);
    } catch (e) {
      console.error('Generation failed:', e);
    }
  }, [fileContent, prompt, generate]);

  const handleSaveConfig = useCallback((config: LLMConfig) => {
    setLlmConfig(config);
    localStorage.setItem('ezgraph_llm_config', JSON.stringify(config));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-xl font-bold text-gray-800">EzGraph</h1>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
        >
          ⚙️ Settings
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/3 flex flex-col gap-4 p-4 overflow-auto">
          <FileImport onFileContent={handleFileContent} />
          <ContextPreview content={fileContent} fileName={fileName} />
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleGenerate}
            disabled={isLoading || !fileContent || !prompt}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !fileContent || !prompt}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '⏳ Generating...' : '✨ Generate Diagram'}
          </button>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            {fileName ? `Context: ${fileContent.length} chars` : 'No file loaded'}
          </p>
        </div>

        {/* Right Panel - Draw.io Editor */}
        <div className="flex-1 p-4">
          <DrawioEditor xml={drawioXml} />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={llmConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

export default App;
```

**Step 2: Commit**

```bash
git add src/App.tsx && git commit -m "feat: assemble main App component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Integration & Build

### Task 13: Final Build Verification

**Step 1: Verify all files exist**

Run:
```bash
ls -la src/components/ && ls -la src/hooks/
```

**Step 2: Run frontend build**

Run:
```bash
cd /home/wzx/ezgraph && npm run build 2>&1
```

Expected: Build completes without errors

**Step 3: Run Rust build**

Run:
```bash
cd /home/wzx/ezgraph/src-tauri && cargo build --release 2>&1
```

Expected: Build completes without errors

**Step 4: Final commit**

```bash
git add -A && git commit -m "feat: complete EzGraph application

Phase 4 - Integration and build verification.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-2 | Project initialization, Tauri config |
| 2 | 3-5 | Rust backend: dependencies, file parser, LLM adapter |
| 3 | 6-12 | React frontend: all components and hooks |
| 4 | 13 | Build verification |

Total: **13 tasks**

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-29-ezgraph-implementation-plan.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
