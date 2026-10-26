const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const toastNode = document.querySelector('#toast');
const adminMode = ['/admin', '/admin.html'].includes(location.pathname);
const filePreview = location.protocol === 'file:';
const state = { activity: null, projects: [], friends: [], posts: [], topics: [], moods: [], profile: null, readingPlan: null, readingHistory: [], admin: false, loginEnabled: false, searchQuery: '' };
const previewData = {
  moods: [],
  readingPlan: { book: '', author: '', goal: '', progress: 0, note: '' },
  profile: {
    name: '土豆', handle: 'sakura.notes', intro: '在日常里收集闪闪发光的小事 ✨',
    bio: '你好呀！这里是我的个人小站。喜欢动漫、游戏，爱折腾奇怪东西，也在努力学习新知识。',
    location: '中国 · 某个有樱花的角落', interests: '动漫 / 摄影 / 阅读 / 编程', email: '', phone: '', qq: '', wechat: '', github: ''
  },
  posts: [
    { id: 'preview-life', type: 'life', title: '把今天装进粉色的口袋里', content: '下午的阳光刚刚好，路过花店时买了一束小小的雏菊。原来平凡的一天，也可以很可爱。', tag: '日常碎片', createdAt: '2026-10-08T12:00:00.000Z' },
    { id: 'preview-study', type: 'study', title: '最近在学：把想法做成网页', content: '从布局、颜色到交互，每一个小细节都很有趣。希望以后能把更多想法变成真正能打开的网站。', tag: '学习笔记', createdAt: '2026-10-07T10:00:00.000Z' }
  ],
  topics: [{ id: 'preview-welcome', author: '土豆', title: '欢迎来到留言角！', content: '可以聊聊最近喜欢的动漫、学习心得，或者分享今天遇见的小确幸。', createdAt: '2026-10-01T10:00:00.000Z', replies: [] }]
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = value => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
const dateKey = value => new Date(value).toLocaleDateString('sv-SE');
function searchItems() {
  const items = state.posts.map(post => ({ page: postPage(post), id: `post-${post.id}`, category: post.type === 'update' ? '更新日志' : post.type === 'article' ? '个人文章' : post.type === 'life' ? '生活日记' : studySection(post) === 'work' ? '工作记录' : '学习手记', title: post.title, detail: post.content, words: [post.title, post.content, post.tag, date(post.createdAt)].join(' ') }));
  if (state.readingPlan?.book) {
    const plan = state.readingPlan;
    items.push({ page: 'study', id: 'reading-plan', category: '阅读计划', title: plan.book, detail: plan.goal || plan.note, words: [plan.book, plan.author, plan.goal, plan.note].join(' ') });
  }
  for (const book of state.readingHistory || []) items.push({ page: 'study', id: `read-${book.id}`, category: '历史书库', title: book.book, detail: book.note || book.author, words: [book.book, book.author, book.note, book.goal].join(' ') });
  for (const topic of state.topics) {
    items.push({ page: 'talk', id: `topic-${topic.id}`, category: '留言角', title: topic.title, detail: `${topic.author} · ${topic.content}`, words: [topic.title, topic.author, topic.content, date(topic.createdAt)].join(' ') });
    for (const reply of topic.replies) items.push({ page: 'talk', id: `topic-${topic.id}`, category: '留言回复', title: `${reply.author} 回复了「${topic.title}」`, detail: reply.content, words: [reply.author, reply.content, topic.title, date(reply.createdAt)].join(' ') });
  }
  for (const friend of state.friends.filter(item => item.status === 'published')) items.push({ page: 'friends', id: `friend-${friend.id}`, category: '友链花园', title: friend.name, detail: friend.description, words: [friend.name, friend.description, friend.url].join(' ') });
  for (const project of state.projects || []) items.push({ page: 'work', id: `project-${project.id}`, category: project.status === 'completed' ? '已完成的项目' : '进行中的项目', title: project.title, detail: project.description, words: [project.title, project.description, project.url, project.status === 'completed' ? '已完成' : '进行中'].join(' ') });
  for (const problem of state.activity?.luogu?.solved || []) items.push({ page: 'study', id: `solved-${problem.pid}`, category: '洛谷已解题', title: `${problem.pid} · ${problem.title}`, detail: problem.date || '日期待补', words: [problem.pid, problem.title, problem.date].join(' ') });
  for (const day of state.activity?.github?.daily || []) items.push({ page: 'work', id: `commit-${day.date}`, category: 'GitHub 提交', title: `${day.date} · ${day.total} 次提交`, detail: `公开 ${day.public} 次 · 私密 ${day.private} 次`, words: [day.date, 'GitHub 提交', `公开 ${day.public}`, `私密 ${day.private}`].join(' ') });
  const profile = state.profile;
  items.push({ page: 'about', id: 'profile', category: '关于我', title: profile.name, detail: profile.intro, words: [profile.name, profile.handle, profile.intro, profile.bio, profile.location, profile.interests, ...hobbyItems(profile).map(item => item.detail), profile.email, profile.phone, profile.qq, profile.wechat, profile.github, profile.birthday, profile.workExperience, profile.education, ...educationStages.map(([key]) => profile[key])].join(' ') });
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
  const scope = { home: ['检索小站内容', '搜索动态、个人资料和留言…'], life: ['检索生活日记', '搜索生活日记…'], study: ['检索学习手记', '搜索学习笔记、书籍和刷题记录…'], work: ['检索工作记录', '搜索工作记录和项目…'], articles: ['检索个人文章', '搜索文章标题、想法和标签…'], about: ['检索关于我', '搜索个人资料…'], talk: ['检索留言角', '搜索留言和回复…'], friends: ['检索友链花园', '搜索站点名称和简介…'] }[page];
  return `<section class="search-panel" aria-label="${scope[0]}"><label for="site-search">${scope[0]}</label><div class="search-field"><span aria-hidden="true">⌕</span><input id="site-search" type="search" placeholder="${scope[1]}" value="${esc(state.searchQuery)}" autocomplete="off"></div><div class="search-results" id="search-results" aria-live="polite">${searchResults(state.searchQuery)}</div></section>`;
}
function focusHashTarget() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
  if (id) requestAnimationFrame(() => {
    let target = document.getElementById(id);
    if (route() === 'work' && state.posts.some(post => post.type === 'update' && `post-${post.id}` === id)) {
      blogUpdatesModal();
      target = document.getElementById(id);
    }
    if (!target) target = openStudyArchivedPost(id);
    if (!target && typeof openActivitySearchTarget === 'function') target = openActivitySearchTarget(id);
    if (route() === 'study' && id.startsWith('read-')) {
      libraryExpanded = true;
      const library = document.querySelector('#reading-library');
      library?.classList.add('is-open');
      const fans = library?.querySelector('#library-fans');
      if (fans) fans.inert = false;
      const toggle = library?.querySelector('.library-toggle');
      if (toggle) { toggle.setAttribute('aria-expanded', 'true'); toggle.textContent = '收拢书页 ↗'; }
    }
    if (route() === 'work' && id.startsWith('project-') && typeof projectModal === 'function') projectModal(id.slice(8));
    if (route() === 'talk' && id.startsWith('topic-')) topicConversation(id.slice(6));
    target?.scrollIntoView({ block: id === 'home-chapters' ? 'start' : 'center', behavior: motionReduced() ? 'instant' : 'smooth' });
  });
}
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  const localStatus = modal.open && document.querySelector('#modal-status');
  if (localStatus) {
    toastNode.classList.remove('show');
    localStatus.textContent = message;
    updateContent(modalContent, () => { localStatus.hidden = false; });
    toastTimer = setTimeout(() => {
      if (localStatus.isConnected) updateContent(modalContent, () => { localStatus.hidden = true; });
    }, 4200);
  } else {
    toastNode.textContent = message;
    toastNode.classList.add('show');
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3200);
  }
}
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
    const [posts, topics, moods, profile, readingPlan, readingHistory, session, friends, activity, projects] = await Promise.all([request('/api/posts'), request('/api/topics'), request('/api/moods'), request('/api/profile'), request('/api/reading-plan'), request('/api/reading-history'), adminMode ? request('/api/session') : Promise.resolve({ admin: false, loginEnabled: false }), request('/api/friends'), request('/api/activity').catch(() => null), request('/api/projects')]);
    if (session.admin) friends.splice(0, friends.length, ...await request('/api/friends?review=1'));
    Object.assign(state, { activity, projects, friends, posts, topics, moods, profile, readingPlan, readingHistory, admin: session.admin, loginEnabled: session.loginEnabled });
    render();
  } catch (error) { app.innerHTML = `<div class="container empty"><span class="emoji">☁️</span>暂时无法加载小站：${esc(error.message)}</div>`; }
}
function postPage(post) { return post.type === 'update' ? 'work' : post.type === 'article' ? 'articles' : post.type === 'study' ? studySection(post) === 'work' ? 'work' : 'study' : post.type; }
function route() {
  const name = location.hash.replace('#', '').split('?')[0];
  const page = ['home','life','study','work','articles','about','talk','friends'].includes(name) ? name : ({ '/friends': 'friends', '/study': 'study', '/work': 'work', '/articles': 'articles' })[location.pathname] || 'home';
  if (['study', 'work', 'articles'].includes(page)) {
    const id = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
    if (id === 'study-work') return 'work';
    if (id === 'study-learning') return 'study';
    const post = state.posts.find(item => `post-${item.id}` === id && ['study', 'article', 'update'].includes(item.type));
    if (post) return postPage(post);
  }
  return page;
}
function render() {
  syncFanNavigation();
  if (!state.profile) return;
  const page = route();
  document.body.classList.toggle('is-entry', page === 'home');
  document.body.dataset.page = page;
  const siteName = '个人记事簿';
  document.querySelector('#brand-name').textContent = siteName;
  document.querySelector('#footer-brand').textContent = `🥔 ${siteName}`;
  const accountButton = document.querySelector('#login-button');
  if (accountButton) accountButton.textContent = state.admin ? '站长账户' : '站长登录';
  if (adminMode && !state.admin) {
    document.body.classList.remove('is-entry');
    app.innerHTML = `<section class="admin-login modal"><div class="eyebrow">PRIVATE NOTEBOOK</div><h1>站长登录</h1><p>登录后管理动态、心情、资料和留言。</p>${loginForm()}</section>`;
    document.title = '站长登录 | 个人记事簿';
    return;
  }
  app.innerHTML = ({ home, life: () => postsPage('life'), study: () => postsPage('study'), work: workPage, articles: articlesPage, about, talk, friends: friendsPage })[page]();
  if (['study', 'work'].includes(page) && typeof positionActivityMaps === 'function') positionActivityMaps();
  document.title = `${({home:'首页',life:'生活日记',study:'学习手记',work:'工作记录',articles:'个人文章',about:'关于我',talk:'留言角',friends:'友链花园'})[page]} | ${siteName}`;
  focusHashTarget();
  revealSections();
}
let paperAnimation;
let paperVersion = 0;
const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Keep layout transitions local; rapid updates start from the visible height.
const contentAnimations = new WeakMap();
function updateContent(element, update) {
  if (!element?.animate || motionReduced()) { update(); return; }
  const before = element.getBoundingClientRect().height;
  contentAnimations.get(element)?.cancel();
  update();
  const after = element.getBoundingClientRect().height;
  const animation = element.animate([
    { height: `${before}px`, opacity: .72, overflow: 'clip' },
    { height: `${after}px`, opacity: 1, overflow: 'clip' }
  ], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
  contentAnimations.set(element, animation);
  animation.finished.catch(() => {}).finally(() => {
    if (contentAnimations.get(element) === animation) contentAnimations.delete(element);
  });
}
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
function changePage() {
  const page = route();
  const differentPage = document.body.dataset.page !== page;
  state.searchQuery = '';
  if (modal.open) requestModalClose();
  if (fanOpen) closeFanNavigation(false, false);
  const fromFan = fanNavigatePending;
  fanNavigatePending = false;
  const fromChapter = chapterNavigatePending === location.hash;
  chapterNavigatePending = '';
  const commit = () => {
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    render();
    const heading = app.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  };
  if (!fromChapter && (fromFan || (!adminMode && differentPage && page !== 'home'))) return blurPageTransition(commit);
  return paperTransition(commit, ({ home: '回到故事的起点', life: '生活日记', study: '学习手记', work: '工作记录', articles: '个人文章', about: '关于我', talk: '留言角', friends: '友链花园' })[page], page === 'home', differentPage);
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
const ownFriendProfile = Object.freeze({
  name: '个人记事簿',
  link: 'https://blog.example.test/',
  avatar: 'https://blog.example.test/assets/avatar.svg',
  descr: '记录生活与学习'
});
function ownFriendYaml() {
  return `- name: ${ownFriendProfile.name}\n  link: ${ownFriendProfile.link}\n  avatar: ${ownFriendProfile.avatar}\n  descr: ${ownFriendProfile.descr}`;
}
function shuffleFriends(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function friendCard(friend, review = false) {
  return `<article class="friend-card" id="friend-${esc(friend.id)}"><div class="friend-card-top"><span class="friend-avatar">${friend.avatar ? `<img src="${esc(friend.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-friend-avatar><span hidden>${esc(Array.from(friend.name)[0])}</span>` : esc(Array.from(friend.name)[0])}</span><span class="friend-label">${review ? '等待相遇 · 待审核' : 'A LITTLE WORLD'}</span><span aria-hidden="true">✧</span></div><h2>${esc(friend.name)}</h2><p>${esc(friend.description)}</p>${!review ? `<a class="friend-visit" href="${esc(friend.url)}" target="_blank" rel="noopener noreferrer nofollow ugc">去串个门 <span aria-hidden="true">↗</span><span class="sr-only">：${esc(friend.name)}（新窗口）</span></a>` : `<span class="friend-pending-url">${esc(friend.url)}</span>`}${state.admin ? `<div class="friend-admin"><button class="quiet-button" data-action="edit-friend" data-id="${esc(friend.id)}">编辑 / ${review ? '审核' : '下架'}</button><button class="quiet-button" data-action="delete-friend" data-id="${esc(friend.id)}">删除</button></div>` : ''}</article>`;
}
function friendsPage() {
  const published = shuffleFriends(state.friends.filter(item => item.status === 'published'));
  const pending = state.friends.filter(item => item.status === 'pending');
  return `<div class="container page-friends">${pageHead('FRIENDS & LITTLE WORLDS', '友链花园', '把喜欢的小站种在这里，让有趣的灵魂沿着链接相遇。', '<button class="btn friend-apply" type="button" data-action="new-friend">✧ 留下你的小站</button>')}<div class="friends-intro"><span>一条链接，一次新的相遇。</span><div class="friends-order"><small>${published.length} 个小世界，随机相遇。</small><button class="quiet-button" type="button" data-action="shuffle-friends" ${published.length < 2 ? 'disabled' : ''}>换个顺序 ↻</button></div></div><section class="friends-grid" aria-label="已收录的友链">${published.length ? published.map(item => friendCard(item)).join('') : '<div class="friends-empty"><span aria-hidden="true">✳</span><h2>花园正在等第一位朋友</h2><p>带着你的小站来坐坐，写下我们相遇的第一笔。</p><button class="quiet-button" data-action="new-friend">申请成为友链 ↗</button></div>'}</section>${state.admin ? `<section class="friends-review"><h2>待审核 <small>${pending.length}</small></h2><p>审核通过后，站点才会出现在公开花园中。已发布友链可在编辑中下架。</p><div class="friends-grid">${pending.length ? pending.map(item => friendCard(item, true)).join('') : '<p>目前没有待审核的申请。</p>'}</div></section>` : ''}<aside class="friends-note"><div><span class="journal-kicker">LET’S EXCHANGE A LINK</span><h2>也欢迎把土豆种进你的花园</h2><div class="own-friend-heading"><span class="friend-avatar"><img src="${esc(ownFriendProfile.avatar)}" alt="个人记事簿头像" loading="lazy" referrerpolicy="no-referrer" data-friend-avatar><span hidden>土</span></span><p>${esc(ownFriendProfile.name)}<br>${esc(ownFriendProfile.descr)}</p></div><a class="friend-site-url" href="${esc(ownFriendProfile.link)}" target="_blank" rel="noopener noreferrer">${esc(ownFriendProfile.link)}</a><pre class="friend-exchange-code" id="own-friend-yaml" tabindex="0" aria-label="本站友链资料 YAML">${esc(ownFriendYaml())}</pre><button class="quiet-button" type="button" data-action="copy-friend-profile">复制友链资料</button></div><div><h3>申请前的小约定</h3><p>请填写能正常访问的个人站点、简短介绍，并填写图片网址或上传一张图片（选填）。友善交流，认真记录；访客申请经站长审核后展示。</p><button class="quiet-button" data-action="new-friend">${state.admin ? '管理员也可以直接提交 ↗' : '留下你的小站 ↗'}</button></div></aside>${searchPanel()}</div>`;
}
function friendModal(friend = null) {
  const localImage = /^\/assets\/uploads\//.test(friend?.avatar || '');
  openModal(`<div class="eyebrow">A NEW LITTLE WORLD</div><h2>${friend ? '整理这株小小的友链' : '在花园留下一颗种子'}</h2><p>${state.admin ? '管理员提交直接发布；编辑时可调整审核状态。' : '写下你的小站，审核通过后就能在花园里相遇。'}</p>
    <form id="friend-form" ${friend ? `data-id="${esc(friend.id)}"` : ''} data-avatar="${localImage ? esc(friend.avatar) : ''}">
      <label for="friend-name">站点名称</label><input class="field" id="friend-name" name="name" required maxlength="60" value="${esc(friend?.name)}">
      <label for="friend-url">站点网址</label><input class="field" id="friend-url" name="url" type="url" required maxlength="1000" placeholder="https://example.com" value="${esc(friend?.url)}">
      <label for="friend-description">一句话介绍</label><textarea class="field" id="friend-description" name="description" required maxlength="240">${esc(friend?.description)}</textarea>
      <fieldset class="friend-image-source"><legend>友链图片（选填）</legend><label><input type="radio" name="avatarSource" value="url" ${!localImage ? 'checked' : ''}> 图片网址</label><label><input type="radio" name="avatarSource" value="upload" ${localImage ? 'checked' : ''}> 本地上传</label></fieldset>
      <div data-friend-source="url" ${localImage ? 'hidden' : ''}><label for="friend-avatar">图片网址</label><input class="field" id="friend-avatar" name="avatar" type="url" maxlength="1000" placeholder="https://example.com/avatar.png" value="${localImage ? '' : esc(friend?.avatar)}" ${localImage ? 'disabled' : ''}></div>
      <div data-friend-source="upload" ${!localImage ? 'hidden' : ''}><label for="friend-avatar-file">选择图片</label><input class="field" id="friend-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="friend-image-help" ${!localImage ? 'disabled' : ''}><p class="friend-image-help" id="friend-image-help">PNG、JPEG 或 WebP，单张不超过 2 MB；提交时上传。</p></div>
      <div class="friend-image-preview"><img alt="友链图片预览" data-friend-preview-image hidden><span data-friend-image-placeholder>未选择图片</span><button class="btn subtle" type="button" data-remove-friend-image hidden>移除图片</button></div>
      ${friend && state.admin ? `<label for="friend-status">展示状态</label><select class="field" id="friend-status" name="status"><option value="published" ${friend.status === 'published' ? 'selected' : ''}>已发布（审核通过）</option><option value="pending" ${friend.status === 'pending' ? 'selected' : ''}>待审核 / 下架</option></select>` : ''}
      <p class="form-error" role="alert"></p><button class="btn" type="submit">${friend ? '保存友链' : state.admin ? '发布友链' : '提交申请'}</button>
    </form>`);
  updateFriendImage(modal.querySelector('#friend-form'));
}
function updateFriendImage(form) {
  const uploading = form.elements.avatarSource.value === 'upload';
  const input = form.querySelector('#friend-avatar-file');
  form.querySelector('[data-friend-source="url"]').hidden = uploading;
  form.querySelector('[data-friend-source="upload"]').hidden = !uploading;
  form.elements.avatar.disabled = uploading;
  input.disabled = !uploading;
  const source = uploading ? input.dataset.image || form.dataset.avatar : form.elements.avatar.value.trim();
  const image = form.querySelector('[data-friend-preview-image]');
  const placeholder = form.querySelector('[data-friend-image-placeholder]');
  image.hidden = true; placeholder.hidden = false; placeholder.textContent = source ? '正在读取图片…' : '未选择图片';
  image.onload = () => { image.hidden = false; placeholder.hidden = true; };
  image.onerror = () => { image.hidden = true; placeholder.hidden = false; placeholder.textContent = '图片暂时无法预览'; };
  if (source && /^(https?:\/\/|\/assets\/uploads\/|data:image\/)/.test(source)) image.src = source;
  else { image.removeAttribute('src'); if (source) placeholder.textContent = '请填写完整的 http 或 https 图片网址'; }
  form.querySelector('[data-remove-friend-image]').hidden = !source;
}
document.addEventListener('change', async event => {
  const form = event.target.closest('#friend-form');
  if (!form) return;
  if (event.target.name === 'avatarSource' || event.target.id === 'friend-avatar') return updateFriendImage(form);
  if (event.target.id !== 'friend-avatar-file') return;
  const input = event.target, file = input.files[0];
  if (!file) return;
  const submit = form.querySelector('[type="submit"]'), error = form.querySelector('.form-error');
  if (submit.disabled) return;
  submit.disabled = true; input.disabled = true; error.textContent = '';
  try {
    const image = await imageData(file);
    if (form.isConnected) { input.dataset.image = image; updateFriendImage(form); }
  } catch (problem) { input.value = ''; error.textContent = problem.message; }
  finally { submit.disabled = false; input.disabled = form.elements.avatarSource.value !== 'upload'; }
});
document.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-friend-image]');
  if (!remove) return;
  const form = remove.closest('form');
  if (form.querySelector('[type="submit"]').disabled) return;
  delete form.querySelector('#friend-avatar-file').dataset.image;
  form.dataset.avatar = ''; form.elements.avatar.value = '';
  form.querySelector('.form-error').textContent = '';
  updateFriendImage(form);
});
document.addEventListener('error', event => {
  if (event.target.matches?.('[data-friend-avatar]')) { event.target.hidden = true; event.target.nextElementSibling.hidden = false; }
}, true);

function sectionHead(title, subtitle, link, label) { return `<div class="section-head"><div><div class="eyebrow">✦ ${esc(subtitle)}</div><h2>${esc(title)}</h2></div>${link ? `<a href="#${link}">${esc(label)} →</a>` : ''}</div>`; }
const homeInteraction = { artwork: 0, lastPost: null };
const homeMoods = [
  ['sunny', '☀', '晴朗', '把这份好心情，夹进今天的书页里。'],
  ['happy', '🥔', '开心', '把快乐藏进今天的小口袋。'],
  ['calm', '☼', '平静', '让心慢下来，听听日子的声音。'],
  ['hopeful', '✧', '期待', '新的好事，也许正在路上。'],
  ['quiet', '☁', '放空', '暂时什么都不做，也是一种好好生活。'],
  ['growing', '✿', '充电', '慢慢来，每一点成长都算数。'],
  ['busy', '↗', '忙碌', '认真走过的每一步，都值得记下。'],
  ['tired', '☾', '疲惫', '今天辛苦了，记得留一点时间休息。'],
  ['rainy', '☂', '低落', '没关系，雨天也会慢慢放晴。']
];
const moodInfo = key => homeMoods.find(item => item[0] === key);
const localDay = () => dateKey(new Date());
function moodHistory() {
  const entries = state.moods.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  return `<section class="mood-history" aria-labelledby="mood-history-title"><div class="mood-history-heading"><div><span class="journal-kicker">A LITTLE MOOD JOURNAL</span><h2 id="mood-history-title">心情手记</h2></div><span>最近的心情，慢慢收藏</span></div><div class="mood-history-list">${entries.length ? entries.map(entry => { const mood = moodInfo(entry.mood); return `<article class="mood-history-item"><time datetime="${esc(entry.date)}">${esc(entry.date)}</time><strong><span aria-hidden="true">${mood?.[1] || '✧'}</span> ${esc(mood?.[2] || entry.mood)}</strong>${entry.note ? `<p>${esc(entry.note)}</p>` : ''}${state.admin ? `<button type="button" data-action="edit-mood" data-date="${esc(entry.date)}" aria-label="编辑 ${esc(entry.date)} 的心情">编辑</button>` : ''}</article>`; }).join('') : '<p class="mood-history-empty">土豆还没有写下心情，等一页新的记录。</p>'}</div></section>`;
}
const homeArtworks = [
  ['monet-entry.webp', '借鉴莫奈《睡莲》构图绘制的粉紫色池塘', '借鉴莫奈《睡莲》：没有地平线的池面，映着睡莲与天光。'],
  ['monet-study.webp', '借鉴莫奈《鲁昂大教堂，西立面》构图绘制的建筑', '借鉴莫奈《鲁昂大教堂，西立面》：建筑立面在变化的光线中呈现不同色彩。'],
  ['monet-about.webp', '借鉴莫奈《日本桥》构图绘制的花园', '借鉴莫奈《日本桥》：拱桥横跨池塘，花园的绿意映入水中。']
];
function home() {
  const artwork = homeArtworks[homeInteraction.artwork];
  const latestMood = state.moods.find(entry => entry.date === localDay());
  const mood = moodInfo(latestMood?.mood);
  const latest = state.posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const chapters = [
    ['life', 'LIFE JOURNAL', '生活日记', '收藏平凡日子的闪光', '01'],
    ['study', 'LEARNING NOTES', '学习手记', '记录一点一点的成长', '02'],
    ['work', 'WORK JOURNAL', '工作记录', '让想法慢慢成为现实', '03'],
    ['about', 'ABOUT ME', '关于我', '一封写给新朋友的信', '04'],
    ['talk', 'GUESTBOOK', '留言角', '在这里交换小小心事', '05'],
    ['friends', 'FRIEND GARDEN', '友链花园', '与有趣的小站相遇', '06']
  ];
  return `<div class="journal-home">
    <section class="journal-hero" aria-labelledby="journal-title">
      <div class="journal-intro"><p class="journal-kicker"><span></span> A PERSONAL JOURNAL · potatato</p>
        <p class="opening-welcome">欢迎认识土豆🥔</p><h1 id="journal-title"><span class="opening-line">这是土豆🥔</span><span class="opening-line"><em>的一天天</em></span></h1>
        <div class="journal-intro-bottom"><p>${esc(state.profile.intro)}<br>生活、学习，以及一些小小心事。</p><button class="journal-cta" type="button" data-home-action="explore">翻开手帐 <span aria-hidden="true">↓</span></button></div>
        <div class="mood-picker" aria-label="土豆今日的天气"><div class="mood-topline"><span class="mood-label">🥔今日的天气</span>${state.admin ? '<button class="mood-edit" type="button" data-action="edit-mood">记录心情 ↗</button>' : ''}</div>${mood ? `<div class="mood-current"><span class="mood-current-icon" aria-hidden="true">${mood[1]}</span><strong>${mood[2]}</strong><time datetime="${esc(latestMood.date)}">${esc(latestMood.date)}</time></div><p>${esc(latestMood.note || mood[3])}</p>` : '<p class="mood-empty">还没有心情记录，等土豆来写下今天。</p>'}</div>
      </div>
      <div class="journal-collage" aria-label="莫奈色彩与日常灵感的拼贴">
        <span class="collage-script" aria-hidden="true">little things,<br>beautiful days.</span>
        <figure class="collage-main"><button class="artwork-switch" type="button" data-home-action="artwork" aria-label="切换下一幅画作"><img id="home-artwork" src="./assets/${artwork[0]}" alt="${artwork[1]}" fetchpriority="high"><span class="artwork-hint">换一幅风景 ↻</span></button><figcaption><span>THE ART OF EVERYDAY</span><span id="artwork-number">FIG. 0${homeInteraction.artwork + 1} / 03</span></figcaption></figure>
        <figure class="collage-small"><img src="./assets/monet-life.webp" alt="借鉴莫奈《罂粟花田》构图绘制的花田与小路"><figcaption>借鉴莫奈《罂粟花田》：花田与斜向小路。</figcaption></figure>
        <span class="collage-seal" aria-hidden="true">慢慢生活<br>好好记录 <span>✳</span></span>
        <button class="collage-character character-greeting" type="button" data-home-action="greeting" aria-label="和小凛打个招呼"><img src="./assets/rin-button.png" alt="" width="1415" height="1111"><span>戳戳我 🥔</span></button>
        <span class="collage-note" id="artwork-note" aria-live="polite">${artwork[2]}</span>
      </div>
    </section>
    <a class="friends-invitation" href="#friends"><span class="friends-invitation-art" aria-hidden="true">✳<i>✧</i></span><span><small>FRIENDS & LITTLE WORLDS · 05</small><strong>友链花园</strong><span>沿着一条链接，遇见另一个有趣的小世界。</span></span><span class="friends-invitation-arrow" aria-hidden="true">↗</span></a>
    ${moodHistory()}
    <button class="opening-invitation" type="button" data-home-action="explore"><span class="opening-index">01 — THE BEGINNING</span><span>往下翻，故事才刚刚开始</span><span class="opening-down" aria-hidden="true">↓</span></button>
    <section class="journal-chapters" id="home-chapters" aria-labelledby="chapters-title" tabindex="-1"><div class="explore-heading"><div><span class="journal-kicker">FIND YOUR LITTLE CORNER</span><h2 id="chapters-title">目录</h2><p>想从哪一页开始？选一个角落，慢慢逛。</p></div><button class="random-note" type="button" data-home-action="random" ${state.posts.length ? '' : 'disabled'}><span aria-hidden="true">⚄</span> 随机翻一页 ↗</button></div>
      <nav class="chapter-grid" aria-label="博客分类">${[chapters.slice(0, 2), chapters.slice(2, 4), chapters.slice(4)].map((book, bookIndex) => `<div class="chapter-book" role="group" aria-label="${['日常与成长', '工作与关于我', '相遇与交流'][bookIndex]}">${book.map(([page, en, title, caption, number]) => `<a class="chapter-link chapter-${page}" href="#${page}"><div class="chapter-meta"><span>${number} / ${en}</span><span class="chapter-arrow" aria-hidden="true">↗</span></div><h3>${title}</h3><p>${caption}</p><span class="chapter-count">${['life', 'study', 'work'].includes(page) ? `${state.posts.filter(post => postPage(post) === page).length} 篇记录` : page === 'talk' ? `${state.topics.length} 条留言` : '很高兴认识你'}</span><span class="book-page-number" aria-hidden="true">— ${number} —</span></a>`).join('')}</div>`).join('')}</nav><a class="article-directory-link" href="#articles"><span><small>PERSONAL ESSAYS / ${state.posts.filter(post => post.type === 'article').length} 篇文章</small><strong>个人文章</strong><em>把想法写下来，留给以后的自己。</em></span><span aria-hidden="true">↗</span></a>
    </section>
    <section class="journal-latest" aria-labelledby="latest-title"><div class="journal-section-label"><h2 id="latest-title">最近碎片</h2><span>持续收集生活中的微光</span></div>
      <div class="journal-latest-grid"><div class="journal-entries">${latest.length ? latest.map((post, index) => `<a class="journal-entry" href="#${postPage(post)}?item=${encodeURIComponent(`post-${post.id}`)}"><span class="journal-entry-index">0${index + 1}</span><div><span class="journal-entry-category">${post.type === 'article' ? '个人文章' : post.type === 'life' ? '生活日记' : postPage(post) === 'work' ? '工作记录' : '学习手记'} · ${date(post.createdAt)}</span><h3>${esc(post.title)}</h3><p>${esc(post.content.slice(0, 76))}${post.content.length > 76 ? '…' : ''}</p></div><span aria-hidden="true">↗</span></a>`).join('') : '<p class="journal-empty">新的一页，等一个想记录的瞬间。</p>'}</div>
      <aside class="journal-letter"><span class="journal-kicker">A NOTE TO YOU</span><span class="letter-star" aria-hidden="true">✳</span><h3>你好呀，<br>我是${esc(state.profile.name)}。</h3><p>${esc(state.profile.bio)}</p><a href="#about">关于我的更多故事 ↗</a></aside></div>
    </section>
    <section class="journal-search" aria-label="搜索手帐">${searchPanel()}</section>
    <section class="journal-signoff"><p>很高兴，我们在这里相遇。</p><a href="#talk">欢迎和土豆交谈 <span aria-hidden="true">↗</span></a><span>土豆🥔</span></section>
  </div>`;
}
const fanPages = [
  { id: 'home', title: '首页', en: 'THE BEGINNING', desc: '回到故事开始的地方，翻开下一页。', angle: 8 },
  { id: 'life', title: '生活日记', en: 'LITTLE DAYS', desc: '把日常里的甜和暖，都悄悄收藏起来。', angle: 20 },
  { id: 'study', title: '学习', en: 'LEARNING NOTES', desc: '读到的、想到的、试过的。', angle: 32 },
  { id: 'work', title: '工作', en: 'WORK JOURNAL', desc: '正在做的项目，与认真完成的瞬间。', angle: 44 },
  { id: 'articles', title: '文章', en: 'PERSONAL ESSAYS', desc: '留一点篇幅，写自己的想法。', angle: 56 },
  { id: 'about', title: '关于我', en: 'NICE TO MEET YOU', desc: '你好呀，很高兴在这里与你相遇。', angle: 68 },
  { id: 'talk', title: '留言角', en: 'LET’S TALK', desc: '选一个小小话题，慢慢聊。', angle: 80 }
];
let fanOpen = false;
let fanSelection = 0;
let fanPanelAnimation = null;
let fanPreviewAnimation = null;
let fanNavigatePending = false;
let fanDrag = null;
let blurNavigationAnimation = null;
function fanPoint(angle, radius = 210) {
  const radians = angle * Math.PI / 180;
  return { x: 300 - Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}
function fanPaperArtwork() {
  const point = (angle, radius) => { const p = fanPoint(angle, radius); return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`; };
  const foldCount = fanPages.length * 2, foldAngle = 90 / foldCount;
  const folds = Array.from({ length: foldCount }, (_, index) => {
    const angle = index * foldAngle;
    return `<path class="fan-paper-leaf ${index % 2 ? 'is-valley' : 'is-ridge'}" data-fan-leaf="${fanPages[Math.floor(index / 2)].id}" style="--rib-angle:${angle}deg" d="M${point(angle, 64)}L${point(angle, 294)}Q${point(angle + foldAngle / 2, 302)} ${point(angle + foldAngle, 294)}L${point(angle + foldAngle, 64)}A64 64 0 0 1 ${point(angle, 64)}Z"/>`;
  }).join('');
  const ribs = Array.from({ length: foldCount + 1 }, (_, index) => `<path class="fan-rib ${index === 0 || index === foldCount ? 'is-guard' : ''}" style="--rib-angle:${index * foldAngle}deg" d="M300 0L${point(index * foldAngle, 294)}"/>`).join('');
  return `<svg class="fan-paper" viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="fan-silk" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8e9"/><stop offset=".5" stop-color="#f5e4df"/><stop offset="1" stop-color="#e3cfdb"/></linearGradient></defs><path fill="#fbf1e6" d="M300 0H210A90 90 0 0 0 300 90Z"/>${folds}${ribs}<path class="fan-paper-trim" d="M12 0A288 288 0 0 0 300 288M236 0A64 64 0 0 0 300 64"/><g class="fan-blossoms"><path d="M39 68q28 21 33 68m-15-29 18-15m-11 31-19-8"/><g transform="translate(53 87)"><circle cy="-4" r="3"/><circle cx="4" cy="-1" r="3"/><circle cx="2.5" cy="4" r="3"/><circle cx="-3" cy="3" r="3"/><circle cx="-4" cy="-2" r="3"/></g><g transform="translate(75 92) scale(.7)"><circle cy="-4" r="3"/><circle cx="4" cy="-1" r="3"/><circle cx="2.5" cy="4" r="3"/><circle cx="-3" cy="3" r="3"/><circle cx="-4" cy="-2" r="3"/></g><g transform="translate(66 123) scale(.8)"><circle cy="-4" r="3"/><circle cx="4" cy="-1" r="3"/><circle cx="2.5" cy="4" r="3"/><circle cx="-3" cy="3" r="3"/><circle cx="-4" cy="-2" r="3"/></g></g><circle class="fan-pivot" cx="300" cy="0" r="6"/></svg>`;
}
function syncFanNavigation() {
  if (adminMode) return;
  const root = document.querySelector('#fan-navigation');
  if (!root) return;
  root.hidden = route() === 'home';
  if (root.hidden) closeFanNavigation(false, false);
}
function fanPreviewContent(page) {
  let snippets;
  if (['life', 'study', 'work', 'articles'].includes(page.id)) snippets = state.posts.filter(post => postPage(post) === page.id).slice(0, 2).map(post => ({ title: post.title, text: post.content.slice(0, 100) }));
  else if (page.id === 'talk') snippets = state.topics.slice(0, 2).map(topic => ({ title: topic.title, text: topic.content.slice(0, 100) }));
  else if (page.id === 'about') snippets = [{ title: state.profile?.name || '土豆', text: state.profile?.bio || state.profile?.intro || '' }];
  else snippets = [{ title: '个人记事簿', text: '生活、学习与小小心事。' }];
  return `<div class="fan-preview-copy"><span>${page.en}</span><h2>${page.title}</h2><p>${page.desc}</p><div class="fan-preview-stories">${snippets.map(item => `<article><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join('')}</div><small>滑动选页 · 松开前往</small></div>`;
}
function selectFanPage(index, preview = true) {
  fanSelection = Math.max(0, Math.min(fanPages.length - 1, index));
  const page = fanPages[fanSelection];
  const panel = document.querySelector('#fan-panel');
  if (!panel) return;
  for (const button of panel.querySelectorAll('[data-fan-page]')) button.classList.toggle('is-selected', button.dataset.fanPage === page.id);
  for (const leaf of panel.querySelectorAll('[data-fan-leaf]')) leaf.classList.toggle('is-selected', leaf.dataset.fanLeaf === page.id);
  const knob = panel.querySelector('.fan-knob');
  const point = fanPoint(page.angle, 264);
  knob.style.left = `${point.x / 3}%`;
  knob.style.top = `${point.y / 3}%`;
  knob.setAttribute('aria-valuenow', String(fanSelection));
  knob.setAttribute('aria-valuetext', page.title);
  if (!preview) return;
  const layer = document.querySelector('#fan-preview');
  if (page.id === route()) {
    layer.hidden = true;
    document.body.classList.remove('fan-previewing');
    return;
  }
  document.body.classList.add('fan-previewing');
  layer.hidden = false;
  layer.innerHTML = fanPreviewContent(page);
  fanPreviewAnimation?.cancel();
  if (layer.animate && !motionReduced()) fanPreviewAnimation = layer.animate([
    { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' },
    { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
  ], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
}
function openFanNavigation() {
  if (adminMode || route() === 'home') return;
  const root = document.querySelector('#fan-navigation');
  const panel = document.querySelector('#fan-panel');
  const start = panel.hidden ? { opacity: 0, transform: 'scale(.12) rotate(-30deg)' } : { opacity: getComputedStyle(panel).opacity, transform: getComputedStyle(panel).transform };
  fanPanelAnimation?.cancel();
  fanOpen = true;
  panel.innerHTML = `${fanPaperArtwork()}<svg class="fan-arc" viewBox="0 0 300 300" aria-hidden="true"><path d="M36 0 A264 264 0 0 0 300 264"/></svg><span class="fan-caption">一扇 · 一页</span>${fanPages.map((page, index) => { const point = fanPoint(page.angle); return `<button class="fan-page" type="button" data-fan-page="${page.id}" style="left:${point.x / 3}%;top:${point.y / 3}%" ${page.id === route() ? 'aria-current="page"' : ''}><small aria-hidden="true">0${index + 1}</small><span>${page.title}</span></button>`; }).join('')}<button type="button" class="fan-knob" role="slider" aria-label="滑动选择页面，回车进入" aria-valuemin="0" aria-valuemax="${fanPages.length - 1}" aria-valuenow="0"><svg class="fan-charm" viewBox="0 0 44 64" aria-hidden="true"><defs><radialGradient id="fan-charm-jade" cx="35%" cy="25%" r="80%"><stop stop-color="#fffaf0"/><stop offset=".55" stop-color="#f3d5dd"/><stop offset="1" stop-color="#c998b3"/></radialGradient></defs><circle class="charm-focus-ring" cx="22" cy="23" r="21"/><path class="charm-cord" d="M22 36v10"/><g class="charm-fringe"><ellipse cx="22" cy="47" rx="3" ry="3.5"/><path d="M19 50q-2 5-2 10 5 3 10 0 0-5-2-10Z"/><path class="charm-threads" d="m20 51-1 9m3-9v10m2-10 1 9"/></g><g class="charm-flower"><path transform="rotate(0 22 23)" d="M22 24C10 19 13 7 22 7S34 19 22 24Z"/><path transform="rotate(72 22 23)" d="M22 24C10 19 13 7 22 7S34 19 22 24Z"/><path transform="rotate(144 22 23)" d="M22 24C10 19 13 7 22 7S34 19 22 24Z"/><path transform="rotate(216 22 23)" d="M22 24C10 19 13 7 22 7S34 19 22 24Z"/><path transform="rotate(288 22 23)" d="M22 24C10 19 13 7 22 7S34 19 22 24Z"/><g class="charm-veins"><path transform="rotate(0 22 23)" d="M22 19v-6"/><path transform="rotate(72 22 23)" d="M22 19v-6"/><path transform="rotate(144 22 23)" d="M22 19v-6"/><path transform="rotate(216 22 23)" d="M22 19v-6"/><path transform="rotate(288 22 23)" d="M22 19v-6"/></g><circle class="charm-heart" cx="22" cy="23" r="4"/><circle class="charm-glint" cx="20.8" cy="21.8" r="1.2"/></g></svg></button><p class="fan-help">轻移扇坠<br>松开翻页</p>`;
  panel.hidden = false;
  root.classList.add('is-open');
  const toggle = root.querySelector('#fan-toggle');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', '收起扇形导航');
  selectFanPage(fanPages.findIndex(page => page.id === route()), false);
  if (panel.animate && !motionReduced()) fanPanelAnimation = panel.animate([
    start,
    { opacity: 1, transform: 'scale(1) rotate(0)' }
  ], { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' });
  panel.querySelector('.fan-knob').focus({ preventScroll: true });
}
function clearFanPreview() {
  document.body.classList.remove('fan-previewing');
  const preview = document.querySelector('#fan-preview');
  if (preview) preview.hidden = true;
  fanPreviewAnimation?.cancel();
}
function closeFanNavigation(animate = true, focus = true, keepPreview = false) {
  const root = document.querySelector('#fan-navigation');
  if (!root) return;
  const panel = root.querySelector('#fan-panel');
  const toggle = root.querySelector('#fan-toggle');
  const start = !panel.hidden && fanPanelAnimation ? { opacity: getComputedStyle(panel).opacity, transform: getComputedStyle(panel).transform } : { opacity: 1, transform: 'scale(1) rotate(0)' };
  fanOpen = false;
  fanDrag = null;
  root.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', '打开扇形导航');
  if (!keepPreview) clearFanPreview();
  fanPanelAnimation?.cancel();
  fanPanelAnimation = null;
  if (!panel.hidden && animate && panel.animate && !motionReduced()) {
    const animation = panel.animate([start, { opacity: 0, transform: 'scale(.12) rotate(-30deg)' }], { duration: 280, easing: 'cubic-bezier(.4,0,1,1)' });
    fanPanelAnimation = animation;
    animation.finished.then(() => { if (fanPanelAnimation === animation) { panel.hidden = true; fanPanelAnimation = null; } }, () => {});
  } else panel.hidden = true;
  if (focus && !root.hidden) toggle.focus({ preventScroll: true });
}
function navigateFanSelection() {
  const page = fanPages[fanSelection].id;
  closeFanNavigation(true, false, page !== route());
  if (page === route()) return;
  fanNavigatePending = true;
  location.hash = `#${page}`;
}
async function blurPageTransition(commit) {
  const version = ++paperVersion;
  paperAnimation?.cancel();
  blurNavigationAnimation?.cancel();
  document.querySelector('#paper-transition').hidden = true;
  if (!app.animate || motionReduced()) { clearFanPreview(); document.body.classList.remove('page-blur-transition'); commit(); return; }
  document.body.classList.add('page-blur-transition');
  let committed = false;
  const showDestination = () => {
    commit();
    // Keep this rendered view from restarting its CSS arrival when the blur ends.
    if (app.firstElementChild) app.firstElementChild.style.animation = 'none';
    committed = true;
  };
  try {
    const preview = document.querySelector('#fan-preview');
    const previewing = document.body.classList.contains('fan-previewing');
    fanPreviewAnimation?.cancel();
    if (previewing && preview?.animate) fanPreviewAnimation = preview.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    blurNavigationAnimation = app.animate([{ opacity: previewing ? .24 : 1, filter: previewing ? 'blur(8px)' : 'blur(0)', transform: 'translateY(0)' }, { opacity: .4, filter: 'blur(14px)', transform: 'translateY(-8px)' }], { duration: 280, easing: 'ease-in-out', fill: 'forwards' });
    await blurNavigationAnimation.finished;
    if (version !== paperVersion) return;
    blurNavigationAnimation.cancel();
    clearFanPreview();
    showDestination();
    blurNavigationAnimation = app.animate([
      { opacity: .4, filter: 'blur(14px)', transform: 'translateY(12px)' },
      { opacity: .8, filter: 'blur(6px)', transform: 'translateY(4px)', offset: .5 },
      { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }
    ], { duration: 480, easing: 'ease-out', fill: 'both' });
    await blurNavigationAnimation.finished;
  } catch {
    if (version === paperVersion && !committed) { clearFanPreview(); showDestination(); }
  }
  finally { if (version === paperVersion) { blurNavigationAnimation?.cancel(); blurNavigationAnimation = null; document.body.classList.remove('page-blur-transition'); } }
}
const fanRoot = !adminMode && document.querySelector('#fan-navigation');
if (fanRoot) {
  const previewFanItem = target => {
    if (!fanOpen) return;
    const item = target.closest('[data-fan-page]');
    if (!item) return;
    const index = fanPages.findIndex(page => page.id === item.dataset.fanPage);
    if (index >= 0 && index !== fanSelection) selectFanPage(index);
  };
  fanRoot.addEventListener('pointerover', event => {
    if (event.pointerType !== 'touch' && !fanDrag) previewFanItem(event.target);
  });
  fanRoot.addEventListener('focusin', event => previewFanItem(event.target));
  fanRoot.addEventListener('click', event => {
    if (event.target.closest('#fan-toggle')) return fanOpen ? closeFanNavigation() : openFanNavigation();
    const item = event.target.closest('[data-fan-page]');
    if (item) { selectFanPage(fanPages.findIndex(page => page.id === item.dataset.fanPage)); navigateFanSelection(); }
  });
  fanRoot.addEventListener('pointerdown', event => {
    const panel = event.target.closest('#fan-panel');
    if (!panel || !fanOpen || event.button !== 0) return;
    previewFanItem(event.target);
    fanDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  fanRoot.addEventListener('pointermove', event => {
    if (!fanDrag || event.pointerId !== fanDrag.id) return;
    if (Math.hypot(event.clientX - fanDrag.x, event.clientY - fanDrag.y) < 6 && !fanDrag.moved) return;
    if (!fanDrag.moved) document.querySelector('#fan-panel').setPointerCapture(event.pointerId);
    fanDrag.moved = true;
    const rect = document.querySelector('#fan-panel').getBoundingClientRect();
    const angle = Math.atan2(event.clientY - rect.top, rect.right - event.clientX) * 180 / Math.PI;
    const nearest = fanPages.reduce((best, page, index) => Math.abs(page.angle - angle) < Math.abs(fanPages[best].angle - angle) ? index : best, 0);
    if (nearest !== fanSelection) selectFanPage(nearest);
  });
  fanRoot.addEventListener('pointerup', event => {
    if (!fanDrag || event.pointerId !== fanDrag.id) return;
    const moved = fanDrag.moved;
    fanDrag = null;
    if (moved) { event.preventDefault(); navigateFanSelection(); }
  });
  fanRoot.addEventListener('pointercancel', () => { fanDrag = null; });
  fanRoot.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeFanNavigation(); }
    else if (event.target.closest('.fan-knob')) {
      if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? fanPages.length - 1 : fanSelection + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1);
        selectFanPage(index);
      } else if (['Enter',' '].includes(event.key)) { event.preventDefault(); navigateFanSelection(); }
    }
  });
  document.addEventListener('pointerdown', event => { if (fanOpen && !event.target.closest('#fan-navigation')) closeFanNavigation(); });
}
function pageHead(eyebrow, title, desc, action = '') { return `<div class="page-head"><div class="page-head-copy"><a class="back-to-directory" href="#home?item=home-chapters">← 返回目录</a><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p>${action ? `<div class="page-head-action">${action}</div>` : ''}</div>${['talk', 'study', 'work', 'articles'].includes(route()) ? '' : '<img class="page-head-art" src="./assets/rin-saber-chibi.png" alt="" aria-hidden="true">'}</div>`; }
const lifeArchiveState = { year: '', month: '' };
function lifeArchivePosts() {
  return state.posts.filter(post => post.type === 'life').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function lifePostCard(post) {
  return `<article id="post-${esc(post.id)}" class="post-card life-entry"><div class="post-top"><span class="tag">${esc(post.tag || '日常碎片')}</span><span class="life-entry-star" aria-hidden="true">✳</span></div><h2>${esc(post.title)}</h2><p>${esc(post.content)}</p>${postImageGallery(post.images)}<div class="post-foot"><span>${post.updatedAt ? `✎ 编辑于 ${date(post.updatedAt)}` : '写给今天的自己'}</span>${state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑</button><button class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除</button></span>` : '<span aria-hidden="true">↗</span>'}</div></article>`;
}
function lifeArchiveView() {
  const posts = lifeArchivePosts();
  const years = [...new Set(posts.map(post => dateKey(post.createdAt).slice(0, 4)))];
  if (lifeArchiveState.year && !years.includes(lifeArchiveState.year)) { lifeArchiveState.year = ''; lifeArchiveState.month = ''; }
  const yearPosts = posts.filter(post => !lifeArchiveState.year || dateKey(post.createdAt).startsWith(lifeArchiveState.year));
  const months = [...new Set(yearPosts.map(post => dateKey(post.createdAt).slice(0, 7)))];
  if (!months.includes(lifeArchiveState.month)) lifeArchiveState.month = '';
  const visible = yearPosts.filter(post => !lifeArchiveState.month || dateKey(post.createdAt).startsWith(lifeArchiveState.month));
  const groups = new Map();
  for (const post of visible) {
    const key = dateKey(post.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(post);
  }
  const monthLabel = key => `${key.slice(0, 4)} / ${Number(key.slice(5))}月`;
  return `<div class="life-archive-layout"><aside class="life-archive-index"><span class="journal-kicker">THE DAYS WE KEEP</span><h2>日子有迹<span aria-hidden="true">✿</span></h2><p>沿着时间，翻回某一天。</p><nav class="life-year-nav" aria-label="按年份筛选"><button type="button" data-life-year="" aria-pressed="${!lifeArchiveState.year}">全部年份 <small>${posts.length}</small></button>${years.map(year => `<button type="button" data-life-year="${year}" aria-pressed="${lifeArchiveState.year === year}">${year} 年 <small>${posts.filter(post => dateKey(post.createdAt).startsWith(year)).length}</small></button>`).join('')}</nav><div class="life-archive-note"><span aria-hidden="true">✳</span><p>把普通的日子<br>过成值得收藏的诗。</p><small>little things, lovely days</small></div></aside><section class="life-archive-main" aria-label="按日期归档的生活日记"><nav class="life-month-nav" aria-label="按月份筛选"><button type="button" data-life-month="" aria-pressed="${!lifeArchiveState.month}">全部月份</button>${months.map(month => `<button type="button" data-life-month="${month}" aria-pressed="${lifeArchiveState.month === month}">${monthLabel(month)} <small>${yearPosts.filter(post => dateKey(post.createdAt).startsWith(month)).length}</small></button>`).join('')}</nav><div class="life-archive-summary" role="status"><span>${lifeArchiveState.month ? monthLabel(lifeArchiveState.month) : lifeArchiveState.year ? `${lifeArchiveState.year} 年的日常` : '所有值得记住的日子'}</span><small>${visible.length} 篇日记 · ${groups.size} 个日子</small></div><div class="life-timeline">${[...groups].map(([day, entries]) => `<section class="life-day"><div class="life-date"><time datetime="${day}"><strong>${day.slice(8)}</strong><span>${day.slice(0, 4)} / ${day.slice(5, 7)}</span><small>${new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(new Date(`${day}T12:00:00`))}</small></time></div><div class="life-day-entries">${entries.map(lifePostCard).join('')}</div></section>`).join('') || '<p class="life-empty">还没有写下日记，留一点空白给即将发生的美好。✿</p>'}</div></section></div>`;
}
function postsPage(type) {
  if (type !== 'life') return studyPage();
  const action = state.admin ? '<button class="btn tiny" data-action="new-post" data-type="life">＋ 写一篇日记</button>' : '';
  const targetId = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
  const target = lifeArchivePosts().find(post => `post-${post.id}` === targetId);
  if (target) { lifeArchiveState.year = dateKey(target.createdAt).slice(0, 4); lifeArchiveState.month = dateKey(target.createdAt).slice(0, 7); }
  return `<div class="container page page-life">${pageHead('MY LITTLE DAYS', '生活日记 🌷', '把日常里的甜和暖，都悄悄收藏起来。', action)}<div id="life-archive">${lifeArchiveView()}</div>${bottomSearch()}</div>`;
}
function articlesPage() {
  const posts = state.posts.filter(post => post.type === 'article').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const targetId = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
  const selected = posts.find(post => `post-${post.id}` === targetId);
  const actions = post => state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑文章</button><button class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除文章</button></span>` : '';
  const content = selected ? `<article class="personal-article" id="post-${esc(selected.id)}"><a class="article-back" href="#articles">← 所有文章</a><header><div class="article-meta"><time datetime="${esc(selected.createdAt)}">${date(selected.createdAt)}</time><span>${esc(selected.tag || '随笔与想法')}</span></div><h2>${esc(selected.title)}</h2>${selected.updatedAt ? `<small>更新于 ${date(selected.updatedAt)}</small>` : ''}</header><div class="article-body">${esc(selected.content)}</div>${postImageGallery(selected.images)}<footer>${actions(selected)}<a class="article-back" href="#articles">回到文章列表 ↗</a></footer></article>` : targetId ? '<div class="article-empty"><h2>这篇文章暂时找不到了</h2><a class="article-back" href="#articles">返回文章列表 ↗</a></div>' : `<div class="article-list-heading"><span>慢慢写，慢慢想。</span><small>${posts.length} 篇文章</small></div><div class="article-list">${posts.map((post,index) => `<article class="article-list-item"><div class="article-list-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</div><div class="article-list-copy"><div class="article-meta"><time datetime="${esc(post.createdAt)}">${date(post.createdAt)}</time><span>${esc(post.tag || '随笔与想法')}</span></div><h2><a href="#articles?item=${encodeURIComponent(`post-${post.id}`)}">${esc(post.title)}</a></h2><p>${esc(post.content.slice(0,150))}${post.content.length > 150 ? '…' : ''}</p><div class="article-list-footer"><a class="article-read" href="#articles?item=${encodeURIComponent(`post-${post.id}`)}">阅读全文 <span aria-hidden="true">↗</span></a>${actions(post)}</div></div></article>`).join('') || '<div class="article-empty"><span aria-hidden="true">✳</span><h2>给还没写下的想法，留一页空白。</h2><p>关于生活的思考、偶然的感悟，或是一段想认真说的话。</p></div>'}</div>`;
  return `<div class="container page page-articles">${pageHead('PERSONAL ESSAYS','个人文章','写下自己的想法，也留下思考的过程。',state.admin ? '<button class="btn tiny" data-action="new-post" data-type="article">＋ 写一篇文章</button>' : '')}<section class="personal-writing" aria-label="个人文章">${content}</section>${bottomSearch()}</div>`;
}
function studySection(post) {
  if (post.section === 'work' || post.section === 'learning') return post.section;
  return /工作|职场|实习|会议/.test(post.tag || '') ? 'work' : 'learning';
}
function studyPostCard(post, index) {
  return `<article id="post-${esc(post.id)}" class="post-card paper-card"><div class="post-top"><div class="post-label"><span class="post-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="tag">${esc(post.tag || (studySection(post) === 'work' ? '工作记录' : '学习笔记'))}</span></div><time class="date" datetime="${esc(post.createdAt)}">${date(post.createdAt)}</time></div><h2>${esc(post.title)}</h2><p>${esc(post.content)}</p>${postImageGallery(post.images)}<div class="post-foot"><span>${post.updatedAt ? `✎ 编辑于 ${date(post.updatedAt)}` : '🥔 写给今天的自己'}</span>${state.admin ? `<span class="admin-actions"><button class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑</button><button class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除</button></span>` : '<span>✦</span>'}</div></article>`;
}
const studyCalendarState = { learning: { month: '', day: '' }, work: { month: '', day: '' } };
function archivedStudyPosts(section) {
  return state.posts.filter(post => post.type === 'study' && studySection(post) === section && dateKey(post.createdAt) !== localDay());
}
function studyCalendarView(section, older) {
  const months = [...new Set(older.map(post => dateKey(post.createdAt).slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  if (!months.length) return '<div class="study-archive-empty">过去的记录会收藏在这里。</div>';
  const selection = studyCalendarState[section];
  if (!months.includes(selection.month)) { selection.month = months[0]; selection.day = ''; }
  const month = selection.month;
  const [year, number] = month.split('-').map(Number);
  const dayPosts = new Map();
  for (const post of older) {
    const key = dateKey(post.createdAt);
    if (key.startsWith(month)) {
      if (!dayPosts.has(key)) dayPosts.set(key, []);
      dayPosts.get(key).push(post);
    }
  }
  if (!dayPosts.has(selection.day)) selection.day = '';
  const offset = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, number, 0).getDate();
  const cells = Array.from({ length: offset }, () => '<span class="study-calendar-blank" aria-hidden="true"></span>');
  for (let day = 1; day <= days; day++) {
    const key = `${month}-${String(day).padStart(2, '0')}`;
    const count = dayPosts.get(key)?.length || 0;
    cells.push(count
      ? `<button type="button" class="study-calendar-day has-notes" data-study-day="${key}" aria-label="${number}月${day}日，${count}篇记录" aria-pressed="${selection.day === key}"><span>${day}</span><i aria-hidden="true"></i></button>`
      : `<span class="study-calendar-day" aria-label="${number}月${day}日">${day}</span>`);
  }
  const index = months.indexOf(month);
  const selected = dayPosts.get(selection.day) || [];
  return `<div class="study-archive-heading"><strong>往日归档</strong><small>${older.length} 篇记录 · 点亮的日期可打开</small></div><div class="study-calendar-layout"><div class="study-calendar"><div class="study-calendar-nav"><button type="button" data-study-month="previous" aria-label="较早的归档月份" ${index === months.length - 1 ? 'disabled' : ''}>‹</button><strong tabindex="-1">${year} 年 ${number} 月</strong><button type="button" data-study-month="next" aria-label="较新的归档月份" ${index === 0 ? 'disabled' : ''}>›</button></div><div class="study-calendar-weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="study-calendar-grid">${cells.join('')}</div></div>${selected.length ? `<div class="study-day-content" aria-live="polite"><div class="study-day-title"><span>${date(new Date(`${selection.day}T12:00:00`))}</span><small>${selected.length} 篇记录</small></div><div class="study-day-posts">${selected.map((post, index) => studyPostCard(post, index)).join('')}</div></div>` : ''}</div>`;
}
function openStudyArchivedPost(id) {
  const post = state.posts.find(item => `post-${item.id}` === id && ['study', 'article'].includes(item.type));
  if (!post) return null;
  const section = studySection(post);
  const archive = document.querySelector(`.study-lane-${section} .study-archive`);
  if (!archive) return null;
  const day = dateKey(post.createdAt);
  studyCalendarState[section] = { month: day.slice(0, 7), day };
  updateContent(archive, () => { archive.innerHTML = studyCalendarView(section, archivedStudyPosts(section)); });
  return document.getElementById(id);
}
function studyLane(section, title, English, icon, caption) {
  const posts = state.posts.filter(post => post.type === 'study' && studySection(post) === section);
  const today = posts.filter(post => dateKey(post.createdAt) === localDay());
  const older = posts.filter(post => dateKey(post.createdAt) !== localDay());
  return `<section class="study-lane study-lane-${section}" id="study-${section}" aria-labelledby="study-${section}-title"><div class="study-lane-head"><div class="study-lane-icon" aria-hidden="true">${icon}</div><div><span class="study-kicker">${English} / ${String(posts.length).padStart(2, '0')}</span><h2 id="study-${section}-title">${title}</h2><p>${caption}</p></div>${state.admin ? `<button class="btn tiny" data-action="new-post" data-type="study" data-section="${section}">＋ 写一篇</button>` : ''}</div>${typeof renderActivityPanel === 'function' ? renderActivityPanel(section === 'learning' ? 'luogu' : 'github') : ''}<div class="study-today"><div class="study-subhead"><span>今天的记录</span><time datetime="${localDay()}">${date(new Date())}</time></div>${today.length ? today.map((post, index) => studyPostCard(post, index)).join('') : '<div class="study-today-empty">今天还没有新记录，留一页给正在发生的故事。</div>'}</div><div class="study-archive" data-section="${section}">${studyCalendarView(section, older)}</div></section>`;
}
function readingPlanCard() {
  const plan = state.readingPlan || {};
  const hasBook = Boolean(plan.book);
  const progress = hasBook ? Math.min(100, Math.max(0, Number(plan.progress) || 0)) : 0;
  const wave = '<svg class="reading-wave" viewBox="0 0 240 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 Q15 0 30 8 T60 8 T90 8 T120 8 T150 8 T180 8 T210 8 T240 8 V24 H0Z"/></svg>';
  const progressBar = `<div class="reading-progress-label"><span>${hasBook ? '阅读进度' : '等待翻开第一页'}</span><strong>${progress}%</strong></div><div class="reading-wave-track" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="reading-wave-idle">${wave}</div><div class="reading-wave-fill" style="width:${progress}%">${wave}${wave}</div></div>`;
  return `<div class="study-companion study-companion-compact"><button class="study-runner" type="button" aria-label="和五条悟一起为阅读加油"><img src="./assets/study-runner.png" width="1415" height="1111" alt="在阅读计划旁边奔跑的五条悟"></button><aside id="reading-plan" class="side-note paper-card reading-plan-card" aria-labelledby="reading-plan-title"><div class="reading-plan-heading"><span class="emoji" aria-hidden="true">📚</span><div><span class="study-kicker">READING PLAN</span><h3 id="reading-plan-title">阅读计划</h3></div></div>${hasBook ? `<p class="reading-book">《${esc(plan.book)}》</p>${plan.author ? `<p class="reading-author">${esc(plan.author)} 著</p>` : ''}${plan.goal ? `<p class="reading-goal"><span>目标</span>${esc(plan.goal)}</p>` : ''}${progressBar}<div class="reading-reflection"><h4>阅读心得</h4><p>${esc(plan.note || "读到的触动，慢慢记在这里。")}</p><button type="button" class="quiet-button" data-action="open-reading-book" data-id="current">查看阅读日志 · ${(plan.logs || []).length} 条 ↗</button></div>` : `<p class="reading-empty">还没有设定阅读计划。下一本想读的书，从这里开始。</p>${progressBar}`}${state.admin ? '<button class="quiet-button reading-edit" type="button" data-action="edit-reading-plan">✎ 编辑计划</button>' : ''}<span class="runner-hint" role="status">点点他，给阅读计划加点动力 ↗</span></aside></div>`;
}
let libraryExpanded = true;
function readingHistoryView() {
  const books = state.readingHistory || [];
  const groups = Array.from({ length: Math.ceil(books.length / 5) }, (_, index) => books.slice(index * 5, index * 5 + 5));
  return `<section class="reading-library ${libraryExpanded ? 'is-open' : ''}" id="reading-library" aria-labelledby="reading-library-title"><header class="reading-library-heading"><div><span class="study-kicker">THE BOOKS THAT STAY</span><h2 id="reading-library-title">历史书库 <i>✳</i></h2><p>翻开读过的书，也翻开当时的自己。</p></div><div class="library-controls"><span class="reading-library-count">${books.length} 本已读</span>${books.length ? `<button class="quiet-button library-toggle" data-action="toggle-library" aria-expanded="${libraryExpanded}" aria-controls="library-fans">${libraryExpanded ? '收拢书页' : '展开书页'} ↗</button>` : ''}</div></header>${books.length ? `<p class="library-guide">轻选一本，让书页浮起 · 点击查看心得与更新日志</p><div id="library-fans" ${libraryExpanded ? '' : 'inert'}>${groups.map((group, groupIndex) => `<div class="library-fan" aria-label="第 ${groupIndex + 1} 组藏书">${group.map((book, index) => {
    const position = index - (group.length - 1) / 2;
    return `<button type="button" class="library-cover cover-tone-${(groupIndex * 5 + index) % 4}" id="read-${esc(book.id)}" data-action="open-reading-book" data-id="${esc(book.id)}" aria-haspopup="dialog" aria-label="查看《${esc(book.book)}》阅读记录" style="--position:${position};--angle:${position * 5}deg;--rise:${Math.abs(position) * 7}px;--stack:${index}"><span class="book-cover-top">READ & REMEMBER <span>${String(groupIndex * 5 + index + 1).padStart(2, '0')}</span></span><span class="book-cover-title">${esc(book.book)}</span><span class="book-cover-author">${esc(book.author || '一本读过的书')}</span><span class="book-cover-flower" aria-hidden="true">✳</span><span class="book-cover-foot">✓ 已读完 <span>翻阅 ↗</span></span></button>`;
  }).join('')}</div>`).join('')}</div>` : `<div class="library-empty-scene"><div class="library-empty-pages" aria-hidden="true"><span>下一页</span></div><div><h3>给下一本好书，留一个位置。</h3><p>阅读进度达到 100% 后，会自动收录书籍与一路写下的心得。</p>${state.admin ? '<button class="quiet-button" data-action="edit-reading-plan">开始记录一本书 ↗</button>' : ''}</div></div>`}</section>`;
}
function readingLogList(logs = [], bookId = '') {
  return logs.length ? `<ol class="reading-log-list">${[...logs].reverse().map(log => `<li><div class="reading-log-top"><span>${esc(log.kind || '阅读更新')} · ${Number(log.progress) || 0}%</span><small>${log.createdAt ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.createdAt)) : '原有记录 · 日期未记录'}</small></div>${log.note ? `<p>${esc(log.note)}</p>` : '<p class="reading-log-quiet">这次记录了阅读进度。</p>'}${log.editedAt ? '<small class="reading-log-edited">已编辑</small>' : ''}${state.admin && bookId ? `<button type="button" class="quiet-button" data-action="edit-reading-log" data-id="${esc(bookId)}" data-log="${esc(log.id)}">编辑这条记录</button>` : ''}</li>`).join('')}</ol>` : '<p class="reading-log-quiet">还没有更新记录，保存阅读进度或心得后会出现在这里。</p>';
}
function readingBookModal(id) {
  const book = id === 'current' ? state.readingPlan : state.readingHistory.find(item => item.id === id);
  if (!book) return;
  openModal(`<section class="reading-detail"><span class="journal-kicker">A BOOK, A JOURNEY</span><h2>${esc(book.book)}</h2><p class="reading-detail-byline">${esc(book.author || '作者未填写')} · ${id === 'current' ? `${Number(book.progress) || 0}% 已读` : book.completedAt ? `${date(book.completedAt)} 读完` : '已读完 · 日期未记录'}</p>${state.admin ? `<button class="quiet-button" data-action="${id === 'current' ? 'edit-reading-plan' : 'edit-reading-book'}" data-id="${esc(id)}">✎ 编辑${id === 'current' ? '阅读计划' : '书籍与心得'}</button>` : ''}<div class="reading-detail-reflection"><h3>阅读心得</h3><p>${esc(book.note || '还没有写下心得。')}</p>${book.goal ? `<small>阅读目标 · ${esc(book.goal)}</small>` : ''}</div><h3 class="reading-log-heading">阅读更新日志 <small>${(book.logs || []).length} 次记录</small></h3><div class="reading-log-scroll">${readingLogList(book.logs, id === 'current' ? '' : id)}</div></section>`);
}
function readingBookEditor(id) {
  const book = state.readingHistory.find(item => item.id === id);
  if (!book || !state.admin) return;
  openModal(`<h2>编辑书库记录</h2><p>修改书籍资料或补充心得，保存后会留下更新日志。</p><form id="reading-book-form" data-id="${esc(id)}"><label for="history-book">书名</label><input class="field" id="history-book" name="book" maxlength="100" required value="${esc(book.book)}"><label for="history-author">作者</label><input class="field" id="history-author" name="author" maxlength="80" value="${esc(book.author)}"><label for="history-date">读完日期（可选）</label><input class="field" type="date" id="history-date" name="completedAt" value="${book.completedAt ? dateKey(book.completedAt) : ''}"><label for="history-goal">阅读目标</label><input class="field" id="history-goal" name="goal" maxlength="160" value="${esc(book.goal)}"><label for="history-note">阅读心得</label><textarea class="field" id="history-note" name="note" maxlength="2000">${esc(book.note)}</textarea><p class="form-error" role="alert"></p><button class="btn" type="submit">保存更新</button></form>`);
}
function readingLogEditor(id, logId) {
  const log = state.readingHistory.find(book => book.id === id)?.logs?.find(item => item.id === logId);
  if (!log || !state.admin) return;
  openModal(`<h2>编辑阅读日志</h2><p>保留原始记录时间，修正进度或心得。</p><form id="reading-log-form" data-id="${esc(id)}" data-log="${esc(logId)}"><label for="log-progress">当时的阅读进度</label><input class="field" type="number" min="0" max="100" step="1" name="progress" id="log-progress" required value="${Number(log.progress) || 0}"><label for="log-note">这次的心得</label><textarea class="field" id="log-note" name="note" maxlength="2000">${esc(log.note)}</textarea><p class="form-error" role="alert"></p><button class="btn" type="submit">保存日志</button></form>`);
}
function growthPageNav(page) {
  return `<nav class="growth-page-nav" aria-label="学习与工作页面"><a href="#study" ${page === 'study' ? 'aria-current="page"' : ''}><span>01 / LEARNING</span>学习手记 ↗</a><a href="#work" ${page === 'work' ? 'aria-current="page"' : ''}><span>02 / WORK</span>工作记录 ↗</a></nav>`;
}
function studyPage() {
  return `<div class="container page page-study">${pageHead('LEARNING NOTES', '学习手记 📖', '把读到的、想到的，慢慢收进日子里。')}${growthPageNav('study')}${studyLane('learning', '学习内容', 'LEARNING', '✏️', '一点点积累，慢慢长成喜欢的样子。')}${readingPlanCard()}${readingHistoryView()}${bottomSearch()}</div>`;
}
function workPage() {
  return `<div class="container page page-work">${pageHead('WORK JOURNAL', '工作记录 📎', '让正在做的事，一点点有了形状。')}${growthPageNav('work')}${typeof renderProjects === 'function' ? renderProjects() : ''}${studyLane('work', '工作内容', 'WORK', '📎', '把每个认真完成的瞬间，留在这里。')}${bottomSearch()}<footer class="work-updates-footer"><button type="button" class="work-updates-link" data-action="show-updates" aria-haspopup="dialog">更新日志</button><hr></footer></div>`;
}
function blogUpdates() {
  return state.posts.filter(post => post.type === 'update').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || String(a.id).localeCompare(String(b.id)));
}
function blogUpdatesModal() {
  const updates = blogUpdates();
  openModal(`<section class="blog-updates" aria-labelledby="blog-updates-title"><header class="blog-updates-heading"><div><span class="journal-kicker">CHANGELOG</span><h2 id="blog-updates-title">更新日志</h2><p>博客的新功能与修复记录 · 最近更新在前</p></div>${state.admin ? '<button type="button" class="quiet-button" data-action="new-post" data-type="update">＋ 写更新</button>' : ''}</header>${updates.length ? `<ol class="blog-updates-list">${updates.map(post => `<li><article id="post-${esc(post.id)}"><time datetime="${esc(post.createdAt)}">${date(post.createdAt)}</time>${post.tag ? `<span class="blog-update-tag">${esc(post.tag)}</span>` : ''}<h3>${esc(post.title)}</h3><p class="blog-update-content">${esc(post.content)}</p>${postImageGallery(post.images)}${state.admin ? `<div class="admin-actions"><button type="button" class="quiet-button" data-action="edit-post" data-id="${esc(post.id)}">编辑</button><button type="button" class="quiet-button" data-action="delete-post" data-id="${esc(post.id)}">删除</button></div>` : ''}</article></li>`).join('')}</ol>` : '<p class="blog-updates-empty">还没有更新记录。</p>'}</section>`);
  modal.setAttribute('aria-labelledby', 'blog-updates-title');
}
function todaysQuote() {
  const day = Math.floor(Date.parse(localDay()) / 86400000);
  return dailyQuotes[day % dailyQuotes.length];
}
function refreshDailyQuote() {
  const scene = document.querySelector('.saber-scene');
  if (!scene || scene.dataset.day === localDay()) return;
  const [original, translation, source] = todaysQuote();
  scene.dataset.day = localDay();
  scene.querySelector('.saber-quote-original').textContent = original;
  scene.querySelector('.saber-quote-translation').textContent = translation;
  scene.querySelector('.saber-quote-source').textContent = `— ${source}`;
}
if (typeof setInterval === 'function') setInterval(refreshDailyQuote, 60000);
function hobbyItems(profile) {
  if (Array.isArray(profile.hobbyDetails)) return profile.hobbyDetails;
  return String(profile.interests || '').split(/[/／、，,|]+/).map(name => name.trim()).filter(Boolean).map(name => ({ name, detail: '' }));
}
function hobbyDetailHtml(value) {
  const text = String(value || '');
  let html = '', cursor = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)/g)) {
    html += esc(text.slice(cursor, match.index));
    const href = schoolLink(match[2]);
    html += href ? `<a class="hobby-detail-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(match[1])}<i aria-hidden="true">↗</i></a>` : esc(match[0]);
    cursor = match.index + match[0].length;
  }
  return html + esc(text.slice(cursor));
}
function hobbyGrid(profile) {
  const items = hobbyItems(profile);
  return `<div class="profile-hobbies"><div class="hobby-label">🥔 爱好</div><div class="hobby-grid">${items.length ? items.map((item, index) => `<div class="hobby-cell"><span class="hobby-cell-number">${String(index + 1).padStart(2, '0')}</span><strong>${esc(item.name)}</strong><p>${item.detail ? hobbyDetailHtml(item.detail) : '还没有写下介绍'}</p></div>`).join('') : '<div class="hobby-cell hobby-cell-empty">还没有填写爱好</div>'}</div></div>`;
}
const educationStages = [
  ['educationPrimary', '小学'], ['educationMiddle', '初中'], ['educationHigh', '高中'],
  ['educationBachelor', '本科'], ['educationMaster', '硕士'], ['educationDoctor', '博士'], ['educationPostdoc', '博士后']
];
function schoolLink(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
function educationRows(profile) {
  const entries = educationStages.filter(([key]) => profile[key] || schoolLink(profile[`${key}Url`]));
  if (!entries.length && !profile.education) return '';
  return `<div class="profile-education"><span>🎓 教育经历</span>${entries.length ? `<dl class="education-timeline">${entries.map(([key, label]) => {
    const href = schoolLink(profile[`${key}Url`]);
    const text = String(profile[key] || '').trim();
    const separator = text.search(/[/／\n]/);
    const school = separator < 0 ? text : text.slice(0, separator).trim();
    const detail = separator < 0 ? '' : text.slice(separator);
    return `<div><dt>${label}</dt><dd>${href ? `<a class="school-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="打开${esc(school || label)}学校网站">${esc(school || '学校官网')} <i aria-hidden="true">↗</i></a>${esc(detail)}` : esc(text)}</dd></div>`;
  }).join('')}</dl>` : ''}${profile.education ? `<div class="meta-detail">${esc(profile.education)}</div>` : ''}</div>`;
}
function educationEditor(profile) {
  return `<fieldset class="education-editor"><legend>🎓 教育经历</legend><p>按阶段填写学校、专业或时间，可附上学校官网链接；未填写的阶段不会展示。</p>${educationStages.map(([key, label]) => `<div class="education-stage-editor"><label for="profile-${key}">${label}</label><input class="field" id="profile-${key}" name="${key}" value="${esc(profile[key])}" maxlength="500" placeholder="学校 / 专业 / 就读时间（选填）"><label class="school-link-label" for="profile-${key}Url">${label}学校链接（选填）</label><input class="field" id="profile-${key}Url" name="${key}Url" type="url" value="${esc(profile[`${key}Url`])}" maxlength="500" placeholder="https://www.school.edu.cn"></div>`).join('')}<label for="profile-education">补充说明</label><textarea class="field" id="profile-education" name="education" maxlength="2000">${esc(profile.education)}</textarea></fieldset>`;
}
function githubContact(profile) {
  const github = String(profile.github || '').trim();
  const match = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/?$/.exec(github);
  let href = '';
  const supplied = String(profile.githubUrl || '').trim();
  if (supplied) {
    try {
      const url = new URL(supplied);
      if (['https:', 'http:'].includes(url.protocol) && ['github.com', 'www.github.com'].includes(url.hostname) && !url.username && !url.password && !url.port) href = url.href;
    } catch {}
  } else if (match) href = `https://github.com/${match[1]}`;
  return { name: match ? match[1] : github, href, supplied };
}
function githubEditor(profile) {
  const github = githubContact(profile);
  return `<fieldset class="github-editor"><legend>⌘ GitHub</legend><label for="profile-github">用户名</label><input class="field" id="profile-github" name="github" value="${esc(github.name)}" maxlength="120" placeholder="例如：octocat"><label for="profile-githubUrl">主页链接</label><input class="field" id="profile-githubUrl" name="githubUrl" type="url" value="${esc(github.supplied || github.href)}" maxlength="500" placeholder="https://github.com/octocat"><p>粘贴完整网址后，访客点击用户名即可打开；只填用户名时会自动生成 GitHub 主页链接。</p></fieldset>`;
}
function contactRows(profile) {
  const phone = String(profile.phone || '').trim();
  const phoneHref = /^\+?[\d\s().-]{5,30}$/.test(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';
  const github = githubContact(profile);
  const rows = [
    ['✉️ 邮箱', profile.email, profile.email ? `mailto:${profile.email}` : ''],
    ['📱 电话', phone, phoneHref],
    ['🐧 QQ', profile.qq, ''],
    ['💬 微信', profile.wechat, ''],
    ['⌘ GitHub', github.name || (github.href ? 'GitHub 主页' : ''), github.href]
  ];
  return rows.filter(([, value]) => value).map(([label, value, href]) => `<div><span>${label}</span>${href ? `<a href="${esc(href)}"${/^https?:/.test(href) ? ' class="contact-external-link" target="_blank" rel="noopener noreferrer"' : ''}>${esc(value)}${/^https?:/.test(href) ? '<i aria-hidden="true">↗</i>' : ''}</a>` : esc(value)}</div>`).join('');
}
function about() {
  const p = state.profile;
  const [original, translation, source] = todaysQuote();
  return `<div class="container page page-about">${pageHead('NICE TO MEET YOU', '关于我 🎀', '你好呀，很高兴在这里与你相遇。', state.admin ? '<button class="btn tiny" data-action="edit-profile">✎ 编辑资料</button>' : '')}<div class="about-layout"><section id="profile" class="profile-card paper-card" aria-labelledby="profile-name"><header class="profile-identity"><div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="${esc(p.name)}的头像">` : '🌸'}</div><div class="profile-identity-copy"><h2 id="profile-name">${esc(p.name)}</h2><div class="handle">@${esc((p.handle || "").replace(/^@+/, ""))}</div><p>${esc(p.intro)}</p></div></header>${p.bio ? `<div class="profile-bio"><span class="journal-kicker">A LETTER FROM ME</span><p>${esc(p.bio)}</p></div>` : ""}<div class="divider"></div><div class="meta"><div><span>📍 家乡</span>${esc(p.location)}</div>${contactRows(p)}${p.contactNote ? `<div class="contact-note">${esc(p.contactNote)}</div>` : ''}${p.birthday ? `<div><span>🎂 生日</span>${esc(p.birthday)}</div>` : ''}${p.workExperience ? `<div><span>💼 工作经历</span><div class="meta-detail">${esc(p.workExperience)}</div></div>` : ''}${educationRows(p)}${hobbyGrid(p)}</div></section></div><aside class="about-content quote-note" aria-label="今日寄语"><div class="quote-note-label"><span>✦ 今日寄语</span><small>A LITTLE LIGHT FOR YOU</small></div><div class="quote-note-body"><h2>送你一点小小光亮</h2><button class="saber-scene" data-day="${localDay()}" type="button" aria-label="让 Saber 举高寄语框" aria-pressed="false"><span class="saber-lift"><span class="saber-frame"><span class="saber-frame-label">A LITTLE LIGHT FOR YOU</span><span class="saber-quote-original">${esc(original)}</span><span class="saber-quote-translation">${esc(translation)}</span><span class="saber-quote-source">— ${esc(source)}</span><span class="saber-spark" aria-hidden="true">✦</span></span><img class="saber-character" src="./assets/saber-frame.png" alt="Saber 双手托着寄语框" width="1176" height="1337"></span><span class="saber-hint">点点我，把小小光亮举高一点 ↑</span></button></div></aside>${bottomSearch()}</div>`;
}
function bottomSearch() {
  return `<section class="page-bottom-search" aria-label="页面底部搜索">${searchPanel()}</section>`;
}
function talk() {
  const topics = state.topics.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="container page page-talk">${pageHead('LET’S TALK', '留言角 🥔', '选一个话题，点开气泡，慢慢聊。', '<button class="btn tiny" data-action="new-topic">＋ 发起话题</button>')}<div class="talk-bubble-heading"><span class="journal-kicker">LITTLE CONVERSATIONS</span><p>${topics.length} 个话题 · 点击气泡查看和留言</p></div><div class="talk-bubbles">${topics.map((topic, index) => `<article id="topic-${esc(topic.id)}" class="talk-bubble bubble-tone-${index % 3}"><button class="talk-bubble-open" type="button" data-action="open-topic" data-id="${esc(topic.id)}" aria-haspopup="dialog"><span class="bubble-meta">${esc(topic.author)} <time datetime="${esc(topic.createdAt)}">${date(topic.createdAt)}</time></span><h2>${esc(topic.title)}</h2><p>${esc(topic.content.slice(0, 120))}${topic.content.length > 120 ? '…' : ''}</p><span class="bubble-invitation"><span>💬 ${topic.replies.length} 条留言</span><span>加入聊天 ↗</span></span></button>${state.admin ? `<div class="bubble-admin"><button class="quiet-button" data-action="edit-topic" data-id="${esc(topic.id)}">编辑</button><button class="quiet-button" data-action="delete-topic" data-id="${esc(topic.id)}">删除</button></div>` : ''}</article>`).join('') || '<p class="talk-empty">这里还很安静，发起第一个话题吧。✿</p>'}</div><div class="talk-new-invitation"><button class="talk-new-character" type="button" data-action="new-topic" aria-label="和白发小伙伴发起新话题"><img src="./assets/white-haired-greeting.png" alt="挥手邀请你聊天的白发小伙伴" width="1415" height="1111"></button><p>也有新的故事想分享？</p><button class="quiet-button" data-action="new-topic">吹起一个新气泡 ↗</button></div>${bottomSearch()}</div>`;
}
const topicDrafts = new Map();
let activeTopicId = '';
function newTopicModal(sourceRect) {
  openModal(`<h2>吹起一个新气泡 💬</h2><p>发起新话题，让路过的人加入聊天。提交后会公开显示。</p><form id="topic-form"><label for="topic-author">你的昵称</label><input class="field" id="topic-author" name="author" maxlength="30" required><label for="topic-title">话题标题</label><input class="field" id="topic-title" name="title" maxlength="100" required><label for="topic-content">想聊些什么</label><textarea class="field" id="topic-content" name="content" maxlength="2000" required></textarea><p class="form-error" role="alert"></p><button class="btn" type="submit">发布话题</button></form>`);
  animateConversationEntrance(sourceRect, true);
}
function topicConversation(id, focusReply = false) {
  const topic = state.topics.find(item => item.id === id);
  if (!topic) return;
  const draft = topicDrafts.get(id) || { author: '', content: '' };
  openModal(`<section class="conversation"><span class="journal-kicker">A LITTLE CONVERSATION</span><label for="conversation-topic">选择留言帖子</label><select class="field" id="conversation-topic">${state.topics.map(item => `<option value="${esc(item.id)}" ${item.id === id ? 'selected' : ''}>${esc(item.title)} · ${esc(item.author)}</option>`).join('')}</select><h2 id="conversation-title">${esc(topic.title)}</h2><div class="conversation-switch" role="tablist" aria-label="留言模式" data-mode="${focusReply ? 'write' : 'read'}"><button type="button" id="conversation-read-tab" role="tab" aria-controls="conversation-read" aria-selected="${!focusReply}" tabindex="${focusReply ? '-1' : '0'}" data-conversation-mode="read">查看留言 · ${topic.replies.length}</button><button type="button" id="conversation-write-tab" role="tab" aria-controls="conversation-write" aria-selected="${focusReply}" tabindex="${focusReply ? '0' : '-1'}" data-conversation-mode="write">写留言 ↗</button></div><div id="conversation-read" role="tabpanel" aria-labelledby="conversation-read-tab" ${focusReply ? 'hidden' : ''}><div class="conversation-scroll"><div class="conversation-message conversation-original"><div class="conversation-meta"><strong>${esc(topic.author)}</strong><time>${date(topic.createdAt)}</time></div><p>${esc(topic.content)}</p></div>${topic.replies.map(reply => `<div class="conversation-message"><div class="conversation-meta"><strong>${esc(reply.author)}</strong><time>${date(reply.createdAt)}</time></div><p>${esc(reply.content)}</p></div>`).join('') || '<p class="conversation-empty">还没有留言，来接上第一句话吧。</p>'}</div></div><div id="conversation-write" role="tabpanel" aria-labelledby="conversation-write-tab" ${focusReply ? '' : 'hidden'}><p class="conversation-compose-hint">给「${esc(topic.title)}」留一句话吧。</p><form class="reply-form conversation-reply" data-topic="${esc(topic.id)}"><label for="reply-author">你的昵称</label><input class="field" id="reply-author" name="author" maxlength="30" value="${esc(draft.author)}" required><label for="reply-content">给这个帖子的留言</label><textarea class="field" id="reply-content" name="content" maxlength="1000" required placeholder="写下想说的话…">${esc(draft.content)}</textarea><small>留言提交后会公开显示。</small><p class="form-error" role="alert"></p><button class="btn" type="submit">发送留言 ↗</button></form></div></section>`);
  activeTopicId = id;
  modal.setAttribute('aria-labelledby', 'conversation-title');
  if (focusReply) document.querySelector('#reply-content')?.focus();
  else document.querySelector('#conversation-topic')?.focus();
}
let conversationEntrance = null;
function stopConversationEntrance() {
  conversationEntrance?.cancel();
  conversationEntrance = null;
  modal.classList.remove('conversation-entering', 'topic-composing-entering');
}
function animateConversationEntrance(sourceRect, composing = false) {
  if (!modal.animate || motionReduced()) return;
  stopConversationEntrance();
  const destination = modal.getBoundingClientRect();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const x = sourceRect ? clamp(sourceRect.left + sourceRect.width / 2 - destination.left - destination.width / 2, -100, 100) : 0;
  const y = sourceRect ? clamp(sourceRect.top + sourceRect.height / 2 - destination.top - destination.height / 2, -120, 120) : 18;
  const scale = sourceRect ? clamp(sourceRect.width / destination.width, .65, .92) : .97;
  modal.classList.add('conversation-entering');
  if (composing) modal.classList.add('topic-composing-entering');
  const animation = modal.animate(composing ? [
    { opacity: 0, transform: `translate(${x * .5}px, ${y * .5}px) scale(.9)` },
    { opacity: 1, transform: 'translate(0, 0) scale(1)' }
  ] : [
    { opacity: 0, transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${sourceRect ? -2 : 0}deg)`, borderRadius: '48px 48px 48px 8px' },
    { opacity: 1, transform: 'translate(0, -3px) scale(1.01) rotate(.4deg)', offset: .78 },
    { opacity: 1, transform: 'translate(0, 0) scale(1) rotate(0)', borderRadius: getComputedStyle(modal).borderRadius }
  ], { duration: composing ? 440 : sourceRect ? 360 : 280, easing: 'cubic-bezier(.22,1,.36,1)' });
  conversationEntrance = animation;
  animation.onfinish = () => {
    if (conversationEntrance !== animation) return;
    conversationEntrance = null;
    modal.classList.remove('conversation-entering', 'topic-composing-entering');
  };
}
let modalExit = null;
function stopModalExit() {
  const animation = modalExit;
  modalExit = null;
  if (animation) animation.cancel();
  modal.classList.remove('modal-leaving');
}
function requestModalClose() {
  if (!modal.open) return;
  if (modalExit) return modalExit.finished.catch(() => {});
  if (!modal.animate || motionReduced()) return closeModal();
  const current = getComputedStyle(modal);
  const start = { opacity: current.opacity, transform: current.transform };
  stopConversationEntrance();
  const destination = activeTopicId && document.getElementById(`topic-${activeTopicId}`)?.getBoundingClientRect();
  const rect = modal.getBoundingClientRect();
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  const x = destination ? clamp(destination.left + destination.width / 2 - rect.left - rect.width / 2, 100) : 0;
  const y = destination ? clamp(destination.top + destination.height / 2 - rect.top - rect.height / 2, 120) : 24;
  activeTopicId = '';
  modal.classList.add('modal-leaving');
  const animation = modal.animate([start, {
    opacity: 0, transform: `translate(${x}px, ${y}px) scale(${destination ? .9 : .97})`
  }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  modalExit = animation;
  return animation.finished.then(() => { if (modalExit === animation) closeModal(); }, () => {});
}
function openModal(html) {
  const wasOpen = modal.open;
  stopModalExit(); stopConversationEntrance(); activeTopicId = '';
  modal.removeAttribute('aria-labelledby');
  const update = () => { modalContent.innerHTML = '<p id="modal-status" class="modal-status" role="status" aria-live="polite" hidden></p>' + html; };
  if (wasOpen) updateContent(modalContent, update);
  else { update(); modal.showModal(); animateConversationEntrance(); }
}
function closeModal() { stopModalExit(); stopConversationEntrance(); activeTopicId = ''; modal.close(); modalContent.innerHTML = ''; }
function loginForm() {
  return `<form id="login-form"><label for="password">管理员密码</label><input class="field" type="password" id="password" name="password" required autocomplete="current-password" aria-describedby="login-error"><p id="login-error" role="alert" class="login-error" hidden></p><button class="btn" type="submit">进入管理后台</button></form>${!state.loginEnabled ? '<p class="status">请先在服务器设置 BLOG_ADMIN_PASSWORD。</p>' : ''}`;
}
function adminModal() {
  if (!adminMode) return;
  if (filePreview) return openModal('<h2>当前是静态预览 🥔</h2><p>图片和页面可以直接查看。要发布动态、管理资料或留言，请先运行 npm start，再打开 http://localhost:3000。</p>');
  if (state.admin) return openModal('<h2>站长的小工具 🎀</h2><p>已登录，可以发布动态、编辑资料和管理留言。</p><div class="button-row"><button class="btn secondary" data-action="change-password">修改密码</button><button class="btn" data-action="logout">退出登录</button></div>');
  openModal(`<h2>站长登录</h2>${loginForm()}`);
  document.querySelector('#password')?.focus();
}
function passwordModal() {
  if (!adminMode || !state.admin) return;
  openModal(`<h2>修改管理员密码</h2><p>保存后会退出所有已登录账户，请使用新密码重新登录。</p><form id="password-form"><label for="current-password">当前密码</label><input class="field" id="current-password" name="currentPassword" type="password" autocomplete="current-password" maxlength="200" required><label for="new-password">新密码</label><input class="field" id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="200" aria-describedby="password-help" required><p id="password-help" class="status">8–200 个字符</p><label for="confirm-password">确认新密码</label><input class="field" id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="200" required><p class="form-error" role="alert"></p><button class="btn" type="submit">保存新密码</button></form>`);
  document.querySelector('#current-password')?.focus();
}
function postModal(type, post = null, section = 'learning') {
  if (type === 'update') {
    openModal(`<h2>${post ? '编辑更新日志' : '写一条更新日志'}</h2><p>${post ? '保留原来的发布日期。' : '记录这次新增的功能或修复的问题。'}</p><form id="post-form" ${post ? `data-id="${esc(post.id)}"` : ''}><input type="hidden" name="type" value="update"><label for="post-title">标题</label><input class="field" id="post-title" name="title" maxlength="100" required value="${esc(post?.title)}"><label for="post-tag">分类</label><input class="field" id="post-tag" name="tag" maxlength="30" value="${esc(post?.tag)}" placeholder="功能更新 / 交互优化 / Debug"><label for="post-content">更新内容</label><textarea class="field" id="post-content" name="content" maxlength="5000" required>${esc(post?.content)}</textarea>${postImageEditor(post?.images)}<button class="btn" type="submit">${post ? '保存修改' : '发布更新'}</button></form>`);
    return;
  }
  const selected = post ? studySection(post) : section;
  openModal(`<h2>${type === 'article' ? (post ? '编辑个人文章' : '写一篇个人文章') : post ? '编辑动态 ✎' : '写一篇新动态 ✎'}</h2><p>${post ? '修改后会保留原来的发表日期。' : '把今天想留住的事情写下来吧。'}</p><form id="post-form" ${post ? `data-id="${esc(post.id)}"` : ''}><input type="hidden" name="type" value="${type}">${type === 'study' ? `<label for="post-section">内容分类</label><select class="field" id="post-section" name="section"><option value="learning" ${selected === 'learning' ? 'selected' : ''}>学习内容</option><option value="work" ${selected === 'work' ? 'selected' : ''}>工作内容</option></select>` : ''}<label for="post-title">标题</label><input class="field" id="post-title" name="title" maxlength="100" required value="${esc(post?.title)}" placeholder="今天想写什么？"><label for="post-tag">小标签</label><input class="field" id="post-tag" name="tag" maxlength="30" value="${esc(post?.tag)}" placeholder="比如：${type === 'article' ? '随笔 / 想法 / 感悟' : type === 'study' ? '学习笔记 / 工作记录' : '日常碎片'}"><label for="post-content">正文</label><textarea class="field" id="post-content" name="content" maxlength="5000" required placeholder="慢慢写，别着急...">${esc(post?.content)}</textarea>${postImageEditor(post?.images)}<button class="btn" type="submit">${post ? '保存修改' : type === 'article' ? '发表文章' : '发布这篇动态 🥔'}</button></form>`);
}
function readingPlanModal() {
  const plan = state.readingPlan || {};
  openModal(`<h2>编辑阅读计划 📚</h2><p>更新正在读的书和阅读进度，访客会看到最新计划。进度达到 100% 会自动收录到历史书库，换书后记录仍会保留。</p><form id="reading-plan-form"><label for="reading-book">书名</label><input class="field" id="reading-book" name="book" maxlength="100" value="${esc(plan.book)}" placeholder="正在读哪本书？"><label for="reading-author">作者（可选）</label><input class="field" id="reading-author" name="author" maxlength="80" value="${esc(plan.author)}"><label for="reading-goal">阅读目标</label><input class="field" id="reading-goal" name="goal" maxlength="160" value="${esc(plan.goal)}" placeholder="例如：每天读 20 页"><label for="reading-progress">阅读进度（0–100%）</label><input class="field" id="reading-progress" type="number" name="progress" min="0" max="100" step="1" value="${Number(plan.progress) || 0}"><label for="reading-note">阅读心得（可选）</label><textarea class="field" id="reading-note" name="note" maxlength="2000" placeholder="写下读到这里的想法、喜欢的句子或新的理解…">${esc(plan.note)}</textarea><button class="btn" type="submit">保存阅读计划</button></form>`);
}
function topicModal(topic) { openModal(`<h2>编辑留言 ✎</h2><p>修改后会保留原来的留言日期和回复。</p><form id="topic-edit-form" data-id="${esc(topic.id)}"><label for="edit-topic-author">昵称</label><input class="field" id="edit-topic-author" name="author" maxlength="30" required value="${esc(topic.author)}"><label for="edit-topic-title">标题</label><input class="field" id="edit-topic-title" name="title" maxlength="100" required value="${esc(topic.title)}"><label for="edit-topic-content">留言内容</label><textarea class="field" id="edit-topic-content" name="content" maxlength="2000" required>${esc(topic.content)}</textarea><button class="btn" type="submit">保存修改</button></form>`); }
function hobbyEditorRow(item = {}) {
  return `<div class="hobby-row"><div class="hobby-row-head"><strong>爱好卡片</strong><button type="button" class="quiet-button" data-hobby-remove>移除</button></div><label>爱好名称<input class="field hobby-name" maxlength="32" value="${esc(item.name)}" placeholder="例如：动漫"></label><label>详细介绍<textarea class="field hobby-detail" maxlength="200" placeholder="写写喜欢它的原因、最近的发现…">${esc(item.detail)}</textarea></label></div>`;
}
function hobbyEditor(profile) {
  return `<fieldset class="hobby-editor"><legend>爱好细节</legend><p>每项会显示在“关于我”的田字格中，最多 12 项。详细介绍支持超链接，格式：[显示文字](https://网址)。</p><div class="hobby-rows">${hobbyItems(profile).map(hobbyEditorRow).join('')}</div><button type="button" class="quiet-button hobby-add" data-hobby-add>＋ 添加一项爱好</button></fieldset>`;
}
function profileModal() {
  const p = state.profile;
  const fields = [
    ['name', '名字', 'text', 40], ['handle', '用户名', 'text', 40],
    ['intro', '一句话介绍', 'text', 120], ['bio', '站长留言', 'textarea', 2000],
    ['location', '家乡', 'text', 80], ['birthday', '生日', 'date', 10],
    ['hobbies', '爱好'], ['workExperience', '工作经历', 'textarea', 2000],
    ['educationStages', '教育经历'], ['email', '联系邮箱', 'email', 120],
    ['phone', '电话', 'tel', 40], ['qq', '🐧 QQ', 'text', 30],
    ['wechat', '微信', 'text', 60], ['githubContact', 'GitHub'], ['contactNote', '联系备注', 'textarea', 300]
  ];
  openModal(`<h2>编辑个人资料 🎀</h2><form id="profile-form"><label for="profile-avatar">上传头像（PNG、JPEG、WebP，最多 2 MB）</label><input class="field" id="profile-avatar" type="file" name="avatarFile" accept="image/png,image/jpeg,image/webp"><div class="avatar-preview">${p.avatar ? `<img src="${esc(p.avatar)}" alt="当前头像">` : '🌸'}</div><button type="button" class="quiet-button" data-crop-avatar ${p.avatar ? '' : 'hidden'}>裁剪头像</button>${fields.map(([key, label, type, max]) => key === 'hobbies' ? hobbyEditor(p) : key === 'educationStages' ? educationEditor(p) : key === 'githubContact' ? githubEditor(p) : `<label for="profile-${key}"${key === 'qq' ? ' aria-label="QQ 号码"' : ''}>${label}</label>${type === 'textarea' ? `<textarea class="field" id="profile-${key}" name="${key}" maxlength="${max}">${esc(p[key])}</textarea>` : `<input class="field" id="profile-${key}" type="${type}" name="${key}" value="${esc(p[key])}" maxlength="${max}">`}`).join('')}<button class="btn" type="submit">保存资料</button></form>`);
}
function postImageGallery(images = []) {
  return images.length ? `<div class="post-images ${images.length === 1 ? 'is-single' : 'is-multiple'}">${images.map((url, index) => `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="动态配图 ${index + 1}（点击查看原图）" loading="lazy" decoding="async"></a>`).join('')}</div>` : '';
}
function imageDraft(url) {
  return `<div class="image-draft" data-src="${esc(url)}"><img src="${esc(url)}" alt="待发布的配图"><button type="button" data-crop-image aria-label="裁剪图片" title="裁剪图片">✂</button><button type="button" data-remove-image aria-label="移除图片" title="移除图片">×</button></div>`;
}
function postImageEditor(images = []) {
  return `<label for="post-images">图片（最多 9 张，每张不超过 2 MB）</label><input class="field" id="post-images" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-describedby="post-image-error"><div class="image-drafts">${images.map(imageDraft).join('')}</div><p id="post-image-error" class="form-error" role="alert"></p>`;
}
document.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-image]');
  if (remove && !remove.closest('form').querySelector('[type="submit"]').disabled) remove.closest('.image-draft').remove();
});
document.addEventListener('change', async event => {
  if (!['post-images', 'profile-avatar'].includes(event.target.id)) return;
  const input = event.target, form = input.form;
  const avatar = input.id === 'profile-avatar';
  const drafts = form.querySelector('.image-drafts');
  let error = form.querySelector('.form-error');
  if (!error) { error = document.createElement('p'); error.className = 'form-error'; error.setAttribute('role', 'alert'); input.after(error); }
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) { input.value = ''; return; }
  const files = [...input.files];
  input.disabled = true; submit.disabled = true; error.textContent = '';
  try {
    if (!avatar && drafts.children.length + files.length > 9) throw new Error('最多添加 9 张图片');
    const images = await Promise.all(files.map(imageData));
    for (const source of images) {
      if (!form.isConnected) break;
      const image = await cropImage(source, avatar);
      if (!image) break;
      if (avatar) {
        input.dataset.image = image;
        form.querySelector('[data-crop-avatar]').hidden = false;
        form.querySelector('.avatar-preview').innerHTML = `<img src="${esc(image)}" alt="头像预览">`;
      } else drafts.insertAdjacentHTML('beforeend', imageDraft(image));
    }
  } catch (problem) { error.textContent = problem.message; }
  finally { input.value = ''; input.disabled = false; submit.disabled = false; }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-crop-image], [data-crop-avatar]');
  if (!button) return;
  const form = button.closest('form'), submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    if (button.hasAttribute('data-crop-avatar')) {
      const input = form.querySelector('#profile-avatar');
      const preview = form.querySelector('.avatar-preview img');
      const image = await cropImage(input.dataset.image || preview.src, true);
      if (image) { input.dataset.image = image; preview.src = image; }
      return;
    }
    const draft = button.closest('.image-draft');
    const image = await cropImage(draft.dataset.src);
    if (image) { draft.dataset.src = image; draft.querySelector('img').src = image; }
  } catch (error) { toast(error.message); }
  finally { submit.disabled = false; }
});
function imageData(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  if (file.size > 2_000_000) throw new Error('图片不能超过 2 MB');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
function moodModal(day = localDay()) {
  const entry = state.moods.find(item => item.date === day);
  openModal(`<h2>记录土豆的心情 🥔</h2><p>同一天再次保存，会更新那天的记录。</p><form id="mood-form"><label for="mood-date">日期</label><input class="field" type="date" id="mood-date" name="date" value="${esc(day)}" required><label for="mood-choice">今天的心情</label><select class="field" id="mood-choice" name="mood" required><option value="">选择心情</option>${homeMoods.map(([key, icon, label]) => `<option value="${key}" ${entry?.mood === key ? 'selected' : ''}>${icon} ${label}</option>`).join('')}</select><label for="mood-note">写一点今天的心情（可选）</label><textarea class="field" id="mood-note" name="note" maxlength="120" placeholder="今天发生了什么？">${esc(entry?.note)}</textarea><button class="btn" type="submit">保存心情</button></form>`);
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
document.querySelector('#login-button')?.addEventListener('click', adminModal);
document.querySelector('#back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: motionReduced() ? 'instant' : 'smooth' }));
document.querySelector('#modal-close').addEventListener('click', requestModalClose);
modal.addEventListener('click', event => { if (event.target === modal) requestModalClose(); });
modal.addEventListener('cancel', event => { event.preventDefault(); requestModalClose(); });
modal.addEventListener('click', event => {
  if (event.target.closest('[data-hobby-remove]')) {
    const row = event.target.closest('.hobby-row');
    if (row) updateContent(row.parentElement, () => { row.remove(); });
    modal.querySelector('[data-hobby-add]')?.focus({ preventScroll: true });
  }
  if (event.target.closest('[data-hobby-add]')) {
    const rows = modal.querySelector('.hobby-rows');
    if (rows.children.length >= 12) return toast('最多添加 12 个爱好');
    updateContent(rows, () => { rows.insertAdjacentHTML('beforeend', hobbyEditorRow()); });
    rows.lastElementChild.querySelector('.hobby-name').focus();
  }
});
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
  const results = document.querySelector('#search-results');
  updateContent(results, () => { results.innerHTML = searchResults(state.searchQuery); });
});
modal.addEventListener('input', event => {
  const form = event.target.closest('.conversation-reply');
  if (form) topicDrafts.set(form.dataset.topic, { author: form.elements.author.value, content: form.elements.content.value });
});
function setConversationMode(mode, focus = false) {
  const switcher = modal.querySelector('.conversation-switch');
  if (!switcher) return;
  switcher.dataset.mode = mode;
  for (const tab of switcher.querySelectorAll('[role="tab"]')) {
    const selected = tab.dataset.conversationMode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  updateContent(modalContent, () => {
    modal.querySelector('#conversation-read').hidden = mode !== 'read';
    modal.querySelector('#conversation-write').hidden = mode !== 'write';
  });
}
modal.addEventListener('click', event => {
  const tab = event.target.closest('[data-conversation-mode]');
  if (tab) setConversationMode(tab.dataset.conversationMode);
});
modal.addEventListener('keydown', event => {
  if (!event.target.closest('[data-conversation-mode]')) return;
  const mode = { ArrowLeft: 'read', Home: 'read', ArrowRight: 'write', End: 'write' }[event.key];
  if (mode) { event.preventDefault(); setConversationMode(mode, true); }
});
modal.addEventListener('change', event => {
  if (event.target.id === 'conversation-topic') topicConversation(event.target.value, modal.querySelector('.conversation-switch')?.dataset.mode === 'write');
});
modal.addEventListener('change', event => {
  if (event.target.id !== 'mood-date') return;
  const entry = state.moods.find(item => item.date === event.target.value);
  modal.querySelector('#mood-choice').value = entry?.mood || '';
  modal.querySelector('#mood-note').value = entry?.note || '';
});
function lifeFilterMarker(nav) {
  const moving = nav?.querySelector('.life-filter-indicator');
  if (moving) return moving.getBoundingClientRect();
  const button = nav?.querySelector('[aria-pressed="true"]');
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  const vertical = nav.classList.contains('life-year-nav') && !window.matchMedia('(max-width:600px)').matches;
  if (vertical) return { left: nav.getBoundingClientRect().left - 3, top: rect.top + rect.height / 2 - 3.5, width: 7, height: 7 };
  return { left: rect.left, top: nav.classList.contains('life-year-nav') ? rect.bottom + 6 : nav.getBoundingClientRect().bottom - 3, width: rect.width, height: 3 };
}
function slideLifeFilter(nav, previous) {
  if (!nav || !previous || motionReduced() || !nav.animate) return;
  const target = lifeFilterMarker(nav);
  if (!target) return;
  const bounds = nav.getBoundingClientRect();
  const marker = document.createElement('span');
  marker.className = 'life-filter-indicator';
  marker.setAttribute('aria-hidden', 'true');
  Object.assign(marker.style, { left: `${target.left - bounds.left + nav.scrollLeft}px`, top: `${target.top - bounds.top + nav.scrollTop}px`, width: `${target.width}px`, height: `${target.height}px` });
  nav.classList.add('filter-sliding');
  nav.append(marker);
  const animation = marker.animate([
    { transform: `translate(${previous.left - target.left}px, ${previous.top - target.top}px) scale(${previous.width / target.width}, ${previous.height / target.height})` },
    { transform: 'translate(0, 0) scale(1)' }
  ], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' });
  animation.onfinish = () => { marker.remove(); nav.classList.remove('filter-sliding'); };
}
app.addEventListener('click', event => {
  const chapter = event.target.closest('#home-chapters .chapter-link');
  if (chapter && event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    chapterNavigatePending = chapter.getAttribute('href');
  }
  const lifeFilter = event.target.closest('[data-life-year], [data-life-month]');
  if (lifeFilter) {
    const yearFilter = lifeFilter.hasAttribute('data-life-year');
    const selectedValue = yearFilter ? lifeFilter.dataset.lifeYear : lifeFilter.dataset.lifeMonth;
    if (selectedValue === (yearFilter ? lifeArchiveState.year : lifeArchiveState.month)) return;
    const oldMarkers = ['.life-year-nav', '.life-month-nav'].map(selector => lifeFilterMarker(document.querySelector(selector)));
    const monthScroll = document.querySelector('.life-month-nav')?.scrollLeft || 0;
    if (yearFilter) { lifeArchiveState.year = lifeFilter.dataset.lifeYear; lifeArchiveState.month = ''; }
    else lifeArchiveState.month = lifeFilter.dataset.lifeMonth;
    const archive = document.querySelector('#life-archive');
    updateContent(archive, () => { archive.innerHTML = lifeArchiveView(); });
    archive.querySelector('.life-month-nav').scrollLeft = yearFilter ? 0 : monthScroll;
    const attr = yearFilter ? 'data-life-year' : 'data-life-month';
    const value = yearFilter ? lifeArchiveState.year : lifeArchiveState.month;
    archive.querySelector(`[${attr}="${value}"]`)?.focus({ preventScroll: true });
    ['.life-year-nav', '.life-month-nav'].forEach((selector, index) => slideLifeFilter(archive.querySelector(selector), oldMarkers[index]));
    const timeline = archive.querySelector('.life-timeline');
    if (timeline?.animate && !motionReduced()) timeline.animate([
      { opacity: 0, transform: `translate(${yearFilter ? 0 : 18}px, ${yearFilter ? 14 : 0}px)` },
      { opacity: 1, transform: 'translate(0, 0)' }
    ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  const calendarButton = event.target.closest('[data-study-day], [data-study-month]');
  if (calendarButton) {
    const archive = calendarButton.closest('.study-archive');
    const section = archive.dataset.section;
    const selection = studyCalendarState[section];
    if (calendarButton.dataset.studyDay) selection.day = calendarButton.dataset.studyDay;
    else {
      const months = [...new Set(archivedStudyPosts(section).map(post => dateKey(post.createdAt).slice(0, 7)))].sort((a, b) => b.localeCompare(a));
      const step = calendarButton.dataset.studyMonth === 'previous' ? 1 : -1;
      selection.month = months[months.indexOf(selection.month) + step] || selection.month;
      selection.day = '';
    }
    updateContent(archive, () => { archive.innerHTML = studyCalendarView(section, archivedStudyPosts(section)); });
    const active = archive.querySelector(calendarButton.dataset.studyDay ? `[data-study-day="${selection.day}"]` : '.study-calendar-nav strong');
    active?.focus?.({ preventScroll: true });
  }
  const studyJump = event.target.closest('[data-study-jump]');
  if (studyJump) document.getElementById(studyJump.dataset.studyJump)?.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'instant' : 'smooth' });
  const runner = event.target.closest('.study-runner');
  if (runner) {
    runner.closest('.study-companion').querySelector('.runner-hint').textContent = '今天也翻开一页吧 ✦';
    if (!motionReduced() && runner.animate) {
      runner.getAnimations().forEach(animation => animation.cancel());
      runner.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(14px, -7px) rotate(-3deg)', offset: .25 }, { transform: 'translate(30px, 0)', offset: .5 }, { transform: 'translate(16px, -5px) rotate(2deg)', offset: .75 }, { transform: 'translate(0, 0)' }], { duration: 750, easing: 'ease-in-out' });
    }
  }
  const greeting = event.target.closest('.greeting-scene');
  if (greeting) {
    const active = greeting.getAttribute('aria-pressed') !== 'true';
    greeting.setAttribute('aria-pressed', String(active));
    greeting.querySelector('.greeting-copy').textContent = active ? '呀，你来啦！今天过得怎么样？' : '路过的话，留一句你好呀 🥔';
    greeting.querySelector('.greeting-hint').textContent = active ? '想说的话，写在下面吧 ↓' : '点点我 · 打个招呼';
  }
  const saber = event.target.closest('.saber-scene');
  if (saber) {
    const lifted = saber.getAttribute('aria-pressed') !== 'true';
    saber.setAttribute('aria-pressed', String(lifted));
    saber.setAttribute('aria-label', lifted ? '让 Saber 放下寄语框' : '让 Saber 举高寄语框');
    saber.querySelector('.saber-hint').textContent = lifted ? '接住今天的小小光亮！再点一下放下 🥔' : '点点我，把小小光亮举高一点 ↑';
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
      toast('小凛：欢迎回来！今天也要留一点时间给喜欢的事 🥔');
      if (!motionReduced()) homeButton.animate([{ transform: 'rotate(0)' }, { transform: 'translateY(-10px) rotate(-6deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], { duration: 500 });
    }
    if (action === 'random' && state.posts.length) {
      const otherPosts = state.posts.filter(post => post.id !== homeInteraction.lastPost);
      const candidates = otherPosts.length ? otherPosts : state.posts;
      const post = candidates[Math.floor(Math.random() * candidates.length)];
      homeInteraction.lastPost = post.id;
      location.hash = `${postPage(post)}?item=${encodeURIComponent(`post-${post.id}`)}`;
    }
  }

  const searchToggle = event.target.closest('.search-toggle');
  if (searchToggle) setHomeSearch(searchToggle.getAttribute('aria-expanded') !== 'true');
  const result = event.target.closest('.search-result');
  if (result && result.getAttribute('href') === location.hash) focusHashTarget();
  if (event.target.closest('.entry-with-character') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    toast('来啦！一起看看今天的小确幸 🥔');
  }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id, type, section, date: moodDate } = button.dataset;
  if (action === 'show-updates') { blogUpdatesModal(); return; }
  try {
    if (action === 'open-topic') {
      const sourceRect = button.getBoundingClientRect();
      topicConversation(id);
      if (modal.open && activeTopicId === id) animateConversationEntrance(sourceRect);
    }
    if (action === 'shuffle-friends') { render(); document.querySelector('[data-action=shuffle-friends]')?.focus({ preventScroll: true }); toast('已随机排列友链'); }
    if (action === 'copy-friend-profile') {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(ownFriendYaml());
        toast('友链资料已复制');
      } catch {
        const code = document.querySelector('#own-friend-yaml');
        const range = document.createRange(); range.selectNodeContents(code);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        code.focus(); toast('已选中友链资料，请复制');
      }
    }
    if (action === 'new-friend') friendModal();
    if (action === 'edit-friend' && state.admin) { const friend = state.friends.find(item => item.id === id); if (friend) friendModal(friend); }
    if (action === 'delete-friend' && state.admin && confirm('确定删除这条友链吗？')) { await request(`/api/friends/${id}`, { method: 'DELETE' }); state.friends = state.friends.filter(item => item.id !== id); render(); toast('友链已删除'); }
    if (action === 'new-topic') newTopicModal(button.getBoundingClientRect());
    if (action === 'edit-mood' && state.admin) moodModal(moodDate || localDay());
    if (action === 'new-post') postModal(type, null, section);
    if (action === 'edit-post') { const post = state.posts.find(post => post.id === id); if (post) postModal(post.type, post); }
    if (action === 'edit-topic') { const topic = state.topics.find(topic => topic.id === id); if (topic) topicModal(topic); }
    if (action === 'edit-profile') profileModal();
    if (action === 'edit-reading-plan' && state.admin) readingPlanModal();
    if (action === 'toggle-library') {
      libraryExpanded = !libraryExpanded;
      const library = document.querySelector('#reading-library');
      library.classList.toggle('is-open', libraryExpanded);
      library.querySelector('#library-fans').inert = !libraryExpanded;
      button.setAttribute('aria-expanded', String(libraryExpanded));
      button.textContent = libraryExpanded ? '收拢书页 ↗' : '展开书页 ↗';
    }
    if (action === 'open-reading-book') readingBookModal(id);
    if (action === 'edit-reading-book' && state.admin) readingBookEditor(id);
    if (action === 'edit-reading-log' && state.admin) readingLogEditor(id, button.dataset.log);
    if (action === 'change-password') passwordModal();
    if (action === 'logout') { await request('/api/logout', { method: 'POST' }); state.admin = false; state.friends = await request('/api/friends'); await requestModalClose(); render(); toast('已退出登录'); }
    if (action === 'delete-post' && confirm('确定删除这篇内容吗？')) { const isUpdate = state.posts.some(post => post.id === id && post.type === 'update'); await request(`/api/posts/${id}`, { method: 'DELETE' }); state.posts = state.posts.filter(p => p.id !== id); if (isUpdate) { await requestModalClose(); render(); blogUpdatesModal(); } else if (route() === 'articles' && location.hash.includes('?')) location.hash = '#articles'; else render(); toast('内容已删除'); }
    if (action === 'delete-topic' && confirm('确定删除这条留言和所有回复吗？')) { await request(`/api/topics/${id}`, { method: 'DELETE' }); state.topics = state.topics.filter(t => t.id !== id); render(); toast('留言已删除'); }
  } catch (error) { toast(error.message); }
});
document.addEventListener('submit', async event => {
  const form = event.target; if (!['friend-form','login-form','password-form','post-form','profile-form','reading-plan-form','reading-book-form','reading-log-form','mood-form','topic-form','topic-edit-form'].includes(form.id) && !form.matches('.reply-form')) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const originalButtonText = button.textContent;
  if (form.matches('.reply-form')) {
    button.textContent = '正在发送…';
    const error = form.querySelector('.form-error');
    if (error) error.textContent = '';
  }
  const loginError = form.querySelector('#login-error');
  if (loginError) { loginError.hidden = true; loginError.textContent = ''; form.elements.password.removeAttribute('aria-invalid'); button.textContent = '正在登录…'; }
  try {
    const values = formData(form);
    if (form.id === 'post-form') {
      values.images = [];
      for (const item of form.querySelectorAll('.image-draft')) {
        if (item.dataset.src.startsWith('data:')) {
          const uploaded = await request('/api/images', { method: 'POST', body: JSON.stringify({ image: item.dataset.src }) });
          item.dataset.src = uploaded.url;
        }
        values.images.push(item.dataset.src);
      }
    }
    if (form.id === 'friend-form') {
      if (values.avatarSource === 'upload') {
        const image = form.querySelector('#friend-avatar-file').dataset.image;
        values.avatar = form.dataset.avatar || '';
        if (image) values.avatarImage = image;
      }
      delete values.avatarSource;
      button.textContent = values.avatarImage ? '正在上传并提交…' : '正在提交…';
      const editing = Boolean(form.dataset.id);
      const friend = await request(editing ? `/api/friends/${form.dataset.id}` : '/api/friends', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(values) });
      if (state.admin || friend.status === 'published') state.friends = state.friends.filter(item => item.id !== friend.id).concat(friend);
      await requestModalClose(); render(); toast(friend.status === 'published' ? '友链已发布' : state.admin ? '友链已保存' : '申请已提交，等待站长审核');
    }
    if (form.id === 'login-form') { const result = await request('/api/login', { method: 'POST', body: JSON.stringify(values) }); state.admin = result.admin; state.friends = await request('/api/friends?review=1'); await requestModalClose(); render(); toast('欢迎回来，站长 🥔'); }
    if (form.id === 'password-form') {
      if (values.newPassword !== values.confirmPassword) throw new Error('两次输入的新密码不一致');
      await request('/api/password', { method: 'PUT', body: JSON.stringify(values) });
      form.reset(); state.admin = false; state.friends = await request('/api/friends'); await requestModalClose(); render(); toast('密码已修改，请使用新密码重新登录');
    }
    if (form.id === 'post-form') { const editing = Boolean(form.dataset.id), previousPage = route(); const post = await request(editing ? `/api/posts/${form.dataset.id}` : '/api/posts', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(values) }); if (editing) state.posts = state.posts.map(item => item.id === post.id ? post : item); else state.posts.unshift(post); await requestModalClose(); if (['study', 'work', 'articles'].includes(previousPage) && postPage(post) !== previousPage) location.hash = `${postPage(post)}?item=${encodeURIComponent(`post-${post.id}`)}`; else render(); if (post.type === 'update') blogUpdatesModal(); toast(post.type === 'update' ? (editing ? '更新日志已修改' : '更新日志已发布') : editing ? '动态已更新' : '动态发布成功'); }
    if (form.id === 'profile-form') {
      values.hobbyDetails = [...form.querySelectorAll('.hobby-row')].map(row => ({
        name: row.querySelector('.hobby-name').value.trim(),
        detail: row.querySelector('.hobby-detail').value.trim()
      }));
      if (values.hobbyDetails.some(item => !item.name && item.detail)) throw new Error('请为每张爱好卡片填写名称');
      const avatarImage = form.querySelector('#profile-avatar')?.dataset.image;
      delete values.avatarFile;
      if (avatarImage) await request('/api/profile/avatar', { method: 'POST', body: JSON.stringify({ image: avatarImage }) });
      state.profile = await request('/api/profile', { method: 'PUT', body: JSON.stringify(values) });
      await requestModalClose(); render(); toast('资料已保存');
    }
    if (['reading-book-form', 'reading-log-form'].includes(form.id)) {
      const id = form.dataset.id;
      const endpoint = `/api/reading-history/${encodeURIComponent(id)}${form.id === 'reading-log-form' ? `/logs/${encodeURIComponent(form.dataset.log)}` : ''}`;
      const updated = await request(endpoint, { method: 'PUT', body: JSON.stringify(values) });
      state.readingHistory = state.readingHistory.map(book => book.id === id ? updated : book);
      state.readingPlan = await request('/api/reading-plan');
      render(); readingBookModal(id); toast('阅读记录已更新');
    }
    if (form.id === 'reading-plan-form') {
      state.readingPlan = await request('/api/reading-plan', { method: 'PUT', body: JSON.stringify(values) });
      state.readingHistory = await request('/api/reading-history');
      await requestModalClose(); render(); toast(state.readingPlan.progress === 100 ? '已读完，记录已收录到历史书库' : '阅读计划已保存');
    }
    if (form.id === 'mood-form') { const { date: day, mood, note } = values; const entry = await request(`/api/moods/${encodeURIComponent(day)}`, { method: 'PUT', body: JSON.stringify({ mood, note }) }); state.moods = state.moods.filter(item => item.date !== entry.date).concat(entry); await requestModalClose(); render(); toast('心情已保存'); }
    if (form.id === 'topic-form') { const topic = await request('/api/topics', { method: 'POST', body: JSON.stringify(values) }); state.topics.unshift(topic); await requestModalClose(); render(); topicConversation(topic.id); toast('话题已发布'); }
    if (form.id === 'topic-edit-form') { const topic = await request(`/api/topics/${form.dataset.id}`, { method: 'PUT', body: JSON.stringify(values) }); state.topics = state.topics.map(item => item.id === topic.id ? topic : item); await requestModalClose(); render(); toast('留言已更新'); }
    if (form.matches('.reply-form')) {
      const topicId = form.dataset.topic;
      const reply = await request(`/api/topics/${topicId}/replies`, { method: 'POST', body: JSON.stringify(values) });
      const topic = state.topics.find(t => t.id === topicId);
      if (topic) topic.replies.push(reply);
      const latestDraft = topicDrafts.get(topicId);
      if (!latestDraft || latestDraft.content === values.content) topicDrafts.set(topicId, { author: values.author, content: '' });
      const conversationOpen = modal.open && activeTopicId === topicId;
      const selectedTopic = activeTopicId;
      if (route() === 'talk') app.innerHTML = talk();
      if (conversationOpen && selectedTopic === topicId) topicConversation(topicId);
      toast('留言已发送');
    }
  } catch (error) {
    if (loginError) {
      loginError.textContent = error.message;
      loginError.hidden = false;
      if (error.message === '密码不正确') form.elements.password.setAttribute('aria-invalid', 'true');
      button.textContent = '进入管理后台';
    } else if ((['friend-form', 'profile-form', 'password-form', 'topic-form', 'reading-plan-form', 'reading-book-form', 'reading-log-form'].includes(form.id) || form.matches('.reply-form'))) {
      let message = form.querySelector('.form-error');
      if (!message) { message = document.createElement('p'); message.className = 'form-error'; message.setAttribute('role', 'alert'); button.before(message); }
      message.textContent = error.message;
    } else { toast(error.message); }
    if (form.matches('.reply-form') || form.id === 'friend-form') button.textContent = originalButtonText;
    button.disabled = false;
  }
});
load();
