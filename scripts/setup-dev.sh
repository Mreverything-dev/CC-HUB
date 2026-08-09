#!/bin/bash
echo "Setting up development environment..."
cd frontend && npm install
cd ../backend && poetry install
echo "Setup complete!"
