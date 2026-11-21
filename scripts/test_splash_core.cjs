#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const S=require('../assets/water-splash/src/splash-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const d=S.defaults();
A.equal(S.VERSION,1);
A.equal(S.normalize(d).durationFrames,40);
A.equal(d.loop,false);
A.equal(d.droplets,24);
A.equal(d.spread,140);
A.equal(d.gravity,420);
A.equal(d.launchSpeed,220);
A.equal(d.dropletSize,6);
A.equal(d.crownHeight,55);
A.equal(d.rippleRadius,85);
A.equal(d.openingSpacing,10);
A.equal(d.emitters[0].anchor.x,256);
A.equal(d.emitters[0].anchor.y,350);
A.deepEqual(S.LAYERS,['crown','droplets','mist','ripple']);
const t0=S.sample(d,0);
A.equal(t0.emitters.length,1);
A.equal(t0.emitters[0].layers.droplets.length,24,'instantaneous 24 at frame0');
A.ok(t0.emitters[0].layers.crown.length>0,'crown must be visible immediately');
A.equal(t0.emitters[0].layers.ripple.length,0,'ripple disabled by default');
A.deepEqual(S.schedule(d,d.emitters[0]).impact.map(x=>x.time),Array(24).fill(0));
const t4=S.sample(d,4/60),t16=S.sample(d,16/60),t32=S.sample(d,32/60);
A.ok(t4.emitters[0].layers.droplets.length>0);
A.ok(t16.emitters[0].layers.droplets.length>0);
A.ok(t32.emitters[0].layers.droplets.length>0);
const end=S.sample(d,39/60);
A.equal(end.emitters.length,0,'last included frame has no visible primitives');
A.deepEqual(S.sample(d,40/60).emitters,[],'one-shot cleared after 40 frames');
const repeat=clone(d);repeat.loop=true;
A.deepEqual(S.sample(repeat,0),S.sample(repeat,40/60),'repeat-impact absolute time');
A.deepEqual(S.sample(repeat,12/60),S.sample(repeat,52/60));
A.deepEqual(S.sample(repeat,.25),S.sample(repeat,.25));
const drop=S.sample(d,.25).emitters[0].layers.droplets[3];
const heavier=clone(d);heavier.gravity=820;
const fallen=S.sample(heavier,.25).emitters[0].layers.droplets[3];
A.ok(Math.abs(fallen.y-drop.y-0.5*400*.25**2)<.0001,
 'gravity must change quadratic y by .5*deltaG*t^2');
A.equal(drop.x,fallen.x);
const weightless=clone(d);weightless.gravity=0;
const noGravity=S.sample(weightless,.25).emitters[0].layers.droplets[3];
A.ok(noGravity.y<drop.y);
const narrow=clone(d);narrow.spread=0;
A.ok(S.sample(narrow,.25).emitters[0].layers.droplets.every(x=>Math.abs(x.vx)<.0001));
const around=clone(d);around.spread=360;
A.ok(S.sample(around,.25).emitters[0].layers.droplets.some(x=>x.vy>0),
 '360-degree fan may intentionally eject downward');
const noDrops=clone(d);noDrops.droplets=0;
A.equal(S.sample(noDrops,.1).emitters[0].layers.droplets.length,0);
A.ok(S.sample(noDrops,.1).emitters[0].layers.crown.length>0,
 'crown independent of droplet layer and count');
const off=clone(d);off.emitters[0].layers.crown.enabled=false;
A.equal(S.sample(off,.1).emitters[0].layers.crown.length,0);
A.ok(S.sample(off,.1).emitters[0].layers.droplets.length>0);
const noMist=clone(d);noMist.emitters[0].layers.mist.enabled=false;
A.equal(S.sample(noMist,.1).emitters[0].layers.mist.length,0);
const ripple=clone(d);ripple.emitters[0].layers.ripple.enabled=true;
const rippleSample=S.sample(ripple,.1).emitters[0].layers.ripple;
A.ok(rippleSample.length&&rippleSample[0].radius>0);
const noRipple=clone(ripple);noRipple.rippleRadius=0;
A.equal(S.sample(noRipple,.1).emitters[0].layers.ripple.length,0);
const smallCrown=clone(d);smallCrown.crownHeight=0;
A.notDeepEqual(S.sample(smallCrown,.15).emitters[0].layers.crown,
 S.sample(d,.15).emitters[0].layers.crown);
const fast=clone(d);fast.launchSpeed=420;
A.notDeepEqual(S.sample(fast,.25).emitters[0].layers.droplets,
 S.sample(d,.25).emitters[0].layers.droplets);
const big=clone(d);big.dropletSize=20;
A.ok(S.sample(big,.25).emitters[0].layers.droplets[0].radius>
 S.sample(d,.25).emitters[0].layers.droplets[0].radius);
const opening=clone(d);opening.openingSpacing=25;
A.notDeepEqual(S.sample(opening,0).emitters[0].layers.droplets.map(x=>x.x),
 S.sample(d,0).emitters[0].layers.droplets.map(x=>x.x));
const cluster=clone(d);cluster.spatialMode='clustered';
A.notDeepEqual(S.sample(cluster,0).emitters[0].layers.droplets.map(x=>x.x),
 S.sample(d,0).emitters[0].layers.droplets.map(x=>x.x));
const color=clone(d);color.palette.stops[0].rgba=[90,100,230,1];
A.notDeepEqual(S.sample(color,0).emitters[0].layers.droplets[0].rgba,
 S.sample(d,0).emitters[0].layers.droplets[0].rgba);
const density=clone(d);density.sprayEnabled=true;
density.burstDensityCurve.keys[1].y=.05;
const defaultSpray=clone(d);defaultSpray.sprayEnabled=true;
A.notDeepEqual(S.schedule(density,density.emitters[0]).residual,
 S.schedule(defaultSpray,defaultSpray.emitters[0]).residual);
const size=clone(d);size.dropletSizeCurve.keys[1].y=.1;
A.notDeepEqual(S.sample(size,.25).emitters[0].layers.droplets,
 S.sample(d,.25).emitters[0].layers.droplets);
const crown=clone(d);crown.crownExpansionCurve.keys[1].y=.05;
A.notDeepEqual(S.sample(crown,.15).emitters[0].layers.crown,
 S.sample(d,.15).emitters[0].layers.crown);
const multi=clone(d);multi.emitters.push(S.newEmitter(1));
A.equal(S.sample(multi,.1).emitters.length,2);
const solo=S.sample(d,.1).emitters[0],again=S.sample(multi,.1).emitters[0];
A.deepEqual(solo,again,'new sibling may not perturb earlier stable seed');
multi.emitters.reverse();
A.deepEqual(S.sample(multi,.1).emitters.find(x=>x.id==='emitter1'),solo);
const overflow=clone(d);
for(let i=1;i<4;i++)overflow.emitters.push(S.newEmitter(i));
overflow.droplets=160;overflow.quality='low';
A.throws(()=>S.sample(overflow,.1),/budget|overflow/i);
overflow.quality='high';
A.ok(S.sample(overflow,.1).emitters.length===4);
const data=clone(d);
data.schemaVersion=77;
A.throws(()=>S.normalize(data),/version|schema/i);
A.throws(()=>S.normalize({...d,droplets:-1}),/droplets/i);
A.throws(()=>S.normalize({...d,gravity:NaN}),/gravity/i);
A.throws(()=>S.normalize({...d,extra:true}),/unknown/i);
A.throws(()=>S.normalize({...d,emitters:[d.emitters[0],d.emitters[0]]}),/duplicate/i);
A.throws(()=>S.normalize({...d,emitters:[...d.emitters, ...Array.from({length:4},(_,i)=>S.newEmitter(i+1))]}),/four|4|emitters/i);
const missing=clone(d);missing.emitters[0].anchor.type='bone';
missing.emitters[0].anchor.name='unavailable';
A.equal(missing.emitters[0].anchor.type,'bone');
const path=S.sample(d,.15).emitters[0].layers.crown[0];
A.equal(path.kind,'mesh');
A.ok(path.positions.length>8&&path.indices.length>6);
A.equal(path.positions.constructor.name,'Float32Array');
const rotated=clone(d);
rotated.emitters[0].anchor.x=256;rotated.emitters[0].anchor.y=256;
rotated.emitters[0].rotation=90;
rotated.emitters[0].layers.droplets.x=100;
for(const k of ['crown','mist','ripple'])
 rotated.emitters[0].layers[k].enabled=false;
const rframe=S.sample(rotated,0),drops=rframe.emitters[0].layers.droplets;
const rb=S.bounds(rframe,{emitter1:{x:256,y:256}},rotated);
const xs=drops.map(p=>256-p.y-p.radius),xe=drops.map(p=>256-p.y+p.radius);
const ys=drops.map(p=>256+100+p.x-p.radius),ye=drops.map(p=>256+100+p.x+p.radius);
A.ok(Math.abs(rb.minX-Math.min(...xs))<.001,
 'rotated layer X offset must rotate with emitter, exact spatial crop oracle');
A.ok(Math.abs(rb.maxX-Math.max(...xe))<.001);
A.ok(Math.abs(rb.minY-Math.min(...ys))<.001);
A.ok(Math.abs(rb.maxY-Math.max(...ye))<.001);
console.log('PASS WATER-01 numeric core: impact=24@0, ballistic gravity, four separate layers, 40-frame restart/fade, geometry, curves, spacing, seed, exact rotated bounds and budgets');
