//! Minimal UniFFI bindings for React Native proof-of-concept.
//!
//! Tests:
//! 1. Async function - verify promises work across FFI
//! 2. Object with methods - verify object lifecycle works
//! 3. Callback interface - verify we can call back into JS (Phase 2)

use std::sync::atomic::{AtomicU32, Ordering};

/// Simple async function to verify promises work
#[uniffi::export]
pub async fn greet_async(name: String) -> String {
    // Simulate async work
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    format!("Hello, {}!", name)
}

/// Simple sync function
#[uniffi::export]
pub fn greet_sync(name: String) -> String {
    format!("Hello, {}!", name)
}

/// Simple counter to test object methods
#[derive(uniffi::Object)]
pub struct Counter {
    value: AtomicU32,
}

#[uniffi::export]
impl Counter {
    /// Create a new counter starting at 0
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self {
            value: AtomicU32::new(0),
        }
    }

    /// Increment the counter
    pub fn increment(&self) -> u32 {
        self.value.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// Get the current value
    pub fn get(&self) -> u32 {
        self.value.load(Ordering::SeqCst)
    }

    /// Async method to test async on objects
    pub async fn increment_after_delay(&self, delay_ms: u64) -> u32 {
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        self.increment()
    }
}

uniffi::setup_scaffolding!();
