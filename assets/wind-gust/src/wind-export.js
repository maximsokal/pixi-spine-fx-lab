// AIR-01 transparent straight-alpha PNG sequences and exact-core Vite exports.
'use strict';
const WindExports=(()=>{
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
  if(WindEditor.isBusy)throw Error('Wind export already in progress');
  const settings=WindEditor.getSettings(),backend=WindEditor.getActualBackend(),
   frameCount=frames===null?settings.exportFrames:frames,
   original=WindEditor.getTime(),playing=WindEditor.getPlaying(),
   model=WindEditor.getModel();
  if(!Number.isInteger(frameCount)||frameCount<1||frameCount>settings.exportFrames)
   throw TypeError('Wind frame count outside author settings');
  cancelled=false;WindEditor.stop();WindEditor.busy(true);
  $('cancel').disabled=false;$('bake').disabled=true;
  const entries=[],manifest={
   schemaVersion:1,effectId:'fx.air.wind-gust',settings,backend,
   rendering:'isolated-effects-only-512px-straight-RGBA8',
   sourcePolicy:'caller-owned Spine used only for anchor pose; no background baked',
   width:512,height:512,fps:60,frameCount,frameFormula:'frameIndex/60',
   loopPolicy:settings.mode==='loop'?'seamless-periodic-60':'burst-frame39-alpha0',
   alpha:'straight-rgba8',
   frames:[]
  };
  const wasVisible=model?.visible,host=WindEditor.getFx()?.sceneSource;
  const renderable=host?.renderable;
  try{
   for(let frame=0;frame<frameCount;frame++){
    if(cancelled)throw Error('Wind PNG bake cancelled');
    const seconds=frame/60;WindEditor.seek(seconds);
    const fx=WindEditor.getFx();
    if(fx?.diagnostics)throw Error(fx.diagnostics);
    const extent=fx?.currentBounds();
    if(extent&&!extent.inside)
     throw Error('AIR-01 region exceeds 512x512 at frame '+frame+
      ' ['+[extent.minX,extent.minY,extent.maxX,extent.maxY]
       .map(v=>Number(v).toFixed(2)).join(',')+']; resize or Fit, never crop');
    const bytes=await WindEditor.extractBytes();
    const file='frames/'+String(frame).padStart(4,'0')+'.png';
    entries.push({name:file,data:bytes});
    manifest.frames.push({frame,file,timeSeconds:seconds});
    if(frame%10===0)WindEditor.setStatus('Wind PNG '+(frame+1)+'/'+frameCount);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   entries.push({name:'sequence.json',data:JSON.stringify(manifest,null,2)});
   const blob=await FxWindZip.makeZip(entries,()=>{
    if(cancelled)throw Error('Wind export cancelled during ZIP creation');
   });
   if(download)FxWindZip.download(blob,'Wind_'+frameCount+'frames_PNG.zip');
   WindEditor.setStatus('Wind exported: '+frameCount+' frames • transparent RGBA8');
   return {manifest,entries,blob};
  }catch(e){WindEditor.setStatus(e.message,true);throw e}
  finally{
   $('cancel').disabled=true;$('bake').disabled=false;
   if(model)model.visible=wasVisible;
   if(host)host.renderable=renderable;
   WindEditor.restore(original,playing);
  }
 }
 const demo=backend=>[
 "import * as PIXI from 'pixi.js';",
 "import * as SpineRuntime from '@esotericsoftware/spine-pixi-v8';",
 "import { FxWind, createWind } from './Wind.mjs';",
 "import { FxTimeline } from './FxTimeline.mjs';",
 "async function main(){",
 " const preset=await (await fetch('/preset.json')).json();",
 " if(preset.effectId!=='fx.air.wind-gust'||preset.schemaVersion!==1)throw Error('Invalid Wind preset');",
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
 " const settings=FxWind.normalize(preset.settings);",
 " const effect=createWind({PIXI,app,host,model,settings});",
 " let t=0;effect.seek(0);app.render();",
 " app.ticker.add(ticker=>{",
 "  t+=ticker.elapsedMS/1000;",
 "  if(settings.mode==='loop')t=t%(settings.durationFrames/60);",
 "  else t=Math.min((settings.exportFrames-1)/60,t);",

 "  if(model&&preset.asset?.animation)FxTimeline.seekSpine(model,t);",
 "  effect.seek(t);app.render();",
 " });",
 " console.info('Wind developer example ready',app.renderer.type);",
 "}",
 "main().catch(e=>{console.error(e);document.body.textContent='Wind failed: '+e.message});",
 ""
 ].join('\n');
 const readme=backend=>[
  '# AIR-01 Wind Gust '+backend,
  '',
  'Start: npm install --offline; npm run dev; npm run build (Vite 7.1.12).',
  'PixiJS8.22.0 and spine-pixi-v8 4.2.120 exact pins.',
  'FxWind.mjs + Wind.mjs preserve exact numerical core and renderer.',
  'FxCurves/FxSpacing/FxPath/FxColors/FxTimeline shared contracts.',
  '40f burst f0/f39 transparent; alternate exact periodic 60f gust loop.',
  'Real tapered cubic MeshSimple ribbons, independently anchored soft dust.',
  'Wind Speed160px/s, Gust Width120px, max12 live streaks, bend0.3,',
  'Thickness3px, Direction0 degrees, 20 births/s, 14px true arc gap.',
  'Five separately editable time/path/age artist curves.',
  'World and Spine4.2 bone/slot/attachment anchors are independent per layer.',
  'All project resources remain offline, source model excluded from PNG bake.',
  'Call effect.destroy(), do not destroy external host/Spine assets.',
  'Physical phone GPU thermal certification NOT RUN.',
  ''
 ].join('\n');
 async function buildPackage(target){
  if(!['webgl','webgpu'].includes(target))throw TypeError('Unsupported Wind backend');
  if(WindEditor.isBusy)throw Error('Cannot build developer ZIP during bake');
  const settings=WindEditor.getSettings(),asset=WindEditor.getAsset();
  const preset={schemaVersion:1,effectId:'fx.air.wind-gust',
   rendererPreference:target,expectedRenderer:target,
   fallbackPolicy:'assert actual Pixi renderer and report mismatch',
   settings,compatibility:{pixi:'8.22.0',spine:'4.2.120',vite:'7.1.12'},
   timing:{fps:60,durationSeconds:settings.durationFrames/60,
    mode:settings.mode==='loop'?'seamless-periodic-60':'burst-frame39-alpha0'},
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
   {name:'FxWind.mjs',data:"import './FxSpacing.mjs';\nimport './FxPath.mjs';\nimport './FxColors.mjs';\n"+
    text('fxWindCore')+'\nexport const FxWind=globalThis.FxWind;\n'},
   {name:'Wind.mjs',data:"import './FxWind.mjs';\n"+
    text('fxWindRuntime')+
    '\nexport const FxWind=globalThis.FxWind;\n'+
    'export const createWind=globalThis.FxWindRuntime.createWind;\n'},
   {name:'example.js',data:demo(target)},
   {name:'README.md',data:readme(target)},
   {name:'LICENSES.txt',data:text('runtimeLicenses')},
   {name:'package.json',data:JSON.stringify({name:'pixi-spine-wind-'+target,
    private:true,type:'module',scripts:{dev:'vite --host 0.0.0.0',
     build:'vite build'},dependencies:{'pixi.js':'8.22.0',
     '@esotericsoftware/spine-pixi-v8':'4.2.120'},devDependencies:{vite:'7.1.12'}},null,2)},
   {name:'index.html',data:'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>AIR-01 Wind</title><style>body{background:#111827;color:#eef2ff;display:grid;place-items:center;min-height:90vh}</style><script type="module" src="/example.js"></script></html>'}
  ];
  if(asset){
   entries.push({name:'public/assets/'+safe(asset.skeletonName),data:asset.skeleton});
   entries.push({name:'public/assets/'+safe(asset.atlasName),data:asset.atlas});
   for(const [name,blob] of asset.images)
    entries.push({name:'public/assets/'+safe(name),data:blob});
  }
  return {preset,entries,blob:await FxWindZip.makeZip(entries)};
 }
 $('bake').onclick=()=>bake().catch(()=>{});
 $('cancel').onclick=()=>{cancelled=true};
 for(const target of ['webgl','webgpu']){
  $(target+'Zip').onclick=async()=>{
   try{
    const pack=await buildPackage(target);
    FxWindZip.download(pack.blob,'Wind_'+target.toUpperCase()+'.zip');
    WindEditor.setStatus(target+' developer ZIP ready');
   }catch(e){WindEditor.setStatus(e.message,true)}
  };
 }
 return Object.freeze({bake,buildPackage});
})();
