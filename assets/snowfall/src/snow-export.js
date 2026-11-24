// AIR-02 — isolated bake and exact-source developer packages.
(function(root,factory){
 const api=Object.freeze(factory(root,root.FxSnow||(typeof require==='function'?require('./snow-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.FxSnowExport=api;api.bind(root.SnowEditor);}
})(globalThis,function(root,Core){
 'use strict';
 const ID='fx.air.snowfall';
 function safe(name){
  const n=String(name).replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[A-Za-z]:/.test(n)||n.split('/').some(x=>!x||x==='.'||x==='..')||/[\x00-\x1f]/.test(n))throw Error('Unsafe asset path '+name);
  return n;
 }
 function manifest(settings,backend,frames){
  const c=Core.createPlan(settings).settings;
  if(!Number.isInteger(frames)||frames<1||frames>c.exportFrames)throw RangeError('AIR-02 invalid frame count');
  return {schemaVersion:1,effectId:ID,settings:c,backend,width:512,height:512,fps:60,frameCount:frames,
   alpha:'straight-rgba8',cropPolicy:'Fixed authoring field 512x512; flakes enter/leave field intentionally',
   loopPolicy:c.mode==='loop'?'periodic-half-open':'one-shot-stop-fade',
   frames:Array.from({length:frames},(_,frame)=>({frame,file:'frames/'+String(frame).padStart(4,'0')+'.png',timeSeconds:frame/60}))};
 }
 function packageEntries({settings,asset=null,source,target}){
  if(!['webgl','webgpu'].includes(target))throw TypeError('AIR-02 invalid target');
  const c=Core.createPlan(settings).settings;
  const preset={schemaVersion:1,effectId:ID,settings:c,rendererPreference:target,
   compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),atlas:'assets/'+safe(asset.atlasName),skin:asset.skin||'',animation:asset.animation||''}:null};
  const json=JSON.stringify(preset,null,2);
  const demo=[
   "import * as PIXI from 'pixi.js';",
   "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
   "import { FxSnow, createSnow } from './Snow.mjs';",
   "import { FxTimeline } from './FxTimeline.mjs';",
   "async function main(){",
   " const p=await (await fetch('/preset.json')).json();",
   " const app=new PIXI.Application();await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:'"+target+"',preferWebGLVersion:2});",
   " const actual=app.renderer.gl?'webgl':app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown';",
   " if(actual!==p.rendererPreference)throw Error('Renderer mismatch: '+actual);",
   " document.body.append(app.canvas);const host=new PIXI.Container();app.stage.addChild(host);let model=null;",
   " if(p.asset){PIXI.Assets.add({alias:'snow-skel',src:p.asset.skeleton});PIXI.Assets.add({alias:'snow-atlas',src:p.asset.atlas});await PIXI.Assets.load(['snow-skel','snow-atlas']);",
   " model=SpineRuntime.Spine.from({skeleton:'snow-skel',atlas:'snow-atlas',autoUpdate:false});host.addChild(model);model.update(0);",
   " const b=model.getLocalBounds(),scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
   " if(p.asset.skin){model.skeleton.setSkinByName(p.asset.skin);model.skeleton.setSlotsToSetupPose();}if(p.asset.animation)model.state.setAnimation(0,p.asset.animation,true);}",
   " const settings=FxSnow.normalize(p.settings),fx=createSnow({PIXI,app,host,model,settings});let t=0;",
   " app.ticker.add(ticker=>{t+=ticker.elapsedMS/1000;t=settings.mode==='loop'?t%(settings.durationFrames/60):Math.min((settings.durationFrames-1)/60,t);if(model)FxTimeline.seekSpine(model,t);fx.seek(t);});",
   " window.addEventListener('pagehide',()=>{fx.destroy();app.destroy(true);},{once:true});",
   "}main().catch(e=>{console.error(e);document.body.textContent=e.message;});"
  ].join('\n');
  const entries=[
   {name:'preset.json',data:json},{name:'public/preset.json',data:json},
   {name:'FxCurves.mjs',data:source('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+source('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+source('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxTimeline.mjs',data:source('fxTimelineCore')+'\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxSnow.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+source('fxSnowCore')+'\nexport const FxSnow=globalThis.FxSnow;\n'},
   {name:'Snow.mjs',data:"import './FxSnow.mjs';\n"+source('fxSnowRuntime')+'\nexport const FxSnow=globalThis.FxSnow;\nexport const createSnow=globalThis.FxSnowRuntime.createSnow;\n'},
   {name:'example.js',data:demo},
   {name:'LICENSES.txt',data:source('runtimeLicenses')},
   {name:'README.md',data:'# AIR-02 Snowfall\nExact shared numerical core and native particle runtime. Install pinned dependencies (npm install --offline if cached), npm run dev, npm run build. Backend mismatch is an error. Actual GPU and Vite builds require local verification.\n'},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-snow-'+target,private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><title>Snowfall</title><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton},{name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)entries.push({name:'public/assets/'+safe(name),data:blob});}
  if(new Set(entries.map(e=>e.name)).size!==entries.length)throw Error('Duplicate package path');
  return {preset,entries};
 }
 async function extract(scene){
  const uri=await scene.app.renderer.extract.base64({target:scene.app.stage,frame:new root.PIXI.Rectangle(0,0,512,512),format:'png'});
  if(!uri.startsWith('data:image/png;base64,'))throw Error('Expected PNG');
  const raw=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),ch=>ch.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([raw],{type:'image/png'}));
  try{
   if(bitmap.width!==512||bitmap.height!==512)throw Error('Unexpected bake dimensions');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
   const image=ctx.getImageData(0,0,512,512),a=image.data;
   // Same pinned-backend correction as the existing Wind/Rain exports.
   if(scene.app.renderer.gl)for(let i=0;i<a.length;i+=4)if(a[i+3]&&a[i+3]!==255)
    for(let ch=0;ch<3;ch++)a[i+ch]=Math.min(255,Math.round(a[i+ch]*255/a[i+3]));
   ctx.putImageData(image,0,0);
   return new Uint8Array(await (await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'))).arrayBuffer());
  }finally{bitmap.close();}
 }
 function bind(editor){
  const $=id=>document.getElementById(id),zip=root.FxSnowZip;
  let cancelled=false;
  async function bake({download=true,frames=null}={}){
   if(editor.busy||!editor.scene)throw Error('Snowfall renderer unavailable or busy');
   const settings=editor.getSettings(),asset=editor.asset,preview=editor.getActualBackend(),wasPlaying=editor.session.playing;
   let scene=null;cancelled=false;editor.stop();editor.setBusy(true);$('cancel').disabled=false;
   const check=()=>{if(cancelled)throw Error('Snowfall bake cancelled');};
   try{
    scene=await editor.makeScene(preview.actual,asset,settings,asset?.skin,asset?.animation);
    if(scene.actual.actual!==preview.actual)throw Error('Bake renderer mismatch');
    scene.host.renderable=false;
    const m=manifest(settings,scene.actual,frames??settings.exportFrames),entries=[];let bytes=0;
    for(const f of m.frames){check();if(scene.model)root.FxTimeline.seekSpine(scene.model,f.timeSeconds);
     scene.fx.seek(f.timeSeconds);if(scene.fx.diagnostics.length)throw Error('Unresolved Snowfall anchor');
     scene.app.render();const data=await extract(scene);check();bytes+=data.length;
     if(bytes>250*1024*1024)throw Error('PNG sequence exceeds ZIP budget');
     entries.push({name:f.file,data});editor.status('Baking '+(f.frame+1)+' / '+m.frameCount);
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    entries.push({name:'sequence.json',data:JSON.stringify(m,null,2)});
    const blob=await zip.makeZip(entries,check);check();if(download)zip.download(blob,'Snowfall_'+m.frameCount+'_PNG.zip');
    editor.status('Snowfall PNG ZIP ready');return {manifest:m,entries,blob};
   }catch(e){editor.status(e.message,true);throw e;}
   finally{try{scene?.dispose();}finally{$('cancel').disabled=true;editor.setBusy(false);if(wasPlaying)editor.session.play();editor.refreshTime();}}
  }
  async function buildPackage(target,download=true){
   if(editor.busy)throw Error('Snowfall busy');editor.setBusy(true);
   try{const p=packageEntries({settings:editor.getSettings(),asset:editor.asset,source:id=>$(id).textContent,target});
    const blob=await zip.makeZip(p.entries);if(download)zip.download(blob,'Snowfall_'+target+'.zip');
    editor.status('Developer ZIP ready');return {...p,blob};
   }catch(e){editor.status(e.message,true);throw e;}finally{editor.setBusy(false);}
  }
  $('bake').onclick=()=>bake().catch(()=>{});$('cancel').onclick=()=>{cancelled=true;};
  for(const t of ['webgl','webgpu'])$(t+'Zip').onclick=()=>buildPackage(t).catch(()=>{});
  root.SnowExports=Object.freeze({bake,buildPackage});return root.SnowExports;
 }
 return {manifest,packageEntries,bind};
});
