//! Logging and panic handling

use std::collections::VecDeque;
use std::sync::{Mutex, RwLock};

use once_cell::sync::OnceCell;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

use crate::types::LogEntry;

// =============================================================================
// Panic Handling
// =============================================================================

static PANIC_LOG: OnceCell<Mutex<Vec<String>>> = OnceCell::new();
const MAX_PANICS: usize = 100;

fn panic_storage() -> &'static Mutex<Vec<String>> {
    PANIC_LOG.get_or_init(|| Mutex::new(Vec::new()))
}

#[ctor::ctor]
fn init_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "Unknown panic".to_string());

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        let msg = format!("PANIC at {}: {}\n{:?}", location, payload, std::backtrace::Backtrace::capture());

        if let Ok(mut log) = panic_storage().lock() {
            if log.len() >= MAX_PANICS {
                log.remove(0);
            }
            log.push(msg.clone());
        }

        eprintln!("{}", msg);
        if let Some(dir) = dirs::data_local_dir() {
            let path = dir.join("ankurah").join("panic_log.txt");
            let _ = std::fs::create_dir_all(path.parent().unwrap());
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
                .and_then(|mut f| {
                    use std::io::Write;
                    let ts = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    writeln!(f, "=== {} ===\n{}\n", ts, msg)
                });
        }
    }));
}

#[uniffi::export]
pub fn get_last_panic() -> Option<String> {
    panic_storage().lock().ok().and_then(|g| g.last().cloned())
}

// =============================================================================
// Tracing / Logging
// =============================================================================

static LOG_BUFFER: RwLock<VecDeque<LogEntry>> = RwLock::new(VecDeque::new());
const MAX_LOGS: usize = 1000;

struct BufferLogLayer;

impl<S: tracing::Subscriber> tracing_subscriber::Layer<S> for BufferLogLayer {
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: tracing_subscriber::layer::Context<'_, S>) {
        let mut message = String::new();
        event.record(&mut MessageVisitor(&mut message));

        let entry = LogEntry {
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            level: event.metadata().level().to_string(),
            target: event.metadata().target().to_string(),
            message,
        };

        if let Ok(mut buf) = LOG_BUFFER.write() {
            if buf.len() >= MAX_LOGS {
                buf.pop_front();
            }
            buf.push_back(entry);
        }
    }
}

struct MessageVisitor<'a>(&'a mut String);

impl<'a> tracing::field::Visit for MessageVisitor<'a> {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            *self.0 = format!("{:?}", value);
        } else if self.0.is_empty() {
            *self.0 = format!("{}={:?}", field.name(), value);
        } else {
            self.0.push_str(&format!(" {}={:?}", field.name(), value));
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            *self.0 = value.to_string();
        } else if self.0.is_empty() {
            *self.0 = format!("{}={}", field.name(), value);
        } else {
            self.0.push_str(&format!(" {}={}", field.name(), value));
        }
    }
}

/// Initialize the tracing subscriber. Call once at startup.
#[uniffi::export]
pub fn init_logging() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        tracing_subscriber::registry()
            .with(BufferLogLayer)
            .with(tracing_subscriber::filter::LevelFilter::INFO)
            .init();
        tracing::info!("Logging initialized");
    });
}

/// Get buffered logs and clear the buffer
#[uniffi::export]
pub fn get_buffered_logs() -> Vec<LogEntry> {
    LOG_BUFFER.write().ok().map(|mut b| b.drain(..).collect()).unwrap_or_default()
}
