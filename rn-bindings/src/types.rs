//! Types for UniFFI export

/// Error type for Ankurah operations
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum AnkurahError {
    #[error("Storage error: {message}")]
    Storage { message: String },
    #[error("Connection error: {message}")]
    Connection { message: String },
    #[error("Not initialized")]
    NotInitialized,
    #[error("Already initialized")]
    AlreadyInitialized,
    #[error("Internal error: {message}")]
    Internal { message: String },
}

/// A single log entry
#[derive(uniffi::Record, Clone)]
pub struct LogEntry {
    pub timestamp_ms: u64,
    pub level: String,
    pub target: String,
    pub message: String,
}
