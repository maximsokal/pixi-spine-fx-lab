'use strict';
// Real pinned CPU objects; this is not a GPU rendering test.
function run(read,A,test){
 const shared='assets/template/src/',fx='assets/sword-slash/src/',vendor='assets/template/vendor/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','path','color'].map(n=>shared+n+'-core.js'),...['core','anchors','pose','history','runtime'].map(n=>fx+'sword-slash-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['sword-slash-core.js'],T=mods['sword-slash-history.js'],An=mods['sword-slash-anchors.js'],R=mods['sword-slash-runtime.js'];
 const near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b),layer=(f,k)=>f.owned.children.find(l=>l.label===k);
 const loader={anchorPoses:()=>({})}; // result unused; actual pose replay uses pinned Spine.
 function rig({gap=false,jump=false,physics=false}={}){
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',length:20}],slots:[{name:'impact',bone:'weapon',attachment:'tip'}],skins:[{name:'default',attachments:{impact:{tip:{type:'point',x:12,y:0}}}}],animations:{idle:{bones:{root:{translate:[{x:0,y:0},{time:10/60,x:60,y:0},...(jump?[{time:11/60,x:400,y:0}]:[]),{time:23/60,x:jump?460:120,y:-30},{time:1,x:jump?460:120,y:-30}]}},...(gap?{slots:{impact:{attachment:[{name:'tip'},{time:8/60,name:null},{time:13/60,name:'tip'}]}}}:{})}}};
  if(physics)data.physics=[{name:'spring',bone:'weapon',x:1,rotate:1,step:60,strength:100,damping:.5}];
  return new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData(data),autoUpdate:false});
 }
 function scene(opts){
  const camera=new P.Container(),world=new P.Container(),host=new P.Container(),model=opts?rig(opts):null,historical=opts?rig(opts):null;
  camera.addChild(world);if(model){world.addChild(model,historical);model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);}world.addChild(host);
  const ctx={host,world,model,Spine:Sp,historyAsset:historical?{model:historical}:null,poseOptions:{animation:'idle',skin:'default',speed:1},loader};
  ctx.compile=T.createCompiler(ctx);return {...ctx,camera};
 }
 function preset(recorded=false,attachment=false){const d=T.defaults();if(recorded)for(const k of H.LAYERS){d.trajectory[k]='recorded';d.anchors[k]={type:attachment?'attachment':'bone',space:'local',name:attachment?'tip':'weapon',slot:attachment?'impact':'',x:0,y:0,rotation:0};}return d;}
 function create(s,d=preset()){return R.createRenderer({PIXI:P,host:s.host,compile:s.compile,settings:d});}
 test('native MeshGeometry and exact premultiplied gradient texels',()=>{
  const s=scene(),d=preset();d.effect.palettes.main.stops[0].rgba=[100,50,25,.5];d.effect.palettes.main.stops[1].rgba=[100,50,25,.5];const f=create(s,d);
  try{A.equal(P.VERSION,'8.22.0');const p=f.seek(8/60).main[0],m=layer(f,'main').children[0];A.ok(m instanceof P.Mesh);A.deepEqual([...m.geometry.positions],[...Float32Array.from(p.positions)]);A.deepEqual([...m.geometry.indices],p.indices);const n=p.sections.length,u=m.geometry.uvs;near(u[(n-1)*4],(n-.5)/512);A.equal(m.texture.source.alphaMode,'premultiplied-alpha');A.deepEqual([...m.texture.source.resource.slice((n-1)*4,n*4)],[50,25,13,128]);A.ok(m.texture.source.resource[(n-1)*4+3]>m.texture.source.resource[3]);
   f.seek(10/60);A.equal(layer(f,'main').children[0],m);f.seek(39/60);A.equal(m.visible,false);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('actual recorded weapon track: independent history, camera invariance and backward seek',()=>{
  const s=scene({physics:true}),d=preset(true),f=create(s,d);
  try{const first=f.seek(10/60);A.ok(first.main.length>0);const before=s.model.skeleton.findBone('root').worldX;A.equal(before,0);
   const end=first.main[0].sections.at(-1);A.ok(end.x>0);s.camera.position.set(100,70);s.camera.scale.set(2);s.camera.rotation=.2;
   f.seek(18/60);A.deepEqual(f.seek(10/60),first);const other=s.compile(d).sample(10/60);
   for(let i=0;i<first.main[0].sections.length;i++){near(other.main[0].sections[i].x,first.main[0].sections[i].x,1e-5);near(other.main[0].sections[i].y,first.main[0].sections[i].y,1e-5);}
   A.equal(s.model.skeleton.findBone('root').worldX,before);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('attachment disappearance splits actual history, no bridging or stale fallback',()=>{
  const s=scene({gap:true}),d=preset(true,true);try{const p=s.compile(d),h=p.meta.recorded.main;A.equal(h.runs.length,2);A.ok(h.runs[0].at(-1).time<=8/60,'first run ends '+h.runs[0].at(-1).time);A.ok(h.runs[1][0].time>=13/60,'second run starts '+h.runs[1][0].time);A.ok(h.runs[1][0].time-h.runs[0].at(-1).time>=5/60-1e-8);const q=p.sample(15/60);A.equal(q.main.length,2);A.ok(q.main[0].sections.at(-1).x<q.main[1].sections[0].x);d.anchors.main.name='absent';const bad=s.compile(d);A.equal(bad.sample(15/60).main.length,0);A.ok(bad.resolvePoses().missing.includes('main'));}finally{s.camera.destroy({children:true});}
 });
 test('teleport discontinuity and independent actual-distance event spacing',()=>{
  const s=scene({jump:true}),d=preset(true);d.teleportThreshold=100;d.effect.triggerMode='distance';try{const p=s.compile(d),h=p.meta.recorded.main;A.equal(h.runs.length,2);A.ok(h.total<200);const q=p.sample(15/60);A.equal(q.main.length,2);A.ok(q.main[1].sections[0].x-q.main[0].sections.at(-1).x>100);
   const e=h.events;for(let i=1;i<e.length;i++)near(e[i].d-e[i-1].d,10,1e-5);
   d.effect.gap=20;const b=s.compile(d);A.ok(b.meta.recorded.main.events.length<h.events.length);
   d.effect.triggerMode='time';const t=s.compile(d);d.effect.gap=5;A.deepEqual(s.compile(d).meta.recorded.main.events,t.meta.recorded.main.events);
  }finally{s.camera.destroy({children:true});}
 });
 test('native bone/point current anchor transforms, missing layers and ownership',()=>{
  const s=scene({}),d=preset();d.anchors.main={type:'attachment',space:'local',name:'tip',slot:'impact',x:0,y:0,rotation:0};const f=create(s,d);
  try{const p=An.resolve(d.anchors.main,s);near(p.x,12);const a=f.seek(8/60);A.ok(a.main.length);s.model.skeleton.findSlot('impact').setAttachment(null);const q=f.seek(8/60);A.equal(q.main.length,0);A.ok(q.edge.length);A.ok(layer(f,'main').children.every(v=>!v.visible));}
  finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('bounded mesh/spark pool, failed configure keeps old scene, owned textures destroyed',()=>{
  const s=scene(),foreign=new P.Container();s.host.addChild(foreign);const d=preset();d.effect.sparksEnabled=true;d.effect.sparkCount=64;const f=create(s,d);
  try{f.seek(13/60);const max=f.allocated,m=layer(f,'main').children[0],source=m.texture.source;A.ok(max>=64&&max<=67);
   for(let i=0;i<180;i++)f.seek(i%40/60);A.equal(f.allocated,max);
   const old=f.owned,bad=preset();bad.effect.arcAngle=0;A.throws(()=>f.configure(bad));A.equal(f.owned,old);
   f.destroy();f.destroy();A.equal(m.destroyed,true);A.equal(source.destroyed,true);A.deepEqual(s.host.children,[foreign]);A.equal(foreign.destroyed,false);A.throws(()=>f.seek(0));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('recording rejects live model as replay source and requires a detached replay asset',()=>{
  const s=scene({}),d=preset(true);try{A.throws(()=>T.createCompiler({...s,historyAsset:{model:s.model}})(d));A.throws(()=>T.createCompiler({...s,historyAsset:null})(d));}
  finally{s.camera.destroy({children:true});}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
