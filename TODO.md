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
- [x] Add Ankurah dependencies to `rn-bindings`
- [x] Copy `model/` and `server/` from `ankurah-react-sled-template`
- [x] Create basic node initialization (`init_node`, `is_node_initialized`, `get_node_id`)
- [x] Connect to WebSocket server
- [x] Set up `tracing` subscriber to forward Rust logs to RN console
- [x] Test node creation and server connection in the app

## Phase 3: Model Derive Macros ✅

- [x] Add `uniffi` feature to `ankurah-derive`, `ankurah-proto`, `ankurah-core`, `ankurah`
- [x] Add mutual exclusivity `compile_error!` for wasm/uniffi features
- [x] Create `derive/src/model/uniffi.rs` with code generation
- [x] Make `EntityId` UniFFI-compatible (Object)
- [x] Make `Context` UniFFI-compatible (Object)
- [x] Add `#[uniffi(flat_error)]` to `RetrievalError` and `MutationError`
- [x] Generate `View` and `Mutable` as UniFFI Objects
- [x] Generate `ModelRef` wrapper (e.g., `MessageRef`)
- [x] Generate `ModelInput` Record for creation (e.g., `MessageInput`)
- [x] Generate `ModelOps` singleton with `get`, `fetch`, `query`, `query_nocache`, `create`, `create_one`
- [x] Generate `ModelResultSet` wrapper with `items()`, `get()`, `by_id()`, `len()`, `is_loaded()`
- [x] Generate `ModelChangeSet` wrapper with `initial()`, `added()`, `appeared()`, `removed()`, `updated()`
- [x] Generate `ModelLiveQuery` wrapper with polling methods and `current_selection()`
- [x] Add `edit()` method to View (via `uniffi_edit` with `name = "edit"`)
- [x] Document cross-crate UniFFI learnings in `specs/react-native-uniffi/`
- [x] Add `QueryValue` enum for substitution values (replaces variadic strings)
- [x] Add `uniffi_mutable_field_methods` to generate wrapper type getters on Mutable
- [x] Active type wrapper generation for UniFFI (LWWString, YrsStringString, etc.)
  - Added `uniffi: false` to `get_value` method in `lww.ron`
  - Added filtering by `method.uniffi` in `uniffi_methods()`
  - Used `uniffi::custom_type!` macro for `Json` type (converts to/from String at FFI boundary)
  - Fixed derive macro to not emit `#[cfg(feature = "...")]` into generated code
  - Separated `wasm_wrapper()` and `uniffi_wrapper()` with feature-gated implementations

## Phase 4: Reactive UI & Full App Port 🚧 WIP

### 4a: Build and Test Current Bindings ✅
- [x] Regenerate TypeScript bindings with `ubrn`
- [x] Verify generated types look correct (RoomOps, RoomView, etc.)
- [x] Test basic operations in the app:
  - [x] Create a Room
  - [x] Fetch rooms with `RoomOps.fetch()`
  - [x] Query rooms with `RoomOps.query()` (LiveQuery)

### 4b: React Native Hooks ✅
- [x] Research RN reactive patterns for UniFFI (polling vs callbacks)
- [x] Implement `useObserve` hook (RN equivalent of WASM `useObserve`)
- [x] Add `ReactObserver` to `ankurah-signals` with UniFFI exports
- [x] Implement `StoreChangeCallback` callback interface
- [x] Handle LiveQuery lifecycle (cleanup on unmount)

### 4c: Port Components
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

### 4d: Full Integration Test
- [ ] Test full chat app functionality
- [ ] Test real-time sync between devices
- [ ] Test offline/reconnection behavior

---

## Decisions Made

### 1. Static Methods → Singleton Ops Object ✅
UniFFI doesn't support static methods. Use `RoomOps` singleton pattern:
```typescript
const roomOps = new RoomOps();
const rooms = await roomOps.fetch(ctx, 'true ORDER BY name ASC', []);
```

### 2. Reactive Updates → useSyncExternalStore + Callback Interface ✅
Using React's `useSyncExternalStore` with a UniFFI callback interface for reactive updates.
The `ReactObserver` in Rust manages signal subscriptions and notifies React via `StoreChangeCallback`.

### 3. Error Handling → Flat Errors ✅
Using `#[uniffi(flat_error)]` to serialize complex error enums via `ToString`.

### 4. Feature Exclusivity → Mutually Exclusive ✅
Bindings features (`wasm`, `uniffi`) are mutually exclusive with `compile_error!`.

### 5. Input Records → String for Ref<T> ✅
`Ref<T>` fields in Input Records become `String` (base64 EntityId) since:
- UniFFI doesn't support generics
- EntityId is an Object, can't be in a Record

### 6. Collections → Arc Wrapping ✅
`Vec<T>` and `Option<T>` with Objects require `Arc<T>` wrapping.

### 7. Async Runtime → Tokio via UniFFI Attribute ✅
UniFFI async functions use `#[uniffi::export(async_runtime = "tokio")]` to ensure
they run within a tokio runtime context, which Ankurah requires internally.

---

## Known Issues / Notes

- `uniffi-bindgen-react-native` generates overly broad `s.source_files` in podspec
  - Workaround: `sed` command in `rebuild-ios.sh` narrows it
- Structural Rust changes (new objects/traits) may require clean build
- Metro cache should be reset after native rebuilds (`--reset-cache`)
- Cross-crate UniFFI: borrowed args (`&T`) work, owned args (`T`) don't
- Use `::uniffi::Object` not `::ankurah::derive_deps::uniffi::Object` in generated code
- Generated code should NOT include `#[cfg(feature = "...")]` - the derive macro conditionally generates code based on its own features

---

## UniFFI Capabilities Validated

| Feature | Status | Notes |
|---------|--------|-------|
| Free functions | ✅ | `greet()`, `init_node()` |
| Async functions | ✅ | `greet_async()`, `Ops.get()`, `Ops.query()` |
| Objects | ✅ | `Counter`, `RoomView`, `RoomOps`, `ReactObserver` |
| Object methods | ✅ | `counter.get()`, `view.id()`, `observer.beginTracking()` |
| Constructors | ✅ | `RoomOps.new()`, `ReactObserver.new()` |
| Records | ✅ | `RoomInput` |
| Callback interfaces | ✅ | `CounterCallback`, `LogCallback`, `StoreChangeCallback` |
| Error enums | ✅ | `AnkurahError`, `RetrievalError` |
| Option<T> | ✅ | Works with Arc<Object> |
| Vec<T> | ✅ | Works with Arc<Object> |
| Cross-crate types | ✅ | `EntityId`, `Context` from other crates |
| Method renaming | ✅ | `#[uniffi::method(name = "edit")]` |
| LiveQuery | ✅ | Reactive queries with signal-based updates |
