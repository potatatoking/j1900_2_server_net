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
test('project lists group by status, escape titles, expose admin actions only after login and appear in work search', async () => {
  const { run, node } = await setup();
  run(`state.projects=[{id:'one',title:'<script>bad</script>',description:'气泡简介',status:'active',url:'https://example.com'},{id:'two',title:'已经完成',description:'完成简介',status:'completed',url:''}]`);
  const active = run("projectGroup('active')"), complete = run("projectGroup('completed')");
  assert.match(active, /&lt;script&gt;bad&lt;\/script&gt;/); assert.doesNotMatch(active, /<script>|已经完成|project-bubble|project-cloud|float-delay/); assert.match(active, /class="project-list"/); assert.match(active, /class="project-row"/);
  assert.match(complete, /已经完成/); assert.doesNotMatch(complete, /气泡简介/);
  assert.doesNotMatch(run('renderProjects()'), /data-action="new-project"/);
  run("projectModal('one')"); assert.doesNotMatch(node.innerHTML, /data-action="edit-project"|data-action="toggle-project"/);
  run("state.admin=true;projectModal('one')"); assert.match(node.innerHTML, /标记为已完成/);
  run("projectModal('two')"); assert.match(node.innerHTML, /移回进行中/);
  assert.match(run("searchResults('气泡简介')"), /#work\?item=project-one/);
  run("projectEditor({id:'one',title:'项目',description:'长简介'.repeat(1000),status:'active'})");
  assert.doesNotMatch(node.innerHTML, /name="description" maxlength=/);
  assert.ok(node.innerHTML.includes('长简介'.repeat(1000)));
  run('state.projects=[]'); assert.match(run('renderProjects()'), /还没有添加进行中的项目。/);
  assert.doesNotMatch(run('renderProjects()'), /class="project-row"/);
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

test('personal articles have independent list, readable detail, escaped content and scoped search', async () => {
  const { run, context } = await setup();
  run(`state.posts.push({id:'essay',type:'article',title:'想法独有词<script>',content:'第一段\\n\\n第二段 <img src=x>',tag:'随笔',createdAt:'2026-10-19T00:00:00Z'})`);
  context.location.hash = '#articles';
  const list = run('articlesPage()');
  assert.match(list, /想法独有词&lt;script&gt;/);
  assert.match(list, /阅读全文/);
  assert.doesNotMatch(list, /学习独有词|工作独有词|data-action="new-post"/);
  assert.match(run("searchResults('想法独有词')"), /#articles\?item=post-essay/);
  assert.match(run("searchResults('学习独有词')"), /找到 0 条/);
  context.location.hash = '#articles?item=post-essay';
  const detail = run('articlesPage()');
  assert.match(detail, /class="article-body">第一段\n\n第二段 &lt;img src=x&gt;/);
  assert.doesNotMatch(detail, /<script>|<img src=x>/);
  run('state.admin=true');
  assert.match(run('articlesPage()'), /编辑文章|删除文章/);
  context.location.hash = '#articles?item=post-missing';
  assert.match(run('articlesPage()'), /暂时找不到/);
  context.location.hash = '#work';
  assert.match(run("searchResults('想法独有词')"), /找到 0 条/);
  context.location.hash = '#home';
  assert.match(run("searchResults('想法独有词')"), /个人文章/);
});

test('article direct paths, home entry, fan navigation and editor expose the correct destinations', async () => {
  const { run, context, node } = await setup();
  context.location.hash = ''; context.location.pathname = '/articles';
  assert.equal(run('route()'), 'articles');
  assert.match(run('home()'), /class="article-directory-link" href="#articles"/);
  assert.equal(run("fanPages.filter(p=>p.id==='articles').length"), 1);
  assert.equal(run('fanPages.length'), 7);
  run("state.admin=true; window.BlogWriter={open(options){ globalThis.openedWriter=options; }};postModal('article')");
  assert.equal(run('openedWriter.type'), 'article');
  assert.doesNotMatch(node.innerHTML, /id="post-section"/);
});

test('work footer opens a separate newest-first changelog without mixing updates into work records', async () => {
  const { run, node, context } = await setup();
  run(`state.posts.push({id:'old-update',type:'update',title:'历史功能',content:'原来的内容',tag:'功能',createdAt:'2026-10-18T17:05:00Z'},{id:'new-update',type:'update',title:'修复<script>',content:'正文 <img src=x>\\n保留换行',tag:'debug',createdAt:'2026-10-22T02:00:00Z'});openModal=html=>{modalContent.innerHTML=html};`);
  const work = run('workPage()');
  assert.match(work, /class="work-updates-footer"><button[^>]*data-action="show-updates"[^>]*>更新日志<\/button><hr><\/footer><\/div>$/);
  assert.doesNotMatch(work, /历史功能|修复&lt;script&gt;/);
  assert.match(work, /工作独有词|往日归档/);
  assert.equal(run("postPage(state.posts.find(p=>p.id==='new-update'))"), 'work');
  assert.match(run("searchResults('历史功能')"), /更新日志|#work\?item=post-old-update/);
  run('blogUpdatesModal()');
  assert.ok(node.innerHTML.indexOf('post-new-update') < node.innerHTML.indexOf('post-old-update'));
  assert.match(node.innerHTML, /修复&lt;script&gt;|正文 &lt;img src=x&gt;/);
  assert.doesNotMatch(node.innerHTML, /<script>|<img src=x>|data-action="edit-post"|data-action="new-post"/);
  run('state.admin=true;blogUpdatesModal()');
  assert.match(node.innerHTML, /data-type="update"|data-action="edit-post"|data-action="delete-post"/);
  run("window.BlogWriter={open(options){globalThis.openedWriter=options;}};postModal('update',state.posts.find(p=>p.id==='old-update'))");
  assert.equal(run('openedWriter.type'), 'update'); assert.equal(run('openedWriter.post.id'), 'old-update');
  context.location.hash='#study?item=post-old-update';assert.equal(run('route()'),'work');
});
