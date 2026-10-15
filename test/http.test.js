import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('public entry points and assets load and split UTF-8 requests preserve Chinese and emoji', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-http-'));
  await fs.copyFile(new URL('../server.js', import.meta.url), path.join(dir, 'server.js'));
  await fs.copyFile(new URL('../package.json', import.meta.url), path.join(dir, 'package.json'));
  await fs.cp(new URL('../public', import.meta.url), path.join(dir, 'public'), { recursive: true });
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'http-test-password' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 5000);
    child.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
  });
  for (const route of ['/', '/admin', '/admin.html']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.match(html, /id="app"/);
    for (const [, asset] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
      const resource = await fetch(new URL(asset, `${base}${route}`));
      assert.equal(resource.status, 200, asset);
    }
  }
  const fontCss = await fetch(`${base}/fonts.css`).then(response => response.text());
  assert.doesNotMatch(fontCss, /url\(https?:/);
  for (const family of ['sans', 'serif']) {
    const fontPath = fontCss.match(new RegExp(`url\\((\\.\\/vendor/fonts/noto-${family}-sc-[^)]+)\\)`))?.[1];
    assert.ok(fontPath, `${family} font is bundled`);
    const response = await fetch(new URL(fontPath, base));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'font/woff2');
    assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString(), 'wOF2');
  }
  const input = { author: '访客🥔', title: '中文标题', content: '你好，世界🌸' };
  const bytes = Buffer.from(JSON.stringify(input));
  // Deliberately deliver the first byte of each multibyte character separately.
  const offsets = ['访', '🥔', '🌸'].map(value => bytes.indexOf(Buffer.from(value)) + 1);
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
    (async () => {
      let start = 0;
      for (const offset of offsets) {
        req.write(bytes.subarray(start, offset));
        start = offset;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      req.end(bytes.subarray(start));
    })().catch(reject);
  });
  assert.equal(result.status, 201);
  for (const key of Object.keys(input)) assert.equal(result.data[key], input[key]);
  const oversized = await fetch(`${base}/api/topics`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, content: '中'.repeat(7000) })
  });
  assert.equal(oversized.status, 400);
  assert.equal((await oversized.json()).error, '内容太长了');
  const topics = await fetch(`${base}/api/topics`).then(response => response.json());
  assert.equal(topics.find(topic => topic.id === result.data.id).content, input.content);
});
