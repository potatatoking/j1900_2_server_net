import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKeyRouter } from './key-router.mjs';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server => `http://127.0.0.1:${server.address().port}`;
async function fixture(t, handler, options = {}) {
  const upstream = http.createServer(handler);
  await listen(upstream);
  const router = createKeyRouter({ primaryKey: 'primary', fallbackKey: 'fallback', token: 'local',
    upstream: address(upstream), ...options });
  await listen(router);
  t.after(async () => {
    router.closeAllConnections(); upstream.closeAllConnections();
    await Promise.all([new Promise(resolve => router.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
  });
  return { router, upstream, url: address(router) };
}
const send = (url, path = '/anthropic/v1/messages', body = '{"stream":true}') => fetch(url + path, {
  method: 'POST', headers: { 'x-api-key': 'local', 'content-type': 'application/json' }, body,
});

test('uses the primary key and preserves the request and streamed response', async t => {
  const seen = [];
  const f = await fixture(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    seen.push({ key: req.headers['x-api-key'], auth: req.headers.authorization, url: req.url, body });
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: first\n\n');
    setTimeout(() => res.end('data: second\n\n'), 10);
  });
  const result = await send(f.url, '/anthropic/v1/messages?beta=1');
  assert.equal(result.headers.get('content-type'), 'text/event-stream');
  assert.equal(await result.text(), 'data: first\n\ndata: second\n\n');
  assert.deepEqual(seen, [{ key: 'primary', auth: undefined, url: '/anthropic/v1/messages?beta=1', body: '{"stream":true}' }]);
});

test('402 retries the same body with fallback and persists the switch across restarts', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'deepseek-router-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const stateFile = join(directory, 'state.json');
  const keys = [];
  const f = await fixture(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    keys.push([req.headers['x-api-key'], body]);
    res.writeHead(req.headers['x-api-key'] === 'primary' ? 402 : 200);
    res.end(req.headers['x-api-key'] === 'primary' ? 'insufficient balance' : 'ok');
  }, { stateFile });
  assert.equal(await (await send(f.url)).text(), 'ok');
  assert.equal(await (await send(f.url)).text(), 'ok');
  assert.deepEqual(keys.map(item => item[0]), ['primary', 'fallback', 'fallback']);
  assert.ok(keys.every(item => item[1] === '{"stream":true}'));
  const state = readFileSync(stateFile, 'utf8');
  assert.ok(!state.includes('fallback') && !state.includes('"primary"'));
  const restarted = createKeyRouter({ primaryKey: 'primary', fallbackKey: 'fallback', token: 'local', stateFile, upstream: address(f.upstream) });
  await listen(restarted);
  t.after(() => { restarted.closeAllConnections(); restarted.close(); });
  assert.equal(await (await send(address(restarted))).text(), 'ok');
  assert.equal(keys.at(-1)[0], 'fallback');
  const changed = createKeyRouter({ primaryKey: 'replacement', fallbackKey: 'fallback', token: 'local', stateFile, upstream: address(f.upstream) });
  await listen(changed);
  t.after(() => { changed.closeAllConnections(); changed.close(); });
  await (await send(address(changed))).text();
  assert.equal(keys.at(-1)[0], 'replacement');
});

for (const status of [400, 401, 429, 500, 503]) {
  test(`${status} does not consume the fallback key`, async t => {
    const keys = [];
    const f = await fixture(t, (req, res) => { keys.push(req.headers['x-api-key']); res.writeHead(status); res.end('original error'); });
    const response = await send(f.url);
    assert.equal(response.status, status);
    assert.equal(await response.text(), 'original error');
    assert.deepEqual(keys, ['primary']);
  });
}

test('stops after the fallback also reports insufficient balance', async t => {
  const keys = [];
  const f = await fixture(t, (req, res) => { keys.push(req.headers['x-api-key']); res.writeHead(402); res.end('empty'); });
  const response = await send(f.url);
  assert.equal(response.status, 402);
  assert.equal(await response.text(), 'empty');
  assert.deepEqual(keys, ['primary', 'fallback']);
});

test('rejects invalid local credentials before contacting the provider', async t => {
  let called = false;
  const f = await fixture(t, (req, res) => { called = true; res.end(); });
  const response = await fetch(f.url + '/models', { headers: { Authorization: 'Bearer wrong' } });
  assert.equal(response.status, 401);
  await response.text();
  assert.equal(called, false);
});

test('model discovery replaces the local bearer credential with the provider key', async t => {
  let auth;
  const f = await fixture(t, (req, res) => { auth = req.headers.authorization; res.end('{"data":[]}'); });
  const response = await fetch(f.url + '/models', { headers: { Authorization: 'Bearer local' } });
  assert.equal(response.status, 200);
  await response.text();
  assert.equal(auth, 'Bearer primary');
});

test('a failed stream is not replayed with a second key', async t => {
  const keys = [];
  const f = await fixture(t, (req, res) => {
    keys.push(req.headers['x-api-key']);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: already emitted\n\n');
    setTimeout(() => res.destroy(), 20);
  });
  const response = await send(f.url);
  await assert.rejects(response.text());
  assert.deepEqual(keys, ['primary']);
});
