import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('finished books are archived once and survive plan replacement and restart', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reading-library-'));
  await fs.copyFile(new URL('../server.js', import.meta.url), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  let child;
  let base;
  const net = await import('node:net');
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const start = async () => {
    child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'library-test-password' }, stdio: 'ignore' });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 60; i++) {
      try { await fetch(`${base}/api/session`); return; } catch { await new Promise(resolve => setTimeout(resolve, 30)); }
    }
    throw new Error('Test server did not start');
  };
  async function stop() { if (child && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; } }
  t.after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });
  await start();
  const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'library-test-password' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const put = (plan, authenticated = true) => fetch(`${base}/api/reading-plan`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify(plan) });
  const history = () => fetch(`${base}/api/reading-history`).then(response => response.json());
  const book = { book: '第一本书', author: '作者甲', progress: 50, note: '阅读笔记' };
  assert.equal((await put(book, false)).status, 401);
  assert.equal((await put(book)).status, 200);
  assert.equal((await history()).length, 0);
  assert.equal((await put({ ...book, progress: 100 })).status, 200);
  const first = (await history())[0];
  assert.ok(first.id);
  assert.ok(first.completedAt);
  assert.deepEqual(first.logs.map(log => log.progress), [50, 100]);
  await put({ ...book, progress: 100 });
  assert.equal((await history())[0].logs.length, 2);
  await put({ ...book, progress: 100, note: '更新后的笔记' });
  let books = await history();
  assert.equal(books.length, 1);
  assert.equal(books[0].completedAt, first.completedAt);
  assert.equal(books[0].note, '更新后的笔记');
  assert.equal((await put({ book: '', progress: 100 })).status, 400);
  await put({ book: '第二本书', progress: 20 });
  assert.equal((await history())[0].book, book.book);
  await put({ book: '第二本书', progress: 100 });
  books = await history();
  assert.equal(books.length, 2);
  const edit = (route, data, authenticated = true) => fetch(`${base}${route}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) });
  const bookPath = `/api/reading-history/${first.id}`;
  const change = { book: '第一本书修订', author: '作者乙', goal: '重温', note: '读完后的新理解', completedAt: '2026-10-10' };
  assert.equal((await edit(bookPath, change, false)).status, 401);
  assert.equal((await edit(bookPath, { ...change, completedAt: '2026-02-30' })).status, 400);
  assert.equal((await edit(bookPath, change)).status, 200);
  const logPath = `${bookPath}/logs/${first.logs[0].id}`;
  assert.equal((await edit(logPath, { progress: 60, note: '修正心得' }, false)).status, 401);
  assert.equal((await edit(logPath, { progress: 101, note: '' })).status, 400);
  assert.equal((await edit(logPath, { progress: 60, note: '修正心得' })).status, 200);
  const revised = (await history()).find(item => item.id === first.id);
  assert.equal(revised.book, change.book);
  assert.equal(revised.note, change.note);
  assert.equal(revised.logs[0].note, '修正心得');
  assert.equal(revised.logs[0].createdAt, first.logs[0].createdAt);
  assert.ok(revised.logs[0].editedAt);
  assert.equal(revised.logs.at(-1).kind, '书库资料更新');
  books = await history();
  await stop();
  await start();
  assert.deepEqual(await history(), books);
});
