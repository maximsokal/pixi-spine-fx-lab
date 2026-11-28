'use strict';
function run(read,A,T){
 const vendor='assets/template/vendor/',g={},doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 for(const p of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/blizzard/src/blizzard-core.js','assets/blizzard/src/blizzard-runtime.js'])new Function('globalThis',read(p))(g);
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const B=g.FxBlizzard,R=g.FxBlizzardRuntime,clone=v=>JSON.parse(JSON.stringify(v)),deg=Math.PI/180;
 const close=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 const record=(r,k,id='emitter1')=>r.emitters.get(id).layers[k];
 const layer=(f,k)=>f.emitters[0].layers.find(l=>l.id===k);
 function fixture(settings=B.defaults(),offset={x:0,y:0}){
  const stage=new P.Container(),before=new P.Container(),host=new P.Container(),after=new P.Container(),sources=[],textures=[],batches=[],nodes=[];
  stage.addChild(before,host,after);
  const data=new Sp.SkeletonJson({}).readSkeletonData({skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'head',parent:'root',x:10,y:20,rotation:30,scaleX:2,scaleY:3}],slots:[{name:'body',bone:'head'}],skins:[{name:'default'}]});
  const model=new Sp.Spine({skeletonData:data,autoUpdate:false});host.addChild(model);model.position.set(100,200);model.update(0);
  const bone=model.skeleton.findBone('head'),slot=model.skeleton.findSlot('body');
  let failBatch=false,failParticle=false;
  class Container extends P.Container{constructor(...args){super(...args);nodes.push(this);}}
  class ParticleContainer extends P.ParticleContainer{constructor(o){if(failBatch){failBatch=false;throw Error('batch allocation fault');}super(o);batches.push(this);}}
  class Particle extends P.Particle{constructor(o){if(failParticle){failParticle=false;throw Error('particle allocation fault');}super(o);}}
  class ImageSource extends P.ImageSource{constructor(o){super(o);sources.push(this);}}
  class Texture extends P.Texture{constructor(o){super(o);textures.push(this);}}
  const PIXI={Container,ParticleContainer,Particle,ImageSource,Texture,Rectangle:P.Rectangle};
  const makeCanvas=()=>({width:0,height:0,getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}});
  return {stage,host,before,after,model,bone,slot,batches,nodes,textures,sources,PIXI,makeCanvas,failBatch(){failBatch=true;},failParticle(){failParticle=true;},
   start:()=>R.createBlizzard({PIXI,app:{stage},host,model,settings,worldOffset:offset,makeCanvas}),cleanup(){stage.destroy({children:true});}};
 }
 T('straight white RGB masks, meaningful width and independent silhouettes',()=>{
  const a=R.maskRGBA('streaks'),b=R.maskRGBA('foreground'),c=R.maskRGBA('whiteout');
  A.equal(a.length,4096);A.ok(JSON.stringify(a)!==JSON.stringify(b));
  for(const m of [a,b,c])A.ok(m.every((v,i)=>i%4===3||v===255));
  for(const m of [a,b]){A.equal(m[3],0);A.equal(m.at(-1),0);A.ok(m.some((v,i)=>i%4===3&&v>0&&v<255));A.ok(m[(16*32+16)*4+3]>200);}
  A.ok(c.every(v=>v===255));A.ok(a[(5*32+16)*4+3]>200);A.throws(()=>R.maskRGBA('invalid'));
 });
 T('actual pinned Pixi batches match all visible numerical particles and exact rectangle bounds',()=>{
  const f=fixture(),r=f.start();try{
   A.equal(P.VERSION,'8.22.0');A.deepEqual(f.stage.children,[f.before,r.owned.behind,f.host,r.owned.front,f.after]);
   A.equal(record(r,'streaks').surface.parent,r.owned.behind);A.equal(record(r,'foreground').surface.parent,r.owned.front);
   const t=.23,q=r.seek(t),expected=B.createPlan(B.defaults()).sample(t);
   let n=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(const k of B.LAYERS){
    const dst=record(r,k),batch=dst.batch,items=layer(expected,k).particles.filter(x=>x.rgba[3]>0);
    A.ok(batch instanceof P.ParticleContainer);A.equal(batch.particleChildren.length,items.length);n+=items.length;
    A.equal(batch.texture.source.alphaMode,'premultiply-alpha-on-upload');
    for(let i=0;i<items.length;i++){const a=batch.particleChildren[i],b=items[i];close(a.x,b.x);close(a.y,b.y);close(a.scaleX,b.length/32);close(a.scaleY,b.width/32);close(a.rotation,b.rotation*deg);close(a.alpha,b.rgba[3]);A.equal(a.texture,batch.texture);
     for(const sx of [-1,1])for(const sy of [-1,1]){const x=256+b.x+Math.cos(a.rotation)*sx*b.length/2-Math.sin(a.rotation)*sy*b.width/2,y=256+b.y+Math.sin(a.rotation)*sx*b.length/2+Math.cos(a.rotation)*sy*b.width/2;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    }
   }
   A.equal(q.cost,n);A.equal(r.totalActive,n);const b=r.currentBounds();close(b.x,left);close(b.y,top);close(b.width,right-left);close(b.height,bottom-top);
  }finally{r.destroy();A.deepEqual(f.stage.children,[f.before,f.host,f.after]);A.equal(f.model.destroyed,false);A.ok(f.textures.every(t=>t.destroyed));A.ok(f.sources.every(s=>s.destroyed));f.cleanup();}
 });
 T('pool plateaus on reverse playback and whiteout remains independent',()=>{
  const f=fixture(),r=f.start();try{
   for(let i=0;i<60;i++)r.seek(i/60);const created=r.totalCreated;for(let i=59;i>=0;i--)r.seek(i/60);A.equal(r.totalCreated,created);
   const before=layer(r.seek(.3),'streaks'),d=B.defaults();d.emitters[0].layers.whiteout.enabled=true;d.emitters[0].layers.foreground.enabled=false;r.configure(d);
   A.deepEqual(layer(r.sample,'streaks'),before);const w=record(r,'whiteout').batch.particleChildren;A.equal(w.length,1);A.equal(w[0].scaleX,16);A.equal(w[0].scaleY,16);close(w[0].alpha,layer(r.sample,'whiteout').whiteout.rgba[3]);
   A.equal(record(r,'foreground').batch.particleChildren.length,0);A.ok(r.totalAllocated<=B.BUDGETS.balanced);
   d.emitters[0].visible=false;r.configure(d);A.equal(r.totalActive,0);A.equal(r.currentBounds(),null);
  }finally{r.destroy();r.destroy();A.equal(r.totalAllocated,0);f.cleanup();}
 });
 T('actual Spine bone, skeleton, slot, point, region and mesh anchors with affine offsets',()=>{
  const f=fixture(B.defaults(),{x:-30,y:-40}),r=f.start();try{
   const b=f.bone,a=(type,space='local',name='head',slot='')=>({type,space,name,slot,x:3,y:4,rotation:0});
   const world=(x,y)=>f.stage.toLocal(f.model.toGlobal({x,y}));
   const expected=world(b.worldX+b.a*3+b.b*4,b.worldY+b.c*3+b.d*4);
   for(const anchor of [a('bone'),a('slot','local','body')]){const p=r.resolveAnchor(anchor);close(p.x,expected.x);close(p.y,expected.y);}
   const base=world(b.worldX,b.worldY),p=r.resolveAnchor(a('bone','world'));close(p.x,base.x+3);close(p.y,base.y+4);
   const sk=r.resolveAnchor(a('skeleton'));close(sk.x,world(3,4).x);close(sk.y,world(3,4).y);A.deepEqual(r.resolveAnchor(a('world')),{x:-27,y:-36});
   const point=new Sp.PointAttachment('point');point.x=5;point.y=7;f.slot.setAttachment(point);
   const pos=point.computeWorldPosition(b,{x:0,y:0}),pointExpected=world(pos.x+b.a*3+b.b*4,pos.y+b.c*3+b.d*4),pointGot=r.resolveAnchor(a('attachment','local','point','body'));close(pointGot.x,pointExpected.x);close(pointGot.y,pointExpected.y);
   const region=new Sp.RegionAttachment('region');region.offset.set([-2,-3,8,-3,8,11,-2,11]);f.slot.setAttachment(region);
   const mesh=new Sp.MeshAttachment('mesh');mesh.vertices=new Float32Array([-3,-5,9,-5,2,8]);mesh.worldVerticesLength=6;
   for(const at of [region,mesh]){f.slot.setAttachment(at);const verts=new Float32Array(at===region?8:6);if(at===region)at.computeWorldVertices(f.slot,verts,0,2);else at.computeWorldVertices(f.slot,0,6,verts,0,2);
    const xs=Array.from(verts).filter((v,i)=>i%2===0),ys=Array.from(verts).filter((v,i)=>i%2===1),ex=world((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2),got=r.resolveAnchor({...a('attachment','world',at.name,'body'),x:0,y:0});close(got.x,ex.x);close(got.y,ex.y);
   }
  }finally{r.destroy();f.cleanup();}
 });
 T('missing attachment isolation, inherited offset semantics and recovery',()=>{
  const d=B.defaults();d.emitters[0].anchor={type:'bone',name:'head',slot:'',space:'local',x:0,y:0,rotation:10};d.emitters[0].layers.streaks.anchor={type:'inherit',name:'',slot:'',space:'local',x:3,y:4,rotation:5};
  d.emitters[0].layers.foreground.anchor={type:'attachment',name:'point',slot:'body',space:'local',x:0,y:0,rotation:0};
  const f=fixture(d),r=f.start();try{
   const expected=r.resolveAnchor({...d.emitters[0].anchor,x:3,y:4}),s=record(r,'streaks').surface;close(s.x,expected.x);close(s.y,expected.y);close(s.rotation,15*deg);
   A.equal(record(r,'foreground').surface.visible,false);A.ok(r.diagnostics.some(v=>v.layer==='foreground'));
   const pt=new Sp.PointAttachment('point');f.slot.setAttachment(pt);r.seek(.3);A.equal(record(r,'foreground').surface.visible,true);A.ok(record(r,'foreground').batch.particleChildren.length>0);A.equal(r.diagnostics.length,0);
   f.slot.setAttachment(null);r.seek(.3);A.equal(record(r,'foreground').batch.particleChildren.length,0);A.ok(record(r,'streaks').batch.particleChildren.length>0);
  }finally{r.destroy();f.cleanup();}
 });
 T('configuration rejects invalid settings and allocation failures without replacing current scene',()=>{
  const f=fixture(),r=f.start();try{
   r.seek(.3);const old=r.settings,frame=r.sample,b=record(r,'streaks'),n=r.totalAllocated,d=B.defaults();d.emitters.push(B.newEmitter(1));
   f.failBatch();A.throws(()=>r.configure(d),/batch allocation fault/);A.equal(r.settings,old);A.equal(r.sample,frame);A.equal(record(r,'streaks'),b);A.equal(r.emitters.size,1);
   f.failParticle();A.throws(()=>r.configure({...d,particleRate:150}),/particle allocation fault/);A.equal(r.settings,old);A.equal(r.sample,frame);A.equal(r.totalAllocated,n);A.equal(r.emitters.size,1);
   A.throws(()=>r.configure({...d,windSpeed:NaN}));A.equal(r.settings,old);
   r.configure(d);A.equal(r.emitters.size,2);A.equal(record(r,'streaks'),b);const removed=record(r,'streaks','emitter2');r.configure(B.defaults());A.ok(removed.surface.destroyed);A.equal(r.emitters.size,1);
  }finally{r.destroy();A.ok(f.nodes.every(n=>n.destroyed));A.ok(f.batches.every(b=>b.destroyed));f.cleanup();}
 });
 T('initial allocation failure cleans owned objects; caller objects untouched',()=>{
  const f=fixture();try{f.failBatch();A.throws(f.start,/batch allocation fault/);A.deepEqual(f.stage.children,[f.before,f.host,f.after]);A.ok(f.nodes.every(n=>n.destroyed));A.ok(f.textures.every(t=>t.destroyed));A.ok(f.sources.every(s=>s.destroyed));A.equal(f.model.destroyed,false);}finally{f.cleanup();}
 });
 T('one-shot final frame empty including whiteout, crop and invalid host handled',()=>{
  const d={...B.defaults(),mode:'oneShot',durationFrames:40};d.emitters[0].layers.whiteout.enabled=true;
  const f=fixture(d,{x:-100,y:-50}),r=f.start();try{const q=r.seek(.3);A.ok(q.cost>0);close(record(r,'whiteout').surface.x,156);close(record(r,'whiteout').surface.y,206);r.seek(39/60);A.equal(r.totalActive,0);A.equal(r.currentBounds(),null);A.throws(()=>r.seek(NaN));}finally{r.destroy();}
  try{f.host.pivot.x=1;A.throws(f.start,/identity/);}finally{f.cleanup();}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
