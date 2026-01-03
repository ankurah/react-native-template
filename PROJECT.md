# Ankurah React Native UniFFI Project

This project co-develops two repos to enable Ankurah in React Native via UniFFI:

| Repo | Purpose |
|------|---------|
| `ankurah/` | Core library - developing `uniffi` feature for native bindings |
| `ankurah-react-native-template/` | Template app - validates UniFFI bindings, demonstrates usage |
| `ankurah-react-sled-template/` | Reference - browser React app to achieve parity with |

## Goal

Port the `ankurah-react-sled-template` browser chat app to React Native, using UniFFI bindings instead of WASM. The TypeScript API should be as close to the WASM version as possible, with documented acceptable differences where UniFFI constraints require them.

## Current Status

**Working:**
- Node initialization, WebSocket connection to server
- LiveQuery with reactive updates via `useObserve` hook
- Room CRUD operations (create, fetch, query)
- Signal-based re-rendering when data changes

**Not Yet Ported:**
- Full chat UI components (see checklist below)
- User management and persistence
- Message operations

## Architecture

```
React Native App (TypeScript)
        │
        ▼
uniffi-bindgen-react-native (JSI)
        │
        ▼
Swift/Kotlin (auto-generated)
        │
        ▼
Rust FFI (rn-bindings crate)
        │
        ▼
Ankurah Core + Sled Storage + WebSocket Client
```

---

## API Parity Checklist

This checklist tracks TypeScript API parity between WASM (browser) and UniFFI (React Native).

### Legend
- `[x]` - Implemented and working
- `[ ]` - Not yet implemented
- Acceptable differences are noted inline

---

### Signal Observation

- [x] **signalObserver HOC / useObserve hook**

  ```typescript
  // WASM (browser) - HOC wraps component
  import { signalObserver, useObserve } from "ankurah-template-wasm-bindings";
  const MyComponent = signalObserver(() => {
    // signals accessed here trigger re-renders
  });

  // UniFFI (RN) - explicit tracking calls
  // Acceptable difference: useObserve returns observer requiring manual begin/finish
  // Reason: UniFFI can't import JS, so observer lifecycle is explicit
  import { useObserve } from './hooks';
  function MyComponent() {
    const observer = useObserve();
    observer.beginTracking();
    try {
      // signals accessed here trigger re-renders
    } finally {
      observer.finish();
    }
  }
  ```

---

### LiveQuery

- [x] **Create LiveQuery with predicate**

  ```typescript
  // WASM
  const rooms = Room.query(ctx(), "true ORDER BY name ASC");

  // UniFFI
  // Acceptable difference: singleton object instead of static method
  // Reason: UniFFI doesn't support static methods
  const roomOps = new RoomOps();
  const rooms = await roomOps.query(ctx, "true ORDER BY name ASC", []);
  ```

- [x] **Access LiveQuery items**

  ```typescript
  // WASM - property access
  const items = rooms.items;

  // UniFFI - method call
  // Acceptable difference: method instead of property
  const items = rooms.items();
  ```

- [x] **Check if loaded**

  ```typescript
  // WASM
  rooms.is_loaded;

  // UniFFI
  rooms.isLoaded();
  ```

- [ ] **LiveQuery error handling**

  ```typescript
  // WASM
  // TODO: document WASM error pattern

  // UniFFI
  const error = rooms.error(); // returns string | undefined
  ```

---

### Entity Operations

- [x] **Get entity by ID**

  ```typescript
  // WASM
  const room = await Room.get(ctx(), id);

  // UniFFI
  const roomOps = new RoomOps();
  const room = await roomOps.get(ctx, id);
  ```

- [x] **Fetch with predicate**

  ```typescript
  // WASM
  const rooms = await Room.fetch(ctx(), "name = ?", ["General"]);

  // UniFFI
  const roomOps = new RoomOps();
  const rooms = await roomOps.fetch(ctx, "name = ?", [QueryValue.text("General")]);
  // Note: QueryValue enum wraps substitution values
  ```

- [x] **Create entity**

  ```typescript
  // WASM
  const transaction = ctx().begin();
  const room = await Room.create(transaction, { name: "General" });
  await transaction.commit();

  // UniFFI
  const roomOps = new RoomOps();
  const input = RoomInput.create({ name: "General" });
  const room = await roomOps.createOne(ctx, input);
  // Note: createOne handles transaction internally
  // For explicit transaction control, use create() with ctx.begin()
  ```

- [ ] **Create with transaction (explicit)**

  ```typescript
  // WASM
  const transaction = ctx().begin();
  const room = await Room.create(transaction, { name: "General" });
  await transaction.commit();

  // UniFFI - pending implementation
  ```

---

### View Field Access

- [x] **Access scalar fields**

  ```typescript
  // WASM - property access
  const name = room.name;

  // UniFFI - method call
  // Acceptable difference: method instead of property
  // Reason: UniFFI Objects use methods, not properties
  const name = room.name();
  ```

- [x] **Access entity ID**

  ```typescript
  // WASM
  const id = room.id;
  const base64 = room.id.to_base64();

  // UniFFI
  const id = room.id();
  const base64 = room.id().toString();
  // Note: toString() returns base64 representation
  ```

- [ ] **Access Ref fields**

  ```typescript
  // WASM
  const authorId = message.user.id;
  const author = users.resultset.by_id(message.user.id);

  // UniFFI - pending verification
  ```

---

### Mutation

- [ ] **Edit entity via Mutable**

  ```typescript
  // WASM
  const trx = ctx().begin();
  const mutable = view.edit(trx);
  mutable.text.replace("new value");
  await trx.commit();

  // UniFFI - pending implementation
  ```

- [ ] **YrsString operations (insert/delete)**

  ```typescript
  // WASM
  const mutable = view.edit(trx);
  mutable.display_name.insert(0, "prefix ");
  mutable.display_name.delete(5, 3);

  // UniFFI - pending implementation
  ```

---

### JsValueMut / State Management

- [ ] **Shared mutable state**

  ```typescript
  // WASM - JsValueMut for shared reactive state
  const [selectedRoom, selectedRoomRead] = JsValueMut.newPair<RoomView | null>(null);
  selectedRoom.set(room);
  const current = selectedRoomRead.get();

  // UniFFI - need RN equivalent
  // Options: React state, Zustand, or port JsValueMut concept
  ```

---

### Components to Port

| Component | Status | Notes |
|-----------|--------|-------|
| Header | [ ] | User display name editing |
| RoomList | [ ] | Room selection, creation |
| MessageRow | [ ] | Message display, context menu |
| MessageInput | [ ] | Send/edit messages |
| Chat | [ ] | Message list with scroll management |
| EditableTextField | [ ] | Inline YrsString editing |
| MessageContextMenu | [ ] | Edit/delete actions |
| ChatDebugHeader | [ ] | Debug info |
| DebugOverlay | [ ] | Global debug toggle |
| QRCodeModal | [ ] | Share room via QR |

---

### Platform Adaptations

| Browser | React Native |
|---------|--------------|
| `localStorage` | `AsyncStorage` |
| CSS files | `StyleSheet.create()` |
| `<div>`, `<span>` | `<View>`, `<Text>` |
| `<input>` | `<TextInput>` |
| `onClick` | `onPress` |
| `window.location` | Config/props |

---

## Key UniFFI Constraints

These are architectural constraints from UniFFI that affect API design:

1. **No static methods** - Use singleton `FooOps` objects instead of `Foo.method()`
2. **No generics** - All types are monomorphized (e.g., `LWWString` not `LWW<String>`)
3. **Objects use methods** - Field access is `view.name()` not `view.name`
4. **Records are data-only** - Input types (e.g., `RoomInput`) can't have methods
5. **No JS imports** - Can't call into JS from Rust (unlike wasm-bindgen)
6. **Arc wrapping** - `Vec<T>` and `Option<T>` with Objects need `Arc<T>`

See `ankurah/specs/uniffi/` for detailed documentation on these constraints.

---

## Development

### Build & Run

```bash
# Terminal 1: Start server
cd server && cargo run

# Terminal 2: Build iOS and run
./rebuild-ios.sh
cd react-app && bun ios
```

### Regenerate Bindings

```bash
cd react-app
bun ubrn:ios        # Regenerate TypeScript + Swift bindings
bun ubrn:checkout   # If you need to reset generated files
```

### Local Ankurah Development

Use `./akdev` to toggle between published and local ankurah:

```bash
./akdev local   # Use ../ankurah
./akdev remote  # Use published crate
```

---

## Files

| File | Purpose |
|------|---------|
| `react-app/App.tsx` | Current test app (rooms only) |
| `react-app/src/hooks/useObserve.ts` | Signal observer hook |
| `react-app/src/index.tsx` | Generated bindings re-export |
| `rn-bindings/src/lib.rs` | Rust FFI layer |
| `model/src/lib.rs` | Data models (Room, User, Message) |
| `rebuild-ios.sh` | iOS build script |

---

## References

- [ankurah/specs/uniffi/](../ankurah/specs/uniffi/) - UniFFI implementation docs
- [ankurah-react-sled-template](../ankurah-react-sled-template/) - Reference browser app
- [uniffi-bindgen-react-native](https://github.com/jhugman/uniffi-bindgen-react-native)
