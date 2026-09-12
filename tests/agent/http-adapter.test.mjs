import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainingMCPServer } from '../../dist/server.js';

test('MCP 2026 Stateless HTTP Adapter (P2-D1)', async (t) => {
  const server = new ChainingMCPServer();
  const testPort = 8991;

  await server.start({ transport: 'http', port: testPort, host: '127.0.0.1' });

  await t.test('GET /healthz returns ok and role', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.server, 'chaining-mcp');
    assert.equal(body.role, 'hela-mitosis');
    assert.equal(body.transport, 'stateless-http');
  });

  await t.test('GET /discovery returns MCP 2026 manifest with cache hints', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/discovery`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.protocolVersion, '2026-07-28');
    assert.equal(body.capabilities?.tasks?.enabled, true);
    assert.equal(body.cache?.tools?.ttlMs, 300000);
  });

  await t.test('POST / with Mcp-Method: tools/list returns tools and echoes headers', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': 'tools/list'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'tools/list',
        params: {}
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('mcp-method'), 'tools/list');
    assert.equal(res.headers.get('mcp-protocol-version'), '2026-07-28');
    const body = await res.json();
    assert.ok(Array.isArray(body.result?.tools));
    assert.ok(body.result.tools.length > 0);
  });

  await t.test('POST / with tasks/list returns RunStore tasks', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-method': 'tasks/list'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-2',
        method: 'tasks/list',
        params: {}
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.result?.tasks));
  });

  await server.stop();
});
