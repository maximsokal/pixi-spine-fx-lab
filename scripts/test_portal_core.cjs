'use strict';
const A=require('node:assert/strict'),{test}=require('node:test'),P=require('../assets/magic-portal/src/portal-core.js');
const cp=x=>JSON.parse(JSON.stringify(x)),layers=(p,t)=>p.sample(t).emitters[0].layers,flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v};
test('strict defaults and detached settings',()=>{const c=P.defaults(),p=P.compile(c);A.equal(c.portalRadius,90);A.equal(p.totalRotation,180);A.ok(Math.abs(p.effectiveSpeed-120)<1e-8);A.ok(Object.isFrozen(p.settings));A.deepEqual(P.normalize(cp(c)),c);c.portalRadius=10;A.equal(p.settings.portalRadius,90);A.throws(()=>P.compile(c));});
test('loop exact seam, carries independent ages and signed phase independent of emissions',()=>{const c=P.defaults(),a=P.compile(c);A.deepEqual(a.sample(0),a.sample(2));A.deepEqual(a.sample(.375),a.sample(2.375));A.ok(layers(a,0).particles.length>0);A.ok(new Set(layers(a,.25).particles.map(v=>v.age)).size>1);c.swirlSpeed=-120;const b=P.compile(c);A.equal(b.totalRotation,-180);A.deepEqual(a.emitters[0].births,b.emitters[0].births);A.notDeepEqual(layers(a,.25).aperture,layers(b,.25).aperture);c.swirlSpeed=1;A.equal(P.compile(c).totalRotation,180);c.swirlSpeed=0;A.equal(P.compile(c).totalRotation,0);});
test('one-shot endpoints and unquantized signed rotation',()=>{const c=P.defaults();c.mode='oneShot';c.swirlSpeed=73;const p=P.compile(c);A.equal(p.sample(0).cost,0);A.equal(p.sample(119/60).cost,0);A.equal(p.sample(10).cost,0);A.ok(p.sample(.7).cost>0);A.ok(Math.abs(p.effectiveSpeed-73)<1e-8);});
test('independent layers and missing anchors',()=>{const c=P.defaults(),p=P.compile(c),base=layers(p,.25);c.emitters[0].layers.aperture.enabled=false;const off=layers(P.compile(c),.25);A.equal(off.aperture.length,0);A.deepEqual(base.rim,off.rim);A.deepEqual(base.particles,off.particles);c.emitters[0].layers.rim.anchor={type:'bone',name:'hand'};const q=P.compile(c);A.equal(q.sample(.25).diagnostics.length,1);A.deepEqual(layers(q,.25).particles,base.particles);A.equal(q.sample(.25,{hand:{x:10,y:20,rotation:30,scale:2}}).emitters[0].layers.rim[0].x,10);});
test('arc minimum cyclic gap, independent temporal curves, zero emission',()=>{const c=P.defaults(),a=P.compile(c),r=a.emitters[0].rim,d=r.anchors.map(x=>x.distance);for(let i=1;i<d.length;i++)A.ok(d[i]-d[i-1]>=c.minGapPx-1e-8);A.ok(r.pathLength-d.at(-1)>=c.minGapPx-1e-8);c.particleRate=60;const b=P.compile(c);A.deepEqual(a.emitters[0].rim,b.emitters[0].rim);A.ok(b.emitters[0].births.length>a.emitters[0].births.length);flat(c.rateCurve,0);A.equal(P.compile(c).emitters[0].births.length,0);c.frequencySource='interval';flat(c.intervalCurve,2);A.ok(P.compile(c).emitters[0].births.length>0);});
test('group and resource guards',()=>{const c=P.defaults();c.groupCount=2;c.groupDelayFrames=3;A.throws(()=>P.compile(c),/overlapping/);c.groupDelayFrames=0;A.ok(P.compile(c).emitters[0].births.length>60);c.quality='low';c.emitters.push(P.newEmitter(1),P.newEmitter(2));A.throws(()=>P.compile(c),/budget/);for(const e of c.emitters)e.enabled=false;A.equal(P.compile(c).sample(.25).cost,0);});
test('appearance controls and finite geometry',()=>{for(const [k,v] of [['portalRadius',120],['rimWidth',30],['glow',1.5],['warp',.9],['spacing',25],['seed',3]]){const c=P.defaults(),a=layers(P.compile(c),.25);c[k]=v;const b=layers(P.compile(c),.25);A.notDeepEqual(a,b,k);for(const l of Object.values(b))for(const x of l)A.ok(Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.radius));}});
test('strict curve domain and disabled layer independence',()=>{const c=P.defaults();c.rimCurve.keys.at(-1).y=.1;A.throws(()=>P.compile(c),/seam/);const d=P.defaults();d.emitters[0].layers.particles.enabled=false;d.particleRate=240;d.groupCount=8;A.equal(P.compile(d).emitters[0].births.length,0);A.throws(()=>P.compile({...d,extra:1}));});

test('speed curve integrated, phase continuity and fractional seek replay',()=>{
 const c=P.defaults(),p=P.compile(c),a=layers(p,.4).aperture[0].phaseDegrees;
 flat(c.swirlCurve,1);const q=P.compile(c);A.notDeepEqual(a,layers(q,.4).aperture[0].phaseDegrees);
 const before=layers(p,2-1e-6).aperture[0].phaseDegrees,after=layers(p,1e-6).aperture[0].phaseDegrees;
 A.ok(Math.abs(Math.sin((before-after)*Math.PI/180))<.0001);
 const f=p.sample(.54321);for(let i=119;i>=0;i--)p.sample(i/60);A.deepEqual(p.sample(.54321),f);
});
test('spatial/time jitter, curves and separate emitter seed streams',()=>{
 const c=P.defaults();c.distribution='random';const a=P.compile(c);c.timeJitter=.35;const b=P.compile(c);A.deepEqual(a.emitters[0].rim,b.emitters[0].rim);A.notDeepEqual(a.emitters[0].births,b.emitters[0].births);
 c.spatialJitter=.4;const d=P.compile(c);A.deepEqual(d.emitters[0].births,b.emitters[0].births);A.notDeepEqual(d.emitters[0].rim,b.emitters[0].rim);
 c.emitters.push(P.newEmitter(1));const p=P.compile(c);c.emitters[0].seed++;const q=P.compile(c);A.deepEqual(p.sample(.5).emitters[1],q.sample(.5).emitters[1]);
});
test('aperture curve affects one-shot independently of swirl, rim width curve affects runes',()=>{
 const c=P.defaults();c.mode='oneShot';const a=P.compile(c);c.apertureCurve.keys[1].y=.4;const b=P.compile(c);A.notDeepEqual(layers(a,.2),layers(b,.2));A.deepEqual(a.emitters[0].births,b.emitters[0].births);
 const d=P.defaults(),x=P.compile(d);flat(d.rimCurve,.4);const y=P.compile(d);A.notDeepEqual(layers(x,.4).rim,layers(y,.4).rim);A.deepEqual(layers(x,.4).aperture,layers(y,.4).aperture);A.deepEqual(layers(x,.4).particles,layers(y,.4).particles);
});

test('invalid composed anchors hide dependent layers, preserve world layers and recover',()=>{
 const c=P.defaults(),e=c.emitters[0];e.anchor={type:'bone',name:'hip'};e.layers.rim.anchor={type:'world',name:''};e.layers.rim.x=100;e.layers.rim.y=100;
 const p=P.compile(c),world=p.sample(.25).emitters[0].layers.rim;
 for(const scale of [1e308,1e-300]){
  const s=p.sample(.25,{hip:{x:0,y:0,rotation:0,scale}}),l=s.emitters[0].layers;
  A.equal(l.aperture.length,0);A.equal(l.particles.length,0);A.deepEqual(l.rim,world);
  A.deepEqual(s.diagnostics.map(d=>d.layer),['aperture','particles']);
 }
 const good=p.sample(.25,{hip:{x:10,y:20,rotation:30,scale:2}});
 A.equal(good.diagnostics.length,0);A.equal(good.emitters[0].layers.aperture[0].radius,180);A.deepEqual(good.emitters[0].layers.rim,world);
});
test('finite anchor transform whose derived extent overflows is not rendered',()=>{
 const c=P.defaults(),e=c.emitters[0];e.layers.aperture.anchor={type:'bone',name:'hip'};
 const p=P.compile(c),s=p.sample(.25,{hip:{x:0,y:0,rotation:0,scale:1e307}});
 A.equal(s.emitters[0].layers.aperture.length,0);
 A.deepEqual(s.diagnostics.map(d=>d.layer),['aperture']);
 A.ok(s.emitters[0].layers.rim.length>0);A.ok(s.emitters[0].layers.particles.length>0);
});

test('rim seam rejects hidden default-clamp and stepped endpoint jumps',()=>{
 const c=P.defaults();c.rimCurve.clamp='default';c.rimCurve.keys.at(-1).y=.1;A.throws(()=>P.compile(c),/seam/);
 const d=P.defaults();d.rimCurve.keys[1].mode='stepped';A.throws(()=>P.compile(d),/seam/);
 const e=P.defaults();e.rimCurve.clamp='default';e.rimCurve.keys[0].y=.7;A.throws(()=>P.compile(e),/seam/);
 const f=P.defaults();f.rimCurve.clamp='default';A.doesNotThrow(()=>P.compile(f));
});
