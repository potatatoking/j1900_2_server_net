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
  run("fanOpen=true;fanSelection=3;setFanAngle(44);navigateFanSelection=()=>{commits.push(fanPages[fanSelection].id)}");
  const target={closest:s=>s==='#fan-panel'?panel:s==='.fan-knob'?knob:null};
  const event=(angle,extra={})=>({target,pointerId:1,button:0,clientX:300-Math.cos(angle*Math.PI/180)*264,clientY:Math.sin(angle*Math.PI/180)*264,preventDefault(){},...extra});
  const dispatch=(type,angle,extra)=>{for(const fn of handlers[type]||[])fn(event(angle,extra))};
  const frame=now=>{const queue=[...frames.values()];frames.clear();for(const fn of queue)fn(now)};
  return {run,knob,frames,timers,commits,dispatch,frame};
}
test('drag follows intermediate angles continuously, batches frames and resists midpoint jitter',()=>{
  const h=harness();h.dispatch('pointerdown',44);h.dispatch('pointermove',48);h.dispatch('pointermove',49);
  assert.equal(h.frames.size,1);h.frame(0);
  assert.ok(Math.abs(h.run('fanAngle')-49)<.001);
  assert.equal(h.run('fanSelection'),3);
  h.dispatch('pointermove',50.5);h.frame(16);assert.equal(h.run('fanSelection'),3);
  h.dispatch('pointermove',52);h.frame(32);assert.equal(h.run('fanSelection'),4);
  h.dispatch('pointermove',50);h.frame(48);assert.equal(h.run('fanSelection'),4);
  assert.equal(h.commits.length,0);
  assert.equal(h.timers.size,1,'only the latest preview may wait');
  h.dispatch('pointermove',100);h.frame(64);assert.equal(h.run('fanAngle'),80);
});
test('release smoothly snaps before navigating once and suppresses its synthetic click',()=>{
  const h=harness();h.dispatch('pointerdown',44);h.dispatch('pointermove',53);h.frame(0);h.dispatch('pointerup',53);
  assert.equal(h.commits.length,0);assert.ok(h.run('fanAngle')<56);
  h.frame(10);h.frame(95);assert.ok(h.run('fanAngle')>53&&h.run('fanAngle')<56);
  h.frame(200);assert.equal(h.run('fanAngle'),56);assert.deepEqual(h.commits,['articles']);
  h.dispatch('click',56);assert.deepEqual(h.commits,['articles']);
});
test('pointer cancellation restores the selection and reduced motion releases immediately',()=>{
  const h=harness();h.dispatch('pointerdown',44);h.dispatch('pointermove',65);h.frame(0);h.dispatch('pointercancel',65);h.frame(0);h.frame(200);
  assert.equal(h.run('fanSelection'),3);assert.equal(h.run('fanAngle'),44);assert.deepEqual(h.commits,[]);assert.equal(h.timers.size,0);
  const r=harness(true);r.dispatch('pointerdown',44);r.dispatch('pointermove',53);r.frame(0);r.dispatch('pointerup',53);
  assert.equal(r.run('fanAngle'),56);assert.deepEqual(r.commits,['articles']);assert.equal(r.frames.size,0);
});
