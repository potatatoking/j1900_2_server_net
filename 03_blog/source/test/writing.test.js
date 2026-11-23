import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('draft privacy, conflict handling, safe documents, visitor rich replies and restart persistence', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'blog-writing-'));
  await fs.copyFile(new URL('../server.js',import.meta.url),path.join(dir,'server.js'));
  await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  await fs.mkdir(path.join(dir,'public'));
  const probe=net.createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  let child;
  async function stop(){if(child && child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
  async function start(){child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:String(port),BLOG_ADMIN_PASSWORD:'writing-test-only'},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/api/session')).ok)return;}catch{}await new Promise(r=>setTimeout(r,30));}throw new Error('Server did not start');}
  t.after(async()=>{await stop();await fs.rm(dir,{recursive:true,force:true});});
  await start();
  const call=async(route,method='GET',body,cookie)=>{const res=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};};
  let login=await call('/api/login','POST',{password:'writing-test-only'}),cookie=login.cookie.split(';')[0];
  const draft={type:'article',title:'Private writing',content:'',tag:'essay',document:[{type:'h2',children:[{type:'text',text:'Heading'}]},{type:'p',children:[{type:'text',text:'正文与 emoji 🥔'},{type:'strong',children:[{type:'text',text:'Bold'}]}]}]};
  assert.equal((await call('/api/drafts')).status,401);
  assert.equal((await call('/api/drafts/test','PUT',draft)).status,401);
  let saved=await call('/api/drafts/test','PUT',draft,cookie);assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
  assert.ok(saved.body.content.includes('正文与 emoji 🥔'));
  assert.equal((await call('/api/posts')).body.some(p=>p.title===draft.title),false);
  assert.equal((await call('/api/drafts/test','PUT',draft,cookie)).status,409);
  assert.equal((await call('/api/drafts/test/publish','POST',{revision:0},cookie)).status,409);
  assert.equal((await call('/api/drafts/unsafe','PUT',{...draft,document:[{type:'script',children:[]}]},cookie)).status,400);
  assert.equal((await call('/api/drafts/unsafe','PUT',{...draft,sourceUrl:'javascript:alert(1)'},cookie)).status,400);
  assert.equal((await call('/api/drafts/unsafe','PUT',{...draft,document:[{type:'a',href:'javascript:alert(1)',children:[]}]},cookie)).status,400);
  assert.equal((await call('/api/drafts/unsafe','PUT',{...draft,document:[{type:'img',src:'https://evil.example/x.png'}]},cookie)).status,400);
  const upload=await call('/api/documents','POST',{name:'visitor.txt',data:Buffer.from('Document text').toString('base64')});
  assert.equal(upload.status,201);
  const docId=upload.body.id;
  assert.equal((await fetch(base+'/api/documents/'+docId)).status,404);
  assert.equal((await fetch(base+'/api/documents/'+docId,{headers:{Cookie:cookie}})).status,200);
  assert.equal((await call('/api/documents/metadata')).body.some(d=>d.id===docId),false);
  assert.equal((await call('/api/documents','POST',{name:'bad.html',data:Buffer.from('<script>').toString('base64')})).status,400);
  assert.equal((await call('/api/documents','POST',{name:'bad.pdf',data:Buffer.from('<html>').toString('base64')})).status,400);
  const image=await call('/api/writing/images','POST',{image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6b8AAAAASUVORK5CYII='});
  assert.equal(image.status,201);
  saved=await call('/api/drafts/test','PUT',{...draft,revision:1,attachments:[docId],sourceUrl:'https://example.com/article',document:[...draft.document,{type:'img',src:image.body.url,alt:'inline'}]},cookie);
  assert.equal(saved.status,200);
  const published=await call('/api/drafts/test/publish','POST',{revision:2},cookie);
  assert.equal(published.status,200);const post=published.body;
  assert.equal(post.document.at(-1).src,image.body.url);
  assert.equal((await call('/api/drafts','GET',undefined,cookie)).body.length,0);
  const download=await fetch(base+'/api/documents/'+docId);assert.equal(download.status,200);assert.equal(await download.text(),'Document text');assert.match(download.headers.get('content-disposition'),/^attachment/);
  saved=await call('/api/drafts/edit','PUT',{...draft,postId:post.id,title:'Unpublished change'},cookie);
  assert.equal((await call('/api/posts')).body.find(p=>p.id===post.id).title,draft.title);
  const edited=await call('/api/drafts/edit/publish','POST',{revision:saved.body.revision},cookie);
  assert.equal(edited.body.createdAt,post.createdAt);assert.equal(edited.body.title,'Unpublished change');
  const topic=await call('/api/topics','POST',{author:'Visitor',title:'Rich topic',content:'Hello',document:[{type:'p',children:[{type:'text',text:'Hello'}]},{type:'img',src:image.body.url}],attachments:[docId],sourceUrl:'https://example.com'});
  assert.equal(topic.status,201);assert.equal(topic.body.document[1].type,'img');
  const reply=await call(`/api/topics/${topic.body.id}/replies`,'POST',{author:'Visitor',content:'',document:[{type:'img',src:image.body.url}],attachments:[docId]});
  assert.equal(reply.status,201);assert.equal(reply.body.attachments[0],docId);
  await call('/api/drafts/persist','PUT',{type:'life',title:'',content:'Unfinished'},cookie);
  const scopes = {
    learning: {type:'study', section:'learning'},
    work: {type:'study', section:'work'},
    article: {type:'article'},
    update: {type:'update'},
  };
  for (const [scope, fields] of Object.entries(scopes)) {
    assert.equal((await call(`/api/drafts/${scope}?scope=${scope}`,'PUT',{...fields,content:scope},cookie)).status,200);
  }
  for (const [scope, id] of [['life','persist'], ...Object.keys(scopes).map(scope => [scope,scope])]) {
    const list = await call(`/api/drafts?scope=${scope}`,'GET',undefined,cookie);
    assert.deepEqual(list.body.map(d => d.id), [id]);
  }
  assert.equal((await call('/api/drafts?scope=other','GET',undefined,cookie)).status,400);
  assert.equal((await call('/api/drafts/work?scope=learning','DELETE',undefined,cookie)).status,404);
  assert.equal((await call('/api/drafts/work/publish?scope=learning','POST',{revision:1},cookie)).status,404);
  assert.equal((await call('/api/drafts/work?scope=work','PUT',{...scopes.learning,revision:1},cookie)).status,400);
  assert.equal((await call('/api/drafts/misplaced?scope=learning','PUT',scopes.work,cookie)).status,400);

  await stop();await start();
  login=await call('/api/login','POST',{password:'writing-test-only'});cookie=login.cookie.split(';')[0];
  assert.equal((await call('/api/drafts','GET',undefined,cookie)).body.find(d=>d.id==='persist').content,'Unfinished');
  assert.equal((await call('/api/topics')).body.find(d=>d.id===topic.body.id).replies[0].document[0].type,'img');
  assert.equal((await fetch(base+'/api/documents/'+docId)).status,200);
});


test('record dates validate, survive drafts and restart, and preserve creation timestamps', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'blog-writing-'));
  await fs.copyFile(new URL('../server.js',import.meta.url),path.join(dir,'server.js'));
  await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  await fs.mkdir(path.join(dir,'public'));
  const probe=net.createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  let child;
  async function stop(){if(child && child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
  async function start(){child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:String(port),BLOG_ADMIN_PASSWORD:'writing-test-only'},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/api/session')).ok)return;}catch{}await new Promise(r=>setTimeout(r,30));}throw new Error('Server did not start');}
  t.after(async()=>{await stop();await fs.rm(dir,{recursive:true,force:true});});
  await start();
  const call=async(route,method='GET',body,cookie)=>{const res=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};};
  let login=await call('/api/login','POST',{password:'writing-test-only'}),cookie=login.cookie.split(';')[0];
  const dated={type:'life',title:'补写闰日',content:'当天内容',date:'2024-02-29'};
  assert.equal((await call('/api/drafts/dated','PUT',dated)).status,401);
  for (const value of ['2023-02-29','2024-02-30','2024-04-31','2024-13-01','0000-01-01','2024-2-9','',null,42]) {
    const invalid=await call('/api/drafts/invalid-date','PUT',{...dated,date:value},cookie);
    assert.equal(invalid.status,400,`Invalid date ${value}`);
  }
  let saved=await call('/api/drafts/dated','PUT',dated,cookie);
  assert.equal(saved.body.date,'2024-02-29');
  saved=await call('/api/drafts/dated','PUT',{type:'life',title:dated.title,content:'继续写',revision:saved.body.revision},cookie);
  assert.equal(saved.body.date,'2024-02-29');
  const backdated=await call('/api/drafts/dated/publish','POST',{revision:saved.body.revision},cookie);
  assert.equal(backdated.status,200); assert.equal(backdated.body.date,'2024-02-29');
  assert.ok(Math.abs(Date.now()-Date.parse(backdated.body.createdAt))<10000);
  const move={...dated,postId:backdated.body.id,date:'2024-03-01'};
  saved=await call('/api/drafts/dated-edit','PUT',move,cookie);
  const moved=await call('/api/drafts/dated-edit/publish','POST',{revision:saved.body.revision},cookie);
  assert.equal(moved.body.date,'2024-03-01'); assert.equal(moved.body.createdAt,backdated.body.createdAt);
  const legacyEdit=await call('/api/posts/'+backdated.body.id,'PUT',{type:'life',title:'旧客户端修改',content:'保留日期'},cookie);
  assert.equal(legacyEdit.body.date,'2024-03-01'); assert.equal(legacyEdit.body.createdAt,backdated.body.createdAt);
  assert.equal((await call('/api/posts/'+backdated.body.id,'PUT',{...dated,date:'2023-02-29'},cookie)).status,400);
  const direct=await call('/api/posts','POST',{...dated,date:'2024-01-31'},cookie);
  assert.equal(direct.status,201); assert.equal(direct.body.date,'2024-01-31');
  await call('/api/drafts/persist-date','PUT',{...dated,date:'2024-12-31'},cookie);

  await stop();await start();
  login=await call('/api/login','POST',{password:'writing-test-only'});cookie=login.cookie.split(';')[0];
  assert.equal((await call('/api/drafts','GET',undefined,cookie)).body.find(d=>d.id==='persist-date').date,'2024-12-31');
  assert.equal((await call('/api/posts')).body.find(p=>p.id===backdated.body.id).date,'2024-03-01');
});
