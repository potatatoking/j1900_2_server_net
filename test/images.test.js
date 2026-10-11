import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('post images upload, validate, persist and can be removed', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pink-diary-test-'));
  const port = await freePort();
  await fs.copyFile(path.join(project, 'server.js'), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
  for (const file of ['index.html', 'admin.html']) await fs.copyFile(path.join(project, 'public', file), path.join(dir, 'public', file));
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'test-only-password' }, stdio: 'ignore' });
  t.after(async () => {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${base}/api/session`); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  const call = async (route, method = 'GET', data, cookie) => {
    const response = await fetch(`${base}${route}`, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };

  const login = await call('/api/login', 'POST', { password: 'test-only-password' });
  const cookie = login.cookie.split(';')[0];
  const samplePost = { type: 'life', title: '图片动态', content: '正文' };
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==';
  assert.equal((await call('/api/images', 'POST', { image: `data:image/png;base64,${tinyPng}` })).status, 401);
  assert.equal((await call('/api/images', 'POST', { image: 'data:image/png;base64,YWJj' }, cookie)).status, 400);
  const uploaded = await call('/api/images', 'POST', { image: `data:image/png;base64,${tinyPng}` }, cookie);
  assert.equal(uploaded.status, 201);
  const imageResponse = await fetch(`${base}${uploaded.data.url}`);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), Buffer.from(tinyPng, 'base64'));
  const illustrated = await call('/api/posts', 'POST', { ...samplePost, images: [uploaded.data.url] }, cookie);
  assert.equal(illustrated.status, 201);
  assert.deepEqual(illustrated.data.images, [uploaded.data.url]);
  const preserved = await call(`/api/posts/${illustrated.data.id}`, 'PUT', samplePost, cookie);
  assert.deepEqual(preserved.data.images, [uploaded.data.url]);
  for (const images of [['https://example.com/image.png'], ['/assets/uploads/missing.png'], Array(10).fill(uploaded.data.url), 'invalid']) {
    assert.equal((await call('/api/posts', 'POST', { ...samplePost, images }, cookie)).status, 400);
    assert.equal((await call(`/api/posts/${illustrated.data.id}`, 'PUT', { ...samplePost, images }, cookie)).status, 400);
  }
  assert.deepEqual((await call(`/api/posts/${illustrated.data.id}`, 'PUT', { ...samplePost, images: [] }, cookie)).data.images, []);
});
