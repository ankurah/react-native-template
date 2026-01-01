# React Native + UniFFI Setup From Scratch

## Overview
This documents the steps to set up a React Native app with UniFFI Rust bindings.

## Prerequisites
- macOS Sequoia or later
- Xcode 16.1+ (RN 0.83 requirement)
- Node.js 20+
- Ruby with Bundler (for CocoaPods)
- Rust toolchain with iOS targets (`rustup target add aarch64-apple-ios-sim`)

## Phase 1: Plain React Native App

### Step 1: Create React Native Project
```bash
npx @react-native-community/cli init AnkurahApp --directory react-app
```
Answer **y** when prompted to install CocoaPods.

### Step 2: Verify iOS Build
```bash
cd react-app
npx react-native run-ios --simulator="iPhone 16"
```

**Expected**: App launches in simulator with default React Native welcome screen.

---

## Phase 2: Add UniFFI Rust Bindings (Sync Function)

### Step 1: Create Workspace Cargo.toml
Create `Cargo.toml` at the repo root:
```toml
[workspace]
members = ["rn-bindings"]

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT OR Apache-2.0"
```

### Step 2: Create Rust Crate
Create `rn-bindings/Cargo.toml`:
```toml
[package]
name = "ankurah-rn-bindings"
version.workspace = true
edition.workspace = true
license.workspace = true

[lib]
crate-type = ["cdylib", "staticlib"]
name = "ankurah_rn_bindings"

[dependencies]
uniffi = "0.29"
```

Create `rn-bindings/src/lib.rs`:
```rust
//! Minimal UniFFI bindings for React Native proof-of-concept.

/// Simple sync function to verify FFI works
#[uniffi::export]
pub fn greet(name: String) -> String {
    format!("Hello from Rust, {}!", name)
}

uniffi::setup_scaffolding!();
```

### Step 3: Add uniffi-bindgen-react-native
```bash
cd react-app
npm install uniffi-bindgen-react-native
```

### Step 4: Configure package.json
Add these fields to `react-app/package.json` (merge with existing content):
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

### Step 5: Create ubrn.config.yaml
Create `react-app/ubrn.config.yaml`:
```yaml
rust:
  directory: ../rn-bindings
  manifestPath: Cargo.toml
```

### Step 6: Build Rust and Generate Bindings
```bash
cd react-app
npx ubrn build ios --sim-only --and-generate
```

This generates:
- `src/generated/*.ts` - TypeScript bindings
- `src/NativeAnkurahApp.ts` - TurboModule spec  
- `src/index.tsx` - Entry point with native module init
- `cpp/*.{cpp,h,hpp}` - C++ bindings
- `ios/AnkurahApp.{h,mm}` - Objective-C++ TurboModule
- `AnkurahApp.podspec` - Pod specification
- `AnkurahAppFramework.xcframework` - Compiled Rust library

### Step 7: Fix Podspec source_files (CRITICAL)
The generated podspec includes overly broad globs that cause build hangs. Edit `react-app/AnkurahApp.podspec`:

**Find this line:**
```ruby
s.source_files = "ios/**/*.{h,m,mm,swift}", ...
```

**Replace with:**
```ruby
s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"
```

### Step 8: Update Podfile
Add to `react-app/ios/Podfile` inside the `target 'AnkurahApp' do` block, before `post_install`:
```ruby
  # UniFFI native module
  pod 'AnkurahApp', :path => '..'
```

### Step 9: Reinstall Pods
```bash
cd ios
pod install
cd ..
```

### Step 10: Update App.tsx
Replace `react-app/App.tsx` with:
```typescript
/**
 * Ankurah React Native UniFFI PoC
 * Step 1: Sync function test
 */

import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import from src/index.tsx which handles native module initialization
import { greet } from './src';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Call the Rust function
  const greeting = greet('React Native');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.content}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            🦀 UniFFI + React Native
          </Text>
          <Text style={[styles.result, isDarkMode && styles.textLight]}>
            {greeting}
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#000',
  },
  result: {
    fontSize: 20,
    color: '#000',
  },
  textLight: {
    color: '#fff',
  },
});

export default App;
```

### Step 11: Build and Run
```bash
npx react-native run-ios --simulator="iPhone 16"
```

**Expected**: App shows "🦀 UniFFI + React Native" title and "Hello from Rust, React Native!" message.

---

## Key Learnings

### 1. Package.json Requirements
`uniffi-bindgen-react-native` requires these fields:
- `repository` (with `url` ending in `.git`)
- `description`, `author`, `license`, `homepage`

### 2. Rust Library Naming
The `[lib] name` in Cargo.toml must match the package name (with underscores) for ubrn to find the built library.

### 3. Podspec source_files (CRITICAL)
The generated podspec includes `ios/**/*.swift` which pulls in the main app's Swift files, causing the Swift compiler to hang. Always narrow to specific files after generation.

### 4. React Native Codegen
Adding `codegenConfig` to package.json triggers React Native's codegen to generate `RNNativeModuleSpec.h` which the TurboModule needs.

### 5. Native Module Initialization
The generated `src/index.tsx` calls `installer.installRustCrate()` which sets up `globalThis.NativeAnkurahRnBindings`. Always import from `./src` rather than directly from `./src/generated/*`.

### 6. Build Caching Issues
After `xcodebuild clean` or pod changes, the React Native CLI may incorrectly report "success" without actually rebuilding. Run `npx react-native run-ios` again to force a proper rebuild.

---

## Troubleshooting

### "TurboModuleRegistry.getEnforcing(...): 'AnkurahApp' could not be found"
- Ensure `pod 'AnkurahApp', :path => '..'` is in Podfile
- Verify AnkurahApp appears in Podfile.lock after `pod install`
- Check that `codegenConfig` is in package.json
- Import from `./src` not `./src/generated/*`
- Run `npx react-native run-ios` again (may need two runs after pod changes)

### Build hangs on Swift compilation
- Check podspec `s.source_files` isn't too broad
- Should NOT include `ios/**/*.swift`
- Fix: `s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"`

### "RNNativeModuleSpec.h not found"
- Add `codegenConfig` to package.json
- Re-run `pod install` to trigger codegen

### App shows white screen
- Check Metro terminal for JavaScript errors
- Press Cmd+D in simulator for dev menu → "Open Debugger"
