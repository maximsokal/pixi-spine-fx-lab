// WATER-01 transparent straight-alpha PNG sequences and exact-core Vite exports.
'use strict';
const SplashExports=(()=>{
 const $=id=>document.getElementById(id),text=id=>$(id).textContent;
 let cancelled=false;
 function safe(name){
  const n=String(name).replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[A-Za-z]:/.test(n)||
   n.split('/').some(x=>!x||x==='..'||x==='.')||
   /[\x00-\x1f]/.test(n))throw Error('Unsafe asset name '+name);
  return n;
 }
 async function bake({download=true,frames=null}={}){
  if(SplashEditor.isBusy)throw Error('Splash export already in progress');
  const settings=SplashEditor.getSettings(),backend=SplashEditor.getActualBackend(),
   frameCount=frames===null?settings.exportFrames:frames,
   original=SplashEditor.getTime(),playing=SplashEditor.getPlaying(),
   model=SplashEditor.getModel();
  if(!Number.isInteger(frameCount)||frameCount<1||frameCount>settings.exportFrames)
   throw TypeError('Splash frame count outside author settings');
  cancelled=false;SplashEditor.stop();SplashEditor.busy(true);
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={
   schemaVersion:1,effectId:'fx.water.water-splash',settings,backend,
   rendering:'isolated-effects-only-512px-straight-RGBA8',
   sourcePolicy:'caller-owned Spine used only for anchor pose; no background baked',
   width:512,height:512,fps:60,frameCount,frameFormula:'frameIndex/60',
   loopPolicy:settings.loop?'repeated-impact-visible-restart':'one-shot-frame39-alpha0',
   alpha:'straight-rgba8',
   frames:[]
  };
  const wasVisible=model?.visible,host=SplashEditor.getFx()?.sceneSource;
  const renderable=host?.renderable;
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('Splash PNG bake cancelled');
    const seconds=frame/60;SplashEditor.seek(seconds);
    const fx=SplashEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)
     throw Error('WATER-01 region exceeds 512x512 at frame '+frame+
      ' ['+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(v=>Number(v).toFixed(2)).join(',')+']; resize or Fit, never crop');
    const bytes=await SplashEditor.extractBytes();
    const file='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:file,data:bytes});
    manifest.frames.push({frame,file,timeSeconds:seconds});
    if(frame%10===0)SplashEditor.setStatus('Splash PNG '+(frame+1)+'/'+frameCount);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxSplashZip.makeZip(entries,()=>{
    if(cancelled)throw Error('Splash export cancelled during ZIP creation');
   });
   if(download)FxSplashZip.download(blob,'Water_Splash_'+frameCount+'frames_PNG.zip');
   SplashEditor.setStatus('Splash exported: '+frameCount+' frames • transparent RGBA8');
   return {manifest,entries,blob};
  }catch(e){SplashEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   if(model)model.visible=wasVisible;
   if(host)host.renderable=renderable;
   SplashEditor.restore(original,playing);
  }
 }
 const demo=backend=>[
 "import * as PIXI from 'pixi.js';",
 "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
 "import { FxSplash, createSplash } from './WaterSplash.mjs';",
 "import { FxTimeline } from './FxTimeline.mjs';",
 "async function main(){",
 " const preset=await (await fetch('/preset.json')).json();",
 " if(preset.effectId!=='fx.water.water-splash'||preset.schemaVersion!==1)throw Error('Invalid Splash preset');",
 " const app=new PIXI.Application();",
 " await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,",
 "  preference:'"+backend+"',preferWebGLVersion:2});",
 " document.body.append(app.canvas);",
 " const host=new PIXI.Container();app.stage.addChild(host);",
 " let model=null;",
 " if(preset.asset){",
 "   PIXI.Assets.add({alias:'water-skel',src:preset.asset.skeleton});",
 "   PIXI.Assets.add({alias:'water-atlas',src:preset.asset.atlas});",
 "   await PIXI.Assets.load(['water-skel','water-atlas']);",
 "   model=SpineRuntime.Spine.from({skeleton:'water-skel',atlas:'water-atlas',autoUpdate:false});",
 "   host.addChild(model);",
 "   if(preset.asset.skin){model.skeleton.setSkinByName(preset.asset.skin);model.skeleton.setSlotsToSetupPose()}",
 "   if(preset.asset.animation)model.state.setAnimation(0,preset.asset.animation,true);",
 "   model.update(0);",
 "   const b=model.getLocalBounds(),scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);",
 "   model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
 " }",
 " const settings=FxSplash.normalize(preset.settings);",
 " const effect=createSplash({PIXI,app,host,model,settings});",
 " let t=0;effect.seek(0);app.render();",
 " app.ticker.add(ticker=>{",
 "  t+=ticker.elapsedMS/1000;",
 "  if(settings.loop)t=t%(settings.durationFrames/60);",
 "  else t=Math.min((settings.exportFrames-1)/60,t);",
 "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,t);",
 "  effect.seek(t);app.render();",
 " });",
 " console.info('Water Splash developer example ready',app.renderer.type);",
 "}",
 "main().catch(e=>{console.error(e);document.body.textContent='Splash failed: '+e.message});",
 ""
 ].join('\n');
 const readme=backend=>[
 '# WATER-01 — Water Splash developer example ('+backend+')',
 '',
 'Run npm install && npm run dev. These pins are exact: PixiJS 8.22.0,',
 '@esotericsoftware/spine-pixi-v8 4.2.120 and Vite 7.1.12.',
 'The developer demo uses exactly the same FxSplash.mjs numerical source',
 'and WaterSplash.mjs Pixi/Spine rendering adapter as the offline lab.',
 'No postprocessing overlays, textures, CSS backgrounds or runtime HTTP APIs are required.',
 '',
 'Integration: provide a 512px identity Pixi stage-owned host, optionally containing',
 'a 4.2.x Spine model. Pass {PIXI,app,host,model,settings} to createSplash.',
 'The runtime owns its own stage tree and must be destroyed with effect.destroy().',
 'Caller-owned host/model/atlas/textures are NEVER destroyed by this effect.',
 'Seeks are absolute seconds, not frame increments. Prefer FxTimeline.seekSpine',
 'before each effect.seek when animating a bone or slot anchor.',
 'At t=0 exactly 24 initial droplets are emitted. Optional spray is a',
 'separate integrated 12/s decaying schedule; physically quadratic Y gravity.',
 'The last included one-shot frame (39) is fully transparent.',
 'Loop is repeat-impact every 40 frames, intentionally abrupt at the seam,',
 'NOT a cross-faded continuous water surface.',
 'PNG export has straight RGBA alpha only; no selected background is baked.',
 'Crop at 512px should be rejected rather than silently throwing geometry away.',
 'Quality Low/Balanced/High are count/mesh caps; physical GPU FPS not certified.',
 ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw TypeError('Unsupported Splash backend');
  if(SplashEditor.isBusy)throw Error('Cannot build developer ZIP during bake');
  const settings=SplashEditor.getSettings(),asset=SplashEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.water.water-splash',
   rendererPreference:target,expectedRenderer:target,
   fallbackPolicy:'assert actual Pixi renderer and report mismatch',
   settings,compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   timing:{fps:60,durationSeconds:settings.durationFrames/60,
    mode:settings.loop?'repeated-impact':'one-shot'},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),
    atlas:'assets/'+safe(asset.atlasName),
    skin:$('skin').value,animation:$('animation').value}:null};
  const entries=[
   {name:'preset.json',data:JSON.stringify(preset,null,2)},
   {name:'public/preset.json',data:JSON.stringify(preset,null,2)},
   {name:'FxCurves.mjs',data:text('fxCurveCore')+
    '\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+
    text('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxPath.mjs',data:"import './FxSpacing.mjs';\n"+
    text('fxPathCore')+'\nexport const FxPath=globalThis.FxPath;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+
    text('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxTimeline.mjs',data:text('fxTimelineCore')+
    '\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxSplash.mjs',data:"import './FxPath.mjs';\nimport './FxColors.mjs';\n"+
    text('fxSplashCore')+'\nexport const FxSplash=globalThis.FxSplash;\n'},
   {name:'WaterSplash.mjs',data:"import './FxSplash.mjs';\n"+
    text('fxSplashRuntime')+
    '\nexport const FxSplash=globalThis.FxSplash;\n'+
    'export const createSplash=globalThis.FxSplashRuntime.createSplash;\n'},
   {name:'example.js',data:demo(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:text('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-water-splash-'+target,
    private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',
     build:'vite build'},dependencies:{'pixi.js':'8.22.0',
     '@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>WATER-01 Water Splash</title><style>body{background:#111827;color:#eef2ff;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)
    entries.push({name:'public/assets/'+safe(name),data:blob});
  }
  return {preset,entries,blob:await FxSplashZip.makeZip(entries)};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 for(const target of ['webgl','webgpu']){
  $(target+'Zip').onclick=async()=>{
   try{
    const pack=await buildPackage(target);
    FxSplashZip.download(pack.blob,'Water_Splash_'+target.toUpperCase()+'.zip');
    SplashEditor.setStatus(target+' developer ZIP ready');
   }catch(e){SplashEditor.setStatus(e.message,true)}
  };
 }
 return Object.freeze({bake,buildPackage});
})();
