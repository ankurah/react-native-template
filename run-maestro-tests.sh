#!/bin/bash
# Run Maestro tests for Ankurah React Native Template
#
# Prerequisites:
# - Java 17+ installed (brew install openjdk@17)
# - Maestro installed (curl -Ls "https://get.maestro.mobile.dev" | bash)
# - iOS Simulator will be started automatically
#
# Usage:
#   ./run-maestro-tests.sh           # Run all tests
#   ./run-maestro-tests.sh <test>    # Run specific test (e.g., 01_app_launch)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAESTRO_DIR="$SCRIPT_DIR/maestro"

# Ensure Java 17+ is available
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"

# Disable Maestro analytics
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "Error: Java 17+ required. Current version: $JAVA_VERSION"
    echo "Install with: brew install openjdk@17"
    echo "Then set: export JAVA_HOME=/opt/homebrew/opt/openjdk@17"
    exit 1
fi

# Check Maestro is installed
if ! command -v maestro &> /dev/null; then
    echo "Error: Maestro not installed"
    echo "Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
    exit 1
fi

echo "=== Ankurah Maestro Tests ==="
echo ""

# Build app (uses server mode - requires ankurah server running on localhost:9898)
echo "🔨 Building app..."
echo "⚠️  Make sure ankurah server is running on port 9898: cd server && cargo run"
cd "$SCRIPT_DIR"
./dev.sh

echo ""
echo "✅ App ready (server mode)"
echo ""

# Wait a moment for app to fully initialize
sleep 5

if [ -n "$1" ]; then
    # Run specific test
    TEST_FILE="$MAESTRO_DIR/${1}.yaml"
    if [ ! -f "$TEST_FILE" ]; then
        TEST_FILE="$MAESTRO_DIR/$1"
    fi
    if [ ! -f "$TEST_FILE" ]; then
        echo "Error: Test file not found: $1"
        exit 1
    fi
    echo "Running: $TEST_FILE"
    maestro test "$TEST_FILE"
else
    # Run all tests in order
    echo "Running all tests..."
    maestro test "$MAESTRO_DIR"
fi

echo ""
echo "=== Tests Complete ==="
