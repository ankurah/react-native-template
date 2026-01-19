# Ankurah React Native Maestro Test Suite Specification

## Overview

This document specifies a robust, comprehensive Maestro test suite for the Ankurah React Native chat application. The test suite is designed to be:

## Priority 0: Pixel-Perfect Scroll Anchoring Tests

**This is the most critical and fiddly test.** Virtual scrolling with pagination is easy to break, and scroll anchor failures cause jarring UX. This test validates the core invariant:

> For any scroll of N pixels, every message visible before AND after must have moved exactly N pixels.

### Test Architecture

The test is implemented as a TypeScript function that runs internally and reports PASS/FAIL. Maestro triggers it via a test button and asserts on the result.

```
┌─────────────────────────────────────────────────────────────┐
│  Maestro                                                     │
│  - Tap "Run Scroll Test" button                             │
│  - Wait for result                                          │
│  - assertVisible: "SCROLL_TEST:PASS"                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  TypeScript Test Function                                   │
│  1. Create room "Test_XXXXX" (random 5-char suffix)         │
│  2. Calculate message count for 3-5 page loads each way     │
│  3. Create messages, wait for live mode at bottom           │
│  4. Scroll UP in 5-10px increments:                         │
│     - Capture visible message positions                     │
│     - Scroll N pixels                                       │
│     - await manager.quiesce() (wait for loading complete)   │
│     - Capture new positions                                 │
│     - Validate: intersection moved exactly N pixels         │
│  5. Continue until hasMoreOlder() === false                 │
│  6. Scroll DOWN in 5-10px increments (same validation)      │
│  7. Continue until back in Live mode                        │
│  8. Report PASS or FAIL with details                        │
└─────────────────────────────────────────────────────────────┘
```

### Requirements

- **Minimum 2x viewport height** of messages loaded at any time
- **3-5 page loads tested** in each direction (up and down)
- **Scroll increment**: 5-10px (configurable)
- **Position measurement**: Pixel-perfect via measure() or layout tracking
- **Wait mechanism**: `manager.quiesce()` - resolves when loading complete

### Implementation Components

1. **MessageScrollManager.quiesce()**: Rust-side async wait for loading completion
2. **getVisibleMessagePositions()**: Returns `{id, y}[]` for visible messages
3. **validatePositionDelta()**: Checks all intersecting messages moved exactly N px
4. **Progress reporting**: Updates UI every N cycles for observability

### Success Criteria

- All scroll increments pass position validation
- Reaches top (hasMoreOlder = false)
- Returns to bottom in Live mode (hasMoreNewer = false, mode = Live)
- No messages "jump" during pagination events

---

## Standard UI Tests

The tests below are

- **Deterministic**: Same inputs produce same outputs
- **Isolated**: Tests don't depend on external state or each other (where possible)
- **Self-healing**: Handles timing variations and transient failures gracefully
- **Maintainable**: Clear structure, reusable flows, and good documentation
- **CI-ready**: Can run in headless mode with proper reporting

## Design Principles

### 1. Element Selection Strategy

**Priority order for element selection:**

1. **Accessibility labels** (most stable): `testID` props map to accessibility labels
2. **Text content** (for static UI): Direct text matching for buttons, labels
3. **Percentage-based coordinates** (last resort): Only for elements without accessible identifiers

**Anti-patterns to avoid:**
- Absolute pixel coordinates (device-dependent)
- Index-based selection without context (fragile)
- Deep hierarchy traversal (breaks on refactors)

### 2. Wait Strategies

**Never use fixed delays.** Instead:

```yaml
# Good: Wait for specific condition
- extendedWaitUntil:
    visible: "Connected"
    timeout: 15000

# Bad: Fixed sleep
- wait: 5000
```

**Timeout guidelines:**
- App launch/initialization: 15-20 seconds
- Network operations: 10 seconds
- Animations: Use `waitForAnimationToEnd`
- State changes: 5 seconds

### 3. Test Isolation

**Isolation levels:**

| Level | Use Case | Implementation |
|-------|----------|----------------|
| **Full** | Critical paths, flaky tests | `clearState: true` on launch |
| **Partial** | Related test sequences | Fresh room/entity per test |
| **None** | Performance tests, stress tests | Shared state acceptable |

**Database management:**
- Standalone mode (`TEST_MODE=true`) creates isolated local database
- `clearState: true` wipes app data including Sled database
- Tests should not assume data from previous tests exists

### 4. Error Recovery

**Retry patterns:**

```yaml
# Retry flaky operations
- runFlow:
    file: common/send_message.yaml
    env:
      MESSAGE: "Test message"
    retries: 2
```

**Graceful degradation:**
```yaml
# Optional cleanup that shouldn't fail the test
- tapOn:
    text: "Close"
    optional: true
```

## Test Categories

### Category 1: Smoke Tests (P0)
Essential functionality that must work for any release.

| Test | Description | Priority |
|------|-------------|----------|
| `01_app_launch.yaml` | App launches, initializes, shows UI | P0 |
| `02_user_name_editing.yaml` | User can edit and persist their name | P0 |
| `03_room_creation.yaml` | User can create a room | P0 |
| `04_message_sending.yaml` | User can send and see messages | P0 |

### Category 2: Core Feature Tests (P1)
Key functionality for primary use cases.

| Test | Description | Priority |
|------|-------------|----------|
| `10_room_list_navigation.yaml` | Navigate between rooms | P1 |
| `11_message_ordering.yaml` | Messages appear in correct order | P1 |
| `12_user_attribution.yaml` | Messages show correct sender | P1 |
| `13_timestamp_display.yaml` | Timestamps render correctly | P1 |
| `14_dark_mode.yaml` | Theme switching works | P1 |

### Category 3: Data Persistence Tests (P1)
Verify data survives app restarts and edge cases.

| Test | Description | Priority |
|------|-------------|----------|
| `20_message_persistence.yaml` | Messages persist after restart | P1 |
| `21_room_persistence.yaml` | Rooms persist after restart | P1 |
| `22_user_state_persistence.yaml` | User preferences persist | P1 |
| `23_large_room_persistence.yaml` | Many messages persist correctly | P1 |

### Category 4: Scroll & Pagination Tests (P1)
Critical for chat UX - these catch regressions in virtual scrolling.

| Test | Description | Priority |
|------|-------------|----------|
| `30_scroll_to_bottom.yaml` | New messages auto-scroll when at bottom | P1 |
| `31_scroll_anchor_up.yaml` | Scroll position preserved when scrolling up | P1 |
| `32_pagination_load.yaml` | Older messages load when scrolling up | P1 |
| `33_pagination_anchor.yaml` | No jump when pagination loads new batch | P1 |
| `34_rapid_scroll.yaml` | Rapid scrolling doesn't cause glitches | P2 |

### Category 5: Edge Cases (P2)
Less common scenarios that should still work.

| Test | Description | Priority |
|------|-------------|----------|
| `40_empty_room.yaml` | Empty room shows placeholder | P2 |
| `41_long_message.yaml` | Very long messages display correctly | P2 |
| `42_special_characters.yaml` | Emoji, unicode, special chars work | P2 |
| `43_rapid_message_send.yaml` | Sending messages quickly works | P2 |
| `44_background_foreground.yaml` | App handles backgrounding | P2 |

### Category 6: Stress Tests (P3)
Performance and stability under load.

| Test | Description | Priority |
|------|-------------|----------|
| `50_many_messages.yaml` | Room with 100+ messages | P3 |
| `51_many_rooms.yaml` | 20+ rooms in list | P3 |
| `52_continuous_scroll.yaml` | Extended scrolling session | P3 |

## Reusable Flows

### Common Flows (`maestro/common/`)

```
common/
  wait_for_connection.yaml    # Wait for "Connected" status
  navigate_to_room_list.yaml  # Ensure we're on room list
  create_room.yaml            # Create room with given name
  send_message.yaml           # Send message in current room
  scroll_to_load_more.yaml    # Scroll up to trigger pagination
```

### Flow Parameters

```yaml
# common/create_room.yaml
appId: org.reactjs.native.example.{{project-name | pascal_case}}
env:
  ROOM_NAME: "DefaultRoom"
---
- tapOn: "+"
- inputText: ${ROOM_NAME}
- pressKey: "Enter"
- waitForAnimationToEnd
- assertVisible: ${ROOM_NAME}
```

**Usage:**
```yaml
- runFlow:
    file: common/create_room.yaml
    env:
      ROOM_NAME: "MyTestRoom"
```

## Accessibility Labels (testID mapping)

The app exposes testIDs for reliable element selection:

| Element | testID | Status |
|---------|--------|--------|
| Header container | `header` | Done |
| User name field | `user-name-input` | Done |
| User info container | `user-info` | Done |
| Connection status | `connection-status` | Done |
| Room list container | `room-list` | Done |
| Create room button | `create-room-btn` | Done |
| New room input | `new-room-input` | Done |
| Room item | `room-item-{id}` | Done |
| Chat header | `chat-header` | Done |
| Back button | `back-btn` | Done |
| Room title | `room-title` | Done |
| Debug toggle | `debug-toggle` | Done |
| Loading indicator | `loading-indicator` | Done |
| Message list container | `message-list-container` | Done |
| Message list | `message-list` | Done |
| Empty messages | `empty-messages` | Done |
| Jump to live button | `jump-to-live-btn` | Done |
| Message input container | `message-input-container` | Done |
| Message input | `message-input` | Done |
| Send button | `send-btn` | Done |
| Cancel edit button | `cancel-edit-btn` | Done |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Maestro Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash

      - name: Start iOS Simulator
        run: |
          xcrun simctl boot "iPhone 16"

      - name: Build App (Test Mode)
        run: ./rebuild-ios.sh --test

      - name: Run Smoke Tests
        run: |
          maestro test maestro/01_app_launch.yaml
          maestro test maestro/02_user_name_editing.yaml
          maestro test maestro/03_room_creation.yaml
          maestro test maestro/04_message_sending.yaml

      - name: Upload Screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-screenshots
          path: ~/.maestro/screenshots/
```

### Test Execution Order

```bash
# Run all tests in order (stops on first failure)
maestro test maestro/ --order-by-name

# Run specific priority level
maestro test maestro/0*.yaml  # P0 smoke tests
maestro test maestro/1*.yaml  # P1 core tests
maestro test maestro/2*.yaml  # P1 persistence
maestro test maestro/3*.yaml  # P1 scroll/pagination

# Run with retries
maestro test maestro/ --retries 2
```

### Screenshot Strategy

```yaml
# Capture on assertion for debugging
- takeScreenshot: "before_action"
- tapOn: "Submit"
- takeScreenshot: "after_action"

# Always capture on failure (automatic in Maestro)
```

## Debug Panel Integration

The app includes a debug panel for monitoring internal state during tests:

```yaml
# Open debug panel
- tapOn: "▲"

# Verify pagination state
- assertVisible: "Mode: Live"
- assertVisible: "Items: 25"
- assertVisible: "More older: yes"

# Use for scroll anchor verification
- takeScreenshot: "debug_state"
```

## Test Data Management

### Unique Test Data

```yaml
# Use timestamps for uniqueness
onFlowStart:
  - evalScript: ${timestamp = new Date().getTime()}

# Then in tests:
- inputText: "Message_${timestamp}"
```

### Known Test Data

For persistence tests, use predictable data:
```yaml
# Create with known name
- inputText: "PersistenceTestRoom"

# After restart, verify it exists
- assertVisible: "PersistenceTestRoom"
```

## Flakiness Mitigation

### Common Causes & Solutions

| Cause | Solution |
|-------|----------|
| Animation timing | `waitForAnimationToEnd` |
| Network latency | `extendedWaitUntil` with generous timeout |
| Element not yet rendered | Wait for parent container first |
| Keyboard blocking elements | `hideKeyboard` before taps |
| Previous test state | `clearState: true` |
| Simulator performance | Run on specific, consistent device |

### Flaky Test Protocol

1. Identify flaky test via CI reports
2. Add debug screenshots before/after failure point
3. Increase timeouts if timing-related
4. Add explicit waits for state conditions
5. Consider test isolation if state-related
6. Document known flakiness with TODO

## Implementation Roadmap

### Phase 1: Foundation (Current)
- [x] Basic test structure
- [x] Standalone test mode
- [x] Smoke tests (01-04)
- [ ] Add testIDs to React components
- [ ] Scroll/pagination test (05)

### Phase 2: Coverage
- [ ] Common reusable flows
- [ ] Persistence tests (20-23)
- [ ] Full scroll/pagination suite (30-34)
- [ ] Edge case tests (40-44)

### Phase 3: CI Integration
- [ ] GitHub Actions workflow
- [ ] Test result reporting
- [ ] Screenshot archival
- [ ] Flakiness tracking

### Phase 4: Advanced
- [ ] Stress tests (50-52)
- [ ] Multi-device sync tests (if applicable)
- [ ] Performance benchmarks
- [ ] Visual regression tests

## Appendix: Maestro Command Reference

### Essential Commands

```yaml
# Launch with options
- launchApp:
    clearState: true
    arguments:
      TEST_MODE: "true"

# Flexible waiting
- extendedWaitUntil:
    visible: "Text"
    timeout: 10000

# Scroll operations
- scroll:
    direction: "UP"
    duration: 1000

# Conditional operations
- tapOn:
    text: "Optional Button"
    optional: true

# Assertions
- assertVisible: "Expected Text"
- assertNotVisible: "Should Not Exist"

# Input
- inputText: "Type this"
- eraseText: 20
- pressKey: "Enter"
- hideKeyboard
```

### Debug Commands

```yaml
# Screenshots
- takeScreenshot: "descriptive_name"

# Pause for manual inspection
- stopApp
# Then manually inspect state

# JavaScript evaluation
- evalScript: ${console.log('Debug: ' + someVar)}
```
