#!/usr/bin/env node

import { ChainingMCPServer } from './server.js';

async function main() {
  const server = new ChainingMCPServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down Chaining MCP Server...');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down Chaining MCP Server...');
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start Chaining MCP Server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
