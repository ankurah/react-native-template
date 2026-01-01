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

## Phase 3: Model Derive Macros (Current)

**Planning doc**: `ankurah/specs/uniffi-derive-integration.md`

### 3a: Scaffolding
- [x] Add `uniffi` feature to `ankurah-derive/Cargo.toml`
- [ ] Add `uniffi` feature to `ankurah/Cargo.toml`
- [ ] Add mutual exclusivity `compile_error!` for bindings features
- [ ] Create empty `derive/src/model/uniffi.rs`
- [ ] Wire up `uniffi_impl()` call in `lib.rs`

### 3b: View + Mutable with UniFFI
- [ ] Update `view.rs` to add `#[derive(uniffi::Object)]` when uniffi feature enabled
- [ ] Update `mutable.rs` similarly
- [ ] Test: Can we export `MessageView` via UniFFI?

### 3c: Ref Wrapper
- [ ] Create `uniffi_ref_wrapper()` in `uniffi.rs`
- [ ] Test: Can we pass `MessageRef` across FFI?

### 3d: CRUD Operations (Ops Singleton)
- [ ] Create `uniffi_ops_wrapper()` for `FooOps` singleton
- [ ] Implement `get`, `fetch`, `create` methods
- [ ] Add conditional `uniffi::Error` derives to relevant error types

### 3e: Reactive Patterns
- [ ] Create `uniffi_livequery_callback_trait()` for per-model callback traits
- [ ] Implement `LiveQuery`, `ResultSet`, `ChangeSet` wrappers
- [ ] Test subscription lifecycle

### 3f: Refactor for Sharing
- [ ] Extract shared method bodies to helper functions
- [ ] Reduce duplication between `wasm.rs` and `uniffi.rs`

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

---

## Decisions Made

### 1. Static Methods → Singleton Ops Object ✅
UniFFI doesn't support static methods. Use `MessageOps` singleton pattern:
```typescript
const messageOps = new MessageOps();
const msg = await messageOps.get(ctx, id);
```

### 2. Callback Interfaces → Per-Model Traits ✅
Each model gets its own typed callback trait (`MessageLiveQueryCallback`, etc.) for full type safety.

### 3. Error Handling → Minimal Changes ✅
No changes to existing error types. Add `#[cfg_attr(feature = "uniffi", derive(uniffi::Error))]` conditionally where needed.

### 4. Feature Exclusivity → Mutually Exclusive ✅
Bindings features (`wasm`, `uniffi`) are mutually exclusive with `compile_error!`.

### 5. Async Runtime → Left to Bindings Crate ✅
Generated code doesn't manage tokio runtime; that's handled in `rn-bindings`.

---

## Known Issues / Notes

- `uniffi-bindgen-react-native` generates overly broad `s.source_files` in podspec
  - Workaround: `sed` command in `rebuild-ios.sh` narrows it
  - TODO: Report upstream or find root cause
- Structural Rust changes (new objects/traits) may require clean build
- Metro cache should be reset after native rebuilds (`--reset-cache`)
- UniFFI async functions need a tokio runtime (handled via global `RUNTIME` in `rn-bindings`)

---

## UniFFI Capabilities Validated in PoC

| Feature | Status | Notes |
|---------|--------|-------|
| Free functions | ✅ | `greet()`, `init_node()` |
| Async functions | ✅ | `greet_async()` |
| Objects | ✅ | `Counter` class |
| Object methods | ✅ | `counter.get()`, `counter.increment()` |
| Constructors | ✅ | `new Counter()` |
| Callback interfaces | ✅ | `CounterCallback`, `LogCallback` |
| Error enums | ✅ | `AnkurahError` with variants |
| Option types | ✅ | `Option<String>` → `string \| null` |
| Vec types | ⚠️ | Not yet tested with objects |
| Nested objects | ⚠️ | Not yet tested |
| Object in callback | ⚠️ | Not yet tested (needed for ChangeSet) |
