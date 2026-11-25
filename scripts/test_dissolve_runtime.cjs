'use strict';
// Actual pinned Pixi/Spine CPU objects and a renderer/readback fixture. No GPU claims.
function run(read,A,test){
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},navigator={userAgent:'Chromium',platform:'Linux'},browser={};
 const P=new Function('navigator','document','window','self',read('assets/template/vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')(navigator,doc,browser,browser);browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read('assets/template/vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>P);
 const env={PIXI:P,spine:Sp};for(const path of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/dissolve/src/dissolve-core.js','assets/shockwave/src/shockwave-spine.js','assets/dissolve/src/dissolve-shader.js','assets/dissolve/src/dissolve-surface.js','assets/dissolve/src/dissolve-runtime.js'])new Function('globalThis','module','require',read(path))(env,undefined,undefined);
 const D=env.FxDissolve,H=env.FxDissolveShader,S=env.FxDissolveSurface,R=env.FxDissolveRuntime,L=env.FxShockwaveSpine;
 const c=()=>{const v=D.defaults();v.rect={x:0,y:0,width:32,height:32};v.emitters[0].x=v.emitters[0].y=16;v.roughness=0;return v;};
 const near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 function fixture(){
  const source=new P.Container(),front=new P.Container(),behind=new P.Container(),calls=[],poses=[],foreign=new P.Container();front.addChild(foreign);
  const data=new Sp.SkeletonData(),bone=new Sp.BoneData(0,'root',null);bone.x=4;bone.y=5;data.bones.push(bone);const model=new Sp.Spine({skeletonData:data,autoUpdate:false});source.addChild(model);model.update(0);
  const art=new P.Graphics().rect(1,1,30,30).fill(0xffffff);source.addChild(art);
  const gl={FRAGMENT_SHADER:1,HIGH_FLOAT:2,MAX_FRAGMENT_UNIFORM_VECTORS:3,MAX_TEXTURE_SIZE:4,getShaderPrecisionFormat:()=>({precision:23}),getParameter:k=>k===3?256:4096};
  const renderer={gl,render(o){calls.push(o);if(this.fail&&o.container!==source)throw Error('render injection');},clear(o){calls.push(o);},extract:{pixels(t){const w=t.width,h=t.height,pixels=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels[(y*w+x)*4+3]=y>=12&&y<20?0:255;return {pixels,width:w,height:h};}}};
  const poseFrame=frame=>{poses.push(frame);const b=model.skeleton.findBone('root');b.x=4+frame*.1;model.skeleton.updateWorldTransform(Sp.Physics.update);model.updateLocalTransform();const m=L.anchorPoses(model),{$local,...bones}=m;return {local:$local,bones};};
  return {PIXI:P,renderer,source,front,behind,foreign,calls,poses,model,art,poseFrame,backend:'webgl1',env:{},cleanup(){source.destroy({children:true});front.destroy({children:true});behind.destroy({children:true});}};
 }
 test('actual pinned programs reflect all six bindings and atlas reproduces exact 16-bit CPU nodes',()=>{
  A.equal(P.VERSION,'8.22.0');const h=H.create(P,4096),cfg=c(),plan=D.compile(cfg),states=plan.states(.25,{},true).states;
  try{const p=h.update(cfg,.25,states);A.equal(h.filter.gpuProgram.structsAndGroups.groups.length,6);A.equal(h.filter.resources.uField,h.source);A.equal(h.source.scaleMode,'nearest');const raw=h.source.resource;for(const g of p.grids)for(let i=0;i<g.values.length;i++)A.equal(raw[(g.offset+i)*4]*256+raw[(g.offset+i)*4+1],g.values[i]);const old=h.source;h.update(cfg,.3,plan.states(.3,{},true).states);A.equal(h.source,old);h.update(cfg,39/60,plan.states(39/60,{},true).states);A.equal(h.filter.resources.du.uniforms.uOptions[2],1);A.equal(h.source,old);A.ok(H.GL_FRAGMENT.includes('coverage=max(coverage,a*strength)'));A.ok(H.GPU_SHADER.includes('max(current.a,a*strength)'));}finally{h.destroy();h.destroy();}
 });
 test('surface uses detached capture and canonical pose, alpha holes and exact backend checks',async()=>{
  const f=fixture(),cfg=c(),s=S.create({...f,rect:cfg.rect});try{const a=await s.capture(7),b=await s.capture(7);A.deepEqual(a,b);A.equal(s.count,1);A.equal(f.poses.length,1);A.equal(f.calls[0].container,f.source);near(f.calls[0].transform.tx,0);const alpha=await s.readAlpha();A.equal(alpha[0],255);A.equal(alpha[12*32],0);A.equal(alpha[20*32],255);const p=await s.capture(8);near(p.bones.root.x-a.bones.root.x,.1);f.art.x=10;await A.rejects(()=>s.capture(9),/bounds/);f.art.x=0;await s.capture(9);A.equal(s.count,3);A.throws(()=>S.create({...f,rect:cfg.rect,backend:'webgpu'}),/requested/);}finally{s.destroy();f.cleanup();}
 });
 test('WebGPU aligned alpha rows and buffer release on cancel',async()=>{
  const f=fixture(),cfg=c(),raw=new Uint8Array(256*32),log=[];raw[3]=121;raw[256+3]=77;let cancelled=false;
  const buffer={async mapAsync(){cancelled=true;log.push('map');},getMappedRange:()=>raw.buffer,unmap(){log.push('unmap');},destroy(){log.push('destroy');}};
  const device={limits:{maxTextureDimension2D:4096},createBuffer:o=>{A.equal(o.size,8192);return buffer;},createCommandEncoder:()=>({copyTextureToBuffer(a,b,c){A.equal(b.bytesPerRow,256);A.equal(c.width,32);},finish(){}}),queue:{submit(){}}};
  f.renderer.gl=null;f.renderer.gpu={device};f.renderer.texture={getGpuSource:()=>({format:'bgra8unorm'})};const s=S.create({...f,rect:cfg.rect,backend:'webgpu',env:{GPUBufferUsage:{COPY_DST:1,MAP_READ:2},GPUMapMode:{READ:1}}});
  try{await s.capture(0);const a=await s.readAlpha();A.equal(a[0],121);A.equal(a[32],77);cancelled=false;await A.rejects(()=>s.readAlpha({get aborted(){return cancelled;}}),/cancelled/);A.deepEqual(log,['map','unmap','map','unmap']);}finally{s.destroy();f.cleanup();}A.equal(log.at(-1),'destroy');
 });
 test('runtime captures birth poses, stable debris pool, endpoint and transactional failure',async()=>{
  const f=fixture(),cfg=c(),fx=await R.createDissolve({...f,settings:cfg});
  try{const old=f.front.children[1],display=old.children[0],created=fx.stats.totalCreated;A.ok(fx.stats.emitted>0);A.equal(fx.stats.requested,fx.stats.emitted+fx.stats.dropped);A.equal(f.source.parent,null);A.equal(f.front.children[0],f.foreign);
   const a=await fx.seek(.25);A.ok(a.particles.length>0);A.ok(a.particles.every(p=>!(p.origin[1]>=12&&p.origin[1]<=20)));await fx.seek(.25);A.equal(fx.stats.totalCreated,created);A.deepEqual(await fx.seek(.25),a);const before=fx.sample,visible=display.texture;f.renderer.fail=true;await A.rejects(()=>fx.seek(.4),/injection/);A.equal(display.texture,visible);A.deepEqual(fx.sample,before);const unsupported=c();unsupported.emitters[0].layers.edge.placement='behind';await A.rejects(()=>fx.configure(unsupported),/source-bound/);const next=c();next.endpoint='grayscale';await A.rejects(()=>fx.configure(next),/injection/);A.equal(f.front.children[1],old);A.equal(fx.settings.endpoint,'disappear');f.renderer.fail=false;await fx.configure(next);A.equal(fx.settings.endpoint,'grayscale');A.ok(display.destroyed);A.equal((await fx.seek(39/60)).particles.length,0);A.equal(fx.stats.visible,0);
   const count=fx.stats.captures;await fx.seek(39/60);A.equal(fx.stats.captures,count);await A.rejects(()=>fx.seek(.2,{aborted:true}),/cancelled/);
  }finally{fx.destroy();fx.destroy();}A.equal(f.front.children.length,1);A.equal(f.front.children[0],f.foreign);A.equal(f.behind.children.length,0);A.ok(!f.model.destroyed);f.cleanup();
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
