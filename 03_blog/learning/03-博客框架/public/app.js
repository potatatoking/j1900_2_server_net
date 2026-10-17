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
