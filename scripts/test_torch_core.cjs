#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const T=require('../assets/torch-flame/src/torch-core.js');
const close=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,String(a)+' vs '+String(b));
const s=T.defaults();
assert.equal(s.schemaVersion,1);
assert.equal(s.flameHeight,110);
assert.equal(s.baseWidth,36);
assert.equal(s.tongueCount,5);
assert.equal(s.cycleFrames,60);
assert.equal(s.emberRate,20);
assert.equal(s.layers.core.enabled,true);
assert.equal(s.layers.embers.enabled,true);
const first=T.sample(s,0),period=T.sample(s,1),late=T.sample(s,5.5);
assert.deepEqual(first,period,'seam across 60 frame cycle must be identical');
assert.deepEqual(first,T.sample(s,0));
assert.deepEqual(late,T.sample(s,5.5));
assert.ok(first.layers.tongues.length>=5);
assert.ok(first.layers.core.length>0);
assert.ok(first.layers.glow.length>0);
assert.ok(first.layers.embers.length>=0);
assert.notDeepEqual(first.layers.tongues,T.sample(s,.23).layers.tongues,'tongues vary with time');
const turbulent=T.sample({...s,turbulence:.9},.23);
assert.notDeepEqual(turbulent.layers.tongues,T.sample({...s,turbulence:0},.23).layers.tongues);
assert.deepEqual(T.sample({...s,glowRadius:0},.23).layers.glow,[]);
const disabled=T.sample({...s,layers:Object.fromEntries(Object.entries(s.layers).map(([k,v])=>[k,{...v,enabled:false}]))},.33);
assert.ok(Object.values(disabled.layers).every(a=>a.length===0),'all disabled must produce empty effect');
const moved=T.sample({...s,layers:{...s.layers,embers:{...s.layers.embers,x:37}}},.6);
assert.deepEqual(first.layers.core,T.sample({...s,layers:{...s.layers,embers:{...s.layers.embers,x:37}}},0).layers.core);
assert.notDeepEqual(T.sample(s,.6).layers.embers,moved.layers.embers);
const timed=T.sample({...s,emberRate:40},.6);
assert.notDeepEqual(timed.events.map(e=>e.birth),T.sample(s,.6).events.map(e=>e.birth));
const spread=T.sample({...s,emberOriginGap:22},.6);
assert.notDeepEqual(spread.events.map(e=>e.x),T.sample(s,.6).events.map(e=>e.x));
const curveChanged={...s,flickerCurve:{...s.flickerCurve,keys:s.flickerCurve.keys.map(
 (k,i)=>i===1?{...k,y:.3}:k)}};
assert.notDeepEqual(T.sample(curveChanged,.27).layers.core,T.sample(s,.27).layers.core);
assert.equal(JSON.stringify(T.normalize(JSON.parse(JSON.stringify(s)))),JSON.stringify(s));
const wrong=[
 {...s,schemaVersion:2},{...s,flameHeight:Infinity},{...s,tongueCount:50},
 {...s,cycleFrames:0},{...s,emberRate:-5},{...s,flameGradient:{...s.flameGradient,stops:[]}},
 {...s,layers:{...s.layers,core:{...s.layers.core,visible:'yes'}}},
 {...s,seed:2147483648},{...s,noise:12}
];
wrong.forEach(cfg=>assert.throws(()=>T.normalize(cfg),/invalid|unsupported|range|must|unknown|version/i));
for(const t of [0,1/60,40/60,1,1.5,10]) {
 const f=T.sample(s,t);
 assert.ok(f.events.length<=T.BUDGETS.balanced.maxEmbers);
 assert.ok(Object.values(f.layers).flat().length<=T.BUDGETS.balanced.maxPrimitives);
 assert.ok(JSON.stringify(f).length<1e6);
}
// FIRE-01 numerical influence matrix: every scalar/enum actually affects output.
const cases=[
 ['flameHeight',180,.22],['baseWidth',70,.22],['turbulence',.9,.22],
 ['tongueCount',9,.22],['tongueGap',18,.22],['flickerFrequency',15,.22],
 ['cycleFrames',120,.22],['seed',99,.22],['emberRate',45,.22],
 ['emberOriginGap',19,.22],['emberSize',8,.22],['emberLife',1.5,.22],
 ['glowRadius',65,.22],['quality','low',.22],['style','magical',.22],
 ['ignitionFrames',20,.1],['extinguishFrames',30,.85]
];
for(const [key,value,time] of cases){
 const before=T.sample(s,time),after=T.sample({...s,[key]:value},time);
 assert.notDeepEqual(before,after,'Inert artist control: '+key);
}
const palette={...s.flameGradient,stops:s.flameGradient.stops.map((c,i)=>
 i===1?{...c,rgba:[16,230,190,.7]}:c)};
const colored=T.sample({...s,flameGradient:palette},.22);
assert.notDeepEqual(colored.layers.tongues,T.sample(s,.22).layers.tongues);
for(const name of ['core','tongues','glow','embers']){
 const baseline=T.sample(s,.22);
 const hidden=T.sample({...s,layers:{...s.layers,[name]:{...s.layers[name],enabled:false}}},.22);
 assert.deepEqual(hidden.layers[name],[],'layer '+name+' disable must empty its own geometry');
 for(const sibling of Object.keys(s.layers))if(sibling!==name)
  assert.deepEqual(hidden.layers[sibling],baseline.layers[sibling],
    'disabling '+name+' must not affect sibling '+sibling);
 const moved=T.sample({...s,layers:{...s.layers,[name]:{...s.layers[name],x:30,y:-12}}},.22);
 assert.notDeepEqual(moved.layers[name],baseline.layers[name],name+' XY must move');
 for(const sibling of Object.keys(s.layers))if(sibling!==name)
  assert.deepEqual(moved.layers[sibling],baseline.layers[sibling],
    'moving '+name+' must not move sibling '+sibling);
}
// Distinct numeric spatial and temporal oracles are not tied to playback speed.
const source=T.sample(s,.5),moreRate=T.sample({...s,emberRate:60},.5);
assert.notDeepEqual(source.events.map(x=>x.birth),moreRate.events.map(x=>x.birth));
const widerGap=T.sample({...s,emberOriginGap:14},.5);
assert.notDeepEqual(source.events.map(x=>x.x),widerGap.events.map(x=>x.x));

console.log('PASS FIRE-01 core numeric, phases, loop, per-layer movement, spacing, curves, palette and budgets');
