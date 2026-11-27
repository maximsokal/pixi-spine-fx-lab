// EARTH-01 G04a: deterministic packaging, isolated renderer injected by caller.
(function(root,make){const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactExport=api;})(globalThis,function(){
 'use strict';
 const CAP=192*1048576,ZIP_CAP=256*1048576,FRAMES=40,FPS=60,LAYER_IDS=Object.freeze(['ring','debris','dust']);
 const fail=m=>{throw Error('Ground Impact export: '+m);};
 function integer(v,k,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid '+k);return v;}
 const enc=s=>new TextEncoder().encode(s);
 function snapshot(v){const o=JSON.parse(JSON.stringify(v));function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}return freeze(o);}
 async function bakeSequence({codec,compile,settings,backend,crop,frameCount,assetInfo=null,createScene,signal,progress=()=>{},yieldFrame=()=>Promise.resolve(),deflate,pngLimit=CAP,zipLimit=ZIP_CAP}){
  if(!codec||!['cropSpec','encodePng','makeZip'].every(k=>typeof codec[k]==='function')||typeof compile!=='function'||typeof createScene!=='function'||!['webgl1','webgl2','webgpu'].includes(backend))fail('dependencies/backend');
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();
  const plan=compile(settings),frozen=snapshot(plan.settings),asset=snapshot(assetInfo),c=codec.cropSpec(crop),meta=plan.meta;
  if(frozen.schemaVersion!==1||frozen.mode!=='oneShot'||frozen.durationFrames!==FRAMES||meta.frames!==FRAMES||meta.fps!==FPS||meta.terminalSeconds!==(FRAMES-1)/FPS||!LAYER_IDS.every(k=>frozen.layers?.[k]?.id===k))fail('authored preset contract');
  const count=integer(frameCount??FRAMES,'frame count',1,3600);integer(pngLimit,'PNG limit',1,CAP);integer(zipLimit,'ZIP limit',22,ZIP_CAP);
  const manifest={schemaVersion:1,effectId:'fx.earth.ground-impact',backend,settings:frozen,asset,crop:c,width:c.width,height:c.height,fps:FPS,count,authoredFrames:FRAMES,durationSeconds:count/FPS,terminalSeconds:meta.terminalSeconds,mode:'oneShot',layerIds:[...LAYER_IDS],counts:snapshot(meta.counts),omitted:snapshot(meta.omitted),frameFormula:'frameIndex/60',alpha:'straight-rgba8',frames:[]};
  let scene,error,result,total=0;const entries=[];
  try{
   scene=await createScene({settings:frozen,backend,crop:c,frameCount:count,signal});check();
   if(!scene||scene.backend!==backend||typeof scene.readFrame!=='function'||typeof scene.destroy!=='function')fail('isolated scene mismatch');
   if(JSON.stringify(scene.settings)!==JSON.stringify(frozen))fail('scene settings mismatch');
   const max=integer(scene.maxTextureSize,'texture limit',1,65536);if(c.width>max||c.height>max)fail('crop exceeds texture limit');
   for(let i=0;i<count;i++){
    check();const seconds=i/FPS,frame=await scene.readFrame(seconds);check();
    if(frame?.width!==c.width||frame?.height!==c.height||frame.alpha!==(backend==='webgpu'?'straight':'premultiplied'))fail('readback contract mismatch');
    const data=await codec.encodePng(frame,deflate);check();total+=data.length;if(total>pngLimit)fail('PNG budget');
    const file='frames/frame_'+String(i).padStart(5,'0')+'.png';entries.push({name:file,data});manifest.frames.push({file,frame:i,timeSeconds:seconds});progress(i+1,count);await yieldFrame();check();
   }
   entries.push({name:'sequence.json',data:enc(JSON.stringify(manifest,null,2))},{name:'README.txt',data:enc('Ground Impact PNG sequence. 60 FPS; straight RGBA8; transparent, untrimmed logical crop. Frame index / 60 is the absolute scene time. The one-shot effect ends at sample 39; the isolated scene must continue the selected Spine animation at absolute time. No editor overlays. See sequence.json.')});
   const zip=codec.makeZip(entries,check,zipLimit);check();result={zip,manifest};
  }catch(e){error=e;throw e;}finally{if(scene&&typeof scene.destroy==='function')try{await scene.destroy();}catch(e){if(error)throw new AggregateError([error,e],'Ground Impact export and cleanup failed');throw e;}}
  check();return result;
 }
 return {VERSION:1,bakeSequence};
});
