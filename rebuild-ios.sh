#!/bin/bash
# Rebuild Rust and reinstall iOS app
# Robust, complete, efficient
set -e
cd "$(dirname "$0")/react-app"

# Find the iPhone 16 simulator
SIMULATOR_ID=$(xcrun simctl list devices | grep "iPhone 16 (" | grep -v "Pro" | grep -v "Plus" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
echo "📱 Using simulator: $SIMULATOR_ID"

# Kill and uninstall app
xcrun simctl terminate booted org.reactjs.native.example.AnkurahApp 2>/dev/null || true
xcrun simctl uninstall booted org.reactjs.native.example.AnkurahApp 2>/dev/null || true

# Clean Rust build fingerprints to ensure fresh bindings
echo "🧹 Cleaning Rust artifacts..."
rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/ankurah-*
rm -rf ../target/aarch64-apple-ios-sim/debug/.fingerprint/rn-bindings-*
rm -rf AnkurahAppFramework.xcframework

# Build Rust and generate bindings
echo "🦀 Building Rust..."
npx ubrn build ios --sim-only --and-generate

# Fix ubrn's overly broad source_files glob
sed -i '' 's|s.source_files = "ios/\*\*/\*\.{h,m,mm,swift}".*|s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"|' AnkurahApp.podspec

# Install pods
echo "📦 Installing pods..."
cd ios && pod install --silent && cd ..

# Build iOS app with xcodebuild (predictable output path)
echo "🔨 Building iOS app..."
BUILD_DIR="$(pwd)/ios/build"
xcodebuild -workspace ios/AnkurahApp.xcworkspace \
  -configuration Debug \
  -scheme AnkurahApp \
  -sdk iphonesimulator \
  -arch arm64 \
  -derivedDataPath "$BUILD_DIR" \
  build 2>&1 | tail -5

# Verify and install
APP_PATH="$BUILD_DIR/Build/Products/Debug-iphonesimulator/AnkurahApp.app"
if [ ! -d "$APP_PATH" ]; then
  echo "❌ Build failed - app not found"
  exit 1
fi

echo "📲 Installing app..."
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"

echo "🚀 Launching app..."
xcrun simctl launch "$SIMULATOR_ID" org.reactjs.native.example.AnkurahApp

echo "✅ Build complete"
