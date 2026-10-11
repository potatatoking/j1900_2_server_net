import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = (await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/\nload\(\);\s*$/, '');
function harness(reduced = false, admin = false) {
  const animations = [];
  const animate = (keyframes, options) => {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const animation = { keyframes, options, finished, finish: resolve, cancel: () => reject(new Error('cancelled')) };
    animations.push(animation);
    return animation;
  };
  const sheet = { animate };
  const layer = { hidden: true, animate, classList: { toggle() {} }, querySelector: selector => selector === '.turn-sheet' ? sheet : {} };
  const handlers = {};
  const node = { animate, open: false, firstElementChild: { style: {} }, querySelector: () => null, addEventListener(event, callback) { (handlers[event] ??= []).push(callback); } };
  const bodyClasses = new Set();
  const body = { dataset: { page: 'life' }, classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name), contains: name => bodyClasses.has(name) } };
  const commits = [];
  const context = vm.createContext({
    document: { body, querySelector: selector => selector === '#paper-transition' ? layer : node, addEventListener() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: reduced }) },
    location: { protocol: 'file:', pathname: admin ? '/admin' : '/', hash: '' }, scrollTo() {}, commits
  });
  vm.runInContext(source, context);
  return { context, handlers, body, bodyClasses, node, commits, layer, animations, turn: vm.runInContext('paperTransition', context), blur: vm.runInContext('blurPageTransition', context), update: vm.runInContext('updateContent', context), change: vm.runInContext('changePage', context) };
}

test('a newer turn cancels the old destination and clears the paper overlay', async () => {
  const h = harness();
  const commits = [];
  const old = h.turn(() => commits.push('old'), 'old');
  const current = h.turn(() => commits.push('current'), 'current');
  await old;
  assert.deepEqual(commits, []);
  assert.equal(h.layer.hidden, false);
  h.animations[1].finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(commits, ['current']);
  h.animations[2].finish();
  await current;
  assert.equal(h.layer.hidden, true);
});

test('reduced motion commits immediately without creating an animation', async () => {
  const h = harness(true);
  let count = 0;
  await h.turn(() => count++, 'next');
  assert.equal(count, 1);
  assert.equal(h.animations.length, 0);
  assert.equal(h.layer.hidden, true);
});

test('an interrupted exit does not replay a destination that was already rendered', async () => {
  const h = harness();
  const commits = [];
  const first = h.turn(() => commits.push('first'), 'first');
  h.animations[0].finish();
  await new Promise(resolve => setImmediate(resolve));
  const next = h.turn(() => commits.push('next'), 'next', true, false);
  await Promise.all([first, next]);
  assert.deepEqual(commits, ['first', 'next']);
  assert.equal(h.layer.hidden, true);
});


test('content replacement interrupts at its current height and clears completed animation ownership', async () => {
  const h = harness();
  const frames = [];
  let height = 100;
  let cancelled = 0;
  const pending = [];
  const element = {
    getBoundingClientRect: () => ({ height }),
    animate(keyframes) {
      frames.push(keyframes);
      let finish, reject;
      const finished = new Promise((yes, no) => { finish = yes; reject = no; });
      pending.push(finish);
      return { finished, cancel() { cancelled++; reject(new Error('interrupted')); } };
    }
  };
  h.update(element, () => { height = 240; });
  height = 160; // The visible intermediate height of the first animation.
  h.update(element, () => { height = 80; });
  assert.equal(cancelled, 1);
  assert.equal(frames[1][0].height, '160px');
  assert.equal(frames[1][1].height, '80px');
  await new Promise(resolve => setImmediate(resolve));
  pending[1]();
  await new Promise(resolve => setImmediate(resolve));
  h.update(element, () => { height = 120; });
  assert.equal(cancelled, 1, 'completed animations must release ownership');
  pending[2]();
});

test('reduced motion updates content synchronously without measuring or animating', () => {
  const h = harness(true);
  let updated = false;
  h.update({ animate() { assert.fail('must not animate'); } }, () => { updated = true; });
  assert.equal(updated, true);
});

test('fan navigation commits after the old view blurs and completes the new view reveal', async () => {
  const h = harness();
  let commits = 0;
  const navigation = h.blur(() => commits++);
  assert.equal(commits, 0);
  h.animations[0].finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(commits, 1);
  assert.equal(h.node.firstElementChild.style.animation, 'none', 'the CSS arrival must not mask or replay the blur');
  h.animations[1].finish();
  await navigation;
  assert.equal(h.layer.hidden, true);
  assert.equal(h.bodyClasses.has('page-blur-transition'), false);
});

test('every public inner page uses the same blur for ordinary links and deep links', async () => {
  for (const target of ['#life', '#study', '#study?item=study-work', '#about', '#about?item=profile', '#talk']) {
    const h = harness();
    h.body.dataset.page = 'home';
    h.context.location.hash = target;
    vm.runInContext('render = () => { commits.push(route()); document.body.dataset.page = route(); }', h.context);
    const navigation = h.change();
    assert.deepEqual(h.commits, []);
    assert.equal(h.animations[0].keyframes[1].filter, 'blur(14px)');
    assert.equal(h.layer.hidden, true);
    h.animations[0].finish();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.commits, [target.slice(1).split('?')[0]]);
    h.animations[1].finish();
    await navigation;
    assert.equal(h.bodyClasses.has('page-blur-transition'), false);
  }
});

test('same-page anchors skip route animations and administrator links retain paper navigation', async () => {
  const same = harness();
  same.body.dataset.page = 'about';
  same.context.location.hash = '#about?item=profile';
  vm.runInContext('render = () => commits.push(route())', same.context);
  await same.change();
  assert.deepEqual(same.commits, ['about']);
  assert.equal(same.animations.length, 0);
  const admin = harness(false, true);
  admin.context.location.hash = '#about';
  vm.runInContext('render = () => commits.push(route())', admin.context);
  const navigation = admin.change();
  assert.equal(admin.layer.hidden, false);
  assert.equal(admin.animations[0].keyframes[1].filter, undefined);
  admin.animations[0].finish();
  await new Promise(resolve => setImmediate(resolve));
  admin.animations[1].finish();
  await navigation;
  assert.deepEqual(admin.commits, ['about']);
});

test('fan labels preview study on hover, focus and touch before navigation', () => {
  for (const action of ['pointerover', 'focusin', 'pointerdown']) {
    const h = harness();
    vm.runInContext("fanOpen = true; fanSelection = 1; selectFanPage = index => { fanSelection = index; commits.push(fanPages[index].id); }", h.context);
    const item = { dataset: { fanPage: 'study' } };
    const target = { closest: selector => selector === '[data-fan-page]' ? item : selector === '#fan-panel' ? {} : null };
    for (const callback of h.handlers[action]) callback({ target, pointerType: action === 'pointerdown' ? 'touch' : 'mouse', button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    assert.deepEqual(h.commits, ['study'], action);
    assert.equal(h.context.location.hash, '', 'preview must not navigate before confirmation');
    if (action !== 'pointerdown') {
      for (const callback of h.handlers[action]) callback({ target, pointerType: 'mouse' });
      assert.equal(h.commits.length, 1, 'moving across the same label must not restart its preview');
    }
  }
});

test('a newer paper navigation interrupts the fan transition without rendering its stale destination', async () => {
  const h = harness();
  const commits = [];
  const fan = h.blur(() => commits.push('fan'));
  await h.turn(() => commits.push('latest'), 'latest', false, false);
  await fan;
  assert.deepEqual(commits, ['latest']);
  assert.equal(h.layer.hidden, true);
});

test('fan navigation honors reduced motion and recovers from an animation failure', async () => {
  const reduced = harness(true);
  let commits = 0;
  await reduced.blur(() => commits++);
  assert.equal(commits, 1);
  assert.equal(reduced.animations.length, 0);
  const h = harness();
  const navigation = h.blur(() => commits++);
  h.animations[0].cancel();
  await navigation;
  assert.equal(commits, 2);
});
