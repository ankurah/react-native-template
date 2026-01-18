#!/bin/bash
# =============================================================================
# rebuild-ios.sh - The single source of truth for iOS builds
# =============================================================================
#
# GOAL: Always do the right thing. No manual cleanup commands needed.
#
# This script handles ALL scenarios correctly:
#   - First build (no existing artifacts)
#   - Incremental build (only changed code)
#   - Full rebuild (when upstream Rust changes require it)
#   - Simulator not running (boots it automatically)
#   - Stale app installed (uninstalls before reinstalling)
#
# The key insight: Cargo's fingerprinting doesn't always detect when proc-macro
# outputs need to change (e.g., when ankurah-derive generates different code).
# We solve this by comparing source mtimes against the built library and only
# cleaning fingerprints when necessary.
#
# Usage: ./rebuild-ios.sh [--clean] [--test]
#   --clean: Force full rebuild (cleans all caches)
#   --test:  Enable test mode (standalone node, fresh database each run)
# =============================================================================
set -e
cd "$(dirname "$0")/react-app"

FORCE_CLEAN=false
HARD_CLEAN=false
TEST_MODE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --clean)
      FORCE_CLEAN=true
      echo "🔥 Force clean requested"
      ;;
    --hard)
      FORCE_CLEAN=true
      HARD_CLEAN=true
      echo "🔥🔥🔥 HARD clean requested - nuking everything"
      ;;
    --test)
      TEST_MODE=true
      echo "🧪 Test mode enabled (standalone node, fresh database)"
      ;;
  esac
done

# Hard clean: nuke everything
if [ "$HARD_CLEAN" = true ]; then
  echo "🗑️  Deleting DerivedData..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/AnkurahApp-*
  echo "🗑️  cargo clean..."
  (cd .. && cargo clean)
  echo "🗑️  Deleting node_modules..."
  rm -rf node_modules
  echo "🗑️  Deleting ios/Pods..."
  rm -rf ios/Pods ios/Podfile.lock
  echo "🗑️  Clearing Metro cache..."
  rm -rf /tmp/metro-* node_modules/.cache
  echo "🗑️  Installing node_modules..."
  npm install --silent
fi

# Auto-detect broken node_modules (e.g., missing @babel/runtime)
# This catches scenarios where node_modules was deleted or corrupted
if [ ! -d "node_modules" ] || [ ! -d "node_modules/@babel/runtime" ]; then
  echo "📦 node_modules missing or incomplete - running npm install..."
  npm install --silent
fi

# Find the iPhone 16 simulator
SIMULATOR_ID=$(xcrun simctl list devices | grep "iPhone 16 (" | grep -v "Pro" | grep -v "Plus" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
if [ -z "$SIMULATOR_ID" ]; then
  echo "❌ No iPhone 16 simulator found"
  exit 1
fi
echo "📱 Using simulator: $SIMULATOR_ID"

# Ensure simulator is booted
BOOTED=$(xcrun simctl list devices | grep "$SIMULATOR_ID" | grep -c "Booted" || true)
if [ "$BOOTED" -eq 0 ]; then
  echo "🔌 Booting simulator..."
  xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
  # Open Simulator.app to show the window
  open -a Simulator
  # Wait for boot to complete
  sleep 3
fi

# Kill and uninstall app (always needed to reinstall)
xcrun simctl terminate "$SIMULATOR_ID" org.reactjs.native.example.AnkurahApp 2>/dev/null || true
xcrun simctl uninstall "$SIMULATOR_ID" org.reactjs.native.example.AnkurahApp 2>/dev/null || true

# ALWAYS kill Metro to ensure fresh state
# Kill by port (more reliable than pattern matching process names)
METRO_PID=$(lsof -ti :8081 2>/dev/null | head -1)
if [ -n "$METRO_PID" ]; then
  echo "🔪 Killing stale Metro (PID $METRO_PID)..."
  kill -9 $METRO_PID 2>/dev/null || true
  sleep 1
fi
# Also try pattern matching as backup
pkill -f "react-native/cli.js start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# ALWAYS clear Metro cache - it's fast and prevents stale JS binding bugs
# The rebuild takes the same time either way (Metro rebuilds on first request)
echo "🗑️  Clearing Metro cache..."
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf node_modules/.cache/metro 2>/dev/null || true

# Conditionally clean fingerprints when upstream source has changed
# Proc-macro fingerprinting doesn't always detect upstream changes correctly,
# especially for derive macros (ankurah-derive, virtual-scroll-derive).
# We check all relevant source directories.
LIBRARY="../target/aarch64-apple-ios-sim/debug/libankurah_rn_bindings.a"
NEED_CLEAN=false
CLEAN_REASON=""

if [ "$FORCE_CLEAN" = true ]; then
  NEED_CLEAN=true
  CLEAN_REASON="forced"
elif [ ! -f "$LIBRARY" ]; then
  # No library = first build, no cleaning needed
  NEED_CLEAN=false
elif [ -n "$(find ../../ankurah -name '*.rs' -newer "$LIBRARY" 2>/dev/null | head -1)" ]; then
  # ankurah source changed (including ankurah-derive proc-macro)
  NEED_CLEAN=true
  CLEAN_REASON="ankurah"
elif [ -n "$(find ../../virtual-scroll -name '*.rs' -newer "$LIBRARY" 2>/dev/null | head -1)" ]; then
  # virtual-scroll source changed (including derive macro)
  NEED_CLEAN=true
  CLEAN_REASON="virtual-scroll"
elif [ -n "$(find ../model -name '*.rs' -newer "$LIBRARY" 2>/dev/null | head -1)" ]; then
  # model source changed
  NEED_CLEAN=true
  CLEAN_REASON="model"
elif [ -n "$(find ../rn-bindings -name '*.rs' -newer "$LIBRARY" 2>/dev/null | head -1)" ]; then
  # rn-bindings source changed
  NEED_CLEAN=true
  CLEAN_REASON="rn-bindings"
fi

if [ "$NEED_CLEAN" = true ]; then
  echo "🧹 Cleaning fingerprints ($CLEAN_REASON changed)..."
  # Clean all crates that might be affected by proc-macro changes
  rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/ankurah-*
  rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/ankurah_rn_bindings-*
  rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/ankurah_rn_model-*
  rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/virtual-scroll-*
  rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/virtual_scroll-*
  # Also clean iOS build cache to regenerate bindings with new checksums
  rm -rf ios/build
fi

# Always clean xcframework (cheap operation, ensures fresh)
rm -rf AnkurahAppFramework.xcframework

# Build Rust and generate bindings
echo "🦀 Building Rust..."
npx ubrn build ios --sim-only --and-generate

# Clean stale cpp files that ubrn puts in wrong location
# ubrn generates files at both cpp/*.cpp AND cpp/generated/*.cpp but only the
# generated/ versions are up-to-date. The top-level files cause linker conflicts.
rm -f cpp/ankurah_core.cpp cpp/ankurah_proto.cpp cpp/ankurah_rn_bindings.cpp \
      cpp/ankurah_rn_model.cpp cpp/ankurah_signals.cpp \
      cpp/ankurah_core.hpp cpp/ankurah_proto.hpp cpp/ankurah_rn_bindings.hpp \
      cpp/ankurah_rn_model.hpp cpp/ankurah_signals.hpp 2>/dev/null || true

# Clean DerivedData only when xcframework content changed (hash-based detection)
# This is fast (incremental) but still correct
XCFRAMEWORK_LIB="AnkurahAppFramework.xcframework/ios-arm64-simulator/libankurah_rn_bindings.a"
HASH_FILE=".xcframework_hash"
NEW_HASH=$(md5 -q "$XCFRAMEWORK_LIB" 2>/dev/null || echo "none")
OLD_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
if [ "$NEW_HASH" != "$OLD_HASH" ]; then
  echo "🧹 Clearing DerivedData (native library changed)..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/AnkurahApp-*
  echo "$NEW_HASH" > "$HASH_FILE"
fi

# Fix ubrn's overly broad source_files glob (only if needed, to preserve timestamp)
if grep -q 'source_files = "ios/\*\*/\*' AnkurahApp.podspec 2>/dev/null; then
  sed -i '' 's|s.source_files = "ios/\*\*/\*\.{h,m,mm,swift}".*|s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"|' AnkurahApp.podspec
fi

# Install pods (skip if Podfile.lock is newer than Manifest.lock - pods already installed)
PODFILE_LOCK="ios/Podfile.lock"
MANIFEST_LOCK="ios/Pods/Manifest.lock"
if [ "$FORCE_CLEAN" = true ] || [ ! -f "$MANIFEST_LOCK" ] || [ "$PODFILE_LOCK" -nt "$MANIFEST_LOCK" ] || [ "AnkurahApp.podspec" -nt "$MANIFEST_LOCK" ]; then
  echo "📦 Installing pods..."
  cd ios && pod install --silent && cd ..
else
  echo "📦 Pods up to date (skipping)"
fi

# Build iOS app with xcodebuild
# NOTE: Must use "AnkurahApp (AnkurahApp project)" to distinguish from the Pods project scheme
echo "🔨 Building iOS app..."
xcodebuild -workspace ios/AnkurahApp.xcworkspace \
  -configuration Debug \
  -scheme "AnkurahApp (AnkurahApp project)" \
  -sdk iphonesimulator \
  -arch arm64 \
  build 2>&1 | tail -5

# Find the app in DerivedData (xcodebuild ignores -derivedDataPath for RN projects)
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "AnkurahApp.app" -path "*/Debug-iphonesimulator/*" -type d 2>/dev/null | head -1)
if [ ! -d "$APP_PATH" ]; then
  echo "❌ Build failed - app not found"
  exit 1
fi

echo "📲 Installing app..."
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"

# Start Metro bundler (we killed it earlier, so always start fresh)
echo "📦 Starting Metro bundler..."
METRO_LOG="metro.log"
if [ "$TEST_MODE" = true ]; then
  ANKURAH_TEST_MODE=true npx react-native start --reset-cache > "$METRO_LOG" 2>&1 &
else
  npx react-native start --reset-cache > "$METRO_LOG" 2>&1 &
fi
METRO_PID=$!

# Wait for Metro to be ready (poll the health endpoint)
echo -n "⏳ Waiting for Metro..."
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
    echo " ready!"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
  echo -n "."
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo " timeout!"
  echo "⚠️  Metro may not have started correctly. Check metro.log for details."
fi

echo "🚀 Launching app..."
xcrun simctl launch "$SIMULATOR_ID" org.reactjs.native.example.AnkurahApp

echo "✅ Build complete"
echo ""
echo "📝 Rust logs appear in Metro console (prefixed with [Rust/INFO], [Rust/WARN], etc.)"
