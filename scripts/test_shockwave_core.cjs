'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../assets/shockwave/src/shockwave-core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const layer=(f,k,e=0)=>f.emitters[e].layers[k];
const flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v;};
test('defaults, rapid expansion, thin edge and blank exact final frame',()=>{
 const c=S.defaults();assert.equal(c.ringCount,1);assert.equal(c.durationFrames,40);
 const at=t=>layer(S.sample(c,t*39/60),'primary')[0];
 close(at(0).radius,0);close(at(.18).radius,112.5);close(at(.65).radius,150);
 assert.ok(at(.65).width<at(.18).width);assert.ok(at(.65).rgba[3]<at(.18).rgba[3]);
 assert.equal(S.sample(c,39/60).cost,0);assert.equal(S.sample(c,10).cost,0);
});
test('secondary births occur at independent exact times; gap does not alter timing',()=>{
 const c=S.defaults();c.ringCount=3;
 assert.deepEqual(S.schedule(c,'emitter1'),[0,5,10]);
 assert.equal(layer(S.sample(c,4/60),'secondary').length,0);
 assert.equal(layer(S.sample(c,5/60),'secondary').length,1);
 c.radialGapPx=50;assert.deepEqual(S.schedule(c,'emitter1'),[0,5,10]);
 close(layer(S.sample(c,5/60),'secondary')[0].radius,50);
 flat(c.intervalCurve,2);assert.deepEqual(S.schedule(c,'emitter1'),[0,10,20]);
});
test('interval jitter and minimum spacing are deterministic, impossible schedules reject',()=>{
 const c=S.defaults();c.ringCount=4;c.timeJitter=.4;c.minIntervalFrames=6;
 const a=S.schedule(c,'emitter1');assert.deepEqual(a,S.schedule(c,'emitter1'));
 assert.ok(a.slice(1).every((v,i)=>v-a[i]>=6-1e-9));
 c.seed++;assert.notDeepEqual(S.schedule(c,'emitter1'),a);
 c.ringDelayFrames=30;assert.throws(()=>S.createPlan(c),/schedule/);
 c.ringDelayFrames=0;c.timeJitter=0;c.minIntervalFrames=0;assert.deepEqual(S.schedule(c,'emitter1'),[0,0,0,0]);
});
test('actual circular arc distances at final radius independent of timestamps',()=>{
 const c=S.defaults();c.emitters[0].layers.particles.enabled=true;c.arcGapPx=20;
 const a=layer(S.sample(c,.45),'particles');assert.ok(a.length>10);
 for(let i=1;i<a.length;i++)close(a[i].distance-a[i-1].distance,20);
 for(const p of a){close(Math.hypot(p.x,p.y),150);close(p.angle,p.distance/150);}
 c.arcGapPx=40;const b=layer(S.sample(c,.45),'particles');assert.ok(b.length<a.length);
 assert.deepEqual(S.schedule(c,'emitter1'),[0]);
 flat(c.arcSpacingCurve,2);const d=layer(S.sample(c,.45),'particles');close(d[1].distance-d[0].distance,80);
});
test('shape stays circular, mesh edge alpha is zero and no camera dimensions enter geometry',()=>{
 const c=S.defaults(),ring=layer(S.sample(c,.2),'primary')[0];
 const m=S.annulus(ring,48);assert.equal(m.positions.length,49*4*2);assert.equal(m.alphas.length,49*4);
 assert.equal(m.indices.length,48*3*6);assert.ok(m.indices.every(i=>i<m.alphas.length));
 for(let i=0;i<49;i++){assert.equal(m.alphas[i*4],0);assert.equal(m.alphas[i*4+3],0);}
 close(Math.hypot(m.positions[6],m.positions[7]),ring.radius+ring.width/2);
 assert.deepEqual(m.positions.slice(0,8),m.positions.slice(-8));
 c.edgeSoftness=0;const hard=S.annulus(layer(S.sample(c,.2),'primary')[0],48);
 assert.notDeepEqual(hard.positions,m.positions);
});
test('layer and emitter offsets, toggles and seeds do not modify siblings',()=>{
 const c=S.defaults();c.ringCount=2;c.emitters[0].layers.particles.enabled=true;c.emitters.push(S.newEmitter(1));
 const a=S.sample(c,.25);c.emitters[0].layers.secondary.timeOffset=15;
 c.emitters[0].layers.particles.x=17;c.emitters[0].layers.particles.seed++;
 const b=S.sample(c,.25);assert.deepEqual(layer(a,'primary'),layer(b,'primary'));
 assert.equal(layer(b,'secondary').length,0);assert.deepEqual(a.emitters[1],b.emitters[1]);
 assert.equal(b.emitters[0].transforms.particles.x,17);
 for(const e of c.emitters)e.enabled=false;assert.equal(S.sample(c,.25).cost,0);
});
test('compiled plan is detached and deterministic across arbitrary seek order',()=>{
 const c=S.defaults(),p=S.createPlan(c),a=p.sample(.1);p.sample(.6);c.finalRadius=300;
 assert.deepEqual(p.sample(.1),a);assert.notDeepEqual(S.sample(c,.1),a);
});
test('strict configuration and preflight bounds',()=>{
 for(const change of [c=>c.finalRadius=NaN,c=>c.startRadius=60,c=>c.durationFrames=41,c=>c.distortion=1,c=>c.ringCount=9,c=>c.extra=true,c=>c.emitters.push(c.emitters[0])]){
  const c=S.defaults();if(change.toString().includes('startRadius'))c.finalRadius=20;change(c);assert.throws(()=>S.createPlan(c));
 }
 const c=S.defaults();c.finalRadius=500;c.arcGapPx=2;c.ringCount=8;c.ringDelayFrames=0;c.emitters[0].layers.particles.enabled=true;
 assert.throws(()=>S.createPlan(c),/budget/);
});

test('independent layer seeds control only their own jittered schedule',()=>{
 const c=S.defaults();c.ringCount=4;c.timeJitter=.4;c.emitters[0].layers.particles.enabled=true;
 c.emitters.push(S.newEmitter(1));const base=S.sample(c,.4);
 const secondary=S.schedule(c,'emitter1'),particles=S.schedule(c,'emitter1','particles');
 c.emitters[0].layers.secondary.seed++;
 const a=S.sample(c,.4);assert.notDeepEqual(S.schedule(c,'emitter1'),secondary);
 assert.deepEqual(S.schedule(c,'emitter1','particles'),particles);
 assert.deepEqual(layer(a,'particles'),layer(base,'particles'));
 assert.deepEqual(layer(a,'primary'),layer(base,'primary'));assert.deepEqual(a.emitters[1],base.emitters[1]);
 c.emitters[0].layers.particles.seed++;
 const b=S.sample(c,.4);assert.notDeepEqual(S.schedule(c,'emitter1','particles'),particles);
 assert.deepEqual(layer(b,'secondary'),layer(a,'secondary'));
 assert.deepEqual(layer(b,'primary'),layer(a,'primary'));assert.deepEqual(b.emitters[1],a.emitters[1]);
 const p=S.createPlan(c);p.sample(.55);assert.deepEqual(p.sample(.4),b);
});
test('zero jitter preserves times and primary is a single initial birth',()=>{
 const c=S.defaults();c.ringCount=3;
 for(const key of ['secondary','particles'])assert.deepEqual(S.schedule(c,'emitter1',key),[0,5,10]);
 assert.deepEqual(S.schedule(c,'emitter1','primary'),[0]);assert.throws(()=>S.schedule(c,'emitter1','unknown'),/layer/);
});
test('even circular distribution avoids near duplicate at wrap seam',()=>{
 const c=S.defaults();c.finalRadius=70.1;c.arcGapPx=22;c.emitters[0].layers.particles.enabled=true;
 const a=layer(S.sample(c,.45),'particles');assert.equal(a.length,20);
 for(let i=1;i<a.length;i++)close(a[i].distance-a[i-1].distance,22);
 assert.ok(2*Math.PI*c.finalRadius-a.at(-1).distance+a[0].distance>=2);
 c.finalRadius=(22*6+2)/(2*Math.PI);const b=layer(S.sample(c,.45),'particles');
 assert.equal(b.length,7);close(2*Math.PI*c.finalRadius-b.at(-1).distance,2);
});
test('discarded even seam candidate does not consume the particle budget',()=>{
 const c=S.defaults();c.finalRadius=512.5/(2*Math.PI);c.arcGapPx=2;c.quality='low';c.emitters[0].layers.particles.enabled=true;
 const p=S.createPlan(c);assert.equal(p.peakParticles,256);
 assert.equal(layer(p.sample(.45),'particles').length,256);
});
