# Ankurah React Native Template

A React Native chat application template demonstrating [Ankurah](https://github.com/ankurah/ankurah) integration via UniFFI bindings. This template provides a working example of real-time collaborative data with offline-first capabilities on iOS and Android.

## Features

- **Real-time sync**: WebSocket connection to Ankurah server with live updates
- **Local storage**: Sled-based persistence with automatic sync
- **Reactive UI**: Signal-based re-rendering via `useObserve` hook
- **Virtual scroll**: Efficient pagination for large message lists
- **Full chat UI**: Rooms, messages, user profiles, inline editing
- **Maestro tests**: Automated UI test suite included

## Prerequisites

- macOS (for iOS development)
- Xcode 16.1+
- Node.js 20+
- Ruby with Bundler (for CocoaPods)
- Rust toolchain with iOS targets:
  ```bash
  rustup target add aarch64-apple-ios-sim aarch64-apple-ios
  ```

## Quick Start

### 1. Install dependencies

```bash
# Install JS dependencies
cd react-app
npm install

# Install iOS dependencies
bundle install
bundle exec pod install
cd ..
```

### 2. Start the server

```bash
cargo run -p ankurah-rn-server
```

The server runs on `ws://localhost:9898` and creates a "General" room plus seed data for scroll testing.

### 3. Run the app

```bash
./dev.sh
```

This builds the Rust bindings, generates UniFFI TypeScript, and launches the iOS app in the simulator.

For subsequent runs after code changes:
```bash
./dev.sh          # Incremental rebuild
./dev.sh --clean  # Clean rebuild (clears caches)
./dev.sh --hard   # Full clean (nukes everything)
```

## Project Structure

```
├── model/              # Shared data models (User, Room, Message)
├── rn-bindings/        # UniFFI bindings exposing Ankurah to React Native
├── server/             # Ankurah WebSocket server
├── react-app/          # React Native application
│   ├── App.tsx         # Main app entry point
│   ├── src/
│   │   ├── components/ # UI components (Chat, RoomList, etc.)
│   │   ├── hooks/      # React hooks (useObserve, useSignal, etc.)
│   │   └── generated/  # Auto-generated UniFFI TypeScript bindings
│   └── ios/            # iOS native project
├── maestro/            # Automated UI tests
└── dev.sh              # Build and run script
```

## Customization

### Adding new models

1. Define your model in `model/src/lib.rs`:
   ```rust
   #[derive(Model, Debug, Serialize, Deserialize)]
   pub struct MyModel {
       pub field: String,
   }
   ```

2. Rebuild bindings: `./dev.sh --clean`

3. Use in React Native:
   ```typescript
   const items = useObserve(() => liveQuery.items());
   ```

### Changing the server URL

Edit `rn-bindings/src/lib.rs`:
```rust
const DEFAULT_SERVER_URL: &str = "ws://your-server:9898";
```

Or pass a custom URL when initializing in `App.tsx`.

## Running Tests

```bash
# Run Maestro UI tests (requires running app)
./run-maestro-tests.sh

# Run Rust tests
cargo test
```

## Troubleshooting

**Build fails with UniFFI errors**: Run `./dev.sh --hard` to clean all caches.

**App can't connect to server**: Ensure server is running and check firewall settings. iOS simulator uses `localhost` directly.

**Rust logs**: Appear in the Metro console prefixed with `[Rust/INFO]`, `[Rust/WARN]`, etc. Use the in-app debug panel (tap Debug button) for scroll state info.

## License

MIT OR Apache-2.0
