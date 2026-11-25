'use strict';
// GAME-09 H05: actual pinned Pixi/Spine CPU objects; no GPU readback claims.
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/healing-aura/src/';
 const document={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},navigator={userAgent:'Chromium',platform:'Linux'},browser={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')(navigator,document,browser,browser);browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const env={PIXI:P,spine:Sp};
 for(const path of [shared+'curve-core.js',shared+'spacing-core.js',shared+'color-core.js',fx+'healing-core.js',fx+'healing-runtime.js',fx+'healing-authoring.js','assets/shockwave/src/shockwave-spine.js'])new Function('globalThis','module','require',read(path))(env,undefined,undefined);
 const H=env.FxHealing,R=env.FxHealingRuntime,U=env.FxHealingAuthoring,L=env.FxShockwaveSpine;
 const close=(a,b)=>A.ok(Math.abs(a-b)<1e-4,a+' != '+b),views=h=>h.children.flatMap(g=>g.children.flatMap(l=>l.children)),visible=h=>views(h).filter(v=>v.visible);
 const scene=()=>{const camera=new P.Container(),world=new P.Container(),behind=new P.Container(),models=new P.Container(),front=new P.Container();camera.addChild(world);world.addChild(behind,models,front);return {camera,world,behind,models,front};};
 test('actual Pixi mesh pools, all three styles, bounds and ownership',()=>{
  A.equal(P.VERSION,'8.22.0');
  for(const style of ['natural','stylized','magical']){
   const s=scene(),c=H.defaults();c.style=style;c.burstEnabled=true;c.emitters[0].layers.pulse.enabled=true;const foreign=new P.Container();s.front.addChild(foreign);
   const f=R.createHealing({PIXI:P,front:s.front,behind:s.behind,settings:c});
   try{const original=[...views(s.front),...views(s.behind)],allocated=f.stats.allocated;
    A.ok(original.every(v=>v instanceof P.MeshSimple));A.equal(original.length,allocated);
    for(let i=0;i<=240;i++){const frame=f.seek(i/240);A.equal(f.stats.visible,frame.cost);A.ok(frame.cost<=allocated);for(const v of [...visible(s.front),...visible(s.behind)]){A.ok(v.vertices.every(Number.isFinite));A.ok(v.alpha>0&&v.alpha<=1);}}
    A.equal(f.stats.totalCreated,allocated);A.deepEqual(f.seek(0),f.seek(1));
    const b=s.world.getLocalBounds();A.ok(Number.isFinite(b.minX)&&b.maxX>b.minX&&b.maxY>b.minY);
    const off=JSON.parse(JSON.stringify(c));for(const l of Object.values(off.emitters[0].layers))l.enabled=false;f.configure(off);A.equal(f.seek(.4).cost,0);A.equal(f.stats.allocated,0);A.ok(original.every(v=>v.destroyed));f.destroy();A.equal(s.front.children.length,1);A.equal(s.front.children[0],foreign);A.equal(s.behind.children.length,0);
   }finally{f.destroy();s.camera.destroy({children:true});}
  }
 });
 test('actual Spine bone anchor follows pose, camera does not change authoring geometry',()=>{
  const s=scene(),data=new Sp.SkeletonData(),bone=new Sp.BoneData(0,'head',null);bone.x=20;bone.y=30;data.bones.push(bone);const model=new Sp.Spine({skeletonData:data,autoUpdate:false});model.update(0);model.position.set(150,200);model.scale.set(2);model.updateLocalTransform();s.models.addChild(model);
  const c=H.defaults(),e=c.emitters[0];e.x=0;e.y=0;e.anchor={type:'bone',name:'head'};e.layers.motes.anchor={type:'world',name:''};
  const f=R.createHealing({PIXI:P,front:s.front,behind:s.behind,settings:c});
  try{const pose=()=>U.poseMap(L.anchorPoses(model)),p=pose(),first=f.seek(.4,p);const glow=first.emitters[0].layers.glow[0];close(glow.x,p.bones.head.x);close(glow.y,p.bones.head.y);close(glow.radius,170);
   s.camera.position.set(83,-49);s.camera.scale.set(1.7);s.camera.rotation=.4;A.deepEqual(f.seek(.4,pose()),first);
   const b=model.skeleton.findBone('head');b.x+=15;model.skeleton.updateWorldTransform(Sp.Physics.update);const moved=f.seek(.4,pose());close(moved.emitters[0].layers.glow[0].x-glow.x,30);A.deepEqual(moved.emitters[0].layers.motes,first.emitters[0].layers.motes);
   const missing=f.seek(.4,{});A.equal(missing.emitters[0].layers.glow.length,0);A.ok(missing.emitters[0].layers.motes.length>0);A.ok(missing.diagnostics.length>0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('isolated Bezier witness: same schedule and age, changed alpha only',()=>{
  const a=H.defaults(),b=H.defaults();b.alphaCurve.keys[0].mode='bezier';b.alphaCurve.keys[0].out=[.1,0];b.alphaCurve.keys[1].in=[.1,.9];const p=H.compile(a),q=H.compile(b);A.deepEqual(p.schedules,q.schedules);let changed=0;
  for(let i=0;i<60;i++){const x=p.sample(i/60).emitters[0].layers.motes,y=q.sample(i/60).emitters[0].layers.motes;A.equal(x.length,y.length);for(let j=0;j<x.length;j++){A.equal(x[j].id,y[j].id);A.equal(x[j].age,y[j].age);A.equal(x[j].x,y[j].x);A.equal(x[j].y,y[j].y);if(Math.abs(x[j].rgba[3]-y[j].rgba[3])>1e-6)changed++;}}A.ok(changed>0);
 });
 test('240 seeded configurations: finite outputs, cap, exclusive loops and one-shot end',()=>{
  let seed=123;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<240;i++){const c=H.defaults();c.mode=i%2?'loop':'oneShot';c.durationFrames=40+Math.floor(rand()*81);c.lifetimeFrames=1+Math.floor(rand()*c.durationFrames);c.particleRate=rand()*40;c.riseSpeed=rand()*250;c.glowRadius=20+rand()*180;c.spacingPx=5+rand()*25;c.timeJitter=rand()*.4;c.spatialJitter=rand()*.4;c.style=['natural','stylized','magical'][i%3];c.seed=i;c.emitters[0].layers.pulse.enabled=true;const p=H.compile(c);
   for(const t of [0,.017,.19,.42,.81,1.7,3]){const f=p.sample(t);A.ok(f.cost<=p.reserved);for(const l of Object.values(f.emitters[0].layers))for(const v of l)A.ok([v.x,v.y,v.radius,...v.rgba].every(Number.isFinite));}
   if(c.mode==='loop')A.deepEqual(p.sample(0),p.sample(c.durationFrames/60));else A.equal(p.sample((c.durationFrames-1)/60).cost,0);
  }
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
