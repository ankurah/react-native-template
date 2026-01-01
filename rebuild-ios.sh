#!/bin/bash
# Rebuild Rust and reinstall iOS app (assumes Metro is already running)
set -e
cd "$(dirname "$0")/react-app"

# Kill app early to prevent thrashing during build
xcrun simctl terminate booted org.reactjs.native.example.AnkurahApp 2>/dev/null || true

npx ubrn build ios --sim-only --and-generate

# TODO: Figure out why ubrn generates overly broad source_files glob that includes
# ios/**/*.swift, which pulls in AppDelegate.swift and causes Swift compiler to hang.
sed -i '' 's|s.source_files = "ios/\*\*/\*\.{h,m,mm,swift}".*|s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"|' AnkurahApp.podspec

cd ios && pod install --silent && cd ..

# Get the booted simulator ID
DEVICE_ID=$(xcrun simctl list devices booted -j | grep -o '"udid" : "[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DEVICE_ID" ]; then
    echo "❌ No booted simulator found"
    exit 1
fi

# Build with xcodebuild directly using device ID
xcodebuild -workspace ios/AnkurahApp.xcworkspace \
    -scheme AnkurahApp \
    -configuration Debug \
    -destination "id=$DEVICE_ID" \
    build \
    2>&1 | grep -E '(error:|warning: .*AnkurahApp|BUILD|Compiling Swift)' || true

# Find and install the built app
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/AnkurahApp-*/Build/Products/Debug-iphonesimulator -name "AnkurahApp.app" -type d 2>/dev/null | head -1)
if [ -n "$APP_PATH" ]; then
    xcrun simctl install booted "$APP_PATH"
    xcrun simctl launch booted org.reactjs.native.example.AnkurahApp
    echo "✅ App installed and launched"
else
    echo "❌ Could not find built app"
    exit 1
fi
