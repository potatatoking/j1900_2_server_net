import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'blog.json');
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.BLOG_ADMIN_PASSWORD || '';
const sessions = new Map();
const requests = new Map();
const secureCookie = process.env.BLOG_SECURE_COOKIE === '1';
const trustProxy = process.env.BLOG_TRUST_PROXY === '1';

const initialData = {
  profile: {
    name: '小樱', handle: 'sakura.notes', intro: '在日常里收集闪闪发光的小事 ✨',
    bio: '你好呀！这里是我的个人小站。喜欢动漫、甜点、散步和记录生活，也在努力学习新知识。愿我们都能在自己的故事里闪闪发光。',
    location: '中国 · 某个有樱花的角落', interests: '动漫 / 摄影 / 阅读 / 编程', email: ''
  },
  posts: [
    { id: 'life-1', type: 'life', title: '把今天装进粉色的口袋里', content: '下午的阳光刚刚好，路过花店时买了一束小小的雏菊。回家泡了热茶，和猫咪一起看完一集喜欢的动画。原来平凡的一天，也可以很可爱。', tag: '日常碎片', createdAt: '2026-10-08T12:00:00.000Z' },
    { id: 'life-2', type: 'life', title: '周末的甜点探险', content: '找到一家藏在巷子里的甜品店，草莓千层真的太好吃啦！顺便拍了好多照片，想把这种小小的幸福分享给你。', tag: '快乐收藏', createdAt: '2026-10-04T09:00:00.000Z' },
    { id: 'study-1', type: 'study', title: '最近在学：把想法做成网页', content: '这一周继续学习前端开发。从布局、颜色到交互，每一个小细节都很有趣。希望以后能把更多脑海中的小世界变成真正能打开的网站。', tag: '学习笔记', createdAt: '2026-10-07T10:00:00.000Z' },
    { id: 'study-2', type: 'study', title: '工作日的小小复盘', content: '把复杂的任务拆成小步骤之后，推进起来轻松了很多。今天完成了计划里的三件事，给认真生活的自己一颗星星。', tag: '工作记录', createdAt: '2026-10-02T10:00:00.000Z' }
  ],
  topics: [
    { id: 'welcome', author: '小樱', title: '欢迎来到留言角！', content: '可以聊聊最近喜欢的动漫、学习心得，或者分享今天遇见的小确幸。请友善交流呀 ♡', createdAt: '2026-10-01T10:00:00.000Z', replies: [] }
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
let writeQueue = Promise.resolve();
function save() {
  writeQueue = writeQueue.then(async () => {
    const temp = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db, null, 2));
    await fs.rename(temp, dataFile);
  });
  return writeQueue;
}
function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(value));
}
function clean(value, max) { return String(value ?? '').trim().slice(0, max); }
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
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 20_000) throw new Error('内容太长了');
  }
  try { return JSON.parse(text || '{}'); } catch { throw new Error('JSON 格式错误'); }
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  json(res, 401, { error: '请先以站长身份登录' }); return false;
}

async function api(req, res, url) {
  if (req.method !== 'GET' && limited(req)) return json(res, 429, { error: '操作太频繁，请稍后再试' });
  const route = url.pathname;
  if (route === '/api/session' && req.method === 'GET') return json(res, 200, { admin: isAdmin(req), loginEnabled: Boolean(adminPassword) });
  if (route === '/api/login' && req.method === 'POST') {
    if (!adminPassword) return json(res, 503, { error: '请先设置 BLOG_ADMIN_PASSWORD 环境变量' });
    const input = clean((await body(req)).password, 200);
    const a = crypto.createHash('sha256').update(input).digest();
    const b = crypto.createHash('sha256').update(adminPassword).digest();
    if (!crypto.timingSafeEqual(a, b)) return json(res, 401, { error: '密码不正确' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 7 * 86400_000);
    return json(res, 200, { admin: true }, { 'Set-Cookie': `blog_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie ? '; Secure' : ''}` });
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
      for (const [key, max] of Object.entries({ name: 40, handle: 40, intro: 120, bio: 1000, location: 80, interests: 120, email: 120 })) db.profile[key] = clean(input[key], max);
      await save(); return json(res, 200, db.profile);
    }
  }
  if (route === '/api/posts') {
    if (req.method === 'GET') return json(res, 200, db.posts.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const input = await body(req);
      const type = input.type === 'study' ? 'study' : input.type === 'life' ? 'life' : null;
      const title = clean(input.title, 100), content = clean(input.content, 5000), tag = clean(input.tag, 30);
      if (!type || !title || !content) return json(res, 400, { error: '请填写完整的标题和内容' });
      const post = { id: crypto.randomUUID(), type, title, content, tag, createdAt: new Date().toISOString() };
      db.posts.push(post); await save(); return json(res, 201, post);
    }
  }
  const postId = route.match(/^\/api\/posts\/([\w-]+)$/)?.[1];
  if (postId && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const old = db.posts.length; db.posts = db.posts.filter(p => p.id !== postId);
    if (old === db.posts.length) return json(res, 404, { error: '动态不存在' });
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
  if (topicId && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const old = db.topics.length; db.topics = db.topics.filter(t => t.id !== topicId);
    if (old === db.topics.length) return json(res, 404, { error: '话题不存在' });
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

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '请求方式不支持' });
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
