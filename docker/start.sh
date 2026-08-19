#!/bin/bash

set -e

echo "========================================"
echo "🚀 APPREXIA API"
echo "========================================"

echo "🖥️ Starting Xvfb..."

Xvfb :99 \
    -screen 0 1920x1080x24 \
    -ac \
    +extension GLX \
    +render \
    -noreset &

XVFB_PID=$!

echo "✅ Xvfb started (PID: $XVFB_PID)"
echo "🖥️ DISPLAY=$DISPLAY"

sleep 1

echo "========================================"
echo "🎭 Starting NestJS"
echo "========================================"

exec node dist/src/main.js