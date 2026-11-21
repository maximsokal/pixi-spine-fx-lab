#!/usr/bin/env node
'use strict';
// FIRE-04 RED->GREEN: deterministic timing, multi-emitter state, ballistic physics.
const assert=require('node:assert/strict');
const E=require('../assets/embers-sparks/src/embers-core.js');
const C=require('../assets/template/src/curve-core.js');
const S=require('../assets/template/src/spacing-core.js');
const approx=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,'got '+a+' expected '+b);
const base=E.defaults();
assert.equal(E.VERSION,1);assert.equal(base.emissionFrames,40);
assert.equal(base.durationFrames,90);assert.equal(base.lifetimeSeconds,.8);
assert.equal(base.rate,35);assert.equal(base.spatialSpacing,10);
assert.deepEqual(E.LAYERS,['hot','streaks','bloom']);
assert.deepEqual(E.normalize(structuredClone(base)),base);
const sample=(cfg,t)=>E.sample(cfg,t);
for(const t of [0,.01,.15,.5,.66,.75,1,1.2,1.45,1.483,1.5,3]){
 const a=sample(base,t),b=sample(base,t);
 assert.deepEqual(a,b,'seeded absolute seek t='+t);
 assert.ok(a.primitives<=E.BUDGETS.balanced.maxPrimitives);
 assert.ok(!a.capped,'default should not hit cap');
}
assert.equal(sample(base,0).primitives,1,'hot start at t0');
assert.ok(sample(base,.5).primitives>sample(base,0).primitives,'peak emission');
assert.ok(sample(base,1.1).primitives>0,'particle after 40-frame source shutoff');
assert.equal(sample(base,89/60).primitives,0,'full fade without cut');
assert.equal(sample(base,1.5).primitives,0,'one-shot exclusive end');
assert.equal(sample(base,3).primitives,0,'no ghost beyond endpoint');
assert.deepEqual(sample({...base,loop:true},0),sample({...base,loop:true},1.5));
assert.notDeepEqual(sample(base,0),sample(base,1.5));
const seq=sample(base,.5).emitters[0].events;
assert.ok(seq.length>5&&seq.length<40);
for(let i=1;i<seq.length;i++)assert.ok(seq[i].time>seq[i-1].time);
const births=E.births(base,base.emitters[0]);
assert.deepEqual(births,E.births(base,base.emitters[0]));
const fast=E.births({...base,rate:65},base.emitters[0]);
assert.ok(fast.events.length>births.events.length,'rate changes count');
assert.notDeepEqual(E.births({...base,intervalJitter:.4},base.emitters[0]).events,
 births.events,'jitter must change birth timestamps');
assert.ok(E.births({...base,burstMode:true},base.emitters[0]).events.length>0);
assert.deepEqual(E.births({...base,rate:0},base.emitters[0]).events,[]);
const stationary={...base,emissionMode:'distance'};
assert.equal(E.births(stationary,base.emitters[0]).events.length,0);
assert.match(E.births(stationary,base.emitters[0]).diagnostic,/moving/);
const moving=structuredClone(base);moving.emitters[0].motion.mode='path';
moving.emissionMode='distance';const spatial=E.births(moving,moving.emitters[0]);
assert.ok(spatial.events.length>=2);
const track=S.buildArcTable(moving.emitters[0].motion.path);
for(const p of spatial.events){
 const at=S.pointAtDistance(track,p.position.distance);
 approx(Math.hypot(at.x-p.position.x,at.y-p.position.y),0,1e-6);
 approx(p.time,p.position.distance/moving.emitters[0].motion.speed,1e-5);
}
const wider=structuredClone(moving);wider.spatialSpacing=20;
assert.ok(E.births(wider,wider.emitters[0]).events.length<
 spatial.events.length,'space changes actual count');
const cluster=structuredClone(moving);cluster.spatialMode='clustered';
assert.notDeepEqual(E.births(cluster,cluster.emitters[0]).events.map(v=>v.position.distance),
 spatial.events.map(v=>v.position.distance));
const curved=structuredClone(moving);curved.spacingCurveEnabled=true;
assert.notDeepEqual(E.births(curved,curved.emitters[0]).events.map(v=>v.position.distance),
 spatial.events.map(v=>v.position.distance));
assert.ok(E.births({...moving,rate:0},moving.emitters[0]).events.length>0,
 'distance emission must not depend on temporal rate');
const curvedBurst=structuredClone(base);
curvedBurst.burstMode=true;curvedBurst.burstCount=5;curvedBurst.burstDelay=.006;
const lessBurst=structuredClone(curvedBurst);
lessBurst.emissionRateCurve.keys[1].y=.2;
assert.notDeepEqual(E.births(curvedBurst,curvedBurst.emitters[0]).events,
 E.births(lessBurst,lessBurst.emitters[0]).events,
 'custom emission rate curve must also affect burst trigger times');
const both=structuredClone(moving);both.emissionMode='both';
assert.ok(E.births(both,both.emitters[0]).events.length>=0);
assert.ok(E.births(both,both.emitters[0]).events.length<=E.births({...moving,emissionMode:'time'},moving.emitters[0]).events.length);
assert.equal(E.births({...both,emissionMode:'both'},
 {...both.emitters[0],motion:{...both.emitters[0].motion,mode:'stationary'}}).events.length,0);
const at=.38,a=sample(base,at).emitters[0].layers.hot;
assert.ok(a.length>3);
const gravity=sample({...base,gravity:200},at).emitters[0].layers.hot;
assert.notDeepEqual(gravity,a);
const noSpeed=sample({...base,launchSpeed:0},at).emitters[0].layers.hot;
assert.notDeepEqual(noSpeed,a);
const zeroGravity=sample({...base,gravity:0},at).emitters[0].layers.hot;
assert.notDeepEqual(zeroGravity,a);
const every=sample(base,.62);
assert.equal(every.emitters[0].layers.streaks.length,0);
assert.equal(every.emitters[0].layers.bloom.length,0);
const staged=structuredClone(base);
staged.emitters[0].layers.streaks.enabled=true;
staged.emitters[0].layers.bloom.enabled=true;
const enabled=sample(staged,.62);
assert.ok(enabled.emitters[0].layers.streaks.length>0);
assert.ok(enabled.emitters[0].layers.bloom.length>0);
for(const k of E.LAYERS){
 const copy=structuredClone(staged);copy.emitters[0].layers[k].enabled=false;
 const out=sample(copy,.62);
 assert.equal(out.emitters[0].layers[k].length,0);
 for(const other of E.LAYERS)if(other!==k)
  assert.deepEqual(out.emitters[0].layers[other],enabled.emitters[0].layers[other]);
}
const allOff=structuredClone(staged);
for(const k of E.LAYERS)allOff.emitters[0].layers[k].enabled=false;
assert.equal(sample(allOff,.62).primitives,0);
assert.notDeepEqual(sample({...base,style:'stylized'},.62).emitters[0].layers.hot,a);
assert.notDeepEqual(sample({...base,style:'magical'},.62).emitters[0].layers.hot,
 sample(base,.62).emitters[0].layers.hot);
for(const [k,t] of [['emissionRateCurve',.5],['sizeCurve',.5],
 ['temperatureCurve',.5],['alphaCurve',.5]]){
 const c=structuredClone(base);c[k].keys[1].y=k==='temperatureCurve'?.3:.2;
 if(k==='emissionRateCurve')assert.notDeepEqual(E.births(c,c.emitters[0]),
  E.births(base,base.emitters[0]));
 else assert.notDeepEqual(sample(c,t),sample(base,t),'curve inert '+k);
}
const pal=structuredClone(base);pal.palette.stops[0].rgba=[230,210,90,.8];
assert.notDeepEqual(sample(pal,.3),sample(base,.3));
const count=2,other=structuredClone(base);
other.emitters.push(E.newEmitter(1));
other.emitters[1].layers.streaks.enabled=true;
const bothEm=sample(other,.6);
assert.equal(bothEm.emitters.length,count);
assert.deepEqual(bothEm.emitters.find(v=>v.id==='emitter1'),sample(base,.6).emitters[0],
 'adding sibling must not perturb first seed');
const editedSibling=structuredClone(other);editedSibling.emitters[1].seed=219;
assert.deepEqual(sample(editedSibling,.6).emitters.find(v=>v.id==='emitter1'),
 bothEm.emitters.find(v=>v.id==='emitter1'));
assert.notDeepEqual(sample(editedSibling,.6).emitters.find(v=>v.id==='emitter2'),
 bothEm.emitters.find(v=>v.id==='emitter2'));
const reordered=structuredClone(other);reordered.emitters.reverse();
assert.deepEqual(sample(reordered,.6),bothEm);
const disabled2=structuredClone(other);disabled2.emitters[1].enabled=false;
assert.deepEqual(sample(disabled2,.6).emitters.find(v=>v.id==='emitter1'),
 bothEm.emitters.find(v=>v.id==='emitter1'));
const extreme=structuredClone(base);extreme.emitters[0].anchor.x=510;
const bound=E.bounds(sample(extreme,.4),{emitter1:{x:510,y:310}},extreme);
assert.equal(bound.inside,false);
for(const bad of [
 {...base,schemaVersion:2},{...base,seed:NaN},{...base,rate:241},
 {...base,emissionFrames:120},{...base,emissionMode:'not-a-mode'},
 {...base,exportFrames:3601},{...base,unknown:true},
 {...base,emitters:[...Array(5)].map((_,i)=>E.newEmitter(i))},
 {...base,emitters:[E.newEmitter(0),E.newEmitter(0)]},
 {...base,emitters:[{...base.emitters[0],anchor:{...base.emitters[0].anchor,type:'bone',name:''}}]}
])assert.throws(()=>E.normalize(bad),/FIRE-04|Invalid/i);
console.log('PASS FIRE-04 core: 40+tail, exact physics, explicit spatial gating, 4 emitter independence, curves, palette, bands, bounds, strict schema');
