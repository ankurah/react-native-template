#!/bin/bash
# Rebuild Rust and reinstall iOS app
set -e
cd "$(dirname "$0")/react-app"

# Kill app early to prevent thrashing during build
xcrun simctl terminate booted org.reactjs.native.example.AnkurahApp 2>/dev/null || true

npx ubrn build ios --sim-only --and-generate

# TODO: Figure out why ubrn generates overly broad source_files glob that includes
# ios/**/*.swift, which pulls in AppDelegate.swift and causes Swift compiler to hang.
sed -i '' 's|s.source_files = "ios/\*\*/\*\.{h,m,mm,swift}".*|s.source_files = "ios/AnkurahApp.h", "ios/AnkurahApp.mm", "cpp/**/*.{hpp,cpp,c,h}"|' AnkurahApp.podspec

cd ios && pod install --silent && cd ..

# Use react-native run-ios which handles Metro, building, and launching
npx react-native run-ios --simulator="iPhone 16"

echo "✅ Build complete"
