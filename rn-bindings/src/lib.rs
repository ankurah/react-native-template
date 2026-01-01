//! Minimal UniFFI bindings for React Native proof-of-concept.
//! Step 3: Sync + Async + Callbacks

use std::sync::{Arc, Mutex};

/// Simple sync function to verify FFI works
#[uniffi::export]
pub fn greet(name: String) -> String {
    format!("Hello from Rust, {}!", name)
}

/// Async function to verify promises work across FFI
#[uniffi::export]
pub async fn greet_async(name: String, delay_ms: u64) -> String {
    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    format!("Hello Async from Rust, {}! (after {}ms)", name, delay_ms)
}

/// Callback interface - JS implements this, Rust calls it
#[uniffi::export(callback_interface)]
pub trait CounterCallback: Send + Sync {
    fn on_update(&self, count: u32);
}

/// Counter object that calls back to JS on each increment
#[derive(uniffi::Object)]
pub struct Counter {
    value: std::sync::atomic::AtomicU32,
    callback: Mutex<Option<Box<dyn CounterCallback>>>,
}

#[uniffi::export]
impl Counter {
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self {
            value: std::sync::atomic::AtomicU32::new(0),
            callback: Mutex::new(None),
        }
    }

    /// Set the callback after construction
    pub fn set_callback(&self, callback: Box<dyn CounterCallback>) {
        *self.callback.lock().unwrap() = Some(callback);
    }

    pub fn increment(&self) -> u32 {
        let new_val = self.value.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
        if let Some(cb) = self.callback.lock().unwrap().as_ref() {
            cb.on_update(new_val);
        }
        new_val
    }

    pub fn get(&self) -> u32 {
        self.value.load(std::sync::atomic::Ordering::SeqCst)
    }
}

uniffi::setup_scaffolding!();
