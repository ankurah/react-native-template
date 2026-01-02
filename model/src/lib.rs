use ankurah::{Model, Ref};
use serde::{Deserialize, Serialize};

#[cfg(feature = "uniffi")]
uniffi::setup_scaffolding!();

// Re-export signals types for UniFFI binding generation
#[cfg(feature = "uniffi")]
pub use ankurah::signals::{ReactObserver, StoreChangeCallback};

#[derive(Model, Debug, Serialize, Deserialize)]
pub struct User {
    pub display_name: String,
}

// Room model - chat rooms
#[derive(Model, Debug, Serialize, Deserialize)]
pub struct Room {
    pub name: String,
}

#[derive(Model, Debug, Serialize, Deserialize)]
pub struct Message {
    #[active_type(LWW)]
    pub user: Ref<User>,
    #[active_type(LWW)]
    pub room: Ref<Room>,
    pub text: String,
    pub timestamp: i64,
    #[active_type(LWW)]
    pub deleted: bool,
}
