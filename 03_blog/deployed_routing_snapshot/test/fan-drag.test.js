import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = (await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/\nload\(\);\s*$/, '');
function harness(reduced = false) {
  const handlers = {}, frames = new Map(), timers = new Map(), commits = [];
  let next = 1;
  const knob = { style: {}, setAttribute() {} };
  const panel = { classList: {add(){},remove(){}}, getBoundingClientRect: () => ({top:0,right:300}), setPointerCapture(){}, querySelectorAll: () => [], querySelector: () => knob };
  const preview = {hidden:true,innerHTML:''};
  const root = {addEventListener(type,fn){(handlers[type]??=[]).push(fn)}};
  const fallback = {addEventListener(){}};
  const context = vm.createContext({
    document:{querySelector:s=>s==='#fan-navigation'?root:s==='#fan-panel'?panel:s==='#fan-panel .fan-knob'?knob:s==='#fan-preview'?preview:fallback,addEventListener(){},body:{classList:{add(){},remove(){}}}},
    window:{addEventListener(){},matchMedia:()=>({matches:reduced})},location:{protocol:'file:',pathname:'/',hash:'#life'},URLSearchParams,
    requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{const id=next++;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),commits
  });
  vm.runInContext(source,context);
  const run = code => vm.runInContext(code,context);
  run("fanOpen=true;fanSelection=3;selectFanPage(3,false);navigateFanSelection=()=>{commits.push(fanPages[fanSelection].id)}");
  const target={closest:s=>s==='#fan-panel'?panel:s==='.fan-knob'?knob:null};
  const event=(angle,extra={})=>({target,pointerId:1,button:0,clientX:300-Math.cos(angle*Math.PI/180)*264,clientY:Math.sin(angle*Math.PI/180)*264,preventDefault(){},...extra});
  const dispatch=(type,angle,extra)=>{for(const fn of handlers[type]||[])fn(event(angle,extra))};
  return {run,knob,commits,dispatch};
}
test('fan drag previews the nearest existing page and keeps the charm on its page position',()=>{
  const h=harness();h.dispatch('pointerdown',44);h.dispatch('pointermove',49);
  assert.equal(h.run('fanSelection'),3);
  h.dispatch('pointermove',50.5);assert.equal(h.run('fanSelection'),4);
  const expected=h.run('fanPoint(56,264)');
  assert.ok(Math.abs(parseFloat(h.knob.style.left)-expected.x/3)<.001);
  assert.ok(Math.abs(parseFloat(h.knob.style.top)-expected.y/3)<.001);
  assert.equal(h.commits.length,0);
});
test('releasing a moved fan enters the selected page immediately; taps and cancelled drags do not',()=>{
  const h=harness();h.dispatch('pointerdown',44);h.dispatch('pointermove',53);h.dispatch('pointerup',53);
  assert.deepEqual(h.commits,['articles']);
  const tap=harness();tap.dispatch('pointerdown',44);tap.dispatch('pointermove',44.1);tap.dispatch('pointerup',44.1);assert.deepEqual(tap.commits,[]);
  const cancelled=harness();cancelled.dispatch('pointerdown',44);cancelled.dispatch('pointermove',65);cancelled.dispatch('pointercancel',65);cancelled.dispatch('pointerup',65);assert.deepEqual(cancelled.commits,[]);
});
test('restored fan retains all seven pages, keyboard endpoints and reduced-motion navigation',()=>{
  const h=harness(true);assert.equal(h.run('fanPages.length'),7);
  h.dispatch('keydown',44,{key:'Home'});assert.equal(h.run('fanSelection'),0);
  h.dispatch('keydown',44,{key:'End'});assert.equal(h.run('fanSelection'),6);
  h.dispatch('keydown',44,{key:'Enter'});assert.deepEqual(h.commits,['talk']);
});
