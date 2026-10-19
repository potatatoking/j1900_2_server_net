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

test('personal articles require admin, persist content, preserve date on edit and support deletion', async t => {
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

  const login = await call('/api/login', 'POST', {password:'test-only-password'});
  assert.equal(login.status, 200);
  const cookie = login.cookie.split(';')[0];
  const essay = { type: 'article', title: '关于慢慢成长的想法', content: '第一段想法。\n\n第二段思考。', tag: '随笔' };
  assert.equal((await call('/api/posts', 'POST', essay)).status, 401);
  const article = await call('/api/posts', 'POST', essay, cookie);
  assert.equal(article.status, 201);
  assert.equal(article.data.type, 'article');
  assert.equal(article.data.content, essay.content);
  assert.equal((await fetch(`${base}/articles`)).status, 200);
  assert.equal((await fetch(`${base}/articles/`, { redirect: 'manual' })).headers.get('location'), '/articles');
  assert.equal((await call(`/api/posts/${article.data.id}`, 'PUT', essay)).status, 401);
  const articleEdit = await call(`/api/posts/${article.data.id}`, 'PUT', { ...essay, title: '补充后的想法' }, cookie);
  assert.equal(articleEdit.data.createdAt, article.data.createdAt);
  assert.ok(articleEdit.data.updatedAt);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'data', 'blog.json'), 'utf8'));
  assert.equal(saved.posts.find(p => p.id === article.data.id).title, '补充后的想法');
  assert.equal((await call(`/api/posts/${article.data.id}`, 'DELETE')).status, 401);
  assert.equal((await call(`/api/posts/${article.data.id}`, 'DELETE', undefined, cookie)).status, 200);
  assert.equal((await call('/api/posts')).data.some(p => p.id === article.data.id), false);
});
