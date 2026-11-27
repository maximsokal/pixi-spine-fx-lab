// EARTH-01 G04c: offline developer handoff using the same preview scene.
(function(root,make){'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactDeveloper=api;})(globalThis,function(){
 'use strict';
 const FILES=Object.freeze(['curve-core.js','spacing-core.js','path-core.js','color-core.js',...['core','anchors','runtime','authoring','pose','session','loader','editor','export','bake'].map(k=>'ground-impact-'+k+'.js'),'shield-export.js']);
 const VENDORS=Object.freeze(['pixi-8.22.0.min.js','spine-pixi-v8-4.2.120.min.js']);
 const MiB=1048576,enc=s=>new TextEncoder().encode(s),copy=v=>JSON.parse(JSON.stringify(v)),fail=m=>{throw Error('Ground Impact developer: '+m);};
 async function startGroundDemo({preset,mount,baseURL=document.baseURI,env=globalThis}){
  const p=JSON.parse(JSON.stringify(preset)),U=env.FxGroundImpactAuthoring,E=env.FxGroundImpactEditor;
  if(p.schemaVersion!==1||p.effectId!=='fx.earth.ground-impact'||!['webgl','webgpu'].includes(p.rendererPreference)||!mount||!U||!E)throw Error('Invalid demo preset/dependencies');
  let scene,dead=false,playing=false,last=null,raf=0,time=0;
  function pause(){playing=false;last=null;env.cancelAnimationFrame(raf);}
  function destroy(){if(dead)return;dead=true;pause();scene?.destroy();}
  try{
   if(p.rendererPreference==='webgpu')scene=await E.nativeScene(env,'webgpu',p.settings);else{try{scene=await E.nativeScene(env,'webgl2',p.settings);}catch(e){scene=await E.nativeScene(env,'webgl1',p.settings);}}
   const s=scene.session;
   async function load(path,type){if(!/^assets\/(skeleton\.(json|skel|atlas)|page_\d{3}\.bin)$/.test(path))throw Error('Invalid asset path');const r=await env.fetch(new env.URL(path,baseURL));if(!r.ok)throw Error('Missing '+path);const b=await r.blob();return type===undefined?b:new env.Blob([b],{type});}
   if(p.asset){const a=p.asset;if(!Array.isArray(a.images)||!a.images.length||a.images.length>64||new Set(a.images.map(i=>i.name)).size!==a.images.length)throw Error('Invalid asset pages');const skeleton=await load(a.skeleton),atlas=await load(a.atlas),images=new Map();for(const i of a.images)images.set(i.name,await load(i.path,i.type));await s.replaceSource({name:a.sourceSkeletonName,atlasName:a.sourceAtlasName,skeleton,atlas,images});s.setOptions(a.options);}
   function seek(t){if(dead)throw Error('Destroyed demo');const next=U.seek(t),sample=s.seek(next);scene.render();time=next;return sample;}
   function tick(now){if(!playing)return;try{if(last!==null){seek(U.advance(time,(now-last)/1000));if(time>=39/60){pause();return;}}last=now;raf=env.requestAnimationFrame(tick);}catch(e){pause();env.console.error(e);}}
   function play(){if(dead)throw Error('Destroyed demo');pause();if(time>=39/60)seek(0);playing=true;raf=env.requestAnimationFrame(tick);}
   seek(p.previewSeconds);mount.append(scene.canvas);return Object.freeze({backend:scene.actual,fallback:scene.actual!==(p.rendererPreference==='webgpu'?'webgpu':'webgl2'),get settings(){return s.settings;},get time(){return time;},seek,play,pause,destroy});
  }catch(e){try{destroy();}catch(cleanup){throw new AggregateError([e,cleanup],'Demo initialization and cleanup failed');}throw e;}
 }
 const boot="async function main(){const $=id=>document.getElementById(id),r=await fetch('./preset.json');if(!r.ok)throw Error('Missing preset');const c=await startGroundDemo({preset:await r.json(),mount:$('preview')});$('backend').textContent=c.backend+(c.fallback?' (fallback)':'');$('play').onclick=c.play;$('pause').onclick=c.pause;$('reset').onclick=()=>{c.pause();c.seek(0);};$('destroy').onclick=()=>{c.destroy();for(const id of ['play','pause','reset','destroy'])$(id).disabled=true;};addEventListener('pagehide',c.destroy,{once:true});} main().catch(e=>{document.getElementById('backend').textContent=e.message;console.error(e);});";
 async function developer({target,settings,previewSeconds,crop,frameCount,source=null,options,assetInfo,sources,vendors,licenses,compile,codec,signal}){
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();if(!['webgl','webgpu'].includes(target)||typeof compile!=='function'||typeof codec?.cropSpec!=='function'||typeof codec?.makeZip!=='function')fail('target/dependencies');
  const plan=compile(settings),normalized=copy(plan.settings),c=copy(codec.cropSpec(crop));
  if(normalized.schemaVersion!==1||normalized.mode!=='oneShot'||normalized.durationFrames!==40||plan.meta.frames!==40||plan.meta.fps!==60||!Number.isFinite(previewSeconds)||previewSeconds<0||previewSeconds>39/60)fail('preview contract');
  if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>3600)fail('frame count');
  const preset={schemaVersion:1,effectId:'fx.earth.ground-impact',rendererPreference:target,settings:normalized,previewSeconds,crop:c,frameCount,authoredFrames:40,fps:60,asset:null,compatibility:{pixi:'8.22.0',spine:'4.2.120'}};
  const entries=[],add=(name,data)=>entries.push({name,data:typeof data==='string'?enc(data):data});
  for(const name of FILES){if(typeof sources?.[name]!=='string'||!sources[name].trim())fail('missing source '+name);add('public/'+name,sources[name]);}
  for(const name of VENDORS){if(typeof vendors?.[name]!=='string'||!vendors[name].trim())fail('missing vendor '+name);add('public/vendor/'+name,vendors[name]);}
  if(typeof licenses!=='string'||!licenses.trim())fail('missing notices');add('public/LICENSES.txt',licenses);
  if(source){const {name,skeleton,atlas}=source;if(typeof name!=='string'||!/\.(json|skel)$/i.test(name)||!(source.images instanceof Map)||!source.images.size||source.images.size>64)fail('Spine source');
   if(typeof assetInfo?.version!=='string'||!/^4\.2\.(0|[1-9]\d*)$/.test(assetInfo.version))fail('Spine version');
   if(typeof options?.animation!=='string'||typeof options.skin!=='string'||typeof options.visible!=='boolean'||!Number.isFinite(options.speed)||options.speed<0||options.speed>4)fail('Spine options');
   const size=(b,max)=>{if(!(b instanceof Blob)||!Number.isSafeInteger(b.size)||b.size<1||b.size>max)fail('asset size');return b.size;};
   const skSize=size(skeleton,16*MiB),atSize=size(atlas,4*MiB),pages=[],keys=new Set();let total=0;
   for(const [key,b] of source.images){if(typeof key!=='string'||!key.trim()||keys.has(key.replace(/\\/g,'/')))fail('duplicate or invalid image key');keys.add(key.replace(/\\/g,'/'));const bytes=size(b,128*MiB);total+=bytes;pages.push({name:key,path:'assets/page_'+String(pages.length).padStart(3,'0')+'.bin',type:b.type,b,bytes});}
   if(total>128*MiB||total+skSize+atSize+entries.reduce((n,e)=>n+e.data.length,0)>240*MiB)fail('asset budget');
   preset.asset={sourceSkeletonName:name,sourceAtlasName:typeof source.atlasName==='string'?source.atlasName:'skeleton.atlas',version:assetInfo.version,skeleton:'assets/skeleton.'+(/\.skel$/i.test(name)?'skel':'json'),atlas:'assets/skeleton.atlas',images:pages.map(({name,path,type})=>({name,path,type})),options:{animation:options.animation,skin:options.skin,speed:options.speed,visible:options.visible}};
   async function read(path,b,expected){check();const data=new Uint8Array(await b.arrayBuffer());check();if(data.length!==expected)fail('asset size changed');add('public/'+path,data);}
   await read(preset.asset.skeleton,skeleton,skSize);await read(preset.asset.atlas,atlas,atSize);for(const p of pages)await read(p.path,p.b,p.bytes);
  }
  const scripts=[...VENDORS.map(n=>'vendor/'+n),...FILES,'ground-demo.js','example.js'].map(n=>'<script src="./'+n+'"></script>').join('');
  add('public/index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Ground Impact</title><button id="play">Play</button><button id="pause">Pause</button><button id="reset">Reset</button><button id="destroy">Destroy</button><output id="backend">Loading</output><div id="preview"></div>'+scripts+'</html>');
  add('public/ground-demo.js',startGroundDemo.toString());add('public/example.js',boot);add('public/preset.json',JSON.stringify(preset,null,2));
  add('package.json',JSON.stringify({name:'ground-impact-'+target,private:true,dependencies:{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'}},null,2));
  add('README.md','# Ground Impact developer example\n\nOffline launch: python -m http.server 8000 --directory public; open http://localhost:8000. Bundled pinned browser distributions and license notices; no CDN or npm installation required. package.json records exact dependencies for integration. The demo reports the actual renderer and fallback; prefer WebGL 1 + Low on older hardware. The same session and renderer use a 512x512 logical pixel plane; resize the display with CSS, not authoring coordinates. Contact, ring, debris and dust settings and curves are in preset.json. One-shot preview ends at 39/60; exported frame i samples absolute i/60, default 40 frames. Pose first (60Hz physics), then effect, then render. Texture blending uses premultiplied runtime textures; PNG helpers normalize to straight RGBA8 once. Original Spine bytes, atlas and page keys are preserved using safe archive aliases. Call startGroundDemo after loading the scripts; seek(seconds), play(), pause(), destroy() are exposed. Crop is export metadata, not a display resize. PNG helpers are included for integration. Actual GPU parity must be verified separately.\n');
  check();const zip=codec.makeZip(entries,check);check();return {zip,preset};
 }
 return {FILES,VENDORS,developer,startGroundDemo};
});
