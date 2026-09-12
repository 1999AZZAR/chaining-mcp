#!/usr/bin/env node

import { ChainingMCPServer } from './server.js';

function parseArgs(args: string[]) {
  let transport: 'stdio' | 'http' | undefined;
  let port: number | undefined;
  let host: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--transport' && args[i + 1]) {
      transport = args[++i] === 'http' ? 'http' : 'stdio';
    } else if (arg.startsWith('--transport=')) {
      transport = arg.split('=')[1] === 'http' ? 'http' : 'stdio';
    } else if (arg === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--host' && args[i + 1]) {
      host = args[++i];
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1];
    }
  }

  return { transport, port, host };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const server = new ChainingMCPServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error('Shutting down Chaining MCP Server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start(options);
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
