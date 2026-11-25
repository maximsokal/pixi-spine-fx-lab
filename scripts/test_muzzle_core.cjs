'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/muzzle-flash/src/muzzle-core.js');
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b);
test('default settings roundtrip and compiled snapshot is immutable',()=>{
 const d=M.defaults(),p=M.compile(d);
 assert.deepEqual(M.deserialize(M.serialize(d)),d);
 d.layers.core.x=50;assert.equal(p.settings.layers.core.x,0);
 assert.ok(Object.isFrozen(p.settings.layers.core));assert.ok(Object.isFrozen(p.meta.events));
});
test('default ignition, five spaced tongues and eight spark births',()=>{
 const p=M.compile(M.defaults());
 assert.equal(p.meta.events.length,8);close(p.meta.events[0].time,0);close(p.meta.events.at(-1).time,2/60);
 const ds=p.meta.tongueDistances;assert.equal(ds.length,5);
 ds.slice(1).forEach((d,i)=>close(d-ds[i],7));
 const frame=p.sample(0);assert.equal(frame.core.length,1);assert.equal(frame.tongues.length,5);assert.equal(frame.sparks.length,1);
});
test('flash duration changes actual visibility and 40-frame tail is empty',()=>{
 const d=M.defaults();const a=M.compile(d);d.flashDuration=12;const b=M.compile(d);
 assert.equal(a.sample(6/60).core.length,0);assert.equal(b.sample(6/60).core.length,1);
 assert.deepEqual(b.sample(39/60),{core:[],tongues:[],sparks:[]});
});
test('temporal edits do not change spatial placement',()=>{
 const d=M.defaults(),a=M.compile(d);d.rateCurveEnabled=true;d.curves.emissionRate.keys[0].y=.5;
 d.curves.emissionRate.keys[1].y=1.5;const b=M.compile(d);
 assert.deepEqual(a.meta.tongueDistances,b.meta.tongueDistances);
 assert.notDeepEqual(a.meta.events,b.meta.events);
});
test('spatial edits do not change event times',()=>{
 const d=M.defaults(),a=M.compile(d);d.tongueGap=3;d.spatialMode='random';const b=M.compile(d);
 assert.deepEqual(a.meta.events,b.meta.events);assert.notDeepEqual(a.meta.tongueDistances,b.meta.tongueDistances);
});
test('min interval includes ignition; zero spark count is empty',()=>{
 const d=M.defaults();d.minInterval=.02;const a=M.compile(d);
 a.meta.events.slice(1).forEach((e,i)=>assert.ok(e.time-a.meta.events[i].time>=.02-1e-12));
 d.sparkCount=0;assert.equal(M.compile(d).sample(0).sparks.length,0);
});
test('layer isolation, independent seeds, delay and anchor rotation',()=>{
 const d=M.defaults(),a=M.compile(d);d.layers.tongues.enabled=false;d.layers.core.delayFrames=2;
 const b=M.compile(d);assert.equal(b.sample(0).core.length,0);assert.equal(b.sample(0).tongues.length,0);
 assert.deepEqual(a.sample(.02).sparks,b.sample(.02).sparks);
 d.layers.core.x=10;const p=M.compile(d).sample(2/60,{x:10,y:20,rotation:90}).core[0].vertices;
 close((p[0].x+p[1].x)/2,10);close((p[0].y+p[1].y)/2,30);
});
test('particle speed is integrated, not multiplied by terminal speed',()=>{
 const d=M.defaults();d.sparkCount=1;d.sparkLifeFrames=6;const a=M.compile(d);
 const f=a.sample(.05).sparks[0],dist=Math.hypot(f.x-256,f.y-256);
 d.curves.sparkSpeed.keys[1].y=1;const g=M.compile(d).sample(.05).sparks[0];
 close(dist/Math.hypot(g.x-256,g.y-256),.775,1e-6);
});
test('palette alpha and all-disabled produce no geometry',()=>{
 const d=M.defaults();d.palette.stops.forEach(s=>s.rgba[3]=0);
 d.sparkPalette.stops.forEach(s=>s.rgba[3]=0);
 assert.deepEqual(M.compile(d).sample(0),{core:[],tongues:[],sparks:[]});
 for(const k of M.LAYERS)d.layers[k].enabled=false;
 assert.deepEqual(M.compile(d).sample(.02),{core:[],tongues:[],sparks:[]});
});
test('deterministic seek and bounded spatial fallback',()=>{
 const d=M.defaults();d.flashLength=8;d.coneAngle=5;d.tongueGap=30;
 const p=M.compile(d);assert.equal(p.meta.tongueDistances.length,1);assert.ok(p.meta.spatialLimited);
 const a=p.sample(.04);p.sample(0);assert.deepEqual(p.sample(.04),a);
});
test('strict validation rejects unknown fields and curve/domain/range corruption',()=>{
 const bad=[d=>d.extra=1,d=>d.flashLength=NaN,d=>d.flashDuration=1.5,d=>d.minGap=31,
  d=>d.curves.flashAlpha.domain='particleAge',d=>d.curves.sparkSpeed.valueRange=[0,100],
  d=>delete d.curves.flashWidth.keys[1],d=>delete d.palette.stops[0].rgba[1],
  d=>d.layers.sparks.seed=2.5,d=>d.schemaVersion=2];
 for(const edit of bad){const d=M.defaults();edit(d);assert.throws(()=>M.normalize(d));}
});
test('curve control changes geometry, alpha and real color',()=>{
 const d=M.defaults(),a=M.compile(d).sample(0);
 d.curves.flashWidth.keys[0].y=.2;d.curves.flashAlpha.keys[0].y=.5;
 d.palette.stops[0].rgba=[12,34,56,1];const b=M.compile(d).sample(0);
 assert.notDeepEqual(a.core[0].vertices,b.core[0].vertices);
 assert.deepEqual(b.core[0].rgba,[12,34,56,.5]);
});
