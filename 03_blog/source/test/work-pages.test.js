import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function setup() {
  const handlers = {};
  const node = { innerHTML: '', open: false, addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {}, showModal() { this.open = true; }, classList: { add() {}, remove() {} } };
  const context = vm.createContext({ document: { querySelector: () => node, getElementById: () => node, addEventListener(type, callback) { (handlers[type] ??= []).push(callback); } }, location: { protocol: 'file:', pathname: '/', hash: '#work' }, window: { addEventListener() {} }, URL, URLSearchParams, setTimeout: () => 0, clearTimeout() {}, FormData: class { constructor(form) { this.values = form.values; } entries() { return Object.entries(this.values); } } });
  for (const file of ['quotes.js', 'projects.js', 'app.js']) vm.runInContext((await fs.readFile(new URL(`../public/${file}`, import.meta.url), 'utf8')).replace(/\nload\(\);\s*$/, ''), context);
  const run = code => vm.runInContext(code, context);
  run(`Object.assign(state, previewData);state.posts=[
    {id:'learn',type:'study',section:'learning',title:'学习独有词',content:'学习正文',createdAt:'2025-01-01T00:00:00Z'},
    {id:'job',type:'study',section:'work',title:'工作独有词',content:'工作正文',createdAt:'2025-01-01T00:00:00Z'},
    {id:'legacy',type:'study',tag:'工作记录',title:'历史工作',content:'旧记录',createdAt:'2025-01-01T00:00:00Z'}
  ];renderActivityPanel=source=>'<div data-source="'+source+'"></div>';`);
  return { context, run, node, handlers };
}
test('learning and work pages isolate activities, archives, reading and project search', async () => {
  const { run, context } = await setup();
  context.location.hash = '#study';
  const study = run('studyPage()');
  assert.match(study, /data-source="luogu"/); assert.doesNotMatch(study, /data-source="github"|class="work-projects"|id="study-work"/);
  assert.match(study, /id="reading-plan"|id="reading-library"/);
  assert.match(run("searchResults('学习独有词')"), /找到 1 条/);
  assert.match(run("searchResults('工作独有词')"), /找到 0 条/);
  context.location.hash = '#work';
  const work = run('workPage()');
  assert.match(work, /data-source="github"/); assert.match(work, /class="work-projects"/);
  assert.doesNotMatch(work, /data-source="luogu"|id="reading-plan"|id="study-learning"/);
  assert.match(run("searchResults('工作独有词')"), /找到 1 条/);
  assert.match(run("searchResults('学习独有词')"), /找到 0 条/);
  run(`state.activity={luogu:{solved:[{pid:'P1914',title:'凯撒密码',date:'2026-10-19'}]},github:{daily:[{date:'2026-10-19',total:2,public:0,private:2}]}}`);
  assert.match(run("searchResults('GitHub')"), /#work\?item=commit-2026-10-19/);
  assert.match(run("searchResults('凯撒密码')"), /找到 0 条/);
  context.location.hash = '#study';
  assert.match(run("searchResults('凯撒密码')"), /#study\?item=solved-P1914/);
  assert.match(work, /data-section="work"/);
});
test('legacy work hashes, direct paths and post links resolve to their proper independent page', async () => {
  const { run, context } = await setup();
  for (const hash of ['#study?item=study-work', '#study?item=post-job', '#study?item=post-legacy']) { context.location.hash = hash; assert.equal(run('route()'), 'work'); }
  context.location.hash = '#work?item=post-learn'; assert.equal(run('route()'), 'study');
  context.location.hash = ''; context.location.pathname = '/work'; assert.equal(run('route()'), 'work');
  context.location.pathname = '/study'; assert.equal(run('route()'), 'study');
  assert.equal(run("postPage(state.posts.find(p=>p.id==='job'))"), 'work');
  assert.equal(run("fanPages.find(p=>p.id==='work').title"), '工作');
});
test('project bubbles group by status, escape titles, expose admin actions only after login and appear in work search', async () => {
  const { run, node } = await setup();
  run(`state.projects=[{id:'one',title:'<script>bad</script>',description:'气泡简介',status:'active',url:'https://example.com'},{id:'two',title:'已经完成',description:'完成简介',status:'completed',url:''}]`);
  const active = run("projectGroup('active')"), complete = run("projectGroup('completed')");
  assert.match(active, /&lt;script&gt;bad&lt;\/script&gt;/); assert.doesNotMatch(active, /<script>|已经完成/);
  assert.match(complete, /已经完成/); assert.doesNotMatch(complete, /气泡简介/);
  assert.doesNotMatch(run('renderProjects()'), /data-action="new-project"/);
  run("projectModal('one')"); assert.doesNotMatch(node.innerHTML, /data-action="edit-project"|data-action="toggle-project"/);
  run("state.admin=true;projectModal('one')"); assert.match(node.innerHTML, /标记为已完成/);
  run("projectModal('two')"); assert.match(node.innerHTML, /移回进行中/);
  assert.match(run("searchResults('气泡简介')"), /#work\?item=project-one/);
  run('state.projects=[]'); assert.match(run('renderProjects()'), /新的想法正在酝酿中/);
  assert.doesNotMatch(run('renderProjects()'), /class="project-bubble /);
});
test('moving a post from work to learning saves its classification and opens the learning page', async () => {
  const { context, run, handlers } = await setup();
  context.location.hash = '#work?item=post-job';
  context.calls = [];
  run(`state.admin=true;request=async (url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {...state.posts.find(p=>p.id==='job'),...JSON.parse(options.body)}};requestModalClose=async()=>{};render=()=>{};toast=()=>{}`);
  const button = { disabled: false, textContent: '保存修改' };
  const form = { id: 'post-form', dataset: { id: 'job' }, values: { type: 'study', section: 'learning', title: '转入学习的记录', content: '正文', tag: '' }, matches: () => false, querySelector: selector => selector === 'button[type="submit"]' ? button : null, querySelectorAll: () => [] };
  for (const callback of handlers.submit) await callback({ target: form, preventDefault() {} });
  assert.equal(context.calls[0].url, '/api/posts/job');
  assert.equal(context.calls[0].body.section, 'learning');
  assert.equal(context.location.hash, 'study?item=post-job');
  assert.equal(run("state.posts.find(p=>p.id==='job').section"), 'learning');
});
