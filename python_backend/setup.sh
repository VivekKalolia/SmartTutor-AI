#!/bin/bash

# SmartTutor AI - Python Backend Setup Script
# Run this once to set up the Python environment

echo "=== SmartTutor AI Python Backend Setup ==="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Check if ffmpeg is installed (required for Whisper)
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg not found. Installing with Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo "❌ Please install ffmpeg manually: brew install ffmpeg"
        exit 1
    fi
fi

echo "✓ ffmpeg found"

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
cd "$(dirname "$0")"
python3 -m venv venv

# Activate and install dependencies
echo "Installing dependencies (this may take a few minutes)..."
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the Python backend server:"
echo "  cd python_backend"
echo "  source venv/bin/activate"
echo "  python server.py"
echo ""
echo "The server will run on http://localhost:8000"
echo ""
echo "First run will download models (~1GB for Whisper, ~5GB for BLIP2)"
echo "Models are cached locally for offline use."

