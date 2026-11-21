#!/usr/bin/env node
'use strict';
// FIRE-06 deterministic numerical oracle. This file is the acceptance boundary
// for continuous fields, independent event timing, real path lattice and maps.
const assert=require('node:assert/strict');
const H=require('../assets/heat-haze/src/haze-core.js');
const S=require('../assets/template/src/spacing-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const d=H.defaults(),inside={x:256,y:310},outside={x:400,y:400};
const at=(c,t,p=inside)=>H.sampleAt(H.prepare(c,t),p.x,p.y);
const sig=(c,t,p=inside)=>JSON.stringify(at(c,t,p));
function checkChange(key,value,{time=.57,point=inside,prep}={}){
 const a=clone(d),b=clone(d);prep?.(a,b);b[key]=value;
 assert.notEqual(sig(a,time,point),sig(b,time,point),'Inert '+key);
}
assert.equal(H.WIDTH,512);
assert.deepEqual(H.LAYERS,['refraction','thermalGlow']);
assert.deepEqual(H.normalize(clone(d)),d);
for(const [k,v] of Object.entries({
 amplitude:8,noiseFrequency:.035,verticalFlow:25,regionWidth:90,
 edgeFalloff:18,pulseRate:1.5,nodeGap:28,density:1,
 durationFrames:120,exportFrames:120,seed:407
}))assert.equal(d[k],v,k);
assert.equal(H.QUALITY.low.fieldSize,128);
assert.equal(H.QUALITY.balanced.fieldSize,256);
assert.equal(H.QUALITY.high.fieldSize,512);
const state=H.prepare(d,.57);
assert.equal(state.missing.length,0);
assert.ok(state.emitters[0].refraction);
assert.equal(state.emitters[0].thermalGlow,null);
assert.ok(state.emitters[0].refraction.table.errorBound<=.25);
assert.ok(state.emitters[0].refraction.nodes.length>=4);
const p=at(d,.57);
assert.ok(p.coverage>.2&&Math.hypot(p.dx,p.dy)>.15);
const empty=at(d,.57,outside);
assert.deepEqual(empty,{dx:0,dy:0,coverage:0,glow:[0,0,0,0],active:0});
assert.deepEqual(at(d,0),at(d,2),'loop modulo 120f');
assert.deepEqual(at(d,.25),at(d,2.25));
assert.deepEqual(at(d,.57),at(d,.57));
assert.notDeepEqual(at(d,.57),at(d,.81),'time animation inert');
const pulses=H.pulseSchedule(d,d.emitters[0]);
assert.equal(pulses.length,3,'three 1.5Hz cycles over 2 seconds');
assert.ok(pulses.every(t=>t>=0&&t<2));
assert.deepEqual(H.pulseSchedule(d,d.emitters[0]),pulses);
const changedRate=clone(d);changedRate.pulseRate=4;
assert.notDeepEqual(H.pulseSchedule(changedRate,changedRate.emitters[0]),pulses);
const zeroRate=clone(d);zeroRate.pulseRate=0;
assert.deepEqual(H.pulseSchedule(zeroRate,zeroRate.emitters[0]),[]);
const jitter=clone(d);jitter.pulseJitter=.4;
assert.notDeepEqual(H.pulseSchedule(jitter,jitter.emitters[0]),pulses);
const gust=clone(d);gust.gustEnabled=true;
assert.equal(H.pulseSchedule(gust,gust.emitters[0],'gust').length,1);
assert.notDeepEqual(at(gust,.22),at(d,.22));
const flow=clone(d);flow.verticalFlow=-75;
assert.notDeepEqual(at(flow,.57),p);
for(const [k,v] of [
 ['amplitude',14],['noiseFrequency',.08],['verticalFlow',90],
 ['density',.4],['seed',9876],
 ['pulseRate',6],['pulseJitter',.4],['nodeGap',9],['nodeJitter',.42],
 ['spatialMode','clustered'],['style','stylized']
])checkChange(k,v);
checkChange('regionWidth',55,{point:{x:296,y:310}});
checkChange('edgeFalloff',75,{point:{x:296,y:310}});
const width0=clone(d);width0.amplitude=0;
const neutral=H.rasterize(width0,.5);
assert.equal(neutral.changedPixels,0);
for(let i=0;i<neutral.map.length;i+=4){
 assert.deepEqual([...neutral.map.subarray(i,i+4)],[128,128,0,255]);
 assert.equal(neutral.mask[i+3],0);
}
const noLayers=clone(d);
for(const l of H.LAYERS)noLayers.emitters[0].layers[l].enabled=false;
assert.equal(H.rasterize(noLayers,.6).changedPixels,0);
const glow=clone(d);glow.emitters[0].layers.thermalGlow.enabled=true;
const glowResult=H.rasterize(glow,.9);
assert.ok(glowResult.glow.some((v,i)=>i%4===3&&v>0));
const glowNoRefract=clone(glow);
glowNoRefract.emitters[0].layers.refraction.enabled=false;
assert.equal(H.rasterize(glowNoRefract,.9).changedPixels,0);
assert.ok(H.rasterize(glowNoRefract,.9).glow.some((v,i)=>i%4===3&&v>0));
const glowShift=clone(glow);glowShift.emitters[0].layers.thermalGlow.x=25;
assert.notDeepEqual(at(glowShift,.9,{x:296,y:300}),at(glow,.9,{x:296,y:300}));
const allOff=clone(glow);
for(const key of H.LAYERS){allOff.emitters[0].layers[key].enabled=false}
assert.equal(H.rasterize(allOff,.9).changedPixels,0);
assert.ok(!H.rasterize(allOff,.9).glow.some((v,i)=>i%4===3&&v>0));
const palette=clone(glow);palette.palette.stops[1].rgba=[100,20,200,1];
assert.notDeepEqual(at(palette,.9),at(glow,.9));
const edge=clone(d);edge.edgeCurve.keys[1].y=.1;
assert.notDeepEqual(at(edge,.57,{x:256,y:345}),at(d,.57,{x:256,y:345}));
const strength=clone(d);strength.distortionCurve.keys[1].y=.2;
assert.notDeepEqual(at(strength,.5),at(d,.5));
const timing=clone(d);timing.pulseCurve.keys[0].y=.2;
assert.notDeepEqual(H.pulseSchedule(timing,timing.emitters[0]),
 H.pulseSchedule(d,d.emitters[0]));
const frame=H.rasterize(d,.5);
assert.ok(frame.changedPixels>2000);
assert.equal(frame.map.length,512*512*4);
assert.equal(frame.mask.length,512*512*4);
assert.equal(frame.glow.length,512*512*4);
let nonzero=0;
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
 const i=4*(y*512+x),blue=frame.map[i+2];
 if(blue>0){
  nonzero++;
  assert.ok(frame.mask[i+3]>0,'B coverage disagrees with alpha matte');
  assert.equal(frame.map[i+3],255);
 }else{
  assert.deepEqual([...frame.map.subarray(i,i+4)],[128,128,0,255],
   'non-neutral outside actual ROI at '+x+','+y);
  assert.equal(frame.mask[i+3],0);
 }
}
assert.equal(nonzero,frame.changedPixels);
assert.deepEqual(H.rasterize(d,0).map,H.rasterize(d,2).map,'120f seam RGBA data');
const high=clone(d);high.quality='high';
assert.notDeepEqual(H.rasterize(high,.57).map,H.rasterize(d,.57).map);
const low=clone(d);low.quality='low';
assert.notDeepEqual(H.rasterize(low,.57).map,H.rasterize(d,.57).map);
const baseline=H.prepare(d,.5).emitters[0].refraction.nodes;
const closer=clone(d);closer.nodeGap=10;
const changed=H.prepare(closer,.5).emitters[0].refraction.nodes;
assert.notDeepEqual(baseline.map(n=>n.distance),changed.map(n=>n.distance));
const source=clone(d);source.emitters.push(H.newEmitter(1));
assert.deepEqual(H.prepare(source,.57).emitters[0].pulses,pulses);
const snap=H.sampleAt(H.prepare(source,.5),inside.x,inside.y);
const reordered=clone(source);reordered.emitters.reverse();
assert.deepEqual(H.sampleAt(H.prepare(reordered,.5),inside.x,inside.y),snap);
reordered.emitters[0].seed=233444;
assert.notDeepEqual(H.sampleAt(H.prepare(reordered,.5),inside.x,inside.y),snap);
const missing=clone(d);missing.emitters[0].anchor.type='bone';
missing.emitters[0].anchor.name='absent';
assert.deepEqual(H.prepare(missing,.5).missing,['emitter1']);
assert.equal(H.prepare(missing,.5).geometries.length,0);
const stop=clone(d);stop.mode='stop';
assert.equal(H.prepare(stop,90/60).fade>0,true);
assert.equal(H.prepare(stop,119/60).fade,0);
assert.equal(H.rasterize(stop,119/60).changedPixels,0);
assert.deepEqual(H.rasterize(stop,119/60).map,neutral.map);
const turned=clone(d);turned.emitters[0].rotation=90;
assert.notDeepEqual(H.prepare(turned,.5).geometries[0].bbox,
 H.prepare(d,.5).geometries[0].bbox);
const outOfBounds=clone(d);outOfBounds.emitters[0].anchor.x=510;
assert.ok(H.prepare(outOfBounds,.5).geometries[0].fullBounds.maxX>512);
for(const bad of [
 {...d,schemaVersion:2},{...d,amplitude:33},{...d,noiseFrequency:NaN},
 {...d,edgeFalloff:-1},{...d,pulseRate:13},{...d,style:'unsupported'},
 {...d,quality:'off'},{...d,unknown:true},{...d,mode:'burst'},
 {...d,mode:'stop',durationFrames:40},
 {...d,emitters:Array.from({length:5},(_,i)=>H.newEmitter(i))},
 {...d,emitters:[H.newEmitter(0),H.newEmitter(0)]},
 {...d,emitters:[{...d.emitters[0],layers:{}}]},
 {...d,emitters:[{...d.emitters[0],path:{...d.emitters[0].path,closed:true}}]}
])assert.throws(()=>H.normalize(bad),/Haze|Invalid/i);
console.log('PASS FIRE-06 haze core: strict schemas, real pulse time, real arc nodes, field map RG+B, zero ROI, deterministic 120f seam, four sources, glow isolation, stop fade');
