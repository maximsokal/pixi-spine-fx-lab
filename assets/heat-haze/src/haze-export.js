// FIRE-06 dedicated typed PNG sequences and exact-source Vite developer handoff.
'use strict';
const HazeExports=(()=>{
 const $=id=>document.getElementById(id),source=id=>$(id).textContent;
 let cancelled=false;
 const representations=Object.freeze({
  displacement:{path:'maps/',type:'displacement-field-rgba8-data',
   alpha:'opaque-data-carrier',neutralByte:128,displacementRangePx:32,
   formula:'offsetPx = (channelByte - 128) * 32 / 127; masked by B / 255',
   channelLayout:'R=signed X; G=signed Y; B=coverage mask; A=255',
   warning:'NOT a compositable transparent PNG. Game-side refraction needs a live scene input.'},
  glow:{path:'glow/',type:'transparent-glow-rgba8',
   alpha:'straight-rgba8',warning:'This RGBA overlay does not refract a future background.'},
  composite:{path:'composite/',type:'captured-scene-rgba8',
   alpha:'selected-background-baked',
   warning:'Refraction is baked into the explicitly selected scene; NOT an arbitrary background overlay.'}
 });
 function safe(name){
  const n=String(name).replaceAll('\\','/');
  if(!n||n.startsWith('/')||/^[A-Za-z]:/.test(n)||
   n.split('/').some(x=>!x||x==='..'||x==='.')||
   /[\0-\x1f]/.test(n))throw Error('Unsafe asset filename: '+name);
  return n;
 }
 async function bake({download=true,kind=$('exportKind').value}={}){
  if(HazeEditor.isBusy)throw Error('Heat export already running');
  if(kind!=='all'&&!representations[kind])throw TypeError('Unknown Haze PNG representation');
  const types=kind==='all'?Object.keys(representations):[kind];
  const background=HazeEditor.getBackgroundKind();
  if(types.includes('composite')&&background==='none'&&!HazeEditor.getModel())
   throw Error('Composited refraction needs an explicit Pixi scene source; choose a captured background');
  const settings=HazeEditor.getSettings(),backend=HazeEditor.getActualBackend(),
   original=HazeEditor.getTime(),wasPlaying=HazeEditor.getPlaying();
  const frameCount=settings.exportFrames;
  cancelled=false;HazeEditor.stop();HazeEditor.busy(true);
  $('cancel').disabled=false;$('bake').disabled=true;
  const manifest={
   schemaVersion:1,effectId:'fx.fire.heat-haze',settings,backend,
   sourceKind:background,sourcePolicy:'explicit-pixi-scene-only',
   width:512,height:512,fps:60,frameCount,
   frameFormula:'frameIndex/60',
   composition:'captured original -> displaced copy -> alpha coverage mask -> optional independent glow',
   representations:Object.fromEntries(types.map(t=>[t,representations[t]])),
   frames:[],
   warnings:[
    'Displacement field is opaque DATA, not a transparent overlay',
    'Static composited PNG contains the selected background, not an arbitrary live game scene',
    'No DOM/CSS/external iframe/screen capture, no silent fallback to false refraction',
    'Renderer must be independently identified on consumer platform'
   ]
  };
  const entries=[];
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('Heat PNG bake cancelled');
    const seconds=frame/60;HazeEditor.seek(seconds);
    const fx=HazeEditor.getFx();
    if(fx.diagnostic&&/NO REFRACTION INPUT/.test(fx.diagnostic)&&
      types.includes('composite'))throw Error(fx.diagnostic);
    if(fx.diagnostic&&/Missing\/inactive anchors/.test(fx.diagnostic))
     throw Error(fx.diagnostic);
    const bounds=fx.bounds();
    if(!bounds.inside)throw Error('Heat region exceeds 512x512 at frame '+frame+
     ' bounds ['+[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY]
      .map(x=>Number(x).toFixed(1)).join(',')+
     ']. Fit or reposition source. Silent crop forbidden.');
    const named={frame,timeSeconds:seconds,files:{}};
    for(const type of types){
     if(cancelled)throw Error('Heat PNG bake cancelled');
     const bytes=await HazeEditor.extractBytes(type);
     const filename=representations[type].path+String(frame).padStart(4,'0')+'.png';
     entries.push({name:filename,data:bytes});
     named.files[type]=filename;
    }
    manifest.frames.push(named);
    if(frame%10===0)HazeEditor.setStatus('Heat bake '+(frame+1)+'/'+frameCount+' • '+types.join(', '));
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxHazeZip.makeZip(entries,()=>{
    if(cancelled)throw Error('Heat ZIP creation cancelled');
   });
   if(download)FxHazeZip.download(blob,'Heat_Haze_'+kind+'_'+frameCount+'frames_PNG.zip');
   HazeEditor.setStatus('Heat exported '+types.join(' + ')+' — '+frameCount+' frames / 60 FPS');
   return {blob,manifest,entries};
  }catch(error){HazeEditor.setStatus(error.message,true);throw error}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   HazeEditor.restore(original,wasPlaying);
  }
 }
 const demoCode=target=>[
  "import * as PIXI from 'pixi.js';",
  "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
  "import { FxHaze, createHaze } from './HeatHaze.mjs';",
  "import { FxTimeline } from './FxTimeline.mjs';",
  "async function main(){",
  " const preset=await (await fetch('/preset.json')).json();",
  " if(preset.effectId!=='fx.fire.heat-haze')throw Error('Wrong heat preset ID');",
  " const app=new PIXI.Application();",
  " await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:'"+target+"',preferWebGLVersion:2});",
  " document.body.append(app.canvas);",
  " const host=new PIXI.Container();app.stage.addChild(host);",
  " const bg=preset.background;",
  " if(bg.policy==='staticTexture'){",
  "   const image=await PIXI.Assets.load('/'+bg.path);",
  "   const s=new PIXI.Sprite(image);s.width=s.height=512;host.addChild(s);",
  " }else if(bg.policy==='builtIn'){",
  "   const grid=new PIXI.Graphics();",
  "   for(let y=0;y<512;y+=8)for(let x=0;x<512;x+=8){",
  "    const even=((x/8+y/8)%2)===0;",
  "    const color=bg.kind==='light'?(even?0xe6eaf1:0xfafcff):",
  "     bg.kind==='dark'?(even?0x121925:0x364153):(even?0x1d2c42:0xd9e5fa);",
  "    grid.rect(x,y,8,8).fill(color);",
  "   }",
  "   host.addChild(grid);",
  " }",
  " let model=null;",
  " if(preset.asset){",
  "  PIXI.Assets.add({alias:'heat-skel',src:preset.asset.skeleton});",
  "  PIXI.Assets.add({alias:'heat-atlas',src:preset.asset.atlas});",
  "  await PIXI.Assets.load(['heat-skel','heat-atlas']);",
  "  model=SpineRuntime.Spine.from({skeleton:'heat-skel',atlas:'heat-atlas',autoUpdate:false});",
  "  host.addChild(model);",
  "  if(preset.asset.skin){model.skeleton.setSkinByName(preset.asset.skin);model.skeleton.setSlotsToSetupPose()}",
  "  if(preset.asset.animation)model.state.setAnimation(0,preset.asset.animation,true);",
  "  model.update(0);",
  "  const b=model.getLocalBounds(),scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);",
  "  model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);",
  " }",
  " const settings=FxHaze.normalize(preset.settings);",
  " const effect=createHaze({PIXI,app,host,sceneSource:host,model,settings});",
  " let t=0;effect.seek(0);app.render();",
  " app.ticker.add(ticker=>{",
  "  t+=ticker.elapsedMS/1000;",
  "  if(settings.mode==='loop')t=t%(settings.durationFrames/60);",
  "  else t=Math.min((settings.exportFrames-1)/60,t);",
  "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,t);",
  "  effect.seek(t);app.render();",
  " });",
  " console.info('Heat Haze developer example ready',app.renderer.type);",
  "}",
  "main().catch(error=>{console.error(error);document.body.textContent='Heat Haze startup failed: '+error.message});",
  ""
 ].join('\n');
 const readme=target=>[
  '# FIRE-06 Heat Haze — '+target.toUpperCase()+' developer example',
  '',
  'Extract, run npm install and npm run dev. Dependencies are exact: PixiJS 8.22.0,',
  '@esotericsoftware/spine-pixi-v8 4.2.120 and Vite 7.1.12.',
  'Example.js creates a host-owned Pixi scene, then the same FxHaze/HeatHaze',
  'core and runtime as the offline editor. It never applies a filter to a',
  'transparent overlay and never captures DOM/CSS/screen content.',
  '',
  'Integration contract:',
  '- Create a stable, identity-transform Pixi Container host and insert the scene',
  '  that should be refracted (not the entire stage and not the FX overlay).',
  '- app.stage.addChild(host); pass {PIXI,app,host,sceneSource:host,model,settings}',
  '  to createHaze. The runtime temporarily renders host once per seek into',
  '  a 512x512 owned RenderTexture, masks a filtered copy, composites it over',
  '  the captured original and adds optional thermal glow separately.',
  '- A NO REFRACTION INPUT diagnostic means no game scene was provided.',
  '- For Spine, use exports matching spine-pixi-v8 4.2.120; call seekSpine before',
  '  effect.seek() and app.render(). Optional active bone/slot/attachment anchors',
  '  are resolved against that Skeleton; missing anchors hide only that source.',
  '- Seek in seconds from a fixed 60fps timeline. Do not drive shader phase',
  '  from ticker callback count, rerender arbitrary external stages, or allow the',
  '  FX output to be recursively included in its own scene capture.',
  '- To use data maps in a different engine, read RED as dx, GREEN as dy:',
  '  dx/dy = (byte - 128) * 32 / 127 px; BLUE as coverage mask /255,',
  '  ALPHA=255 opaque data carrier. Never treat map as an RGBA visual overlay.',
  '  Explicitly bypass (not shift by 128/255 bias) when B=0 or amplitude=0.',
  '- Glow-only PNG has straight alpha; composited PNG has the chosen',
  '  background and cannot refract arbitrary future imagery.',
  '',
  'Source/texture lifetimes are owned by the runtime except the caller-owned host,',
  'scene, and Spine atlases; call effect.destroy() before tearing down Pixi.',
  'No blanket blur, full-screen shader or extra pixi-filters dependency.',
  'Quality Low/Balanced/High uses 128²/256²/512² CPU-updated field grids.',
  '',
  'No hardware/mobile FPS guarantee from headless Chromium tests.',
  ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw TypeError('Unsupported developer renderer');
  if(HazeEditor.isBusy)throw Error('Cannot build developer ZIP during PNG bake');
  const settings=HazeEditor.getSettings(),asset=HazeEditor.getAsset(),
   sourceKind=HazeEditor.getBackgroundKind(),
   bgAsset=HazeEditor.getBackgroundAsset();
  if(sourceKind==='local'&&!bgAsset)
   throw Error('Local source image missing from handoff');
  const bg=sourceKind==='local'?
   {policy:'staticTexture',kind:'local',path:'assets/'+safe(bgAsset.name)}:
   sourceKind==='none'?{policy:'none',kind:'none'}:
    {policy:'builtIn',kind:sourceKind};
  const preset={
   schemaVersion:1,effectId:'fx.fire.heat-haze',
   rendererPreference:target,expectedRenderer:target,
   fallbackPolicy:'record-actual-and-fail-tests-on-mismatch',
   settings,background:bg,rendering:{
    capturePolicy:'explicit-caller-Pixi-scene',renderTexture:'owned',
    input:'sceneSource-container',distortionMapEncoding:representations.displacement,
    glow:representations.glow,composite:representations.composite},
   timing:{fps:60,durationSeconds:settings.durationFrames/60,mode:settings.mode},
   compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   asset:asset?{skeleton:'assets/'+safe(asset.skeletonName),
    atlas:'assets/'+safe(asset.atlasName),skin:$('skin').value,
    animation:$('animation').value}:null,
   warnings:['Preview and handoff must identify actual backend',
    'Displacement data PNG is NOT a compositable visual overlay']
  };
  const entries=[
   {name:'preset.json',data:JSON.stringify(preset,null,2)},
   {name:'public/preset.json',data:JSON.stringify(preset,null,2)},
   {name:'FxCurves.mjs',data:source('fxCurveCore')+'\nexport const FxCurves=globalThis.FxCurves;\n'},
   {name:'FxSpacing.mjs',data:"import './FxCurves.mjs';\n"+
    source('fxSpacingCore')+'\nexport const FxSpacing=globalThis.FxSpacing;\n'},
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+
    source('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxTimeline.mjs',data:source('fxTimelineCore')+
    '\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxHaze.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+
    source('fxHazeCore')+'\nexport const FxHaze=globalThis.FxHaze;\n'},
   {name:'HeatHaze.mjs',data:"import './FxHaze.mjs';\n"+
    source('fxHazeRuntime')+
    '\nexport const FxHaze=globalThis.FxHaze;\n'+
    'export const createHaze=globalThis.FxHazeRuntime.createHaze;\n'},
   {name:'example.js',data:demoCode(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:source('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-heat-haze-'+target,
    private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',
     build:'vite build'},dependencies:{'pixi.js':'8.22.0',
     '@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>FIRE-06 Heat Haze</title><style>body{background:#111827;color:#eef2ff;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(bgAsset&&sourceKind==='local')entries.push({
   name:'public/assets/'+safe(bgAsset.name),data:bgAsset.blob});
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)
    entries.push({name:'public/assets/'+safe(name),data:blob});
  }
  return {blob:await FxHazeZip.makeZip(entries),preset,entries};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 for(const target of ['webgl','webgpu']){
  $(target+'Zip').onclick=async()=>{
   try{
    const output=await buildPackage(target);
    FxHazeZip.download(output.blob,'Heat_Haze_'+target.toUpperCase()+'.zip');
    HazeEditor.setStatus(target.toUpperCase()+' Heat Haze developer ZIP exported');
   }catch(error){HazeEditor.setStatus(error.message,true)}
  };
 }
 return Object.freeze({bake,buildPackage,representations});
})();
