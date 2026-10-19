import fs from 'node:fs/promises';
import path from 'node:path';

export const ACTIVITY_TIMEZONE = 'Asia/Shanghai';
export function activityDay(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('上游记录的日期无效');
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ACTIVITY_TIMEZONE }).format(date);
}
export function blankActivity() {
  return {
    timezone: ACTIVITY_TIMEZONE,
    github: { status: 'unconfigured', username: '', updatedAt: null, daily: [], totals: { public: 0, private: 0, total: 0 }, unattributed: { public: 0, private: 0 } },
    luogu: { status: 'unconfigured', uid: '', updatedAt: null, solved: [], daily: [], totalSolved: 0, undatedCount: 0 }
  };
}
async function fetchJson(url, { fetchImpl = fetch, headers = {}, allowLuoguHtml = false } = {}) {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (response.status === 409 && new URL(url).hostname === 'api.github.com') return [];
  if (!response.ok) {
    const error = new Error(response.status === 401 ? '读取凭据无效或已过期' : response.status === 403 ? '读取权限不足或上游暂时限制访问' : response.status === 429 ? '上游请求频率受限，请稍后重试' : `上游读取失败（${response.status}）`);
    error.status = response.status; throw error;
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > 12_000_000) throw new Error('上游响应过大，已停止同步');
  try { return JSON.parse(text); } catch {
    if (allowLuoguHtml && new URL(url).hostname === 'www.luogu.com.cn') {
      const context = text.match(/<script\b[^>]*\bid=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i);
      if (context) { try { return JSON.parse(context[1]); } catch {} }
    }
    throw new Error('上游未返回有效数据，可能需要开放读取权限');
  }
}
export async function collectGithub({ username, token, includePrivate = true, fetchImpl = fetch, now = new Date() }) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username || '')) throw new Error('请填写有效的 GitHub 账号');
  if (includePrivate && !token) throw new Error('统计私密提交需要配置 GitHub 只读凭据');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'potato-notebook-activity', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let requestCount = 0;
  const read = async route => {
    if (++requestCount > 1500) throw new Error('本次同步达到请求上限，保留上次完整结果');
    return fetchJson(`https://api.github.com${route}`, { fetchImpl, headers });
  };
  const paginate = async route => {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const items = await read(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(items)) throw new Error('GitHub 返回的数据格式不正确');
      all.push(...items);
      if (items.length < 100) return all;
    }
    throw new Error('记录分页超出范围，保留上次完整结果');
  };
  if (includePrivate) {
    const viewer = await read('/user');
    if (viewer.login?.toLowerCase() !== username.toLowerCase()) throw new Error('GitHub 凭据与指定账号不匹配');
  }
  const repositories = await paginate(includePrivate ? '/user/repos?affiliation=owner' : `/users/${encodeURIComponent(username)}/repos?type=owner`);
  const days = new Map(), seen = new Set(), unattributed = { public: 0, private: 0 };
  for (const repository of repositories) {
    if (repository.owner?.login?.toLowerCase() !== username.toLowerCase() || (repository.private && !includePrivate)) continue;
    const scope = repository.private ? 'private' : 'public';
    const repoPath = `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}`;
    const branches = await paginate(`${repoPath}/branches`);
    for (const branch of branches) {
      const commits = await paginate(`${repoPath}/commits?sha=${encodeURIComponent(branch.name)}`);
      for (const commit of commits) {
        if (!/^[a-f\d]{40,64}$/i.test(commit.sha || '')) throw new Error('GitHub 返回的提交标识无效');
        const key = `${repository.id}:${commit.sha}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!commit.author?.login) { unattributed[scope]++; continue; }
        if (commit.author.login.toLowerCase() !== username.toLowerCase()) continue;
        const day = activityDay(commit.commit?.author?.date);
        if (!days.has(day)) days.set(day, { date: day, public: 0, private: 0, total: 0 });
        const entry = days.get(day); entry[scope]++; entry.total++;
      }
    }
  }
  const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = daily.reduce((all, day) => ({ public: all.public + day.public, private: all.private + day.private, total: all.total + day.total }), { public: 0, private: 0, total: 0 });
  return { status: 'ok', username, updatedAt: now.toISOString(), daily, totals, unattributed, includePrivate, definition: '本人拥有的仓库、所有分支、账号可归属作者、同仓库 SHA 去重；日期按北京时间' };
}

// Keep only verified Accepted metadata. Repeated accepted attempts count as one solved problem.
export function normalizeLuoguRecords(records, { uid, passedProblems = [], now = new Date(), completeHistory = false } = {}) {
  const solved = new Map();
  for (const item of passedProblems) {
    const pid = typeof item === 'string' ? item : item.pid;
    if (/^[A-Za-z\d_]+$/.test(pid || '')) solved.set(pid, { pid, title: typeof item === 'string' ? pid : String(item.title || item.name || pid).slice(0, 200), date: null, recordId: null });
  }
  for (const record of records) {
    if (![12, 'AC', 'Accepted'].includes(record.status)) continue;
    if (record.user?.uid != null && String(record.user.uid) !== String(uid)) continue;
    const problem = record.problem || {}, pid = String(problem.pid || record.pid || '');
    if (!/^[A-Za-z\d_]+$/.test(pid)) continue;
    const rawTime = record.submitTime ?? record.time;
    if (rawTime == null || rawTime === '' || rawTime === 0) { if (!solved.has(pid)) solved.set(pid, { pid, title: String(problem.title || problem.name || pid).slice(0, 200), date: null, recordId: null }); continue; }
    const timestamp = typeof rawTime === 'number' ? rawTime * (rawTime < 100_000_000_000 ? 1000 : 1) : rawTime;
    const date = activityDay(timestamp);
    const current = solved.get(pid);
    if (!current?.date || date < current.date) solved.set(pid, { pid, title: String(problem.title || problem.name || pid).slice(0, 200), date, recordId: /^\d+$/.test(String(record.id || '')) ? String(record.id) : null });
  }
  const rows = [...solved.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.pid.localeCompare(b.pid));
  const byDay = new Map();
  for (const problem of rows) if (problem.date) {
    if (!byDay.has(problem.date)) byDay.set(problem.date, { date: problem.date, count: 0 });
    byDay.get(problem.date).count++;
  }
  const complete = completeHistory && rows.every(item => item.date);
  return { status: 'ok', uid: String(uid), updatedAt: now.toISOString(), solved: rows, daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)), totalSolved: rows.length, undatedCount: rows.filter(item => !item.date).length, completeHistory: complete, dateDefinition: complete ? '可读取历史中的首次通过日期（北京时间）' : '当前可读取记录中的最早通过日期；不补造未知日期' };
}

export async function collectLuogu({ uid, cookie = '', fetchImpl = fetch, now = new Date(), pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^[1-9]\d{0,11}$/.test(String(uid || ''))) throw new Error('请填写有效的洛谷 UID');
  const headers = { Accept: 'application/json', 'x-lentille-request': 'content-only', 'User-Agent': 'potato-notebook-activity/1.0', Referer: `https://www.luogu.com.cn/user/${uid}`, ...(cookie ? { Cookie: cookie } : {}) };
  let passedProblems = [];
  try {
    const profile = await fetchJson(`https://www.luogu.com.cn/user/${uid}/practice`, { fetchImpl, headers, allowLuoguHtml: true });
    const data = profile.currentData || profile.data?.currentData || profile.data || profile;
    const passed = data.passed || data.passedProblems || data.user?.passedProblems;
    if (Array.isArray(passed)) passedProblems = passed;
  } catch { /* Dated public records can still be usable when the profile list is hidden. */ }
  const records = [];
  for (let page = 1; page <= 500; page++) {
    const body = await fetchJson(`https://www.luogu.com.cn/record/list?user=${uid}&status=12&page=${page}`, { fetchImpl, headers, allowLuoguHtml: true });
    const data = body.currentData || body.data?.currentData || body.data || body;
    const collection = data.records;
    const items = Array.isArray(collection) ? collection : collection?.result;
    if (!Array.isArray(items)) throw new Error('洛谷提交记录暂不可读取，请检查记录可见性');
    records.push(...items);
    const total = !Array.isArray(collection) && Number.isInteger(collection?.count) ? collection.count : null;
    if (items.length === 0 || (total !== null && records.length >= total)) return normalizeLuoguRecords(records, { uid, passedProblems, now, completeHistory: true });
    await pause(700);
  }
  throw new Error('洛谷记录分页超出本次范围，保留上次完整结果');
}

function validIso(value) { return typeof value === 'string' && Number.isFinite(new Date(value).getTime()) ? value : null; }
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function safeDay(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
export function sanitizeActivity(value) {
  const result = blankActivity(), github = value?.github, luogu = value?.luogu;
  if (github) {
    const daily = Array.isArray(github.daily) ? github.daily.filter(item => safeDay(item.date)).map(item => ({ date: item.date, public: safeCount(item.public), private: safeCount(item.private), total: safeCount(item.public) + safeCount(item.private) })) : [];
    result.github = { status: ['ok', 'error'].includes(github.status) ? github.status : 'unconfigured', username: /^[a-z\d-]{1,39}$/i.test(github.username || '') ? github.username : '', updatedAt: validIso(github.updatedAt), daily, totals: daily.reduce((sum, day) => ({ public: sum.public + day.public, private: sum.private + day.private, total: sum.total + day.total }), { public: 0, private: 0, total: 0 }), unattributed: { public: safeCount(github.unattributed?.public), private: safeCount(github.unattributed?.private) }, definition: '本人拥有的仓库、所有分支、账号可归属作者、同仓库 SHA 去重；日期按北京时间' };
  }
  if (luogu) {
    const solved = Array.isArray(luogu.solved) ? luogu.solved.filter(item => /^[a-z\d_]+$/i.test(item.pid || '')).map(item => ({ pid: item.pid, title: String(item.title || item.pid).slice(0, 200), date: safeDay(item.date) ? item.date : null, recordId: /^\d+$/.test(String(item.recordId || '')) ? String(item.recordId) : null })) : [];
    const days = new Map();
    for (const item of solved) if (item.date) days.set(item.date, (days.get(item.date) || 0) + 1);
    result.luogu = { status: ['ok', 'error'].includes(luogu.status) ? luogu.status : 'unconfigured', uid: /^[1-9]\d{0,11}$/.test(String(luogu.uid || '')) ? String(luogu.uid) : '', updatedAt: validIso(luogu.updatedAt), solved, daily: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })), totalSolved: solved.length, undatedCount: solved.filter(item => !item.date).length, completeHistory: luogu.completeHistory === true, dateDefinition: luogu.completeHistory === true ? '可读取历史中的首次通过日期（北京时间）' : '当前可读取记录中的最早通过日期；不补造未知日期' };
  }
  return result;
}

export async function writeActivitySnapshot(dataDir, snapshot) {
  await fs.mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, 'activity-public.json'), temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(sanitizeActivity(snapshot), null, 2), { mode: 0o600 });
  await fs.rename(temporary, target);
}

export async function createActivityStore({ dataDir, fetchImpl = fetch, intervalMs = 3600_000, collectGithubImpl = collectGithub, collectLuoguImpl = collectLuogu } = {}) {
  const settingsFile = path.join(dataDir, 'activity-settings.json');
  let settings = { github: { enabled: false, username: 'potatatoking', includePrivate: true, token: '' }, luogu: { enabled: false, uid: '', cookie: '' } };
  let value = blankActivity(), pending = null;
  try { settings = { ...settings, ...JSON.parse(await fs.readFile(settingsFile, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw new Error('活动读取配置无效'); }
  try { value = sanitizeActivity(JSON.parse(await fs.readFile(path.join(dataDir, 'activity-public.json'), 'utf8'))); } catch (error) { if (error.code !== 'ENOENT') throw new Error('活动缓存文件无效'); }
  const configured = source => source === 'github' ? Boolean(settings.github?.enabled && settings.github.username && (settings.github.token || !settings.github.includePrivate)) : Boolean(settings.luogu?.enabled && settings.luogu.uid);
  const snapshot = () => ({ ...structuredClone(value), syncing: Boolean(pending), githubAutoSync: configured('github'), luoguAutoSync: configured('luogu') });
  async function performSync() {
    const next = structuredClone(value);
    for (const source of ['github', 'luogu']) {
      if (!configured(source)) continue;
      try {
        next[source] = await (source === 'github' ? collectGithubImpl : collectLuoguImpl)({ ...settings[source], fetchImpl });
      } catch { next[source] = { ...next[source], status: 'error' }; }
    }
    const safe = sanitizeActivity(next);
    await writeActivitySnapshot(dataDir, safe);
    value = safe;
    return snapshot();
  }
  function sync() {
    if (pending) return pending;
    if (!configured('github') && !configured('luogu')) throw new Error('请先通过服务器私有文件配置活动读取权限');
    pending = performSync().finally(() => { pending = null; });
    return pending;
  }
  const timer = intervalMs > 0 ? setInterval(() => { if (configured('github') || configured('luogu')) { try { sync().catch(() => {}); } catch {} } }, intervalMs) : null;
  timer?.unref();
  return { snapshot, sync, close() { clearInterval(timer); }, settingsStatus: () => ({ github: { enabled: configured('github'), username: String(settings.github?.username || ''), tokenConfigured: Boolean(settings.github?.token) }, luogu: { enabled: configured('luogu'), uid: String(settings.luogu?.uid || ''), credentialConfigured: Boolean(settings.luogu?.cookie) } }) };
}
