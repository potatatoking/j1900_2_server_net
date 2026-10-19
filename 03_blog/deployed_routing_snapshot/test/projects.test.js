import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('project management requires admin, separates statuses and survives restart without changing articles', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-projects-'));
  await fs.copyFile(new URL('../server.js', import.meta.url), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
  await fs.copyFile(new URL('../public/index.html', import.meta.url), path.join(dir, 'public/index.html'));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  let child;
  const stop = async () => { if (child?.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } };
  t.after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const start = async () => {
    child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'projects-test-password' }, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/session`)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 30)); }
    throw new Error('project server did not start');
  };
  const call = async (route, method = 'GET', body, cookie = '') => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  await start();
  const before = (await call('/api/posts')).data;
  assert.deepEqual((await call('/api/projects')).data, []);
  for (const route of ['/study', '/work', '/work/', '/study/']) assert.equal((await fetch(base + route)).status, 200);
  const sample = { title: '正在做的项目', description: '项目简介', status: 'active', url: 'https://example.com/project#details' };
  assert.equal((await call('/api/projects', 'POST', sample)).status, 401);
  assert.equal((await call('/api/projects/no-id', 'PUT', sample)).status, 401);
  assert.equal((await call('/api/projects/no-id', 'DELETE')).status, 401);
  const cookie = (await call('/api/login', 'POST', { password: 'projects-test-password' })).cookie;
  const created = await call('/api/projects', 'POST', sample, cookie);
  assert.equal(created.status, 201);
  assert.equal(created.data.status, 'active');
  assert.equal(created.data.url, sample.url);
  const endpoint = `/api/projects/${created.data.id}`;
  for (const fields of [{ title: '' }, { status: 'invalid' }, { url: 'javascript:alert(1)' }, { url: 'https://name:secret@example.com' }]) {
    assert.equal((await call(endpoint, 'PUT', { ...sample, ...fields }, cookie)).status, 400);
  }
  assert.equal((await call('/api/projects')).data[0].status, 'active');
  const edited = await call(endpoint, 'PUT', { ...sample, title: '完成的成果', status: 'completed', url: '' }, cookie);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.status, 'completed');
  assert.equal(edited.data.createdAt, created.data.createdAt);
  await stop(); await start();
  assert.equal((await call('/api/projects')).data[0].title, '完成的成果');
  assert.deepEqual((await call('/api/posts')).data, before);
  assert.equal((await call(endpoint, 'DELETE', undefined, cookie)).status, 401);
  const fresh = (await call('/api/login', 'POST', { password: 'projects-test-password' })).cookie;
  assert.equal((await call(endpoint, 'PUT', { ...sample, status: 'active' }, fresh)).status, 200);
  assert.equal((await call('/api/projects')).data[0].status, 'active');
  assert.equal((await call(endpoint, 'DELETE', undefined, fresh)).status, 200);
  assert.deepEqual((await call('/api/projects')).data, []);
});
