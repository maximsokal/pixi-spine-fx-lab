#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),C=require('../assets/template/src/color-core.js');
const close=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,String(a)+' != '+String(b));
const sample={
 schemaVersion:1,parameterKey:'colorOverLife',domain:'particleAge',
 inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
 stops:[{id:'start',position:0,rgba:[255,0,0,0]},{id:'end',position:1,rgba:[0,0,255,1]}]
};
assert.deepEqual(C.normalize(sample),sample);
assert.deepEqual(C.deserialize(C.serialize(sample)),sample);
assert.deepEqual(C.sample(sample,0),[255,0,0,0]);
assert.deepEqual(C.sample(sample,1),[0,0,255,1]);
assert.deepEqual(C.sample(sample,-5),[255,0,0,0]);
assert.deepEqual(C.sample(sample,5),[0,0,255,1]);
const mid=C.sample(sample,.5);
close(mid[0],127.5);close(mid[2],127.5);close(mid[3],.5);
const linear={...sample,space:'linear-rgb'};
const l=C.sample(linear,.5);
close(l[0],187.516,0.015);close(l[2],187.516,0.015);close(l[3],.5);
assert.ok(l[0]>mid[0]+55);
assert.equal(C.hex(l),'#bc00bc');
const one={...sample,stops:[{id:'single',position:.77,rgba:[201,20,244,0]}]};
for(const x of [-1,0,.4,.77,1,4])assert.deepEqual(C.sample(one,x),[201,20,244,0]);
assert.deepEqual(C.composite([255,100,50,0],[0,0,0]),[0,0,0]);
assert.deepEqual(C.composite([255,100,50,0],[255,255,255]),[255,255,255]);
assert.deepEqual(C.composite([255,100,50,1],[0,0,0]),[255,100,50]);
assert.deepEqual(C.composite([255,100,50,.5],[0,0,0]),[127.5,50,25]);
assert.deepEqual(C.composite([255,100,50,.5],[255,255,255]),[255,177.5,152.5]);
const bad=[
 [o=>o.stops[1].position=0,'strictly increasing'],
 [o=>o.stops[0].rgba[0]=NaN,'finite'],
 [o=>o.stops[0].rgba[3]=2,'finite'],
 [o=>o.stops[0].rgba[0]=-1,'finite'],
 [o=>o.stops[1].id='start','unique'],
 [o=>o.space='display-p3','space'],
 [o=>o.clamp='repeat','hold'],
 [o=>o.domain='flameIntensity','inputUnit'],
 [o=>o.schemaVersion=2,'version'],
 [o=>o.stops=[],'stops'],
 [o=>o.stops=Array.from({length:9},(_,i)=>({id:'s'+i,position:i/8,rgba:[0,0,0,1]})),'stops'],
 [o=>o.extra=1,'unknown']
];
for(const [mutate,regex] of bad){const n=JSON.parse(JSON.stringify(sample));mutate(n);assert.throws(()=>C.normalize(n),new RegExp(regex,'i'));}
assert.throws(()=>C.deserialize('{'),/JSON/);
assert.throws(()=>C.sample(sample,Infinity),/finite/);
for(const p of ['natural','stylized','magical'])for(const domain of ['particleAge','flameIntensity']){
 const grad=C.createPreset(p,domain);
 assert.deepEqual(C.deserialize(C.serialize(grad)),grad);
 assert.ok(C.sample(grad,.5)[3]>0);
}
const lifespan=C.defaultLifetime('#ffc278');
assert.deepEqual(C.normalizeLifetime(lifespan),lifespan);
assert.equal(lifespan.enabled,false);
const live={...lifespan,enabled:true};
const start=C.sampleLifetime(live,0,.75),end=C.sampleLifetime(live,1,.75);
close(start.rgba[3],.75);close(end.rgba[3],0);
close(start.size,1);close(end.size,.2);close(end.glow,0);
const fps=[30,60,120].map(fps=>C.sampleLifetime(live,Math.round(.5*fps)/fps,.75));
assert.deepEqual(fps[0],fps[1]);assert.deepEqual(fps[1],fps[2]);
const modified=JSON.parse(JSON.stringify(live));
modified.opacityOverLife.keys[0].y=.5;
modified.alphaOverLife.keys[0].y=.5;
const a=C.sampleLifetime(modified,0,.8);close(a.rgba[3],.2);
assert.throws(()=>C.normalizeLifetime({...live,sizeOverLife:null}),/curve|object/);
console.log('PASS FX-CORE-04: sRGB/linear endpoints, half alpha, bright transparent RGB, 1/8 stops, strict schemas, 3 palettes, 4 lifetime curves, FPS parity');
