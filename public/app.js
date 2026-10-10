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
  document.querySelector('#login-button').textContent = state.admin ? '♥' : '♡';
  app.innerHTML = ({ home, life: () => postsPage('life'), study: () => postsPage('study'), about, talk })[page]();
  document.title = `${({home:'首页',life:'生活日记',study:'学习与工作',about:'关于我',talk:'留言角'})[page]} | ${siteName}`;
  focusHashTarget();
  revealSections();
}
let paperAnimation;
let paperVersion = 0;
const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
async function paperTransition(commit, label, reverse = false, enabled = true) {
  const version = ++paperVersion;
  paperAnimation?.cancel();
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
    paperAnimation = layer.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out', fill: 'both' });
    await paperAnimation.finished;
    if (version !== paperVersion) return;
    paperAnimation.cancel();
    commit();
    committed = true;
    paperAnimation = sheet.animate([
      { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
      { transform: `rotateY(${angle * .6}deg)`, filter: 'brightness(.87)', offset: .62 },
      { transform: `rotateY(${angle}deg)`, filter: 'brightness(.98)' }
    ], { duration: narrow ? 420 : 600, easing: 'cubic-bezier(.3,.05,.2,1)', fill: 'forwards' });
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
function changePage() {
  const page = route();
  const differentPage = document.body.dataset.page !== page;
  state.searchQuery = '';
  return paperTransition(() => {
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    render();
    const heading = app.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, ({ home: '回到故事的起点', life: '生活日记', study: '学习与工作', about: '关于我', talk: '留言角' })[page], page === 'home', differentPage);
}
let revealObserver;
function revealSections() {
  revealObserver?.disconnect();
  if (motionReduced() || !('IntersectionObserver' in window)) return;
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('reveal-pending');
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: .08 });
  app.querySelectorAll('.chapter-link, .journal-entry, .journal-letter, .post-card, .topic').forEach((element, index) => {
    // Already-visible content stays visible, including deep-linked articles.
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.style.setProperty('--reveal-delay', `${(index % 4) * 55}ms`);
    element.classList.add('reveal-item', 'reveal-pending');
    revealObserver.observe(element);
  });
}

function setHomeSearch(open) {
  const search = document.querySelector('.entry-search');
  if (!search) return;
  const toggle = search.querySelector('.search-toggle');
  const reveal = search.querySelector('.entry-search-reveal');
  search.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? '收起搜索' : '展开搜索');
  reveal.inert = !open;
  reveal.setAttribute('aria-hidden', String(!open));
  (open ? search.querySelector('#site-search') : toggle).focus({ preventScroll: true });
}
function sectionHead(title, subtitle, link, label) { return `<div class="section-head"><div><div class="eyebrow">✦ ${esc(subtitle)}</div><h2>${esc(title)}</h2></div>${link ? `<a href="#${link}">${esc(label)} →</a>` : ''}</div>`; }
const homeInteraction = { mood: '', artwork: 0, lastPost: null };
const homeMoods = [
  ['sunny', '☀', '晴朗', '把这份好心情，夹进今天的书页里。'],
  ['quiet', '☁', '放空', '暂时什么都不做，也是一种好好生活。'],
  ['growing', '✿', '充电', '慢慢来，每一点成长都算数。']
];
const homeArtworks = [
  ['monet-entry.webp', '粉紫色的莫奈风格池塘与花园', '一些日常，值得被珍藏。'],
  ['monet-study.webp', '紫色光影交织的莫奈风格画作', '给灵感一点发芽的时间。'],
  ['monet-about.webp', '柔和色彩的莫奈风格花园', '在自己的节奏里，慢慢盛开。']
];
function home() {
  const artwork = homeArtworks[homeInteraction.artwork];
  const mood = homeMoods.find(item => item[0] === homeInteraction.mood);
  const latest = state.posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const chapters = [
    ['life', 'LIFE JOURNAL', '生活日记', '收藏平凡日子的闪光', '01'],
    ['study', 'LEARNING NOTES', '学习 & 工作', '记录一点一点的成长', '02'],
    ['about', 'ABOUT ME', '关于我', '一封写给新朋友的信', '03'],
    ['talk', 'GUESTBOOK', '留言角', '在这里交换小小心事', '04']
  ];
  return `<div class="journal-home">
    <section class="journal-hero" aria-labelledby="journal-title">
      <div class="journal-intro"><p class="journal-kicker"><span></span> A PERSONAL JOURNAL · ${esc(state.profile.handle)}</p>
        <p class="opening-welcome">欢迎来到我的小小世界</p><h1 id="journal-title"><span class="opening-line">把日子，</span><span class="opening-line">写成<span class="title-flower" aria-hidden="true">✳</span></span><span class="opening-line"><em>喜欢的样子。</em></span></h1>
        <div class="journal-intro-bottom"><p>${esc(state.profile.intro)}<br>生活、学习，以及一些小小心事。</p><button class="journal-cta" type="button" data-home-action="explore">翻开手帐 <span aria-hidden="true">↓</span></button></div>
        <div class="mood-picker" role="group" aria-label="今天的心情"><span class="mood-label">今天的你，是什么天气？</span><div class="mood-options">${homeMoods.map(([key, icon, label]) => `<button type="button" data-mood="${key}" aria-pressed="${homeInteraction.mood === key}"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('')}</div><p id="mood-message" aria-live="polite">${mood ? mood[3] : '选一个心情，收下一句小小的回应。'}</p></div>
      </div>
      <div class="journal-collage" aria-label="莫奈色彩与日常灵感的拼贴">
        <span class="collage-script" aria-hidden="true">little things,<br>beautiful days.</span>
        <figure class="collage-main"><button class="artwork-switch" type="button" data-home-action="artwork" aria-label="切换下一幅画作"><img id="home-artwork" src="./assets/${artwork[0]}" alt="${artwork[1]}" fetchpriority="high"><span class="artwork-hint">换一幅风景 ↻</span></button><figcaption><span>THE ART OF EVERYDAY</span><span id="artwork-number">FIG. 0${homeInteraction.artwork + 1} / 03</span></figcaption></figure>
        <figure class="collage-small"><img src="./assets/monet-life.webp" alt="柔和光影中的花园笔触"><figcaption>停下来，看看花。</figcaption></figure>
        <span class="collage-seal" aria-hidden="true">慢慢生活<br>好好记录 <span>✳</span></span>
        <button class="collage-character character-greeting" type="button" data-home-action="greeting" aria-label="和小凛打个招呼"><img src="./assets/rin-button.png" alt="" width="1415" height="1111"><span>戳戳我 ♡</span></button>
        <span class="collage-note" id="artwork-note" aria-live="polite">${artwork[2]}</span>
      </div>
    </section>
    <button class="opening-invitation" type="button" data-home-action="explore"><span class="opening-index">01 — THE BEGINNING</span><span>往下翻，故事才刚刚开始</span><span class="opening-down" aria-hidden="true">↓</span></button>
    <section class="journal-chapters" id="home-chapters" aria-labelledby="chapters-title" tabindex="-1"><div class="explore-heading"><div><span class="journal-kicker">FIND YOUR LITTLE CORNER</span><h2 id="chapters-title">探索手帐 <em>Choose a chapter</em></h2><p>想从哪一页开始？选一个角落，慢慢逛。</p></div><button class="random-note" type="button" data-home-action="random" ${state.posts.length ? '' : 'disabled'}><span aria-hidden="true">⚄</span> 随机翻一篇 ↗</button></div>
      <nav class="chapter-grid" aria-label="博客分类">${chapters.map(([page, en, title, caption, number]) => `<a class="chapter-link" href="#${page}"><div class="chapter-meta"><span>${number} / ${en}</span><span class="chapter-arrow" aria-hidden="true">↗</span></div><h3>${title}</h3><p>${caption}</p><span class="chapter-count">${page === 'life' || page === 'study' ? `${state.posts.filter(post => post.type === page).length} 篇记录` : page === 'talk' ? `${state.topics.length} 条留言` : '很高兴认识你'}</span></a>`).join('')}</nav>
    </section>
    <section class="journal-latest" aria-labelledby="latest-title"><div class="journal-section-label"><h2 id="latest-title">最近写下的 <em>Latest notes</em></h2><span>持续收集生活中的微光</span></div>
      <div class="journal-latest-grid"><div class="journal-entries">${latest.length ? latest.map((post, index) => `<a class="journal-entry" href="#${post.type}?item=${encodeURIComponent(`post-${post.id}`)}"><span class="journal-entry-index">0${index + 1}</span><div><span class="journal-entry-category">${post.type === 'life' ? '生活日记' : '学习 & 工作'} · ${date(post.createdAt)}</span><h3>${esc(post.title)}</h3><p>${esc(post.content.slice(0, 76))}${post.content.length > 76 ? '…' : ''}</p></div><span aria-hidden="true">↗</span></a>`).join('') : '<p class="journal-empty">新的一页，等一个想记录的瞬间。</p>'}</div>
      <aside class="journal-letter"><span class="journal-kicker">A NOTE TO YOU</span><span class="letter-star" aria-hidden="true">✳</span><h3>你好呀，<br>我是${esc(state.profile.name)}。</h3><p>${esc(state.profile.bio)}</p><a href="#about">关于我的更多故事 ↗</a></aside></div>
    </section>
    <section class="journal-search" aria-label="搜索手帐">${searchPanel()}</section>
    <section class="journal-signoff"><p>很高兴，我们在这里相遇。</p><a href="#talk">留一句话，再走吧 <span aria-hidden="true">↗</span></a><span>WITH LOVE, ${esc(state.profile.name)}</span></section>
  </div>`;
}
function pageHead(eyebrow, title, desc, action = '') { return `<div class="page-head"><div class="page-head-copy"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p>${action ? `<div class="page-head-action">${action}</div>` : ''}</div><img class="page-head-art" src="./assets/rin-saber-chibi.png" alt="" aria-hidden="true"></div>`; }
function postsPage(type) {
  const life = type === 'life';
  const posts = state.posts.filter(post => post.type === type);
  const action = state.admin ? `<button class="btn tiny" data-action="new-post" data-type="${type}">＋ 写一篇动态</button>` : '';
  const cards = posts.length ? posts.map((post, index) => `<article id="post-${esc(post.id)}" class="post-card paper-card"><div class="post-top"><div class="post-label"><span class="post-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="tag">${esc(post.tag || (life ? '生活日记' : '成长笔记'))}</span></div><time class="date">${date(post.createdAt)}</time></div><h2>${esc(post.title)}</h2><p>${esc(post.content)}</p><div class="post-foot"><span>${post.updatedAt ? `✎ 编辑于 ${date(post.updatedAt)}` : '♥ 写给今天的自己'}</span>${state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑</button><button class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除</button></span>` : '<span>✦</span>'}</div></article>`).join('') : '<div class="paper-card empty"><span class="emoji">✿</span>这里还没有动态，敬请期待。</div>';
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
window.addEventListener('hashchange', changePage);
app.addEventListener('keydown', event => {
  if (event.key === 'Escape' && event.target.closest('.entry-search.is-open')) {
    event.preventDefault();
    setHomeSearch(false);
  }
});
app.addEventListener('input', event => {
  if (event.target.id !== 'site-search') return;
  state.searchQuery = event.target.value;
  document.querySelector('#search-results').innerHTML = searchResults(state.searchQuery);
});
app.addEventListener('click', event => {
  const moodButton = event.target.closest('[data-mood]');
  if (moodButton) {
    homeInteraction.mood = moodButton.dataset.mood;
    app.querySelectorAll('[data-mood]').forEach(button => button.setAttribute('aria-pressed', String(button === moodButton)));
    document.querySelector('#mood-message').textContent = homeMoods.find(item => item[0] === homeInteraction.mood)[3];
  }
  const homeButton = event.target.closest('[data-home-action]');
  if (homeButton) {
    const action = homeButton.dataset.homeAction;
    if (action === 'explore') {
      paperTransition(() => {
        const chapters = document.querySelector('#home-chapters');
        if (!chapters) return;
        chapters.focus({ preventScroll: true });
        chapters.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, '翻开新的小小世界');
    }
    if (action === 'artwork') {
      homeInteraction.artwork = (homeInteraction.artwork + 1) % homeArtworks.length;
      const artwork = homeArtworks[homeInteraction.artwork];
      const img = document.querySelector('#home-artwork');
      img.src = `./assets/${artwork[0]}`;
      img.alt = artwork[1];
      if (!motionReduced() && img.animate) img.animate([{ opacity: .25, transform: 'scale(1.045)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
      document.querySelector('#artwork-number').textContent = `FIG. 0${homeInteraction.artwork + 1} / 03`;
      document.querySelector('#artwork-note').textContent = artwork[2];
    }
    if (action === 'greeting') {
      toast('小凛：欢迎回来！今天也要留一点时间给喜欢的事 ♡');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) homeButton.animate([{ transform: 'rotate(0)' }, { transform: 'translateY(-10px) rotate(-6deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], { duration: 500 });
    }
    if (action === 'random' && state.posts.length) {
      const otherPosts = state.posts.filter(post => post.id !== homeInteraction.lastPost);
      const candidates = otherPosts.length ? otherPosts : state.posts;
      const post = candidates[Math.floor(Math.random() * candidates.length)];
      homeInteraction.lastPost = post.id;
      location.hash = `${post.type}?item=${encodeURIComponent(`post-${post.id}`)}`;
    }
  }

  const searchToggle = event.target.closest('.search-toggle');
  if (searchToggle) setHomeSearch(searchToggle.getAttribute('aria-expanded') !== 'true');
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
