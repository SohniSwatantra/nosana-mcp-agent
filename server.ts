/**
 * ElizaOS MCP Agent — Nosana GPU Deployment
 *
 * This agent:
 * 1. Connects to external MCP servers as a CLIENT (filesystem, etc.)
 * 2. Exposes itself as an MCP SERVER for other clients (Claude Desktop, etc.)
 * 3. Runs an HTTP API on port 3000 for direct interaction
 *
 * Uses real elizaOS runtime with Ollama (Qwen3), SQL, and MCP plugins.
 * Runs entirely on local GPU — no external API keys needed for inference.
 */

import {
  AgentRuntime,
  ChannelType,
  parseCharacter,
  createMessageMemory,
  stringToUuid,
  type UUID,
} from "@elizaos/core";
import ollamaPlugin from "@elizaos/plugin-ollama";
import sqlPlugin from "@elizaos/plugin-sql";
import mcpPlugin from "@elizaos/plugin-mcp";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type ListToolsResult,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from "uuid";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================================
// Load Character Configuration
// ============================================================================

const characterPath = resolve(import.meta.dir, "character.json");
const characterConfig = JSON.parse(readFileSync(characterPath, "utf-8"));

const CHARACTER = parseCharacter(characterConfig);

// ============================================================================
// MCP Server Tools (for exposing agent via MCP)
// ============================================================================

interface ChatToolArgs {
  message: string;
  userId?: string;
}

interface CallToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

const TOOLS: Tool[] = [
  {
    name: "chat",
    description: "Send a message to the Nosana MCP Agent and receive a response",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "The message to send to the agent",
        },
        userId: {
          type: "string",
          description: "Optional user identifier for conversation context",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "get_agent_info",
    description: "Get information about the agent and its MCP connections",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ============================================================================
// Agent Runtime
// ============================================================================

let runtime: AgentRuntime | null = null;
const roomId = stringToUuid("mcp-room");
const worldId = stringToUuid("mcp-world");

async function initializeRuntime(): Promise<AgentRuntime> {
  if (runtime) return runtime;

  console.log("Initializing elizaOS runtime with Ollama + MCP plugins...");
  console.log(`Ollama URL: ${characterConfig.settings?.OLLAMA_URL || "http://localhost:11434"}`);
  console.log(`Model: ${characterConfig.settings?.OLLAMA_SMALL_MODEL || "qwen3.5:9b"}`);

  runtime = new AgentRuntime({
    character: CHARACTER,
    plugins: [sqlPlugin, ollamaPlugin, mcpPlugin],
  });

  await runtime.initialize();

  console.log("elizaOS runtime initialized with Ollama (local GPU) + MCP client support");
  console.log("MCP servers configured:", Object.keys(characterConfig.settings?.mcp?.servers || {}));
  return runtime;
}

async function handleChat(message: string, userId?: string): Promise<string> {
  const rt = await initializeRuntime();
  const entityId = userId ? stringToUuid(userId) : (uuidv4() as UUID);

  await rt.ensureConnection({
    entityId,
    roomId,
    worldId,
    userName: userId ?? "MCP User",
    source: "mcp",
    channelId: "mcp",
    serverId: "mcp-server",
    type: ChannelType.DM,
  } as Parameters<typeof rt.ensureConnection>[0]);

  const messageMemory = createMessageMemory({
    id: uuidv4() as UUID,
    entityId,
    roomId,
    content: {
      text: message,
      source: "client_chat",
      channelType: ChannelType.DM,
    },
  });

  let response = "";
  await rt.messageService!.handleMessage(rt, messageMemory, async (content) => {
    if (content?.text) {
      response += content.text;
    }
    return [];
  });

  return response || "No response generated. Please try again.";
}

function getAgentInfo() {
  return {
    name: CHARACTER.name,
    bio: characterConfig.bio,
    model: characterConfig.settings?.OLLAMA_SMALL_MODEL || "qwen3.5:9b",
    ollamaUrl: characterConfig.settings?.OLLAMA_URL || "http://localhost:11434",
    mcpServers: Object.keys(characterConfig.settings?.mcp?.servers || {}),
    capabilities: [
      "Natural language conversation (Qwen3 on local GPU)",
      "MCP tool integration (filesystem access)",
      "Context-aware dialogue",
      "Deployed on Nosana decentralized GPU network",
      "No external API keys needed — fully local inference",
    ],
  };
}

// ============================================================================
// HTTP Server (port 3000)
// ============================================================================

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startHttpServer(): Promise<void> {
  const server = Bun.serve({
    port: PORT,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // CORS headers
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      // Health check
      if (url.pathname === "/health" || url.pathname === "/") {
        return new Response(JSON.stringify({
          status: "ok",
          agent: CHARACTER.name,
          model: characterConfig.settings?.OLLAMA_SMALL_MODEL || "qwen3.5:9b",
          uptime: process.uptime(),
          mcpServers: Object.keys(characterConfig.settings?.mcp?.servers || {}),
        }), { headers });
      }

      // Agent info
      if (url.pathname === "/info" && req.method === "GET") {
        return new Response(JSON.stringify(getAgentInfo()), { headers });
      }

      // Chat endpoint
      if (url.pathname === "/chat" && req.method === "POST") {
        try {
          const body = await req.json() as { message?: string; userId?: string };
          if (!body.message) {
            return new Response(JSON.stringify({ error: "message is required" }), {
              status: 400,
              headers,
            });
          }
          const response = await handleChat(body.message, body.userId);
          return new Response(JSON.stringify({ response }), { headers });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers,
          });
        }
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers,
      });
    },
  });

  console.log(`HTTP server running on http://0.0.0.0:${PORT}`);
  console.log(`  GET  /        — Health check`);
  console.log(`  GET  /info    — Agent info`);
  console.log(`  POST /chat    — Send message (body: { "message": "..." })`);
}

// ============================================================================
// MCP Server (stdio transport — for Claude Desktop, etc.)
// ============================================================================

async function startMcpServer(): Promise<void> {
  // Only start MCP stdio server if explicitly requested
  if (process.env.MCP_STDIO !== "true") return;

  const server = new Server(
    { name: "nosana-mcp-agent", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  type RequestSchema = Parameters<typeof server.setRequestHandler>[0];

  server.setRequestHandler(
    ListToolsRequestSchema as RequestSchema,
    async (): Promise<ListToolsResult> => ({ tools: TOOLS }),
  );

  server.setRequestHandler(
    CallToolRequestSchema as RequestSchema,
    async (request: CallToolRequest): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case "chat": {
            const chatArgs = args as ChatToolArgs | undefined;
            if (!chatArgs?.message) {
              return { content: [{ type: "text", text: "Error: message is required" }], isError: true };
            }
            const response = await handleChat(chatArgs.message, chatArgs.userId);
            return { content: [{ type: "text", text: response }] };
          }
          case "get_agent_info": {
            return { content: [{ type: "text", text: JSON.stringify(getAgentInfo(), null, 2) }] };
          }
          default:
            return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP stdio server running");
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log(`Starting ${CHARACTER.name}...`);

  // Initialize the runtime (includes MCP client connections)
  await initializeRuntime();

  // Start HTTP server (always)
  await startHttpServer();

  // Start MCP stdio server (only if MCP_STDIO=true)
  await startMcpServer();

  console.log(`${CHARACTER.name} is ready.`);
}

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  if (runtime) await runtime.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down (SIGTERM)...");
  if (runtime) await runtime.stop();
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
