const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const toastNode = document.querySelector('#toast');
const filePreview = location.protocol === 'file:';
const state = { posts: [], topics: [], profile: null, admin: false, loginEnabled: false, searchQuery: '' };
const previewData = {
  profile: {
    name: '小樱', handle: 'sakura.notes', intro: '在日常里收集闪闪发光的小事 ✨',
    bio: '你好呀！这里是我的个人小站。喜欢动漫、甜点、散步和记录生活，也在努力学习新知识。愿我们都能在自己的故事里闪闪发光。',
    location: '中国 · 某个有樱花的角落', interests: '动漫 / 摄影 / 阅读 / 编程', email: ''
  },
  posts: [
    { id: 'preview-life', type: 'life', title: '把今天装进粉色的口袋里', content: '下午的阳光刚刚好，路过花店时买了一束小小的雏菊。原来平凡的一天，也可以很可爱。', tag: '日常碎片', createdAt: '2026-10-08T12:00:00.000Z' },
    { id: 'preview-study', type: 'study', title: '最近在学：把想法做成网页', content: '从布局、颜色到交互，每一个小细节都很有趣。希望以后能把更多想法变成真正能打开的网站。', tag: '学习笔记', createdAt: '2026-10-07T10:00:00.000Z' }
  ],
  topics: [{ id: 'preview-welcome', author: '小樱', title: '欢迎来到留言角！', content: '可以聊聊最近喜欢的动漫、学习心得，或者分享今天遇见的小确幸。', createdAt: '2026-10-01T10:00:00.000Z', replies: [] }]
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = value => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
const dateKey = value => new Date(value).toLocaleDateString('sv-SE');
function searchItems() {
  const items = state.posts.map(post => ({ page: post.type, id: `post-${post.id}`, category: post.type === 'life' ? '生活日记' : '学习与工作', title: post.title, detail: post.content, words: [post.title, post.content, post.tag, date(post.createdAt)].join(' ') }));
  for (const topic of state.topics) {
    items.push({ page: 'talk', id: `topic-${topic.id}`, category: '留言角', title: topic.title, detail: `${topic.author} · ${topic.content}`, words: [topic.title, topic.author, topic.content, date(topic.createdAt)].join(' ') });
    for (const reply of topic.replies) items.push({ page: 'talk', id: `topic-${topic.id}`, category: '留言回复', title: `${reply.author} 回复了「${topic.title}」`, detail: reply.content, words: [reply.author, reply.content, topic.title, date(reply.createdAt)].join(' ') });
  }
  const profile = state.profile;
  items.push({ page: 'about', id: 'profile', category: '关于我', title: profile.name, detail: profile.intro, words: [profile.name, profile.handle, profile.intro, profile.bio, profile.location, profile.interests, profile.email].join(' ') });
  return items;
}
function searchResults(query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return '';
  const page = route();
  const found = searchItems().filter(item => (page === 'home' || item.page === page) && item.words.toLocaleLowerCase().includes(term));
  return `<div class="search-summary">找到 ${found.length} 条相关内容</div>${found.length ? found.map(item => `<a class="search-result" href="#${item.page}?item=${encodeURIComponent(item.id)}"><span>${esc(item.category)}</span><strong>${esc(item.title)}</strong><small>${esc(item.detail.slice(0, 90))}</small></a>`).join('') : '<p class="search-empty">没有找到相关内容，换个关键词试试吧。</p>'}`;
}
function searchPanel() {
  const page = route();
  const scope = { home: ['检索小站内容', '搜索动态、个人资料和留言…'], life: ['检索生活日记', '搜索生活日记…'], study: ['检索学习与工作', '搜索学习与工作动态…'], about: ['检索关于我', '搜索个人资料…'], talk: ['检索留言角', '搜索留言和回复…'] }[page];
  return `<section class="search-panel" aria-label="${scope[0]}"><label for="site-search">${scope[0]}</label><div class="search-field"><span aria-hidden="true">⌕</span><input id="site-search" type="search" placeholder="${scope[1]}" value="${esc(state.searchQuery)}" autocomplete="off"></div><div class="search-results" id="search-results" aria-live="polite">${searchResults(state.searchQuery)}</div></section>`;
}
function focusHashTarget() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
  if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}
let toastTimer;
function toast(message) { toastNode.textContent = message; toastNode.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3200); }
async function request(url, options = {}) {
  if (filePreview) throw new Error('当前是文件预览。请运行 npm start，再打开 http://localhost:3000 使用发布和留言功能。');
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}
async function load() {
  if (filePreview) { Object.assign(state, previewData); render(); return; }
  try {
    const [posts, topics, profile, session] = await Promise.all([request('/api/posts'), request('/api/topics'), request('/api/profile'), request('/api/session')]);
    Object.assign(state, { posts, topics, profile, admin: session.admin, loginEnabled: session.loginEnabled });
    render();
  } catch (error) { app.innerHTML = `<div class="container empty"><span class="emoji">☁️</span>暂时无法加载小站：${esc(error.message)}</div>`; }
}
function route() { const name = location.hash.replace('#', '').split('?')[0]; return ['home','life','study','about','talk'].includes(name) ? name : 'home'; }
function render() {
  if (!state.profile) return;
  const page = route();
  document.body.classList.toggle('is-entry', page === 'home');
  document.body.dataset.page = page;
  const siteName = `${state.profile.name || '我的'}的手帐`;
  document.querySelector('#brand-name').textContent = siteName;
  document.querySelector('#footer-brand').textContent = `♥ ${siteName}`;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page));
  document.querySelector('#login-button').textContent = state.admin ? '♥' : '♡';
  app.innerHTML = ({ home, life: () => postsPage('life'), study: () => postsPage('study'), about, talk })[page]();
  document.title = `${({home:'首页',life:'生活日记',study:'学习与工作',about:'关于我',talk:'留言角'})[page]} | ${siteName}`;
  focusHashTarget();
}
function sectionHead(title, subtitle, link, label) { return `<div class="section-head"><div><div class="eyebrow">✦ ${esc(subtitle)}</div><h2>${esc(title)}</h2></div>${link ? `<a href="#${link}">${esc(label)} →</a>` : ''}</div>`; }
function home() {
  return `<section class="entry-page" aria-label="选择分类"><nav class="entry-buttons" aria-label="博客分类">
    <a class="entry-button entry-life entry-with-character" href="#life"><span class="button-character" aria-hidden="true"><span class="character-bubble">一起收集今天的小确幸 ♡</span><img src="./assets/rin-button.png" width="1415" height="1111" alt="" draggable="false"></span><span class="entry-icon" aria-hidden="true">🌷</span><span class="entry-name">生活日记</span><span class="entry-arrow" aria-hidden="true">↗</span></a>
    <a class="entry-button entry-study" href="#study"><span class="entry-icon" aria-hidden="true">📖</span><span class="entry-name">学习 & 工作</span><span class="entry-arrow" aria-hidden="true">↗</span></a>
    <a class="entry-button entry-about" href="#about"><span class="entry-icon" aria-hidden="true">🎀</span><span class="entry-name">关于我</span><span class="entry-arrow" aria-hidden="true">↗</span></a>
    <a class="entry-button entry-talk" href="#talk"><span class="entry-icon" aria-hidden="true">💌</span><span class="entry-name">留言角</span><span class="entry-arrow" aria-hidden="true">↗</span></a>
  </nav><div class="entry-search">${searchPanel()}</div><img class="entry-art" src="./assets/rin-saber-chibi.png" alt="" aria-hidden="true"></section>`;
}
function pageHead(eyebrow, title, desc, action = '') { return `<div class="page-head"><div class="page-head-copy"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p>${action ? `<div class="page-head-action">${action}</div>` : ''}</div><img class="page-head-art" src="./assets/rin-saber-chibi.png" alt="" aria-hidden="true"></div>`; }
function postsPage(type) {
  const life = type === 'life';
  const posts = state.posts.filter(post => post.type === type);
  const action = state.admin ? `<button class="btn tiny" data-action="new-post" data-type="${type}">＋ 写一篇动态</button>` : '';
  const cards = posts.length ? posts.map(post => `<article id="post-${esc(post.id)}" class="post-card paper-card"><div class="post-top"><span class="tag">${esc(post.tag || (life ? '生活日记' : '成长笔记'))}</span><time class="date">${date(post.createdAt)}</time></div><h2>${esc(post.title)}</h2><p>${esc(post.content)}</p><div class="post-foot"><span>${post.updatedAt ? `✎ 编辑于 ${date(post.updatedAt)}` : '♥ 写给今天的自己'}</span>${state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑</button><button class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除</button></span>` : '<span>✦</span>'}</div></article>`).join('') : '<div class="paper-card empty"><span class="emoji">✿</span>这里还没有动态，敬请期待。</div>';
  return `<div class="container page page-${type}">${pageHead(life ? 'MY LITTLE DAYS' : 'GROWING NOTES', life ? '生活日记 🌷' : '学习 & 工作 📖', life ? '把日常里的甜和暖，都悄悄收藏起来。' : '一点点努力，也会汇成闪亮的星河。', action)}${searchPanel()}<div class="posts-layout"><div class="post-list">${cards}</div><aside class="side-note paper-card"><div class="emoji">${life ? '🍓' : '✏️'}</div><h3>${life ? '生活收集簿' : '成长备忘录'}</h3><p>${life ? '认真记录那些值得开心的小事。' : '今天也朝着喜欢的方向前进一点点。'}</p><ul><li>${life ? '散步时碰见的花' : '正在读的书'}</li><li>${life ? '甜点与咖啡香' : '学到的新知识'}</li><li>${life ? '喜欢的番剧片段' : '完成的小目标'}</li></ul></aside></div></div>`;
}
function about() {
  const p = state.profile;
  return `<div class="container page">${pageHead('NICE TO MEET YOU', '关于我 🎀', '你好呀，很高兴在这里与你相遇。', state.admin ? '<button class="btn tiny" data-action="edit-profile">✎ 编辑资料</button>' : '')}${searchPanel()}<div class="about-layout"><aside id="profile" class="profile-card paper-card"><div class="avatar">🌸</div><h2>${esc(p.name)}</h2><div class="handle">@${esc(p.handle)}</div><p>${esc(p.intro)}</p><div class="divider"></div><div class="meta"><div><span>📍 坐标</span>${esc(p.location)}</div><div><span>💗 喜欢</span>${esc(p.interests)}</div>${p.email ? `<div><span>✉️ 邮箱</span><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}</div></aside><div class="about-content paper-card"><div class="eyebrow">A LETTER FROM ME</div><h2>写给来到这里的你 ♡</h2><p>${esc(p.bio)}</p><div class="quote">“愿每个普通的日子，都有值得珍藏的小小光亮。”</div><img class="about-mascot" src="./assets/rin-saber-chibi.png" alt="远坂凛和 Saber 的 Q 版人物"></div></div></div>`;
}
function talk() {
  const groups = new Map();
  for (const topic of state.topics.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = dateKey(topic.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(topic);
  }
  const topics = groups.size ? Array.from(groups, ([key, items]) => `<section class="date-group" aria-label="${date(items[0].createdAt)}的留言"><h2 class="date-group-title"><span>✦ ${date(items[0].createdAt)}</span><small>${items.length} 条留言</small></h2>${items.map(topic => `<article id="topic-${esc(topic.id)}" class="topic paper-card"><h3>${esc(topic.title)}</h3><p>${esc(topic.content)}</p><div class="topic-meta"><strong>✿ ${esc(topic.author)}</strong><time>${date(topic.createdAt)}</time><span>♡ ${topic.replies.length} 条回复</span>${topic.updatedAt ? '<span>已编辑</span>' : ''}${state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-topic" data-id="${esc(topic.id)}">编辑</button><button class="quiet-button" data-action="delete-topic" data-id="${esc(topic.id)}">删除</button></span>` : ''}</div>${topic.replies.length ? `<div class="reply-list">${topic.replies.map(reply => `<div class="reply"><strong>${esc(reply.author)}</strong><time>${date(reply.createdAt)}</time><p>${esc(reply.content)}</p></div>`).join('')}</div>` : ''}<form class="reply-form" data-topic="${esc(topic.id)}"><input class="field" name="author" placeholder="昵称" maxlength="30" required><input class="field" name="content" placeholder="写下你的回复..." maxlength="1000" required><button class="btn tiny" type="submit">回复</button></form></article>`).join('')}</section>`).join('') : '<div class="paper-card empty"><span class="emoji">💌</span>还没有留言，来写第一条吧！</div>';
  return `<div class="container page">${pageHead('LET’S TALK', '留言角 💌', '欢迎分享喜欢的动漫、最近的心情，或者单纯说声你好。')}${searchPanel()}<div class="talk-layout"><div class="topic-list">${topics}</div><aside class="talk-side paper-card"><h3>✎ 写一张留言卡</h3><p>友善交流，让这里一直暖暖的。留言提交后会公开显示。</p><form id="topic-form"><label for="topic-author">你的昵称</label><input class="field" id="topic-author" name="author" maxlength="30" placeholder="怎么称呼你？" required><label for="topic-title">想聊什么</label><input class="field" id="topic-title" name="title" maxlength="100" placeholder="给留言起个小标题" required><label for="topic-content">留言内容</label><textarea class="field" id="topic-content" name="content" maxlength="2000" placeholder="今天想说些什么呀..." required></textarea><button class="btn" type="submit">贴上留言卡 ♡</button></form></aside></div></div>`;
}
function openModal(html) { modalContent.innerHTML = html; modal.showModal(); }
function closeModal() { modal.close(); modalContent.innerHTML = ''; }
function adminModal() {
  if (filePreview) return openModal('<h2>当前是静态预览 ♡</h2><p>图片和页面可以直接查看。要发布动态、管理资料或留言，请先运行 npm start，再打开 http://localhost:3000。</p>');
  if (state.admin) return openModal('<h2>站长的小工具 🎀</h2><p>已登录，可以发布动态、编辑资料和管理留言。</p><button class="btn" data-action="logout">退出登录</button>');
  openModal(`<h2>站长入口 ♡</h2><p>登录后就可以写动态、修改个人资料。</p><form id="login-form"><label for="password">管理员密码</label><input class="field" type="password" id="password" name="password" required autocomplete="current-password"><button class="btn" type="submit">进入我的小站</button></form>${!state.loginEnabled ? '<p class="status">请先在服务器设置 BLOG_ADMIN_PASSWORD。</p>' : ''}`);
}
function postModal(type, post = null) { openModal(`<h2>${post ? '编辑动态 ✎' : '写一篇新动态 ✎'}</h2><p>${post ? '修改后会保留原来的发表日期。' : '把今天想留住的事情写下来吧。'}</p><form id="post-form" ${post ? `data-id="${esc(post.id)}"` : ''}><input type="hidden" name="type" value="${type}"><label for="post-title">标题</label><input class="field" id="post-title" name="title" maxlength="100" required value="${esc(post?.title)}" placeholder="今天想写什么？"><label for="post-tag">小标签</label><input class="field" id="post-tag" name="tag" maxlength="30" value="${esc(post?.tag)}" placeholder="比如：日常碎片"><label for="post-content">正文</label><textarea class="field" id="post-content" name="content" maxlength="5000" required placeholder="慢慢写，别着急...">${esc(post?.content)}</textarea><button class="btn" type="submit">${post ? '保存修改' : '发布这篇动态 ♡'}</button></form>`); }
function topicModal(topic) { openModal(`<h2>编辑留言 ✎</h2><p>修改后会保留原来的留言日期和回复。</p><form id="topic-edit-form" data-id="${esc(topic.id)}"><label for="edit-topic-author">昵称</label><input class="field" id="edit-topic-author" name="author" maxlength="30" required value="${esc(topic.author)}"><label for="edit-topic-title">标题</label><input class="field" id="edit-topic-title" name="title" maxlength="100" required value="${esc(topic.title)}"><label for="edit-topic-content">留言内容</label><textarea class="field" id="edit-topic-content" name="content" maxlength="2000" required>${esc(topic.content)}</textarea><button class="btn" type="submit">保存修改</button></form>`); }
function profileModal() { const p = state.profile; openModal(`<h2>编辑个人资料 🎀</h2><form id="profile-form">${[['name','名字'],['handle','用户名'],['intro','一句话介绍'],['bio','关于我的正文'],['location','坐标'],['interests','喜欢的事'],['email','联系邮箱']].map(([key,label]) => `<label>${label}</label>${key === 'bio' ? `<textarea class="field" name="${key}" maxlength="1000">${esc(p[key])}</textarea>` : `<input class="field" name="${key}" value="${esc(p[key])}" maxlength="120">`}`).join('')}<button class="btn" type="submit">保存资料</button></form>`); }
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
document.querySelector('#login-button').addEventListener('click', adminModal);
document.querySelector('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
window.addEventListener('hashchange', () => { state.searchQuery = ''; scrollTo(0, 0); render(); });
app.addEventListener('input', event => {
  if (event.target.id !== 'site-search') return;
  state.searchQuery = event.target.value;
  document.querySelector('#search-results').innerHTML = searchResults(state.searchQuery);
});
app.addEventListener('click', event => {
  const result = event.target.closest('.search-result');
  if (result && result.getAttribute('href') === location.hash) focusHashTarget();
  if (event.target.closest('.entry-with-character') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    toast('来啦！一起看看今天的小确幸 ♡');
  }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id, type } = button.dataset;
  try {
    if (action === 'new-post') postModal(type);
    if (action === 'edit-post') { const post = state.posts.find(post => post.id === id); if (post) postModal(post.type, post); }
    if (action === 'edit-topic') { const topic = state.topics.find(topic => topic.id === id); if (topic) topicModal(topic); }
    if (action === 'edit-profile') profileModal();
    if (action === 'logout') { await request('/api/logout', { method: 'POST' }); state.admin = false; closeModal(); render(); toast('已退出登录'); }
    if (action === 'delete-post' && confirm('确定删除这篇动态吗？')) { await request(`/api/posts/${id}`, { method: 'DELETE' }); state.posts = state.posts.filter(p => p.id !== id); render(); toast('动态已删除'); }
    if (action === 'delete-topic' && confirm('确定删除这条留言和所有回复吗？')) { await request(`/api/topics/${id}`, { method: 'DELETE' }); state.topics = state.topics.filter(t => t.id !== id); render(); toast('留言已删除'); }
  } catch (error) { toast(error.message); }
});
document.addEventListener('submit', async event => {
  const form = event.target; if (!['login-form','post-form','profile-form','topic-form','topic-edit-form'].includes(form.id) && !form.matches('.reply-form')) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const values = formData(form);
    if (form.id === 'login-form') { const result = await request('/api/login', { method: 'POST', body: JSON.stringify(values) }); state.admin = result.admin; closeModal(); render(); toast('欢迎回来，站长 ♡'); }
    if (form.id === 'post-form') { const editing = Boolean(form.dataset.id); const post = await request(editing ? `/api/posts/${form.dataset.id}` : '/api/posts', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(values) }); if (editing) state.posts = state.posts.map(item => item.id === post.id ? post : item); else state.posts.unshift(post); closeModal(); render(); toast(editing ? '动态已更新' : '动态发布成功'); }
    if (form.id === 'profile-form') { state.profile = await request('/api/profile', { method: 'PUT', body: JSON.stringify(values) }); closeModal(); render(); toast('资料已保存'); }
    if (form.id === 'topic-form') { const topic = await request('/api/topics', { method: 'POST', body: JSON.stringify(values) }); state.topics.unshift(topic); render(); toast('留言贴上啦 ♡'); }
    if (form.id === 'topic-edit-form') { const topic = await request(`/api/topics/${form.dataset.id}`, { method: 'PUT', body: JSON.stringify(values) }); state.topics = state.topics.map(item => item.id === topic.id ? topic : item); closeModal(); render(); toast('留言已更新'); }
    if (form.matches('.reply-form')) { const reply = await request(`/api/topics/${form.dataset.topic}/replies`, { method: 'POST', body: JSON.stringify(values) }); state.topics.find(t => t.id === form.dataset.topic).replies.push(reply); render(); toast('回复成功'); }
  } catch (error) { toast(error.message); button.disabled = false; }
});
load();
