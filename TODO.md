# Ankurah React Native Template - TODO

## Phase 1: Proof of Concept ✅

- [x] Create repo and set up bare React Native project
- [x] Create minimal UniFFI Rust crate (`rn-bindings`)
- [x] Verify sync function (`greet`) works
- [x] Verify async function (`greet_async`) works  
- [x] Verify callback interface (`Counter` + `CounterCallback`) works
- [x] Document setup steps in `react-native-setup-from-scratch-all-steps.md`

## Phase 2: Basic Ankurah Integration ✅

- [x] Enable `akdev` for local Ankurah development
- [x] Add Ankurah dependencies to `rn-bindings`:
  - [x] `ankurah` with `derive` feature
  - [x] `ankurah-storage-sled`
  - [x] `ankurah-websocket-client`
- [x] Copy `model/` and `server/` from `ankurah-react-sled-template`
- [x] Create basic node initialization (`init_node`, `is_node_initialized`, `get_node_id`)
- [x] Connect to WebSocket server
- [x] Set up `tracing` subscriber to forward Rust logs to RN console
- [x] Test node creation and server connection in the app

## Phase 3: Model Derive Macros (Next)

**Planning doc**: `ankurah/specs/uniffi-derive-integration.md`

- [ ] Add `uniffi` feature to `ankurah-derive/Cargo.toml` ✅ (done)
- [ ] Add `uniffi` feature to `ankurah/Cargo.toml`
- [ ] Design shared vs divergent code strategy (see planning doc)
- [ ] Start minimal: Add UniFFI attributes to `View` struct
- [ ] Create `uniffi.rs` with `Ref` wrapper
- [ ] Test with `model/` crate in this repo
- [ ] Expand to full wrapper set:
  - [ ] `*View`, `*Mutable` types
  - [ ] `*ResultSet`, `*LiveQuery`, `*ChangeSet`
  - [ ] Static namespace methods (`Model.get()`, `Model.query()`, `Model.create()`)
- [ ] Design callback interface for reactive subscriptions
- [ ] Maintain API parity with WASM bindings

## Phase 4: Reactive UI & Full App Port

- [ ] Research RN reactive patterns for UniFFI callbacks
- [ ] Implement `useAnkurahQuery` hook (RN equivalent of `useObserve`)
- [ ] Port components from `ankurah-react-sled-template`:
  - [ ] Header
  - [ ] RoomList
  - [ ] MessageRow
  - [ ] MessageInput
  - [ ] Chat
  - [ ] EditableTextField
  - [ ] MessageContextMenu
  - [ ] ChatDebugHeader / DebugOverlay
  - [ ] QRCodeModal
- [ ] Replace `localStorage` with `AsyncStorage`
- [ ] Test full chat app functionality

## Known Issues / Notes

- `uniffi-bindgen-react-native` generates overly broad `s.source_files` in podspec
  - Workaround: `sed` command in `rebuild-ios.sh` narrows it
  - TODO: Report upstream or find root cause
- Structural Rust changes (new objects/traits) may require clean build
- Metro cache should be reset after native rebuilds (`--reset-cache`)
- UniFFI async functions need a tokio runtime (handled via global `RUNTIME` in `rn-bindings`)

## Key Decisions Made

1. **Ephemeral node pattern**: RN app creates ephemeral node that connects to durable server (same as WASM pattern)
2. **WebSocket client**: Using native `ankurah-websocket-client` (not the WASM version)
3. **Storage**: Sled for local persistence
4. **Logging**: Custom `tracing` layer forwards Rust logs to JS console via callback
5. **Derive macros**: Will update `ankurah-derive` to generate UniFFI bindings alongside WASM (not separate crate)

