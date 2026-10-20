import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'blog.json');
const port = Number(process.env.PORT || 3000);
let activityStore = null;
try {
  await fs.access(path.join(root, 'activity.js'));
  const { createActivityStore } = await import('./activity.js');
  activityStore = await createActivityStore({ dataDir });
} catch (error) { if (error.code !== 'ENOENT') throw error; }

let adminPassword = process.env.BLOG_ADMIN_PASSWORD || '';
if (!adminPassword) {
  try {
    const localEnv = await fs.readFile(path.join(root, '.env'), 'utf8');
    const passwordLine = localEnv.split(/\r?\n/).find(line => /^BLOG_ADMIN_PASSWORD=/.test(line));
    if (passwordLine) adminPassword = passwordLine.slice('BLOG_ADMIN_PASSWORD='.length).trim().replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const passwordFile = path.join(dataDir, 'admin-auth.json');
const scrypt = promisify(crypto.scrypt);
let passwordRecord = null;
let changingPassword = false;
try {
  passwordRecord = JSON.parse(await fs.readFile(passwordFile, 'utf8'));
  if (passwordRecord?.algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(passwordRecord.salt) || !/^[a-f0-9]{128}$/.test(passwordRecord.hash)) throw new Error('管理员密码文件格式不正确');
  adminPassword = '';
} catch (error) { if (error.code !== 'ENOENT') throw error; }
async function passwordMatches(value) {
  if (typeof value !== 'string' || value.length > 200) return false;
  if (passwordRecord) {
    const record = passwordRecord;
    const hash = await scrypt(value, record.salt, 64);
    return crypto.timingSafeEqual(hash, Buffer.from(record.hash, 'hex'));
  }
  if (!adminPassword) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(value.trim()).digest(), crypto.createHash('sha256').update(adminPassword).digest());
}
const sessions = new Map();
const requests = new Map();
const secureCookie = process.env.BLOG_SECURE_COOKIE === '1';
const trustProxy = process.env.BLOG_TRUST_PROXY === '1';

const initialData = {
  moods: [],
  readingPlan: { book: '', author: '', goal: '', progress: 0, note: '' },
  profile: {
    name: '土豆', handle: 'sakura.notes', intro: '在日常里收集闪闪发光的小事 ✨',
    bio: '你好呀！这里是我的个人小站。喜欢动漫、游戏，爱折腾奇怪东西，也在努力学习新知识。',
    location: '中国 · 某个有樱花的角落', birthday: '', interests: '动漫 / 摄影 / 阅读 / 编程',
    workExperience: '', education: '', email: '', phone: '', qq: '', wechat: '', github: '', avatar: ''
  },
  posts: [
    { id: 'life-1', type: 'life', title: '把今天装进粉色的口袋里', content: '下午的阳光刚刚好，路过花店时买了一束小小的雏菊。回家泡了热茶，和猫咪一起看完一集喜欢的动画。原来平凡的一天，也可以很可爱。', tag: '日常碎片', createdAt: '2026-10-08T12:00:00.000Z' },
    { id: 'life-2', type: 'life', title: '周末的甜点探险', content: '找到一家藏在巷子里的甜品店，草莓千层真的太好吃啦！顺便拍了好多照片，想把这种小小的幸福分享给你。', tag: '快乐收藏', createdAt: '2026-10-04T09:00:00.000Z' },
    { id: 'study-1', type: 'study', title: '最近在学：把想法做成网页', content: '这一周继续学习前端开发。从布局、颜色到交互，每一个小细节都很有趣。希望以后能把更多脑海中的小世界变成真正能打开的网站。', tag: '学习笔记', createdAt: '2026-10-07T10:00:00.000Z' },
    { id: 'study-2', type: 'study', title: '工作日的小小复盘', content: '把复杂的任务拆成小步骤之后，推进起来轻松了很多。今天完成了计划里的三件事，给认真生活的自己一颗星星。', tag: '工作记录', createdAt: '2026-10-02T10:00:00.000Z' }
  ],
  topics: [
    { id: 'welcome', author: '土豆', title: '欢迎来到留言角！', content: '可以聊聊最近喜欢的动漫、学习心得，或者分享今天遇见的小确幸。请友善交流呀 🥔', createdAt: '2026-10-01T10:00:00.000Z', replies: [] }
  ]
};

await fs.mkdir(dataDir, { recursive: true });
let db;
try { db = JSON.parse(await fs.readFile(dataFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  db = initialData;
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2));
}
db.moods ??= [];
db.friends ??= [];
db.projects ??= [];
db.readingHistory ??= [];
db.readingPlan ??= { book: '', author: '', goal: '', progress: 0, note: '' };
db.profile.hobbyDetails ??= String(db.profile.interests || '').split(/[/／、，,|]+/).map(name => name.trim()).filter(Boolean).slice(0, 12).map(name => ({ name, detail: '' }));
for (const key of ['phone', 'qq', 'wechat', 'github', 'githubUrl', 'educationPrimary', 'educationMiddle', 'educationHigh', 'educationBachelor', 'educationMaster', 'educationDoctor', 'educationPostdoc']) db.profile[key] ??= '';
db.profile.contactNote ??= '';
if (!db.profile.contactNote && /^备注来意/.test(String(db.profile.education || '').trim())) {
  db.profile.contactNote = db.profile.education;
  db.profile.education = '';
}
const educationStageKeys = ['educationPrimary', 'educationMiddle', 'educationHigh', 'educationBachelor', 'educationMaster', 'educationDoctor', 'educationPostdoc'];
for (const key of educationStageKeys) db.profile[`${key}Url`] ??= '';
const moodKeys = new Set(['sunny', 'happy', 'calm', 'hopeful', 'quiet', 'growing', 'busy', 'tired', 'rainy']);
let writeQueue = Promise.resolve();
function save() {
  writeQueue = writeQueue.then(async () => {
    const temp = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db, null, 2));
    await fs.rename(temp, dataFile);
  });
  return writeQueue;
}
function archiveReadingPlan(completedAt = new Date().toISOString()) {
  const plan = db.readingPlan;
  if (!plan.book || Number(plan.progress) !== 100) return false;
  const existing = db.readingHistory.find(book => book.id === plan.archiveId);
  if (existing) {
    Object.assign(existing, { book: plan.book, author: plan.author, goal: plan.goal, note: plan.note, logs: plan.logs || [] });
  } else {
    const id = crypto.randomUUID();
    db.readingHistory.unshift({ id, book: plan.book, author: plan.author, goal: plan.goal, note: plan.note, logs: plan.logs || [], completedAt, recordedAt: new Date().toISOString() });
    plan.archiveId = id;
  }
  return true;
}
function readingBaseline(book) {
  return { id: crypto.randomUUID(), createdAt: null, progress: Number(book.progress ?? 100), note: book.note || '', kind: '原有记录' };
}
let readingMigration = false;
for (const book of db.readingHistory) {
  if (!book.logs) { book.logs = [readingBaseline(book)]; readingMigration = true; }
}
if (db.readingPlan.book && !db.readingPlan.logs) { db.readingPlan.logs = [readingBaseline(db.readingPlan)]; readingMigration = true; }
// 已完成的旧计划也收录，未知的完成日期不补造。
if (archiveReadingPlan(null) || readingMigration) await save();
function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(value));
}
function clean(value, max) { return String(value ?? '').trim().slice(0, max); }
async function postImages(value = []) {
  if (!Array.isArray(value) || value.length > 9) throw new Error('最多添加 9 张图片');
  for (const url of value) {
    if (typeof url !== 'string' || !/^\/assets\/uploads\/[\w-]+\.(png|jpg|webp)$/.test(url)) throw new Error('图片地址无效，请重新上传');
    try { await fs.access(path.join(publicDir, url)); }
    catch { throw new Error('图片不存在，请重新上传'); }
  }
  return value;
}
function hobbyNames(value) {
  return clean(value, 300).split(/[/／、，,|]+/).map(name => clean(name, 32)).filter(Boolean).slice(0, 12);
}
function cookie(req) { return req.headers.cookie?.match(/(?:^|; )blog_session=([^;]+)/)?.[1]; }
function isAdmin(req) {
  const token = cookie(req); const expires = sessions.get(token);
  if (!expires) return false;
  if (expires < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function limited(req) {
  const ip = (trustProxy && typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : req.socket.remoteAddress) || 'unknown';
  const now = Date.now(); const recent = (requests.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now); requests.set(ip, recent);
  return recent.length > 30;
}
async function body(req, maxLength = 20_000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxLength) throw new Error('内容太长了');
    chunks.push(chunk);
  }
  // TCP chunks can split a Chinese character or emoji across byte boundaries.
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text || '{}'); } catch { throw new Error('JSON 格式错误'); }
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  json(res, 401, { error: '请先以站长身份登录' }); return false;
}

async function storeImage(image) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof image === 'string' ? image : '');
  if (!match) throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2_000_000) throw new Error('图片不能超过 2 MB');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new Error('图片内容与格式不符');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const uploadDir = path.join(publicDir, 'assets', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const avatar = `/assets/uploads/${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadDir, path.basename(avatar)), bytes);
  return avatar;
}

function friendUrl(value, optional = false) {
  const text = String(value ?? '').trim();
  if (!text && optional) return '';
  if (text.length > 1000) throw new Error('网址过长');
  let url;
  try { url = new URL(text); } catch { throw new Error('请填写完整的 http 或 https 网址'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('只支持不含账号密码的 http 或 https 网址');
  url.hash = '';
  return url.href;
}
async function friendFields(input) {
  const name = clean(input.name, 60), description = clean(input.description, 240);
  if (!name || !description) throw new Error('请填写站点名称和简介');
  let avatar = '';
  if (!Object.hasOwn(input, 'avatarImage')) {
    const value = String(input.avatar ?? '').trim();
    if (value.startsWith('/')) { await postImages([value]); avatar = value; }
    else avatar = friendUrl(value, true);
  }
  return { name, description, url: friendUrl(input.url), avatar };
}
function duplicateFriend(url, except = '') {
  return db.friends.some(item => item.id !== except && item.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
}
function projectFields(input) {
  const title = clean(input.title, 60), description = String(input.description ?? '').trim();
  if (!title) throw new Error('请填写项目名称');
  if (!['active', 'completed'].includes(input.status)) throw new Error('请选择进行中或已完成');
  const url = friendUrl(input.url, true);
  return { title, description, status: input.status, url: url ? url + new URL(String(input.url).trim()).hash : '' };
}

async function api(req, res, url) {
  if (req.method !== 'GET' && limited(req)) return json(res, 429, { error: '操作太频繁，请稍后再试' });
  const route = url.pathname;
  if (route === '/api/projects') {
    if (req.method === 'GET') return json(res, 200, db.projects);
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      if (db.projects.length >= 60) return json(res, 400, { error: '最多记录 60 个项目' });
      const fields = projectFields(await body(req, Infinity));
      const project = { id: crypto.randomUUID(), ...fields, createdAt: new Date().toISOString() };
      db.projects.push(project); await save(); return json(res, 201, project);
    }
    return json(res, 405, { error: '请求方式不支持' });
  }
  const projectId = route.match(/^\/api\/projects\/([\w-]+)$/)?.[1];
  if (projectId) {
    if (!requireAdmin(req, res)) return;
    const project = db.projects.find(item => item.id === projectId);
    if (!project) return json(res, 404, { error: '项目不存在' });
    if (req.method === 'PUT') {
      const fields = projectFields(await body(req, Infinity));
      Object.assign(project, fields, { updatedAt: new Date().toISOString() });
      await save(); return json(res, 200, project);
    }
    if (req.method === 'DELETE') {
      db.projects = db.projects.filter(item => item.id !== projectId);
      await save(); return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: '请求方式不支持' });
  }
  if (route === '/api/friends') {
    if (req.method === 'GET') {
      if (url.searchParams.get('review') === '1') {
        if (!requireAdmin(req, res)) return;
        return json(res, 200, db.friends);
      }
      return json(res, 200, db.friends.filter(item => item.status === 'published'));
    }
    if (req.method === 'POST') {
      const input = await body(req, 3_000_000), fields = await friendFields(input);
      if (duplicateFriend(fields.url)) return json(res, 409, { error: '这个站点已收录或正在审核中，请勿重复提交' });
      if (Object.hasOwn(input, 'avatarImage')) fields.avatar = await storeImage(input.avatarImage);
      const friend = { ...fields, id: crypto.randomUUID(), status: isAdmin(req) ? 'published' : 'pending', createdAt: new Date().toISOString() };
      db.friends.unshift(friend);
      await save(); return json(res, 201, friend);
    }
    return json(res, 405, { error: '请求方式不支持' });
  }
  const friendId = route.match(/^\/api\/friends\/([\w-]+)$/)?.[1];
  if (friendId) {
    if (!requireAdmin(req, res)) return;
    const friend = db.friends.find(item => item.id === friendId);
    if (!friend) return json(res, 404, { error: '友链不存在' });
    if (req.method === 'PUT') {
      const input = await body(req, 3_000_000), fields = await friendFields(input);
      if (!['pending', 'published'].includes(input.status)) return json(res, 400, { error: '请选择待审核或已发布' });
      if (duplicateFriend(fields.url, friendId)) return json(res, 409, { error: '这个站点已收录或正在审核中' });
      if (Object.hasOwn(input, 'avatarImage')) fields.avatar = await storeImage(input.avatarImage);
      Object.assign(friend, fields, { status: input.status, updatedAt: new Date().toISOString() });
      await save(); return json(res, 200, friend);
    }
    if (req.method === 'DELETE') {
      db.friends = db.friends.filter(item => item.id !== friendId);
      await save(); return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: '请求方式不支持' });
  }
  if (route === '/api/activity' && req.method === 'GET') return json(res, 200, activityStore?.snapshot() || { timezone: 'Asia/Shanghai', github: { status: 'unconfigured' }, luogu: { status: 'unconfigured' } });
  if (route === '/api/activity/settings' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, activityStore?.settingsStatus() || {});
  }
  if (route === '/api/activity/sync' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    if (!activityStore) return json(res, 503, { error: '活动同步模块暂不可用' });
    const job = activityStore.sync(); job.catch(() => {});
    return json(res, 202, { syncing: true });
  }
  if (route === '/api/session' && req.method === 'GET') return json(res, 200, { admin: isAdmin(req), loginEnabled: Boolean(passwordRecord || adminPassword) });
  if (route === '/api/login' && req.method === 'POST') {
    if (!passwordRecord && !adminPassword) return json(res, 503, { error: '请先设置 BLOG_ADMIN_PASSWORD 环境变量' });
    const input = (await body(req)).password;
    const recordAtLogin = passwordRecord;
    if (!await passwordMatches(input) || recordAtLogin !== passwordRecord) return json(res, 401, { error: '密码不正确' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 7 * 86400_000);
    return json(res, 200, { admin: true }, { 'Set-Cookie': `blog_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie ? '; Secure' : ''}` });
  }
  if (route === '/api/password' && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const input = await body(req);
    if (typeof input.newPassword !== 'string' || input.newPassword.length < 8 || input.newPassword.length > 200 || !input.newPassword.trim()) return json(res, 400, { error: '新密码需要 8–200 个字符，不能全为空格' });
    if (input.newPassword !== input.confirmPassword) return json(res, 400, { error: '两次输入的新密码不一致' });
    if (changingPassword) return json(res, 409, { error: '密码正在更新，请稍后重试' });
    changingPassword = true;
    try {
      if (!await passwordMatches(input.currentPassword)) return json(res, 400, { error: '当前密码不正确' });
      if (await passwordMatches(input.newPassword)) return json(res, 400, { error: '新密码不能与当前密码相同' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = (await scrypt(input.newPassword, salt, 64)).toString('hex');
      const record = { algorithm: 'scrypt', salt, hash };
      const temporary = `${passwordFile}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
        await fs.rename(temporary, passwordFile);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        console.error('管理员密码保存失败', error.code);
        return json(res, 500, { error: '密码保存失败，请稍后重试' });
      }
      passwordRecord = record;
      adminPassword = '';
      sessions.clear();
      return json(res, 200, { ok: true }, { 'Set-Cookie': `blog_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie ? '; Secure' : ''}` });
    } finally { changingPassword = false; }
  }
  if (route === '/api/logout' && req.method === 'POST') {
    sessions.delete(cookie(req));
    return json(res, 200, { admin: false }, { 'Set-Cookie': 'blog_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }
  if (route === '/api/profile') {
    if (req.method === 'GET') return json(res, 200, db.profile);
    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const input = await body(req);
      const fields = { name: 40, handle: 40, intro: 120, bio: 2000, location: 80, birthday: 10, workExperience: 2000, education: 2000, email: 120, phone: 40, qq: 30, wechat: 60, github: 120, githubUrl: 500, contactNote: 300, educationPrimary: 500, educationMiddle: 500, educationHigh: 500, educationBachelor: 500, educationMaster: 500, educationDoctor: 500, educationPostdoc: 500 };
      for (const key of educationStageKeys) {
        const linkKey = `${key}Url`;
        fields[linkKey] = 500;
        if (!input[linkKey]) continue;
        try {
          const value = String(input[linkKey]).trim();
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.length > 500) throw new Error();
        } catch { return json(res, 400, { error: '学校链接请填写以 https:// 或 http:// 开头的完整网址' }); }
      }
      if (input.githubUrl) {
        try {
          const link = new URL(String(input.githubUrl).trim());
          if (!['https:', 'http:'].includes(link.protocol) || !['github.com', 'www.github.com'].includes(link.hostname) || link.username || link.password || link.port) throw new Error();
          if (String(input.githubUrl).trim().length > 500) throw new Error();
        } catch { return json(res, 400, { error: '请填写完整的 GitHub 链接，例如 https://github.com/用户名' }); }
      }
      if (input.birthday) {
        const birthday = clean(input.birthday, 10);
        const day = new Date(`${birthday}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== birthday) return json(res, 400, { error: '生日格式不正确' });
      }
      let hobbyDetails = db.profile.hobbyDetails;
      if ('hobbyDetails' in input) {
        if (!Array.isArray(input.hobbyDetails) || input.hobbyDetails.length > 12) return json(res, 400, { error: '最多添加 12 个爱好' });
        hobbyDetails = input.hobbyDetails.map(item => ({
          name: clean(item?.name, 32),
          detail: clean(item?.detail, 200)
        })).filter(item => item.name);
      } else if ('interests' in input) {
        const previous = new Map(db.profile.hobbyDetails.map(item => [item.name, item.detail]));
        hobbyDetails = hobbyNames(input.interests).map(name => ({ name, detail: previous.get(name) || '' }));
      }
      for (const [key, max] of Object.entries(fields)) if (key in input) db.profile[key] = clean(input[key], max);
      db.profile.hobbyDetails = hobbyDetails;
      db.profile.interests = db.profile.hobbyDetails.map(item => item.name).join(' / ');
      await save(); return json(res, 200, db.profile);
    }
  }
  if (route === '/api/reading-history' && req.method === 'GET') return json(res, 200, db.readingHistory);
  const readingLogMatch = route.match(/^\/api\/reading-history\/([\w-]+)\/logs\/([\w-]+)$/);
  if (readingLogMatch && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const book = db.readingHistory.find(item => item.id === readingLogMatch[1]);
    const log = book?.logs?.find(item => item.id === readingLogMatch[2]);
    if (!log) return json(res, 404, { error: '未找到这条阅读记录' });
    const input = await body(req);
    const progress = Number(input.progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return json(res, 400, { error: '阅读进度须为 0 到 100 的整数' });
    Object.assign(log, { progress, note: clean(input.note, 2000), editedAt: new Date().toISOString() });
    if (db.readingPlan.archiveId === book.id) db.readingPlan.logs = book.logs;
    await save(); return json(res, 200, book);
  }
  const readingBookId = route.match(/^\/api\/reading-history\/([\w-]+)$/)?.[1];
  if (readingBookId && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const book = db.readingHistory.find(item => item.id === readingBookId);
    if (!book) return json(res, 404, { error: '未找到这本书' });
    const input = await body(req);
    const title = clean(input.book, 100);
    if (!title) return json(res, 400, { error: '请填写书名' });
    const completedAt = input.completedAt ? String(input.completedAt) : null;
    if (completedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(completedAt) || !Number.isFinite(Date.parse(completedAt)) || new Date(completedAt).toISOString().slice(0, 10) !== completedAt)) return json(res, 400, { error: '请填写有效的读完日期' });
    const changes = { book: title, author: clean(input.author, 80), goal: clean(input.goal, 160), note: clean(input.note, 2000), completedAt: completedAt ? `${completedAt}T12:00:00+08:00` : null };
    if (Object.entries(changes).some(([key, value]) => book[key] !== value)) {
      Object.assign(book, changes);
      book.logs ??= [];
      book.logs.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), progress: 100, note: book.note, kind: '书库资料更新' });
      if (db.readingPlan.archiveId === book.id) Object.assign(db.readingPlan, { book: book.book, author: book.author, goal: book.goal, note: book.note, logs: book.logs });
    }
    await save(); return json(res, 200, book);
  }
  if (route === '/api/reading-plan') {
    if (req.method === 'GET') return json(res, 200, db.readingPlan);
    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const input = await body(req);
      const progress = Number(input.progress || 0);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) return json(res, 400, { error: '阅读进度须为 0 到 100 的整数' });
      const previous = db.readingPlan;
      const book = clean(input.book, 100);
      if (progress === 100 && !book) return json(res, 400, { error: '请填写读完的书名' });
      db.readingPlan = {
        book,
        author: clean(input.author, 80),
        goal: clean(input.goal, 160),
        progress,
        note: clean(input.note, 2000)
      };
      const sameBook = previous.book === book;
      db.readingPlan.logs = sameBook ? [...(previous.logs || [])] : [];
      if (book && (!sameBook || ['author', 'goal', 'progress', 'note'].some(key => previous[key] !== db.readingPlan[key]))) {
        db.readingPlan.logs.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), progress, note: db.readingPlan.note, kind: progress === 100 && (!sameBook || previous.progress !== 100) ? '完成阅读' : !sameBook ? '开始阅读' : previous.progress !== progress ? '进度更新' : '心得与资料更新' });
      }
      if (previous.book === book && previous.archiveId) db.readingPlan.archiveId = previous.archiveId;
      archiveReadingPlan();
      await save(); return json(res, 200, db.readingPlan);
    }
  }
  if (['/api/profile/avatar', '/api/images'].includes(route) && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const input = await body(req, 3_000_000);
    const avatar = await storeImage(input.image);
    if (route === '/api/images') return json(res, 201, { url: avatar });
    db.profile.avatar = avatar;
    await save();
    return json(res, 200, { avatar });
  }
  if (route === '/api/moods' && req.method === 'GET') return json(res, 200, db.moods.slice().sort((a, b) => b.date.localeCompare(a.date)));
  const moodDate = route.match(/^\/api\/moods\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (moodDate && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const input = await body(req);
    const mood = clean(input.mood, 30);
    const day = new Date(`${moodDate}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== moodDate || !moodKeys.has(mood)) return json(res, 400, { error: '请选择有效的日期和心情' });
    const entry = { date: moodDate, mood, note: clean(input.note, 120) };
    const index = db.moods.findIndex(item => item.date === moodDate);
    if (index < 0) db.moods.push(entry);
    else db.moods[index] = entry;
    await save(); return json(res, 200, entry);
  }
  if (route === '/api/posts') {
    if (req.method === 'GET') return json(res, 200, db.posts.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const input = await body(req);
      const type = ['study', 'life', 'article'].includes(input.type) ? input.type : null;
      const title = clean(input.title, 100), content = clean(input.content, 5000), tag = clean(input.tag, 30);
      const section = type === 'study' ? (input.section === 'work' ? 'work' : 'learning') : undefined;
      if (!type || !title || !content) return json(res, 400, { error: '请填写完整的标题和内容' });
      let images;
      try { images = await postImages(input.images); }
      catch (error) { return json(res, 400, { error: error.message }); }
      const post = { id: crypto.randomUUID(), type, title, content, tag, images, ...(section ? { section } : {}), createdAt: new Date().toISOString() };
      db.posts.push(post); await save(); return json(res, 201, post);
    }
  }
  const postId = route.match(/^\/api\/posts\/([\w-]+)$/)?.[1];
  if (postId && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!requireAdmin(req, res)) return;
    const post = db.posts.find(p => p.id === postId);
    if (!post) return json(res, 404, { error: '动态不存在' });
    if (req.method === 'PUT') {
      const input = await body(req);
      const type = ['study', 'life', 'article'].includes(input.type) ? input.type : null;
      const title = clean(input.title, 100), content = clean(input.content, 5000), tag = clean(input.tag, 30);
      const section = type === 'study' ? (input.section === 'work' ? 'work' : 'learning') : undefined;
      if (!type || !title || !content) return json(res, 400, { error: '请填写完整的标题和内容' });
      let images;
      try { images = await postImages(input.images ?? post.images); }
      catch (error) { return json(res, 400, { error: error.message }); }
      Object.assign(post, { type, title, content, tag, images, updatedAt: new Date().toISOString() });
      if (section) post.section = section;
      else delete post.section;
      await save(); return json(res, 200, post);
    }
    db.posts = db.posts.filter(p => p.id !== postId);
    await save(); return json(res, 200, { ok: true });
  }
  if (route === '/api/topics') {
    if (req.method === 'GET') return json(res, 200, db.topics.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    if (req.method === 'POST') {
      const input = await body(req);
      const author = clean(input.author, 30), title = clean(input.title, 100), content = clean(input.content, 2000);
      if (!author || !title || !content) return json(res, 400, { error: '请填写昵称、标题和内容' });
      const topic = { id: crypto.randomUUID(), author, title, content, createdAt: new Date().toISOString(), replies: [] };
      db.topics.push(topic); await save(); return json(res, 201, topic);
    }
  }
  const topicId = route.match(/^\/api\/topics\/([\w-]+)$/)?.[1];
  if (topicId && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!requireAdmin(req, res)) return;
    const topic = db.topics.find(t => t.id === topicId);
    if (!topic) return json(res, 404, { error: '留言不存在' });
    if (req.method === 'PUT') {
      const input = await body(req);
      const author = clean(input.author, 30), title = clean(input.title, 100), content = clean(input.content, 2000);
      if (!author || !title || !content) return json(res, 400, { error: '请填写昵称、标题和内容' });
      Object.assign(topic, { author, title, content, updatedAt: new Date().toISOString() });
      await save(); return json(res, 200, topic);
    }
    db.topics = db.topics.filter(t => t.id !== topicId);
    await save(); return json(res, 200, { ok: true });
  }
  const replyId = route.match(/^\/api\/topics\/([\w-]+)\/replies$/)?.[1];
  if (replyId && req.method === 'POST') {
    const topic = db.topics.find(t => t.id === replyId);
    if (!topic) return json(res, 404, { error: '话题不存在' });
    const input = await body(req), author = clean(input.author, 30), content = clean(input.content, 1000);
    if (!author || !content) return json(res, 400, { error: '请填写昵称和回复' });
    const reply = { id: crypto.randomUUID(), author, content, createdAt: new Date().toISOString() };
    topic.replies.push(reply); await save(); return json(res, 201, reply);
  }
  return json(res, 404, { error: '页面不存在' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '请求方式不支持' });
    if (url.pathname === '/admin/') { res.writeHead(302, { Location: '/admin' + url.search }); return res.end(); }
    if (['/study/', '/work/', '/friends/', '/articles/'].includes(url.pathname)) { res.writeHead(302, { Location: url.pathname.slice(0, -1) + url.search }); return res.end(); }
    if (['/friends', '/study', '/work', '/articles'].includes(url.pathname)) url.pathname = '/index.html';
    if (url.pathname === '/admin') url.pathname = '/admin.html';
    let target = path.resolve(publicDir, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(publicDir + path.sep)) return json(res, 403, { error: '无权访问' });
    let stat;
    try { stat = await fs.stat(target); } catch { return json(res, 404, { error: '文件不存在' }); }
    if (!stat.isFile()) return json(res, 404, { error: '文件不存在' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': target.endsWith('.html') ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(target);
    stream.on('error', error => {
      console.error(error);
      if (res.headersSent) res.destroy(error);
      else json(res, 500, { error: '文件读取失败' });
    });
    stream.pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 400, { error: error.message || '请求失败' });
  }
}).listen(port, '0.0.0.0', () => console.log(`Pink Diary 已启动：http://localhost:${port}`));
