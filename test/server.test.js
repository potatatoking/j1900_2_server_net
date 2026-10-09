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

test('visitors can leave messages while only administrators can edit content', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pink-diary-test-'));
  const port = await freePort();
  await fs.copyFile(path.join(project, 'server.js'), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
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

  const samplePost = { type: 'life', title: '测试动态', content: '测试正文', tag: '测试' };
  assert.equal((await call('/api/posts', 'POST', samplePost)).status, 401);
  assert.equal((await call('/api/posts/life-1', 'PUT', samplePost)).status, 401);
  assert.equal((await call('/api/posts/life-1', 'DELETE')).status, 401);
  assert.equal((await call('/api/profile', 'PUT', { name: '访客' })).status, 401);
  assert.equal((await call('/api/topics/welcome', 'PUT', { author: '访客', title: '改写', content: '不能改' })).status, 401);

  const topic = await call('/api/topics', 'POST', { author: '访客', title: '新留言', content: '你好' });
  assert.equal(topic.status, 201);
  assert.equal((await call(`/api/topics/${topic.data.id}/replies`, 'POST', { author: '另一位访客', content: '欢迎' })).status, 201);
  assert.equal((await call(`/api/topics/${topic.data.id}`, 'DELETE')).status, 401);

  assert.equal((await call('/api/login', 'POST', { password: 'wrong' })).status, 401);
  const login = await call('/api/login', 'POST', { password: 'test-only-password' });
  assert.equal(login.status, 200);
  const cookie = login.cookie.split(';')[0];
  const created = await call('/api/posts', 'POST', samplePost, cookie);
  assert.equal(created.status, 201);
  const edited = await call(`/api/posts/${created.data.id}`, 'PUT', { ...samplePost, title: '更新后的动态' }, cookie);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.title, '更新后的动态');
  assert.equal(edited.data.createdAt, created.data.createdAt);
  assert.ok(edited.data.updatedAt);
  const editedTopic = await call(`/api/topics/${topic.data.id}`, 'PUT', { author: '管理员', title: '已整理', content: '保留回复' }, cookie);
  assert.equal(editedTopic.status, 200);
  assert.equal(editedTopic.data.replies.length, 1);
  assert.equal((await call('/api/posts')).data.some(post => post.id === created.data.id && post.title === '更新后的动态'), true);
  assert.equal((await call('/api/logout', 'POST', undefined, cookie)).status, 200);
  assert.equal((await call(`/api/posts/${created.data.id}`, 'DELETE', undefined, cookie)).status, 401);
});
