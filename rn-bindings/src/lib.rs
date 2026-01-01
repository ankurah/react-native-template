//! UniFFI bindings for Ankurah React Native
//! Phase 2: Basic Ankurah integration

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use ankurah::{Node, PermissiveAgent};
use ankurah_storage_sled::SledStorageEngine;
use ankurah_websocket_client::WebsocketClient;
use once_cell::sync::OnceCell;
use tokio::runtime::Runtime;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Global tokio runtime for Ankurah operations
/// Ankurah uses tokio internally (for channels, spawning tasks, etc.)
static RUNTIME: OnceCell<Runtime> = OnceCell::new();

/// Global log callback for forwarding tracing logs to JS
static LOG_CALLBACK: OnceCell<Mutex<Box<dyn LogCallback>>> = OnceCell::new();

fn get_runtime() -> &'static Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime")
    })
}

// ============================================================================
// Logging - forwards tracing logs to JS
// ============================================================================

/// Callback interface for receiving log messages in JS
#[uniffi::export(callback_interface)]
pub trait LogCallback: Send + Sync {
    /// Called when a log message is emitted
    /// level: "TRACE", "DEBUG", "INFO", "WARN", "ERROR"
    fn on_log(&self, level: String, target: String, message: String);
}

/// Custom tracing layer that forwards logs to JS
struct JsLogLayer;

impl<S> tracing_subscriber::Layer<S> for JsLogLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        if let Some(callback_mutex) = LOG_CALLBACK.get() {
            if let Ok(callback) = callback_mutex.lock() {
                let level = event.metadata().level().to_string();
                let target = event.metadata().target().to_string();

                // Extract the message from the event
                let mut visitor = MessageVisitor::default();
                event.record(&mut visitor);
                let message = visitor.message;

                callback.on_log(level, target, message);
            }
        }
    }
}

#[derive(Default)]
struct MessageVisitor {
    message: String,
}

impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value);
        } else if self.message.is_empty() {
            // Fallback: use the first field as the message
            self.message = format!("{}: {:?}", field.name(), value);
        } else {
            self.message
                .push_str(&format!(" {}={:?}", field.name(), value));
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else if self.message.is_empty() {
            self.message = format!("{}: {}", field.name(), value);
        } else {
            self.message
                .push_str(&format!(" {}={}", field.name(), value));
        }
    }
}

/// Set up logging with a callback to receive log messages in JS
/// Should be called once at app startup before init_node
#[uniffi::export]
pub fn setup_logging(callback: Box<dyn LogCallback>) {
    // Store the callback
    if LOG_CALLBACK.set(Mutex::new(callback)).is_err() {
        eprintln!("Warning: Log callback was already set");
        return;
    }

    // Set up the tracing subscriber with our custom layer
    tracing_subscriber::registry()
        .with(JsLogLayer)
        .with(tracing_subscriber::filter::LevelFilter::INFO)
        .init();
}

// ============================================================================
// Phase 1 PoC code (keeping for reference/testing)
// ============================================================================

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

// ============================================================================
// Phase 2: Ankurah Integration
// ============================================================================

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

type AnkurahNode = Node<SledStorageEngine, PermissiveAgent>;

/// Global node instance (similar to WASM pattern)
static NODE: OnceCell<AnkurahNode> = OnceCell::new();

/// Global websocket client (keeps connection alive)
static WS_CLIENT: OnceCell<WebsocketClient<SledStorageEngine, PermissiveAgent>> = OnceCell::new();

/// Default server URL for development
const DEFAULT_SERVER_URL: &str = "ws://localhost:9797";

/// Get the default storage path for the current platform
/// On iOS/macOS, this uses the user's home directory
/// On other platforms, falls back to a relative path
#[uniffi::export]
pub fn get_default_storage_path() -> String {
    // Use dirs crate to get a writable directory
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("ankurah").to_string_lossy().to_string()
    } else if let Some(home) = dirs::home_dir() {
        home.join(".ankurah").to_string_lossy().to_string()
    } else {
        // Fallback - this probably won't work on iOS
        "ankurah_data".to_string()
    }
}

/// Initialize the Ankurah node with local Sled storage and connect to server
///
/// This spawns initialization in a background tokio task and returns immediately.
/// Use `is_node_initialized()` to check when initialization is complete.
///
/// Args:
///   storage_path: Path to store the Sled database (e.g., app's documents directory)
///   server_url: Optional WebSocket server URL (defaults to ws://localhost:9797)
#[uniffi::export]
pub fn init_node(storage_path: String, server_url: Option<String>) -> Result<(), AnkurahError> {
    if NODE.get().is_some() {
        return Err(AnkurahError::AlreadyInitialized);
    }

    let path = PathBuf::from(&storage_path);

    // Try to create the directory first to get a better error message
    if let Err(e) = std::fs::create_dir_all(&path) {
        return Err(AnkurahError::Storage {
            message: format!("Failed to create directory '{}': {}", storage_path, e),
        });
    }

    let storage =
        SledStorageEngine::with_path(path.clone()).map_err(|e| AnkurahError::Storage {
            message: format!("Failed to open storage at '{}': {}", storage_path, e),
        })?;

    let url = server_url.unwrap_or_else(|| DEFAULT_SERVER_URL.to_string());

    // Ankurah uses tokio internally (for channels, task spawning, etc.)
    // Spawn initialization in a background task so we don't block the JS thread
    let rt = get_runtime();
    let storage_arc = Arc::new(storage);

    rt.spawn(async move {
        eprintln!("RN-BINDINGS: Creating ephemeral node...");
        // Use ephemeral node that connects to a durable server
        let node = Node::new(storage_arc, PermissiveAgent::new());
        eprintln!(
            "RN-BINDINGS: Node created, connecting to server at {}...",
            url
        );

        // Connect to the server via WebSocket
        let client = match WebsocketClient::new(node.clone(), &url).await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("RN-BINDINGS: Failed to connect to server: {}", e);
                return;
            }
        };
        eprintln!("RN-BINDINGS: Connected to server, waiting for system ready...");

        // Wait for the system to be ready (receives root from server)
        node.system.wait_system_ready().await;
        eprintln!("RN-BINDINGS: System ready, setting NODE...");

        // Store the client to keep the connection alive
        if WS_CLIENT.set(client).is_err() {
            eprintln!("RN-BINDINGS: Warning: WebSocket client was already set");
        }

        if NODE.set(node).is_err() {
            eprintln!("RN-BINDINGS: Warning: Node was already initialized");
        } else {
            eprintln!("RN-BINDINGS: Node initialization complete!");
        }
    });

    eprintln!("RN-BINDINGS: Spawned init task, returning...");
    Ok(())
}

/// Check if the node is initialized
#[uniffi::export]
pub fn is_node_initialized() -> bool {
    NODE.get().is_some()
}

/// Get the node's ID as a string
#[uniffi::export]
pub fn get_node_id() -> Result<String, AnkurahError> {
    let node = NODE.get().ok_or(AnkurahError::NotInitialized)?;
    Ok(node.id.to_string())
}

uniffi::setup_scaffolding!();
