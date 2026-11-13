'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const srv = require('../server');

/* ---------- protocol handlers (in-process, no network) ---------- */

test('initialize returns protocol version and server info', async () => {
  const res = await srv.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(res.protocolVersion, srv.PROTOCOL_VERSION);
  assert.equal(res.serverInfo.name, 'hayday-data');
  assert.ok(res.capabilities.tools);
});

test('ping returns an empty result', async () => {
  const res = await srv.handleRequest({ jsonrpc: '2.0', id: 1, method: 'ping' });
  assert.deepEqual(res, {});
});

test('tools/list exposes all 19 tools with schemas', async () => {
  const res = await srv.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(res.tools.length, 19);
  for (const t of res.tools) {
    assert.ok(t.name, 'tool has a name');
    assert.ok(t.description, `${t.name} has a description`);
    assert.equal(t.inputSchema.type, 'object');
  }
  const names = res.tools.map((t) => t.name);
  for (const expected of [
    'search_items', 'get_item', 'get_machines', 'get_by_machine', 'get_crops',
    'get_animals', 'get_level_unlocks', 'get_unlocks_upto', 'get_best_profit',
    'compare_profit', 'clear_cache',
    'list_add', 'list_set_amount', 'list_check', 'list_remove', 'list_view',
    'list_set_capacity', 'list_clear', 'list_export',
  ]) {
    assert.ok(names.includes(expected), `missing tool: ${expected}`);
  }
});

test('tools/call clear_cache succeeds (no network needed)', async () => {
  const res = await srv.handleRequest({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'clear_cache', arguments: {} },
  });
  assert.equal(res.isError, false);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.cleared, true);
});

test('tools/call list_export returns raw text, not a JSON-quoted string', async () => {
  const res = await srv.handleRequest({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'list_export', arguments: {} },
  });
  assert.equal(res.isError, false);
  const text = res.content[0].text;
  assert.ok(text.startsWith('HayDay'), 'text is returned verbatim, not JSON-wrapped');
  assert.ok(!text.startsWith('"'), 'not wrapped in JSON quotes');
});

test('tools/call with an unknown tool is an error', async () => {
  const res = await srv.handleRequest({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'does_not_exist', arguments: {} },
  });
  assert.ok(res.__rpcError);
  assert.equal(res.error.code, -32602);
});

test('an unknown method yields method-not-found', async () => {
  const res = await srv.handleRequest({ jsonrpc: '2.0', id: 9, method: 'bogus/method' });
  assert.ok(res.__rpcError);
  assert.equal(res.error.code, -32601);
});

test('an unknown notification (no id) is silently ignored', async () => {
  const res = await srv.handleRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res, undefined);
});

/* ---------- end-to-end over stdio (spawns the real process) ---------- */

test('stdio transport handles a full initialize + tools/list + clear_cache exchange', async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  const responses = [];
  let buffer = '';
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) responses.push(JSON.parse(line));
    }
  });

  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'clear_cache', arguments: {} } }) + '\n');

  await new Promise((resolve) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (responses.length >= 3 || Date.now() - started > 5000) {
        clearInterval(poll);
        resolve();
      }
    }, 25);
  });

  server.stdin.end();

  assert.equal(responses.length, 3, 'got three responses');
  const init = responses.find((r) => r.id === 1);
  assert.equal(init.result.serverInfo.name, 'hayday-data');
  const list = responses.find((r) => r.id === 2);
  assert.equal(list.result.tools.length, 19);
  const call = responses.find((r) => r.id === 3);
  assert.equal(JSON.parse(call.result.content[0].text).cleared, true);
});
