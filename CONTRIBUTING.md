# Contributing

Thanks for your interest in contributing to Nosana MCP Agent.

## Getting Started

1. Fork this repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/nosana-mcp-agent.git`
3. Install dependencies: `bun install`
4. Install Ollama and pull the model: `ollama pull qwen3.5:9b`
5. Start developing: `bun run start`

## Development Workflow

```bash
# Run locally (requires Ollama running)
make dev

# Run tests
make test

# Build Docker image
make build

# Lint check (type-check)
make check
```

## Pull Requests

- Keep PRs focused on a single change
- Test locally before submitting
- Update README if you add new features or change configuration
- Add new MCP server configurations to `character.json` with documentation

## Adding MCP Servers

To add a new MCP server integration:

1. Add the server config to `character.json` under `settings.mcp.servers`
2. Test it locally with `bun run start`
3. Document the server and its capabilities in the README
4. If the server needs environment variables, add them to `.env.example`

## Reporting Issues

- Include your OS, Bun version, and Ollama version
- Include the full error output
- Describe what you expected vs what happened

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
