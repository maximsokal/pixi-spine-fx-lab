// AIR-03 — isolated bake and exact-source developer packages.
(function(root,factory){
 const api=Object.freeze(factory(root,root.FxBlizzard||(typeof require==='function'?require('./blizzard-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.FxBlizzardExport=api;api.bind(root.BlizzardEditor);}
})(globalThis,function(root,Core){
 'use strict';
 const ID='fx.air.blizzard';
 function safe(name){
  if(typeof name!=='string')throw Error('Invalid asset path');const n=name.replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[A-Za-z]:/.test(n)||n.split('/').some(x=>!x||x==='.'||x==='..')||/[\x00-\x1f\x7f]/.test(n))throw Error('Unsafe asset path '+name);
  return n;
 }
 function assetArchive(asset){
  const portable=n=>n.length<=220&&/^[A-Za-z0-9._/-]+$/.test(n)&&n.split('/').every(p=>!p.endsWith('.')&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
  const used=new Set(),conflict=n=>{const x=n.toLowerCase();return [...used].some(k=>k===x||k.startsWith(x+'/')||x.startsWith(k+'/'));};
  function reserve(name,fallback,ext){const n=safe(name);let path=n,i=0;if(!portable(n)||conflict(n)){path=fallback+'.'+ext;while(conflict(path))path=fallback+'_'+String(++i).padStart(3,'0')+'.'+ext;}used.add(path.toLowerCase());return 'assets/'+path;}
  const sk=safe(asset.skeletonName),at=safe(asset.atlasName);
  const ext=/\.(json|skel)$/i.exec(sk);if(!ext||! /\.atlas$/i.test(at))throw Error('Invalid skeleton or atlas extension');
  const skeleton=reserve(sk,'skeleton',ext[1].toLowerCase()),atlas=reserve(at,'skeleton','atlas');
  if(!Array.isArray(asset.pageBindings)||!asset.pageBindings.length||!(asset.images instanceof Map))throw Error('Missing accepted atlas page bindings');
  const seen=new Set(),keys=new Set(),pages=[];
  for(const {name,key} of asset.pageBindings){
   const n=safe(name),type=/\.(png|webp|jpe?g)$/i.exec(n);
   if(!type||seen.has(n)||keys.has(key)||!asset.images.get(key))throw Error('Invalid accepted atlas page binding '+name);
   seen.add(n);keys.add(key);pages.push({name,path:reserve(n,'page_'+String(pages.length).padStart(3,'0'),type[1].toLowerCase()),data:asset.images.get(key)});
  }
  return {skeleton,atlas,pages};
 }
 function manifest(settings,backend,frames){
  const c=Core.createPlan(settings).settings;
  if(!['webgl1','webgl2','webgpu'].includes(backend?.actual)||!Number.isInteger(frames)||frames<1||frames>c.exportFrames)throw RangeError('AIR-03 invalid frame count');
  return {schemaVersion:1,effectId:ID,settings:c,backend,width:512,height:512,fps:60,frameCount:frames,
   alpha:'straight-rgba8',crop:{x:0,y:0,width:512,height:512},authoredFrames:c.durationFrames,terminalSeconds:c.mode==='oneShot'?(c.durationFrames-1)/60:null,frameFormula:'frameIndex/60',cropPolicy:'Fixed authoring field 512x512; particles enter/leave field intentionally; no Spine pixels, camera, guides or preview background',
   loopPolicy:c.mode==='loop'?'periodic-half-open':'one-shot-stop-fade',
   frames:Array.from({length:frames},(_,frame)=>({frame,file:'frames/'+String(frame).padStart(4,'0')+'.png',timeSeconds:frame/60}))};
 }
 function packageEntries({settings,asset=null,source,target}){
  if(!['webgl','webgpu'].includes(target))throw TypeError('AIR-03 invalid target');
  const c=Core.createPlan(settings).settings;
  const paths=asset?assetArchive(asset):null;
  const preset={schemaVersion:1,effectId:ID,settings:c,rendererPreference:target,
   compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   asset:asset?{skeleton:paths.skeleton,atlas:paths.atlas,sourceSkeletonName:asset.skeletonName,sourceAtlasName:asset.atlasName,pages:paths.pages.map(({name,path})=>({name,path})),skin:asset.skin||'',animation:asset.animation||''}:null};
  const json=JSON.stringify(preset,null,2);
  const originalSource=source;source=id=>{const value=originalSource(id);if(typeof value!=='string'||!value.trim())throw Error('Missing module '+id);return value;};
  const demo=[
   "import * as PIXI from 'pixi.js';",
   "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
   "import { FxBlizzard, createBlizzard } from './Blizzard.mjs';",
   "import { FxBlizzardPose } from './FxBlizzardPose.mjs';",
   "let app=null,fx=null;function cleanup(){const effect=fx,application=app;fx=null;app=null;try{effect?.destroy();}finally{if(application?.renderer)application.destroy(true,{children:true});}}",
   "async function main(){",
   " const response=await fetch('./preset.json');if(!response.ok)throw Error('Preset load failed');const p=await response.json();if(p.schemaVersion!==1||p.effectId!=='fx.air.blizzard')throw Error('Invalid Blizzard preset');",
   " app=new PIXI.Application();await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:'"+target+"',preferWebGLVersion:2,autoStart:false,sharedTicker:false});",
   " const actual=app.renderer.gl?'webgl':app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown';",
   " if(actual!==p.rendererPreference)throw Error('Renderer mismatch: '+actual);document.getElementById('backend').textContent=app.renderer.gl?(typeof WebGL2RenderingContext!=='undefined'&&app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):actual;",
   " document.body.append(app.canvas);const host=new PIXI.Container();app.stage.addChild(host);let model=null;",
   " if(p.asset){PIXI.Assets.add({alias:'blizzard-skel',src:p.asset.skeleton});PIXI.Assets.add({alias:'blizzard-atlas',src:p.asset.atlas,data:{images:Object.fromEntries(p.asset.pages.map(({name,path})=>[name,path]))}});await PIXI.Assets.load(['blizzard-skel','blizzard-atlas']);",
   " model=SpineRuntime.Spine.from({skeleton:'blizzard-skel',atlas:'blizzard-atlas',autoUpdate:false});host.addChild(model);model.update(0);",
   " const b=model.getLocalBounds();if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0)throw Error('Empty Spine skeleton');const scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
   " }",
   " const settings=FxBlizzard.normalize(p.settings);fx=createBlizzard({PIXI,app,host,model,settings});let t=0;",
   " if(model)FxBlizzardPose.seek(model,settings,0,p.asset);fx.seek(0);if(fx.diagnostics.length)throw Error('Unresolved Blizzard anchor');app.render();",
   " app.ticker.add(ticker=>{t+=ticker.elapsedMS/1000;t=settings.mode==='loop'?t%(settings.durationFrames/60):Math.min((settings.durationFrames-1)/60,t);if(model)FxBlizzardPose.seek(model,settings,t,p.asset);fx.seek(t);});",
   " window.addEventListener('pagehide',cleanup,{once:true});app.start();document.getElementById('backend').dataset.state='ready';",
   "}main().catch(e=>{try{cleanup();}finally{const status=document.getElementById('backend');status.dataset.state='error';status.textContent=e.message;console.error(e);}});"
  ].join('\n');
  const entries=[
   {name:'preset.json',data:json},{name:'public/preset.json',data:json},
   {name:'FxCurves.mjs',data:source('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+source('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+source('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxBlizzardPose.mjs',data:source('fxBlizzardPose')+'\nexport const FxBlizzardPose=globalThis.FxBlizzardPose;\n'},
   {name:'FxBlizzard.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+source('fxBlizzardCore')+'\nexport const FxBlizzard=globalThis.FxBlizzard;\n'},
   {name:'Blizzard.mjs',data:"import './FxBlizzard.mjs';\n"+source('fxBlizzardRuntime')+'\nexport const FxBlizzard=globalThis.FxBlizzard;\nexport const createBlizzard=globalThis.FxBlizzardRuntime.createBlizzard;\n'},
   {name:'example.js',data:demo},
   {name:'LICENSES.txt',data:source('runtimeLicenses')},
   {name:'README.md',data:'# AIR-03 Blizzard\nExact shared numerical core and native particle runtime. For a network-independent demo run python -m http.server 8000 --directory public and open http://localhost:8000/offline.html. For development install pinned dependencies (npm install --offline if cached), npm run dev, npm run build. Backend mismatch is an error. Actual GPU and Vite builds require verification.\n'},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-blizzard-'+target,private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><title>Blizzard</title><output id="backend" data-state="loading">Starting</output><script type="module" src="/example.js"></script></html>'}
  ];
  const offlineDemo=demo.split('\n').filter(line=>!line.startsWith('import ')).join('\n').replace('async function main(){','const PIXI=globalThis.PIXI,SpineRuntime=globalThis.spine,FxBlizzard=globalThis.FxBlizzard,createBlizzard=globalThis.FxBlizzardRuntime.createBlizzard,FxBlizzardPose=globalThis.FxBlizzardPose;\nasync function main(){');
  entries.push({name:'public/offline.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><title>Blizzard offline demo</title><output id="backend" data-state="loading">Starting</output>'+['pixi','spine','curves','spacing','colors','core','runtime','pose','demo'].map(n=>'<script src="./offline/'+n+'.js"></script>').join('')+'</html>'});
  for(const [name,id] of [['pixi','blizzardPixiVendor'],['spine','blizzardSpineVendor'],['curves','fxCurveCore'],['spacing','fxSpacingCore'],['colors','fxColorCore'],['core','fxBlizzardCore'],['runtime','fxBlizzardRuntime'],['pose','fxBlizzardPose']])entries.push({name:'public/offline/'+name+'.js',data:source(id)});
  entries.push({name:'public/offline/demo.js',data:'(function(){\n'+offlineDemo+'\n})();'});
  if(asset){entries.push({name:'public/'+paths.skeleton,data:asset.skeleton},{name:'public/'+paths.atlas,data:asset.atlas});
   for(const p of paths.pages)entries.push({name:'public/'+p.path,data:p.data});}
  if(new Set(entries.map(e=>e.name)).size!==entries.length)throw Error('Duplicate package path');
  return {preset,entries};
 }
 async function readFrame(scene,backend){
  const renderer=scene.app.renderer,tex=renderer.extract.texture({target:scene.app.stage,frame:new root.PIXI.Rectangle(0,0,512,512),resolution:1,clearColor:[0,0,0,0],antialias:backend!=='webgl1'});
  try{const p=await renderer.extract.pixels(tex);if(p.width!==512||p.height!==512)throw Error('Unexpected bake dimensions');
   return {pixels:p.pixels,width:p.width,height:p.height,alpha:backend==='webgpu'?'straight':'premultiplied'};
  }finally{tex.destroy(true);}
 }
 async function bakeSequence({settings,backend,asset=null,frames=null,createScene,codec,zip,signal,progress=()=>{},yieldFrame=()=>Promise.resolve(),deflate,pngLimit=192*1048576}){
  const check=()=>{if(signal?.aborted)throw Error('Blizzard bake cancelled');};check();
  if(!Number.isSafeInteger(pngLimit)||pngLimit<1||pngLimit>192*1048576)throw Error('Invalid PNG budget');
  const m=manifest(settings,{actual:backend?.actual,requested:backend?.requested??backend?.actual,pixi:backend?.pixi??'8.22.0'},frames??settings.exportFrames),entries=[];let scene,error,blob,total=0;
  m.asset=asset?{skeletonName:asset.skeletonName,atlasName:asset.atlasName,skin:asset.skin||'',animation:asset.animation||'',pages:asset.pageBindings.map(({name,key})=>({name,key}))}:null;
  try{
   scene=await createScene(m.settings,m.backend.actual,asset);check();
   if(!scene||scene.backend!==m.backend.actual||JSON.stringify(scene.settings)!==JSON.stringify(m.settings))throw Error('Bake renderer/settings mismatch');
   for(const f of m.frames){check();const frame=await scene.readFrame(f.timeSeconds);check();
    if(frame.width!==512||frame.height!==512||frame.alpha!==(m.backend.actual==='webgpu'?'straight':'premultiplied'))throw Error('Bake readback contract mismatch');
    const data=await codec.encodePng(frame,deflate);check();total+=data.length;if(total>pngLimit)throw Error('PNG sequence exceeds budget');
    entries.push({name:f.file,data});progress(f.frame+1,m.frameCount);await yieldFrame();check();
   }
   entries.push({name:'sequence.json',data:JSON.stringify(m,null,2)});blob=await zip.makeZip(entries,check);check();
  }catch(e){error=e;throw e;}finally{if(scene)try{await scene.dispose();}catch(cleanup){if(error)throw new AggregateError([error,cleanup],'Blizzard bake and cleanup failed');throw cleanup;}}
  check();return {manifest:m,entries,blob};
 }
 function bind(editor){
  const $=id=>document.getElementById(id),zip=root.FxBlizzardZip,codec=root.FxBlizzardPng;
  let cancelled=false;
  async function bake({download=true,frames=null}={}){
   if(editor.busy||!editor.scene)throw Error('Blizzard renderer unavailable or busy');
   const settings=editor.getSettings(),asset=editor.asset,preview=editor.getActualBackend(),wasPlaying=editor.session.playing;
   cancelled=false;editor.stop();editor.setBusy(true);$('cancel').disabled=false;
   const signal={get aborted(){return cancelled;}};
   try{
    const result=await bakeSequence({settings,backend:preview,asset,frames,codec,zip,signal,
     createScene:async(c,backend,source)=>{
      const scene=await editor.makeScene(backend,source,c,source?.skin,source?.animation);
      try{scene.host.renderable=false;
       return {backend:scene.actual.actual,settings:scene.fx.settings,dispose:()=>scene.dispose(),async readFrame(t){
        if(scene.model)root.FxBlizzardPose.seek(scene.model,c,t,source);
        scene.fx.seek(t);if(scene.fx.diagnostics.length)throw Error('Unresolved Blizzard anchor');
        return readFrame(scene,backend);
       }};
      }catch(e){scene.dispose();throw e;}
     },progress:(done,count)=>editor.status('Baking '+done+' / '+count),yieldFrame:()=>new Promise(resolve=>setTimeout(resolve,0))});
    if(cancelled)throw Error('Blizzard bake cancelled');if(download)zip.download(result.blob,'Blizzard_'+result.manifest.frameCount+'_PNG.zip');
    editor.status('Blizzard PNG ZIP ready');return result;
   }catch(e){editor.status(e.message,true);throw e;}
   finally{$('cancel').disabled=true;editor.setBusy(false);if(wasPlaying)editor.session.play();editor.refreshTime();}
  }
  async function buildPackage(target,download=true){
   if(editor.busy)throw Error('Blizzard busy');const wasPlaying=editor.session.playing;editor.stop();editor.setBusy(true);cancelled=false;$('cancel').disabled=false;
   const check=()=>{if(cancelled)throw Error('Blizzard package cancelled');};
   try{const p=packageEntries({settings:editor.getSettings(),asset:editor.asset,source:id=>$(id).textContent,target});
    const blob=await zip.makeZip(p.entries,check);check();if(download)zip.download(blob,'Blizzard_'+target+'.zip');
    editor.status('Developer ZIP ready');return {...p,blob};
   }catch(e){editor.status(e.message,true);throw e;}finally{$('cancel').disabled=true;editor.setBusy(false);if(wasPlaying)editor.session.play();editor.refreshTime();}
  }
  $('bake').onclick=()=>bake().catch(()=>{});$('cancel').onclick=()=>{cancelled=true;};
  for(const t of ['webgl','webgpu'])$(t+'Zip').onclick=()=>buildPackage(t).catch(()=>{});
  root.BlizzardExports=Object.freeze({bake,buildPackage});return root.BlizzardExports;
 }
 return {manifest,assetArchive,packageEntries,bakeSequence,readFrame,bind};
});
