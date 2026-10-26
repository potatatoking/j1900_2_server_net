import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function setup() {
  const handlers = {};
  const context = vm.createContext({
    document: { addEventListener(name, callback) { handlers[name] = callback; } },
    state: { admin: false, activity: {
      github: { status: 'ok', username: 'example-user', updatedAt: '2026-10-19T00:00:00Z', totals: { public: 2, private: 3, total: 5 }, unattributed: { public: 0, private: 1 }, daily: [{ date: '2024-02-29', public: 2, private: 3, total: 5 }], repository: 'private-secret-name', token: 'private-secret-token' },
      luogu: { status: 'ok', uid: '123', updatedAt: '2026-10-19T00:00:00Z', totalSolved: 2, undatedCount: 1, daily: [{ date: '2024-02-29', count: 1 }], solved: [{ pid: 'P1001', title: '<script>alert(1)</script>', date: '2024-02-29', recordId: '1234' }, { pid: 'P1002', title: 'Unknown date', date: null }] }
    } }
  });
  vm.runInContext(await fs.readFile(new URL('../public/activity.js', import.meta.url), 'utf8'), context);
  return { context, run: code => vm.runInContext(code, context) };
}

test('GitHub renders separate public and private maps with leap days and no private repository details', async () => {
  const { run } = await setup();
  const html = run("activityViewState.github.year = '2024'; renderActivityPanel('github')");
  assert.match(html, /公开仓库提交/);
  assert.match(html, /私密仓库提交/);
  assert.doesNotMatch(html, /private-secret-name|private-secret-token/);
  assert.equal((html.match(/data-activity-day="2024-02-29"/g) || []).length, 2);
  assert.equal((html.match(/data-activity-day=/g) || []).length, 366 * 2);
  assert.match(html, /公开 0 次 · 私密 0 次 · 合计 0 次/);
});

test('dated solved problems show the chosen date while unknown dates remain outside the heatmap', async () => {
  const { run } = await setup();
  const html = run("Object.assign(activityViewState.luogu, {year:'2024',day:'2024-02-29'}); renderActivityPanel('luogu')");
  assert.match(html, /2024-02-29 · 1 道已记录题目/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /1 道题暂未取得通过日期/);
  assert.match(html, /https:\/\/www.luogu.com.cn\/record\/1234/);
  assert.match(html, /data-activity-day="2024-02-29"[^>]+1道已记录题目/);
});

test('unconfigured sources and failed first reads do not invent empty statistics', async () => {
  const { run } = await setup();
  let html = run("state.activity.luogu = {status:'unconfigured'}; renderActivityPanel('luogu')");
  assert.match(html, /账号接入后展示/);
  assert.doesNotMatch(html, /data-activity-day|累计已解题/);
  html = run("state.activity.luogu = {status:'error',updatedAt:null}; renderActivityPanel('luogu')");
  assert.match(html, /暂时无法读取/);
  assert.doesNotMatch(html, /data-activity-day|累计已解题/);
});
