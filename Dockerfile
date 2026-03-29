# ElizaOS MCP Agent — Production Dockerfile
# Runs Qwen3 locally via Ollama on Nosana GPU

FROM oven/bun:1.3-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    zstd \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (needed for npx to run MCP stdio servers)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# ---- Dependencies stage ----
FROM base AS deps

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production 2>/dev/null || bun install --production

# ---- Production stage ----
FROM base AS production

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY package.json ./
COPY server.ts ./
COPY character.json ./
COPY tsconfig.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create data directory for MCP filesystem server
RUN mkdir -p /app/data

# Expose HTTP port
EXPOSE 3000

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODELS=/app/.ollama/models

# Health check against the ElizaOS HTTP API
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
