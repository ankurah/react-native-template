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
{{crate_name}}_model::uniffi_reexport_scaffolding!();

// Generate MessageScrollManager
use {{crate_name}}_model::MessageView;
ankurah_virtual_scroll::generate_scroll_manager!(
    {{crate_name}}_model::Message,
    MessageView,
    {{crate_name}}_model::MessageLiveQuery,
    timestamp_field = "timestamp"
);
