// EARTH-04 L04 isolated PNG sequence and offline developer ZIP.
(function(root,factory){const api=Object.freeze(factory(root,root.FxLeaves||(typeof require==='function'?require('./leaves-core.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLeavesExport=api;})(globalThis,function(root,Core){
 'use strict';
 const SIZE=512,COUNT=120,ID='fx.earth.falling-leaves',BACKENDS=['webgl1','webgl2','webgpu'];
 const enc=s=>new TextEncoder().encode(s),clone=v=>JSON.parse(JSON.stringify(v)),fail=m=>{throw Error('EARTH-04 export: '+m);};
 function poseOptions(v={followFx:true,spineTime:0,visible:true}){
  if(typeof v.followFx!=='boolean'||typeof v.visible!=='boolean'||!Number.isFinite(v.spineTime)||v.spineTime<0||v.spineTime>3600)fail('pose options');
  return {followFx:v.followFx,spineTime:v.spineTime,visible:v.visible};
 }
 function manifest(settings,backend,asset=null,pose){
  if(!BACKENDS.includes(backend))fail('backend unavailable');
  return {schemaVersion:1,effectId:ID,settings:Core.normalize(settings),backend,asset:clone(asset),pose:poseOptions(pose),
   width:SIZE,height:SIZE,crop:{x:0,y:0,width:SIZE,height:SIZE},fps:60,frameCount:COUNT,
   frameFormula:'frameIndex/60',loopPolicy:'periodic-half-open',alpha:'straight-rgba8',includesSpine:false,
   frames:Array.from({length:COUNT},(_,i)=>({frame:i,file:'frames/frame_'+String(i).padStart(4,'0')+'.png',timeSeconds:i/60}))};
 }
 function unpackGpu(raw,width,height,stride,format){
  if(!['rgba8unorm','bgra8unorm'].includes(format)||!(raw instanceof Uint8Array)||![width,height,stride].every(Number.isSafeInteger)||width<1||height<1||stride<width*4||raw.length<stride*height)fail('GPU format');
  const out=new Uint8Array(width*height*4),b=format==='bgra8unorm';
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*stride+x*4,j=(y*width+x)*4;out[j]=raw[i+(b?2:0)];out[j+1]=raw[i+1];out[j+2]=raw[i+(b?0:2)];out[j+3]=raw[i+3];}return out;
 }
 async function bakeSequence({codec,settings,backend,assetInfo=null,pose,createScene,signal,progress=()=>{},yieldFrame=()=>Promise.resolve(),deflate}){
  if(!codec||typeof createScene!=='function')fail('dependencies');
  const m=manifest(settings,backend,assetInfo,pose),check=()=>{if(signal?.aborted)fail('cancelled');};
  check();let scene,error,total=0;const entries=[];
  try{
   scene=await createScene({settings:clone(m.settings),backend,pose:clone(m.pose)});check();
   if(!scene||scene.backend!==backend||typeof scene.readFrame!=='function'||typeof scene.destroy!=='function')fail('isolated scene mismatch');
   for(const f of m.frames){check();const raw=await scene.readFrame(f.timeSeconds);check();
    if(raw?.width!==SIZE||raw.height!==SIZE||raw.alpha!=='premultiplied')fail('readback contract');
    const bytes=await codec.encodePng(raw,deflate);check();total+=bytes.length;if(total>192*1048576)fail('PNG budget');
    entries.push({name:f.file,data:bytes});progress(f.frame+1,COUNT);await yieldFrame();check();}
   entries.push({name:'sequence.json',data:enc(JSON.stringify(m,null,2))});
   const zip=codec.makeZip(entries,check);check();return {zip,manifest:m};
  }catch(e){error=e;throw e;}finally{if(scene&&typeof scene.destroy==='function')try{await scene.destroy();}catch(e){if(error)throw new AggregateError([error,e],'EARTH-04 bake and cleanup failed');throw e;}}
 }
 async function makeBakeScene({editor,asset,settings,backend,pose,env=root}){
  let scene,target,buffer,dead=false,reading=false;
  function destroy(){if(dead)return;if(reading)fail('read in progress');dead=true;const errors=[];
   for(const f of [()=>buffer?.destroy(),()=>target?.destroy(true),()=>scene?.dispose()])try{f();}catch(e){errors.push(e);}
   if(errors.length)throw new AggregateError(errors,'EARTH-04 cleanup');}
  try{
   scene=await editor.makeScene(backend,asset,settings,asset?.skin,asset?.animation);
   if(scene.actual.actual!==backend)fail('requested '+backend+' got '+scene.actual.actual);
   const r=scene.app.renderer,P=env.PIXI,gpu=backend==='webgpu';
   const max=gpu?r.gpu.device.limits.maxTextureDimension2D:r.gl.getParameter(r.gl.MAX_TEXTURE_SIZE);
   if(max<SIZE||!Number.isFinite(max))fail('texture limit');
   scene.host.renderable=false;target=P.RenderTexture.create({width:SIZE,height:SIZE,resolution:1,antialias:false});
   const stride=Math.ceil(SIZE*4/256)*256;
   if(gpu)buffer=r.gpu.device.createBuffer({size:stride*SIZE,usage:env.GPUBufferUsage.COPY_DST|env.GPUBufferUsage.MAP_READ});
   async function readFrame(seconds){
    if(dead||reading)fail('invalid read');reading=true;
    try{
     if(scene.model)env.FxTimeline.seekSpine(scene.model,pose.followFx?seconds:pose.spineTime);
     scene.fx.seek(seconds);if(scene.fx.diagnostics.length)fail('unresolved Spine anchor');
     r.render({container:scene.app.stage,target,clear:true,clearColor:[0,0,0,0]});
     let pixels;
     if(gpu){const device=r.gpu.device,texture=r.texture.getGpuSource(target.source),e=device.createCommandEncoder();
      e.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride,rowsPerImage:SIZE},{width:SIZE,height:SIZE});device.queue.submit([e.finish()]);
      let mapped=false;try{await buffer.mapAsync(env.GPUMapMode.READ);mapped=true;pixels=unpackGpu(new Uint8Array(buffer.getMappedRange()),SIZE,SIZE,stride,texture.format);}finally{if(mapped)buffer.unmap();}
     }else{const p=r.extract.pixels(target);if(p.width!==SIZE||p.height!==SIZE)fail('readback dimensions');pixels=p.pixels;}
     // Direct WebGPU copy bypasses Pixi's extraction conversion. The codec
     // converts the premultiplied target on either backend exactly once.
     return {pixels,width:SIZE,height:SIZE,alpha:'premultiplied'};
    }finally{reading=false;}
   }
   return {backend,readFrame,destroy};
  }catch(e){try{destroy();}catch(cleanup){throw new AggregateError([e,cleanup],'EARTH-04 init and cleanup failed');}throw e;}
 }
 const MODULES=['curve-core.js','spacing-core.js','color-core.js','timeline-core.js','leaves-core.js','leaves-runtime.js','leaves-spine.js'];
 const VENDORS=['pixi-8.22.0.min.js','spine-pixi-v8-4.2.120.min.js'];
 function safePath(v){if(typeof v!=='string'||!v||v.length>240||v.includes('\\')||!v.split('/').every(p=>/^[A-Za-z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..'))fail('unsafe asset path '+v);return v;}
 async function bytes(v){if(v instanceof Uint8Array)return new Uint8Array(v);if(typeof v==='string')return enc(v);if(v&&typeof v.arrayBuffer==='function')return new Uint8Array(await v.arrayBuffer());fail('asset bytes');}
 function base64(v){let s='';for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s);}
 function info(asset){return asset?{skeletonName:asset.skeletonName,atlasName:asset.atlasName,skin:asset.skin||'',animation:asset.animation||''}:null;}
 const DEMO="(async function(){\n 'use strict';\n const p=JSON.parse(document.getElementById('preset').textContent),raw=JSON.parse(document.getElementById('asset').textContent);\n const status=document.getElementById('status'),decode=v=>new Blob([Uint8Array.from(atob(v),x=>x.charCodeAt(0))]);\n let app,sp,fx,dead=false;\n function dispose(){if(dead)return;dead=true;fx?.destroy();if(sp){sp.model.destroy();sp.atlas.dispose();}if(app?.renderer)app.destroy(true);}\n async function init(preference){const a=new PIXI.Application();try{await a.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference,preferWebGLVersion:2,autoStart:false,sharedTicker:false});return a;}catch(e){if(a.renderer)a.destroy(true);throw e;}}\n try{\n  try{app=await init(p.rendererPreference);}catch(e){if(p.rendererPreference!=='webgpu')throw e;app=await init('webgl');}\n  const actual=app.renderer.gl?'webgl':app.renderer.gpu?.device?'webgpu':'unknown';\n  if(actual==='unknown'||p.rendererPreference==='webgl'&&actual!=='webgl')throw Error('Unsupported renderer '+actual);\n  const host=new PIXI.Container();app.stage.addChild(host);\n  if(raw){sp=await FxLeavesSpine.readSpine({skeletonName:raw.skeletonName,skeleton:decode(raw.skeleton),atlas:decode(raw.atlas),images:new Map(Object.entries(raw.images).map(([n,b])=>[n,decode(b)]))},{PIXI,spine});\n   host.addChild(sp.model);if(p.asset.skin){sp.model.skeleton.setSkinByName(p.asset.skin);sp.model.skeleton.setSlotsToSetupPose();}\n   if(p.asset.animation)sp.model.state.setAnimation(0,p.asset.animation,true);sp.model.visible=p.pose.visible;}\n  fx=FxLeavesRuntime.createLeaves({PIXI,app,host,model:sp?.model??null,settings:p.settings});\n  let t=0;function paint(){if(sp)FxTimeline.seekSpine(sp.model,p.pose.followFx?t:p.pose.spineTime);fx.seek(t);app.render();}\n  paint();document.body.append(app.canvas);status.textContent='Requested '+p.rendererPreference+' / actual '+actual;\n  app.ticker.add(timer=>{t=(t+timer.elapsedMS/1000)%2;paint();});app.start();window.addEventListener('pagehide',dispose,{once:true});\n }catch(e){dispose();status.textContent=e.message;console.error(e);}\n})();";
 async function packageEntries({settings,asset=null,pose,source,target}){
  if(!['webgl','webgpu'].includes(target)||typeof source!=='function')fail('developer target');
  const preset={schemaVersion:1,effectId:ID,settings:Core.normalize(settings),rendererPreference:target,compatibility:{pixi:'8.22.0',spine:'4.2.120'},pose:poseOptions(pose),asset:info(asset)};
  const entries=[],put=(name,data)=>entries.push({name,data:typeof data==='string'?enc(data):data});
  for(const name of VENDORS)put('vendor/'+name,source(name));for(const name of MODULES)put('src/'+name,source(name));put('LICENSES.txt',source('runtimeLicenses'));
  let embedded=null,total=0;
  if(asset){
   const skeletonName=safePath(asset.skeletonName),atlasName=safePath(asset.atlasName),skeleton=await bytes(asset.skeleton),atlas=await bytes(asset.atlas),images=Object.create(null);
   total=skeleton.length+atlas.length;if(total>80*1048576)fail('asset budget');
   put('assets/'+skeletonName,skeleton);put('assets/'+atlasName,atlas);
   for(const [name,value] of asset.images){safePath(name);const raw=await bytes(value);total+=raw.length;if(total>80*1048576)fail('asset budget');images[name]=base64(raw);put('assets/'+name,raw);}
   embedded={skeletonName,atlasName,skeleton:base64(skeleton),atlas:base64(atlas),images};
  }
  const json=v=>JSON.stringify(v,null,2),inline=v=>json(v).replace(/</g,'\\u003c');
  put('preset.json',json(preset));put('example.js',DEMO);
  put('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Falling Leaves</title><body><p id="status">Initializing…</p>'+
   '<script id="preset" type="application/json">'+inline(preset)+'</script><script id="asset" type="application/json">'+inline(embedded)+'</script>'+
   VENDORS.map(n=>'<script src="vendor/'+n+'"></script>').join('')+MODULES.map(n=>'<script src="src/'+n+'"></script>').join('')+'<script src="example.js"></script></body></html>');
  put('Leaves.mjs',MODULES.map(n=>"import './src/"+n+"';").join('\n')+'\nexport const FxLeaves=globalThis.FxLeaves;\nexport const createLeaves=globalThis.FxLeavesRuntime.createLeaves;\n');
  put('README.md','# EARTH-04 Falling Leaves\nOpen index.html offline using the included pinned libraries. WebGPU may require localhost/HTTPS; WebGL fallback is reported. No npm install required. For ESM integration serve locally and import Leaves.mjs; pass pinned Pixi and an identity stage-owned host. Update Spine pose before fx.seek(seconds). Local procedural textures are generated by leaves-runtime.js. PNG excludes Spine. Destroy fx before disposing your model and atlas. Actual GPU compatibility requires browser validation.\n');
  if(new Set(entries.map(x=>x.name.toLowerCase())).size!==entries.length)fail('duplicate package path');return {preset,entries};
 }
 function bind(editor){
  const $=id=>document.getElementById(id),codec=root.FxShieldExport;let controller=null;
  function download(data,name){const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function bake(save=true){
   if(editor.busy||!editor.scene)fail('editor unavailable or busy');
   const settings=editor.getSettings(),asset=editor.asset,backend=editor.getActualBackend().actual,pose=editor.getPoseOptions(),was=editor.session.playing;
   controller=new AbortController();editor.stop();editor.setBusy(true);$('cancel').disabled=false;
   try{const result=await bakeSequence({codec,settings,backend,pose,assetInfo:info(asset),signal:controller.signal,createScene:o=>makeBakeScene({...o,asset,editor}),progress:(i,n)=>editor.status('Baking '+i+' / '+n),yieldFrame:()=>new Promise(r=>setTimeout(r,0))});
    if(save)download(result.zip,'Falling_Leaves_120_PNG.zip');editor.status('PNG ZIP ready');return result;
   }catch(e){editor.status(e.message,true);throw e;}finally{controller=null;$('cancel').disabled=true;editor.setBusy(false);if(was)editor.session.play();editor.refreshTime();}
  }
  async function developer(target,save=true){
   if(editor.busy)fail('editor busy');editor.setBusy(true);
   try{const p=await packageEntries({settings:editor.getSettings(),asset:editor.asset,pose:editor.getPoseOptions(),source:id=>$(id).textContent,target});
    const zip=codec.makeZip(p.entries);if(save)download(zip,'Falling_Leaves_'+target+'.zip');editor.status('Developer ZIP ready');return {...p,zip};
   }catch(e){editor.status(e.message,true);throw e;}finally{editor.setBusy(false);}
  }
  $('bake').onclick=()=>bake().catch(()=>{});$('cancel').onclick=()=>controller?.abort();for(const t of ['webgl','webgpu'])$(t+'Zip').onclick=()=>developer(t).catch(()=>{});
  return Object.freeze({bake,developer});
 }
 return {manifest,unpackGpu,bakeSequence,makeBakeScene,packageEntries,bind};
});