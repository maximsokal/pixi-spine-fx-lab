// GAME-10 P04d: developer archive, separate from editor and renderer ownership.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPoisonDeveloper=api;})(globalThis,function(){
 'use strict';
 const FILES=Object.freeze(['curve-core.js','spacing-core.js','color-core.js','timeline-core.js','shockwave-spine.js','poison-core.js','poison-runtime.js','poison-authoring.js']);
 const enc=s=>new TextEncoder().encode(s),MiB=1048576,copy=v=>JSON.parse(JSON.stringify(v)),fail=m=>{throw Error('Poison developer export: '+m);};
 const controller=`import * as PIXI from 'pixi.js';
import * as spine from '@esotericsoftware/spine-pixi-v8';
${FILES.map(n=>"import './"+n+"';").join('\n')}
// Legacy offline loader resolves these runtime namespaces; no application state is global.
Object.assign(globalThis,{PIXI,spine});
const {FxPoison:S,FxPoisonRuntime:R,FxPoisonAuthoring:U,FxShockwaveSpine:Sp}=globalThis;
export async function startPoisonDemo({preset,mount,baseURL=document.baseURI}){
 const p=structuredClone(preset),settings=S.compile(p.settings).settings;
 if(p.schemaVersion!==1||p.effectId!=='fx.game.poison-cloud'||!['webgl','webgpu'].includes(p.rendererPreference))throw Error('Invalid preset');
 const actual=r=>r.gl?(r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
 async function start(preference){const app=new PIXI.Application();try{await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference,preferWebGLVersion:2});if(preference==='webgl'&&actual(app.renderer)==='webgpu')throw Error('Expected WebGL');return app;}catch(e){if(app.renderer)app.destroy(true,{children:true});throw e;}}
 let app,fx,asset,dead=false,playing=false,last=null,raf=0,time=0;
 function pause(){playing=false;last=null;cancelAnimationFrame(raf);}
 function destroy(){if(dead)return;dead=true;pause();try{fx?.destroy();}finally{try{asset?.destroy();}finally{if(app?.renderer)app.destroy(true,{children:true});}}}
 try{
  try{app=await start(p.rendererPreference);}catch(e){if(p.rendererPreference!=='webgpu')throw e;app=await start('webgl');}
  const behind=new PIXI.Container(),models=new PIXI.Container(),front=new PIXI.Container();app.stage.addChild(behind,models,front);
  const load=async path=>{if(!/^assets\\/(skeleton\\.(json|skel|atlas)|page_\\d{3}\\.(png|webp|jpg|jpeg))$/.test(path))throw Error('Invalid asset path');const res=await fetch(new URL(path,baseURL));if(!res.ok)throw Error('Missing '+path);return res.blob();};
  if(p.asset){const a=p.asset;asset=await Sp.create({name:a.sourceSkeletonName,skeleton:await load(a.skeleton),atlas:await load(a.atlas),images:new Map(await Promise.all(a.images.map(async i=>[i.name,await load(i.path)])))});models.addChild(asset.model);}
  fx=R.createPoison({PIXI,front,behind,settings});
  function seek(t){if(dead||!Number.isFinite(t))throw Error('Invalid seek');time=U.advance(t,0,settings);const state=fx.seek(time,U.poseMap(U.pose(asset,time,p.asset?.options,Sp)));app.render();return state;}
  function tick(now){if(!playing)return;try{if(last!==null){seek(time+Math.min(.1,(now-last)/1000));if(settings.mode==='oneShot'&&time>=U.lastFrame(settings)/60){pause();return;}}last=now;raf=requestAnimationFrame(tick);}catch(e){pause();console.error(e);}}
  function play(){if(dead)throw Error('Destroyed demo');pause();if(settings.mode==='oneShot'&&time>=U.lastFrame(settings)/60)seek(0);playing=true;raf=requestAnimationFrame(tick);}
  seek(p.previewSeconds);mount.append(app.canvas);return Object.freeze({backend:actual(app.renderer),get time(){return time;},seek,play,pause,destroy});
 }catch(e){destroy();throw e;}
}
`;
 const demo=`import {startPoisonDemo} from './poison-demo.js';
async function main(){const $=id=>document.getElementById(id),res=await fetch('./preset.json');if(!res.ok)throw Error('Missing preset');const c=await startPoisonDemo({preset:await res.json(),mount:$('preview')});$('backend').textContent=c.backend;$('play').onclick=c.play;$('pause').onclick=c.pause;$('reset').onclick=()=>{c.pause();c.seek(0);};$('destroy').onclick=()=>{c.destroy();for(const id of ['play','pause','reset','destroy'])$(id).disabled=true;};}
main().catch(e=>{console.error(e);document.getElementById('backend').textContent=e.message;});
`;
 async function developer({target,settings,previewSeconds,crop,frameCount,source=null,options,assetInfo,sources,licenses,compile,cropSpec,makeZip,signal}){
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();if(!['webgl','webgpu'].includes(target))fail('invalid target');
  const normalized=copy(compile(settings).settings),c=copy(cropSpec(crop));
  if(!Number.isFinite(previewSeconds)||previewSeconds<0||(normalized.mode==='loop'?previewSeconds>=normalized.durationFrames/60:previewSeconds>(normalized.durationFrames-1)/60))fail('invalid preview time');
  if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>3600)fail('invalid frame count');
  const preset={schemaVersion:1,effectId:'fx.game.poison-cloud',rendererPreference:target,settings:normalized,previewSeconds,crop:c,frameCount,asset:null,compatibility:{pixi:'8.22.0',spine:'4.2.120'}};
  const entries=[],add=(name,data)=>entries.push({name,data:typeof data==='string'?enc(data):data});
  for(const name of FILES){if(typeof sources?.[name]!=='string'||!sources[name].trim())fail('missing source '+name);add(name,sources[name]);}
  if(typeof licenses!=='string'||!licenses.trim())fail('missing notices');add('LICENSES.txt',licenses);
  if(source){const {name,skeleton,atlas}=source;if(typeof name!=='string'||!/\.(json|skel)$/i.test(name)||!(source.images instanceof Map)||source.images.size<1||source.images.size>64)fail('invalid Spine source');
   if(typeof assetInfo?.version!=='string'||!/^4\.2\.(0|[1-9]\d*)$/.test(assetInfo.version))fail('invalid Spine version');
   if(typeof options?.animation!=='string'||typeof options.skin!=='string'||typeof options.visible!=='boolean'||!Number.isFinite(options.speed)||options.speed<.1||options.speed>4)fail('invalid Spine options');
   const size=(b,max)=>{if(!b||!Number.isSafeInteger(b.size)||b.size<1||b.size>max||typeof b.arrayBuffer!=='function')fail('invalid asset size');return b.size;};
   const skSize=size(skeleton,64*MiB),atSize=size(atlas,4*MiB),pages=[];let total=0;
   for(const [key,b] of source.images){const ext=typeof key==='string'&&/\.(png|webp|jpe?g)$/i.exec(key);if(!ext||!key.trim())fail('invalid image key');const bytes=size(b,192*MiB);total+=bytes;pages.push({name:key,path:'assets/page_'+String(pages.length).padStart(3,'0')+'.'+ext[1].toLowerCase(),b,bytes});}
   if(total>192*MiB||total+skSize+atSize+entries.reduce((n,e)=>n+e.data.length,0)>240*MiB)fail('asset budget');
   preset.asset={sourceSkeletonName:name,version:assetInfo.version,skeleton:'assets/skeleton.'+(/\.skel$/i.test(name)?'skel':'json'),atlas:'assets/skeleton.atlas',images:pages.map(({name,path})=>({name,path})),options:{animation:options.animation,skin:options.skin,speed:options.speed,visible:options.visible}};
   const read=async(path,b,expected)=>{check();const data=new Uint8Array(await b.arrayBuffer());check();if(data.length!==expected)fail('asset size changed');add('public/'+path,data);};
   await read(preset.asset.skeleton,skeleton,skSize);await read(preset.asset.atlas,atlas,atSize);for(const p of pages)await read(p.path,p.b,p.bytes);
  }
  const json=JSON.stringify(preset,null,2);add('preset.json',json);add('public/preset.json',json);
  add('package.json',JSON.stringify({name:'poison-cloud-'+target,private:true,type:'module',scripts:{dev:'vite',build:'vite build --base ./',preview:'vite preview'},dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2));
  add('poison-demo.js',controller);add('example.js',demo);add('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Poison Cloud</title><button id="play">Play</button><button id="pause">Pause</button><button id="reset">Reset</button><button id="destroy">Destroy</button><output id="backend">Loading</output><div id="preview"></div><script type="module" src="./example.js"></script></html>');
  add('README.md','# Poison Cloud developer example\n\nRun npm install and npm run dev; npm run build produces a static HTTP deployment. Runtime dependencies are pinned. WebGPU is preferred only in the WebGPU package; WebGL is fallback. The actual backend is displayed. Source modules and runtime notices are included. Original Spine bytes and page keys are preserved through safe aliases. Authoring coordinates are pixels in a 512x512 plane; crop and frameCount are handoff metadata, not demo viewport size. Update Spine pose first, then seek the poison using seconds and anchor poses. Loop wraps at durationFrames/60; one-shot clamps to the last authored frame. Colors are straight RGBA; Pixi handles premultiplication. CSS resizing is display-only. Import startPoisonDemo from poison-demo.js to create a controller explicitly (example.js is the standalone page entry). It returns seek/play/pause/destroy; destroy FX before asset textures. Spine physics uses the 60 FPS authoring frame grid, resets on backward seeks or animation/skin/speed changes, and subdivides fast animation steps. Physics rigs use frame-snapped poses; actual runtime/GPU acceptance is pending. No GPU or device performance guarantee.\n');
  check();const zip=makeZip(entries,check);check();return {zip,preset};
 }
 return {FILES,developer};
});
