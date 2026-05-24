#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing playwright browsers..."
playwright install chromium

echo "Build completed successfully!"
