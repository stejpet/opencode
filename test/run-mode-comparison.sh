#!/bin/bash
# Test script to compare lite mode vs normal mode
# This script runs the opencode TUI with DEBUG logging enabled

set -e

TEST_PROMPT="Make a todo with fish and meats"
OUTPUT_DIR="./test-output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "=== LITE MODE TEST ==="
echo "Prompt: $TEST_PROMPT"
echo "Output: $OUTPUT_DIR/lite-mode-${TIMESTAMP}.log"
echo ""

# Run with lite mode enabled (using local model)
DEBUG_PROMPT=true \
  LITE_MODE=true \
  bun run --cwd packages/opencode --conditions=browser ./src/index.ts \
  2>&1 | tee "$OUTPUT_DIR/lite-mode-${TIMESTAMP}.log" | grep -A 100 "FULL PROMPT LOG" || true

echo ""
echo "=== NORMAL MODE TEST ==="
echo "Prompt: $TEST_PROMPT"
echo "Output: $OUTPUT_DIR/normal-mode-${TIMESTAMP}.log"
echo ""

# Run with lite mode disabled
DEBUG_PROMPT=true \
  LITE_MODE=false \
  bun run --cwd packages/opencode --conditions=browser ./src/index.ts \
  2>&1 | tee "$OUTPUT_DIR/normal-mode-${TIMESTAMP}.log" | grep -A 100 "FULL PROMPT LOG" || true

echo ""
echo "Tests complete. Output files:"
echo "  - $OUTPUT_DIR/lite-mode-${TIMESTAMP}.log"
echo "  - $OUTPUT_DIR/normal-mode-${TIMESTAMP}.log"