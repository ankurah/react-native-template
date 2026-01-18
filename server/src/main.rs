use ankurah::{policy::DEFAULT_CONTEXT as c, Node, PermissiveAgent, Ref};
use ankurah_rn_model::{Message, MessageView, Room, RoomView, User, UserView};
use ankurah_storage_sled::SledStorageEngine;
use ankurah_websocket_server::WebsocketServer;
use anyhow::Result;
use std::sync::Arc;
use tracing::{info, Level};

const SEED_MESSAGE_COUNT: i64 = 100;
const SEED_TIMESTAMP_START: i64 = 1700000000000; // Nov 2023, well in the past
const SEED_TIMESTAMP_INTERVAL: i64 = 1000; // 1 second between messages

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    // Initialize storage engine
    let storage = SledStorageEngine::with_homedir_folder(".ankurah-rn-template")?;
    let node = Node::new_durable(Arc::new(storage), PermissiveAgent::new());

    node.system.wait_loaded().await;
    if node.system.root().is_none() {
        node.system.create().await?;
    }

    // Ensure rooms exist
    ensure_room(&node, "General").await?;
    let scroll_test_room_id = ensure_seed_data(&node).await?;

    // Print all messages for debugging
    print_all_messages(&node, &scroll_test_room_id).await?;

    let mut server = WebsocketServer::new(node);
    server.run("0.0.0.0:9898").await?;

    Ok(())
}

/// Ensure a room with the given name exists
async fn ensure_room(node: &Node<SledStorageEngine, PermissiveAgent>, name: &str) -> Result<String> {
    let context = node.context_async(c).await;
    let query = format!("name = '{}'", name);
    let rooms = context.fetch::<RoomView>(query.as_str()).await?;

    if rooms.is_empty() {
        info!("Creating '{}' room", name);
        let trx = context.begin();
        let room = trx.create(&Room { name: name.to_string() }).await?;
        let id = room.id().to_string();
        trx.commit().await?;
        info!("'{}' room created with ID: {}", name, id);
        Ok(id)
    } else {
        let id = rooms[0].id().to_string();
        info!("'{}' room already exists with ID: {}", name, id);
        Ok(id)
    }
}

async fn ensure_seed_data(node: &Node<SledStorageEngine, PermissiveAgent>) -> Result<String> {
    let context = node.context_async(c).await;

    // Ensure "Scroll Test" room exists for seed data
    let room_id = ensure_room(node, "Scroll Test").await?;

    // Ensure "SeedBot" user exists
    let users = context.fetch::<UserView>("display_name = 'SeedBot'").await?;
    let user_id = if users.is_empty() {
        info!("Creating 'SeedBot' user");
        let trx = context.begin();
        let user = trx.create(&User { display_name: "SeedBot".to_string() }).await?;
        let id = user.id().to_string();
        trx.commit().await?;
        info!("'SeedBot' user created with ID: {}", id);
        id
    } else {
        let id = users[0].id().to_string();
        info!("'SeedBot' user already exists with ID: {}", id);
        id
    };

    // Check how many seed messages exist (just check total in room)
    let query = format!("room = '{}' AND deleted = false", room_id);
    let messages = context.fetch::<MessageView>(query.as_str()).await?;

    if messages.len() < SEED_MESSAGE_COUNT as usize {
        info!("Creating {} seed messages (currently have {})", SEED_MESSAGE_COUNT, messages.len());

        let trx = context.begin();
        let user_ref: Ref<User> = user_id.as_str().try_into().unwrap();
        let room_ref: Ref<Room> = room_id.as_str().try_into().unwrap();
        for i in 0..SEED_MESSAGE_COUNT {
            let timestamp = SEED_TIMESTAMP_START + (i * SEED_TIMESTAMP_INTERVAL);
            trx.create(&Message {
                user: user_ref.clone().into(),
                room: room_ref.clone().into(),
                text: format!("Seed message #{:03} (ts={})", i, timestamp),
                timestamp,
                deleted: false,
            }).await?;
        }
        trx.commit().await?;
        info!("Created {} seed messages", SEED_MESSAGE_COUNT);
    } else {
        info!("Seed messages already exist ({} messages)", messages.len());
    }

    Ok(room_id)
}

async fn print_all_messages(node: &Node<SledStorageEngine, PermissiveAgent>, room_id: &str) -> Result<()> {
    let context = node.context_async(c).await;

    let query = format!("room = '{}' AND deleted = false", room_id);
    let mut messages = context.fetch::<MessageView>(query.as_str()).await?;

    // Sort by timestamp
    messages.sort_by_key(|m| m.timestamp().unwrap_or(0));

    info!("=== All messages in room {} ({} total) ===", room_id, messages.len());

    // Build plain text for file output
    let mut lines = Vec::new();
    lines.push(format!("# Seed Messages (room={})", room_id));
    lines.push(format!("# Total: {} messages", messages.len()));
    lines.push(format!("# Format: [index] id timestamp text"));
    lines.push(String::new());
    for (i, msg) in messages.iter().enumerate() {
        let id = msg.id().to_string();
        let ts = msg.timestamp().unwrap_or(0);
        let text = msg.text().unwrap_or_default();
        info!("  [{:03}] id={} ts={} text='{}'", i, id, ts, text);
        lines.push(format!("[{:03}] {} {} {}", i, id, ts, text));
    }
    info!("=== End of messages ===");

    // Write to file
    std::fs::write("seed_messages.txt", lines.join("\n"))?;
    info!("Saved messages to seed_messages.txt");

    Ok(())
}
