# 个人博客 Blog 从零搭建教程
详细版  从 C 基础学习网页并部署到 Docker  2026年10月17日

本教程完成一个能阅读、发布、保存和管理内容的中文个人博客。网站有首页、生活日记、学习与工作、关于我、留言角和独立 /admin 后台，使用原生 HTML、CSS、JavaScript 与 Node.js，内容存入 JSON，配图存到磁盘。你可以先跑通教学版，再读真实项目源码，最后部署独立 web 容器与域名。

## 一 先认识网页开发的四个角色

编辑器负责写文件，终端负责执行命令，Node.js 负责运行后端，浏览器负责显示网页并运行前端。Word 用来阅读本教程，不用来保存 .js 代码。C 常见流程是编辑、编译、运行；这里编辑 JavaScript 后直接由 Node 或浏览器执行，不需要 gcc。

HTML 是页面结构，例如标题、文章和按钮；CSS 决定颜色、宽度和布局；浏览器 JavaScript 监听点击、读取输入、向服务器发请求；Node.js 校验权限并写文件。两边都写 JavaScript，但浏览器不能直接操作服务器硬盘，Node 也不直接操作浏览器页面。

## 二 准备电脑与文件夹

安装支持项目的 Node.js 版本与纯文本编辑器。本次源码测试使用现有打包运行时 24.19.0，部署与测试版本要分别记录。

在编辑器选择文件 → 打开文件夹，打开 03_blog/learning/03-博客框架；再选择终端 → 新建终端。左边应该看到 package.json、server.js 和 public。文件名必须准确，app.js.txt 不能代替 app.js。根目录就是包含 package.json 的最外层文件夹。

先执行 node --version 和 npm --version，确认命令存在。Windows PowerShell 设置 BLOG_ADMIN_PASSWORD 后执行 npm start；Mac/Linux 可以在同一行设置环境变量。命令示例见附录，临时演示密码仅用于本地练习，正式部署应生成独立强密码。

## 三 第一次跑通教学框架

浏览器打开 http://localhost:3000。保持终端运行，不要关窗口；Ctrl+C 会停止网站。点生活、学习工作、关于我和留言，确认页面内容变化。再打开 /admin，用刚设置的初始密码登录，发布一篇带中文与表情的生活日记。

刷新公开页，检查文章出现；再停止、重启服务，确认文章仍在。打开 data/blog.json 能看到保存的文字，但先不要手工改生产数据。后台重启后需要重新登录，因为内容写入文件，而会话在内存里。

教学版只提供页面、登录、发布、留言与保存的基本闭环，默认只在本机学习；不具备真实项目的全部编辑、回复、搜索、裁剪、字体和动画。它没有 npm test 脚本，不能把生产项目的测试结果套在教学包上。修改 JavaScript 后应先按约定补充有意义的测试入口，或切换到配有测试的完整源码学习。

## 四 用一次发布读懂前后端

打开 index.html，找到 id 为 app 的元素。app.js 用 querySelector 找到它，再用 render 把数据绘成 HTML。state 可理解为 C 中保存当前程序状态的结构体；对象中的字段存文章、留言和登录状态。

用户点发布时，submit 处理器 preventDefault 阻止浏览器默认整页跳转；FormData 读取表单；JSON.stringify 把对象变成可发送的 JSON 文本；fetch 把 POST 请求送到 /api/posts。await 等待服务器答复后再更新页面，按钮在提交期间禁用。

server.js 接收请求，检查方法与路径，再检查 Cookie 会话。登录有效才解析文章字段、分配 ID、写入 data/blog.json，并用 201 返回结果。浏览器收到成功后重新 load，再 render。刷新仍有文章是因为下一次从服务器读取文件，而不是仅把输入贴在屏幕上。

## 五 从教学版进入真实源码

03_blog/source 是私密仓库 officaluse1.1 分支的 86f08ac，包含本地中文字体及较新的交互修复。03_blog/deployed_routing_snapshot 是本机保存的带访客分流部署副本，测试数量和 server.js 与新版不同。两套目录独立运行，不能把两个 server.js 前后拼接。

最新博客源码的本地运行仍为设置密码后 npm start，使用独立 /admin 页面；没有额外 npm 运行依赖。第一次启动复制 initialData，后续只读已有 data/blog.json。想改站名、站长资料和演示内容，先在全新练习目录修改默认配置，再通过后台编辑自己的实际内容。

## 六 网站编程的实际顺序

先确定四个栏目与首页目录，再完成 HTML 外壳和 CSS 布局，用假数据检查电脑与手机能否阅读。原项目采用奶油纸张与粉、柔红、淡紫色，五页使用本地印象派构图背景，人物插图放在不遮文字的位置。素材与第三方库许可证随源码保留；新站可换成自己的原创素材。

第二步用 Node 内置 http、fs、path 和 crypto 编写读取接口、登录、文章与资料更新。先把一篇文章从表单保存到 JSON，再扩展编辑删除和校验，避免同时写动画、后台与网络配置后无法定位问题。

第三步补全心情、学习与工作分区、按月日历、阅读计划、留言话题与回复。第四步添加全站搜索与栏目内搜索、深链接定位、头像和文章裁剪。第五步处理首页翻页、扇形导航、内页模糊切换和减少动态效果。最后回归测试，迁到独立容器，并接入 FRP、域名与校园分流。

## 七 页面与数据如何对应

生活日记由 type=life 的文章组成，按年月归档；学习工作用 type=study，并继续区分学习与工作。日期用稳定字符串或 ISO 时间保存，页面按本地日期显示；检查日期格式，不让无效日期参与日历计算。

首页“今日的天气”表示当天心情，不调用真实天气 API。最近七条心情从保存的数据筛选。阅读计划包括书名、作者、目标、进度、随记与日志；进度到 100 时写历史书库，通过 archiveId 防止同一本计划重复归档，更换计划不删除旧记录。

个人资料包括头像、简介、家乡、生日、爱好、教育阶段、经历和联系方式；链接需要限制可用协议并转义文字。每日寄语来自本地六十条完整条目，保留原文、解释与出处；不能临时编造古典引文。

留言角按话题打开弹窗，可在阅读与书写之间切换。topicDrafts 是以话题 ID 为键的 Map，切换话题不混用草稿；这是当前页面内存，不保证刷新后仍在。用户提交有明确进行中、成功或失败反馈，避免重复发送。

## 八 搜索 深链接与动画

首页搜全站，内页只搜当前栏目。结果链接带栏目与内容 ID，切页后展开、滚动到相应文章或话题。同页锚点不需要整页过渡；后台导航也不能被公开页面动画错误接管。

快速连续点击曾让旧动画在新选择后才结束，导致页面跳回旧目的地或遮罩不消失。解决方法是给每次导航分配版本，取消上一次动画，仅最新操作可以提交页面和清理状态。减少动态效果时直接提交，不创建多余动画。

局部内容变化从当前可见高度过渡，用 WeakMap 管理动画归属；中断时读取实际高度，不能从旧初始高度重新跳动。相关测试覆盖快速目录选择、扇形导航、异常恢复和 prefers-reduced-motion。不要只检查单次点击效果。

## 九 中文 字体与图片

UTF8 的一个中文字符或表情占多个字节，TCP 分块可能在中间断开。旧做法逐块转字符串再拼接会损坏字符；修复为先累计 Buffer、按字节检查上限，最后一次解码后 JSON.parse。原 006a08d 提交与跨字节请求测试记录了这一修复。

字体本地化使用可变 WOFF2 和 unicode-range，让浏览器只下载需要的字符子集。原 0bbf557 添加字体，86f08ac 修正补充字符误用同一 Latin 文件的问题。字体不统一会影响字重、换行与装饰遮挡，应同时检查中文、数字、英文和表情。

文章最多九张 PNG/JPEG/WebP、每张 2 MB；头像同类格式。Cropper.js 1.6.2 本地打包，支持缩放、旋转、重置、保留原图与多种裁剪比例，最长边不超过 1600 像素。前端限制方便用户，服务端仍要验证字节标识、大小和合法路径。

移除文章中的图片引用不会自动删除磁盘文件。备份需要同时保存 JSON 和 uploads；清理孤儿图片应单独设计扫描与确认，不能在更新代码时顺手清空上传目录。

## 十 登录与文件保存

初始密码通过 BLOG_ADMIN_PASSWORD 注入。服务端随机生成会话令牌，Cookie 使用 HttpOnly、SameSite=Lax；正式 HTTPS 可开启 Secure。隐藏管理入口仅减少公开导航，真正的写权限由服务端验证，访客不能靠伪造按钮获得权限。

改密要校验旧密码与两次新密码，新密码 8–200 字符，用随机盐与 scrypt 保存哈希，文件权限 600，撤销全部会话。data/admin-auth.json 优先于初始环境密码，所以修改 .env 不会覆盖已改过的后台密码。重置时先停服务、备份并移走哈希文件，再设置新初始密码。

保存通过 Promise 队列串行写临时文件，再 rename 替换 JSON，减少同时写文件和半写内容。这适合单实例轻量博客，不支持多个 Node 进程随意共享同一 JSON 写入。队列失败后的恢复、跨进程锁与高并发扩展需要进一步设计。

页面用 esc 转义不可信文字，限制请求体、频率、字段长度与链接；静态服务不暴露 data、.env 或任意路径。反向代理相关开关只在可信代理配置正确时启用，不能因为 FRP 存在就盲目信任所有 X-Real-IP。

## 十一 部署独立博客容器

原博客最初运行在 claude-code .102，后续迁出，恢复 Claude 原镜像与 sleep infinity。最终博客独立为 web .101:3000，宿主机 /srv/web，app 只读挂载，data 与 uploads 单独可写。旧 .102:3000 与 .2:3000 不再是当前入口。

新环境可以使用随包 deployment/Dockerfile.portable 与 compose.portable.yaml，它们基于官方 Node 镜像，不依赖历史 runtime-rootfs.tar；原机器 deployment_reference 的 Dockerfile 用于重建旧精简镜像，必须同时有原归档，不能在新机缺文件时照抄。

在 Debian 创建 /srv/web/app、data、uploads，把要使用的源码复制到 app。初次创建 .env 写初始密码；数据和 uploads 给容器 UID 1000 写权限，环境文件 600。用官方 Node 镜像的首次构建需要联网拉取，并应在当次部署确认软件与镜像清单。

先 docker compose config，启动后检查 health 与本机 API，再从另一台 LAN 电脑打开 .101:3000 和 /admin。精简容器可能没有 bash，使用 Node JSON CMD 健康检查。重建和重启后确认文章、图片与改密记录都保留。

03_blog/source 的新版没有部署分流模块。若需要分流，先在独立副本移植 visitor-routing.js、启动时配置加载和对应测试，再 npm test，不能直接覆盖成旧部署副本而丢掉新版修复。分流副本的独立目录可先用于复现旧链路。

## 十二 FRP 域名与校园分流

网络教程完成 FRP 后，主域名 CNAME 指日本节点、cn 子域名指大陆节点；公网 443 或 40475 最终都回到 .101:3000。域名解析只找到节点，不会替你启动 Node、开放端口或签证书。

项目自动分流只对首页 / 与 /index.html 的 GET/HEAD 生效。已确认校园出口优先跳到校园入口，其他大陆 CN 地址跳 cn，其他地区保留主域名。用 302 与 private,no-store，防止浏览器跨网络后仍缓存旧入口；后台、API、静态资源和写请求维持原入口。

来源判断只信任 .3 提供的 X-Forwarded-For 末尾真实地址，不接受访客前面自行填写的 IP。CN 地址表来自 APNIC 分配数据，是地址归属判断，不是精确地理定位；VPN 或代理开启时只看到出口。aTrust 连接后公网出口不变的场景，无法仅凭 IP 判断 VPN 是否连接。

特别注意旧部署快照 campusTarget 为 172.20.131.2:8080，最新 WAN 记录已变 172.20.132.189。新配置应使用当次地址并重新验证；不能把“文档已更新入口”误认为生产 routing.json 已经改好。域名进入校园 HTTP 的公开首页允许与否要由使用场景决定，后台登录继续使用可信 HTTPS。

## 十三 出错时怎样检查

node 找不到：确认安装后重新打开终端。找不到 package.json：检查当前目录。SyntaxError：看文件名和行号，常见为漏引号、括号或逗号。EADDRINUSE：端口被旧进程占用，先关闭自己之前的服务。

页面有外壳但空白：打开浏览器开发者工具，看脚本加载和控制台。发布返回 401：重新登录。登录后 Cookie 不保留：检查是否在 HTTP 错开 Secure。图片上传失败：检查格式、字节与目录权限。重启数据消失：核对卷映射是否指向新的空目录。

域名失败但内网正常：按 DNS → FRP 在线 → 本地目标 → TLS 主机名 → 跳转 Location 排查。保存执行目录、完整错误文字与发生步骤，清除真实密码与令牌后再分享。

## 十四 测试与实际记录

这次对 86f08ac 源码重新执行 npm test，27/28 通过；带分流部署副本为 31/32 通过。两者失败均为 Windows 报告文件模式 0666，而测试要求 Linux 的 0600；失败位置为 test/server.test.js 的密码文件权限断言。不能把这次 Windows 测试说成全部通过，也不能删断言掩盖差异。

提供文档记载新版在原环境 28 项通过，部署记录记载分流副本在 Linux Node 镜像中 32 项通过。这些是历史结果。本次还会记录当前副本的测试状态，源码版本、环境和时间应一起看。发布前在目标 Linux 环境重新运行测试并确认文件权限。

## 附录一 初次运行命令

Windows PowerShell 在教学框架或完整项目目录执行，密码用自己的临时练习值。若 npm.ps1 被执行策略拦截，可用 npm.cmd，不必为了教程降低整个电脑的策略。
```powershell
node --version
npm.cmd --version
$env:BLOG_ADMIN_PASSWORD='change-this-local-demo-password'
npm.cmd start
```

Mac 或 Linux 终端，勿与 PowerShell 写法混用。完整项目才包含 npm test。
```sh
BLOG_ADMIN_PASSWORD='change-this-local-demo-password' npm start
npm test
```

## 附录二 教学框架完整代码

下面五个文件与 learning/03-博客框架一致，按标题分别保存。同一文件中的代码连续复制，不能把代码写进 Word 再另存为 .js。教学版用于本地理解闭环，正式站点使用 source 下的完整项目。

### package json 项目入口
```
{
  "name": "my-notebook",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "engines": { "node": ">=20" }
}
```

### index html 页面容器
```
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>我的记事簿</title>
  <link rel="stylesheet" href="/style.css">
  <script defer src="/app.js"></script>
</head>
<body>
  <header>
    <h1>我的记事簿</h1>
    <nav aria-label="栏目">
      <a href="#home">首页</a>
      <a href="#life">生活</a>
      <a href="#study">学习工作</a>
      <a href="#about">关于我</a>
      <a href="#talk">留言</a>
    </nav>
  </header>
  <p id="status" role="status"></p>
  <main id="app"></main>
</body>
</html>
```

### style css 页面排版
```
* { box-sizing: border-box; }
body {
  margin: 0; background: #f4e9ee; color: #4b3545;
  font-family: system-ui, sans-serif; line-height: 1.7;
}
header, main, #status {
  width: min(920px, 92%); margin: 24px auto;
}
nav { display: flex; gap: 18px; flex-wrap: wrap; }
a { color: #895276; }
article, form, .paper {
  background: #fffaf5; border: 1px solid #ddc8d5;
  padding: 20px; margin: 16px 0; border-radius: 8px;
}
h1, h2 { line-height: 1.35; }
p, h2 { overflow-wrap: anywhere; }
article p { white-space: pre-wrap; }
label { display: block; margin: 12px 0; }
input, textarea, select, button { font: inherit; }
input, textarea, select {
  display: block; width: 100%; padding: 8px;
  border: 1px solid #c9a9be; background: white;
}
textarea { min-height: 130px; }
button {
  padding: 8px 18px; border: 0; color: white;
  background: #895276; cursor: pointer;
}
button:disabled { opacity: .6; cursor: wait; }
@media (max-width: 600px) {
  header, main, #status { width: 94%; }
  article, form { padding: 14px; }
}
```

### app js 浏览器交互
```
const app = document.querySelector('#app');
const status = document.querySelector('#status');
const adminPage = location.pathname === '/admin';
const state = { posts: [], topics: [], admin: false };
const names = { home: '首页', life: '生活日记',
  study: '学习与工作', about: '关于我', talk: '留言角' };
const esc = value => String(value ?? '').replace(
  /[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;',
    '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options, headers: { 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
async function load() {
  const [posts, topics, session] = await Promise.all([
    request('/api/posts'), request('/api/topics'),
    request('/api/session')
  ]);
  Object.assign(state, { posts, topics, admin: session.admin });
  render();
}
function cards(items) {
  return items.map(item => `<article>
    <h2>${esc(item.title)}</h2>
    <p>${esc(item.content)}</p>
    <small>${esc(item.createdAt)}</small>
  </article>`).join('') || '<p>还没有记录。</p>';
}

function editor(talk = false) {
  return `<form id="write-form" data-talk="${talk}">
    ${talk ? '' : `<label>分类<select name="type">
      <option value="life">生活</option>
      <option value="study">学习工作</option></select></label>`}
    <label>标题<input name="title" maxlength="100" required></label>
    <label>正文<textarea name="content"
      maxlength="5000" required></textarea></label>
    <button type="submit">发布</button></form>`;
}
function render() {
  const key = location.hash.slice(1).split('?')[0] || 'home';
  const page = Object.hasOwn(names, key) ? key : 'home';
  document.title = `${names[page]} | 我的记事簿`;
  if (adminPage && !state.admin) {
    app.innerHTML = `<h2>站长登录</h2><form id="login-form">
      <label>密码<input name="password" type="password"
        autocomplete="current-password" required></label>
      <button type="submit">登录</button></form>`;
    return;
  }
  let content;
  if (page === 'about') {
    content = '<section class="paper"><h2>关于我</h2>' +
      '<p>你好，我是土豆，正在学习搭建个人博客。</p></section>';
  } else if (page === 'talk') {
    content = editor(true) + cards(state.topics);
  } else {
    const list = page === 'home' ? state.posts :
      state.posts.filter(item => item.type === page);
    content = (adminPage ? editor() : '') + cards(list);
  }
  app.innerHTML = `<h2>${names[page]}</h2>` +
    (adminPage ? '<button id="logout">退出登录</button>' : '') +
    content;
}

app.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button');
  const input = Object.fromEntries(new FormData(form));
  const login = form.id === 'login-form';
  const talk = form.dataset.talk === 'true';
  const url = login ? '/api/login' :
    talk ? '/api/topics' : '/api/posts';
  button.disabled = true;
  status.textContent = '正在提交，请稍候……';
  try {
    await request(url, { method: 'POST', body: JSON.stringify(input) });
    form.reset();
    await load();
    status.textContent = login ? '登录成功。' : '发布成功。';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
app.addEventListener('click', async event => {
  if (event.target.id !== 'logout') return;
  try {
    await request('/api/logout', { method: 'POST', body: '{}' });
    await load();
    status.textContent = '已退出登录。';
  } catch (error) { status.textContent = error.message; }
});
window.addEventListener('hashchange', () => {
  status.textContent = '';
  render();
});
load().catch(error => { status.textContent = error.message; });
```

### server js 服务与持久化
```
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
```

## 附录三 真实项目关键实现

Buffer 请求解析节选，来自 86f08ac 的 server.js。这里统计字节而非 JavaScript 字符长度，再统一解码。
```
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
```

原子保存与阅读归档，writeQueue 串行保存，archiveId 避免重复历史。完整源码还包括旧数据迁移和日志。
```
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
```

动画版本节选，先取消旧动画，再检查版本是否仍是最新。完整 paperTransition 见 app.js 对应函数，不能只复制节选替换整个前端。
```
async function paperTransition(commit, label, reverse = false, enabled = true) {
  const version = ++paperVersion;
  paperAnimation?.cancel();
  blurNavigationAnimation?.cancel();
  document.body.classList.remove('page-blur-transition');
  clearFanPreview();
  const layer = document.querySelector('#paper-transition');
  layer.hidden = true;
  if (!enabled || motionReduced() || !layer.animate) { commit(); return; }
  layer.querySelector('.turn-title').textContent = label;
  layer.classList.toggle('is-reverse', reverse);
  layer.hidden = false;
  const sheet = layer.querySelector('.turn-sheet');
  const narrow = window.matchMedia('(max-width: 700px)').matches;
  const angle = reverse ? 105 : -105;
  let committed = false;
  try {
    // Cover the old view before changing its contents and scroll position.
    paperAnimation = layer.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out', fill: 'both' });
    await paperAnimation.finished;
    if (version !== paperVersion) return;
    paperAnimation.cancel();
    commit();
    committed = true;
    paperAnimation = sheet.animate([
      { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
      { transform: `rotateY(${angle * .6}deg)`, filter: 'brightness(.87)', offset: .62 },
      { transform: `rotateY(${angle}deg)`, filter: 'brightness(.98)' }
    ], { duration: narrow ? 340 : 460, easing: 'cubic-bezier(.3,.05,.2,1)', fill: 'forwards' });
    await paperAnimation.finished;
  } catch (error) {
    // A newer navigation owns the screen; never commit an outdated route.
    if (version === paperVersion && !committed) commit();
  } finally {
    if (version === paperVersion) {
      paperAnimation?.cancel();
      layer.hidden = true;
    }
  }
}
let chapterNavigatePending = '';
```

## 附录四 新机器 Docker 配置

本教程配套新机配置 deployment/compose.portable.yaml 将 app、data、uploads 分离，使用现有 proxy_lan。它是复现模板，不声称已替线上服务器部署。先复制 .env.example 为 .env 并私下设密码。
```
name: web
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.portable
      args:
        NODE_BASE: "node:24-alpine"
    image: local/j1900-blog:repro
    container_name: web
    user: "1000:1000"
    init: true
    restart: unless-stopped
    env_file: .env
    dns: ["10.42.0.3"]
    networks:
      proxy_lan:
        ipv4_address: "10.42.0.101"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/public/assets/uploads
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/session').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
networks:
  proxy_lan:
    external: true
    name: "proxy_lan"
```

在 Debian 的部署目录执行。停机备份可获得单实例文件的一致快照；备份包含 .env 与密码哈希，权限 600，不能上传 GitHub。
```sh
sudo docker compose -f compose.portable.yaml config
sudo docker compose -f compose.portable.yaml up -d --build --wait
sudo docker compose -f compose.portable.yaml ps
sudo docker logs --tail 30 web
sudo docker exec web node --test
```

完整项目 data 与 uploads 应在首次启动前创建并由 UID 1000 可写；镜像构建复制了源代码与测试，Linux 中可执行 node --test。正式升级先备份，再更新 app 并重建镜像。

## 附录五 来源与进一步学习

正文结合提供的两份 Word、教学源码 ZIP、建站说明、本机部署文件、私密 blog 仓库 officaluse1.1 与相关会话。建站说明中的要求是参考需求，未据此直接执行外部部署；版本差异在源码目录和 snapshot.json 中记录。

工具文档：Node.js https://nodejs.org/en/learn；VS Code 终端 https://code.visualstudio.com/docs/terminal/basics；Cropper.js https://github.com/fengyuanchen/cropperjs；Docker https://docs.docker.com/engine/install/debian/；SakuraFrp https://doc.natfrp.com/frpc/manual。学习时先掌握请求、鉴权、保存、返回这个闭环，再扩展视觉和动画。


## 友链随机排序与本站资料更新 2026年10月19日

友链花园每次进入或重新渲染时，使用 Fisher–Yates 算法随机排列已发布友链，并提供“换个顺序”按钮。只打乱副本，不修改数据库数组；待审核记录保留原顺序且继续仅管理员可见。零条或一条友链时无需换序，按钮禁用；随机排列可能得到与上次相同的顺序。

本站交换资料已更新为以下四个字段，展示用户指定的头像和简介，固定使用公开 HTTPS 地址。即使从局域网或校园网入口访问，也不会把当前入口地址误写成交换资料。页面提供完整 YAML 和“复制友链资料”按钮；剪贴板不可用时选中文本，方便手动复制。

```yaml
- name: 土豆的记事簿
  link: https://20080618.xyz/
  avatar: https://20080618.xyz/assets/uploads/a0fe7f5d-a4e6-4176-8cd3-97a2a808899c.webp
  descr: 一颗与世无争的小土豆
```

修改 JavaScript 后已运行 npm test。Windows 仍只有原有的 Unix 0600 文件权限断言失败；Debian Node.js 24.22.0 隔离容器内，较新源码 38/38、带分流部署版 42/42 全部通过。新增测试覆盖排列完整性、不改原数据、待审隐私、资料逐字一致，以及剪贴板成功与降级。桌面和 390 像素手机布局、四条隔离友链换序、按钮焦点、资料复制及头像加载均已验证。

2026年10月19日已备份并更新独立 web 容器，服务重启健康。备份为 /srv/web/backups/blog-random-20261019-002707.tar.gz，权限 600。文章与资料 JSON 字节、上传图片、密码记录及 routing.json 校验一致；线上公开友链仍为原有一条，没有加入测试站点。仅更新前端文件和测试，无新增依赖。


## 洛谷刷题与 GitHub 提交统计更新 2026年10月19日

学习内容新增洛谷刷题热力图，工作内容新增 GitHub 提交热力图。两者支持切换年份、点击日期查看记录和键盘方向键导航，沿用小站手帐配色。390 像素手机页面无横向溢出，热力图在卡片内独立滚动，并把当前日期滚入可视区域。

洛谷账号为 potatatoking，UID 2359012。本次读取到 P1914 小书童——凯撒密码、P5015 标题统计、P5733 自动修正，三道题的通过日期均为北京时间 2026年10月19日。题目记录展示日期、题号、题名与原始通过记录链接；同一题重复通过只计一次，取可读取历史中的最早日期。未知日期单列，不补造日期或点亮热力图，不读取提交源码。

GitHub 使用 potatatoking，公开与私密分别显示热力图和累计提交数。统计本人拥有且凭据可读取的仓库，遍历所有分支，同仓库相同 SHA 去重，只计 GitHub 可归属到本账号的作者。按提交作者时间换算北京时间，不混入 Issues 或 PR。初次读取为公开 0 次、私密 8 次；另有 24 条无法关联账号的历史提交，未计入个人提交。后续维护提交会在同步后增加。

服务每小时自动同步，也允许已登录管理员手动同步；并发请求合并，访客请求只读缓存。上游失败时保留上次成功结果和更新时间，页面提示同步未完成，避免把失败误显示为零。缓存以原子替换写入，配置修改后需重启服务。

经用户授权，GitHub 只读令牌和洛谷登录凭据保存在服务器 data/activity-settings.json，权限为 600，属主为容器用户 1000。GitHub 令牌仅开放 Contents 和 Metadata 读取权限，有效期至 2026年11月18日。凭据不进入源码、Word、Prompt、日志、浏览器端或公开接口；私密仓库仅公开日期和数量，不公开仓库名、路径、SHA 或提交说明。凭据失效后需要重新授权并更新私有配置。

修改 JavaScript 后已运行 npm test。Windows 源码 48/49、带分流版 52/53，失败仅为原有 Unix 0600 权限在 Windows 的断言差异；Debian Node.js 24.22.0 隔离容器中源码 49/49、带分流版 53/53 全部通过。新增测试覆盖跨分支去重、公开私密分组、凭据身份匹配、当前洛谷接口与旧版结构、题目去重、日期未知、失败保留缓存、接口鉴权和私密字段过滤。

已部署独立 web 容器并验证 HTTPS 页面与活动接口。备份为 /srv/web/backups/blog-activity-20261019-132741.tar.gz，权限 600；文章与资料、管理员密码记录、上传图片和 routing.json 校验保持一致。回退时保留最新内容，优先恢复 app；活动缓存与私有配置按需要恢复，禁止覆盖后续文章或上传文件。没有新增依赖。


## 学习工作分页面与项目管理更新 2026年10月19日

学习与工作现已拆成两个独立页面，分别支持 /study、/work 和原有哈希导航。学习页保留洛谷刷题记录、阅读计划、历史书库与学习归档；工作页保留 GitHub 公开及私密热力图、工作归档，并新增项目区域。首页目录、最新动态、随机翻页、扇形导航和管理员导航均按两个页面重新适配。

工作页的我的项目采用浮动气泡展示，分为进行中的项目和已完成的项目。按用户要求，生产列表先留空，未导入测试项目。管理员在 /admin#work 添加名称、状态、可选简介和链接；点击气泡查看详情，可编辑、删除，或在进行中和已完成之间切换。状态切换后自动归类，保留原创建时间；数据保存后可跨服务重启使用。

搜索按页面区分：学习页检索学习记录、书籍和洛谷已解题，工作页检索工作记录、项目与 GitHub 日期统计，首页仍可跨栏目检索。搜索结果定位到对应归档、热力图日期或项目详情。旧的学习与工作链接可继续定位工作记录，发布或编辑记录时更改学习工作分类会自动跳转到归属页面。

项目数据使用 /api/projects 接口，访客只读，新增编辑删除均要求管理员登录。只接受进行中和已完成两种状态，项目链接限定 HTTP 或 HTTPS，禁止内嵌账号密码，保留有效的页面锚点。名称与简介显示时转义，项目数上限为 60。浮动动效尊重减少动态效果设置，气泡可通过键盘打开；手机使用两列气泡布局。

修改 JavaScript 后已运行 npm test。Debian Node.js 24.22.0 隔离环境中，源码 54/54、带分流版 58/58 全部通过。Windows 分别为 53/54、57/58，失败仍仅为原有 Unix 0600 权限断言差异。新增与扩展测试覆盖权限、状态切换、持久化、链接校验、学习工作隔离、旧链接、项目搜索、文本转义、跨分类保存和六个目录入口的页面过渡。

已备份并部署独立 web 容器，备份为 /srv/web/backups/blog-pages-20261019-213753.tar.gz，权限 600。HTTPS 学习页、工作页、后台和空项目接口均已检查返回 200；访客写入返回 401。文章资料 JSON、上传图片、管理员密码记录、活动读取凭据、活动采集模块及 routing.json 的校验保持一致。未新增依赖。本次浏览器连接等待 Chrome 远程调试允许，因此尚未完成浏览器视觉验收；不把单元测试或 HTTP 检查描述为浏览器验收。


## 项目列表 个人文章与扇形导航更新 2026年10月19日

学习和工作继续使用独立页面。工作页的项目气泡已按最新要求替换为手帐式列表，分为进行中的项目和已完成的项目。桌面两组并排，手机上下排列；每行展示编号、名称、简介与详情入口，空列表紧凑呈现；项目简介不限字数。移除气泡和漂浮动画，按创建时间从新到旧排列。管理员仍可新增、编辑、删除和切换项目状态。生产项目先留空，供站长后续添加。

新增独立的个人文章页面 /articles 和 #articles，用来发表自己的想法、随笔和感悟。首页目录下方新增文章入口，最近碎片和随机翻页也能打开文章；扇形导航加入文章，后台新增文章管理。列表按发表日期倒序，显示日期、标签、标题和摘要，点击阅读全文进入独立阅读视图，可返回列表。站长登录 /admin#articles 后发表、编辑或删除文章，正文保留段落，支持现有图片上传与完整展示，编辑保留原发表日期并显示更新日期。

个人文章沿用受管理员权限保护的 /api/posts，类型为 article，保存到原博客 JSON，不迁移或改写原有文章。标题上限 100 字、正文 5000 字、标签 30 字，配图沿用现有校验。访客只读，正文和标签均转义显示。个人文章独立搜索，首页可跨栏目检索；学习和工作页不会混入随笔。项目搜索仍打开对应详情，旧学习工作链接继续兼容。

扇形导航拖动改为沿圆弧连续跟手，按浏览器绘制帧合并高频输入；手指停在栏目边界附近时保留小范围缓冲，减少预览反复跳动。预览等待短暂停留后轻柔切换，松开后用 170 毫秒缓出吸附到最近栏目，再进入页面。拖动取消或丢失捕获时恢复原选择，不误跳页；释放后的合成点击被抑制。鼠标、手机触摸、键盘和减少动态效果设置均兼容。

修改 JavaScript 后已运行 npm test。Debian Node.js 24.22.0 中源码 60/60、带分流版 64/64 全部通过；Windows 为 59/60、63/64，唯一失败仍是原有 Unix 文件 0600 权限断言差异。新增验证覆盖文章权限、保存、编辑日期、删除、直接路由、独立搜索与转义，以及扇子连续角度、帧合并、边界抖动、吸附后单次跳转、取消拖动和减少动态效果。未新增依赖。

已通过 Chrome 浏览器检查项目桌面与手机布局、详情和状态切换，以及个人文章发布、阅读全文、编辑与日期展示、首页入口和搜索归属。390 与 320 像素视口无横向溢出；鼠标和触摸拖动均能连续移动扇坠并在释放后进入目标栏目。测试内容仅保存在本地验收环境，生产未加入示例项目或代写文章。

发布前已备份程序、数据和上传目录，文章部署备份为 /srv/web/backups/blog-project-list-20261019-223728.tar.gz，后续扇子更新另有独立备份记录。保留原博客资料、管理员密码记录、活动读取凭据、活动采集模块、图片和网络分流配置。同步更新三个 GitHub 仓库的日志、README、Word、Markdown 和 Prompt；具体文件校验与验收结果见 evidence 记录。


## 项目简介取消长度限制 2026年10月19日

项目简介现已取消字数限制。后台输入框移除 600 字上限，新增和编辑接口不再截断简介，并解除项目写入原有的 20,000 字节请求上限；管理员身份检查仍先于请求解析，其余接口保持原有规则。保留换行、表情和完整内容，列表摘要维持原排版，详情可阅读全文。

已用包含中文、换行和表情的 12,006 字符简介在本地浏览器完成输入、保存与详情读取，末尾内容保持完整，390 像素视口无横向溢出。回归测试覆盖超过原字节上限的新增、继续编辑和服务重启后的完整读取。修改 JavaScript 后运行 npm test；Debian 源码 60/60、带分流版 64/64 通过，Windows 唯一失败仍为既有 Unix 0600 权限断言差异。未新增依赖。

已备份并部署，备份为 /srv/web/backups/blog-description-20261019-230406.tar.gz。原有文章与项目数据、管理员密码、活动读取凭据、活动采集模块、上传文件及分流配置校验一致。
