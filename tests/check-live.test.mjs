import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTools, fetchToolNames, toolNamesFrom } from '../scripts/check-live.mjs';
import { TOOLS } from '../scripts/tools.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/check-live.mjs', import.meta.url));
const listAnswer = (...names) => ({ jsonrpc: '2.0', id: 1, result: { tools: names.map((name) => ({ name })) } });

test('nothing is missing when the server has every pinned tool, in any order', () => {
  assert.deepEqual(compareTools(['a_b', 'c_d'], ['c_d', 'a_b']), { missing: [], extra: [] });
});

test('a pinned tool the server lacks is missing', () => {
  assert.deepEqual(compareTools(['a_b', 'c_d'], ['a_b']), { missing: ['c_d'], extra: [] });
});

test('a server tool the plugin does not name is extra, not missing', () => {
  assert.deepEqual(compareTools(['a_b'], ['a_b', 'create_deal_alert']), { missing: [], extra: ['create_deal_alert'] });
});

test('tool names are read from a tool list answer', () => {
  assert.deepEqual(toolNamesFrom(listAnswer('find_deals', 'get_apply_link')), ['find_deals', 'get_apply_link']);
});

test('an error answer throws with the server message', () => {
  const body = { jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error' } };
  assert.throws(() => toolNamesFrom(body), { message: 'the server answered with an error: Internal error' });
});

test('an answer that is not a tool list throws', () => {
  assert.throws(() => toolNamesFrom({ result: {} }), { message: 'the answer is not a tool list' });
  assert.throws(() => toolNamesFrom({ result: { tools: [{ title: 'no name' }] } }), { message: 'the answer is not a tool list' });
  assert.throws(() => toolNamesFrom(null), { message: 'the answer is not a tool list' });
});

test('the request is a tool list POST that names itself', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => listAnswer('find_deals') };
  };
  assert.deepEqual(await fetchToolNames('https://example.test/mcp', fakeFetch), ['find_deals']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/mcp');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['user-agent'], 'lantern-promos-plugin-check');
  assert.equal(calls[0].init.headers.accept, 'application/json, text/event-stream');
  assert.deepEqual(JSON.parse(calls[0].init.body), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
});

test('a refused request throws with the status', async () => {
  const fakeFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchToolNames('https://example.test/mcp', fakeFetch), { message: 'the server answered 503' });
});

// The command, run against a local server. execFile is asynchronous on purpose: the server below lives in this
// process, and a synchronous spawn would block it from answering.
function runCommand(url, script = SCRIPT) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, url], (error, stdout, stderr) => resolve({ status: error ? error.code : 0, stdout, stderr }));
  });
}

async function withServer(status, body, run) {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}/mcp`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('the command exits 0 and notes a tool the plugin does not name', async () => {
  const run = await withServer(200, listAnswer(...TOOLS, 'create_deal_alert'), runCommand);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Note: the server also has create_deal_alert, which the plugin does not name\./);
  assert.match(run.stdout, /All 3 tools the plugin names are served by http:\/\/127\.0\.0\.1:\d+\/mcp\./);
});

test('the command exits 1 when a pinned tool is gone', async () => {
  const run = await withServer(200, listAnswer('find_deals', 'get_apply_link'), runCommand);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /The server no longer has find_store_coupons, which the plugin names\./);
});

test('the command exits 2 when the server cannot be asked, which is not a missing tool', async () => {
  const run = await withServer(503, { error: 'unavailable' }, runCommand);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Could not check http:\/\/127\.0\.0\.1:\d+\/mcp: the server answered 503/);
  assert.doesNotMatch(run.stderr, /no longer has/);
});

test('the command exits 2 when the answer is not JSON', async () => {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html>not json</html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const run = await runCommand(`http://127.0.0.1:${server.address().port}/mcp`);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /Could not check/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the command still runs when it is started through a symlinked folder', async () => {
  const holder = mkdtempSync(join(tmpdir(), 'promos-plugin-link-'));
  try {
    const link = join(holder, 'repo');
    symlinkSync(fileURLToPath(new URL('..', import.meta.url)), link);
    const run = await withServer(200, listAnswer('find_deals', 'get_apply_link'), (url) => runCommand(url, join(link, 'scripts/check-live.mjs')));
    assert.equal(run.status, 1);
    assert.match(run.stderr, /The server no longer has find_store_coupons, which the plugin names\./);
  } finally {
    rmSync(holder, { recursive: true, force: true });
  }
});
