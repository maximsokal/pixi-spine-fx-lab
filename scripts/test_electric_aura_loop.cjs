'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const H=require('../assets/electric-aura/src/aura-core.js'),U=require('../assets/electric-aura/src/aura-authoring.js');
for(const frames of [20,24,40,59,61,120])test('exact authored frame parity with delayed layers, period '+frames,()=>{
 const c=H.defaults();c.durationFrames=frames;
 c.emitters[0].layers.halo.delayFrames=17;c.emitters[0].layers.arcs.delayFrames=29;c.emitters[0].layers.sparks.delayFrames=120;
 const p=H.compile(c);
 for(let i=0;i<frames;i++){
  const expected=p.sample(i/60);
  for(const cycle of [1,3,100])A.deepEqual(p.sample((i+cycle*frames)/60),expected);
  A.deepEqual(p.sample(i/60+0.5e-9),expected);
 }
 A.equal(U.advance((frames-1)/60,1/60,p.meta,true),0);
 A.equal(U.advance(0,frames*3/60,p.meta,true),0);
});
test('fractional preview seeks remain continuous outside frame snap tolerance',()=>{
 const c=H.defaults();c.durationFrames=40;const p=H.compile(c),t=.1234567;
 A.ok(Math.abs(U.advance(0,t,p.meta,true)-t)<1e-15);
 A.notDeepEqual(p.sample(t),p.sample(7/60));
 A.equal(U.advance(40/60-0.5e-9,0,p.meta,true),0);
 A.ok(U.advance(40/60-1e-7,0,p.meta,true)>.66);
});
test('one-shot transport still clamps to last authored sample',()=>{
 const c=H.defaults();c.mode='oneShot';c.durationFrames=40;const p=H.compile(c);
 A.equal(U.advance(0,2,p.meta,false),39/60);
 A.deepEqual(p.sample(39/60),p.sample(2));
});
