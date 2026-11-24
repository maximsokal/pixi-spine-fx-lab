'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const L=require('../assets/loot-sparkle/src/loot-core.js');
const close=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
const stars=(f,i=0)=>f.emitters[i].layers.stars;
const flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v;};
test('strict defaults, detached compile and JSON restore',()=>{
 const c=L.defaults(),p=L.compile(c);
 A.equal(c.durationFrames,40);A.equal(c.sparkleCount,12);
 A.deepEqual(L.normalize(JSON.parse(JSON.stringify(c))),c);
 A.ok(Object.isFrozen(p.settings));c.sparkleSize=16;
 A.equal(p.settings.sparkleSize,8);
 for(const edit of [x=>x.extra=1,x=>x.sparkleSize=NaN,x=>x.sparkleCount=81,x=>x.emitters=[],x=>x.emitters.push(x.emitters[0]),x=>x.mode='bad',x=>x.durationFrames=0,x=>x.sizeCurve.domain='effectTime']){const x=L.defaults();edit(x);A.throws(()=>L.compile(x));}
});
test('pulse independent ages and transparent endpoint',()=>{
 const c=L.defaults(),p=L.compile(c);
 const f=p.sample(17/60);A.ok(stars(f).length>=2);
 A.ok(new Set(stars(f).map(x=>x.age)).size>=2);
 A.equal(p.sample(39/60).cost,0);A.equal(p.sample(50/60).cost,0);
 A.deepEqual(p.sample(17/60),f);A.ok(stars(f).every(x=>x.points.length===8));
});
test('idle loop wraps carried particles, exact seam and rate-independent seeks',()=>{
 const c=L.defaults();c.mode='idle';c.durationFrames=60;const p=L.compile(c);
 A.deepEqual(p.sample(0),p.sample(1));A.ok(stars(p.sample(0)).length>0);
 for(const fps of [30,60,120]){for(let i=0;i<fps;i++)p.sample(i/fps);A.deepEqual(p.sample(.5),p.sample(1.5));}
 const f=p.sample(.375);p.sample(.9);A.deepEqual(p.sample(.375),f);
});
test('time interval and twinkle do not move independent spatial candidates',()=>{
 const c=L.defaults(),a=L.compile(c);c.spawnIntervalFrames=3;const b=L.compile(c);
 A.notDeepEqual(a.emitters[0].births,b.emitters[0].births);
 A.deepEqual(a.emitters[0].anchors,b.emitters[0].anchors);
 c.twinkleHz=10;const p=L.compile(c);A.deepEqual(b.emitters,p.emitters);
 A.notDeepEqual(stars(b.sample(.25)),stars(p.sample(.25)));
});
test('curve driven timing, spatial gap and cyclic seam',()=>{
 const c=L.defaults();c.distribution='random';c.spatialJitter=.4;
 const p=L.compile(c),row=p.emitters[0];A.ok(row.anchors.length>1);
 const d=row.anchors.map(a=>a.distance).sort((a,b)=>a-b);
 for(let i=1;i<d.length;i++)A.ok(d[i]-d[i-1]>=c.minGapPx-1e-8);
 A.ok(row.pathLength-d.at(-1)+d[0]>=c.minGapPx-1e-8);
 close(row.pathLength,2*Math.PI*c.spreadRadius,.25);
 flat(c.intervalCurve,2);const slow=L.compile(c);A.ok(slow.emitters[0].births.length<row.births.length);
 flat(c.spacingCurve,36);const sparse=L.compile(c);A.ok(sparse.emitters[0].anchors.length<row.anchors.length);
 c.spreadRadius=5;c.minGapPx=90;const tiny=L.compile(c);A.equal(tiny.emitters[0].anchors.length,1);
});
test('cap changes active count under load, group births and quality overflow',()=>{
 const c=L.defaults();c.spawnIntervalFrames=1;c.sparkleCount=2;const a=L.compile(c);
 c.sparkleCount=10;const b=L.compile(c);A.equal(stars(a.sample(.25)).length,2);A.ok(stars(b.sample(.25)).length>2);
 c.groupCount=3;c.groupDelayFrames=0;const g=L.compile(c);A.ok(g.emitters[0].births.length>b.emitters[0].births.length);
 c.quality='low';c.sparkleCount=80;c.emitters.push(L.newEmitter(1),L.newEmitter(2),L.newEmitter(3));A.throws(()=>L.compile(c),/budget/);
});
test('seed, size, alpha, palette and layer independence',()=>{
 const c=L.defaults();c.emitters[0].layers.halo.enabled=true;c.emitters[0].layers.sweep.enabled=true;
 const a=L.compile(c).sample(.25);A.ok(a.emitters[0].layers.halo.length&&a.emitters[0].layers.sweep.length);
 c.emitters[0].layers.halo.seed++;c.emitters[0].layers.halo.x=20;
 const b=L.compile(c).sample(.25);A.deepEqual(stars(a),stars(b));A.deepEqual(a.emitters[0].layers.sweep,b.emitters[0].layers.sweep);A.notDeepEqual(a.emitters[0].layers.halo,b.emitters[0].layers.halo);
 c.emitters[0].layers.stars.seed++;const changed=L.compile(c).sample(.25);A.notDeepEqual(stars(b),stars(changed));
 c.sparkleSize=16;const bigger=L.compile(c).sample(.25);A.ok(stars(bigger)[0].radius>stars(changed)[0].radius);
 c.palette.stops.forEach(s=>s.rgba=[1,2,3,1]);A.deepEqual(stars(L.compile(c).sample(.25))[0].rgba.slice(0,3),[1,2,3]);
 flat(c.alphaCurve,0);A.equal(stars(L.compile(c).sample(.25)).length,0);
 for(const l of Object.values(c.emitters[0].layers))l.enabled=false;A.equal(L.compile(c).sample(.25).cost,0);
});
test('transforms and missing bone hide only dependent layer',()=>{
 const c=L.defaults(),p=L.compile(c),a=p.sample(.25);
 c.emitters[0].x+=30;c.emitters[0].layers.stars.y=20;const b=L.compile(c).sample(.25);
 close(stars(b)[0].x-stars(a)[0].x,30);close(stars(b)[0].y-stars(a)[0].y,20);
 c.emitters[0].layers.halo.enabled=true;c.emitters[0].layers.stars.anchor={type:'bone',name:'hand'};
 const q=L.compile(c),missing=q.sample(.25);A.equal(stars(missing).length,0);A.ok(missing.emitters[0].layers.halo.length);A.equal(missing.diagnostics.length,1);
 const found=q.sample(.25,{hand:{x:256,y:256,rotation:0,scale:1}});A.ok(stars(found).length);A.ok(L.bounds(found).inside);
});
test('active budget and group overlap guards; inactive settings preserved',()=>{
 const c=L.defaults();c.groupCount=2;c.groupDelayFrames=7;A.throws(()=>L.compile(c),/overlapping/);
 c.emitters[0].layers.stars.enabled=false;A.equal(L.compile(c).sample(.25).cost,0);
 c.emitters[0].layers.stars.enabled=true;c.groupDelayFrames=0;
 c.frequencySource='rate';flat(c.rateCurve,0);A.equal(L.compile(c).emitters[0].births.length,0);
 c.mode='idle';c.durationFrames=60;flat(c.rateCurve,1);c.haloCurve.keys.at(-1).y=.2;A.throws(()=>L.compile(c),/seam/);
});
test('bounds, transform scale, delay, finite geometry and separate emitters',()=>{
 const c=L.defaults();c.emitters.push(L.newEmitter(1));const a=L.compile(c).sample(.25);
 c.emitters[0].scale=2;c.emitters[0].layers.stars.timeOffset=60;
 const b=L.compile(c).sample(.25);A.equal(stars(b).length,0);A.deepEqual(stars(a,1),stars(b,1));
 c.emitters[0].layers.stars.timeOffset=0;c.emitters[0].x=900;const f=L.compile(c).sample(.25);
 A.equal(L.bounds(f).inside,false);A.ok(stars(f).every(s=>s.points.flat().every(Number.isFinite)));
 A.equal(L.bounds(L.compile(c).sample(39/60)).empty,true);
});
test('cap must reserve lifetimes instead of killing or resurrecting stars midlife',()=>{
 for(const mode of ['pickup','idle']){
  const c=L.defaults();c.mode=mode;c.durationFrames=mode==='idle'?60:40;c.spawnIntervalFrames=1;c.sparkleCount=2;
  const p=L.compile(c),seen=new Map();
  let previous=new Map();
  for(let i=0;i<c.durationFrames*12;i++){
   const frame=i/12,current=new Map(stars(p.sample(frame/60)).map(v=>[v.id,v]));
   A.ok(current.size<=2);
   for(const [id,v] of previous){
    if(!current.has(id)&&frame<c.durationFrames-1){
     A.ok(v.age+1/12>=c.lifetimeFrames-1e-7,'premature death '+mode+' '+id+' age '+v.age);

    }
   }
   for(const [id,v] of current){
    if(!previous.has(id)&&seen.has(id)&&v.age>1/12+1e-6)A.fail('resurrection '+id);
    seen.set(id,v);
   }
   previous=current;
  }
  A.ok(seen.size>2);
 }
});
test('independent finite sweep geometry and editable durations',()=>{
 const c=L.defaults();c.durationFrames=48;c.emitters[0].layers.sweep.enabled=true;c.haloRadius=0;
 const p=L.compile(c),s=p.sample(.25).emitters[0].layers.sweep[0];
 A.ok(s&&Array.isArray(s.points)&&s.points.length>=4);
 for(const [x,y] of s.points)A.ok(Math.hypot(x-256,y-256)<=c.spreadRadius+1e-7);
 A.equal(p.sample(47/60).cost,0);
 const loop=L.defaults();loop.mode='idle';loop.durationFrames=41;
 const l=L.compile(loop);A.deepEqual(l.sample(0),l.sample(41/60));A.deepEqual(l.sample(0),l.sample(410/60));
});
