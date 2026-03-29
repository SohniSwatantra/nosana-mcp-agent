# Nosana MCP Agent

> ElizaOS AI agent + MCP tools + Qwen3.5 9B on decentralized GPU

[![CI](https://github.com/YOUR_USERNAME/nosana-mcp-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/nosana-mcp-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An open-source AI agent powered by **Qwen3.5 (9B)** running locally via Ollama on **Nosana's decentralized GPU network**. No external API keys needed for inference. Connects to external tools via **MCP (Model Context Protocol)**.

```
Fork it. Configure it. Deploy it to a GPU in one command.
```

## TL;DR — Deploy in 3 Commands

```bash
git clone https://github.com/YOUR_USERNAME/nosana-mcp-agent.git && cd nosana-mcp-agent
make push DOCKER_USER=your-dockerhub-username
make deploy NOSANA_MARKET=nvidia-a5000
```

## What This Does

- **Local LLM**: Qwen3.5 9B running on GPU via Ollama — no API keys needed
- **MCP Client**: Connects to external MCP servers (filesystem, GitHub, etc.) to access tools
- **MCP Server**: Exposes the agent as an MCP server for Claude Desktop and other MCP clients
- **HTTP API**: REST endpoints on port 3000 for health checks, info, and chat
- **GPU-Optimized**: Containerized with Ollama for Nosana GPU deployment
- **Open Source**: MIT licensed, fork and customize

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Docker](https://www.docker.com/)
- [Nosana CLI](https://www.npmjs.com/package/@nosana/cli) (`npm install -g @nosana/cli`)
- [Ollama](https://ollama.com/) (for local development)
- Solana wallet + NOS tokens (for Nosana deployment)

## Quick Start (Local)

```bash
# 1. Install Ollama and pull the model
ollama pull qwen3.5:9b
ollama pull nomic-embed-text:latest

# 2. Install dependencies
bun install

# 3. Start the agent (Ollama must be running)
bun run start

# 4. Test it
curl http://localhost:3000/health
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what tools do you have?"}'
```

## Model Configuration

The agent uses Qwen3.5 9B by default, configured in `character.json`:

```json
{
  "settings": {
    "OLLAMA_URL": "http://localhost:11434",
    "OLLAMA_SMALL_MODEL": "qwen3.5:9b",
    "OLLAMA_LARGE_MODEL": "qwen3.5:9b",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text:latest"
  }
}
```

To use a different model, change the model names in `character.json` and the `OLLAMA_MODEL` env var in the Dockerfile/job definition. Qwen3.5 9B is 6.6GB and needs ~8GB VRAM — fits comfortably on an RTX A5000 (16GB) or RTX 5000.

## MCP Configuration

MCP server connections are configured in `character.json` under `settings.mcp.servers`:

```json
{
  "settings": {
    "mcp": {
      "servers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/app/data"]
        }
      }
    }
  }
}
```

### Adding More MCP Servers

Edit `character.json` to add servers:

```json
{
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token" }
  },
  "puppeteer": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  }
}
```

### Supported Server Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `stdio` | Local process via stdin/stdout | `command`, `args` |
| `sse` | Remote server via HTTP SSE | `url` |

## HTTP API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` or `/health` | Health check + uptime + model info |
| GET | `/info` | Agent info + MCP server list |
| POST | `/chat` | Send message (`{"message": "...", "userId?": "..."}`) |

## Docker

### Build

```bash
docker build -t nosana-mcp-agent .
```

The image includes Ollama and will auto-pull the Qwen3 model on first startup.

### Run Locally (requires NVIDIA GPU + Docker GPU support)

```bash
docker run --gpus all -p 3000:3000 nosana-mcp-agent
```

Without GPU (CPU inference, much slower):

```bash
docker run -p 3000:3000 nosana-mcp-agent
```

### Push to Docker Hub

```bash
docker tag nosana-mcp-agent YOUR_USERNAME/nosana-mcp-agent:latest
docker push YOUR_USERNAME/nosana-mcp-agent:latest
```

## Deploy to Nosana

### 1. Update job-definition.json

Edit `job-definition.json` and replace `YOUR_DOCKERHUB_USERNAME` with your Docker Hub username.

### 2. Post the Job

```bash
# Deploy to RTX A5000 market (16GB VRAM, ideal for Qwen3.5 9B)
nosana job post \
  --file job-definition.json \
  --market nvidia-a5000 \
  --gpu \
  --wait

# Or target RTX 4090 (24GB VRAM)
nosana job post \
  --file job-definition.json \
  --market nvidia-4090 \
  --gpu \
  --wait
```

### 3. Check Available GPU Markets

```bash
nosana market list
```

### 4. Monitor Your Job

```bash
nosana job get <job-address>
```

## Claude Desktop Integration

To use this agent as an MCP server from Claude Desktop (requires local Ollama):

```json
{
  "mcpServers": {
    "nosana-agent": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "/path/to/nosana-mcp-agent",
      "env": {
        "MCP_STDIO": "true"
      }
    }
  }
}
```

## Project Structure

```
nosana-mcp-agent/
  character.json       # Agent character + model + MCP server configuration
  server.ts            # Main agent server (HTTP + MCP)
  entrypoint.sh        # Docker entrypoint (starts Ollama, pulls model, starts agent)
  test-client.ts       # HTTP API test client
  Dockerfile           # Production container with Ollama
  job-definition.json  # Nosana GPU deployment definition
  package.json         # Dependencies and scripts
  data/                # Directory accessible to MCP filesystem server
  .env.example         # Environment variable template
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OLLAMA_MODEL` | No | `qwen3.5:9b` | Model for Ollama to pull and serve |
| `OLLAMA_EMBEDDING_MODEL` | No | `nomic-embed-text:latest` | Embedding model |
| `OLLAMA_HOST` | No | `0.0.0.0:11434` | Ollama server bind address |
| `PORT` | No | `3000` | HTTP server port |
| `MCP_STDIO` | No | `false` | Enable MCP stdio server mode |
| `NODE_ENV` | No | — | Set to `production` in Docker |

## GPU Requirements

| Model | Size | VRAM Required | Recommended Nosana Market |
|-------|------|---------------|--------------------------|
| qwen3.5:4b | 2.7GB | ~4GB | nvidia-a4000, nvidia-3060-community |
| qwen3.5:9b | 6.6GB | ~8GB | nvidia-a5000, nvidia-4090 |
| qwen3.5:14b | 9.5GB | ~12GB | nvidia-a5000, nvidia-4090 |
| qwen3.5:32b | 21GB | ~24GB | nvidia-a100-40gb, nvidia-6000-ada |
