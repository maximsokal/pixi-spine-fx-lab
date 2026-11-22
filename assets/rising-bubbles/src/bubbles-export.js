// WATER-05 transparent straight-alpha PNG sequences and exact-core Vite exports.
'use strict';
const BubblesExports=(()=>{
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
  if(BubblesEditor.isBusy)throw Error('Bubbles export already in progress');
  const settings=BubblesEditor.getSettings(),backend=BubblesEditor.getActualBackend(),
   frameCount=frames===null?settings.exportFrames:frames,
   original=BubblesEditor.getTime(),playing=BubblesEditor.getPlaying(),
   model=BubblesEditor.getModel();
  if(!Number.isInteger(frameCount)||frameCount<1||frameCount>settings.exportFrames)
   throw TypeError('Bubbles frame count outside author settings');
  cancelled=false;BubblesEditor.stop();BubblesEditor.busy(true);
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={
   schemaVersion:1,effectId:'fx.water.rising-bubbles',settings,backend,
   rendering:'isolated-effects-only-512px-straight-RGBA8',
   sourcePolicy:'caller-owned Spine used only for anchor pose; no background baked',
   width:512,height:512,fps:60,frameCount,frameFormula:'frameIndex/60',
   loopPolicy:settings.mode==='loop'?'seamless-periodic-60':'shutdown-frame39-alpha0',
   alpha:'straight-rgba8',
   frames:[]
  };
  const wasVisible=model?.visible,host=BubblesEditor.getFx()?.sceneSource;
  const renderable=host?.renderable;
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('Bubbles PNG bake cancelled');
    const seconds=frame/60;BubblesEditor.seek(seconds);
    const fx=BubblesEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)
     throw Error('WATER-05 region exceeds 512x512 at frame '+frame+
      ' ['+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(v=>Number(v).toFixed(2)).join(',')+']; resize or Fit, never crop');
    const bytes=await BubblesEditor.extractBytes();
    const file='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:file,data:bytes});
    manifest.frames.push({frame,file,timeSeconds:seconds});
    if(frame%10===0)BubblesEditor.setStatus('Bubbles PNG '+(frame+1)+'/'+frameCount);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxBubblesZip.makeZip(entries,()=>{
    if(cancelled)throw Error('Bubbles export cancelled during ZIP creation');
   });
   if(download)FxBubblesZip.download(blob,'Rising_Bubbles_'+frameCount+'frames_PNG.zip');
   BubblesEditor.setStatus('Bubbles exported: '+frameCount+' frames • transparent RGBA8');
   return {manifest,entries,blob};
  }catch(e){BubblesEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   if(model)model.visible=wasVisible;
   if(host)host.renderable=renderable;
   BubblesEditor.restore(original,playing);
  }
 }
 const demo=backend=>[
 "import * as PIXI from 'pixi.js';",
 "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
 "import { FxBubbles, createBubbles } from './Bubbles.mjs';",
 "import { FxTimeline } from './FxTimeline.mjs';",
 "async function main(){",
 " const preset=await (await fetch('/preset.json')).json();",
 " if(preset.effectId!=='fx.water.rising-bubbles'||preset.schemaVersion!==1)throw Error('Invalid Bubbles preset');",
 " const app=new PIXI.Application();",
 " await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,",
 "  preference:'"+backend+"',preferWebGLVersion:2});",
 " const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';",
 " if(preset.expectedRenderer==='webgpu'&&actual!=='webgpu')throw Error('WebGPU requested but actual '+actual);",
 " if(preset.expectedRenderer==='webgl'&&!['webgl1','webgl2'].includes(actual))throw Error('WebGL requested but actual '+actual);",
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
 " const settings=FxBubbles.normalize(preset.settings);",
 " const effect=createBubbles({PIXI,app,host,model,settings});",
 " let t=0;effect.seek(0);app.render();",
 " app.ticker.add(ticker=>{",
 "  t+=ticker.elapsedMS/1000;",
 "  if(settings.mode==='loop')t=t%(settings.durationFrames/60);",
 "  else t=Math.min((settings.exportFrames-1)/60,t);",

 "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,t);",
 "  effect.seek(t);app.render();",
 " });",
 " console.info('Bubbles developer example ready',app.renderer.type);",
 "}",
 "main().catch(e=>{console.error(e);document.body.textContent='Bubbles failed: '+e.message});",
 ""
 ].join('\n');
 const readme=backend=>[
 '# WATER-05 Rising Bubbles developer '+backend,
 '',
 'npm install && npm run dev; npm run build (Vite 7.1.12).',
 'PixiJS 8.22.0 and Spine Pixi 4.2.120 exact pins, no CDN runtime.',
 'FxBubbles.mjs and Bubbles.mjs embed byte-identical numerical/runtime source.',
 'FxCurves, FxSpacing, FxColors and FxTimeline use exact shared source modules.',
 'The deterministic 60-frame loop reconstructs prior-period bubble motion.',
 'Optional 40-frame shutdown: last frame (39) completely transparent.',
 'Independent layers: bubbles, highlights, popRings.',
 'Defaults: rate16/s, radius8px, buoyancy90px/s?, wobble12px, lifetime1.8s.',
 'Nozzle originGap22px is physical cubic arc length within 320px span.',
 'Five curves: size/age, drift/age, alpha/age, rate/time, gap/path.',
 'Layer RGBA/blend, per-emitter seed/anchor, styles and quality are editable.',
 'Missing Spine 4.2 anchors hide only affected layers.',
 'PNG output uses 512x512 straight RGBA8 without Spine model or preview guides.',
 'Caller retains Spine/host. Call effect.destroy() to release owned GPU resources.',
 'Phone GPU performance/thermals and binary .skel fixture are NOT certified.',
 ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw TypeError('Unsupported Bubbles backend');
  if(BubblesEditor.isBusy)throw Error('Cannot build developer ZIP during bake');
  const settings=BubblesEditor.getSettings(),asset=BubblesEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.water.rising-bubbles',
   rendererPreference:target,expectedRenderer:target,
   fallbackPolicy:'assert actual Pixi renderer and report mismatch',
   settings,compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   timing:{fps:60,durationSeconds:settings.durationFrames/60,
    mode:settings.mode==='loop'?'seamless-periodic-60':'shutdown-frame39-alpha0'},
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
   {name:'FxColors.mjs',data:"import './FxCurves.mjs';\n"+
    text('fxColorCore')+'\nexport const FxColors=globalThis.FxColors;\n'},
   {name:'FxTimeline.mjs',data:text('fxTimelineCore')+
    '\nexport const FxTimeline=globalThis.FxTimeline;\n'},
   {name:'FxBubbles.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+
    text('fxBubblesCore')+'\nexport const FxBubbles=globalThis.FxBubbles;\n'},
   {name:'Bubbles.mjs',data:"import './FxBubbles.mjs';\n"+
    text('fxBubblesRuntime')+
    '\nexport const FxBubbles=globalThis.FxBubbles;\n'+
    'export const createBubbles=globalThis.FxBubblesRuntime.createBubbles;\n'},
   {name:'example.js',data:demo(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:text('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-bubbles-'+target,
    private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',
     build:'vite build'},dependencies:{'pixi.js':'8.22.0',
     '@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>WATER-05 Bubbles</title><style>body{background:#111827;color:#eef2ff;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)
    entries.push({name:'public/assets/'+safe(name),data:blob});
  }
  return {preset,entries,blob:await FxBubblesZip.makeZip(entries)};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 for(const target of ['webgl','webgpu']){
  $(target+'Zip').onclick=async()=>{
   try{
    const pack=await buildPackage(target);
    FxBubblesZip.download(pack.blob,'Rising_Bubbles_'+target.toUpperCase()+'.zip');
    BubblesEditor.setStatus(target+' developer ZIP ready');
   }catch(e){BubblesEditor.setStatus(e.message,true)}
  };
 }
 return Object.freeze({bake,buildPackage});
})();
