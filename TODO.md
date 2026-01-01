# Ankurah React Native Template - TODO

## Phase 1: Proof of Concept ✅

- [x] Create repo and set up bare React Native project
- [x] Create minimal UniFFI Rust crate (`rn-bindings`)
- [x] Verify sync function (`greet`) works
- [x] Verify async function (`greet_async`) works  
- [x] Verify callback interface (`Counter` + `CounterCallback`) works
- [x] Document setup steps in `react-native-setup-from-scratch-all-steps.md`

## Phase 2: Ankurah Integration

- [ ] Enable `akdev` for local Ankurah development
- [ ] Add Ankurah dependencies to `rn-bindings`:
  - [ ] `ankurah` with `uniffi` feature
  - [ ] `ankurah-storage-sled`
  - [ ] `ankurah-websocket-client`
- [ ] Create `AnkurahContext` wrapper object
- [ ] Export basic operations: create node, connect to server
- [ ] Test local storage persistence with Sled

## Phase 3: Model Derive Macros

- [ ] Add `#[cfg(feature = "uniffi")]` to `ankurah-derive`
- [ ] Generate monomorphized wrappers:
  - [ ] `*View`, `*Mutable` types
  - [ ] `*ResultSet`, `*LiveQuery`, `*ChangeSet`
  - [ ] Static namespace methods (`Model.get()`, `Model.query()`, `Model.create()`)
- [ ] Maintain API parity with WASM bindings

## Phase 4: Reactive UI & Full App Port

- [ ] Copy `model/` from `ankurah-react-sled-template`
- [ ] Copy `server/` from `ankurah-react-sled-template`
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

