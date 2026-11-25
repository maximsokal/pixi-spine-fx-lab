// Isolated renderer adapter and developer archive. No live scene ownership.
(function(root){
 'use strict';
 const X=root.FxDashExport,enc=s=>new TextEncoder().encode(s);
 const files=['curve-core.js','spacing-core.js','color-core.js','path-core.js','dash-core.js','dash-runtime.js','dash-spine.js'];
 const demo=`import * as PIXI from 'pixi.js';
import * as spine from '@esotericsoftware/spine-pixi-v8';
import './curve-core.js';
import './spacing-core.js';
import './color-core.js';
import './path-core.js';
import './dash-core.js';
import './dash-spine.js';
import './dash-runtime.js';
const {FxDash,FxDashSpine,FxDashRuntime}=globalThis;
const actual=r=>r.gl?(r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
// The exported controller owns a private scene; no window application state.
export async function startDashDemo({preset,mount,baseURL=document.baseURI}){
 const config=structuredClone(preset),settings=FxDash.compile(config.settings).settings;
 if(config.schemaVersion!==1||config.effectId!=='fx.game.teleport-dash'||!['webgl','webgpu'].includes(config.rendererPreference))throw Error('Invalid Dash preset');
 async function start(preference){
  const app=new PIXI.Application();
  try{await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference,preferWebGLVersion:2});return app;}
  catch(e){if(app.renderer)app.destroy(true,{children:true});throw e;}
 }
 let app,asset=null,fx=null,dead=false,playing=false,last=null,request=0,time=0;
 try{
  try{app=await start(config.rendererPreference);}catch(e){if(config.rendererPreference!=='webgpu')throw e;app=await start('webgl');}
  const backend=actual(app.renderer);
  if(config.rendererPreference==='webgl'&&backend==='webgpu')throw Error('Unexpected WebGPU backend');
  const load=async relative=>{if(typeof relative!=='string'||!/^assets\\/(?:skeleton\\.(?:json|skel|atlas)|page_\\d{3}\\.(?:png|webp|jpg|jpeg))$/.test(relative))throw Error('Invalid asset path');const res=await fetch(new URL(relative,baseURL));if(!res.ok)throw Error('Missing '+relative);return res.blob();};
  const options=config.asset?.options||{};
  if(config.asset){const a=config.asset;asset=await FxDashSpine.create({name:a.sourceSkeletonName,skeleton:await load(a.skeleton),atlas:await load(a.atlas),images:new Map(await Promise.all(a.images.map(async i=>[i.name,await load(i.path)])))},{PIXI,spine,URL,Image,TextDecoder},{skin:options.skin});asset.checkReplay([(settings.durationFrames-1)/60],options);app.stage.addChild(asset.model);}
  fx=FxDashRuntime.createDash({PIXI,host:app.stage,settings,asset,poseOptions:options});
  const end=(settings.durationFrames-1)/60;
  function seek(t){if(dead||!Number.isFinite(t))throw Error('Invalid seek time or destroyed demo');const next=Math.max(0,Math.min(end,t));if(asset)asset.poseAt(next,options);const s=fx.seek(next);app.render();time=next;return structuredClone(s);}
  function pause(){playing=false;last=null;cancelAnimationFrame(request);}
  function tick(now){if(!playing)return;try{if(last!==null){seek(time+Math.min(.25,(now-last)/1000));if(time>=end){pause();return;}}last=now;request=requestAnimationFrame(tick);}catch(e){pause();console.error(e);}}
  function play(){if(dead)throw Error('Destroyed demo');pause();if(time>=end)seek(0);playing=true;request=requestAnimationFrame(tick);}
  function destroy(){if(dead)return;dead=true;pause();try{fx?.destroy();}finally{try{asset?.destroy();}finally{app.destroy(true,{children:true});}}}
  seek(config.previewSeconds);mount.append(app.canvas);
  return Object.freeze({backend,get preset(){return structuredClone(config)},get time(){return time},get playing(){return playing},get asset(){return asset?{version:asset.version,pages:asset.pages}:null},seek,play,pause,destroy});
 }catch(e){try{fx?.destroy();}finally{try{asset?.destroy();}finally{if(app?.renderer)app.destroy(true,{children:true});}}throw e;}
}
async function main(){
 const response=await fetch('./preset.json');if(!response.ok)throw Error('Missing preset.json');
 const controller=await startDashDemo({preset:await response.json(),mount:document.getElementById('preview')});
 const $=id=>document.getElementById(id),frame=$('frame');frame.max=(controller.preset.settings.durationFrames-1)/60;frame.value=controller.time;
 $('backend').textContent=controller.backend;$('asset').textContent=controller.asset?controller.asset.version+' / '+controller.asset.pages+' pages':'No asset';
 $('play').onclick=()=>controller.play();$('pause').onclick=()=>controller.pause();$('reset').onclick=()=>{controller.pause();controller.seek(0);frame.value=0;};
 frame.oninput=()=>{controller.pause();controller.seek(Number(frame.value));frame.value=controller.time;};
 let raf=0;function update(){if(controller.playing)frame.value=controller.time;raf=requestAnimationFrame(update);}raf=requestAnimationFrame(update);
 $('destroy').onclick=()=>{cancelAnimationFrame(raf);controller.destroy();for(const id of ['play','pause','reset','frame','destroy'])$(id).disabled=true;};
}
main().catch(e=>{console.error(e);document.getElementById('backend').textContent=e.message;});
`;
 async function developer({settings,target,source,options,assetInfo,previewSeconds,crop,frameCount,sources,licenses}){
  if(!['webgl','webgpu'].includes(target))throw Error('Invalid developer target');
  const normalized=FxDash.compile(settings).settings;
  if(!Number.isFinite(previewSeconds)||previewSeconds<0||previewSeconds>(normalized.durationFrames-1)/60)throw Error('Invalid preview time');
  if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>3600)throw Error('Invalid frame count');
  if(!crop||Object.keys(crop).length!==4||!['x','y','width','height'].every(k=>Number.isSafeInteger(crop[k]))||Math.abs(crop.x)>16384||Math.abs(crop.y)>16384||crop.width<1||crop.height<1||crop.width>4096||crop.height>4096)throw Error('Invalid crop');
  if(source&&(!options||typeof options.animation!=='string'||typeof options.skin!=='string'||!Number.isFinite(options.speed)||options.speed<0||options.speed>10||typeof options.loop!=='boolean'||typeof options.visible!=='boolean'))throw Error('Invalid Spine options');
  const preset={schemaVersion:1,effectId:'fx.game.teleport-dash',rendererPreference:target,settings:normalized,previewSeconds,crop:crop==null?crop:{...crop},frameCount,asset:null,compatibility:{pixi:'8.22.0',spine:'4.2.120'}};
  const MiB=1024*1024;
  const entries=[],add=(name,data)=>entries.push({name,data:typeof data==='string'?enc(data):data});
  // Capture source strings and all mutable metadata before any asynchronous reads.
  for(const name of files){if(typeof sources?.[name]!=='string'||!sources[name].trim())throw Error('Missing source '+name);add(name,sources[name])}
  if(typeof licenses!=='string'||!licenses.trim())throw Error('Missing runtime notices');
  if(source){
   const {name,skeleton,atlas}=source;
   if(typeof name!=='string'||!/\.(json|skel)$/i.test(name)||!(source.images instanceof Map)||!source.images.size||source.images.size>64)throw Error('Invalid Spine asset');
   const images=[...source.images],sizes=new Map();let imageBytes=0;
   const validate=(b,max)=>{if(!b||!Number.isSafeInteger(b.size)||b.size<1||b.size>max||typeof b.arrayBuffer!=='function')throw Error('Invalid asset size');sizes.set(b,b.size);return b.size;};
   const skeletonSize=validate(skeleton,64*MiB),atlasSize=validate(atlas,4*MiB);
   for(const [key,b] of images){if(typeof key!=='string'||!key.trim())throw Error('Invalid image key');imageBytes+=validate(b,192*MiB);}
   // Reserve package metadata and source code before reading potentially large Blobs.
   const sourceBytes=entries.reduce((n,e)=>n+e.data.length,0)+enc(licenses).length;
   if(imageBytes>192*MiB||skeletonSize+atlasSize+imageBytes+sourceBytes>240*MiB)throw Error('Asset budget exceeded');
   const ext=/\.skel$/i.test(name)?'skel':'json';
   if(typeof assetInfo?.version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(assetInfo.version))throw Error('Invalid Spine version');
   preset.asset={sourceSkeletonName:name,sourceAtlasName:atlas.name||'sample.atlas',version:assetInfo.version,skeleton:'assets/skeleton.'+ext,atlas:'assets/skeleton.atlas',images:[],options:{animation:options.animation,skin:options.skin,speed:options.speed,loop:options.loop,visible:options.visible}};
   const blob=async(name,b)=>{const data=new Uint8Array(await b.arrayBuffer());if(data.length!==sizes.get(b))throw Error('Asset size changed');add(name,data)};
   await blob('public/'+preset.asset.skeleton,skeleton);await blob('public/'+preset.asset.atlas,atlas);
   let i=0;for(const [name,b] of images){
    const suffix=/\.(png|webp|jpe?g)$/i.exec(name)?.[1].toLowerCase()||'png',path='assets/page_'+String(i++).padStart(3,'0')+'.'+suffix;
    preset.asset.images.push({name,path});await blob('public/'+path,b);
   }
  }
  const json=JSON.stringify(preset,null,2);add('preset.json',json);add('public/preset.json',json);
  add('package.json',JSON.stringify({name:'dash-'+target,private:true,type:'module',scripts:{dev:'vite',build:'vite build --base ./',preview:'vite preview'},dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2));
  add('example.js',demo);add('LICENSES.txt',licenses);
  add('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Teleport and Dash Trail</title><style>body{background:#18202d;color:white;font:16px system-ui}canvas{display:block}</style><button id="play">Play</button><button id="pause">Pause</button><button id="reset">Reset</button><label>Time (s) <input id="frame" type="range" min="0" max="1" step="any"></label><button id="destroy">Destroy</button><output id="backend">Loading</output><output id="asset"></output><div id="preview"></div><script type="module" src="./example.js"></script></html>');
  add('README.md',"# Teleport and Dash Trail developer example\n\nInstall the pinned dependencies with npm install, then npm run dev. npm run build creates a static deployment; serve the dist directory over HTTP. WebGPU is preferred only in the WebGPU archive; WebGL is the fallback. The actual backend is displayed.\n\nOriginal Spine JSON/SKEL and atlas bytes and original atlas page lookup keys are preserved with safe file aliases. The selected skin is applied before fitting. Coordinates are authored pixels in a 512x512 plane. Source pose and historical echoes use independent Skeleton/AnimationState instances and absolute fixed-60Hz reset/replay; source visibility is independent of echoes. The effect is a one-shot (Dash or Teleport), clamped at (durationFrames-1)/60; the selected Spine animation may loop independently. SourceSeconds in the numeric schedule is before animation speed. Update source pose first, then fx.seek(seconds). No static speed lines or cross-jump ribbon. Colors are straight RGBA; Pixi handles premultiplication. Positive uniform scale and rotation, not affine shear. Crop and frameCount are metadata for handoff; the example previews the full authored plane. CSS canvas resizing changes display only. Use the exported startDashDemo({preset,mount,baseURL}) controller for external seek(seconds), play(), pause(), and destroy(); example.js also mounts the provided demo UI. Destroy FX before releasing the asset textures. No physical-device performance guarantee.\n");
  return {zip:X.makeZip(entries),preset};
 }
 root.FxDashExportBrowser=Object.freeze({developer});
})(globalThis);