// WATER-06 PNG sequence and self-contained optional Vite developer handoff.
'use strict';
const SteamExports=(()=>{
 const $=id=>document.getElementById(id);
 let cancelled=false;
 const getText=id=>$(id).textContent;
 function safe(name){
  const n=String(name).replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[a-z]:/i.test(n)||n.split('/').some(p=>!p||p==='.'||p==='..'))
   throw Error('Unsafe asset filename '+name);
  return n;
 }
 async function bake({download=true,frames=null}={}){
  if(SteamEditor.isBusy)throw Error('Export already running');
  const settings=SteamEditor.getSettings(),original=SteamEditor.getTime(),
    wasPlaying=SteamEditor.getPlaying();
  const frameCount=frames===null?settings.exportFrames:frames,backend=SteamEditor.getActualBackend();
  if(!Number.isInteger(frameCount)||frameCount<1||frameCount>settings.exportFrames)
   throw TypeError('Steam PNG frame count outside export settings');
  const source=SteamEditor.getModel(),sourceWasVisible=source?.visible;
  cancelled=false;SteamEditor.busy(true);SteamEditor.stop();
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={schemaVersion:1,effectId:'fx.water.steam-jet',
   backend,settings,width:512,height:512,fps:60,
   count:frameCount,frameFormula:'frameIndex/60',alpha:'straight-rgba8',
   scope:'WATER-06 strict 512x512 60fps steam loop/stop with owned procedural soft alpha masks; Spine optional',
   frames:[]};
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('PNG export cancelled');
    const seconds=frame/60;
    SteamEditor.seek(seconds);
    const fx=SteamEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)throw Error('Steam exceeds 512x512 logical bounds at frame '+
      frame+' ('+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(n=>Number(n).toFixed(1)).join(', ')+
      '). Use Fit to canvas or reduce trajectory/size/offsets; PNG not cropped.');
    if(source)source.visible=false; // each editor seek may restore preview visibility
    const bytes=await SteamEditor.extractBytes();
    const filename='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:filename,data:bytes});
    manifest.frames.push({file:filename,frame,timeSeconds:seconds});
    if(frame%10===0)SteamEditor.setStatus('Baking '+(frame+1)+'/'+frameCount+' PNG frames');
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxSteamZip.makeZip(entries,()=>{
    if(cancelled)throw Error('PNG export cancelled');
   });
   if(download)FxSteamZip.download(blob,'Steam_Jet_'+frameCount+'frames_PNG.zip');
   SteamEditor.setStatus('Exported '+frameCount+' transparent 512x512 PNG frames (60 FPS)');
   return {blob,manifest};
  }catch(e){SteamEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   if(source)source.visible=sourceWasVisible;
   SteamEditor.restore(original,wasPlaying);
  }
 }
 const demoCode=target=>[
  "import * as PIXI from 'pixi.js';",
  "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
  "import { FxSteam, createSteam } from './SteamJet.mjs';",
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
  "  PIXI.Assets.add({alias:'steam-skel',src:preset.asset.skeleton});",
  "  PIXI.Assets.add({alias:'steam-atlas',src:preset.asset.atlas});",
  "  await PIXI.Assets.load(['steam-skel','steam-atlas']);",
  "  model=SpineRuntime.Spine.from({skeleton:'steam-skel',atlas:'steam-atlas',autoUpdate:false});",
  "  host.addChild(model);",
  "  if(preset.asset.skin){model.skeleton.setSkinByName(preset.asset.skin);model.skeleton.setSlotsToSetupPose();}",
  "  if(preset.asset.animation)model.state.setAnimation(0,preset.asset.animation,true);",
  "  model.update(0);",
  "  const b=model.getLocalBounds();",
  "  const scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);",
  "  model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
  " }",
  " const effect=createSteam({PIXI,app,host,model,settings:FxSteam.normalize(preset.settings)});",
  " let time=0;",
  " app.ticker.add(ticker=>{",
  "  if(preset.settings.mode==='loop')time=(time+ticker.elapsedMS/1000)%(preset.settings.durationFrames/60);",
  "  else time=Math.min((preset.settings.exportFrames-1)/60,time+ticker.elapsedMS/1000);",
  "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,time);",
  "  app.render();effect.seek(time);app.render();",
  " });",
  " console.info('Steam developer example ready', app.renderer.type);",
  "}",
  "main().catch(error=>{console.error(error);document.body.textContent='Steam Jet startup failed: '+error.message;});",
  ""
 ].join('\n');
 const readme=target=>[
  '# Steam Jet FX Lab — '+target.toUpperCase(),
  '',
  'Run npm install && npm run dev in this extracted directory.',
  'The Vite app uses exact pinned PixiJS 8.22.0 and Spine-pixi-v8 4.2.120.',
  'Network access is not required at runtime once dependencies are installed.',
  'Steam core/runtime source is copied unchanged from the editor HTML.',
  'All controls and true renderer support should be verified on the target device.',
  'Actual WebGPU support and fallback are runtime/platform-dependent; do not infer it from requested preference.',
  'Preset v1, optional Spine JSON/SKEL/atlas/texture assets, shaders not required.',
  'Three independent GPU-owned Pixi ParticleContainer layers share one source atlas per layer with four organic alpha masks.',
  'No fullscreen blur or unverified fluid shader. Stop/burst fade is deterministic, 60f loop is warm-started.',
  ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw Error('Unknown developer backend');
  if(SteamEditor.isBusy)throw Error('Export already running');
  const settings=SteamEditor.getSettings(),asset=SteamEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.water.steam-jet',
   rendererPreference:target,fallbackRenderer:'webgl',settings,
   timing:{fps:60,durationSeconds:settings.durationFrames/60,mode:settings.mode},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),
    atlas:'assets/'+safe(asset.atlasName),animation:$('animation').value,
    skin:$('skin').value}:null,
   compatibility:{pixi:'8.22.0',spine:'4.2.120'},
   source:'WATER-06 independent Steam Jet Lab',
   warning:'Expected renderer is not proof of actual backend; verify runtime'};
  const entries=[
   {name:'preset.json',data:JSON.stringify(preset,null,2)},
   {name:'public/preset.json',data:JSON.stringify(preset,null,2)},
   {name:'FxCurves.mjs',data:getText('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+getText('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+getText('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxTimeline.mjs',data:getText('fxTimelineCore')+'\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxSteam.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+getText('fxSteamCore')+
      '\nexport const FxSteam=globalThis.FxSteam;\n'},
   {name:'SteamJet.mjs',data:"import './FxSteam.mjs';\n"+getText('fxSteamRuntime')+
      '\nexport const FxSteam=globalThis.FxSteam;\nexport const createSteam=globalThis.FxSteamRuntime.createSteam;\n'},
   {name:'example.js',data:demoCode(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:getText('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'spine-steam-jet-'+target,private:true,type:'module',
    scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{
     'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},
     devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Fire Steam</title><style>body{background:#1b2130;color:white;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images){
    entries.push({name:'public/assets/'+safe(name),data:blob});
   }
  }
  return {blob:await FxSteamZip.makeZip(entries),preset,entries};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 $('webglZip').onclick=async()=>{
  try{const result=await buildPackage('webgl');FxSteamZip.download(result.blob,'Steam_Jet_WebGL.zip');
   SteamEditor.setStatus('WebGL developer ZIP exported');}
  catch(e){SteamEditor.setStatus(e.message,true)}
 };
 $('webgpuZip').onclick=async()=>{
  try{const result=await buildPackage('webgpu');FxSteamZip.download(result.blob,'Steam_Jet_WebGPU.zip');
   SteamEditor.setStatus('WebGPU developer ZIP exported');}
  catch(e){SteamEditor.setStatus(e.message,true)}
 };
 return Object.freeze({bake,buildPackage});
})();
