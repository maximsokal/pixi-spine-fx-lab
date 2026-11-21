#!/usr/bin/env node
'use strict';
// FIRE-02 independent RED->GREEN numeric and contract verification.
const assert=require('node:assert/strict');
const E=require('../assets/fire-explosion/src/explosion-core.js');
const s=E.defaults(),sample=(cfg,t=.25)=>E.sample(cfg,t);
assert.equal(E.VERSION,1);
assert.deepEqual(E.LAYERS,['flash','fire','shockwave','sparks','debris','smoke']);
assert.equal(s.durationFrames,40);
assert.equal(s.exportFrames,40);
assert.equal(s.loop,false);
assert.equal(s.burstSparks,80);
assert.equal(s.blastRadius,100);
assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))),s);
for(const frame of [0,2,6,12,20,26,39,50,64]){
 const out=sample(s,frame/60),bound=E.bounds(out,{x:256,y:256});
 assert.ok(out.primitives<=E.BUDGETS.balanced.maxPrimitives,'primitive budget');
 assert.equal(out.primitives,Object.values(out.layers).reduce((n,v)=>n+v.length,0));
 assert.ok(bound.inside,'default explosion must fit at '+frame);
 assert.deepEqual(out,sample(s,frame/60),'repeat absolute time');
}
assert.ok(sample(s,0).layers.flash.length>0,'visible flash at start');
assert.equal(sample(s,6/60).layers.flash.length,0,'flash must disappear after frame 4');
assert.ok(sample(s,12/60).layers.fire.length>0,'fire phase missing');
assert.ok(sample(s,22/60).layers.shockwave.length>0,'shockwave must be distinct');
assert.equal(sample(s,37/60).layers.shockwave.length,0,'ghost shockwave');
assert.ok(sample(s,39/60).layers.smoke.length>0,'smoke must persist in frame 39');
assert.ok(sample(s,50/60).layers.smoke.length>0,'smoke outlives 40 frame one-shot');
assert.equal(sample(s,70/60).primitives,0,'one-shot must stop, no automatic loop');
assert.ok(sample({...s,loop:true},.2).layers.fire.length>0);
assert.deepEqual(sample({...s,loop:true},0),sample({...s,loop:true},40/60),'explicit seamless loop');
const at=.34,base=sample(s,at);
const changed=[
 ['blastRadius',120],['burstSparks',50],['initialSpeed',300],['expansion',2.6],
 ['shockwaveWidth',24],['turbulence',.9],['sparkOriginGap',18],
 ['debrisSpacing',22],['burstJitter',.35],['smokeCount',6],['durationFrames',50],
 ['seed',824],['quality','low'],['style','magical'],['spatialMode','clustered']
];
for(const [key,value] of changed){
 const next=sample({...s,[key]:value},at);
 assert.notDeepEqual(next,base,'inert '+key);
}
assert.notDeepEqual(sample({...s,smokePersistence:48},.8),sample(s,.8));
assert.notDeepEqual(sample({...s,secondaryBursts:true},.22),sample(s,.22));
assert.notDeepEqual(sample({...s,secondaryBursts:true,secondaryCount:36},.22),
 sample({...s,secondaryBursts:true},.22));
assert.notDeepEqual(sample({...s,directionMode:'directional'},at),base);
assert.notDeepEqual(sample({...s,directionMode:'directional',heading:90},at),
 sample({...s,directionMode:'directional'},at));
assert.notDeepEqual(sample({...s,directionMode:'directional',spread:180},at),
 sample({...s,directionMode:'directional'},at));
const timing=sample(s,at).events.sparks.map(e=>e.born);
const timingAlt=sample({...s,burstJitter:.3},at).events.sparks.map(e=>e.born);
assert.notDeepEqual(timing,timingAlt,'temporal jitter must change actual birth timestamps');
const distance=sample(s,at).events.debris.map(e=>e.distance);
const distanceAlt=sample({...s,debrisSpacing:22},at).events.debris.map(e=>e.distance);
assert.notDeepEqual(distance,distanceAlt,'spatial spacing must change arc distances');
for(const layer of E.LAYERS){
 const baseline=sample(s,at);
 const hidden=sample({...s,layers:{...s.layers,[layer]:{...s.layers[layer],enabled:false}}},at);
 assert.deepEqual(hidden.layers[layer],[],'layer not disabled '+layer);
 for(const sibling of E.LAYERS)if(sibling!==layer){
  assert.deepEqual(hidden.layers[sibling],baseline.layers[sibling],'sibling modified by '+layer);
 }
 const moved=sample({...s,layers:{...s.layers,[layer]:{
  ...s.layers[layer],x:30,y:14,rotation:12,timeOffset:1}}},at);
 if(baseline.layers[layer].length)
  assert.notDeepEqual(moved.layers[layer],baseline.layers[layer],'layer XY/angle inert '+layer);
 for(const sibling of E.LAYERS)if(sibling!==layer)
  assert.deepEqual(moved.layers[sibling],baseline.layers[sibling],'sibling moved '+sibling);
}
const disabled=sample({...s,layers:Object.fromEntries(E.LAYERS.map(k=>[k,{
 ...s.layers[k],enabled:false}]))},at);
assert.equal(disabled.primitives,0,'disabled explosion has ghost primitives');
const extreme=sample({...s,blastRadius:350,expansion:6},.25);
assert.equal(E.bounds(extreme,{x:256,y:256}).inside,false,'extreme must be detected as cropped');
const curveNext=structuredClone(s);
curveNext.radiusCurve.keys[1].y=.35;
assert.notDeepEqual(sample(curveNext,.12).layers.fire,sample(s,.12).layers.fire);
const smokeCurve=structuredClone(s);
smokeCurve.smokeSizeCurve.keys[1].y=2.5;
assert.notDeepEqual(sample(smokeCurve,.5).layers.smoke,sample(s,.5).layers.smoke);
const burstCurve=structuredClone(s);
burstCurve.emissionGapCurve.keys[1].y=2;
assert.notDeepEqual(sample(burstCurve,at).events.sparks,
 sample(s,at).events.sparks);
const spacingCurve=structuredClone(s);
spacingCurve.debrisSpacingCurveEnabled=true;
spacingCurve.debrisSpacingCurve.keys[0].y=12;
spacingCurve.debrisSpacingCurve.keys[1].y=12;
assert.notDeepEqual(sample(spacingCurve,.34).events.debris,sample(s,.34).events.debris);
const bad=[
 {...s,schemaVersion:2},{...s,blastRadius:Infinity},{...s,burstSparks:501},
 {...s,exportFrames:0},{...s,durationFrames:-1},{...s,seed:2147483648},
 {...s,missing:1},{...s,layers:{...s.layers,flash:{...s.layers.flash,rotation:Infinity}}}
];
for(const cfg of bad)assert.throws(()=>E.normalize(cfg),/invalid|unsupported|unknown|version/i);
console.log('PASS FIRE-02 core: phases, independent six layers, event time/space, seed, bounds, curves and budgets');
