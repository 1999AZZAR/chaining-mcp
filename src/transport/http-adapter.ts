import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { RunStore } from '../agent/run-store.js';

export interface HttpAdapterOptions {
  port?: number;
  host?: string;
  runStore?: RunStore;
  serverFactory?: () => Server;
}

/**
 * MCP 2026 Stateless HTTP Transport Adapter (P2-D1).
 *
 * Implements MCP 2026 stateless HTTP semantics:
 * - Transport-independent core (stdio remains default, HTTP adapter opt-in).
 * - Streamable HTTP in stateless mode (fresh transport & server per request).
 * - No protocol sessions stored; state is tracked via explicit RunStore handles.
 * - Inspects and echoes Mcp-Method and Mcp-Name headers.
 * - Supports MCP 2026 Tasks-as-extension (tasks/get, tasks/list, tasks/update).
 * - Exposes health check (/healthz) and discovery (/discovery, /mcp).
 */
export class HttpAdapter {
  private serverFactory: () => Server;
  private options: HttpAdapterOptions;
  private httpServer?: http.Server;

  constructor(serverOrFactory: Server | (() => Server), options: HttpAdapterOptions = {}) {
    this.serverFactory = typeof serverOrFactory === 'function'
      ? serverOrFactory
      : (options.serverFactory ?? (() => serverOrFactory));
    this.options = {
      port: options.port ?? 8011,
      host: options.host ?? '0.0.0.0',
      runStore: options.runStore,
    };
  }

  async start(): Promise<void> {
    this.httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // Health endpoint (for PM2, k8s, supergateway parity)
        if (req.method === 'GET' && pathname === '/healthz') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({
            status: 'ok',
            server: 'chaining-mcp',
            role: 'hela-mitosis',
            transport: 'stateless-http',
            version: '1.0.0',
            protocolVersion: '2026-07-28',
          }));
          return;
        }

        // Discovery endpoint per MCP 2026 (GET /discovery or GET /mcp)
        if (req.method === 'GET' && (pathname === '/discovery' || pathname === '/mcp')) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            'mcp-protocol-version': '2026-07-28',
          });
          res.end(JSON.stringify({
            name: 'chaining-mcp-server',
            version: '1.0.0',
            protocolVersion: '2026-07-28',
            role: 'hela-mitosis',
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false },
              tasks: { enabled: true },
            },
            cache: {
              tools: { ttlMs: 300000, scope: 'global' },
              resources: { ttlMs: 300000, scope: 'global' },
            },
            endpoints: {
              mcp: '/mcp',
              health: '/healthz',
              discovery: '/discovery',
            },
          }));
          return;
        }

        // Handle POST / or /mcp (MCP JSON-RPC)
        if (req.method === 'POST' && (pathname === '/' || pathname === '/mcp')) {
          // Normalize client protocol version and accept header for underlying SDK compatibility
          const clientVersion = req.headers['mcp-protocol-version'] as string | undefined;
          if (!clientVersion || clientVersion === '2026-07-28') {
            req.headers['mcp-protocol-version'] = '2025-06-18';
          }
          const accept = (req.headers['accept'] as string) || '';
          if (!accept.includes('text/event-stream') || !accept.includes('application/json')) {
            req.headers['accept'] = 'application/json, text/event-stream';
          }

          // Mutate rawHeaders to align with getRequestListener from @hono/node-server
          let hasAccept = false;
          let hasProtocol = false;
          if (req.rawHeaders) {
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
              const h = req.rawHeaders[i].toLowerCase();
              if (h === 'accept') {
                req.rawHeaders[i + 1] = 'application/json, text/event-stream';
                hasAccept = true;
              } else if (h === 'mcp-protocol-version') {
                if (!clientVersion || clientVersion === '2026-07-28') {
                  req.rawHeaders[i + 1] = '2025-06-18';
                }
                hasProtocol = true;
              }
            }
            if (!hasAccept) {
              req.rawHeaders.push('Accept', 'application/json, text/event-stream');
            }
            if (!hasProtocol) {
              req.rawHeaders.push('Mcp-Protocol-Version', '2025-06-18');
            }
          }

          // Read headers for routing/echo
          const mcpMethod = (req.headers['mcp-method'] as string) || '';
          const mcpName = (req.headers['mcp-name'] as string) || '';

          if (mcpMethod) res.setHeader('mcp-method', mcpMethod);
          if (mcpName) res.setHeader('mcp-name', mcpName);
          res.setHeader('mcp-protocol-version', clientVersion || '2026-07-28');

          // Intercept MCP 2026 Tasks extension & server/discover methods if present in body
          const bodyBuffer: Buffer[] = [];
          req.on('data', chunk => bodyBuffer.push(chunk));
          req.on('end', async () => {
            const rawBody = Buffer.concat(bodyBuffer).toString('utf8');
            let parsedBody: any;
            try {
              parsedBody = rawBody ? JSON.parse(rawBody) : null;
            } catch {
              parsedBody = null;
            }

            const method = parsedBody?.method || mcpMethod;

            // Handle Tasks extension
            if (method && method.startsWith('tasks/')) {
              const runStore = this.options.runStore;
              const id = parsedBody?.id ?? null;

              if (method === 'tasks/get') {
                const taskId = parsedBody?.params?.taskId || parsedBody?.params?.id || parsedBody?.params?.runId;
                const runData = runStore ? runStore.getRun(taskId) : null;
                if (!runData) {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32004, message: `Task '${taskId}' not found` },
                  }));
                  return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: {
                    task: runData.run,
                    steps: runData.steps,
                    events: runData.events,
                  },
                }));
                return;
              }

              if (method === 'tasks/list') {
                const limit = parsedBody?.params?.limit || 50;
                let runs: any[] = [];
                if (runStore && (runStore as any).db) {
                  runs = (runStore as any).db.prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT ?').all(limit);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: { tasks: runs },
                }));
                return;
              }

              if (method === 'tasks/update') {
                const taskId = parsedBody?.params?.taskId || parsedBody?.params?.id;
                const status = parsedBody?.params?.status;
                if (runStore && taskId && status) {
                  runStore.finishRun(taskId, status);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: { ok: true, taskId, status },
                }));
                return;
              }
            }

            // Handle server/discover RPC
            if (method === 'server/discover') {
              const id = parsedBody?.id ?? null;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  name: 'chaining-mcp-server',
                  version: '1.0.0',
                  protocolVersion: '2026-07-28',
                  role: 'hela-mitosis',
                  capabilities: {
                    tools: {},
                    resources: {},
                    tasks: {},
                  },
                  cache: {
                    tools: { ttlMs: 300000, scope: 'global' },
                    resources: { ttlMs: 300000, scope: 'global' },
                  },
                },
              }));
              return;
            }

            // Pass standard MCP requests to a fresh per-request StreamableHTTPServerTransport
            try {
              const mcpServer = this.serverFactory();
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
              });
              await mcpServer.connect(transport);
              await transport.handleRequest(req, res, parsedBody);
              res.on('close', () => {
                transport.close().catch(() => {});
                mcpServer.close().catch(() => {});
              });
            } catch (transportErr) {
              console.error('Stateless transport error:', transportErr);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: 'Internal server error', data: String(transportErr) },
                  id: parsedBody?.id ?? null,
                }));
              }
            }
          });
          return;
        }

        // In stateless mode, GET SSE streaming is disallowed
        if (req.method === 'GET' && (pathname === '/' || pathname === '/mcp')) {
          res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, GET' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed in stateless mode. Use POST.' },
            id: null,
          }));
          return;
        }

        // Unmatched endpoint
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Not Found',
          endpoints: ['/mcp', '/healthz', '/discovery'],
        }));
      } catch (err) {
        console.error('Error handling HTTP request:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          }));
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.options.port, this.options.host, () => {
        console.error(
          `Chaining MCP Server running on HTTP (${this.options.host}:${this.options.port}, stateless MCP 2026)`
        );
        resolve();
      });
      this.httpServer!.on('error', reject);
    });
  }

  async close(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }
}
