#!/usr/bin/env node
'use strict';
// FIRE-03: pure numeric trajectory/trail/emission/curves/limits regression.
const assert=require('node:assert/strict');
const P=require('../assets/fireball-projectile/src/projectile-core.js');
const S=require('../assets/template/src/spacing-core.js');
const approx=(a,b,e=.25)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b+' ±'+e);
const stable=o=>JSON.stringify(o,(key,val)=>Number.isNaN(val)?'NaN':val);
const d=P.defaults();
assert.equal(P.VERSION,1);assert.deepEqual(P.LAYERS,['core','ribbon','sparks','embers','haze']);
assert.equal(d.durationFrames,120);assert.equal(d.exportFrames,120);assert.equal(d.loop,false);
assert.equal(d.speed,200);assert.equal(d.trailRate,25);assert.equal(d.trailSpacing,6);
assert.equal(d.tailTaperCurve.domain,'pathPosition');assert.equal(d.corePulseCurve.domain,'effectTime');
assert.deepEqual(P.normalize(structuredClone(d)),d);
const table=S.buildArcTable(d.trajectory);
assert.ok(table.length>320&&table.length<500,'real curved path length');
for(const sec of [0,.1,.3,.5,1,1.6]){
 const snap=P.sample(d,sec);
 approx(snap.head.distance,Math.min(sec*d.speed,table.length));
 assert.ok(P.bounds(snap,d.anchor).inside,'default clip at '+sec);
 assert.deepEqual(snap,P.sample(d,sec),'absolute-time deterministic sample '+sec);
 assert.ok(snap.primitives<=P.BUDGETS.balanced.maxPrimitives);
}
assert.ok(P.sample(d,0).layers.core.length>=1,'visible spawn at t=0');
assert.ok(P.sample(d,.5).layers.ribbon.length===1,'ribbon missing during curved flight');
assert.ok(P.sample(d,119/60).primitives>0,'terminal fade must have residual particles');
assert.equal(P.sample(d,120/60).primitives,0,'one-shot finish must be transparent');
assert.equal(P.sample(d,130/60).primitives,0,'no one-shot ghost after endpoint');
assert.deepEqual(P.sample({...d,loop:true},0),P.sample({...d,loop:true},2),'explicit replay seam');
assert.notDeepEqual(P.sample(d,0),P.sample(d,2),'no implicit looping');
assert.ok(P.sample(d,96/60).impact?.type==='fireball-impact-ready');
const blocked={...d,speed:0};
assert.equal(P.sample(blocked,.7).head.distance,0);
assert.equal(P.sample(blocked,.7).events.trail.length,0,'stationary distance must emit none');
assert.equal(P.sample({...blocked,emissionMode:'both'},.7).events.trail.length,0);
assert.ok(P.sample({...blocked,emissionMode:'time'},.7).events.trail.length>0,
 'time-mode stationary emitter explicit independent policy');
const arcEvents=P.sample(d,.5).events.trail;
assert.ok(arcEvents.length>35&&arcEvents.length<100);
for(let i=1;i<arcEvents.length;i++){
 assert.ok(arcEvents[i].time>arcEvents[i-1].time);
 approx(arcEvents[i].distance-arcEvents[i-1].distance,d.trailSpacing,.255);
 const pt=S.pointAtDistance(table,arcEvents[i].distance);
 approx(Math.hypot(pt.x-arcEvents[i].x,pt.y-arcEvents[i].y),0,.25);
 approx(arcEvents[i].time,arcEvents[i].distance/d.speed,1e-8);
}
const much=P.sample({...d,trailSpacing:12},.5).events.trail;
assert.ok(much.length<arcEvents.length,'distance spacing changes actual count');
assert.notDeepEqual(much.map(e=>e.distance),arcEvents.map(e=>e.distance));
const random=P.sample({...d,spatialMode:'random'},.5).events.trail;
assert.notDeepEqual(random.map(e=>e.distance),arcEvents.map(e=>e.distance));
const curvedSpacing=structuredClone(d);curvedSpacing.spacingCurveEnabled=true;
assert.notDeepEqual(P.sample(curvedSpacing,.5).events.trail.map(e=>e.distance),
 arcEvents.map(e=>e.distance),'pathPosition spacing curve must change real distance');
const timed=P.sample({...d,emissionMode:'time'},.5).events.trail;
assert.ok(timed.length>0);
assert.notDeepEqual(timed.map(e=>e.time),arcEvents.map(e=>e.time),
 'time and distance represent genuinely different scheduling domains');
const rate=P.sample({...d,emissionMode:'time',trailRate:40},.5).events.trail;
assert.ok(rate.length>timed.length,'temporal rate changes birth count');
const rejitter=P.sample({...d,emissionMode:'time',trailJitter:.42},.5).events.trail;
assert.notDeepEqual(rejitter.map(e=>e.time),timed.map(e=>e.time),'jitter changes actual timestamps');
const together=P.sample({...d,emissionMode:'both'},.5).events.trail;
assert.ok(together.length>0&&together.length<=timed.length,
 'both must gate, not duplicate temporal events');
assert.deepEqual(together,P.sample({...d,emissionMode:'both'},.5).events.trail);
const noSparks=P.sample({...d,sparkCount:0},.5);
assert.deepEqual(noSparks.layers.sparks,[]);
assert.equal(noSparks.events.sparks.length,0);
const moreSparks=P.sample({...d,sparkRate:24},.5);
assert.ok(moreSparks.events.sparks.length>P.sample(d,.5).events.sparks.length);
const movedSeed=P.sample({...d,seed:d.seed+1},.5);
assert.notDeepEqual(movedSeed.layers.sparks,P.sample(d,.5).layers.sparks);
const straight=structuredClone(d);
const p0=straight.trajectory.segments[0].p0,e=straight.trajectory.segments[1].p3;
const at=t=>[p0[0]+(e[0]-p0[0])*t,p0[1]+(e[1]-p0[1])*t];
straight.trajectory.segments=[
 {p0:at(0),p1:at(1/6),p2:at(2/6),p3:at(.5)},
 {p0:at(.5),p1:at(4/6),p2:at(5/6),p3:at(1)}];
assert.notDeepEqual(P.sample(straight,.7).layers.ribbon,P.sample(d,.7).layers.ribbon,
 'curved vs straight silhouette must differ');
const lag0=P.sample({...d,turnLag:0},.9);
const lag1=P.sample({...d,turnLag:1},.9);
assert.notDeepEqual(lag0.layers.ribbon,lag1.layers.ribbon,
 'turn-lag must actually change the geometry on a curve');
const unlocked=P.sample({...d,unlockTail:true},.7);
assert.notDeepEqual(unlocked.layers.ribbon,P.sample(d,.7).layers.ribbon);
const adjusted=P.sample({...d,unlockTail:true,tailX:-120,tailY:40},.7);
assert.notDeepEqual(adjusted.layers.ribbon,unlocked.layers.ribbon);
assert.deepEqual(adjusted.head,unlocked.head,'unlocked tail must not move projectile head');
const shift=P.sample({...d,layers:{...d.layers,ribbon:{...d.layers.ribbon,x:23,y:-10}}},.6);
assert.notDeepEqual(shift.layers.ribbon,P.sample(d,.6).layers.ribbon);
for(const key of P.LAYERS){
 const a=P.sample(d,key==='haze'?.4:key==='core'?0:.6);
 const off=structuredClone(d);off.layers[key].enabled=false;
 const b=P.sample(off,key==='haze'?.4:key==='core'?0:.6);
 assert.deepEqual(b.layers[key],[],'layer not disabled '+key);
 for(const other of P.LAYERS)if(other!==key)
  assert.deepEqual(b.layers[other],a.layers[other],'sibling altered by '+key);
}
const empty=structuredClone(d);
for(const key of P.LAYERS)empty.layers[key].enabled=false;
assert.equal(P.sample(empty,.6).primitives,0,'all disabled ghost geometry');
const haze=structuredClone(d);haze.heatHaze=true;haze.layers.haze.enabled=true;
assert.ok(P.sample(haze,.4).layers.haze.length===3,'stylized shimmer should be an actual visual');
const magical=P.sample({...d,style:'magical'},.4);
assert.notDeepEqual(magical.layers.core,P.sample(d,.4).layers.core);
const arrow=structuredClone(d);arrow.corePulseCurve.keys[1].y=1.8;
assert.notDeepEqual(P.sample(arrow,1).layers.core,P.sample(d,1).layers.core);
const width=structuredClone(d);width.tailTaperCurve.keys[1].y=.2;
assert.notDeepEqual(P.sample(width,.5).layers.ribbon,P.sample(d,.5).layers.ribbon);
const alpha=structuredClone(d);alpha.trailAlphaCurve.keys[1].y=.2;
assert.notDeepEqual(P.sample(alpha,.5).layers.embers,P.sample(d,.5).layers.embers);
const rateCurve=structuredClone(d);rateCurve.emissionMode='time';rateCurve.emissionRateCurve.keys[1].y=2;
assert.notDeepEqual(P.sample(rateCurve,.6).events.trail.map(e=>e.time),
 P.sample({...d,emissionMode:'time'},.6).events.trail.map(e=>e.time));
const extreme={...d,coreRadius:120,tailLength:240,tailWidth:120,
 trajectory:{...d.trajectory,segments:d.trajectory.segments.map(s=>
 Object.fromEntries(Object.entries(s).map(([k,v])=>[k,[v[0]*2.7,v[1]*2.7]])))}};
const o=P.sample(extreme,.6);
assert.equal(P.bounds(o,d.anchor).inside,false,'clipped trajectory must be caught');
for(const bad of [
 {...d,schemaVersion:4},{...d,speed:NaN},{...d,tailLength:-1},
 {...d,exportFrames:3601},{...d,fadeStartFrame:130},
 {...d,trajectory:{...d.trajectory,closed:true}},
 {...d,trajectory:{...d.trajectory,segments:[d.trajectory.segments[0]]}},
 {...d,missing:1},{...d,seed:2147483648}
])assert.throws(()=>P.normalize(bad),/invalid|unknown|phase|path/i);
console.log('PASS FIRE-03 core: true arc speed, ribbon lag, unlocked tail, exact time/distance/both, seeded seek, independent layers, bounds/phase/curve policy');
