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

  const publicPage = await fetch(`${base}/`);
  assert.doesNotMatch(await publicPage.text(), /id="login-button"|href="\/admin/);
  const adminPage = await fetch(`${base}/admin`);
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /管理导航/);
  const adminSlash = await fetch(`${base}/admin/`, { redirect: 'manual' });
  assert.equal(adminSlash.headers.get('location'), '/admin');

  const samplePost = { type: 'life', title: '测试动态', content: '测试正文', tag: '测试' };
  assert.equal((await call('/api/reading-plan')).status, 200);
  assert.equal((await call('/api/reading-plan', 'PUT', { book: '未授权的书' })).status, 401);
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
  const readingPlan = await call('/api/reading-plan', 'PUT', { book: '测试读物', author: '测试作者', goal: '每天读十页', progress: 35, note: '第一章很有趣' }, cookie);
  assert.equal(readingPlan.status, 200);
  assert.equal(readingPlan.data.progress, 35);
  assert.equal((await call('/api/reading-plan')).data.book, '测试读物');
  assert.equal((await call('/api/reading-plan', 'PUT', { book: '错误进度', progress: 101 }, cookie)).status, 400);
  const profileUpdate = await call('/api/profile', 'PUT', {
    name: '新名字', handle: 'new-handle', intro: '新的介绍', bio: '新的站长留言',
    location: '上海', birthday: '2000-05-06', interests: '阅读',
    workExperience: '编辑 · 两年', education: '大学 · 文学', email: ''
  }, cookie);
  assert.equal(profileUpdate.status, 200);
  assert.equal(profileUpdate.data.workExperience, '编辑 · 两年');
  assert.equal(profileUpdate.data.education, '大学 · 文学');
  assert.equal(profileUpdate.data.bio, '新的站长留言');
  assert.equal(profileUpdate.data.hobbyDetails[0].name, '阅读');
  const detailedProfile = await call('/api/profile', 'PUT', {
    ...profileUpdate.data,
    hobbyDetails: [{ name: '阅读', detail: '每晚读几页小说' }, { name: '摄影', detail: '记录散步时的光' }]
  }, cookie);
  assert.equal(detailedProfile.data.interests, '阅读 / 摄影');
  assert.equal(detailedProfile.data.hobbyDetails[1].detail, '记录散步时的光');
  assert.equal((await call('/api/profile', 'PUT', { ...profileUpdate.data, name: '不该保存', hobbyDetails: Array(13).fill({ name: '过多' }) }, cookie)).status, 400);
  assert.equal((await call('/api/profile')).data.name, '新名字');
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==';
  assert.equal((await call('/api/profile/avatar', 'POST', { image: `data:image/png;base64,${tinyPng}` })).status, 401);
  const avatarUpload = await call('/api/profile/avatar', 'POST', { image: `data:image/png;base64,${tinyPng}` }, cookie);
  assert.equal(avatarUpload.status, 200);
  assert.match(avatarUpload.data.avatar, /^\/assets\/uploads\/[\w-]+\.png$/);
  assert.equal((await fetch(`${base}${avatarUpload.data.avatar}`)).status, 200);
  assert.equal((await call('/api/profile')).data.avatar, avatarUpload.data.avatar);
  assert.equal((await call('/api/profile/avatar', 'POST', { image: 'data:image/png;base64,YWJj' }, cookie)).status, 400);
  const created = await call('/api/posts', 'POST', samplePost, cookie);
  assert.equal(created.status, 201);
  const edited = await call(`/api/posts/${created.data.id}`, 'PUT', { ...samplePost, title: '更新后的动态' }, cookie);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.title, '更新后的动态');
  assert.equal(edited.data.createdAt, created.data.createdAt);
  assert.ok(edited.data.updatedAt);
  const workPost = await call('/api/posts', 'POST', { type: 'study', section: 'work', title: '今日工作', content: '完成任务', tag: '项目' }, cookie);
  assert.equal(workPost.status, 201);
  assert.equal(workPost.data.section, 'work');
  const movedPost = await call(`/api/posts/${workPost.data.id}`, 'PUT', { type: 'study', section: 'learning', title: '今日学习', content: '学到新东西', tag: '笔记' }, cookie);
  assert.equal(movedPost.data.section, 'learning');
  assert.equal(movedPost.data.createdAt, workPost.data.createdAt);
  const editedTopic = await call(`/api/topics/${topic.data.id}`, 'PUT', { author: '管理员', title: '已整理', content: '保留回复' }, cookie);
  assert.equal(editedTopic.status, 200);
  assert.equal(editedTopic.data.replies.length, 1);
  assert.equal((await call('/api/posts')).data.some(post => post.id === created.data.id && post.title === '更新后的动态'), true);
  assert.equal((await call('/api/logout', 'POST', undefined, cookie)).status, 200);
  assert.equal((await call(`/api/posts/${created.data.id}`, 'DELETE', undefined, cookie)).status, 401);
});

test('profile saves education stages and validates GitHub hyperlinks', async t => {
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
  const contactProfile = await call('/api/profile', 'PUT', {
    name: '新名字', github: 'octocat', githubUrl: 'https://github.com/octocat',
    educationPrimary: '测试小学 · 2006–2012', educationBachelor: '测试大学 · 计算机',
    educationPostdoc: '测试研究所'
  }, cookie);
  assert.equal(contactProfile.status, 200);
  assert.equal(contactProfile.data.githubUrl, 'https://github.com/octocat');
  assert.equal(contactProfile.data.educationBachelor, '测试大学 · 计算机');
  assert.equal((await call('/api/profile')).data.educationPostdoc, '测试研究所');
  for (const githubUrl of ['javascript:alert(1)', 'https://github.com.evil.example/octocat', 'https://secret@github.com/octocat']) {
    assert.equal((await call('/api/profile', 'PUT', { name: '不该保存', githubUrl }, cookie)).status, 400);
  }
  assert.equal((await call('/api/profile')).data.name, '新名字');
  assert.equal((await call('/api/profile', 'PUT', { githubUrl: '', educationPrimary: '' }, cookie)).data.githubUrl, '');
  const schoolLinks = Object.fromEntries(['educationPrimary', 'educationMiddle', 'educationHigh', 'educationBachelor', 'educationMaster', 'educationDoctor', 'educationPostdoc'].map(key => [`${key}Url`, 'https://school.example.edu/admissions']));
  assert.equal((await call('/api/profile', 'PUT', schoolLinks, cookie)).status, 200);
  const savedSchools = (await call('/api/profile')).data;
  for (const [key, value] of Object.entries(schoolLinks)) assert.equal(savedSchools[key], value);
  for (const educationBachelorUrl of ['javascript:alert(1)', 'school.example.edu', 'https://secret@school.example.edu']) {
    assert.equal((await call('/api/profile', 'PUT', { name: '不该保存', educationBachelorUrl }, cookie)).status, 400);
  }
  assert.equal((await call('/api/profile')).data.educationBachelorUrl, schoolLinks.educationBachelorUrl);
  assert.equal((await call('/api/profile', 'PUT', { educationBachelorUrl: '' }, cookie)).data.educationBachelorUrl, '');

});

test('administrator can change password with persistence and session revocation', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pink-diary-test-'));
  const port = await freePort();
  await fs.copyFile(path.join(project, 'server.js'), path.join(dir, 'server.js'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(dir, 'public'));
  for (const file of ['index.html', 'admin.html']) await fs.copyFile(path.join(project, 'public', file), path.join(dir, 'public', file));
  let child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'test-only-password' }, stdio: 'ignore' });
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


  const change = { currentPassword: 'test-only-password', newPassword: 'new-test-password-2026', confirmPassword: 'new-test-password-2026' };
  assert.equal((await call('/api/password', 'PUT', change)).status, 401);
  const login = await call('/api/login', 'POST', { password: change.currentPassword });
  const cookie = login.cookie.split(';')[0];
  const otherLogin = await call('/api/login', 'POST', { password: change.currentPassword });
  const otherCookie = otherLogin.cookie.split(';')[0];
  for (const update of [
    { ...change, currentPassword: 'wrong-password' },
    { ...change, confirmPassword: 'different' },
    { ...change, newPassword: 'short', confirmPassword: 'short' },
    { ...change, newPassword: change.currentPassword, confirmPassword: change.currentPassword }
  ]) assert.equal((await call('/api/password', 'PUT', update, cookie)).status, 400);
  assert.equal((await call('/api/session', 'GET', undefined, cookie)).data.admin, true);
  const changed = await call('/api/password', 'PUT', change, cookie);
  assert.equal(changed.status, 200);
  assert.match(changed.cookie, /Max-Age=0/);
  for (const sessionCookie of [cookie, otherCookie]) assert.equal((await call('/api/session', 'GET', undefined, sessionCookie)).data.admin, false);
  assert.equal((await call('/api/login', 'POST', { password: change.currentPassword })).status, 401);
  assert.equal((await call('/api/login', 'POST', { password: change.newPassword })).status, 200);
  const authFile = path.join(dir, 'data', 'admin-auth.json');
  const saved = await fs.readFile(authFile, 'utf8');
  assert.doesNotMatch(saved, /test-only-password|new-test-password/);
  assert.equal(JSON.parse(saved).algorithm, 'scrypt');
  assert.equal((await fs.stat(authFile)).mode & 0o777, 0o600);
  assert.doesNotMatch(JSON.stringify((await call('/api/profile')).data), /scrypt|new-test-password/);
  const stopped = new Promise(resolve => child.once('exit', resolve));
  child.kill(); await stopped;
  child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BLOG_ADMIN_PASSWORD: 'test-only-password' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${base}/api/session`); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.equal((await call('/api/session')).data.loginEnabled, true);
  assert.equal((await call('/api/login', 'POST', { password: change.currentPassword })).status, 401);
  assert.equal((await call('/api/login', 'POST', { password: change.newPassword })).status, 200);
});
