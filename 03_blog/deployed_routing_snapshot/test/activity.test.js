import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { activityDay, blankActivity, collectGithub, collectLuogu, normalizeLuoguRecords, createActivityStore, sanitizeActivity } from '../activity.js';

test('GitHub counts all branches once per repository, separates visibility and publishes no private metadata', async () => {
  const sha = n => String(n).padStart(40, 'a');
  const own = (n, timestamp = '2026-10-18T17:00:00Z') => ({ sha: sha(n), author: { login: 'potatatoking' }, commit: { author: { date: timestamp }, message: 'do not publish this private message' } });
  const repository = (id, name, isPrivate) => ({ id, name, private: isPrivate, owner: { login: 'potatatoking' } });
  const seenHeaders = [];
  const fetchImpl = async (url, options) => {
    seenHeaders.push(options.headers);
    const u = new URL(url), p = u.pathname;
    let body;
    if (p === '/user') body = { login: 'potatatoking' };
    else if (p === '/user/repos') body = [repository(1, 'public-repo', false), repository(2, 'private-secret-name', true)];
    else if (p.endsWith('/branches')) body = [{ name: 'main' }, { name: 'feature' }];
    else if (p.includes('/public-repo/commits')) body = u.searchParams.get('sha') === 'main' ? [own(1)] : [own(1), own(2, '2026-10-18T01:00:00Z')];
    else body = [own(3), { ...own(4), author: { login: 'other-person' } }, { ...own(5), author: null }];
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const result = await collectGithub({ username: 'potatatoking', token: 'secret-token', fetchImpl, now: new Date('2026-10-19T00:00:00Z') });
  assert.deepEqual(result.totals, { public: 2, private: 1, total: 3 });
  assert.deepEqual(result.unattributed, { public: 0, private: 1 });
  assert.deepEqual(result.daily, [{ date: '2026-10-18', public: 1, private: 0, total: 1 }, { date: '2026-10-19', public: 1, private: 1, total: 2 }]);
  assert.doesNotMatch(JSON.stringify(result), /secret-token|private-secret-name|public-repo|private message|other-person/);
  assert.ok(seenHeaders.every(headers => headers.Authorization === 'Bearer secret-token'));
});

test('GitHub rejects mismatched credentials and does not silently turn upstream errors into zero totals', async () => {
  await assert.rejects(collectGithub({ username: 'potatatoking' }), /只读凭据/);
  await assert.rejects(collectGithub({ username: 'potatatoking', token: 'secret', fetchImpl: async () => new Response('{"login":"different"}') }), /不匹配/);
  await assert.rejects(collectGithub({ username: 'potatatoking', token: 'secret', fetchImpl: async () => new Response('private-secret-name', { status: 403 }) }), error => /权限不足/.test(error.message) && !error.message.includes('private-secret'));
});

test('Luogu accepted records deduplicate problems by earliest readable day and preserve unknown dates', () => {
  const data = normalizeLuoguRecords([
    { id: 10, user: { uid: 123 }, status: 12, problem: { pid: 'P1001', title: 'A+B' }, submitTime: 1792429200 },
    { id: 11, user: { uid: 123 }, status: 12, problem: { pid: 'P1001', title: 'A+B' }, submitTime: '2026-10-18T01:00:00Z' },
    { id: 12, user: { uid: 123 }, status: 1, problem: { pid: 'P1002' }, submitTime: '2026-10-18T01:00:00Z' },
    { id: 13, user: { uid: 999 }, status: 12, problem: { pid: 'P1003' }, submitTime: '2026-10-18T01:00:00Z' }
  ], { uid: 123, passedProblems: ['P1001', 'P1004'] });
  assert.equal(data.totalSolved, 2);
  assert.equal(data.undatedCount, 1);
  assert.deepEqual(data.daily, [{ date: '2026-10-18', count: 1 }]);
  assert.equal(data.solved.find(item => item.pid === 'P1004').date, null);
  assert.equal(data.solved.find(item => item.pid === 'P1001').recordId, '11');
  assert.equal(activityDay('2026-10-18T17:00:00Z'), '2026-10-19');
});

test('Luogu collector reads all accepted pages and never requests submission source code', async () => {
  const urls = [];
  const result = await collectLuogu({ uid: 123, pause: async () => {}, fetchImpl: async url => {
    urls.push(url);
    if (url.includes('/user/')) return new Response(JSON.stringify({ currentData: { passedProblems: ['P1001','P1002','P1003'] } }));
    const page = new URL(url).searchParams.get('page');
    return new Response(JSON.stringify({ currentData: { records: { count: 2, result: page === '1' ? [{ id: 1, status: 12, problem: { pid: 'P1001', title: 'A+B' }, submitTime: '2026-10-18T00:00:00Z' }] : [{ id: 2, status: 12, problem: { pid: 'P1002', title: 'Another problem' }, submitTime: '2026-10-19T00:00:00Z' }] } } }));
  } });
  assert.equal(result.totalSolved, 3);
  assert.equal(result.undatedCount, 1);
  assert.equal(result.completeHistory, false);
  assert.equal(urls.length, 3);
  assert.ok(urls.every(url => url.includes('/record/list?') || url.includes('/user/')));
});

test('public serialization whitelists aggregate fields and drops credentials, repository names and messages', () => {
  const input = blankActivity();
  Object.assign(input.github, { token: 'secret-token', repository: 'private-secret-repository', message: 'private-message', username: 'potatatoking', daily: [{ date: '2026-10-18', public: 2, private: 3 }], status: 'ok' });
  input.luogu.cookie = 'secret-cookie';
  const safe = sanitizeActivity(input), serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, /secret|private-message|token|cookie|repository/);
  assert.deepEqual(safe.github.totals, { public: 2, private: 3, total: 5 });
});

test('current Luogu content-only schema and HTML context preserve actual problem names and dates', async () => {
  const result = await collectLuogu({ uid: 2359012, fetchImpl: async (url, options) => {
    assert.equal(options.headers['x-lentille-request'], 'content-only');
    const data = url.includes('/user/') ? { passed: [{ pid: 'P1914', name: '小书童——凯撒密码' }] } : { records: { count: 1, result: [{ id: 304123876, status: 12, user: { uid: 2359012 }, problem: { pid: 'P1914', name: '小书童——凯撒密码' }, submitTime: 1792382019 }] } };
    return new Response(`<html><script id="lentille-context" type="application/json">${JSON.stringify({ template: 'record.list', data })}</script></html>`);
  } });
  assert.equal(result.solved[0].title, '小书童——凯撒密码');
  assert.equal(result.solved[0].date, '2026-10-19');
  assert.equal(result.undatedCount, 0);
  assert.equal(result.completeHistory, true);
});

test('concurrent activity refreshes coalesce and a failed upstream preserves the last complete counts', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-activity-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const initial = blankActivity();
  Object.assign(initial.github, { status: 'ok', username: 'potatatoking', updatedAt: '2026-10-18T00:00:00Z', daily: [{ date: '2026-10-18', public: 0, private: 8, total: 8 }] });
  await fs.writeFile(path.join(dir, 'activity-public.json'), JSON.stringify(initial));
  await fs.writeFile(path.join(dir, 'activity-settings.json'), JSON.stringify({ github: { enabled: true, username: 'potatatoking', includePrivate: true, token: 'test-secret-token' } }));
  let calls = 0, rejectRequest;
  const store = await createActivityStore({ dataDir: dir, intervalMs: 0, collectGithubImpl: async () => { calls++; await new Promise((resolve, reject) => { rejectRequest = reject; }); } });
  t.after(() => store.close());
  const first = store.sync(), second = store.sync();
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(store.snapshot().syncing, true);
  rejectRequest(new Error('upstream denied test-secret-token'));
  await first;
  const result = store.snapshot();
  assert.equal(result.github.status, 'error');
  assert.equal(result.github.totals.private, 8);
  assert.equal(result.github.updatedAt, '2026-10-18T00:00:00Z');
  assert.equal(result.syncing, false);
  assert.doesNotMatch(JSON.stringify(result), /secret-token|upstream denied/);
  assert.equal(store.settingsStatus().github.tokenConfigured, true);
  assert.doesNotMatch(JSON.stringify(store.settingsStatus()), /test-secret-token/);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'activity-public.json'), 'utf8'));
  assert.equal(saved.github.totals.private, 8);
  if (process.platform !== 'win32') assert.equal((await fs.stat(path.join(dir, 'activity-public.json'))).mode & 0o777, 0o600);
});
