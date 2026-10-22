import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

test('changelog entries require administrator writes, persist edits and preserve publication dates', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-changelog-test-'));
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  await fs.copyFile(new URL('../server.js', import.meta.url), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'test-changelog-only' }, stdio: 'ignore' });
  t.after(async () => {
    if (child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let n = 0; n < 50; n++) {
    try { await fetch(`${base}/api/session`); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  const call = async (url, method = 'GET', data, cookie) => {
    const response = await fetch(base + url, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const input = { type: 'update', title: '更新日志测试', content: '增加日志入口', tag: '功能更新' };
  assert.equal((await call('/api/posts', 'POST', input)).status, 401);
  const login = await call('/api/login', 'POST', { password: 'test-changelog-only' });
  const cookie = login.cookie.split(';')[0];
  const created = await call('/api/posts', 'POST', input, cookie);
  assert.equal(created.status, 201); assert.equal(created.data.type, 'update');
  const url = `/api/posts/${created.data.id}`;
  assert.equal((await call(url, 'PUT', { ...input, content: '访客修改' })).status, 401);
  const edited = await call(url, 'PUT', { ...input, content: '修复完成' }, cookie);
  assert.equal(edited.status, 200); assert.equal(edited.data.type, 'update');
  assert.equal(edited.data.createdAt, created.data.createdAt);
  const stored = JSON.parse(await fs.readFile(path.join(dir, 'data/blog.json'), 'utf8'));
  assert.equal(stored.posts.find(post => post.id === created.data.id).content, '修复完成');
  assert.equal((await call('/api/posts')).data.find(post => post.id === created.data.id).type, 'update');
  assert.equal((await call(url, 'DELETE')).status, 401);
  assert.equal((await call(url, 'DELETE', undefined, cookie)).status, 200);
  assert.equal((await call('/api/posts')).data.some(post => post.id === created.data.id), false);
});
