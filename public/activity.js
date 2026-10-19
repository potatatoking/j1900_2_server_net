const activityViewState = {
  github: { year: '', day: '', scope: 'private' },
  luogu: { year: '', day: '', scope: 'solved' }
};
const activityEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const activityToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
function activityYears(data) {
  return [...new Set([activityToday().slice(0, 4), ...(data?.daily || []).map(item => item.date.slice(0, 4))])].sort().reverse();
}
function activityCount(data, day, source, scope) {
  const row = (data?.daily || []).find(item => item.date === day);
  return Number(source === 'luogu' ? row?.count || 0 : row?.[scope] || 0);
}
function activityHeatmap(source, data, scope, label) {
  const selection = activityViewState[source], year = Number(selection.year);
  const today = activityToday(), start = new Date(Date.UTC(year, 0, 1)), end = new Date(Date.UTC(year + 1, 0, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: offset }, () => '<span class="activity-cell is-padding" aria-hidden="true"></span>');
  const rows = data.daily || [], max = Math.max(1, ...rows.filter(row => row.date.startsWith(String(year))).map(row => source === 'luogu' ? row.count : row[scope] || 0));
  const activeDay = selection.day || (today.startsWith(String(year)) ? today : `${year}-12-31`);
  for (let time = start.getTime(); time < end.getTime(); time += 86400_000) {
    const day = new Date(time).toISOString().slice(0, 10), count = activityCount(data, day, source, scope);
    if (day > today) { cells.push('<span class="activity-cell is-future" aria-hidden="true"></span>'); continue; }
    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(count / max * 4)));
    const unit = source === 'luogu' ? '道已记录题目' : '次提交';
    cells.push(`<button type="button" class="activity-cell level-${level}" data-activity-source="${source}" data-activity-scope="${scope}" data-activity-day="${day}" aria-label="${day}，${label}，${count}${unit}" aria-pressed="${selection.day === day && selection.scope === scope}" tabindex="${day === activeDay ? 0 : -1}" title="${day} · ${count}${unit}"></button>`);
  }
  return `<div class="activity-map-block"><h4>${label}</h4><div class="activity-map-scroll" role="group" aria-label="${label}热力图"><div class="activity-week-labels" aria-hidden="true"><span>一</span><span>三</span><span>五</span><span>日</span></div><div class="activity-map-inner"><div class="activity-months" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<span>${i + 1}月</span>`).join('')}</div><div class="activity-map" data-activity-map>${cells.join('')}</div></div></div></div>`;
}
function activityDetails(source, data) {
  const selection = activityViewState[source], day = selection.day || activityToday();
  if (source === 'github') {
    const row = (data.daily || []).find(item => item.date === day);
    return `<div class="activity-day-details" role="status"><strong>${activityEsc(day)}</strong><p>公开 ${Number(row?.public || 0)} 次 · 私密 ${Number(row?.private || 0)} 次 · 合计 ${Number(row?.total || 0)} 次</p></div>`;
  }
  const solved = (data.solved || []).filter(item => item.date === day);
  return `<div class="activity-day-details"><strong>${activityEsc(day)} · ${solved.length} 道已记录题目</strong>${solved.length ? `<ul>${solved.map(item => `<li><time datetime="${activityEsc(item.date)}">${activityEsc(item.date)}</time><a href="https://www.luogu.com.cn/problem/${encodeURIComponent(item.pid)}" target="_blank" rel="noopener noreferrer">${activityEsc(item.pid)} · ${activityEsc(item.title)}</a>${item.recordId ? `<a class="activity-record-link" href="https://www.luogu.com.cn/record/${encodeURIComponent(item.recordId)}" target="_blank" rel="noopener noreferrer">通过记录 ↗</a>` : ''}</li>`).join('')}</ul>` : '<p>这一天没有已同步的通过记录。</p>'}</div>`;
}
function renderActivityPanel(source) {
  const data = state.activity?.[source], isGithub = source === 'github', title = isGithub ? '代码在生长' : '刷题足迹';
  if (!data || data.status === 'unconfigured' || (data.status === 'error' && !data.updatedAt)) return `<section class="activity-panel" data-activity-panel="${source}"><div class="activity-title"><div><span class="study-kicker">${isGithub ? 'GITHUB / COMMITS' : 'LUOGU / SOLVED'}</span><h3>${title}</h3></div></div><p class="activity-status">${data?.status === 'error' ? '暂时无法读取记录，请稍后再来看看。' : isGithub ? 'GitHub 记录尚未同步。' : '洛谷记录将在账号接入后展示。'}</p></section>`;
  const years = activityYears(data), selection = activityViewState[source];
  if (!years.includes(selection.year)) selection.year = years[0];
  const label = isGithub ? 'GitHub' : '洛谷';
  const yearRows = (data.daily || []).filter(item => item.date.startsWith(selection.year));
  const yearTotal = yearRows.reduce((sum, item) => sum + (isGithub ? item.total : item.count), 0);
  const total = isGithub ? Number(data.totals?.total || 0) : Number(data.totalSolved || 0);
  const stats = isGithub ? [
    ['累计提交', total], ['公开提交', Number(data.totals?.public || 0)], ['私密提交', Number(data.totals?.private || 0)], [`${selection.year} 年`, yearTotal]
  ] : [['累计已解题', total], [`${selection.year} 年已记录`, yearTotal], ['日期待补', Number(data.undatedCount || 0)]];
  const unknown = Number(data.unattributed?.public || 0) + Number(data.unattributed?.private || 0);
  return `<section class="activity-panel activity-${source}" data-activity-panel="${source}" aria-label="${label}活动记录"><div class="activity-title"><div><span class="study-kicker">${isGithub ? 'GITHUB / COMMITS' : 'LUOGU / SOLVED'}</span><h3>${title}</h3><p>${isGithub ? '每一次提交，都是把想法变成现实的一小步。' : '把一道道想通的题，留在日历里。'}</p></div><label class="activity-year-label">年份<select data-activity-year="${source}" aria-label="选择${label}统计年份">${years.map(year => `<option ${year === selection.year ? 'selected' : ''}>${year}</option>`).join('')}</select></label></div><div class="activity-stats">${stats.map(([name, value]) => `<div><strong>${value}</strong><span>${name}</span></div>`).join('')}</div>${data.status === 'error' ? '<p class="activity-error" role="status">本次同步未完成，继续显示上次保存的记录。</p>' : ''}${isGithub ? activityHeatmap(source, data, 'public', '公开仓库提交') + activityHeatmap(source, data, 'private', '私密仓库提交') : activityHeatmap(source, data, 'solved', '已记录通过题目')}<div class="activity-legend"><span>少</span>${[0, 1, 2, 3, 4].map(level => `<i class="activity-cell level-${level}" aria-hidden="true"></i>`).join('')}<span>多</span><small>按北京时间记日 · 点击日期查看</small></div><div class="activity-details-slot">${activityDetails(source, data)}</div>${!isGithub && data.undatedCount ? `<details class="activity-undated"><summary>${Number(data.undatedCount)} 道题暂未取得通过日期</summary><p>这些题计入累计已解题，不补造日期，也不点亮热力图。</p><ul>${(data.solved || []).filter(item => !item.date).map(item => `<li><a href="https://www.luogu.com.cn/problem/${encodeURIComponent(item.pid)}" target="_blank" rel="noopener noreferrer">${activityEsc(item.pid)} · ${activityEsc(item.title)}</a></li>`).join('')}</ul></details>` : ''}<details class="activity-definition"><summary>统计说明</summary><p>${isGithub ? '统计本人拥有的仓库中可归属到本账号的 Commit，包含各分支，同一仓库内相同 SHA 只计一次。公开与私密分别统计；私密仓库只展示日期和数量。' : activityEsc(data.dateDefinition || '按当前可读取记录中的最早通过日期记日，重复通过同一题不重复计入。')}${isGithub && unknown ? ` 另有 ${unknown} 条历史提交无法关联到账号，未计入个人提交。` : ''}</p></details><div class="activity-footer"><span>更新于 ${data.updatedAt ? activityEsc(new Date(data.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })) : '尚未同步'}</span>${state.admin ? `<button class="quiet-button" type="button" data-activity-sync ${state.activity?.syncing ? 'disabled' : ''}>${state.activity?.syncing ? '正在同步…' : '同步记录 ↻'}</button>` : ''}</div></section>`;
}
function updateActivityPanel(source) {
  const panel = document.querySelector(`[data-activity-panel="${source}"]`);
  if (panel) { panel.outerHTML = renderActivityPanel(source); positionActivityMaps(); }
}
function positionActivityMaps() {
  for (const scroll of document.querySelectorAll('.activity-map-scroll')) {
    const active = scroll.querySelector('[data-activity-day][tabindex="0"]');
    if (active && scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft += active.getBoundingClientRect().left - scroll.getBoundingClientRect().left - scroll.clientWidth * .65;
  }
}
document.addEventListener('click', async event => {
  const cell = event.target.closest('[data-activity-day]');
  if (cell) {
    const { activitySource: source, activityDay: day, activityScope: scope } = cell.dataset;
    Object.assign(activityViewState[source], { day, scope });
    const panel = cell.closest('[data-activity-panel]');
    for (const item of panel.querySelectorAll('[data-activity-day]')) { const active = item === cell; item.setAttribute('aria-pressed', String(active)); if (item.closest('[data-activity-map]') === cell.closest('[data-activity-map]')) item.tabIndex = active ? 0 : -1; }
    panel.querySelector('.activity-details-slot').innerHTML = activityDetails(source, state.activity[source]);
  }
  if (event.target.closest('[data-activity-sync]') && state.admin) {
    try {
      await request('/api/activity/sync', { method: 'POST', body: '{}' });
      toast('已开始同步记录');
      state.activity = await request('/api/activity');
      updateActivityPanel('github'); updateActivityPanel('luogu');
      pollActivitySync();
    } catch (error) { toast(error.message); }
  }
});
document.addEventListener('change', event => {
  const source = event.target.dataset.activityYear;
  if (!activityViewState[source]) return;
  Object.assign(activityViewState[source], { year: event.target.value, day: '' });
  updateActivityPanel(source);
  document.querySelector(`[data-activity-year="${source}"]`)?.focus();
});
document.addEventListener('keydown', event => {
  const cell = event.target.closest('[data-activity-day]');
  if (!cell) return;
  const cells = [...cell.closest('[data-activity-map]').querySelectorAll('[data-activity-day]')], index = cells.indexOf(cell);
  const next = { ArrowUp: index - 1, ArrowDown: index + 1, ArrowLeft: index - 7, ArrowRight: index + 7, Home: 0, End: cells.length - 1 }[event.key];
  if (next == null) return;
  event.preventDefault();
  const target = cells[Math.max(0, Math.min(cells.length - 1, next))];
  for (const item of cells) item.tabIndex = item === target ? 0 : -1;
  target?.focus();
});
let activityPollTimer;
function openActivitySearchTarget(id) {
  const source = id.startsWith('solved-') ? 'luogu' : id.startsWith('commit-') ? 'github' : '';
  if (!source || (source === 'luogu' ? route() !== 'study' : route() !== 'work')) return null;
  const problem = source === 'luogu' ? state.activity?.luogu?.solved?.find(item => item.pid === id.slice(7)) : null;
  const day = source === 'github' ? id.slice(7) : problem?.date;
  if (day) Object.assign(activityViewState[source], { year: day.slice(0, 4), day });
  updateActivityPanel(source);
  const panel = document.querySelector(`[data-activity-panel="${source}"]`);
  if (source === 'luogu' && problem && !day) { const undated = panel?.querySelector('.activity-undated'); if (undated) undated.open = true; }
  return panel;
}
function pollActivitySync(attempt = 0) {
  clearTimeout(activityPollTimer);
  if (!state.activity?.syncing || attempt >= 90) return;
  activityPollTimer = setTimeout(async () => {
    try {
      state.activity = await request('/api/activity');
      if (['study', 'work'].includes(route())) { updateActivityPanel('github'); updateActivityPanel('luogu'); }
      pollActivitySync(attempt + 1);
    } catch { /* Keep the last complete page if the connection drops. */ }
  }, 2000);
}
