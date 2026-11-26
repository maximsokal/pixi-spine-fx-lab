// GAME-03 S04b: self-contained developer source handoff, no editor state ownership.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSwordSlashDeveloper=api;
})(globalThis,function(){
 'use strict';
 const FILES=Object.freeze(['curve-core.js','spacing-core.js','path-core.js','color-core.js','timeline-core.js','shockwave-spine.js','sword-slash-core.js','sword-slash-anchors.js','sword-slash-pose.js','sword-slash-history.js','sword-slash-runtime.js','sword-slash-authoring.js','shield-export.js','sword-slash-export.js','sword-slash-bake.js']);
 const VENDORS=Object.freeze(['pixi-8.22.0.min.js','spine-pixi-v8-4.2.120.min.js']);
 const MiB=1048576,enc=s=>new TextEncoder().encode(s),copy=v=>JSON.parse(JSON.stringify(v)),fail=m=>{throw Error('SwordSlash developer: '+m);};
 // Same controller in the Vite and zero-install local HTTP examples.
 const controller=`${FILES.map(n=>"import './"+n+"';").join('\n')}
export async function startSwordSlashDemo({preset,mount,baseURL=document.baseURI,env=globalThis}){
 const p=structuredClone(preset),{PIXI,FxSwordSlashHistory:H,FxSwordSlashRuntime:R,FxSwordSlashAuthoring:U,FxShockwaveSpine:Sp,FxSwordSlashPose:Pose}=env;
 if(p.schemaVersion!==1||p.effectId!=='fx.game.sword-slash'||!['webgl','webgpu'].includes(p.rendererPreference)||!mount||!PIXI||!H||!R||!U||!Sp||!Pose)throw Error('Invalid demo preset/dependencies');
 const actual=r=>r.gl?(typeof env.WebGL2RenderingContext==='function'&&r.gl instanceof env.WebGL2RenderingContext?'webgl2':'webgl1'):r.gpu?.device?'webgpu':'unsupported';
 async function start(preference){const app=new PIXI.Application();try{await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference,preferWebGLVersion:2});const got=actual(app.renderer);if(got==='unsupported'||(preference==='webgl'&&got==='webgpu'))throw Error('Unexpected renderer '+got);return app;}catch(e){if(app.renderer)app.destroy(true,{children:true});throw e;}}
 let app,session,dead=false,playing=false,last=null,raf=0,time=0,settings;
 function pause(){playing=false;last=null;env.cancelAnimationFrame(raf);}
 function destroy(){if(dead)return;dead=true;pause();try{session?.destroy();}finally{if(app?.renderer)app.destroy(true,{children:true});}}
 try{
  try{app=await start(p.rendererPreference);}catch(e){if(p.rendererPreference!=='webgpu')throw e;app=await start('webgl');}
  const models=new PIXI.Container(),host=new PIXI.Container();app.stage.addChild(models,host);
  const load=async path=>{if(!/^assets\\/(skeleton\\.(json|skel|atlas)|page_\\d{3}\\.(png|webp|jpg|jpeg))$/.test(path))throw Error('Invalid asset path');const res=await env.fetch(new URL(path,baseURL));if(!res.ok)throw Error('Missing '+path);return res.blob();};
  session=U.createSession({PIXI,Spine:env.spine,host,world:app.stage,models,loader:Sp,history:H,runtime:R,pose:Pose,initial:H.defaults()});
  if(p.asset){const a=p.asset;if(!Array.isArray(a.images)||a.images.length<1||a.images.length>64||new Set(a.images.map(i=>i.name)).size!==a.images.length)throw Error('Invalid asset pages');await session.replaceSource({name:a.sourceSkeletonName,skeleton:await load(a.skeleton),atlas:await load(a.atlas),images:new Map(await Promise.all(a.images.map(async i=>[i.name,await load(i.path)])))});session.setOptions(a.options);}
  session.configure(p.settings);settings=session.settings;
  function seek(t){if(dead||!Number.isFinite(t))throw Error('Invalid seek');const next=U.seek(t,settings);const sample=session.seek(next);app.render();time=next;return sample;}
  function tick(now){if(!playing)return;try{if(last!==null){seek(time+(now-last)/1000);if(time>=(U.frameCount(settings)-1)/60){pause();return;}}last=now;raf=env.requestAnimationFrame(tick);}catch(e){pause();console.error(e);}}
  function play(){if(dead)throw Error('Destroyed demo');pause();if(time>=(U.frameCount(settings)-1)/60)seek(0);playing=true;raf=env.requestAnimationFrame(tick);}
  seek(p.previewSeconds);mount.append(app.canvas);return Object.freeze({backend:actual(app.renderer),get settings(){return settings;},get time(){return time;},seek,play,pause,destroy});
 }catch(e){destroy();throw e;}
}
`;
 const demo=`import {startSwordSlashDemo} from './sword-slash-demo.js';
async function main(){const $=id=>document.getElementById(id),res=await fetch('./preset.json');if(!res.ok)throw Error('Missing preset');const c=await startSwordSlashDemo({preset:await res.json(),mount:$('preview')});$('backend').textContent=c.backend;$('play').onclick=c.play;$('pause').onclick=c.pause;$('reset').onclick=()=>{c.pause();c.seek(0);};$('destroy').onclick=()=>{c.destroy();for(const id of ['play','pause','reset','destroy'])$(id).disabled=true;};window.addEventListener('pagehide',c.destroy,{once:true});}
main().catch(e=>{console.error(e);document.getElementById('backend').textContent=e.message;});
`;
 const page='<!doctype html><html lang="en"><meta charset="utf-8"><title>Sword Slash</title><button id="play">Play</button><button id="pause">Pause</button><button id="reset">Reset</button><button id="destroy">Destroy</button><output id="backend">Loading</output><div id="preview"></div><script src="./vendor/pixi-8.22.0.min.js"></script><script src="./vendor/spine-pixi-v8-4.2.120.min.js"></script><script type="module" src="./example.js"></script></html>';
 async function developer({target,settings,previewSeconds,crop,frameCount,source=null,options,assetInfo,sources,vendors,licenses,normalizeSettings,cropSpec,makeZip,signal}){
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();if(!['webgl','webgpu'].includes(target)||typeof normalizeSettings!=='function'||typeof cropSpec!=='function'||typeof makeZip!=='function')fail('target/dependencies');
  const normalized=copy(normalizeSettings(settings)),c=copy(cropSpec(crop)),frames=normalized.effect?.exportFrames;
  if(!Number.isSafeInteger(frames)||frames<1||frames>3600||!Number.isFinite(previewSeconds)||previewSeconds<0||previewSeconds>(frames-1)/60)fail('preview time');
  if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>3600)fail('frame count');
  if(!source&&Object.entries(normalized.trajectory).some(([k,v])=>v==='recorded'&&normalized.effect.layers[k].enabled&&normalized.effect.layers[k].opacity>0))fail('recorded trajectory requires Spine source');
  const preset={schemaVersion:1,effectId:'fx.game.sword-slash',rendererPreference:target,settings:normalized,previewSeconds,crop:c,frameCount,asset:null,compatibility:{pixi:'8.22.0',spine:'4.2.120'}};
  const entries=[],add=(name,data)=>entries.push({name,data:typeof data==='string'?enc(data):data});
  for(const name of FILES){if(typeof sources?.[name]!=='string'||!sources[name].trim())fail('missing source '+name);add('public/'+name,sources[name]);}
  for(const name of VENDORS){if(typeof vendors?.[name]!=='string'||!vendors[name].trim())fail('missing vendor '+name);add('public/vendor/'+name,vendors[name]);}
  if(typeof licenses!=='string'||!licenses.trim())fail('missing notices');add('public/LICENSES.txt',licenses);
  if(source){const {name,skeleton,atlas}=source;if(typeof name!=='string'||!/\.(json|skel)$/i.test(name)||!(source.images instanceof Map)||source.images.size<1||source.images.size>64)fail('Spine source');
   if(typeof assetInfo?.version!=='string'||!/^4\.2\.(0|[1-9]\d*)$/.test(assetInfo.version))fail('Spine version');
   if(typeof options?.animation!=='string'||typeof options.skin!=='string'||typeof options.visible!=='boolean'||!Number.isFinite(options.speed)||options.speed<0||options.speed>4)fail('Spine options');
   const size=(b,max)=>{if(!b||!Number.isSafeInteger(b.size)||b.size<1||b.size>max||typeof b.arrayBuffer!=='function')fail('asset size');return b.size;};
   const skSize=size(skeleton,64*MiB),atSize=size(atlas,4*MiB),pages=[];let total=0;
   for(const [key,b] of source.images){const ext=typeof key==='string'&&/\.(png|webp|jpe?g)$/i.exec(key);if(!ext||!key.trim())fail('image key');const bytes=size(b,192*MiB);total+=bytes;pages.push({name:key,path:'assets/page_'+String(pages.length).padStart(3,'0')+'.'+ext[1].toLowerCase(),b,bytes});}
   if(total>192*MiB||total+skSize+atSize+entries.reduce((n,e)=>n+e.data.length,0)>240*MiB)fail('asset budget');
   preset.asset={sourceSkeletonName:name,version:assetInfo.version,skeleton:'assets/skeleton.'+(/\.skel$/i.test(name)?'skel':'json'),atlas:'assets/skeleton.atlas',images:pages.map(({name,path})=>({name,path})),options:{animation:options.animation,skin:options.skin,speed:options.speed,visible:options.visible}};
   const read=async(path,b,expected)=>{check();const data=new Uint8Array(await b.arrayBuffer());check();if(data.length!==expected)fail('asset size changed');add('public/'+path,data);};
   await read(preset.asset.skeleton,skeleton,skSize);await read(preset.asset.atlas,atlas,atSize);for(const p of pages)await read(p.path,p.b,p.bytes);
  }
  add('public/preset.json',JSON.stringify(preset,null,2));add('public/sword-slash-demo.js',controller);add('public/example.js',demo);add('public/index.html',page);
  // Public files are copied verbatim by Vite. No dependency on npm at runtime;
  // the identical project can be served directly from public/ with Python.
  add('package.json',JSON.stringify({name:'sword-slash-'+target,private:true,type:'module',scripts:{dev:'vite --open /index.html',build:'vite build',preview:'vite preview'},devDependencies:{vite:'7.1.12'}},null,2));
  add('vite.config.js',"import {defineConfig} from 'vite';\nexport default defineConfig({base:'./',build:{rollupOptions:{input:'bootstrap.html'}}});\n");
  add('bootstrap.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Sword Slash</title><a href="./index.html">Open Sword Slash demo</a></html>');
  add('README.md','# Sword Slash developer example\n\nZero-install offline launch: python -m http.server 8000 --directory public, then open http://localhost:8000. The pinned Pixi 8.22.0 and Spine 4.2.120 browser distributions and license notices are included. No CDN. Optional Vite: npm install, npm run dev; npm run build copies public to dist; npm run preview serves dist/index.html. Initial Vite installation requires its package or cache. Actual renderer is shown; WebGPU preference can fall back to WebGL. Original Spine bytes and atlas page keys are preserved through safe aliases. The same authoring session owns separate live and hidden replay models for recorded weapon motion. Preview is a 512x512 logical plane; crop and frameCount are handoff metadata. Import startSwordSlashDemo from sword-slash-demo.js after loading vendor scripts. seek/play/pause/destroy use the same authoring session and Spine pose order as the editor. One-shot clamps to the last authored frame. Spine physics advances at 60 FPS (substeps for faster animation); backward seeks and pose option changes reset and replay. Nonphysics rigs retain exact-time seeks. PNG helpers are included for integration, not exposed as demo controls. GPU parity and performance require separate verification.\n');
  check();const zip=makeZip(entries,check);check();return {zip,preset};
 }
 return {FILES,VENDORS,developer};
});
