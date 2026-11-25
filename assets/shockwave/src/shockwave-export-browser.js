// Isolated renderer adapter and developer archive. No live scene ownership.
(function(root){
 'use strict';
 const X=root.FxShockwaveExport,enc=s=>new TextEncoder().encode(s);
 const files=['curve-core.js','color-core.js','timeline-core.js','shockwave-core.js','shockwave-runtime.js','shockwave-spine.js'];
 const demo=`import * as PIXI from 'pixi.js';
import * as spine from '@esotericsoftware/spine-pixi-v8';
import './curve-core.js';
import './color-core.js';
import './timeline-core.js';
import './shockwave-core.js';
import './shockwave-runtime.js';
import './shockwave-spine.js';
Object.assign(globalThis,{PIXI,spine});
async function main(){
 const preset=await (await fetch('./preset.json')).json();
 const actual=r=>r.gl?(r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
 async function start(preference){
  const app=new PIXI.Application();
  try{await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference,preferWebGLVersion:2});return app;}
  catch(e){if(app.renderer)app.destroy(true,{children:true});throw e;}
 }
 let app;
 try{app=await start(preset.rendererPreference)}catch(e){if(preset.rendererPreference!=='webgpu')throw e;app=await start('webgl')}
 document.body.append(app.canvas);
 const load=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Missing '+url);return r.blob()};
 let asset=null;
 if(preset.asset){
  const a=preset.asset;
  asset=await FxShockwaveSpine.create({name:a.sourceSkeletonName,skeleton:await load(a.skeleton),atlas:await load(a.atlas),images:new Map(await Promise.all(a.images.map(async i=>[i.name,await load(i.path)])))});
  app.stage.addChild(asset.model);
 }
 const fx=FxShockwaveRuntime.createShockwave({PIXI,host:app.stage,settings:preset.settings});
 let time=preset.previewSeconds,playing=false,last=null,request=0,dead=false;
 function seek(t){if(!Number.isFinite(t))throw Error("Invalid seek time");time=Math.max(0,Math.min((preset.settings.durationFrames-1)/60,t));const poses=asset?FxShockwaveSpine.pose(asset,time,preset.asset.options):{};const s=fx.seek(time,poses);app.render();return s}
 function stop(){playing=false;last=null;cancelAnimationFrame(request)}
 function tick(now){if(!playing)return;if(last!==null){const end=(preset.settings.durationFrames-1)/60;const next=time+Math.min(.25,(now-last)/1000);seek(Math.min(end,next));if(time>=end){stop();return}}last=now;request=requestAnimationFrame(tick)}
 function play(){stop();if(time>=(preset.settings.durationFrames-1)/60)seek(0);playing=true;request=requestAnimationFrame(tick)}
 function destroy(){if(dead)return;dead=true;stop();fx.destroy();asset?.destroy();app.destroy(true,{children:true})}
 Object.defineProperty(globalThis,"shockwaveDemo",{value:Object.freeze({backend:actual(app.renderer),get preset(){return structuredClone(preset)},seek,play,pause:stop,destroy,get sample(){return structuredClone(fx.sample)},get asset(){return asset?{version:asset.version,pages:asset.pages}:null}})});
 seek(time);document.getElementById('play').onclick=play;document.getElementById('pause').onclick=stop;document.getElementById('reset').onclick=()=>{stop();seek(0)};
 document.getElementById('backend').textContent=actual(app.renderer);
}
main().catch(e=>{console.error(e);document.getElementById('backend').textContent=e.message});
`;
 async function developer({settings,target,source,options,assetInfo,previewSeconds,crop,frameCount,sources,licenses}){
  if(!['webgl','webgpu'].includes(target))throw Error('Invalid developer target');
  if(!Number.isFinite(previewSeconds)||previewSeconds<0||previewSeconds>39/60)throw Error('Invalid preview time');
  if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>3600)throw Error('Invalid frame count');
  if(!crop||Object.keys(crop).length!==4||!['x','y','width','height'].every(k=>Number.isSafeInteger(crop[k]))||Math.abs(crop.x)>16384||Math.abs(crop.y)>16384||crop.width<1||crop.height<1||crop.width>4096||crop.height>4096)throw Error('Invalid crop');
  if(source&&(!options||typeof options.animation!=='string'||typeof options.skin!=='string'||!Number.isFinite(options.speed)||options.speed<.1||options.speed>4||typeof options.visible!=='boolean'))throw Error('Invalid Spine options');
  const preset={schemaVersion:1,effectId:'fx.game.shockwave',rendererPreference:target,settings:FxShockwave.createPlan(settings).settings,previewSeconds,crop:crop==null?crop:{...crop},frameCount,asset:null,compatibility:{pixi:'8.22.0',spine:'4.2.120'}};
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
   preset.asset={sourceSkeletonName:name,sourceAtlasName:atlas.name||'sample.atlas',version:assetInfo.version,skeleton:'assets/skeleton.'+ext,atlas:'assets/skeleton.atlas',images:[],options:{animation:options.animation,skin:options.skin,speed:options.speed,visible:options.visible}};
   const blob=async(name,b)=>{const data=new Uint8Array(await b.arrayBuffer());if(data.length!==sizes.get(b))throw Error('Asset size changed');add(name,data)};
   await blob('public/'+preset.asset.skeleton,skeleton);await blob('public/'+preset.asset.atlas,atlas);
   let i=0;for(const [name,b] of images){
    const suffix=/\.(png|webp|jpe?g)$/i.exec(name)?.[1].toLowerCase()||'png',path='assets/page_'+String(i++).padStart(3,'0')+'.'+suffix;
    preset.asset.images.push({name,path});await blob('public/'+path,b);
   }
  }
  const json=JSON.stringify(preset,null,2);add('preset.json',json);add('public/preset.json',json);
  add('package.json',JSON.stringify({name:'shockwave-'+target,private:true,type:'module',scripts:{dev:'vite',build:'vite build',preview:'vite preview'},dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2));
  add('example.js',demo);add('LICENSES.txt',licenses);
  add('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Shockwave Ring</title><style>body{background:#18202d;color:white;font:16px system-ui}canvas{display:block}</style><button id="play">Play</button><button id="pause">Pause</button><button id="reset">Reset</button><output id="backend">Loading</output><script type="module" src="./example.js"></script></html>');
  add('README.md','# Shockwave Ring developer example\n\nInstall exact pinned dependencies with npm install, then npm run dev. npm run build creates a static deployment; no external runtime requests. WebGPU requires a secure context; WebGL is fallback. Actual backend is displayed. Original Spine bytes and page keys are preserved, paths aliased safely. Coordinates are authored pixels in a 512x512 plane. Update the Spine pose first, then fx.seek(seconds, poses). The core uses 60 FPS authoring, absolute time and seeded schedules. Crop and frameCount are handoff metadata; this example previews the full 512x512 authored scene. Render at your own tick rate. Camera and crop are separate. Use straight RGBA colors; Pixi handles premultiplication. Destroy effect and asset independently on removal. Bone offsets use positive uniform scale and rotation, not full affine shear. No physical-device performance guarantee.\n');
  return {zip:X.makeZip(entries),preset};
 }
 root.FxShockwaveExportBrowser=Object.freeze({developer});
})(globalThis);