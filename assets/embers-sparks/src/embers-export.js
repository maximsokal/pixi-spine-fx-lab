// FIRE-04 PNG sequence and self-contained optional Vite developer handoff.
'use strict';
const EmbersExports=(()=>{
 const $=id=>document.getElementById(id);
 let cancelled=false;
 const getText=id=>$(id).textContent;
 function safe(name){
  const n=String(name).replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[a-z]:/i.test(n)||n.split('/').some(p=>!p||p==='.'||p==='..'))
   throw Error('Unsafe asset filename '+name);
  return n;
 }
 async function bake({download=true}={}){
  if(EmbersEditor.isBusy)throw Error('Export already running');
  const settings=EmbersEditor.getSettings(),original=EmbersEditor.getTime(),
    wasPlaying=EmbersEditor.getPlaying();
  const frameCount=settings.exportFrames,backend=EmbersEditor.getActualBackend();
  cancelled=false;EmbersEditor.busy(true);EmbersEditor.stop();
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={schemaVersion:1,effectId:'fx.fire.embers-sparks',
   backend,settings,width:512,height:512,fps:60,
   count:frameCount,frameFormula:'frameIndex/60',alpha:'straight-rgba8',
   scope:'512x512 multi-emitter embers+optional Spine at absolute times; live state restored',
   frames:[]};
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('PNG export cancelled');
    const seconds=frame/60;
    EmbersEditor.seek(seconds);
    const fx=EmbersEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)throw Error('Embers exceeds 512x512 logical bounds at frame '+
      frame+' ('+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(n=>Number(n).toFixed(1)).join(', ')+
      '). Use Fit to canvas or reduce trajectory/size/offsets; PNG not cropped.');
    const bytes=await EmbersEditor.extractBytes();
    const filename='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:filename,data:bytes});
    manifest.frames.push({file:filename,frame,timeSeconds:seconds});
    if(frame%10===0)EmbersEditor.setStatus('Baking '+(frame+1)+'/'+frameCount+' PNG frames');
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxEmbersZip.makeZip(entries,()=>{
    if(cancelled)throw Error('PNG export cancelled');
   });
   if(download)FxEmbersZip.download(blob,'Embers_Sparks_'+frameCount+'frames_PNG.zip');
   EmbersEditor.setStatus('Exported '+frameCount+' transparent 512x512 PNG frames (60 FPS)');
   return {blob,manifest};
  }catch(e){EmbersEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   EmbersEditor.restore(original,wasPlaying);
  }
 }
 const demoCode=target=>[
  "import * as PIXI from 'pixi.js';",
  "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
  "import { FxEmbers, createEmbers } from './EmbersSparks.mjs';",
  "import { FxTimeline } from './FxTimeline.mjs';",
  "async function main(){",
  " const preset=await (await fetch('/preset.json')).json();",
  " const app=new PIXI.Application();",
  " await app.init({width:512,height:512,backgroundAlpha:0,preference:'"+target+"',",
  "  preferWebGLVersion:2,resolution:1});",
  " document.body.append(app.canvas);",
  " const host=new PIXI.Container();app.stage.addChild(host);",
  " let model=null;",
  " if(preset.asset){",
  "  PIXI.Assets.add({alias:'embers-skel',src:preset.asset.skeleton});",
  "  PIXI.Assets.add({alias:'embers-atlas',src:preset.asset.atlas});",
  "  await PIXI.Assets.load(['embers-skel','embers-atlas']);",
  "  model=SpineRuntime.Spine.from({skeleton:'embers-skel',atlas:'embers-atlas',autoUpdate:false});",
  "  host.addChild(model);",
  "  if(preset.asset.skin){model.skeleton.setSkinByName(preset.asset.skin);model.skeleton.setSlotsToSetupPose();}",
  "  if(preset.asset.animation)model.state.setAnimation(0,preset.asset.animation,true);",
  "  model.update(0);",
  "  const b=model.getLocalBounds();",
  "  const scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);",
  "  model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
  " }",
  " const effect=createEmbers({PIXI,app,host,model,settings:FxEmbers.normalize(preset.settings)});",
  " let time=0;",
  " app.ticker.add(ticker=>{",
  "  if(preset.settings.loop)time=(time+ticker.elapsedMS/1000)%(preset.settings.durationFrames/60);",
  "  else time=Math.min((preset.settings.exportFrames-1)/60,time+ticker.elapsedMS/1000);",
  "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,time);",
  "  app.render();effect.seek(time);app.render();",
  " });",
  " console.info('Embers developer example ready', app.renderer.type);",
  "}",
  "main().catch(error=>{console.error(error);document.body.textContent='Embers startup failed: '+error.message;});",
  ""
 ].join('\n');
 const readme=target=>[
  '# Embers and Sparks FX Lab — '+target.toUpperCase(),
  '',
  'Run npm install && npm run dev in this extracted directory.',
  'The Vite app uses exact pinned PixiJS 8.22.0 and Spine-pixi-v8 4.2.120.',
  'Network access is not required at runtime once dependencies are installed.',
  'Embers core/runtime source is copied unchanged from the editor HTML.',
  'All controls and true renderer support should be verified on the target device.',
  'Actual WebGPU support and fallback are runtime/platform-dependent; do not infer it from requested preference.',
  'Preset v1, optional Spine JSON/SKEL/atlas/texture assets, shaders not required.',
  'Particles/streaks/bloom are owned Graphics; no custom shader or FxPath dependency.',
  'Bloom is a small layered halo, NOT an all-scene optical distortion or blur filter.',
  ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw Error('Unknown developer backend');
  if(EmbersEditor.isBusy)throw Error('Export already running');
  const settings=EmbersEditor.getSettings(),asset=EmbersEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.fire.embers-sparks',
   rendererPreference:target,fallbackRenderer:'webgl',settings,
   timing:{fps:60,durationSeconds:settings.durationFrames/60,loop:settings.loop},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),
    atlas:'assets/'+safe(asset.atlasName),animation:$('animation').value,
    skin:$('skin').value}:null,
   compatibility:{pixi:'8.22.0',spine:'4.2.120'},
   source:'FIRE-04 independent Fireball Embers Lab',
   warning:'Expected renderer is not proof of actual backend; verify runtime'};
  const entries=[
   {name:'preset.json',data:JSON.stringify(preset,null,2)},
   {name:'public/preset.json',data:JSON.stringify(preset,null,2)},
   {name:'FxCurves.mjs',data:getText('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+getText('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+getText('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxTimeline.mjs',data:getText('fxTimelineCore')+'\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxEmbers.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+getText('fxEmbersCore')+
      '\nexport const FxEmbers=globalThis.FxEmbers;\n'},
   {name:'EmbersSparks.mjs',data:"import './FxEmbers.mjs';\n"+getText('fxEmbersRuntime')+
      '\nexport const FxEmbers=globalThis.FxEmbers;\nexport const createEmbers=globalThis.FxEmbersRuntime.createEmbers;\n'},
   {name:'example.js',data:demoCode(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:getText('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'spine-embers-sparks-'+target,private:true,type:'module',
    scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{
     'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},
     devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Fire Embers</title><style>body{background:#1b2130;color:white;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images){
    entries.push({name:'public/assets/'+safe(name),data:blob});
   }
  }
  return {blob:await FxEmbersZip.makeZip(entries),preset,entries};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 $('webglZip').onclick=async()=>{
  try{const result=await buildPackage('webgl');FxEmbersZip.download(result.blob,'Embers_Sparks_WebGL.zip');
   EmbersEditor.setStatus('WebGL developer ZIP exported');}
  catch(e){EmbersEditor.setStatus(e.message,true)}
 };
 $('webgpuZip').onclick=async()=>{
  try{const result=await buildPackage('webgpu');FxEmbersZip.download(result.blob,'Embers_Sparks_WebGPU.zip');
   EmbersEditor.setStatus('WebGPU developer ZIP exported');}
  catch(e){EmbersEditor.setStatus(e.message,true)}
 };
 return Object.freeze({bake,buildPackage});
})();
