'use strict';
// Real pinned Pixi/Spine CPU objects, not a GPU rendering test.
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/falling-leaves/src/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','color'].map(k=>shared+k+'-core.js'),fx+'leaves-core.js',fx+'leaves-runtime.js',fx+'leaves-export.js']){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const L=mods['leaves-core.js'],R=mods['leaves-runtime.js'],near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 function scene(c=L.defaults(),opts={}){
  const stage=new P.Container(),camera=new P.Container(),before=new P.Container(),host=new P.Container(),after=new P.Container();
  camera.addChild(stage);stage.addChild(before,host,after);
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'head',parent:'root',x:10,y:20,rotation:30}],
   slots:[{name:'body',bone:'head',attachment:'tip'}],skins:[{name:'default',attachments:{body:{tip:{type:'point',x:12,y:0}}}}]};
  const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData(data),autoUpdate:false});
  model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);model.position.set(100,200);host.addChild(model);
  const args={PIXI:P,app:{stage},host,model,settings:c,worldOffset:opts.offset};
  const f=R.createLeaves(args);return {f,stage,camera,before,host,after,model,args,done(){f.destroy();camera.destroy({children:true});}};
 }
 function checkFrame(s,frame){
  for(const k of L.LAYERS){
   const expected=frame.emitters.flatMap(e=>e.layers[k]),actual=s.f.owned[k].children;A.equal(actual.length,expected.length);
   expected.forEach((v,i)=>{const a=actual[i];A.ok(a instanceof P.Sprite);near(a.x,v.x);near(a.y,v.y);
    near(a.width,v.width);near(a.height,v.height);near(a.rotation,v.rotation*Math.PI/180);near(a.alpha,v.alpha);
    A.equal(a.tint,parseInt(v.tint.slice(1),16));A.equal(a.blendMode,v.blend);A.equal(a.texture.source.alphaMode,'premultiplied-alpha');A.equal(a.visible,true);});
  }
  A.equal(s.f.totalActive,frame.counters.particles);
 }
 test('four unique offline premultiplied masks, soft alpha and clear borders',()=>{
  const masks=[0,1,2,3].map(R.maskRGBA);A.equal(new Set(masks.map(a=>JSON.stringify([...a]))).size,4);
  for(const m of masks){A.equal(m.length,64*64*4);let soft=false,opaque=false;
   for(let i=0;i<m.length;i+=4){const a=m[i+3];A.ok(m[i]<=a&&m[i+1]<=a&&m[i+2]<=a);soft||=a>0&&a<255;opaque||=a===255;
    const n=i/4;if(n%64===0||n%64===63||n<64||n>=4032)A.equal(a,0);}
   A.ok(soft&&opaque);}
 });
 test('native stage layering and exact numerical mapping',()=>{
  const c=L.defaults();c.emitters[0].layers.gusts.enabled=true;c.emitters[0].layers.foreground.blend='add';
  const s=scene(c);try{A.equal(P.VERSION,'8.22.0');
   [s.before,s.f.owned.background,s.host,s.f.owned.foreground,s.f.owned.gusts,s.after].forEach((v,i)=>A.equal(s.stage.children[i],v));
   const frame=s.f.seek(.73);checkFrame(s,frame);A.ok(s.f.owned.gusts.children.length);A.deepEqual(frame,L.sample(c,.73));A.ok(s.f.currentBounds().width>0);
  }finally{s.done();}
 });
 test('pool plateau, no reordering for identical seek, independent toggles',()=>{
  const s=scene();try{for(let i=0;i<120;i++)checkFrame(s,s.f.seek(i/60));const max=s.f.totalCreated;
   for(let i=119;i>=0;i--)checkFrame(s,s.f.seek(i/60));A.equal(s.f.totalCreated,max);
   const old=s.f.seek(.73),surface=s.f.owned.foreground,first=surface.children.slice();
   s.f.seek(.73);first.forEach((v,i)=>A.equal(surface.children[i],v));
   const d=L.defaults();d.emitters[0].layers.background.enabled=false;s.f.configure(d);checkFrame(s,s.f.sample);
   A.equal(s.f.owned.background.children.length,0);A.deepEqual(s.f.sample.emitters[0].layers.foreground,old.emitters[0].layers.foreground);
   d.emitters[0].layers.foreground.enabled=false;s.f.configure(d);A.equal(s.f.totalActive,0);A.equal(s.f.currentBounds(),null);
  }finally{s.done();}
 });
 test('actual Spine bone and point, camera invariance, world crop offset',()=>{
  const c=L.defaults(),a=c.emitters[0].anchor;Object.assign(a,{type:'bone',space:'local',name:'head',x:3,y:4,rotation:15});
  const s=scene(c,{offset:{x:-30,y:-40}});try{const bone=s.model.skeleton.findBone('head'),p=s.f.resolveAnchor(a);
   const local={x:bone.worldX+bone.a*3+bone.b*4,y:bone.worldY+bone.c*3+bone.d*4};
   const want=s.stage.toLocal(s.model.toGlobal(local));near(p.x,want.x);near(p.y,want.y);
   const tip=s.stage.toLocal(s.model.toGlobal({x:local.x+bone.a,y:local.y+bone.c}));near(p.rotation,15+Math.atan2(tip.y-want.y,tip.x-want.x)*180/Math.PI);
   const origin=s.stage.toLocal(s.model.toGlobal({x:bone.worldX,y:bone.worldY})),w=s.f.resolveAnchor({...a,space:'world'});
   near(w.x,origin.x+3);near(w.y,origin.y+4);near(w.rotation,15);
   const frame=s.f.seek(.73);s.camera.position.set(230,120);s.camera.scale.set(2);s.camera.rotation=.2;
   const again=s.f.seek(.73);frame.emitters[0].layers.foreground.forEach((v,i)=>{near(v.x,again.emitters[0].layers.foreground[i].x);near(v.y,again.emitters[0].layers.foreground[i].y);});
   const at=s.model.skeleton.findSlot('body').getAttachment(),xy=at.computeWorldPosition(bone,{x:0,y:0}),expected=s.stage.toLocal(s.model.toGlobal(xy));
   const q=s.f.resolveAnchor({...a,type:'attachment',name:'tip',slot:'body',x:0,y:0});near(q.x,expected.x);near(q.y,expected.y);
   const absolute=s.f.resolveAnchor({...a,type:'world',x:100,y:70});near(absolute.x,70);near(absolute.y,30);
  }finally{s.done();}
 });
 test('missing anchors hide only their own emitter and recover',()=>{
  const c=L.defaults();Object.assign(c.emitters[0].anchor,{type:'attachment',space:'world',name:'tip',slot:'body',x:0,y:0});
  c.emitters.push(L.newEmitter(1));const s=scene(c);try{s.f.seek(.73);A.equal(s.f.sample.emitters.length,2);
   const slot=s.model.skeleton.findSlot('body'),old=slot.getAttachment();slot.setAttachment(null);
   const frame=s.f.seek(.73);A.equal(frame.emitters.length,1);A.equal(frame.emitters[0].id,'emitter2');checkFrame(s,frame);
   A.equal(s.f.diagnostics[0].code,'missing-anchor');slot.setAttachment(old);A.equal(s.f.seek(.73).emitters.length,2);
   s.f.setModel(null);A.equal(s.f.sample.emitters.length,1);s.f.setModel(s.model);A.equal(s.f.sample.emitters.length,2);
  }finally{s.done();}
 });
 test('missing inactive attachment does not block isolated PNG readback; active missing attachment still fails',async()=>{
  const c=L.defaults();Object.assign(c.emitters[0].anchor,{type:'attachment',space:'world',name:'tip',slot:'body',x:0,y:0});
  const s=scene(c);try{
   s.model.skeleton.findSlot('body').setAttachment(null);s.f.seek(.73);A.equal(s.f.diagnostics.length,1);
   for(const l of Object.values(c.emitters[0].layers))l.enabled=false;s.f.configure(c);
   A.equal(s.f.diagnostics.length,0);A.equal(s.f.totalActive,0);checkFrame(s,s.f.sample);
   const X=mods['leaves-export.js'],gl={MAX_TEXTURE_SIZE:1,getParameter:()=>4096};
   let renders=0,disposed=0;const pixels=new Uint8Array(512*512*4);
   const editor={async makeScene(){return {actual:{actual:'webgl2'},app:{stage:s.stage,renderer:{gl,render(){renders++;},extract:{pixels:()=>({width:512,height:512,pixels})}}},host:s.host,model:s.model,fx:s.f,dispose(){disposed++;}};}};
   const env={PIXI:{RenderTexture:{create:()=>({destroy(){}})}},FxTimeline:{seekSpine(){}}};
   const b=await X.makeBakeScene({editor,settings:c,backend:'webgl2',pose:{followFx:true},env});
   try{const frame=await b.readFrame(.73);A.equal(frame.alpha,'premultiplied');A.equal(renders,1);A.ok(frame.pixels.every(v=>v===0));
    c.emitters[0].layers.foreground.enabled=true;s.f.configure(c);await A.rejects(()=>b.readFrame(.73),/unresolved Spine anchor/);A.equal(renders,1);
   }finally{b.destroy();}A.equal(disposed,1);
  }finally{s.done();}
 });
 test('invalid settings and quality overflow leave prior frame intact',()=>{
  const s=scene();try{const first=s.f.seek(.73),old=s.f.owned.foreground.children.slice(),bad=L.defaults();
   bad.quality='low';bad.leafRate=80;bad.lifetime=8;A.throws(()=>s.f.configure(bad),/quality budget/);A.equal(s.f.sample,first);
   old.forEach((v,i)=>A.equal(s.f.owned.foreground.children[i],v));const d=L.defaults();d.leafRate=-1;A.throws(()=>s.f.configure(d));A.equal(s.f.sample,first);
  }finally{s.done();}
 });
 test('destroy owned sprites/textures exactly once; keep foreign stage and model',()=>{
  const s=scene();try{const frame=s.f.seek(.73),sprites=Object.values(s.f.owned).flatMap(v=>v.children),textures=[...new Set(sprites.map(v=>v.texture))],sources=textures.map(t=>t.source);
   A.ok(frame.counters.particles>0);s.f.destroy();s.f.destroy();A.equal(s.f.totalAllocated,0);A.equal(s.f.totalActive,0);A.equal(s.stage.children.length,3);
   [s.before,s.host,s.after].forEach((v,i)=>A.equal(s.stage.children[i],v));A.ok(sprites.every(v=>v.destroyed));A.ok(textures.every(t=>t.destroyed));A.ok(sources.every(t=>t.destroyed));
   A.equal(s.model.destroyed,false);A.throws(()=>s.f.seek(0),/destroyed/);
  }finally{s.done();}
 });
 test('sprite allocation failure during configure preserves live state',()=>{
  const s=scene();try{const d=L.defaults();d.leafRate=40;let reject=false;
   class FailSprite extends P.Sprite{constructor(...a){if(reject)throw Error('allocation failed');super(...a);}}
   s.f.destroy();const f=R.createLeaves({...s.args,PIXI:{...P,Sprite:FailSprite}});try{
    f.seek(.73);const before=f.sample,allocated=f.totalAllocated;reject=true;
    A.throws(()=>f.configure(d),/allocation failed/);A.equal(f.sample,before);A.equal(f.totalAllocated,allocated);
    reject=false;f.configure(d);A.ok(f.totalAllocated>allocated);
   }finally{f.destroy();}
  }finally{s.done();}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
