# React Native + UniFFI Setup From Scratch

## Overview
This documents the steps to set up a React Native app with UniFFI Rust bindings.

## Prerequisites
- macOS Sequoia or later
- Xcode 16.1+ (RN 0.83 requirement)
- Node.js 20+
- Bun (preferred package manager)
- Ruby with Bundler (for CocoaPods)
- Rust toolchain

## Phase 1: Plain React Native App

### Step 1: Create React Native Project
```bash
npx @react-native-community/cli init AnkurahApp --directory react-app --pm bun
cd react-app
```

### Step 2: Verify iOS Build
```bash
# Install iOS dependencies
cd ios && bundle install && bundle exec pod install && cd ..

# Run on iOS simulator
bun ios
```

**Expected**: App launches in simulator with default React Native welcome screen.

---

## Phase 2: Add UniFFI Rust Bindings

### Step 1: Create Rust Crate
Create `rn-bindings/Cargo.toml`:
```toml
[package]
name = "ankurah-rn-bindings"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "staticlib"]
name = "ankurah_rn_bindings"

[dependencies]
uniffi = "0.29"
tokio = { version = "1", features = ["rt", "sync", "time"] }
```

Create `rn-bindings/src/lib.rs`:
```rust
use std::sync::atomic::{AtomicU32, Ordering};

#[uniffi::export]
pub async fn greet_async(name: String) -> String {
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    format!("Hello, {}!", name)
}

#[uniffi::export]
pub fn greet_sync(name: String) -> String {
    format!("Hello sync, {}!", name)
}

#[derive(uniffi::Object)]
pub struct Counter {
    value: AtomicU32,
}

#[uniffi::export]
impl Counter {
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self { value: AtomicU32::new(0) }
    }

    pub fn increment(&self) -> u32 {
        self.value.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn get(&self) -> u32 {
        self.value.load(Ordering::SeqCst)
    }

    pub async fn increment_after_delay(&self, delay_ms: u64) -> u32 {
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        self.increment()
    }
}

uniffi::setup_scaffolding!();
```

### Step 2: Add uniffi-bindgen-react-native
```bash
cd react-app
bun add uniffi-bindgen-react-native
```

### Step 3: Configure package.json
Add required fields for podspec validation:
```json
{
  "description": "Ankurah React Native Template with UniFFI bindings",
  "author": "Ankurah",
  "license": "MIT",
  "homepage": "https://github.com/ankurah/ankurah-react-native-template",
  "repository": {
    "type": "git",
    "url": "https://github.com/ankurah/ankurah-react-native-template.git"
  },
  "codegenConfig": {
    "name": "RNNativeModuleSpec",
    "type": "modules",
    "jsSrcsDir": "src"
  }
}
```

### Step 4: Create ubrn.config.yaml
```yaml
rust:
  directory: ../rn-bindings
  manifestPath: Cargo.toml
outDir: src/generated
```

### Step 5: Build Rust and Generate Bindings
```bash
# Build for iOS simulator (arm64)
npx ubrn build ios --sim-only --and-generate

# This generates:
# - src/generated/*.ts (TypeScript bindings)
# - src/NativeAnkurahApp.ts (TurboModule spec)
# - src/index.tsx (entry point with native module init)
# - cpp/*.{cpp,h,hpp} (C++ bindings)
# - ios/*.{h,mm} (Objective-C++ TurboModule)
# - AnkurahApp.podspec
# - AnkurahAppFramework.xcframework
```

### Step 6: Update Podfile
Add to `ios/Podfile` inside the target block:
```ruby
pod 'AnkurahApp', :path => '..'
```

### Step 7: Reinstall Pods
```bash
cd ios
rm -rf Pods Podfile.lock
bundle exec pod install
cd ..
```

### Step 8: Update App.tsx
Import from `./src` to ensure native module initialization:
```typescript
import { greetAsync, greetSync, Counter } from './src';
```

---

## Key Learnings

### 1. Package.json Requirements
`uniffi-bindgen-react-native` requires these fields in package.json:
- `repository` (with `url` ending in `.git`)
- `description`
- `author`
- `license`
- `homepage`

### 2. Rust Library Naming
The `[lib] name` in Cargo.toml must match the package name for ubrn to find the built library correctly.

### 3. Podspec source_files
The generated podspec may include overly broad globs like `ios/**/*.swift` which can cause conflicts. Narrow to specific files:
```ruby
s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"
```

### 4. React Native Codegen
Adding `codegenConfig` to package.json triggers React Native's codegen to generate `RNNativeModuleSpec.h` which the TurboModule needs.

### 5. New Architecture
React Native 0.83+ enables New Architecture by default. The TurboModule code in `ios/AnkurahApp.mm` should be wrapped in `#ifdef RCT_NEW_ARCH_ENABLED`.

### 6. Native Module Initialization
The generated `src/index.tsx` calls `installer.installRustCrate()` which sets up `globalThis.NativeAnkurahRnBindings`. Always import from `./src` rather than directly from `./src/generated/*`.

### 7. Pod Installation Order
After generating bindings:
1. Delete `ios/Pods` and `ios/Podfile.lock`
2. Run `bundle exec pod install`
3. This triggers codegen and properly links the native module

---

## Troubleshooting

### "TurboModuleRegistry.getEnforcing(...): 'AnkurahApp' could not be found"
- Ensure `pod 'AnkurahApp', :path => '..'` is in Podfile
- Verify AnkurahApp appears in Podfile.lock
- Check that `codegenConfig` is in package.json
- Reimport from `./src` not `./src/generated/*`

### Build hangs on Swift compilation
- Check podspec `s.source_files` isn't too broad
- Should not include main app's Swift files

### "RNNativeModuleSpec.h not found"
- Add `codegenConfig` to package.json
- Re-run `pod install` to trigger codegen

### SSL/Network errors during cargo build
- Run with network permissions enabled
- Check corporate proxy settings

