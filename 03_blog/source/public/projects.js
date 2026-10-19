function projectGroup(status) {
  const projects = (state.projects || []).filter(item => item.status === status).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id));
  const completed = status === 'completed', title = completed ? '已完成的项目' : '进行中的项目';
  return `<section class="project-group project-group-${status}" aria-labelledby="projects-${status}-title"><div class="project-group-heading"><h3 id="projects-${status}-title">${title}</h3><span>${projects.length} 项</span></div>${projects.length ? `<ol class="project-list">${projects.map((item, index) => `<li><button type="button" class="project-row" id="project-${esc(item.id)}" data-action="open-project" data-id="${esc(item.id)}" aria-label="${esc(item.title)}，${completed ? '已完成' : '进行中'}，查看项目"><span class="project-row-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="project-row-copy"><strong>${esc(item.title)}</strong>${item.description ? `<span class="project-row-description">${esc(item.description)}</span>` : ''}</span><span class="project-row-arrow" aria-hidden="true">↗</span></button></li>`).join('')}</ol>` : `<div class="project-empty"><p>${completed ? '还没有收录已完成的项目。' : '还没有添加进行中的项目。'}</p>${state.admin ? `<button class="quiet-button" type="button" data-action="new-project" data-status="${status}">＋ ${completed ? '记录已完成项目' : '添加进行中项目'}</button>` : ''}</div>`}</section>`;
}
function renderProjects() {
  return `<section class="work-projects" id="work-projects" tabindex="-1" aria-labelledby="work-projects-title"><header class="work-projects-heading"><div><span class="study-kicker">PROJECT JOURNAL</span><h2 id="work-projects-title">项目记录</h2><p>记录正在推进的事，也收好已经完成的成果。</p></div>${state.admin ? '<button class="btn tiny" type="button" data-action="new-project">＋ 添加项目</button>' : ''}</header><div class="project-groups">${projectGroup('active')}${projectGroup('completed')}</div></section>`;
}
function projectModal(id) {
  const item = (state.projects || []).find(project => project.id === id);
  if (!item) return;
  const label = item.status === 'completed' ? '已完成' : '进行中';
  openModal(`<div class="project-detail"><span class="study-kicker">${label}</span><h2>${esc(item.title)}</h2><p class="project-description">${esc(item.description || '这个项目的故事，等下一次慢慢补充。')}</p>${item.url ? `<a class="project-external" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">打开项目 <span aria-hidden="true">↗</span></a>` : ''}${state.admin ? `<div class="project-detail-actions"><button class="quiet-button" type="button" data-action="edit-project" data-id="${esc(id)}">编辑项目</button><button class="quiet-button" type="button" data-action="toggle-project" data-id="${esc(id)}">${item.status === 'active' ? '标记为已完成 ✓' : '移回进行中 ↻'}</button><button class="quiet-button" type="button" data-action="delete-project" data-id="${esc(id)}">删除项目</button></div>` : ''}</div>`);
}
function projectEditor(item = null, status = 'active') {
  if (!state.admin) return;
  openModal(`<h2>${item ? '编辑项目' : '添加项目'}</h2><p>填写项目名称与状态，简介和链接可以稍后补充。</p><form id="project-form" ${item ? `data-id="${esc(item.id)}"` : ''}><label for="project-title">项目名称</label><input class="field" id="project-title" name="title" maxlength="60" value="${esc(item?.title)}" required><label for="project-status">项目状态</label><select class="field" id="project-status" name="status"><option value="active" ${(item?.status || status) === 'active' ? 'selected' : ''}>进行中</option><option value="completed" ${(item?.status || status) === 'completed' ? 'selected' : ''}>已完成</option></select><label for="project-description">项目简介（可选）</label><textarea class="field" id="project-description" name="description">${esc(item?.description)}</textarea><label for="project-url">项目链接（可选）</label><input class="field" id="project-url" name="url" type="url" maxlength="1000" value="${esc(item?.url)}" placeholder="https://"><p class="form-error" role="alert"></p><button class="btn" type="submit">保存项目</button></form>`);
  document.querySelector('#project-title')?.focus();
}
function focusProject(id = '') {
  document.getElementById(id ? `project-${id}` : 'work-projects')?.focus({ preventScroll: true });
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, status } = button.dataset;
  if (action === 'open-project') return projectModal(id);
  if (!state.admin || !['new-project', 'edit-project', 'delete-project', 'toggle-project'].includes(action)) return;
  const item = (state.projects || []).find(project => project.id === id);
  try {
    if (action === 'new-project') return projectEditor(null, status || 'active');
    if (!item) return;
    if (action === 'edit-project') return projectEditor(item);
    if (action === 'delete-project') {
      if (!confirm('确定删除这个项目吗？')) return;
      await request(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.projects = state.projects.filter(project => project.id !== id);
      await requestModalClose(); render(); focusProject(); toast('项目已删除');
    }
    if (action === 'toggle-project') {
      button.disabled = true;
      const updated = await request(`/api/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ ...item, status: item.status === 'active' ? 'completed' : 'active' }) });
      state.projects = state.projects.map(project => project.id === id ? updated : project);
      await requestModalClose(); render(); focusProject(id); toast(updated.status === 'completed' ? '已收录到完成的项目' : '已移回进行中的项目');
    }
  } catch (error) { button.disabled = false; toast(error.message); }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (form.id !== 'project-form') return;
  event.preventDefault();
  if (!state.admin) return;
  const button = form.querySelector('[type=submit]');
  if (button.disabled) return;
  button.disabled = true; form.querySelector('.form-error').textContent = '';
  try {
    const id = form.dataset.id, values = Object.fromEntries(new FormData(form));
    const item = await request(id ? `/api/projects/${encodeURIComponent(id)}` : '/api/projects', { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) });
    state.projects = (state.projects || []).filter(project => project.id !== item.id).concat(item);
    await requestModalClose(); render(); focusProject(item.id); toast('项目已保存');
  } catch (error) { form.querySelector('.form-error').textContent = error.message; button.disabled = false; }
});
