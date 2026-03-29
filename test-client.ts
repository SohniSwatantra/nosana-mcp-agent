/**
 * Test client for the ElizaOS MCP Agent HTTP API
 *
 * Usage: bun run test-client.ts [base-url]
 * Default base URL: http://localhost:3000
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";

async function testHealth(): Promise<void> {
  console.log("--- Health Check ---");
  const res = await fetch(`${BASE_URL}/health`);
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

async function testInfo(): Promise<void> {
  console.log("\n--- Agent Info ---");
  const res = await fetch(`${BASE_URL}/info`);
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

async function testChat(message: string): Promise<void> {
  console.log(`\n--- Chat: "${message}" ---`);
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, userId: "test-user" }),
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  console.log(`Testing agent at ${BASE_URL}\n`);

  try {
    await testHealth();
    await testInfo();
    await testChat("Hello! What tools do you have access to?");
    await testChat("List the files in the data directory.");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.error("Make sure the agent is running: bun run start");
    process.exit(1);
  }
}

main();
