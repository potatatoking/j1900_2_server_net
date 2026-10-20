import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('friend image uploads support visitors, moderation, edits and persisted local images', async t => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'friend-upload-'));
  await fs.copyFile(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => { if (child?.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } };
  t.after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });
  const start = async () => {
    child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'friend-upload-test' }, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/api/session')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('server failed to start');
  };
  const call = async (route, method = 'GET', data, cookie = '') => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==', 'base64');
  // Add a valid ancillary PNG chunk so the request exceeds the old 20 KB JSON limit.
  const text = Buffer.from('Comment\0' + 'friend-image'.repeat(2500));
  const type = Buffer.from('tEXt');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, text])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(text.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  const largePng = Buffer.concat([png.subarray(0, -12), length, type, text, checksum, png.subarray(-12)]);
  const image = 'data:image/png;base64,' + largePng.toString('base64');
  const sample = { name: '图片小站', url: 'https://upload.example/', description: '本地图片友链' };
  const uploads = async () => fs.readdir(path.join(dir, 'public/assets/uploads')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  await start();
  let application, cookie, localImage;

  await t.test('visitor images are stored with pending applications and are readable as images', async () => {
    assert.ok(image.length > 20_000);
    application = await call('/api/friends', 'POST', { ...sample, avatarImage: image, status: 'published' });
    assert.equal(application.status, 201);
    assert.equal(application.data.status, 'pending');
    localImage = application.data.avatar;
    assert.match(localImage, /^\/assets\/uploads\/[\w-]+\.png$/);
    assert.equal(Object.hasOwn(application.data, 'avatarImage'), false);
    assert.deepEqual((await call('/api/friends')).data, []);
    assert.equal((await call('/api/friends?review=1')).status, 401);
    const response = await fetch(base + localImage);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), largePng);
    assert.equal((await call('/api/images', 'POST', { image })).status, 401);
  });
  await t.test('invalid, oversized and duplicate applications do not write new files', async () => {
    const before = await uploads();
    assert.equal((await call('/api/friends', 'POST', { ...sample, avatarImage: image })).status, 409);
    const oversized = Buffer.alloc(2_000_001); png.copy(oversized);
    for (const avatarImage of ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,YWJj', image.replace('image/png', 'image/webp'), 'data:image/png;base64,' + oversized.toString('base64')]) {
      assert.equal((await call('/api/friends', 'POST', { ...sample, url: 'https://invalid.example/', avatarImage })).status, 400);
    }
    for (const avatar of ['/assets/uploads/missing.png', '//evil.example/logo.png', '/assets/uploads/../secret.png']) {
      assert.equal((await call('/api/friends', 'POST', { ...sample, url: 'https://invalid.example/', avatar })).status, 400);
    }
    assert.deepEqual(await uploads(), before);
  });
  await t.test('administrators can publish uploaded images and keep a visitor image during review', async () => {
    cookie = (await call('/api/login', 'POST', { password: 'friend-upload-test' })).cookie;
    const reviewed = await call(`/api/friends/${application.data.id}`, 'PUT', { ...sample, avatar: localImage, status: 'published' }, cookie);
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.data.avatar, localImage);
    const direct = await call('/api/friends', 'POST', { ...sample, url: 'https://admin-upload.example/', avatarImage: image }, cookie);
    assert.equal(direct.status, 201);
    assert.equal(direct.data.status, 'published');
    assert.notEqual(direct.data.avatar, localImage);
    assert.equal((await call('/api/friends')).data.length, 2);
  });
  await t.test('editing supports replacement, remote URLs and removal without changing other fields', async () => {
    const endpoint = `/api/friends/${application.data.id}`;
    assert.equal((await call(endpoint, 'PUT', { ...sample, avatarImage: image, status: 'published' })).status, 401);
    const replaced = await call(endpoint, 'PUT', { ...sample, avatarImage: image, status: 'published' }, cookie);
    assert.equal(replaced.status, 200); assert.notEqual(replaced.data.avatar, localImage);
    assert.equal(replaced.data.description, sample.description);
    assert.equal((await call(endpoint, 'PUT', { ...sample, avatar: 'https://images.example/avatar.webp', status: 'published' }, cookie)).data.avatar, 'https://images.example/avatar.webp');
    assert.equal((await call(endpoint, 'PUT', { ...sample, avatar: '', status: 'published' }, cookie)).data.avatar, '');
    assert.equal((await call(endpoint, 'PUT', { ...sample, avatar: localImage, status: 'published' }, cookie)).status, 200);
  });
  await t.test('local images and their friend association survive restart', async () => {
    await stop(); await start();
    const saved = (await call('/api/friends')).data.find(item => item.id === application.data.id);
    assert.equal(saved.avatar, localImage);
    assert.equal((await fetch(base + localImage)).status, 200);
    assert.equal((await call('/api/friends?review=1', 'GET', undefined, cookie)).status, 401);
  });
});
