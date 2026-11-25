// GAME-01 M04a: cancellable PNG sequence packaging with injected existing PNG/ZIP codec.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzleExport=api;
})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('Muzzle export: '+m);};
 const integer=(v,k,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid '+k);return v;};
 const enc=v=>new TextEncoder().encode(v);
 function snapshot(v){const c=JSON.parse(JSON.stringify(v));function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}return freeze(c);}
 async function bakeSequence({codec,compile,settings,backend,crop,frameCount,assetInfo=null,createScene,signal,progress=()=>{},yieldFrame=()=>Promise.resolve(),deflate}){
  if(!codec||!['cropSpec','encodePng','makeZip'].every(k=>typeof codec[k]==='function')||typeof compile!=='function'||typeof createScene!=='function'||!['webgl1','webgl2','webgpu'].includes(backend))fail('dependencies/backend');
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();
  const frozen=snapshot(compile(settings).settings),c=codec.cropSpec(crop),count=integer(frameCount??frozen.effect.exportFrames,'frame count',1,3600);
  const manifest={schemaVersion:1,effectId:'fx.game.muzzle-flash',backend,settings:frozen,asset:snapshot(assetInfo),crop:c,width:c.width,height:c.height,fps:60,count,frameFormula:'frameIndex/60',alpha:'straight-rgba8',frames:[]};
  let scene,error,total=0;const entries=[];
  try{
   scene=await createScene({settings:frozen,backend,crop:c});check();
   if(!scene||scene.backend!==backend||typeof scene.readFrame!=='function'||typeof scene.destroy!=='function')fail('isolated scene mismatch');
   const max=integer(scene.maxTextureSize,'texture limit',1,65536);if(c.width>max||c.height>max)fail('texture limit');
   for(let i=0;i<count;i++){
    check();const seconds=i/60,frame=await scene.readFrame(seconds);check();
    if(frame?.width!==c.width||frame?.height!==c.height||frame.alpha!==(backend==='webgpu'?'straight':'premultiplied'))fail('readback contract');
    const data=await codec.encodePng(frame,deflate);check();total+=data.length;if(total>192*1048576)fail('PNG budget');
    const file='frames/frame_'+String(i).padStart(5,'0')+'.png';entries.push({name:file,data});manifest.frames.push({file,frame:i,timeSeconds:seconds});
    progress(i+1,count);await yieldFrame();check();
   }
   entries.push({name:'sequence.json',data:enc(JSON.stringify(manifest,null,2))},{name:'README.txt',data:enc('Muzzle Flash PNG sequence. 60 FPS; straight RGBA8; untrimmed logical crop. End time exclusive. No preview overlays.')});
   const zip=codec.makeZip(entries,check);check();return {zip,manifest};
  }catch(e){error=e;throw e;}finally{if(scene&&typeof scene.destroy==='function')try{await scene.destroy();}catch(e){if(error)throw new AggregateError([error,e],'Muzzle export and cleanup failed');throw e;}}
 }
 return {VERSION:1,bakeSequence};
});
