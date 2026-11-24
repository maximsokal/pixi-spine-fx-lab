'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Snow=require('../assets/snowfall/src/snow-core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,String(a)+' != '+String(b));
const flat=(c,y)=>{c.defaultValue=y;for(const k of c.keys)k.y=y;};
const layer=(f,id='emitter1',kind='near')=>f.emitters.find(e=>e.id===id).layers.find(l=>l.id===kind);
const eventTimes=p=>p.events.map(e=>e.time);
test('canonical defaults match the Blueprint and round-trip',()=>{
 const c=Snow.defaults();assert.equal(c.schemaVersion,1);assert.equal(c.flakesPerSecond,22);
 assert.equal(c.durationFrames,60);assert.equal(c.horizontalGapPx,24);
 assert.deepEqual(Object.keys(c.emitters[0].layers),['near','far','windSwirls']);
 assert.equal(c.emitters[0].layers.windSwirls.enabled,false);
 assert.deepEqual(Snow.normalize(JSON.parse(JSON.stringify(c))),Snow.normalize(c));
});
test('22 shared half-open births; event IDs, layer shares and times are stable',()=>{
 const c=Snow.defaults(),s=Snow.schedule(c,'emitter1');
 assert.equal(s.events.length,22);assert.equal(new Set(s.events.map(e=>e.id)).size,22);
 assert.ok(s.events.every((e,i)=>e.time>=0&&e.time<1&&(!i||e.time>s.events[i-1].time)));
 assert.equal(s.events.filter(e=>e.layer==='near').length,8);
 assert.equal(s.events.filter(e=>e.layer==='far').length,14);
});
test('physical horizontal spacing changes positions without changing times or count',()=>{
 const c=Snow.defaults();c.spatialJitter=0;
 const a=Snow.schedule(c,'emitter1');c.horizontalGapPx=12;
 const b=Snow.schedule(c,'emitter1');assert.deepEqual(eventTimes(a),eventTimes(b));
 assert.ok(a.launchDistances.length<b.launchDistances.length);
 close(a.launchDistances[1]-a.launchDistances[0],24);
 close(b.launchDistances[1]-b.launchDistances[0],12);
 assert.ok(a.arcErrorBound<=.25&&b.arcErrorBound<=.25);
 assert.notDeepEqual(a.events.map(e=>e.x),b.events.map(e=>e.x));
});
test('emission rate curve changes actual event times without changing spatial spacing',()=>{
 const c=Snow.defaults(),a=Snow.schedule(c,'emitter1');flat(c.emissionRateCurve,2);
 const b=Snow.schedule(c,'emitter1');assert.equal(b.events.length,44);
 assert.deepEqual(a.launchDistances,b.launchDistances);assert.notDeepEqual(eventTimes(a),eventTimes(b));
});
test('horizontal curve actually changes spacing, including cubic handles',()=>{
 const c=Snow.defaults();c.spatialJitter=0;const a=Snow.schedule(c,'emitter1');
 const curve=c.horizontalSpacingCurve;flat(curve,1);
 curve.keys[0].mode='bezier';curve.keys[0].out=[.25,2.5];curve.keys[1].in=[.75,2.5];
 const b=Snow.schedule(c,'emitter1');assert.deepEqual(eventTimes(a),eventTimes(b));
 assert.notDeepEqual(a.launchDistances,b.launchDistances);
});
test('a narrow field with a wider requested gap still emits at its center',()=>{
 const c=Snow.defaults();Object.assign(c,{fieldWidth:64,horizontalGapPx:100,spatialJitter:0});
 const p=Snow.schedule(c,'emitter1');assert.equal(p.events.length,22);assert.ok(p.events.every(e=>e.x===0));
});
test('seed changes only spatial/shape streams; zero and fractional rates are bounded',()=>{
 const c=Snow.defaults(),a=Snow.schedule(c,'emitter1');c.seed++;
 const b=Snow.schedule(c,'emitter1');assert.deepEqual(eventTimes(a),eventTimes(b));
 assert.notDeepEqual(a.launchDistances,b.launchDistances);
 c.flakesPerSecond=0;assert.equal(Snow.schedule(c,'emitter1').events.length,0);
 c.flakesPerSecond=.5;assert.equal(Snow.schedule(c,'emitter1').events.length,0);
});
test('compiled full snowfield is deterministic across seeks, offsets and exact seams',()=>{
 const c=Snow.defaults();c.emitters[0].timeOffset=13;c.emitters[0].layers.near.timeOffset=-7;
 const p=Snow.createPlan(c),start=p.sample(0);assert.ok(start.cost>0);
 p.sample(.73);assert.deepEqual(p.sample(0),start);assert.deepEqual(p.sample(1),start);
 c.durationFrames=601;const long=Snow.createPlan(c);
 assert.deepEqual(long.sample(601/60),long.sample(0));
});
test('layer visibility and seed preserve sibling particles and the shared event stream',()=>{
 const c=Snow.defaults(),a=Snow.createPlan(c).sample(.5);
 c.emitters[0].layers.near.enabled=false;const b=Snow.createPlan(c).sample(.5);
 assert.equal(layer(b).particles.length,0);assert.deepEqual(layer(b,'emitter1','far'),layer(a,'emitter1','far'));
 c.emitters[0].layers.near.enabled=true;c.emitters[0].layers.near.seed++;
 const d=Snow.createPlan(c).sample(.5);assert.notDeepEqual(layer(a).particles,layer(d).particles);
 assert.deepEqual(layer(a,'emitter1','far'),layer(d,'emitter1','far'));
});
test('independent emitter and layer offsets preserve local particle paths and anchor metadata',()=>{
 const c=Snow.defaults();c.emitters.push(Snow.newEmitter(1));
 const a=Snow.createPlan(c).sample(.25);
 Object.assign(c.emitters[0].layers.near,{x:19,y:-4});
 c.emitters[0].layers.near.anchor={type:'bone',space:'local',name:'head',slot:'',x:0,y:0,rotation:0};
 const b=Snow.createPlan(c).sample(.25);
 assert.deepEqual(layer(a).particles,layer(b).particles);assert.equal(layer(b).transform.x,19);
 assert.equal(layer(b).anchor.name,'head');assert.deepEqual(layer(a,'emitter2'),layer(b,'emitter2'));
 assert.deepEqual(layer(a,'emitter1','far'),layer(b,'emitter1','far'));
 c.emitters.reverse();const d=Snow.createPlan(c).sample(.25);
 assert.deepEqual(layer(d,'emitter2'),layer(b,'emitter2'));assert.deepEqual(layer(d),layer(b));
});
test('optional wind swirls add independent bounded particles and leave snowfall unchanged',()=>{
 const c=Snow.defaults(),a=Snow.createPlan(c).sample(.5);
 assert.equal(layer(a,'emitter1','windSwirls').particles.length,0);
 c.emitters[0].layers.windSwirls.enabled=true;const p=Snow.createPlan(c),b=p.sample(.5);
 assert.ok(layer(b,'emitter1','windSwirls').particles.length>0);
 assert.deepEqual(layer(a),layer(b));assert.deepEqual(layer(a,'emitter1','far'),layer(b,'emitter1','far'));
 assert.deepEqual(p.sample(0),p.sample(1));
});
test('40-frame one-shot starts populated, fades and stays transparent after last frame',()=>{
 const c=Snow.defaults();c.mode='oneShot';c.durationFrames=40;const p=Snow.createPlan(c);
 assert.ok(p.sample(0).cost>0);assert.equal(p.sample(39/60).cost,0);
 assert.equal(p.sample(4).cost,0);
});
test('full-effect budget and event cap reject impossible configurations before sampling',()=>{
 const c=Snow.defaults();Object.assign(c,{flakesPerSecond:120,fallSpeed:5,quality:'high'});
 for(let i=1;i<4;i++)c.emitters.push(Snow.newEmitter(i));
 assert.throws(()=>Snow.createPlan(c),/budget/);
 const d=Snow.defaults();d.durationFrames=960;d.flakesPerSecond=120;flat(d.emissionRateCurve,3);
 assert.throws(()=>Snow.createPlan(d),/event.*cap/);
});
test('strict version, duplicate IDs, anchor names, mode and finite controls are validated',()=>{
 for(const bad of [c=>c.schemaVersion=2,c=>c.extra=1,c=>c.fallSpeed=NaN,
  c=>c.emitters.push(c.emitters[0]),c=>c.emitters[0].layers.near.anchor.type='bone',
  c=>c.durationFrames=80,c=>c.emitters[0].layers.far.alpha=2]){
  const c=Snow.defaults();bad(c);assert.throws(()=>Snow.normalize(c),/AIR-02/);
 }
});
test('compiled settings are detached from edits and bounds reflect visible particles',()=>{
 const c=Snow.defaults(),p=Snow.createPlan(c),f=p.sample(.2);c.emitters[0].layers.near.enabled=false;
 assert.deepEqual(p.sample(.2),f);const b=Snow.bounds(f);
 assert.ok(b.width>0&&b.height>0);const z=Snow.defaults();z.flakesPerSecond=0;
 assert.equal(Snow.bounds(Snow.createPlan(z).sample(0)),null);
});
