//! Minimal UniFFI bindings for React Native proof-of-concept.
//! Step 1: Sync function only

/// Simple sync function to verify FFI works
#[uniffi::export]
pub fn greet(name: String) -> String {
    format!("Hello from Rust, {}!", name)
}

uniffi::setup_scaffolding!();
