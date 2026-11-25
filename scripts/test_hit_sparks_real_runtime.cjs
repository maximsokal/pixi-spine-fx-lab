'use strict';
// Actual pinned CPU scene graph and Spine pose tests; no GPU claim.
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/hit-sparks/src/';
 const document={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},browser={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},document,browser,browser);
 browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};
 for(const path of [...['curve','spacing','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime'].map(n=>fx+'hit-sparks-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['hit-sparks-core.js'],An=mods['hit-sparks-anchors.js'],R=mods['hit-sparks-runtime.js'];
 const near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 const preset=()=>({schemaVersion:1,effect:H.defaults(),anchors:An.defaults()});
 function rig(){
  const data=new Sp.SkeletonData(),bone=new Sp.BoneData(0,'weapon',null);bone.x=100;bone.y=-200;bone.rotation=-90;data.bones.push(bone);
  const sd=new Sp.SlotData(0,'impact',bone);sd.attachmentName='tip';data.slots.push(sd);
  const skin=new Sp.Skin('default'),point=new Sp.PointAttachment('tip');point.x=12;point.rotation=30;skin.setAttachment(0,'tip',point);data.skins.push(skin);data.defaultSkin=skin;
  const model=new Sp.Spine({skeletonData:data,autoUpdate:false});model.update(0);return model;
 }
 function scene(model=null){
  const camera=new P.Container(),world=new P.Container(),host=new P.Container();camera.addChild(world);if(model)world.addChild(model);world.addChild(host);
  const ctx={camera,world,host,model,Spine:Sp};ctx.compile=An.createCompiler({...ctx,compile:H.compile});return ctx;
 }
 const layers=f=>Object.fromEntries(f.owned.children.map(l=>[l.label,l]));
 const visible=f=>Object.values(layers(f)).flatMap(l=>l.children.filter(x=>x.visible));
 const create=(s,d=preset())=>R.createRenderer({PIXI:P,host:s.host,compile:s.compile,settings:d});
 const boneAnchor=(d,extra={})=>({...d.anchors.primary,type:'bone',space:'local',name:'weapon',x:0,y:0,...extra});
 test('actual Pixi graphics, correct layer order and tapered geometry',()=>{
  A.equal(P.VERSION,'8.22.0');const s=scene(),d=preset();d.effect.burstCount=1;d.effect.spread=0;d.effect.layers.primary.blend='add';d.effect.palettes.primary.stops[0].rgba=[12,34,56,.5];
  const f=create(s,d);try{A.deepEqual(f.owned.children.map(l=>l.label),['dust','primary','flash']);const g=layers(f).primary.children[0];A.ok(g instanceof P.Graphics);A.equal(g.tint,0x0c2238);A.equal(g.alpha,.5);A.equal(g.blendMode,'add');const b=g.getLocalBounds();near(b.minX,-18);near(b.maxX,0);near(b.minY,-1);near(b.maxY,1);
   const shape=g.context.instructions[0];A.ok(shape);f.seek(2/60);A.equal(g.context.instructions[0],shape);A.ok(g.x>256);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('real point and bone anchor, rotation and camera invariance',()=>{
  const s=scene(rig()),d=preset(),a=boneAnchor(d,{type:'attachment',slot:'impact',name:'tip'});d.anchors.primary=a;d.anchors.flash=boneAnchor(d);
  const f=create(s,d);try{const p=An.resolve(a,s);near(p.x,100);near(p.y,212);near(p.rotation,60);const before=f.seek(0);s.camera.position.set(83,-49);s.camera.scale.set(1.7);s.camera.rotation=.4;const after=f.seek(0);
   for(let j=0;j<before.primary.length;j++)before.primary[j].vertices.forEach((v,i)=>{near(v.x,after.primary[j].vertices[i].x);near(v.y,after.primary[j].vertices[i].y);});
   const bone=s.model.skeleton.findBone('weapon');bone.x=140;bone.rotation=0;s.model.skeleton.updateWorldTransform(Sp.Physics.update);
   const moved=An.resolve(a,s);near(moved.x,152);near(moved.y,200);
   s.model.skeleton.findSlot('impact').setAttachment(null);const missing=f.seek(0);A.equal(missing.primary.length,0);A.equal(missing.flash.length,1);A.deepEqual(s.compile(d).resolvePoses().missing,['primary']);
   A.ok(layers(f).primary.children.every(v=>!v.visible));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('actual mesh with three vertices and large mesh bounds, unsupported attachment hidden',()=>{
  const s=scene(rig()),d=preset(),a=boneAnchor(d,{type:'attachment',slot:'impact',name:'mesh'}),slot=s.model.skeleton.findSlot('impact');
  try{const m=new Sp.MeshAttachment('mesh');m.worldVerticesLength=6;m.vertices=new Float32Array([0,0,10,0,0,8]);slot.setAttachment(m);const p=An.resolve(a,s);near(p.x,104);near(p.y,205);
   m.worldVerticesLength=520;m.vertices=new Float32Array(520);m.vertices[518]=100;m.vertices[519]=60;const q=An.resolve(a,s);near(q.x,130);near(q.y,250);
   const box=new Sp.BoundingBoxAttachment('mesh');box.worldVerticesLength=6;box.vertices=new Float32Array([0,0,10,0,0,8]);slot.setAttachment(box);A.equal(An.resolve(a,s),null);
   m.worldVerticesLength=65538;slot.setAttachment(m);A.equal(An.resolve(a,s),null);
  }finally{s.camera.destroy({children:true});}
 });
 test('real region, slot and skeleton anchor coordinate planes',()=>{
  const s=scene(rig()),d=preset(),a=boneAnchor(d,{type:'attachment',slot:'impact',name:'region'}),slot=s.model.skeleton.findSlot('impact');
  try{const region=new Sp.RegionAttachment('region');region.offset.set([0,0,10,0,10,8,0,8]);slot.setAttachment(region);
   const p=An.resolve(a,s);near(p.x,104);near(p.y,205);
   const q=An.resolve({...a,type:'slot',name:'impact',slot:''},s);near(q.x,100);near(q.y,200);
   s.model.position.set(20,30);const o=An.resolve({...a,type:'skeleton',name:'',slot:''},s);near(o.x,20);near(o.y,30);
  }finally{s.camera.destroy({children:true});}
 });
 test('local and world offsets differ, inactive anchor hides without fallback',()=>{
  const s=scene(rig()),d=preset(),a=boneAnchor(d,{x:10,y:0}),b=s.model.skeleton.findBone('weapon');
  try{let p=An.resolve(a,s);near(p.x,100);near(p.y,210);p=An.resolve({...a,space:'world'},s);near(p.x,110);near(p.y,200);b.active=false;A.equal(An.resolve(a,s),null);A.equal(An.resolve({...a,name:'nope'},s),null);}
  finally{s.camera.destroy({children:true});}
 });
 test('bounded pools, deterministic seek, disabled layers, ownership and teardown',()=>{
  const s=scene(),foreign=new P.Container();s.host.addChild(foreign);const d=preset();Object.assign(d.effect,{burstCount:140,dustCount:70,flashFrames:120,durationFrames:120});const f=create(s,d);
  try{const first=f.seek(5/60);A.equal(visible(f).length,211);A.equal(f.allocated,211);
   for(let i=0;i<180;i++)f.seek(i%40/60);A.equal(f.allocated,211);A.deepEqual(f.seek(5/60),first);
   f.seek(3);A.equal(visible(f).length,0);const next=preset();for(const l of Object.values(next.effect.layers))l.enabled=false;f.configure(next);f.seek(0);A.equal(visible(f).length,0);
   const old=f.owned,bad=preset();bad.effect.burstCount=141;A.throws(()=>f.configure(bad));A.equal(f.owned,old);f.destroy();f.destroy();A.deepEqual(s.host.children,[foreign]);A.equal(foreign.destroyed,false);A.throws(()=>f.seek(0));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('zero-width ribbon and malformed sample budget are fail-closed',()=>{
  const s=scene(),d=preset();d.effect.curves.widthTaper.keys.forEach(k=>k.y=0);const f=create(s,d);
  try{A.equal(layers(f).primary.children.filter(v=>v.visible).length,0);A.equal(layers(f).flash.children.filter(v=>v.visible).length,1);}
  finally{f.destroy();}
  let invalid=false;const fake=R.createRenderer({PIXI:P,host:s.host,settings:d,compile:()=>({settings:d,sample:()=>invalid?{flash:[],primary:Array(141).fill(null),dust:[]}:{flash:[],primary:[],dust:[]}})});
  try{invalid=true;A.throws(()=>fake.seek(0));A.equal(fake.allocated,0);A.throws(()=>fake.seek(NaN));}finally{fake.destroy();s.camera.destroy({children:true});}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
