import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('friend applications require review, administrators can publish, and changes survive restart', async t => {
  const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-friends-'));
  await fs.copyFile(path.join(project, 'server.js'), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
  await fs.copyFile(path.join(project, 'public/index.html'), path.join(dir, 'public/index.html'));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  let child;
  const stop = async () => { if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } };
  t.after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });
  const start = async () => {
    child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'friend-test-password' }, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/api/session`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('server failed to start');
  };
  const call = async (route, method = 'GET', body, cookie = '') => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  await start();
  const sample = { name: '测试小站', url: 'https://example.com', description: '生活与学习', avatar: '' };
  let visitor, admin, cookie;
  await t.test('existing data migrates without changing profile or posts and the page opens directly', async () => {
    assert.equal((await fetch(`http://127.0.0.1:${port}/friends`)).status, 200);
    assert.equal((await call('/api/posts')).data.length, 4);
    assert.equal((await call('/api/profile')).data.name, '土豆');
    assert.deepEqual((await call('/api/friends')).data, []);
  });
  await t.test('visitors cannot publish their own applications or read the review queue', async () => {
    visitor = await call('/api/friends', 'POST', { ...sample, status: 'published' });
    assert.equal(visitor.status, 201);
    assert.equal(visitor.data.status, 'pending');
    assert.deepEqual((await call('/api/friends')).data, []);
    assert.equal((await call('/api/friends?review=1')).status, 401);
    assert.equal((await call(`/api/friends/${visitor.data.id}`, 'PUT', { ...sample, status: 'published' })).status, 401);
    assert.equal((await call(`/api/friends/${visitor.data.id}`, 'DELETE')).status, 401);
    assert.equal((await call('/api/friends', 'POST', sample)).status, 409);
  });
  await t.test('unsafe URL schemes, embedded credentials and missing fields are rejected', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'ftp://example.com', 'https://user:secret@example.com', 'example.com']) {
      assert.equal((await call('/api/friends', 'POST', { ...sample, url })).status, 400);
    }
    assert.equal((await call('/api/friends', 'POST', { ...sample, url: 'https://avatar.example', avatar: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call('/api/friends', 'POST', { ...sample, name: '' })).status, 400);
  });
  await t.test('administrators can submit and review applications', async () => {
    cookie = (await call('/api/login', 'POST', { password: 'friend-test-password' })).cookie;
    admin = await call('/api/friends', 'POST', { ...sample, name: '站长的小站', url: 'https://admin.example/' }, cookie);
    assert.equal(admin.status, 201);
    assert.equal(admin.data.status, 'published');
    assert.equal((await call('/api/friends?review=1', 'GET', undefined, cookie)).data.length, 2);
    assert.equal((await call(`/api/friends/${visitor.data.id}`, 'PUT', { ...sample, status: 'published' }, cookie)).status, 200);
    assert.equal((await call('/api/friends')).data.length, 2);
  });
  await t.test('edits, unpublishing, duplicate checks and deletion enforce administrator permissions', async () => {
    const endpoint = `/api/friends/${visitor.data.id}`;
    assert.equal((await call(endpoint, 'PUT', { ...sample, status: 'invalid' }, cookie)).status, 400);
    assert.equal((await call(endpoint, 'PUT', { ...sample, url: 'https://admin.example', status: 'published' }, cookie)).status, 409);
    assert.equal((await call(endpoint, 'PUT', { ...sample, name: '修改后的名称', status: 'pending' }, cookie)).status, 200);
    assert.equal((await call('/api/friends')).data.length, 1);
    assert.equal((await call(`/api/friends/${admin.data.id}`, 'DELETE', undefined, cookie)).status, 200);
    assert.deepEqual((await call('/api/friends')).data, []);
  });
  await t.test('restart preserves pending applications and invalidates old administrator sessions', async () => {
    await stop(); await start();
    assert.deepEqual((await call('/api/friends')).data, []);
    assert.equal((await call('/api/friends?review=1', 'GET', undefined, cookie)).status, 401);
    cookie = (await call('/api/login', 'POST', { password: 'friend-test-password' })).cookie;
    const saved = (await call('/api/friends?review=1', 'GET', undefined, cookie)).data;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, '修改后的名称');
    assert.equal(saved[0].status, 'pending');
  });
});
