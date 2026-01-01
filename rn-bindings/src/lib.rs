//! Minimal UniFFI bindings for React Native proof-of-concept.
//! Step 2: Sync + Async functions

/// Simple sync function to verify FFI works
#[uniffi::export]
pub fn greet(name: String) -> String {
    format!("Hello from Rust, {}!", name)
}

/// Async function to verify promises work across FFI
/// Note: UniFFI async uses its own executor, so we just use std::thread::sleep
#[uniffi::export]
pub async fn greet_async(name: String, delay_ms: u64) -> String {
    // UniFFI runs async functions on a thread pool, so blocking is OK here
    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    format!("Hello Async from Rust, {}! (after {}ms)", name, delay_ms)
}

uniffi::setup_scaffolding!();
