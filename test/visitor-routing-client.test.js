import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/visitor-routing.js', import.meta.url), 'utf8');

async function browser(options = {}) {
  const events = {};
  const requests = [];
  const redirects = [];
  const location = new URL(options.url || 'https://cn.blog.example.test:40475/work?year=2026#work?item=post-123');
  location.replace = target => redirects.push(target);
  const document = {
    visibilityState: options.hidden ? 'hidden' : 'visible',
    querySelector: () => options.dialog ? {} : null,
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  let target = options.target ?? null;
  const context = {
    URL, URLSearchParams, AbortSignal, location, document,
    window: { addEventListener: (name, callback) => { events[name] = callback; } },
    navigator: { connection: { addEventListener: (name, callback) => { events[name] = callback; } } },
    fetch: async (url, settings) => {
      requests.push({ url, settings });
      if (options.fail) throw new Error('offline');
      return { ok: options.ok !== false, json: async () => ({ target }) };
    }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { events, requests, redirects, document, setTarget(value) { target = value; } };
}

test('public pages recheck routing and preserve paths, queries and article hashes', async () => {
  const page = await browser({ target: 'http://campus.blog.example.test:8080' });
  assert.deepEqual(page.redirects, ['http://campus.blog.example.test:8080/work?year=2026#work?item=post-123']);
  assert.equal(page.requests[0].url, '/api/route?year=2026');
  assert.equal(page.requests[0].settings.cache, 'no-store');
  assert.equal(page.requests[0].settings.credentials, 'omit');
  await page.events.pageshow();
  assert.equal(page.redirects.length, 1);
});

test('network changes, restored pages and visibility changes recheck the current network', async () => {
  for (const event of ['online', 'pageshow', 'visibilitychange', 'change']) {
    const page = await browser();
    assert.equal(page.redirects.length, 0);
    page.setTarget('http://campus.blog.example.test:8080');
    await page.events[event]();
    assert.equal(page.redirects.length, 1, event);
  }
});

test('routing leaves non-entry paths, explicit global access, hidden pages and open editors alone', async () => {
  for (const options of [
    { url: 'https://cn.blog.example.test:40475/api/session' },
    { url: 'https://cn.blog.example.test:40475/app.js' },
    { url: 'https://cn.blog.example.test:40475/work?route=global' },
    { hidden: true },
    { dialog: true }
  ]) {
    const page = await browser({ ...options, target: 'http://campus.blog.example.test:8080' });
    assert.equal(page.requests.length, 0);
    assert.equal(page.redirects.length, 0);
  }
});

test('admin entrances use all three destinations and preserve the selected admin panel', async () => {
  for (const route of ['/admin', '/admin/', '/admin.html']) {
    for (const target of ['http://campus.blog.example.test:8080', 'https://cn.blog.example.test:40475', 'https://blog.example.test']) {
      const page = await browser({ url: 'https://example.test' + route + '?view=edit#articles', target });
      assert.deepEqual(page.redirects, [target + route + '?view=edit#articles']);
    }
  }
  for (const template of ['index.html', 'admin.html']) {
    const html = await fs.readFile(new URL('../public/' + template, import.meta.url), 'utf8');
    assert.match(html, /src="\/visitor-routing\.js\?v=2"/);
  }
});

test('typing in admin or public forms prevents automatic navigation from discarding input', async () => {
  for (const route of ['/admin', '/work']) {
    const page = await browser({ url: 'https://cn.blog.example.test:40475' + route });
    page.events.input({ target: { closest: selector => selector === 'form' ? {} : null } });
    page.setTarget('http://campus.blog.example.test:8080');
    await page.events.online();
    assert.equal(page.redirects.length, 0);
    assert.equal(page.requests.length, 1);
  }
});

test('routing failures and terminal origins keep the current page without loops', async () => {
  for (const options of [
    { fail: true }, { ok: false },
    { target: 'https://cn.blog.example.test:40475' },
    { target: 'javascript:alert(1)' },
    { target: 'http://user:password@example.test' },
    { target: 'invalid' },
    { url: 'http://campus.blog.example.test:8080/', target: 'http://campus.blog.example.test:8080' }
  ]) {
    const page = await browser(options);
    assert.equal(page.redirects.length, 0);
  }
  const page = await browser({ hidden: true });
  page.document.visibilityState = 'visible';
  page.setTarget('http://campus.blog.example.test:8080');
  await page.events.visibilitychange();
  assert.equal(page.redirects.length, 1);
});
