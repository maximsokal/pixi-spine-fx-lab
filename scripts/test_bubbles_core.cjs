#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const B=require('../assets/rising-bubbles/src/bubbles-core.js');
const clone=o=>JSON.parse(JSON.stringify(o));
const near=(a,b,tol=1e-5)=>A.ok(Math.abs(a-b)<=tol, a+' != '+b);
const c=B.defaults();
A.equal(B.VERSION,1);
A.deepEqual(B.LAYERS,['bubbles','highlights','popRings']);
for(const [key,v] of Object.entries({rate:16,radius:8,buoyancy:90,wobble:12,lifetime:1.8,
 highlightStrength:.6,originGap:22,originSpan:320,spatialJitter:.25})) A.equal(c[key],v);
A.equal(c.durationFrames,60);A.equal(c.mode,'loop');
A.deepEqual(B.normalize(c),c);
const e=c.emitters[0],schedule=B.schedule(c,e);
A.equal(schedule.events.length,16);
A.ok(schedule.origins.length>=2);
for(let i=1;i<schedule.origins.length;i++)
 A.ok(schedule.origins[i].distance-schedule.origins[i-1].distance>=c.originGap-1e-6);
A.ok(schedule.arcErrorBound<=.25);
const a=B.sample(c,0),m=B.sample(c,.5),z=B.sample(c,59/60),seam=B.sample(c,1);
A.deepEqual(a,seam,'60-frame loop resets/loses previous-period flight');
A.ok(a.emitters[0].layers.bubbles.length>0,'pre-roll must show bubbles at t=0');
A.ok(m.emitters[0].layers.bubbles.length>0);
A.ok(z.emitters[0].layers.bubbles.length>0);
A.notDeepEqual(a.emitters[0].layers.bubbles,m.emitters[0].layers.bubbles,'motion frozen');
A.deepEqual(B.sample(c,.35),B.sample(c,1.35),'periodic state');
A.deepEqual(B.sample(c,.3),B.sample(c,.3),'determinism');
A.deepEqual(B.sample(c,.123),B.sample(c,.123),'random seek');
A.ok(a.counters.historyCycles>=2,'past 1-second events missing');
const straight=clone(c);straight.wobble=0;
const sb=B.sample(straight,.45).emitters[0].layers.bubbles;
A.ok(sb.length>0);
for(const bubble of sb){
 const origin=B.schedule(straight,straight.emitters[0]).origins[bubble.originIndex];
 near(bubble.x,origin.x);near(bubble.y,origin.y-.5*straight.buoyancy*bubble.age*bubble.age);
}
const noLift=clone(straight);noLift.buoyancy=0;
for(const bubble of B.sample(noLift,.45).emitters[0].layers.bubbles){
 const origin=B.schedule(noLift,noLift.emitters[0]).origins[bubble.originIndex];
 near(bubble.y,origin.y);
}
const noRate=clone(c);noRate.rate=0;
A.equal(B.schedule(noRate,noRate.emitters[0]).events.length,0);
A.ok(Object.values(B.sample(noRate,.32).emitters[0].layers).every(items=>items.length===0));
const noHighlights=clone(c);noHighlights.highlightStrength=0;
A.equal(B.sample(noHighlights,.5).emitters[0].layers.highlights.length,0);
A.ok(B.sample(noHighlights,.5).emitters[0].layers.bubbles.length>0);
const noWobble=clone(c);noWobble.wobble=0;
A.notDeepEqual(B.sample(noWobble,.5),m);
const changedRadius=clone(c);changedRadius.radius=14;
A.notDeepEqual(B.sample(changedRadius,.5),m);
for(const [key,v] of [['buoyancy',220],['lifetime',2.7],['radiusVariation',.35],
 ['originGap',26],['originSpan',280],['nozzleBend',24],['spatialJitter',0],['seed',1029],['style','magical'],
 ['temporalMode','clustered'],['spatialMode','clustered']]){
 const settings=clone(c);settings[key]=v;
 A.notDeepEqual(B.sample(settings,.5),m,key+' needs real effect');
}
for(const field of ['sizeCurve','lateralDriftCurve','alphaCurve','emissionRateCurve','originGapCurve']){
 const settings=clone(c);settings[field].keys[1].y+=.2;
 A.notDeepEqual(B.sample(settings,.5),m,field+' must change numeric effect');
}
const noBubbles=clone(c);noBubbles.emitters[0].layers.bubbles.enabled=false;
A.equal(B.sample(noBubbles,.35).emitters[0].layers.bubbles.length,0);
A.ok(B.sample(noBubbles,.35).emitters[0].layers.highlights.length>0);
const allOff=clone(c);for(const layer of Object.values(allOff.emitters[0].layers))layer.enabled=false;
A.ok(Object.values(B.sample(allOff,.35).emitters[0].layers).every(items=>items.length===0));
const multi=clone(c);multi.emitters.push(B.newEmitter(1));
A.equal(B.sample(multi,.35).emitters.length,2);
A.deepEqual(B.sample(multi,.35).emitters[0],B.sample(c,.35).emitters[0]);
multi.emitters.reverse();
A.deepEqual(B.sample(multi,.35).emitters.find(x=>x.id===e.id),B.sample(c,.35).emitters[0]);
const shutdown=clone(c);shutdown.mode='shutdown';shutdown.durationFrames=40;shutdown.exportFrames=40;
A.ok(B.sample(shutdown,0).emitters[0].layers.bubbles.length>0);
A.ok(B.sample(shutdown,38/60).emitters[0].layers.bubbles.length>0);
A.ok(Object.values(B.sample(shutdown,39/60).emitters[0].layers).every(items=>items.length===0));
const high=clone(c);high.rate=90;high.lifetime=8;high.quality='low';
A.throws(()=>B.normalize(high),/budget|quality/i);
const crop=clone(c);crop.emitters[0].anchor.x=495;
A.equal(B.bounds(B.sample(crop,.25),crop).inside,false);
A.equal(B.bounds(m,c).inside,true);
A.throws(()=>B.normalize({...c,schemaVersion:2}),/schema|version/i);
A.throws(()=>B.normalize({...c,extra:1}),/unknown/i);
A.throws(()=>B.normalize({...c,radius:NaN}),/invalid/i);
A.throws(()=>B.normalize({...c,rate:91}),/invalid/i);
A.throws(()=>B.normalize({...c,emitters:[e,e]}),/duplicate/i);
A.throws(()=>B.normalize({...c,emitters:[e,B.newEmitter(1),B.newEmitter(2),
 B.newEmitter(3),B.newEmitter(4)]}),/4/i);
A.throws(()=>B.normalize({...c,originSpan:10,originGap:100}),/span|gap|space/i);
console.log('PASS WATER-05 core: 60f periodic pre-roll and 40f shutdown, quadratic ascent, wobble0, genuine rate/arc gap, five curves, 3 independent layers, 4 isolated emitters, budgets and schema');