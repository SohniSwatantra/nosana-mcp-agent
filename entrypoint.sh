#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-qwen3.5:9b}"
EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text:latest}"

echo "=== Nosana MCP Agent Startup ==="
echo "Model: $MODEL"
echo "Embedding Model: $EMBEDDING_MODEL"

# Start Ollama server in the background
echo "Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Ollama failed to start within 30 seconds."
        exit 1
    fi
    sleep 1
done

# Pull the models (skip if already present)
echo "Pulling model: $MODEL ..."
ollama pull "$MODEL"

echo "Pulling embedding model: $EMBEDDING_MODEL ..."
ollama pull "$EMBEDDING_MODEL"

echo "Models ready. Starting ElizaOS agent..."

# Start the ElizaOS agent (foreground)
exec bun run server.ts
