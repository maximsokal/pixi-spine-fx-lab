// FIRE-03 PNG sequence and self-contained optional Vite developer handoff.
'use strict';
const ProjectileExports=(()=>{
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
  if(ProjectileEditor.isBusy)throw Error('Export already running');
  const settings=ProjectileEditor.getSettings(),original=ProjectileEditor.getTime(),
    wasPlaying=ProjectileEditor.getPlaying();
  const frameCount=settings.exportFrames,backend=ProjectileEditor.getActualBackend();
  cancelled=false;ProjectileEditor.busy(true);ProjectileEditor.stop();
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={schemaVersion:1,effectId:'fx.fire.fireball-projectile',
   backend,settings,width:512,height:512,fps:60,
   count:frameCount,frameFormula:'frameIndex/60',alpha:'straight-rgba8',
   scope:'512x512 projectile+optional Spine stage at absolute times; live state restored',
   frames:[]};
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('PNG export cancelled');
    const seconds=frame/60;
    ProjectileEditor.seek(seconds);
    const fx=ProjectileEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)throw Error('Projectile exceeds 512x512 logical bounds at frame '+
      frame+' ('+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(n=>Number(n).toFixed(1)).join(', ')+
      '). Use Fit to canvas or reduce trajectory/size/offsets; PNG not cropped.');
    const bytes=await ProjectileEditor.extractBytes();
    const filename='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:filename,data:bytes});
    manifest.frames.push({file:filename,frame,timeSeconds:seconds});
    if(frame%10===0)ProjectileEditor.setStatus('Baking '+(frame+1)+'/'+frameCount+' PNG frames');
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxProjectileZip.makeZip(entries,()=>{
    if(cancelled)throw Error('PNG export cancelled');
   });
   if(download)FxProjectileZip.download(blob,'Fireball_Projectile_'+frameCount+'frames_PNG.zip');
   ProjectileEditor.setStatus('Exported '+frameCount+' transparent 512x512 PNG frames (60 FPS)');
   return {blob,manifest};
  }catch(e){ProjectileEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   ProjectileEditor.restore(original,wasPlaying);
  }
 }
 const demoCode=target=>[
  "import * as PIXI from 'pixi.js';",
  "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
  "import { FxProjectile, createProjectile } from './FireballProjectile.mjs';",
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
  "  PIXI.Assets.add({alias:'projectile-skel',src:preset.asset.skeleton});",
  "  PIXI.Assets.add({alias:'projectile-atlas',src:preset.asset.atlas});",
  "  await PIXI.Assets.load(['projectile-skel','projectile-atlas']);",
  "  model=SpineRuntime.Spine.from({skeleton:'projectile-skel',atlas:'projectile-atlas',autoUpdate:false});",
  "  host.addChild(model);",
  "  if(preset.asset.skin){model.skeleton.setSkinByName(preset.asset.skin);model.skeleton.setSlotsToSetupPose();}",
  "  if(preset.asset.animation)model.state.setAnimation(0,preset.asset.animation,true);",
  "  model.update(0);",
  "  const b=model.getLocalBounds();",
  "  const scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);",
  "  model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
  " }",
  " const effect=createProjectile({PIXI,app,host,model,settings:FxProjectile.normalize(preset.settings)});",
  " let time=0;",
  " app.ticker.add(ticker=>{",
  "  if(preset.settings.loop)time=(time+ticker.elapsedMS/1000)%(preset.settings.durationFrames/60);",
  "  else time=Math.min((preset.settings.exportFrames-1)/60,time+ticker.elapsedMS/1000);",
  "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,time);",
  "  app.render();effect.seek(time);app.render();",
  " });",
  " console.info('Projectile developer example ready', app.renderer.type);",
  "}",
  "main().catch(error=>{console.error(error);document.body.textContent='Projectile startup failed: '+error.message;});",
  ""
 ].join('\n');
 const readme=target=>[
  '# Fire Projectile FX Lab — '+target.toUpperCase(),
  '',
  'Run npm install && npm run dev in this extracted directory.',
  'The Vite app uses exact pinned PixiJS 8.22.0 and Spine-pixi-v8 4.2.120.',
  'Network access is not required at runtime once dependencies are installed.',
  'Projectile core/runtime source is copied unchanged from the editor HTML.',
  'All controls and true renderer support should be verified on the target device.',
  'Actual WebGPU support and fallback are runtime/platform-dependent; do not infer it from requested preference.',
  'Preset v1, optional Spine JSON/SKEL/atlas/texture assets, shaders not required.',
  'Ribbon geometry is constructed using the pinned FxPath core and Pixi Graphics.',
  'Heat haze: stylized wavering contour only, no true optical distortion shader.',
  ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw Error('Unknown developer backend');
  if(ProjectileEditor.isBusy)throw Error('Export already running');
  const settings=ProjectileEditor.getSettings(),asset=ProjectileEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.fire.fireball-projectile',
   rendererPreference:target,fallbackRenderer:'webgl',settings,
   timing:{fps:60,durationSeconds:settings.durationFrames/60,loop:settings.loop},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),
    atlas:'assets/'+safe(asset.atlasName),animation:$('animation').value,
    skin:$('skin').value}:null,
   compatibility:{pixi:'8.22.0',spine:'4.2.120'},
   source:'FIRE-03 independent Fireball Projectile Lab',
   warning:'Expected renderer is not proof of actual backend; verify runtime'};
  const entries=[
   {name:'preset.json',data:JSON.stringify(preset,null,2)},
   {name:'public/preset.json',data:JSON.stringify(preset,null,2)},
   {name:'FxCurves.mjs',data:getText('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+getText('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+getText('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxPath.mjs',data:"import './FxSpacing.mjs';\n"+getText('fxPathCore')+
      '\nexport const FxPath=globalThis.FxPath;\n'},
   {name:'FxTimeline.mjs',data:getText('fxTimelineCore')+'\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxProjectile.mjs',data:"import './FxPath.mjs';\nimport './FxColors.mjs';\n"+getText('fxProjectileCore')+
      '\nexport const FxProjectile=globalThis.FxProjectile;\n'},
   {name:'FireballProjectile.mjs',data:"import './FxProjectile.mjs';\n"+getText('fxProjectileRuntime')+
      '\nexport const FxProjectile=globalThis.FxProjectile;\nexport const createProjectile=globalThis.FxProjectileRuntime.createProjectile;\n'},
   {name:'example.js',data:demoCode(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:getText('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'spine-fireball-projectile-'+target,private:true,type:'module',
    scripts:{dev:'vite --host 0.0.0.0',build:'vite build'},dependencies:{
     'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},
     devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Fire Projectile</title><style>body{background:#1b2130;color:white;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images){
    entries.push({name:'public/assets/'+safe(name),data:blob});
   }
  }
  return {blob:await FxProjectileZip.makeZip(entries),preset,entries};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 $('webglZip').onclick=async()=>{
  try{const result=await buildPackage('webgl');FxProjectileZip.download(result.blob,'Fireball_Projectile_WebGL.zip');
   ProjectileEditor.setStatus('WebGL developer ZIP exported');}
  catch(e){ProjectileEditor.setStatus(e.message,true)}
 };
 $('webgpuZip').onclick=async()=>{
  try{const result=await buildPackage('webgpu');FxProjectileZip.download(result.blob,'Fireball_Projectile_WebGPU.zip');
   ProjectileEditor.setStatus('WebGPU developer ZIP exported');}
  catch(e){ProjectileEditor.setStatus(e.message,true)}
 };
 return Object.freeze({bake,buildPackage});
})();
