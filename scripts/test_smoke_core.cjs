#!/usr/bin/env node
'use strict';
// FIRE-05 focused numerical RED->GREEN regression guards (no fake pre-implementation RED).
const assert=require('node:assert/strict');
const S=require('../assets/smoke-plume/src/smoke-core.js');
const Spacing=require('../assets/template/src/spacing-core.js');
const base=S.defaults(),roundtrip=x=>JSON.parse(JSON.stringify(x));
const sample=(c,frame)=>S.sample(c,frame/60);
assert.equal(S.VERSION,1);assert.deepEqual(S.LAYERS,['core','wisps','ash']);
assert.equal(base.mode,'loop');assert.equal(base.rate,18);
assert.equal(base.initialSize,12);assert.equal(base.expansion,2.5);
assert.equal(base.riseSpeed,55);assert.equal(base.swirl,.4);
assert.equal(base.density,.65);assert.equal(base.originGap,16);
assert.equal(base.nozzleWidth,64);
assert.equal(base.durationFrames,120);assert.equal(base.fadeFrames,60);
assert.equal(base.lifetimeSeconds,2);
assert.deepEqual(S.normalize(roundtrip(base)),base);
for(const f of [0,1,3,12,30,40,60,90,100,119,120,180,240]){
 const a=sample(base,f),b=sample(base,f);
 assert.deepEqual(a,b,'non-deterministic seek frame '+f);
 assert.ok(!a.capped,'default quality cap reached at '+f);
}
assert.deepEqual(sample(base,0),sample(base,120),'seamless loop exact numeric modulo');
assert.deepEqual(sample(base,10),sample(base,130),'seamless loop phase shift');
const longPuffs=roundtrip(base);longPuffs.lifetimeSeconds=4;
assert.deepEqual(sample(longPuffs,0),sample(longPuffs,120),
 'Four-second puffs pre-roll across two 120-frame cycles');
assert.ok(sample(base,0).activePuffs>10,'loop pre-roll must be warm at t0');
assert.ok(sample(base,30).activePuffs>10);
assert.ok(sample(base,90).activePuffs>10);
assert.equal(sample(base,120).time,0);
const stop=roundtrip(base);stop.mode='stop';
assert.ok(sample(stop,0).primitives>10);
assert.ok(sample(stop,59).primitives>10);
assert.ok(sample(stop,90).primitives>0);
assert.equal(sample(stop,119).primitives,0,'last stop PNG frame fully transparent');
assert.equal(sample(stop,120).primitives,0);
assert.equal(sample(stop,180).primitives,0);
const burst=roundtrip(base);
burst.mode='burst';burst.durationFrames=100;burst.exportFrames=100;
assert.equal(sample(burst,0).primitives,0,'birth opacity starts at zero');
assert.ok(sample(burst,15).primitives>1,'burst must build smoke');
assert.ok(sample(burst,60).primitives>1,'burst continues age-motion after emission');
assert.ok(sample(burst,98).primitives>0,'tail must not be cut at frame 40');
assert.equal(sample(burst,99).primitives,0,'included PNG frame 99 is transparent');
assert.equal(sample(burst,100).primitives,0,'exclusive endpoint also transparent');
assert.equal(sample(burst,150).primitives,0);
const ageSample=S.sample(burst,.35);
assert.ok(ageSample.emitters[0].events.some(e=>e.time>=0));
const stamps=S.schedule(base,base.emitters[0]).events.map(e=>e.time);
assert.ok(stamps.length>=25&&stamps.length<=45);
for(let i=1;i<stamps.length;i++)assert.ok(stamps[i]>stamps[i-1]);
assert.deepEqual(stamps,S.schedule(base,base.emitters[0]).events.map(e=>e.time));
const more=roundtrip(base);more.rate=30;
assert.ok(S.schedule(more,more.emitters[0]).events.length>stamps.length);
const zero=roundtrip(base);zero.rate=0;
assert.equal(sample(zero,30).primitives,0);
const jitter=roundtrip(base);jitter.intervalJitter=.4;
assert.notDeepEqual(S.schedule(jitter,jitter.emitters[0]).events,
 S.schedule(base,base.emitters[0]).events);
const rate=roundtrip(base);
rate.emissionRateCurve.keys[0].y=.2;
assert.notDeepEqual(S.schedule(rate,rate.emitters[0]).events,
 S.schedule(base,base.emitters[0]).events);
const interval=roundtrip(base);interval.minGapSeconds=.16;
assert.ok(S.schedule(interval,interval.emitters[0]).events.length<stamps.length);
const seed=roundtrip(base);seed.seed=5322;
assert.notDeepEqual(sample(seed,30),sample(base,30));
function compareNumeric(key,v,f=30){
 const altered=roundtrip(base);altered[key]=v;
 const a=sample(base,f),b=sample(altered,f);
 assert.notDeepEqual(a,b,'Inert artist control '+key);return b;
}
for(const [k,v,f] of [
 ['initialSize',32,30],['expansion',4.5,70],['riseSpeed',120,40],
 ['swirl',.9,30],['density',.9,30],['windX',85,30],
 ['nozzleWidth',100,30],['originGap',30,30],['spatialJitter',.4,30],
 ['curlScale',80,30],['style','magical',30],['spatialMode','clustered',30]
])compareNumeric(k,v,f);
const nogap=roundtrip(base);nogap.originGap=0;
assert.ok(S.births(nogap,nogap.emitters[0],.5).events.every(e=>e.position.x===0));
const narrow=roundtrip(base);narrow.nozzleWidth=10;narrow.originGap=75;
assert.equal(S.births(narrow,narrow.emitters[0],.5).capped,true);
const gapCurve=roundtrip(base);gapCurve.spacingCurveEnabled=true;
assert.notDeepEqual(S.births(gapCurve,gapCurve.emitters[0],.5),
 S.births(base,base.emitters[0],.5));
const gapChange=roundtrip(gapCurve);
gapChange.spacingCurve.keys[1].y=56;
assert.notDeepEqual(S.births(gapCurve,gapCurve.emitters[0],.5),
 S.births(gapChange,gapChange.emitters[0],.5));
const move=roundtrip(base);move.emitters[0].motion.mode='path';
move.emissionMode='distance';const moving=S.births(move,move.emitters[0],.65);
assert.ok(moving.events.length>=2,'actual moving arc-length needed');
const arc=Spacing.buildArcTable(move.emitters[0].motion.path);
for(const e of moving.events.filter(x=>x.time>=0)){
 assert.ok(Number.isFinite(e.position.x)&&Number.isFinite(e.position.y));
}
const immobile=roundtrip(base);immobile.emissionMode='distance';
assert.equal(S.births(immobile,immobile.emitters[0],.5).events.length,0);
assert.match(S.births(immobile,immobile.emitters[0],.5).diagnostic,/moving/);
const both=roundtrip(move);both.emissionMode='both';
assert.ok(S.births(both,both.emitters[0],.5).events.length>=0);
const speed=roundtrip(base);speed.riseCurve.keys[1].y=2;
assert.notDeepEqual(sample(speed,30),sample(base,30));
for(const [key,index,value] of [
 ['sizeCurve',1,3.5],['opacityCurve',1,.3],
 ['emissionRateCurve',0,.35],['riseCurve',1,1.8]
]){
 const altered=roundtrip(base);
 altered[key].keys[index].y=value;
 assert.notDeepEqual(sample(altered,30),sample(base,30),
  'Curve effect missing '+key);
}
const palette=roundtrip(base);palette.palette.stops[1].rgba=[215,50,140,.5];
assert.notDeepEqual(sample(palette,30),sample(base,30));
const first=sample(base,30).emitters[0];
const multi=roundtrip(base);multi.emitters.push(S.newEmitter(1));
assert.deepEqual(sample(multi,30).emitters.find(e=>e.id==='emitter1'),first);
const reorder=roundtrip(multi);reorder.emitters.reverse();
assert.deepEqual(sample(reorder,30),sample(multi,30));
const neighbor=roundtrip(multi);neighbor.emitters[1].seed=444;
assert.deepEqual(sample(neighbor,30).emitters.find(e=>e.id==='emitter1'),first);
assert.notDeepEqual(sample(neighbor,30).emitters.find(e=>e.id==='emitter2'),
 sample(multi,30).emitters.find(e=>e.id==='emitter2'));
const grouped=roundtrip(base);
for(const layer of S.LAYERS)grouped.emitters[0].layers[layer].enabled=true;
const allLayers=sample(grouped,30);
for(const layer of S.LAYERS){
 assert.ok(allLayers.emitters[0].layers[layer].length>0);
 const c=roundtrip(grouped);c.emitters[0].layers[layer].enabled=false;
 const snap=sample(c,30);
 assert.equal(snap.emitters[0].layers[layer].length,0);
 for(const other of S.LAYERS)if(other!==layer)
  assert.deepEqual(snap.emitters[0].layers[other],allLayers.emitters[0].layers[other]);
}
const empty=roundtrip(grouped);
for(const layer of S.LAYERS)empty.emitters[0].layers[layer].enabled=false;
assert.equal(sample(empty,30).primitives,0);
const heavy=roundtrip(base);heavy.rate=120;
heavy.emitters.push(S.newEmitter(1),S.newEmitter(2),S.newEmitter(3));
assert.ok(sample(heavy,30).primitives<=S.BUDGETS.balanced.maxPrimitives);
assert.equal(sample(heavy,30).capped,true);
const huge=roundtrip(base);huge.emitters[0].anchor.x=510;
assert.equal(S.bounds(sample(huge,30),{emitter1:{x:510,y:350}},huge).inside,false);
for(const bad of [
 {...base,schemaVersion:2},{...base,rate:121},{...base,seed:NaN},
 {...base,unknown:true},{...base,mode:'splash'},
 {...base,emissionMode:'???'},
 {...base,lifetimeSeconds:11},
 {...base,emitters:[S.newEmitter(0),S.newEmitter(0)]},
 {...base,emitters:Array.from({length:5},(_,i)=>S.newEmitter(i))},
 {...base,emitters:[{...base.emitters[0],anchor:{...base.emitters[0].anchor,
  type:'attachment',name:'x',slot:''}}]}
])assert.throws(()=>S.normalize(bad),/Smoke|Invalid/i);
console.log('PASS FIRE-05 smoke core: 120f loop, 60f fade, 40+60 burst, seeded 4 emitter, age curves, arc distance/nozzle, caps');
