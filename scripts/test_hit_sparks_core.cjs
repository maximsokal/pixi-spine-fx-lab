'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),H=require('../assets/hit-sparks/src/hit-sparks-core.js');
const close=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
const empty={flash:[],primary:[],dust:[]};
const constant=(c,v)=>{c.keys.forEach(k=>{k.y=v;});};
test('issue defaults, JSON roundtrip, immutable compiled snapshot',()=>{
 const d=H.defaults(),p=H.compile(d);
 A.deepEqual([d.burstCount,d.spread,d.initialSpeed,d.sparkLength,d.width,d.durationFrames],[20,170,250,18,2,16]);
 A.deepEqual(H.deserialize(H.serialize(d)),d);d.layers.primary.x=10;A.equal(p.settings.layers.primary.x,0);A.ok(Object.isFrozen(p.meta.timing.primary.events[0]));
});
test('20 simultaneous births at impact, independent dust at frame four',()=>{
 const p=H.compile(H.defaults());A.equal(p.sample(0).primary.length,20);A.equal(p.sample(0).flash.length,1);A.equal(p.sample(0).dust.length,0);A.equal(p.sample(4/60).dust.length,10);
 A.ok(p.meta.timing.primary.events.every(e=>e.time===0));A.ok(p.meta.timing.dust.events.every(e=>e.time===4/60));A.deepEqual(p.sample(39/60),empty);
});
test('zero primary count leaves flash and dust independent',()=>{
 const d=H.defaults();d.burstCount=0;const p=H.compile(d);A.equal(p.sample(0).primary.length,0);A.equal(p.sample(0).flash.length,1);A.equal(p.sample(4/60).dust.length,10);
});
test('stagger uses rate curve, interval mode and min interval',()=>{
 const d=H.defaults();d.staggerFrames=12;const a=H.compile(d);A.equal(a.meta.timing.primary.events.length,20);
 constant(d.curves.burstRate,1);const b=H.compile(d);A.notDeepEqual(a.meta.timing.primary.events,b.meta.timing.primary.events);close(b.meta.timing.primary.events[10].time,.1);
 d.frequencySource='interval';d.curves.burstInterval.keys[1].y=4;const c=H.compile(d);A.notDeepEqual(b.meta.timing.primary.events,c.meta.timing.primary.events);
 d.minInterval=.04;const e=H.compile(d).meta.timing.primary;A.ok(e.rejected>0);e.events.slice(1).forEach((x,i)=>A.ok(x.time-e.events[i].time>=.04-1e-12));
});
test('zero rate yields no births, even in simultaneous mode',()=>{
 const d=H.defaults();constant(d.curves.burstRate,0);const p=H.compile(d);A.equal(p.sample(0).primary.length,0);A.equal(p.meta.timing.primary.rejected,20);A.equal(p.sample(4/60).dust.length,0);
});
test('real distances and temporal/spatial independence',()=>{
 const d=H.defaults(),p=H.compile(d);const ds=p.meta.positions.primary.distances;A.equal(ds.length,20);ds.slice(1).forEach((x,i)=>close(x-ds[i],7));
 d.staggerFrames=12;d.timeJitter=.35;const q=H.compile(d);A.deepEqual(q.meta.positions,p.meta.positions);
 d.spacingCurveEnabled=true;constant(d.curves.spacingPx,14);const r=H.compile(d);A.deepEqual(q.meta.timing,r.meta.timing);A.equal(r.meta.positions.primary.distances.length,10);A.equal(r.meta.positions.primary.reused,10);
 A.equal(r.meta.timing.primary.events.length,20);
});
test('collision normal, world rotation, layer rotation and offset stay separate',()=>{
 const d=H.defaults();d.burstCount=1;d.spread=0;d.layers.primary.x=10;d.layers.primary.rotation=15;d.collisionNormal=30;
 const p=H.compile(d).sample(0,{primary:{x:10,y:20,rotation:90}}).primary[0];close(p.angle,135);close(p.x,10);close(p.y,30);
 A.equal(H.compile(d).sample(0,{}).primary.length,0);
});
test('integrated speed and taper follow path, independent of frame history',()=>{
 const d=H.defaults();d.burstCount=1;d.spread=0;constant(d.curves.sparkSpeed,1);const a=H.compile(d),f=a.sample(8/60).primary[0];close(f.x-256,250*8/60);close(f.y,256);
 close(Math.hypot(f.vertices[0].x-f.vertices[1].x,f.vertices[0].y-f.vertices[1].y),2);
 close(Math.hypot(f.vertices.at(-1).x-f.vertices.at(-2).x,f.vertices.at(-1).y-f.vertices.at(-2).y),0);
 close(f.x-f.vertices.at(-1).x,18);
 const b=H.compile(H.defaults()).sample(8/60).primary[0];close(Math.hypot(b.x-b.origin.x,b.y-b.origin.y),250*8/60*.775);
 a.sample(0);A.deepEqual(a.sample(8/60).primary[0],f);
});
test('layer seed, delay, visibility and blend are independent',()=>{
 const d=H.defaults(),p=H.compile(d);d.layers.primary.seed++;d.layers.primary.blend='add';d.layers.flash.delayFrames=2;const q=H.compile(d);
 A.notDeepEqual(p.sample(0).primary,q.sample(0).primary);A.equal(q.sample(0).primary[0].blend,'add');A.equal(q.sample(0).flash.length,0);A.deepEqual(p.sample(5/60).dust,q.sample(5/60).dust);
 for(const k of H.LAYERS)d.layers[k].enabled=false;A.deepEqual(H.compile(d).sample(5/60),empty);
});
test('RGBA and alpha curve affect only intended layer',()=>{
 const d=H.defaults();d.palettes.primary.stops[0].rgba=[10,20,30,.5];d.layers.primary.opacity=.5;constant(d.curves.alpha,.8);const f=H.compile(d).sample(0);A.deepEqual(f.primary[0].rgba,[10,20,30,.2]);A.deepEqual(f.flash[0].rgba,[255,255,255,.8]);
});
test('strict lifetime, including delayed dust and flash',()=>{
 const d=H.defaults(),p=H.compile(d);A.equal(p.sample(4/60).flash.length,0);A.equal(p.sample(16/60).primary.length,0);A.equal(p.sample(20/60).dust.length,0);
 d.layers.primary.delayFrames=2;const q=H.compile(d);A.equal(q.sample(0).primary.length,0);A.equal(q.sample(2/60).primary.length,20);A.equal(q.sample(18/60).primary.length,0);
});
test('hard caps and finite vertices across extreme settings',()=>{
 const d=H.defaults();Object.assign(d,{burstCount:140,dustCount:70,spread:360,gap:35,sparkLength:80,width:12,initialSpeed:900,flashFrames:120,durationFrames:120});const p=H.compile(d),f=p.sample(5/60);
 A.equal(f.flash.length+f.primary.length+f.dust.length,211);A.ok(f.primary.every(x=>x.vertices.length===18&&x.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y))));
 A.ok(p.meta.positions.primary.reused>0);A.deepEqual(p.sample(5/60),f);
});
test('reject malformed settings, sparse data, domain rebinding and invalid poses',()=>{
 for(const change of [d=>d.schemaVersion=2,d=>d.extra=1,d=>d.burstCount=141,d=>d.width=NaN,d=>{d.minGap=35;d.maxGap=1;},d=>d.curves.burstRate.domain='emitterTime',d=>delete d.curves.widthTaper.keys[1],d=>delete d.palettes.primary.stops[0].rgba[2],d=>d.layers.primary.seed=2.5]){
  const d=H.defaults();change(d);A.throws(()=>H.compile(d));
 }
 A.throws(()=>H.compile(H.defaults()).sample(0,{primary:{x:NaN,y:0,rotation:0}}));A.throws(()=>H.deserialize('x'));
});

test('silent initial rate plateau delays the first staggered birth',()=>{
 const d=H.defaults();d.staggerFrames=60;d.curves.burstRate.keys=[{id:'a',x:0,y:0,mode:'stepped'},{id:'b',x:.5,y:1,mode:'linear'},{id:'c',x:1,y:1,mode:'linear'}];
 const p=H.compile(d);close(p.meta.timing.primary.events[0].time,.5,1/1024);A.equal(p.sample(.49).primary.length,0);
});
test('seeded randomized spacing, stepped and Bezier curves, seek repeatability',()=>{
 const d=H.defaults();d.staggerFrames=6;d.timeJitter=.45;d.spatialMode='random';d.spatialJitter=.45;d.curves.widthTaper.keys[0].mode='bezier';d.curves.widthTaper.keys[0].out=[.2,1];d.curves.widthTaper.keys[1].in=[.4,.6];
 const p=H.compile(d),q=H.compile(H.deserialize(H.serialize(d)));A.deepEqual(p.meta,q.meta);A.deepEqual(p.sample(.1),q.sample(.1));
 for(const k of ['primary','dust']){const ds=p.meta.positions[k].distances;ds.slice(1).forEach((v,i)=>A.ok(v-ds[i]>=d.minGap-1e-8&&v-ds[i]<=d.maxGap+1e-8));}
 d.layers.primary.seed+=17;const z=H.compile(d);A.notDeepEqual(z.meta.timing.primary,p.meta.timing.primary);A.deepEqual(z.meta.timing.dust,p.meta.timing.dust);
});
