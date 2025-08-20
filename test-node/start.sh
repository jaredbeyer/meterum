#!/bin/bash

echo "🚀 Starting Meterum Virtual Node Test Environment"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🔧 Configuration:"
echo "  Server: https://meterum-site-monitoring.vercel.app"
echo "  Node ID: VIRTUAL-NODE-001"
echo "  Simulating: 3 Veris E34 meters with 6 channels each"
echo ""
echo "──────────────────────────────────────────────────"
echo ""

# Start the virtual node
node virtual-node.js