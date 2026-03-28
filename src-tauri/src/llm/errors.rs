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
