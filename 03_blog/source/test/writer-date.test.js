import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

async function setup(drafts, stored = {}) {
  const calls = [], window = {addEventListener(){}}, storage = {...stored};
  Object.defineProperties(storage, {
    getItem: {value:key => storage[key] ?? null},
    setItem: {value:(key,value) => {storage[key]=value;}},
    removeItem: {value:key => {delete storage[key];}}
  });
  const context = vm.createContext({window,localStorage:storage,crypto:webcrypto,
    document:{querySelectorAll:()=>[]},MutationObserver:class {observe(){}},
    fetch:async route => {
      if (route === '/api/documents/metadata') return {ok:true,json:async()=>[]};
      calls.push(route);return {ok:true,json:async()=>drafts};
    }
  });
  vm.runInContext(await fs.readFile(new URL('../public/writer.js',import.meta.url),'utf8'),context);
  let html = '';
  // Stop after rendering the real opening flow; the rich editor is exercised in browser QA.
  const modal = {openModal(value){html=value;throw new Error('rendered');}};
  return {window,calls,html:()=>html,modal};
}

test('opening a backfill day resumes its latest saved new draft and keeps dates isolated', async () => {
  const drafts = [
    {id:'edit',postId:'published',date:'2024-02-29',title:'已有文章的草稿'},
    {id:'other',date:'2024-03-01',title:'另一天'},
    {id:'match',date:'2024-02-29',title:'当天尚未发布',content:'草稿内容'},
    {id:'older',date:'2024-02-29',title:'较早的草稿'}
  ];
  const app = await setup(drafts);
  await assert.rejects(app.window.BlogWriter.open({type:'life',date:'2024-02-29'},app.modal),/rendered/);
  assert.deepEqual(app.calls,['/api/drafts?scope=life']);
  assert.match(app.html(),/value="当天尚未发布"/);
  assert.match(app.html(),/name="date"[^>]*value="2024-02-29"/);
  assert.doesNotMatch(app.html(),/已有文章的草稿|另一天|较早的草稿/);
});

test('resuming legacy edit drafts keeps the original date-only publication day', async () => {
  const app=await setup([]);
  const draft={id:'legacy',postId:'original',type:'life',title:'继续写',content:'正文'};
  await assert.rejects(app.window.BlogWriter.open({type:'life',draft},{...app.modal,getPost:()=>({id:'original',createdAt:'2024-02-29'})}),/rendered/);
  assert.match(app.html(),/name="date"[^>]*value="2024-02-29"/);
});

test('draft lists show their record dates for choosing among days', async () => {
  const app=await setup([{id:'one',date:'2024-02-29',title:'草稿',content:'正文',updatedAt:'2026-11-23T00:00:00Z'}]);
  let html='';
  await app.window.BlogWriter.drafts({type:'life'},{openModal:value=>{html=value;},toast:assert.fail});
  assert.match(html,/记录日期：2024-02-29/);
});
