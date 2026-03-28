use encoding_rs::{BIG5, GBK};
use pulldown_cmark::{Event, Parser, Tag};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;

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
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    let (decoded, _, had_errors) = GBK.decode(bytes);
    if !had_errors {
        return decoded.into_owned();
    }

    let (decoded, _, had_errors) = BIG5.decode(bytes);
    if !had_errors {
        return decoded.into_owned();
    }

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
