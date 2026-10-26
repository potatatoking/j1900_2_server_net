import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function setup(clipboard = true) {
  const handlers = {}, copied = [];
  let selected = false;
  const node = { addEventListener() {}, classList: { add() {}, remove() {} }, focus() {} };
  const context = vm.createContext({
    document: {
      querySelector: () => node,
      addEventListener(event, callback) { handlers[event] = callback; },
      createRange: () => ({ selectNodeContents() { selected = true; } })
    },
    window: { addEventListener() {}, getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    navigator: clipboard ? { clipboard: { writeText: async text => copied.push(text) } } : {},
    location: { protocol: 'http:', pathname: '/', hash: '#friends', origin: 'http://staging.invalid' },
    setTimeout: () => 0, clearTimeout() {}
  });
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/\nload\(\);\s*$/, '') + '\nObject.assign(state, previewData);', context);
  return { run: code => vm.runInContext(code, context), handlers, copied, selected: () => selected };
}

test('random display keeps every friend once and never mutates the stored order', async () => {
  const { run } = await setup();
  run("const input = Object.freeze([{id:'a'}, {id:'b'}, {id:'c'}, {id:'d'}]);");
  assert.equal(run("shuffleFriends(input, () => 0).map(x => x.id).join(',')"), 'b,c,d,a');
  assert.equal(run("shuffleFriends(input, () => .999).map(x => x.id).join(',')"), 'a,b,c,d');
  assert.equal(run("input.map(x => x.id).join(',')"), 'a,b,c,d');
  assert.equal(run('shuffleFriends([]).length'), 0);
  assert.equal(run("shuffleFriends([input[0]])[0] === input[0]"), true);
});

test('public friend cards shuffle while pending reviews retain their order and stay private', async () => {
  const { run } = await setup();
  run(`state.friends = ['a','b','c','d'].map(id => ({id,name:id,url:'https://example.com/'+id,description:'hello',status:'published'})).concat([
    {id:'pending-one',name:'pending one',url:'https://pending.example',description:'private',status:'pending'},
    {id:'pending-two',name:'pending two',url:'https://pending2.example',description:'private',status:'pending'}
  ]); Math.random = () => 0;`);
  const before = run('JSON.stringify(state.friends)');
  const html = run('friendsPage()');
  assert.deepEqual([...html.matchAll(/class="friend-card" id="friend-([^"]+)"/g)].map(x => x[1]), ['b','c','d','a']);
  assert.doesNotMatch(html, /pending-one|pending-two/);
  assert.equal(run('JSON.stringify(state.friends)'), before);
  const managed = run('state.admin = true; friendsPage()');
  assert.ok(managed.indexOf('id="friend-pending-one"') < managed.indexOf('id="friend-pending-two"'));
  assert.equal(run('JSON.stringify(state.friends)'), before);
});

test('the supplied exchange profile copies exactly and remains selectable without clipboard support', async () => {
  const expected = '- name: 个人记事簿\n  link: https://blog.example.test/\n  avatar: https://blog.example.test/assets/avatar.svg\n  descr: 记录生活与学习';
  const enabled = await setup();
  assert.equal(enabled.run('ownFriendYaml()'), expected);
  const html = enabled.run('friendsPage()');
  assert.match(html, /https:\/\/blog\.example\.test\/assets\/avatar\.svg/);
  assert.doesNotMatch(html, /staging.invalid/);
  const event = { target: { closest: () => ({ dataset: { action: 'copy-friend-profile' } }) } };
  await enabled.handlers.click(event);
  assert.deepEqual(enabled.copied, [expected]);
  const unavailable = await setup(false);
  await unavailable.handlers.click(event);
  assert.equal(unavailable.selected(), true);
});
