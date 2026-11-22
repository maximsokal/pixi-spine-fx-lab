#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),W=require('../assets/waterfall/src/waterfall-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const c=W.defaults(),e=c.emitters[0],close=(a,b,eps=1e-5)=>A.ok(Math.abs(a-b)<=eps,a+' differs from '+b);
A.equal(W.VERSION,1);A.deepEqual(W.LAYERS,['streams','fragments','baseSprayFoam']);
A.equal(c.durationFrames,60);A.equal(c.exportFrames,60);A.equal(c.mode,'loop');
A.equal(c.streamWidth,75);A.equal(c.flowSpeed,180);A.equal(c.strands,8);A.equal(c.breakup,.4);
A.equal(c.foamRadius,45);A.equal(c.turbulence,.35);
A.equal(c.strandGap,9);A.equal(c.fragmentRate,30);
A.equal(c.flowLength,300);A.equal(c.seed,94147);
A.deepEqual(Object.keys(e.layers),W.LAYERS);
A.deepEqual(Object.keys(W.BUDGETS),['low','balanced','high']);
A.equal(W.normalize(c).schemaVersion,1);
A.ok(c.palette.stops.length===3);
const s=W.schedule(c,e);
A.equal(s.events.length,30);A.equal(s.positions.length,8);
A.ok(s.events.every((v,i)=>i===0||v.time>s.events[i-1].time));
A.ok(s.events.every(v=>v.time>=0&&v.time<1));
const a=W.sample(c,0),b=W.sample(c,.5),late=W.sample(c,59/60),seam=W.sample(c,1);
A.deepEqual(a,seam,'periodic phase and particles must carry across seam');
A.ok(a.emitters[0].layers.streams.length===8,'8 flowing ribbon strands');
A.ok(b.emitters[0].layers.streams.length===8);
A.ok(a.emitters[0].layers.fragments.length>1,'history of droplet birth events must exist at t0');
A.ok(b.emitters[0].layers.fragments.length>1);
A.ok(b.emitters[0].layers.baseSprayFoam.length>0,'real impacts at continuous base');
A.ok(late.emitters[0].layers.streams.length===8);
A.notDeepEqual(a.emitters[0].layers.streams[0].positions,b.emitters[0].layers.streams[0].positions,
 'stream paths must physically evolve; static rectangle prohibited');
for(const p of a.emitters[0].layers.streams){
 A.equal(p.kind,'ribbon');A.ok(p.positions.length>60);
 A.ok(p.positions.every(Number.isFinite));A.ok(p.indices.length>0);
 A.ok(p.positions.length<2000);A.ok(p.uvs.length===p.positions.length);
 A.ok(p.indices.length*4<3000);
}
const zeros=clone(c);zeros.breakup=0;
A.equal(W.sample(zeros,.33).emitters[0].layers.fragments.length,0);
const full=clone(c);full.breakup=1;
A.ok(W.sample(full,.33).emitters[0].layers.fragments.length>W.sample(c,.33).emitters[0].layers.fragments.length);
A.ok(W.sample(full,.33).emitters[0].layers.streams.every(p=>p.positions.every(Number.isFinite)));
const sWidth=clone(c);sWidth.streamWidth=112;sWidth.strandGap=9;
A.notDeepEqual(W.schedule(sWidth,sWidth.emitters[0]).positions,s.positions);
const sGap=clone(c);sGap.strandGap=10;
A.notDeepEqual(W.schedule(sGap,sGap.emitters[0]).positions,s.positions);
A.deepEqual(W.schedule(sGap,sGap.emitters[0]).events,s.events);
const gapDistance=clone(c);gapDistance.breakupDistance=23;
A.notDeepEqual(W.schedule(gapDistance,gapDistance.emitters[0]).distancePositions,s.distancePositions);
A.deepEqual(W.schedule(gapDistance,gapDistance.emitters[0]).events,s.events);
const faster=clone(c);faster.fragmentRate=45;
A.equal(W.schedule(faster,faster.emitters[0]).events.length,45);
A.notDeepEqual(W.schedule(faster,faster.emitters[0]).events,s.events);
const moved=clone(c);moved.emitters[0].anchor.x+=27;
const shiftA=W.sample(moved,.2).emitters[0].layers.streams[0];
A.deepEqual(shiftA.positions,a.emitters[0].layers.streams[0].positions===null?[]:W.sample(c,.2).emitters[0].layers.streams[0].positions,
 'source/world translation should not alter local procedural geometry');
const changed={};
for(const [key,action] of [
 ['streamWidth',v=>v.streamWidth=95],
 ['flowSpeed',v=>v.flowSpeed=240],
 ['strands',v=>v.strands=7],
 ['breakup',v=>v.breakup=.75],
 ['foamRadius',v=>v.foamRadius=19],
 ['turbulence',v=>v.turbulence=.95],
 ['strandGap',v=>v.strandGap=8],
 ['fragmentRate',v=>v.fragmentRate=40],
 ['breakupDistance',v=>v.breakupDistance=20],
 ['flowLength',v=>v.flowLength=270],
 ['sheetWidthCurve',v=>v.sheetWidthCurve.keys[1].y=.55],
 ['flowTurbulenceCurve',v=>v.flowTurbulenceCurve.keys[1].y=.25],
 ['sprayAlphaCurve',v=>v.sprayAlphaCurve.keys[1].y=.15],
 ['fragmentRateCurve',v=>v.fragmentRateCurve.keys[1].y=.6],
 ['breakupDistanceCurve',v=>v.breakupDistanceCurve.keys[1].y=2.2],
 ['palette',v=>v.palette.stops[0].rgba[0]=92],
 ['spatialMode',v=>v.spatialMode='clustered'],
 ['seed',v=>v.seed++],
 ['style',v=>v.style='magical']
]){
 const v=clone(c);action(v);const other=W.sample(v,.25);
 A.notDeepEqual(other,b,key+' must produce a genuine numeric difference');changed[key]=true;
}
const off=clone(c);for(const k of W.LAYERS)off.emitters[0].layers[k].enabled=false;
const disabled=W.sample(off,.25);
A.ok(W.LAYERS.every(k=>disabled.emitters[0].layers[k].length===0));
const noFoam=clone(c);noFoam.foamRadius=0;
A.ok(W.sample(noFoam,.3).emitters[0].layers.baseSprayFoam.length===0);
const independent=clone(c);independent.emitters.push(W.newEmitter(1));
const two=W.sample(independent,.3);
A.equal(two.emitters.length,2);
A.deepEqual(two.emitters[0],W.sample(c,.3).emitters[0]);
independent.emitters.reverse();
A.deepEqual(W.sample(independent,.3).emitters.find(x=>x.id==='emitter1'),W.sample(c,.3).emitters[0]);
const oneShot=clone(c);oneShot.mode='shutdown';oneShot.durationFrames=40;oneShot.exportFrames=40;
A.ok(W.sample(oneShot,0).emitters[0].layers.streams.length);
const tail=W.sample(oneShot,38/60),end=W.sample(oneShot,39/60);
A.ok(tail.emitters[0].layers.streams.some(x=>x.rgba[3]>0));
A.ok(W.LAYERS.every(k=>end.emitters[0].layers[k].length===0));
A.ok(W.LAYERS.every(k=>W.sample(oneShot,40/60).emitters[0].layers[k].length===0));
A.deepEqual(W.sample(c,.1),W.sample(c,.1));
A.deepEqual(W.sample(c,.7),W.sample(c,.7));
A.deepEqual(W.sample(c,.3),W.sample(c,1.3));
A.throws(()=>W.normalize({...c,unknown:'bad'}),/unknown/i);
A.throws(()=>W.normalize({...c,schemaVersion:2}),/version/i);
A.throws(()=>W.normalize({...c,strands:40,strandGap:60,streamWidth:12}),/strand.*gap|width/i);
A.throws(()=>W.normalize({...c,streamWidth:11}),/streamWidth|invalid/i);
A.throws(()=>W.normalize({...c,flowSpeed:0}),/flowSpeed|invalid/i);
A.throws(()=>W.normalize({...c,emitters:[e,e]}),/duplicate/i);
A.throws(()=>W.normalize({...c,emitters:Array.from({length:5},(_,i)=>W.newEmitter(i))}),/4|emitters/i);
const crop=clone(c);crop.emitters[0].anchor.x=510;
A.equal(W.bounds(W.sample(crop,.2),crop).inside,false);
A.equal(W.bounds(W.sample(c,.2),c).inside,true);
console.log('PASS WATER-04 core: 60f exact seam + history, 40f shutdown, 8 moving ribbons, distinct rate/gap, breakup, foam, five curves, 19 controls, 4 emitters, strict budgets/crop/schema');
