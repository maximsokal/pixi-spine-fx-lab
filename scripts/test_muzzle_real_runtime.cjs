'use strict';
// Actual pinned Pixi/Spine CPU objects; no GPU, canvas readback or browser claims.
// Run: node --test scripts/test_muzzle_real_runtime.cjs
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/muzzle-flash/src/';
 const document={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})};
 const navigator={userAgent:'Chromium',platform:'Linux'},browser={};
 // Load the exact browser distributions. Supply only their namespace and minimal host environment.
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')(navigator,document,browser,browser);
 browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>{if(n==='pixi.js')return P;throw Error('Unexpected vendor import '+n);});
 const modules={};
 for(const path of [shared+'curve-core.js',shared+'spacing-core.js',shared+'color-core.js',...['geometry','core','anchors','smoke','runtime','pose'].map(n=>fx+'muzzle-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const key=n.split('/').at(-1);if(!Object.hasOwn(modules,key))throw Error('Missing module '+n);return modules[key];});modules[path.split('/').at(-1)]=m.exports;
 }
 const M=modules['muzzle-core.js'],Anch=modules['muzzle-anchors.js'],S=modules['muzzle-smoke.js'],R=modules['muzzle-runtime.js'],C=modules['color-core.js'];
 const near=(a,b)=>A.ok(Math.abs(a-b)<1e-4,a+' != '+b);
 const preset=()=>({schemaVersion:1,effect:M.defaults(),anchors:Anch.defaults(),smoke:S.defaults(),smokeAnchor:Anch.defaults().core,blends:S.blendDefaults()});
 function rig(){
  const data=new Sp.SkeletonData(),bone=new Sp.BoneData(0,'weapon',null);bone.x=100;bone.y=-200;bone.rotation=-90;data.bones.push(bone);
  const sd=new Sp.SlotData(0,'muzzle',bone);sd.attachmentName='tip';data.slots.push(sd);
  const skin=new Sp.Skin('default'),point=new Sp.PointAttachment('tip');point.x=12;point.rotation=30;skin.setAttachment(0,'tip',point);data.skins.push(skin);data.defaultSkin=skin;
  const model=new Sp.Spine({skeletonData:data,autoUpdate:false});model.update(0);return model;
 }
 function scene(model=null){const camera=new P.Container(),world=new P.Container(),host=new P.Container();camera.addChild(world);if(model)world.addChild(model);world.addChild(host);
  const compile=S.createCompiler({compileEffect:M.compile,anchors:Anch,colors:C,host,world,model});return {camera,world,host,model,compile};}
 const visible=f=>f.owned.children.flatMap(l=>l.children.filter(v=>v.visible));
 test('real Pixi Graphics ignition, fade, deterministic geometry and teardown',()=>{
  A.equal(P.VERSION,'8.22.0');const s=scene(),other=new P.Container();s.host.addChild(other);const f=R.createRenderer({PIXI:P,host:s.host,compile:s.compile,settings:preset()});
  try{const start=f.seek(0);A.equal(start.core.length,1);A.ok(visible(f).every(v=>v instanceof P.Graphics));const bounds=s.host.getLocalBounds();A.ok(bounds.maxX>=320&&bounds.minX<=256);const a=f.seek(3/60);f.seek(39/60);A.equal(visible(f).length,0);A.deepEqual(f.seek(3/60),a);
   for(let i=0;i<40;i++)f.seek(i/60);const allocated=f.allocated;for(let i=0;i<400;i++)f.seek(i%40/60);A.equal(f.allocated,allocated);A.ok(allocated<=71);
   f.destroy();A.equal(s.host.children.length,1);A.equal(s.host.children[0],other);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('real Spine point and bone anchors follow transforms; camera does not move logical FX',()=>{
  const s=scene(rig()),d=preset(),a={...d.anchors.core,type:'attachment',space:'local',name:'tip',slot:'muzzle',x:0,y:0};
  d.anchors.core=a;d.anchors.tongues={...a,type:'bone',name:'weapon',slot:''};
  const f=R.createRenderer({PIXI:P,host:s.host,compile:s.compile,settings:d});
  try{const p=Anch.resolve(a,s);near(p.x,100);near(p.y,212);near(p.rotation,60);const before=f.seek(0);
   s.camera.position.set(83,-49);s.camera.scale.set(1.7);s.camera.rotation=.4;const after=f.seek(0);
   before.core[0].vertices.forEach((v,i)=>{near(v.x,after.core[0].vertices[i].x);near(v.y,after.core[0].vertices[i].y);});
   const bone=s.model.skeleton.findBone('weapon');bone.x=140;bone.rotation=0;s.model.skeleton.updateWorldTransform(Sp.Physics.update);
   const moved=Anch.resolve(a,s);near(moved.x,152);near(moved.y,200);A.ok(Math.abs(moved.rotation-p.rotation)>80);
   s.model.skeleton.findSlot('muzzle').setAttachment(null);const missing=f.seek(0);A.equal(missing.core.length,0);A.ok(missing.tongues.length>0);A.ok(missing.sparks.length>0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('real Graphics smoke, independent additive blend, all-disabled no ghosts',()=>{
  const s=scene(),d=preset();d.smoke.enabled=true;d.blends.sparks='add';const f=R.createRenderer({PIXI:P,host:s.host,compile:s.compile,settings:d});
  try{f.seek(1/60);const sparks=f.owned.children.find(l=>l.label==='sparks');A.ok(sparks.children.some(v=>v.visible&&v.blendMode==='add'));
   const q=f.seek(.15);A.equal(q.core.length,0);A.ok(q.smoke.length>0);const smoke=f.owned.children.find(l=>l.label==='smoke');A.ok(smoke.children.some(v=>v.visible&&v.alpha>0&&v.blendMode==='normal'));
   const off=JSON.parse(JSON.stringify(f.settings));for(const l of Object.values(off.effect.layers))l.enabled=false;off.smoke.enabled=false;f.configure(off);A.equal(visible(f).length,0);A.ok(Object.values(f.seek(0)).every(a=>a.length===0));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('real Spine Physics Constraint direct seek and replay match sequential integration',()=>{
  const timeline={exports:{}};new Function('module',read(shared+'timeline-core.js'))(timeline);
  const env={FxTimeline:timeline.exports};new Function('globalThis',read('assets/shockwave/src/shockwave-spine.js'))(env);
  const L=env.FxShockwaveSpine,Pose=modules['muzzle-pose.js'];
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',length:20}],physics:[{name:'spring',bone:'weapon',x:1,rotate:1,step:60,strength:100,damping:.5}],animations:{idle:{bones:{root:{translate:[{x:0,y:0},{time:.5,x:80,y:0},{time:1,x:0,y:0}]}}}}};
  function physicsRig(){const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false});model.update(0);return {model};}
  const a=physicsRig(),b=physicsRig(),c=physicsRig(),legacy=physicsRig(),o={animation:'idle',skin:'',speed:1,visible:true};
  try{
   const old=L.pose(legacy,.5,o).weapon;
   c.model.state.setAnimation(0,'idle',true);for(let i=0;i<30;i++)c.model.update(1/60);c.model.updateLocalTransform();
   const expected=L.anchorPoses(c.model).weapon,direct=Pose.pose(a,.5,o,L).weapon;
   A.ok(Math.abs(old.x-expected.x)>10);near(direct.x,expected.x);near(direct.rotation,expected.rotation);
   for(let i=0;i<=30;i++)Pose.pose(b,i/60,o,L);near(Pose.pose(b,.5,o,L).weapon.x,expected.x);
   Pose.pose(a,.1,o,L);near(Pose.pose(a,.5,o,L).weapon.x,expected.x);
   near(Pose.pose(a,.5,{...o,speed:0},L).weapon.x,0);near(Pose.pose(a,.5,o,L).weapon.x,expected.x);
  }finally{for(const x of [a,b,c,legacy])x.model.destroy();}
 });
 test('seeded randomized valid presets stay finite across time and respect budgets',()=>{
  let seed=123;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<1200;i++){const d=M.defaults();d.flashLength=8+252*rand();d.coneAngle=5+145*rand();d.flashWidth=2+98*rand();d.flashDuration=1+Math.floor(rand()*24);d.tongueCount=1+Math.floor(rand()*20);d.sparkCount=Math.floor(rand()*51);d.burstFrames=1+Math.floor(rand()*24);d.sparkLifeFrames=1+Math.floor(rand()*60);d.sparkSpeed=10000*rand();d.tongueGap=1+29*rand();d.minGap=1+29*rand();d.maxGap=d.minGap+(30-d.minGap)*rand();d.spatialMode=['even','random','stratified','clustered'][i%4];d.spatialJitter=.45*rand();d.timeJitter=.45*rand();d.rateCurveEnabled=i%3===0;d.spacingCurveEnabled=i%3===1;
   const p=M.compile(d);for(const t of [0,1/60,2/60,5/60,10/60,39/60,2]){const q=p.sample(t);A.ok(q.core.length<=1&&q.tongues.length<=d.tongueCount&&q.sparks.length<=d.sparkCount);for(const v of q.core.flatMap(c=>c.vertices))A.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));for(const v of q.tongues)A.ok(Number.isFinite(v.tip.x)&&Number.isFinite(v.tip.y));for(const v of q.sparks)A.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));}
  }
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
