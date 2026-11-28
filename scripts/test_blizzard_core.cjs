'use strict';
function run(read,A,T){
 const g={};for(const p of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/blizzard/src/blizzard-core.js'])new Function('globalThis',read(p))(g);
 const B=g.FxBlizzard,C=g.FxCurves,clone=o=>JSON.parse(JSON.stringify(o)),layer=(f,k)=>f.emitters[0].layers.find(l=>l.id===k),curve=(c,v)=>C.normalize({...c,defaultValue:v,keys:[{id:'a',x:0,y:v,mode:'linear'},{id:'b',x:1,y:v,mode:'linear'}]});
 const close=(a,b,e=1e-8)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 T('defaults and strict normalized document',()=>{
  const d=B.defaults(),p=B.createPlan(d);A.equal(d.particleRate,75);A.equal(d.windSpeed,200);A.equal(d.streakLength,20);A.equal(d.angle,35);A.equal(p.period,1);A.ok(Object.isFrozen(p.settings.emitters[0].layers));A.deepEqual(B.normalize(clone(d)),d);
  for(const edit of [c=>c.windSpeed=NaN,c=>c.angle=91,c=>c.density=-1,c=>c.spatialJitter=.66,c=>c.durationFrames=41,c=>c.extra=1,c=>delete c.palette,c=>c.emitters.push(clone(c.emitters[0])),c=>c.emitters[0].layers.whiteout.anchor.type='bone',c=>c.driftSpeedCurve.domain='effectTime']){const c=clone(d);edit(c);A.throws(()=>B.createPlan(c));}
 });
 T('shared rate and spatial schedules independent; cell jitter bounded',()=>{
  const d=B.defaults(),p=B.schedule(d,'emitter1');A.equal(p.events.length,94);
  const rate=clone(d);rate.emissionRateCurve=curve(rate.emissionRateCurve,1);const r=B.schedule(rate,'emitter1');A.equal(r.events.length,75);A.deepEqual(r.launchDistances,p.launchDistances);A.ok(r.events.some((e,i)=>e.time!==p.events[i].time));
  for(const mode of ['even','random','clustered','stratified'])for(const gap of [1,8,75]){
   const c={...d,spatialMode:mode,nearGapPx:gap,spatialJitter:0},base=B.schedule(c,'emitter1'),jitter=B.schedule({...c,spatialJitter:.65},'emitter1');
   A.deepEqual(base.events.map(e=>e.time),jitter.events.map(e=>e.time));A.ok(base.launchDistances.length>0);A.equal(base.launchDistances.length,jitter.launchDistances.length);
   for(let i=0;i<base.launchDistances.length;i++){const x=base.launchDistances[i],v=jitter.launchDistances[i],half=Math.min(x-(base.launchDistances[i-1]??0),(base.launchDistances[i+1]??864)-x)/2;A.ok(Math.abs(v-x)<=half*.65+1e-8);if(i)A.ok(v>jitter.launchDistances[i-1]);}
  }
  const gap=B.schedule({...d,nearGapPx:17},'emitter1');A.deepEqual(p.events.map(e=>e.time),gap.events.map(e=>e.time));A.ok(gap.events.some((e,i)=>e.cross!==p.events[i].cross));
 });
 T('independent periodic age oracle, seam, seek and stable sample',()=>{
  for(const frames of [60,600,960]){
   const d={...B.defaults(),durationFrames:frames},p=B.createPlan(d),s=B.schedule(d,'emitter1');
   A.deepEqual(p.sample(0),p.sample(p.period));A.ok(p.sample(0).cost>0);const first=p.sample(.37);p.sample(8.4);p.sample(.12);A.deepEqual(p.sample(.37),first);
   for(let f=0;f<=60;f++){const t=p.period*f/60,q=p.sample(t);for(const [k,life] of [['streaks',3],['foreground',1.2]]){
    const want=[];for(let cy=-5;cy<=0;cy++)for(const e of s.events){const age=q.time-e.time-cy*p.period;if(e.layer===k&&age>=0&&age<life)want.push([e.id,cy,age]);}
    const got=layer(q,k).particles;A.equal(got.length,want.length);for(let i=0;i<want.length;i++){A.equal(got[i].id,want[i][0]);A.equal(got[i].cycle,want[i][1]);close(got[i].age,want[i][2]);}
   }A.ok(q.cost<=p.peakUpperBound);}
  }
 });
 T('motion matches independent constant velocity and drift scaling, zero speed finite',()=>{
  const d=B.defaults();d.windVariance=0;d.angle=0;d.driftSpeedCurve=curve(d.driftSpeedCurve,1);
  for(const speed of [0,200,900]){
   const p=B.createPlan({...d,windSpeed:speed}),a=layer(p.sample(.2),'streaks').particles,b=layer(p.sample(.25),'streaks').particles;
   let n=0;for(const x of a){const y=b.find(y=>y.id===x.id&&y.cycle===x.cycle);if(!y)continue;const dx=((y.x-x.x+432)%864+864)%864-432;close(dx,speed*.05,1e-7);close(y.y,x.y);n++;}A.ok(n>0);
  }
  const p=B.createPlan(d),q=B.createPlan({...d,driftSpeedCurve:curve(d.driftSpeedCurve,2)}),a=layer(p.sample(.2),'streaks').particles,b=layer(q.sample(.2),'streaks').particles;
  A.ok(a.some((v,i)=>Math.abs(v.x-b[i].x)>1));A.deepEqual(a.map(v=>v.age),b.map(v=>v.age));
 });
 T('causal one-shot and last frame transparent, no wrapped birth',()=>{
  const d={...B.defaults(),mode:'oneShot',durationFrames:40,exportFrames:40},p=B.createPlan(d);
  A.equal(p.sample(0).cost,0);A.ok(p.sample(.3).cost>0);A.ok(layer(p.sample(.3),'streaks').particles.every(x=>x.cycle===0&&x.age<=.3));A.equal(p.sample(39/60).cost,0);A.equal(B.bounds(p.sample(100)),null);
  d.emitters[0].layers.whiteout.enabled=true;A.ok(layer(B.createPlan(d).sample(.2),'whiteout').whiteout.rgba[3]>0);A.equal(B.createPlan(d).sample(39/60).cost,0);
 });
 T('negative and positive one-shot offsets respect local and global terminal fade',()=>{
  const d={...B.defaults(),mode:'oneShot',durationFrames:40};d.whiteoutAlphaCurve=curve(d.whiteoutAlphaCurve,.5);d.emitters[0].layers.whiteout.enabled=true;
  for(const offset of [-12,0,12]){
   const c=clone(d);c.emitters[0].layers.whiteout.timeOffset=offset;const p=B.createPlan(c);
   for(let f=0;f<=39;f++){const time=f/60,local=time-offset/60,fade=Math.max(0,Math.min(1,(39-f)/9,(39-f+offset)/9));const want=local>=0&&local<39/60?.5*fade:0;close(layer(p.sample(time),'whiteout').whiteout?.rgba[3]??0,want);}
  }
 });
 T('independent layers, seed, offsets, transform and zero births',()=>{
  const d=B.defaults(),p=B.createPlan(d),a=p.sample(.35),e=clone(d);e.emitters[0].layers.foreground.enabled=false;e.emitters[0].layers.whiteout.enabled=true;const b=B.createPlan(e).sample(.35);
  A.deepEqual(layer(a,'streaks'),layer(b,'streaks'));A.equal(layer(b,'foreground').particles.length,0);A.ok(layer(b,'whiteout').whiteout);
  const c=clone(d);c.emitters[0].layers.foreground.seed++;c.emitters[0].layers.foreground.x=20;c.emitters[0].layers.foreground.timeOffset=3;const v=B.createPlan(c).sample(.35);A.deepEqual(layer(v,'streaks'),layer(a,'streaks'));A.equal(layer(v,'foreground').transform.x,20);A.ok(JSON.stringify(layer(v,'foreground').particles)!==JSON.stringify(layer(a,'foreground').particles));
  for(const patch of [{particleRate:0},{density:0}]){const z=B.createPlan({...e,...patch}).sample(.35);A.equal(z.cost,1);A.equal(layer(z,'streaks').particles.length,0);}
  const off=clone(d);off.emitters[0].visible=false;A.equal(B.createPlan(off).sample(.2).cost,0);A.equal(B.bounds(B.createPlan(off).sample(.2)),null);
 });
 T('budget guard and scenic loops count simultaneous occupancy',()=>{
  const d=B.defaults();for(const frames of [60,600,960]){
   const p=B.createPlan({...d,durationFrames:frames,quality:'low'});A.ok(p.peakUpperBound<=512);for(let i=0;i<121;i++)A.ok(p.sample(p.period*i/120).cost<=p.peakUpperBound);
  }
  A.throws(()=>B.createPlan({...d,particleRate:400,quality:'low'}));A.throws(()=>B.createPlan({...d,particleRate:400,durationFrames:960}));
  const m=clone(d);m.quality='low';m.emitters.push(B.newEmitter(1),B.newEmitter(2));A.throws(()=>B.createPlan(m));
 });
 T('visible support, finite color and dimensions at extreme angle and wind',()=>{
  for(const angle of [-90,-45,0,35,45,90]){
   const p=B.createPlan({...B.defaults(),angle,windSpeed:900,windVariance:1,streakLength:90,spatialJitter:.65});for(let f=0;f<15;f++){const q=p.sample(f/60);for(const l of q.emitters[0].layers)for(const x of l.particles){A.ok([x.x,x.y,x.length,x.width,x.rotation,...x.rgba].every(Number.isFinite));A.ok(x.rgba[3]>=0&&x.rgba[3]<=1);if(x.rgba[3]>0)A.ok(Math.max(Math.abs(x.x),Math.abs(x.y))+Math.hypot(x.length,x.width)/2<=256+1e-9);}
   const b=B.bounds(q);if(b)A.ok(b.width<=512+1e-9&&b.height<=512+1e-9);}
  }
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
