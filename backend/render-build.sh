#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing playwright browsers and OS dependencies..."
playwright install chromium
playwright install-deps chromium

echo "Build completed successfully!"
