//! UniFFI bindings for Ankurah React Native

mod init;
mod logging;
mod types;

// Re-export public API
pub use init::*;
pub use logging::*;
pub use types::*;

uniffi::setup_scaffolding!();

// Re-export model crate's scaffolding for linking
ankurah_rn_model::uniffi_reexport_scaffolding!();

// Generate MessageScrollManager
use ankurah_rn_model::MessageView;
ankurah_virtual_scroll::generate_scroll_manager!(
    ankurah_rn_model::Message,
    MessageView,
    ankurah_rn_model::MessageLiveQuery,
    timestamp_field = "timestamp"
);
