//! Initialization: tokio runtime and node setup

use std::path::PathBuf;
use std::sync::Arc;

use ankurah::{Node, PermissiveAgent};
use ankurah_storage_sled::SledStorageEngine;
use ankurah_websocket_client::WebsocketClient;
use once_cell::sync::OnceCell;
use std::sync::Mutex;
use tokio::runtime::Runtime;

use crate::types::AnkurahError;

type AnkurahNode = Node<SledStorageEngine, PermissiveAgent>;
type WsClient = WebsocketClient<SledStorageEngine, PermissiveAgent>;

static RUNTIME: OnceCell<Runtime> = OnceCell::new();
static NODE: Mutex<Option<AnkurahNode>> = Mutex::new(None);
static WS_CLIENT: Mutex<Option<WsClient>> = Mutex::new(None);

thread_local! {
    static ENTER_GUARD: std::cell::RefCell<Option<tokio::runtime::EnterGuard<'static>>> = const { std::cell::RefCell::new(None) };
}

fn storage_path() -> PathBuf {
    dirs::data_local_dir()
        .map(|d| d.join("ankurah"))
        .or_else(|| dirs::home_dir().map(|d| d.join(".ankurah")))
        .unwrap_or_else(|| PathBuf::from("ankurah_data"))
}

/// Initialize tokio runtime and enter context for this thread.
/// Must be called before init_node().
#[uniffi::export]
pub fn init_runtime() {
    let rt = RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime")
    });
    ENTER_GUARD.with(|g| {
        let mut guard = g.borrow_mut();
        if guard.is_none() {
            *guard = Some(rt.enter());
        }
    });
}

/// Initialize Ankurah node
/// - `server_url: Some(url)` - connect to server (ephemeral node)
/// - `server_url: None` - offline mode (durable standalone node)
#[uniffi::export]
pub async fn init_node(server_url: Option<String>) -> Result<(), AnkurahError> {
    if NODE.lock().unwrap().is_some() {
        tracing::debug!("init_node called but node already initialized, skipping");
        return Ok(());
    }

    let path = storage_path();
    std::fs::create_dir_all(&path).map_err(|e| AnkurahError::Storage {
        message: format!("Failed to create {}: {}", path.display(), e),
    })?;

    let storage = Arc::new(SledStorageEngine::with_path(path.clone()).map_err(|e| {
        AnkurahError::Storage {
            message: format!("Failed to open storage: {}", e),
        }
    })?);

    let node = match &server_url {
        Some(url) => {
            let node = Node::new(storage, PermissiveAgent::new());
            tracing::info!("Node {}: connecting to {}", node.id, url);
            let client = WebsocketClient::new(node.clone(), url)
                .await
                .map_err(|e| AnkurahError::Connection { message: e.to_string() })?;
            node.system.wait_system_ready().await;
            *WS_CLIENT.lock().unwrap() = Some(client);
            node
        }
        None => {
            let node = Node::new_durable(storage, PermissiveAgent::new());
            tracing::info!("Node {}: offline mode", node.id);
            node.system.wait_loaded().await;
            if node.system.root().is_none() {
                node.system
                    .create()
                    .await
                    .map_err(|e| AnkurahError::Internal { message: e.to_string() })?;
            }
            node
        }
    };

    *NODE.lock().unwrap() = Some(node);
    tracing::info!(
        "Node ready ({})",
        if server_url.is_some() { "connected" } else { "offline" }
    );

    Ok(())
}

#[uniffi::export]
pub fn get_context() -> Result<ankurah::Context, AnkurahError> {
    NODE.lock()
        .unwrap()
        .as_ref()
        .ok_or(AnkurahError::NotInitialized)?
        .context(ankurah::policy::DEFAULT_CONTEXT)
        .map_err(|e| AnkurahError::Internal {
            message: e.to_string(),
        })
}
