#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const W=require('../assets/wind-gust/src/wind-core.js');
const near=(x,y,e=.001)=>A.ok(Math.abs(x-y)<=e,String(x)+' != '+String(y));
const base=W.defaults(),e=base.emitters[0];
A.equal(base.mode,'burst');A.equal(base.durationFrames,40);
A.equal(base.windSpeed,160);A.equal(base.gustWidth,120);A.equal(base.streakCount,12);
A.equal(base.curveAmount,.3);A.equal(base.streakThickness,3);A.equal(base.windDirection,0);
A.equal(base.birthRate,20);A.equal(base.streakGap,14);
A.deepEqual(W.LAYERS,['streaks','dust']);
A.equal(W.normalize(base).schemaVersion,1);
const plan=W.schedule(base,e);
A.equal(plan.events.length,13,'40f at 20/sec must yield 13 events');
A.ok(plan.distances.length>1);
A.ok(plan.arcErrorBound<=.25);
A.ok(plan.events.every((p,i)=>Number.isFinite(p.time)&&p.time>0&&p.time<=40/60));
const first=W.sample(base,0),mid=W.sample(base,20/60),last=W.sample(base,39/60);
A.equal(first.primitives,0,'burst f0 clear');
A.ok(mid.primitives>0,'burst at mid visible');
A.equal(last.primitives,0,'f39 fully transparent');
A.ok(mid.emitters[0].layers.streaks.length>0);
A.ok(mid.emitters[0].layers.streaks.length<=12);
for(const ribbon of mid.emitters[0].layers.streaks){
 A.ok(ribbon.positions.length>6);A.ok(ribbon.indices.length>=6);
 A.ok(ribbon.errorBound<=.25);near(ribbon.tipWidths[0],0,1e-6);near(ribbon.tipWidths[1],0,1e-6);
 A.ok(ribbon.positions.every(Number.isFinite));
}
const loop=structuredClone(base);loop.mode='loop';loop.durationFrames=60;loop.exportFrames=60;
A.deepEqual(W.sample(loop,0),W.sample(loop,1),'exact periodic numeric state');
A.ok(W.sample(loop,.5).primitives>0);
const gap=structuredClone(base);gap.streakGap=30;
A.notDeepEqual(W.schedule(gap,gap.emitters[0]).distances,plan.distances,'spacing control changes actual arclength');
const jitterOff=structuredClone(base);jitterOff.spatialJitter=0;
A.notDeepEqual(W.schedule(jitterOff,jitterOff.emitters[0]).distances,plan.distances,
 'spatialJitter must move actual arc positions even when spatialMode=even');
const rate=structuredClone(base);rate.birthRate=35;
A.notDeepEqual(W.schedule(rate,rate.emitters[0]).events.map(x=>x.time),
plan.events.map(x=>x.time),'birthRate changes actual event timestamps');
const rateCurve=structuredClone(base);rateCurve.emissionRateCurve.keys[1].y=2;
A.notDeepEqual(W.schedule(rateCurve,rateCurve.emitters[0]).events.map(x=>x.time),
plan.events.map(x=>x.time),'temporal rate curve is real');
const spacedCurve=structuredClone(base);spacedCurve.spacingCurve.keys[1].y=1.7;
A.notDeepEqual(W.schedule(spacedCurve,spacedCurve.emitters[0]).distances,plan.distances,'gap curve is real');
const noSpeed=structuredClone(base);noSpeed.windSpeed=0;
A.equal(W.normalize(noSpeed).windSpeed,0);
const noCount=structuredClone(base);noCount.streakCount=0;
A.equal(W.sample(noCount,20/60).emitters[0].layers.streaks.length,0);
const noDust=structuredClone(base);noDust.emitters[0].layers.dust.enabled=false;
A.equal(W.sample(noDust,.45).emitters[0].layers.dust.length,0);
const noLayers=structuredClone(base);for(const l of Object.values(noLayers.emitters[0].layers))l.enabled=false;
A.equal(W.sample(noLayers,20/60).primitives,0);
const straight=structuredClone(base);straight.curveAmount=0;
const bent=W.sample(base,20/60).emitters[0].layers.streaks[0];
const flat=W.sample(straight,20/60).emitters[0].layers.streaks[0];
A.notDeepEqual(Array.from(flat.positions),Array.from(bent.positions));
const rotated=structuredClone(base);rotated.windDirection=90;
A.equal(W.normalize(rotated).windDirection,90);
A.notDeepEqual(W.sample(rotated,.45).emitters[0].layers.streaks.map(r=>Array.from(r.positions).slice(0,4)),
 W.sample(base,.45).emitters[0].layers.streaks.map(r=>Array.from(r.positions).slice(0,4)));
const bad=structuredClone(base);bad.fake=true;A.throws(()=>W.normalize(bad),/unknown/i);
const duplicate=structuredClone(base);duplicate.emitters.push(structuredClone(e));
A.throws(()=>W.normalize(duplicate),/duplicate/i);
const budget=structuredClone(base);budget.quality='low';budget.streakCount=80;
budget.emitters=Array.from({length:4},(_,i)=>W.newEmitter(i));
A.throws(()=>W.normalize(budget),/budget/i);
A.deepEqual(W.sample(base,.38),W.sample(base,.38),'absolute seeking must be deterministic');
console.log('AIR-01 wind numerical RED→GREEN: PASS, true time/arc/taper/direction/layers/strict input');
