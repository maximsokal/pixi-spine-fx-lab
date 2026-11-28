'use strict';
function run(read,A,T){
 const b='assets/template/',g={};
 for(const p of ['src/motion-core.js','src/motion-spine42.js'])new Function('globalThis',read(b+p))(g);
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(b+'vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(b+'vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const rig={skeleton:{spine:'4.2.43'},bones:[{name:'root'}],slots:[{name:'fx',bone:'root'},{name:'other',bone:'root'}],skins:[{name:'default'}]};
 const target=new Sp.SkeletonJson({}).readSkeletonData(rig),M=g.FxMotionSpine42;
 const cfg=(p={})=>({schemaVersion:1,type:'pulse',durationFrames:60,center:.5,amplitude:.4,cycles:5,phaseCycles:.137,...p});
 const opts=(p={})=>({runtimeVersion:'4.2.120',slotName:'fx',tolerance:.001,protectedSeconds:[],...p});
 const convert=(c=cfg(),o=opts(),t=target)=>M.convert(c,o,Sp,t);
 function roundTrip(result,c,o=opts(),steps=16384){
  const parsed=new Sp.SkeletonJson({}).readSkeletonData(JSON.parse(JSON.stringify({...rig,animations:{motion:result.fragment}}))),a=parsed.findAnimation('motion'),sk=new Sp.Skeleton(parsed);
  const d=c.durationFrames/60,expected=t=>c.center+c.amplitude*Math.cos(2*Math.PI*(c.cycles*t/d+c.phaseCycles));
  let error=0;const sample=(t,loop=false)=>{a.apply(sk,0,t,loop,null,1,Sp.MixBlend.setup,Sp.MixDirection.mixIn);A.equal(sk.slots[1].color.a,1);const v=sk.slots[0].color.a;A.ok(v>=0&&v<=1);return v;};
  for(let i=0;i<=steps;i++){const t=d*i/steps;error=Math.max(error,Math.abs(sample(t)-expected(t)));}
  A.ok(error<=o.tolerance);A.ok(error<=result.diagnostics.errorBound);
  A.ok(Math.abs(sample(0)-sample(a.duration))<=o.tolerance);
  const at=d*.137;A.ok(Math.abs(sample(at)-sample(a.duration+at,true))<=1e-10);
  A.equal(a.duration,result.diagnostics.runtimeDurationSeconds);
  return error;
 }
 T('eight previous Spine runtime tolerance failures now pass independent dense alpha oracle',()=>{
  A.equal(P.VERSION,'8.22.0');
  for(const durationFrames of [6,60,119,3600])for(const phaseCycles of [0,.137]){
   const c=cfg({durationFrames,phaseCycles}),r=convert(c);
   A.ok(r.diagnostics.keyCount<=256);A.ok(r.diagnostics.errorBound<=.001);A.ok(r.diagnostics.measuredMaxError<=r.diagnostics.errorBound);
   A.equal(r.diagnostics.measuredSamples,4097);roundTrip(r,c);
  }
 });
 T('full alpha range and phase seam survive Float32 runtime representation',()=>{
  for(const durationFrames of [6,60,119,3600])for(const phaseCycles of [0,.137,.5]){
   const c=cfg({durationFrames,phaseCycles,amplitude:.5}),r=convert(c),keys=r.fragment.slots.fx.alpha;
   A.ok(keys.some(k=>k.value===0));A.ok(keys.some(k=>k.value===1));A.equal(keys[0].value,keys.at(-1).value);
   for(const k of keys)if(k.curve){A.ok(k.curve[1]>=0&&k.curve[1]<=1);A.ok(k.curve[3]>=0&&k.curve[3]<=1);}
   roundTrip(r,c,opts(),2048);
  }
 });
 T('constant alpha, protected fractional times, separate source and runtime duration',()=>{
  const c=cfg({durationFrames:119,center:.3,amplitude:0}),o=opts({protectedSeconds:[.456789,.12,.12]}),r=convert(c,o),keys=r.fragment.slots.fx.alpha;
  A.deepEqual(keys.map(k=>k.time),[0,.12,.456789,119/60]);A.ok(keys.every(k=>k.value===.3&&!Object.hasOwn(k,'curve')));
  A.deepEqual(r.diagnostics.protectedSeconds,keys.map(k=>k.time));A.notEqual(r.diagnostics.runtimeDurationSeconds,r.diagnostics.durationSeconds);roundTrip(r,c,o,2048);
 });
 T('explicit target, version, range, shape, and time validation',()=>{
  for(const patch of [{runtimeVersion:'4.3.0'},{slotName:'missing'},{slotName:'constructor'},{tolerance:0},{tolerance:NaN},{protectedSeconds:[-1]},{protectedSeconds:[1.01]},{protectedSeconds:Array(2)},{extra:1}])A.throws(()=>convert(cfg(),opts(patch)));
  for(const patch of [{center:.2,amplitude:.4},{center:.9},{cycles:0},{phaseCycles:1},{type:'spring'}])A.throws(()=>convert(cfg(patch)));
  A.throws(()=>convert(cfg(),opts(),{}));const wrong=new Sp.SkeletonJson({}).readSkeletonData(rig);wrong.version='4.3.0';A.throws(()=>convert(cfg(),opts(),wrong));
  A.throws(()=>convert(cfg(),opts({protectedSeconds:[.2,.2+1e-12]})),/Float32 key time collapse/);
  A.throws(()=>convert(cfg({cycles:20}),opts({tolerance:1e-12})),/budget|collapse/);
  A.throws(()=>convert(cfg(),opts({protectedSeconds:Array.from({length:257},(_,i)=>i/256)})),/protected seconds/);
 });
 T('determinism, protected keys, no mutation of source rig or input',()=>{
  const c=cfg(),o=opts({protectedSeconds:[.314159,.271828]}),before=JSON.stringify([c,o]),slot=target.findSlot('fx'),a=convert(c,o),b=convert(c,o);
  A.deepEqual(a,b);A.equal(JSON.stringify([c,o]),before);A.equal(target.findSlot('fx'),slot);A.equal(target.animations.length,0);
  A.ok(a.fragment.slots.fx.alpha.some(k=>k.time===.314159));A.ok(a.fragment.slots.fx.alpha.some(k=>k.time===.271828));roundTrip(a,c,o,2048);
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
