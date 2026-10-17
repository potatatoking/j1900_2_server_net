import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createVisitorRouter } from '../visitor-routing.js';

const config = {
  enabled: true,
  entryHosts: ['example.net', 'example.net:443', 'cn.example.net:40475'],
  trustedProxyIps: ['127.0.0.1'],
  campusCidrs: ['203.0.113.22/32', '172.20.128.0/17'],
  campusTarget: 'http://172.20.131.2:8080',
  mainlandTarget: 'https://cn.example.net:40475'
};
const china = ['36.128.0.0/10', '114.114.0.0/16', '240e::/20'];

function send(base, route, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + route, options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: new Headers(res.headers),
        text: async () => Buffer.concat(chunks).toString(),
        json: async () => JSON.parse(Buffer.concat(chunks).toString())
      }));
    });
    req.on('error', reject); req.end();
  });
}

test('visitor routing uses trusted source IPs, campus priority, and terminal entrances', async t => {
  const router = createVisitorRouter(config, china);
  const server = http.createServer((req, res) => {
    if (!router(req, res, new URL(req.url, 'http://localhost'))) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('original');
    }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (ip, route = '/', host = 'example.net', method = 'GET') => send(base, route, {
    method, headers: { Host: host, ...(ip === undefined ? {} : { 'X-Forwarded-For': ip }) }
  });
  let response = await request('203.0.113.22', '/index.html?view=life');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'http://172.20.131.2:8080/index.html?view=life');
  assert.equal(response.headers.get('x-site-route'), 'campus');
  assert.match(response.headers.get('cache-control'), /no-store/);
  response = await request('203.0.113.22', '/', 'cn.example.net:40475');
  assert.equal(response.headers.get('location'), 'http://172.20.131.2:8080/');
  response = await request('114.114.114.114');
  assert.equal(response.headers.get('location'), 'https://cn.example.net:40475/');
  response = await request('240e::123', '/', 'example.net:443', 'HEAD');
  assert.equal(response.status, 302);
  assert.equal(await response.text(), '');
  // The rightmost IP wins even when the visitor submits a spoofed campus IP.
  response = await request('203.0.113.22, 8.8.8.8');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-site-route'), 'other');
  for (const ip of [undefined, 'bad-ip', '114.114.114.114, not-an-ip']) {
    response = await request(ip);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-site-route'), 'unknown');
  }
  for (const [ip, route, host, method] of [
    ['114.114.114.114', '/', 'cn.example.net:40475'],
    ['203.0.113.22', '/', '172.20.131.2:8080'],
    ['114.114.114.114', '/', 'example.net.attacker.test'],
    ['114.114.114.114', '/?route=global', 'example.net'],
    ['114.114.114.114', '/api/session', 'example.net'],
    ['114.114.114.114', '/app.js', 'example.net'],
    ['203.0.113.22', '/admin', 'example.net'],
    ['114.114.114.114', '/', 'example.net', 'POST']
  ]) assert.equal((await request(ip, route, host, method)).status, 200);
  response = await request('::ffff:203.0.113.22', '/api/route');
  assert.deepEqual(await response.json(), { clientIp: '203.0.113.22', region: 'campus', target: 'http://172.20.131.2:8080' });
  assert.equal((await request('172.20.131.9')).headers.get('x-site-route'), 'campus');
});

test('untrusted clients cannot choose their IP using forwarding headers', async t => {
  const router = createVisitorRouter({ ...config, trustedProxyIps: [], campusCidrs: [] }, china);
  const server = http.createServer((req, res) => {
    if (!router(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(200); res.end(); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/route`, {
    headers: { Host: 'example.net', 'X-Forwarded-For': '203.0.113.22', 'X-Real-IP': '114.114.114.114' }
  });
  assert.deepEqual(await response.json(), { clientIp: '127.0.0.1', region: 'other', target: null });
});

test('invalid routing destinations and IP ranges fail validation', () => {
  assert.throws(() => createVisitorRouter({ ...config, campusTarget: 'javascript:alert(1)' }, china));
  assert.throws(() => createVisitorRouter({ ...config, campusCidrs: ['172.20.0.0/99'] }, china));
});

test('deployed server loads routing data without affecting health checks or static assets', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-routing-'));
  for (const file of ['server.js', 'visitor-routing.js', 'package.json', 'china-cidrs.txt']) {
    await fs.copyFile(new URL('../' + file, import.meta.url), path.join(dir, file));
  }
  await fs.mkdir(path.join(dir, 'public'));
  await fs.writeFile(path.join(dir, 'public', 'index.html'), '<h1>Original site</h1>');
  await fs.writeFile(path.join(dir, 'public', 'app.js'), '// original asset');
  await fs.writeFile(path.join(dir, 'routing.json'), JSON.stringify({ ...config, chinaCidrsFile: 'china-cidrs.txt' }));
  const probe = http.createServer().listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const fixture = spawn(process.execPath, ['server.js'], {
    cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'routing-test-only' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (fixture.exitCode === null) { const exited = once(fixture, 'exit'); fixture.kill(); await exited; }
    await fs.rm(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Routing fixture did not start')), 5000);
    fixture.stdout.on('data', data => {
      if (String(data).includes(`localhost:${port}`)) { clearTimeout(timer); resolve(); }
    });
    fixture.once('exit', code => { clearTimeout(timer); reject(new Error(`Routing fixture exited: ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const options = { headers: { Host: 'example.net', 'X-Forwarded-For': '114.114.114.114' } };
  const redirect = await send(base, '/', options);
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://cn.example.net:40475/');
  assert.equal((await send(base, '/api/session', options)).status, 200);
  assert.equal(await (await send(base, '/app.js', options)).text(), '// original asset');
  assert.equal((await (await send(base, '/api/route', options)).json()).region, 'mainland');
  assert.equal((await send(base, '/?route=global', options)).status, 200);
});
