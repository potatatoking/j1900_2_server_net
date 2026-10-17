import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'blog.json');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const password = process.env.BLOG_ADMIN_PASSWORD;
if (!password || password.length < 8) {
  throw new Error('请设置至少8个字符的 BLOG_ADMIN_PASSWORD');
}
await fs.mkdir(dataDir, { recursive: true });
let db;
try {
  db = JSON.parse(await fs.readFile(dataFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  db = { posts: [], topics: [] };
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2));
}
let queue = Promise.resolve();
function save() {
  const job = queue.then(async () => {
    const temporary = `${dataFile}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(db, null, 2));
    await fs.rename(temporary, dataFile);
  });
  queue = job.catch(() => {});
  return job;
}
const sessions = new Map();

function json(res, code, data, headers = {}) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', ...headers
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20000) throw new Error('请求内容太长');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function tokenOf(req) {
  return req.headers.cookie?.match(/(?:^|; )blog_session=([^;]+)/)?.[1];
}
function isAdmin(req) {
  const token = tokenOf(req);
  const expires = sessions.get(token);
  if (!expires) return false;
  if (expires <= Date.now()) { sessions.delete(token); return false; }
  return true;
}
const digest = text => crypto.createHash('sha256')
  .update(text).digest();
function passwordMatches(value) {
  return typeof value === 'string' && value.length <= 200 &&
    crypto.timingSafeEqual(digest(value), digest(password));
}
const clean = (value, max) => typeof value === 'string'
  ? value.trim().slice(0, max) : '';

async function api(req, res, route) {
  const method = req.method;
  if (route === '/api/session' && method === 'GET') {
    return json(res, 200, { admin: isAdmin(req) });
  }
  if (route === '/api/login' && method === 'POST') {
    const input = await body(req);
    if (!passwordMatches(input.password)) {
      return json(res, 401, { error: '密码错误' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 86400000);
    return json(res, 200, { admin: true }, {
      'Set-Cookie': `blog_session=${token}; HttpOnly; SameSite=Lax; ` +
        'Path=/; Max-Age=86400'
    });
  }
  if (route === '/api/logout' && method === 'POST') {
    sessions.delete(tokenOf(req));
    return json(res, 200, { ok: true }, {
      'Set-Cookie': 'blog_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
    });
  }
  const key = route === '/api/posts' ? 'posts' :
    route === '/api/topics' ? 'topics' : null;
  if (!key) return json(res, 404, { error: '接口不存在' });
  if (method === 'GET') return json(res, 200, db[key]);
  if (method !== 'POST') return json(res, 405, { error: '请求方式不支持' });
  if (key === 'posts' && !isAdmin(req)) {
    return json(res, 401, { error: '请先登录' });
  }
  const input = await body(req);
  const title = clean(input.title, 100);
  const content = clean(input.content, 5000);
  if (!title || !content) return json(res, 400, { error: '标题正文不能为空' });
  if (key === 'posts' && !['life', 'study'].includes(input.type)) {
    return json(res, 400, { error: '分类不正确' });
  }
  const item = { id: crypto.randomUUID(), title, content,
    createdAt: new Date().toISOString() };
  if (key === 'posts') item.type = input.type;
  db[key].unshift(item);
  await save();
  return json(res, 201, item);
}

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/admin': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      return await api(req, res, url.pathname);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      return json(res, 405, { error: '请求方式不支持' });
    }
    const file = files[url.pathname];
    if (!file) return json(res, 404, { error: '页面不存在' });
    const bytes = await fs.readFile(path.join(publicDir, file[0]));
    res.writeHead(200, { 'Content-Type': file[1],
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) json(res, 400, { error: '请求失败，请检查输入' });
    else res.end();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`打开 http://localhost:${port}`);
});
