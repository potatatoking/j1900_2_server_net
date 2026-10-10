import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function setup() {
  const handlers = {};
  const node = { innerHTML: '', open: false, textContent: '', addEventListener(event, callback) { (handlers[event] ??= []).push(callback); }, classList: { add() {}, remove() {} }, removeAttribute() {}, setAttribute() {}, showModal() { this.open = true; }, close() { this.open = false; }, focus() {} };
  const requests = [];
  const context = vm.createContext({
    document: { querySelector: () => node, addEventListener(event, callback) { handlers[`document-${event}`] = callback; } },
    window: { addEventListener() {} }, location: { protocol: 'http:', pathname: '/', hash: '#talk' },
    URL, URLSearchParams, setTimeout: () => 0, clearTimeout() {},
    FormData: class { constructor(form) { this.values = form.values; } entries() { return Object.entries(this.values); } },
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ id: 'reply-test', author: '访客', content: '只回复第二帖', createdAt: new Date().toISOString() }) }; }
  });
  vm.runInContext(await fs.readFile(new URL('../public/quotes.js', import.meta.url), 'utf8'), context);
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/\nload\(\);\s*$/, '') + `\nObject.assign(state, previewData); state.topics = [
    { id: 'first', title: '第一帖', author: '甲', content: '第一帖正文', replies: [], createdAt: '2026-10-01T10:00:00Z' },
    { id: 'second', title: '第二帖', author: '乙', content: '第二帖正文', replies: [], createdAt: '2026-10-02T10:00:00Z' }
  ];`, context);
  return { context, handlers, node, requests, run: code => vm.runInContext(code, context) };
}

test('conversation keeps drafts per topic and submits to the selected topic', async () => {
  const { run, handlers, node, requests } = await setup();
  run("topicConversation('first')");
  assert.match(node.innerHTML, /选择留言帖子/);
  const draftForm = { dataset: { topic: 'first' }, elements: { author: { value: '访客' }, content: { value: '第一帖草稿' } } };
  for (const callback of handlers.input) callback({ target: { closest: selector => selector === '.conversation-reply' ? draftForm : null } });
  run("topicConversation('second')");
  assert.doesNotMatch(node.innerHTML, /第一帖草稿/);
  run("topicConversation('first')");
  assert.match(node.innerHTML, /第一帖草稿/);
  run("topicConversation('second')");
  const button = { disabled: false };
  await handlers['document-submit']({ preventDefault() {}, target: {
    id: '', dataset: { topic: 'second' }, values: { author: '访客', content: '只回复第二帖' },
    matches: selector => selector === '.reply-form', querySelector: selector => selector === 'button[type="submit"]' ? button : null
  } });
  assert.equal(requests[0].url, '/api/topics/second/replies');
  assert.equal(run("state.topics[0].replies.length"), 0);
  assert.equal(run("state.topics[1].replies.length"), 1);
  assert.match(node.innerHTML, /只回复第二帖/);
  run("topicConversation('first')");
  assert.match(node.innerHTML, /第一帖草稿/);
});

test('each inner page places its single search below the primary content', async () => {
  const { run, context } = await setup();
  for (const [page, expression, content] of [
    ['talk', 'talk()', 'talk-bubbles'], ['life', "postsPage('life')", 'life-archive'],
    ['study', 'studyPage()', 'study-work'], ['about', 'about()', 'saber-scene']
  ]) {
    context.location.hash = `#${page}`;
    const html = run(expression);
    assert.equal((html.match(/id="site-search"/g) || []).length, 1);
    assert.ok(html.indexOf('page-bottom-search') > html.lastIndexOf(content), page);
  }
});

test('conversation slider separates reading and writing without replacing the draft', async () => {
  const { run, node } = await setup();
  run("topicConversation('first')");
  assert.match(node.innerHTML, /id="conversation-write"[^>]*hidden/);
  run("topicConversation('first', true)");
  assert.match(node.innerHTML, /id="conversation-read"[^>]*hidden/);
  const tabs = ['read', 'write'].map(mode => ({ dataset: { conversationMode: mode }, setAttribute(key, value) { this[key] = value; }, focus() { this.focused = true; } }));
  const switcher = { dataset: {}, querySelectorAll: () => tabs };
  const readPanel = { hidden: false };
  const writePanel = { hidden: true, draft: '保留这句话' };
  node.querySelector = selector => ({ '.conversation-switch': switcher, '#conversation-read': readPanel, '#conversation-write': writePanel })[selector];
  run("setConversationMode('write', true)");
  assert.equal(switcher.dataset.mode, 'write');
  assert.equal(readPanel.hidden, true);
  assert.equal(writePanel.hidden, false);
  assert.equal(tabs[1]['aria-selected'], 'true');
  assert.equal(tabs[1].focused, true);
  run("setConversationMode('read')");
  assert.equal(writePanel.hidden, true);
  assert.equal(writePanel.draft, '保留这句话');
});

test('publication status is displayed inside the open dialog', async () => {
  const { run, node, context } = await setup();
  const status = { hidden: true, textContent: '' };
  run("topicConversation('first')");
  context.document.querySelector = selector => selector === '#modal-status' ? status : node;
  run("toast('留言已发送')");
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '留言已发送');
});
