'use strict';
// GAME-10 P02: actual pinned Pixi and Spine CPU objects, not GPU evidence.
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/poison-cloud/src/';
 const document={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},navigator={userAgent:'Chromium',platform:'Linux'},browser={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')(navigator,document,browser,browser);browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const env={PIXI:P,spine:Sp};
 for(const path of [shared+'curve-core.js',shared+'spacing-core.js',shared+'color-core.js',fx+'poison-core.js',fx+'poison-runtime.js','assets/shockwave/src/shockwave-spine.js'])new Function('globalThis','module','require',read(path))(env,undefined,undefined);
 const C=env.FxPoison,R=env.FxPoisonRuntime,L=env.FxShockwaveSpine;
 const near=(a,b)=>A.ok(Math.abs(a-b)<1e-4,a+' != '+b),views=h=>h.children.flatMap(g=>g.children.flatMap(l=>l.children)),visible=h=>views(h).filter(v=>v.visible);
 const scene=()=>{const camera=new P.Container(),world=new P.Container(),behind=new P.Container(),models=new P.Container(),front=new P.Container();camera.addChild(world);world.addChild(behind,models,front);return {camera,world,behind,models,front};};
 test('real Pixi buffers, 3 styles x 2 particle modes, exact seam and disposal',()=>{
  A.equal(P.VERSION,'8.22.0');
  for(const style of ['natural','stylized','magical'])for(const particleMode of ['spore','bubble']){
   const s=scene(),c=C.defaults();c.style=style;c.particleMode=particleMode;c.burstEnabled=true;c.emitters[0].layers.edge.enabled=true;
   const foreign=new P.Container();s.front.addChild(foreign);const f=R.createPoison({PIXI:P,front:s.front,behind:s.behind,settings:c});
   try{const initial=[...views(s.front),...views(s.behind)],allocated=f.stats.allocated;A.ok(initial.every(v=>v instanceof P.MeshSimple));A.equal(initial.length,allocated);const texture=initial[0].texture;
    A.equal(texture.source.alphaMode,'premultiplied-alpha');A.ok(initial.every(v=>v.texture===texture));
    const buffers=initial.map(v=>v.geometry.getBuffer('aPosition'));const arrays=initial.map(v=>v.vertices);
    for(let i=0;i<=240;i++){const frame=f.seek(i*1.25/240);A.equal(f.stats.visible,frame.cost);A.ok(frame.cost<=allocated);for(const v of [...visible(s.front),...visible(s.behind)]){A.ok(v.vertices.every(Number.isFinite));A.ok(v.alpha>0&&v.alpha<=1);}}
    A.equal(f.stats.totalCreated,allocated);initial.forEach((v,i)=>{A.equal(v.geometry.getBuffer('aPosition'),buffers[i]);A.equal(v.vertices,arrays[i]);});
    const first=f.seek(0),xy=initial.map(v=>[...v.vertices]);A.deepEqual(f.seek(1.25),first);A.deepEqual(initial.map(v=>[...v.vertices]),xy);
    const b=s.world.getLocalBounds();A.ok(Number.isFinite(b.minX)&&b.maxX>b.minX&&b.maxY>b.minY);
    const off=JSON.parse(JSON.stringify(c));for(const l of Object.values(off.emitters[0].layers))l.enabled=false;f.configure(off);A.equal(f.seek(.4).cost,0);A.equal(f.stats.allocated,0);A.ok(initial.every(v=>v.destroyed));f.destroy();A.equal(s.front.children.length,1);A.equal(s.front.children[0],foreign);A.equal(s.behind.children.length,0);A.ok(texture.destroyed);
   }finally{f.destroy();s.camera.destroy({children:true});}
  }
 });
 test('real Spine pose changes fog geometry but not independent world spores or camera',()=>{
  const s=scene(),data=new Sp.SkeletonData(),bone=new Sp.BoneData(0,'head',null);bone.x=20;bone.y=30;data.bones.push(bone);const model=new Sp.Spine({skeletonData:data,autoUpdate:false});model.update(0);model.position.set(150,200);model.scale.set(2);model.updateLocalTransform();s.models.addChild(model);
  const c=C.defaults(),e=c.emitters[0];e.x=0;e.y=0;e.anchor={type:'bone',name:'head'};e.layers.spores.anchor={type:'world',name:''};
  const f=R.createPoison({PIXI:P,front:s.front,behind:s.behind,settings:c});
  try{const pose=()=>{const m=L.anchorPoses(model),{$local,...bones}=m;return {local:$local,bones};};const first=f.seek(.4,pose()),fog=first.emitters[0].layers.fog[0],xy=[...visible(s.behind)[0].vertices];
   s.camera.position.set(83,-49);s.camera.scale.set(1.7);s.camera.rotation=.4;A.deepEqual(f.seek(.4,pose()),first);A.deepEqual([...visible(s.behind)[0].vertices],xy);
   const b=model.skeleton.findBone('head');b.x+=15;model.skeleton.updateWorldTransform(Sp.Physics.update);const moved=f.seek(.4,pose());near(moved.emitters[0].layers.fog[0].x-fog.x,30);A.deepEqual(moved.emitters[0].layers.spores,first.emitters[0].layers.spores);near(visible(s.behind)[0].vertices[0]-xy[0],30);
   const missing=f.seek(.4,{});A.equal(missing.emitters[0].layers.fog.length,0);A.equal(visible(s.behind).length,0);A.ok(missing.emitters[0].layers.spores.length>0);A.ok(missing.diagnostics.length>0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('real Pixi roughness, hue and blend witnesses, one-shot endpoints',()=>{
  const s=scene(),c=C.defaults('oneShot'),f=R.createPoison({PIXI:P,front:s.front,behind:s.behind,settings:c});
  try{A.equal(f.seek(0).cost,0);f.seek(.25);const a=visible(s.behind)[0],xy=[...a.vertices],tint=a.tint;
   c.roughness=0;f.configure(c);const b=visible(s.behind)[0];A.notDeepEqual([...b.vertices],xy);const clean=[...b.vertices];
   c.palette.stops.forEach(v=>{v.rgba=[255,0,255,v.rgba[3]];});c.emitters[0].layers.fog.blend='screen';f.configure(c);const v=visible(s.behind)[0];A.deepEqual([...v.vertices],clean);A.ok(v.tint!==tint);A.equal(v.tint,0xff00ff);A.equal(v.blendMode,'screen');A.equal(f.seek(39/60).cost,0);A.equal(visible(s.behind).length,0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
