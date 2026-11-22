// WATER-03 transparent straight-alpha PNG sequences and exact-core Vite exports.
'use strict';
const RipplesExports=(()=>{
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
  if(RipplesEditor.isBusy)throw Error('Ripples export already in progress');
  const settings=RipplesEditor.getSettings(),backend=RipplesEditor.getActualBackend(),
   frameCount=frames===null?settings.exportFrames:frames,
   original=RipplesEditor.getTime(),playing=RipplesEditor.getPlaying(),
   model=RipplesEditor.getModel();
  if(!Number.isInteger(frameCount)||frameCount<1||frameCount>settings.exportFrames)
   throw TypeError('Ripples frame count outside author settings');
  cancelled=false;RipplesEditor.stop();RipplesEditor.busy(true);
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={
   schemaVersion:1,effectId:'fx.water.water-ripples',settings,backend,
   rendering:'isolated-effects-only-512px-straight-RGBA8',
   sourcePolicy:'caller-owned Spine used only for anchor pose; no background baked',
   width:512,height:512,fps:60,frameCount,frameFormula:'frameIndex/60',
   loopPolicy:settings.loop?'cyclic-periodic-40':'one-shot-frame39-alpha0',
   alpha:'straight-rgba8',
   frames:[]
  };
  const wasVisible=model?.visible,host=RipplesEditor.getFx()?.sceneSource;
  const renderable=host?.renderable;
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('Ripples PNG bake cancelled');
    const seconds=frame/60;RipplesEditor.seek(seconds);
    const fx=RipplesEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)
     throw Error('WATER-03 region exceeds 512x512 at frame '+frame+
      ' ['+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(v=>Number(v).toFixed(2)).join(',')+']; resize or Fit, never crop');
    const bytes=await RipplesEditor.extractBytes();
    const file='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:file,data:bytes});
    manifest.frames.push({frame,file,timeSeconds:seconds});
    if(frame%10===0)RipplesEditor.setStatus('Ripples PNG '+(frame+1)+'/'+frameCount);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxRipplesZip.makeZip(entries,()=>{
    if(cancelled)throw Error('Ripples export cancelled during ZIP creation');
   });
   if(download)FxRipplesZip.download(blob,'Water_Ripples_'+frameCount+'frames_PNG.zip');
   RipplesEditor.setStatus('Ripples exported: '+frameCount+' frames • transparent RGBA8');
   return {manifest,entries,blob};
  }catch(e){RipplesEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   if(model)model.visible=wasVisible;
   if(host)host.renderable=renderable;
   RipplesEditor.restore(original,playing);
  }
 }
 const demo=backend=>[
 "import * as PIXI from 'pixi.js';",
 "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
 "import { FxRipples, createRipples } from './WaterRipples.mjs';",
 "import { FxTimeline } from './FxTimeline.mjs';",
 "async function main(){",
 " const preset=await (await fetch('/preset.json')).json();",
 " if(preset.effectId!=='fx.water.water-ripples'||preset.schemaVersion!==1)throw Error('Invalid Ripples preset');",
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
 " const settings=FxRipples.normalize(preset.settings);",
 " const effect=createRipples({PIXI,app,host,model,settings});",
 " let t=0;effect.seek(0);app.render();",
 " app.ticker.add(ticker=>{",
 "  t+=ticker.elapsedMS/1000;",
 "  if(settings.loop)t=t%(settings.durationFrames/60);",
 "  else t=Math.min((settings.exportFrames-1)/60,t);",

 "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,t);",
 "  effect.seek(t);app.render();",
 " });",
 " console.info('Water Ripples developer example ready',app.renderer.type);",
 "}",
 "main().catch(e=>{console.error(e);document.body.textContent='Ripples failed: '+e.message});",
 ""
 ].join('\n');
 const readme=backend=>[
 '# WATER-03 Water Ripples developer example ('+backend+')',
 '',
 'Run npm install && npm run dev. Exact pins are PixiJS 8.22.0,',
 '@esotericsoftware/spine-pixi-v8 4.2.120 and Vite 7.1.12.',
 'FxRipples.mjs and WaterRipples.mjs use the *exact* offline lab numerical',
 'and MeshSimple runtime source. No network assets/filters required.',
 'Core supports 40-frame one-shot (frame39 entirely transparent),',
 'or cyclic 40-frame impacts carrying earlier rings across period boundary.',
 'Three layers primary/secondary/highlights have independent world,',
 'inherit emitter and Spine4.2 bone/slot/attachment anchors.',
 'Four distinct curves: radius, thickness, alpha and time interval.',
 'radialGapPx is unrelated to time ringDelayFrames and to highlightArcGapPx.',
 'Mesh geometry is reused with vertex buffer updates; soft edge is a',
 'procedural internal 32x128 color-by-age and radial-alpha texture.',
 'The caller owns the stage host and Spine model. This effect owns only',
 'the ring stage subtree. Always call effect.destroy() on teardown.',
 'Set model pose with FxTimeline before absolute effect.seek(seconds).',
 'The PNG bake is isolated straight-alpha 512x512 RGBA8 without CSS',
 'background/zoom or Spine source. Crop is explicitly rejected.',
 'Physical phone GPU FPS, arbitrary fluid physics, .skel fixtures may',
 'be NOT RUN until independently tested.',
 ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw TypeError('Unsupported Ripples backend');
  if(RipplesEditor.isBusy)throw Error('Cannot build developer ZIP during bake');
  const settings=RipplesEditor.getSettings(),asset=RipplesEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.water.water-ripples',
   rendererPreference:target,expectedRenderer:target,
   fallbackPolicy:'assert actual Pixi renderer and report mismatch',
   settings,compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   timing:{fps:60,durationSeconds:settings.durationFrames/60,
    mode:settings.loop?'cyclic-periodic-40':'one-shot-frame39-alpha0'},
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
   {name:'FxRipples.mjs',data:"import './FxSpacing.mjs';\nimport './FxColors.mjs';\n"+
    text('fxRipplesCore')+'\nexport const FxRipples=globalThis.FxRipples;\n'},
   {name:'WaterRipples.mjs',data:"import './FxRipples.mjs';\n"+
    text('fxRipplesRuntime')+
    '\nexport const FxRipples=globalThis.FxRipples;\n'+
    'export const createRipples=globalThis.FxRipplesRuntime.createRipples;\n'},
   {name:'example.js',data:demo(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:text('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-water-ripples-'+target,
    private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',
     build:'vite build'},dependencies:{'pixi.js':'8.22.0',
     '@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>WATER-03 Water Ripples</title><style>body{background:#111827;color:#eef2ff;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)
    entries.push({name:'public/assets/'+safe(name),data:blob});
  }
  return {preset,entries,blob:await FxRipplesZip.makeZip(entries)};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 for(const target of ['webgl','webgpu']){
  $(target+'Zip').onclick=async()=>{
   try{
    const pack=await buildPackage(target);
    FxRipplesZip.download(pack.blob,'Water_Ripples_'+target.toUpperCase()+'.zip');
    RipplesEditor.setStatus(target+' developer ZIP ready');
   }catch(e){RipplesEditor.setStatus(e.message,true)}
  };
 }
 return Object.freeze({bake,buildPackage});
})();
