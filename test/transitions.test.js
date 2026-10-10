import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = (await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/\nload\(\);\s*$/, '');
function harness(reduced = false) {
  const animations = [];
  const animate = () => {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const animation = { finished, finish: resolve, cancel: () => reject(new Error('cancelled')) };
    animations.push(animation);
    return animation;
  };
  const sheet = { animate };
  const layer = { hidden: true, animate, classList: { toggle() {} }, querySelector: selector => selector === '.turn-sheet' ? sheet : {} };
  const node = { addEventListener() {} };
  const context = vm.createContext({
    document: { querySelector: selector => selector === '#paper-transition' ? layer : node, addEventListener() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: reduced }) },
    location: { protocol: 'file:', hash: '' }
  });
  vm.runInContext(source, context);
  return { layer, animations, turn: vm.runInContext('paperTransition', context) };
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
