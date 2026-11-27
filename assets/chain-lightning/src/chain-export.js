// ELEC-02 L04a: isolated PNG packaging; reuse the pinned repository RGBA/ZIP codec.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxChainExport=api;
})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('Chain Lightning export: '+m);};
 const integer=(v,k,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid '+k);return v;};
 const enc=v=>new TextEncoder().encode(v);
 function snapshot(v){const c=JSON.parse(JSON.stringify(v));function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}return freeze(c);}
 async function bakeSequence({codec,compile,settings,backend,crop,frameCount,assetInfo=null,createScene,signal,progress=()=>{},yieldFrame=()=>Promise.resolve(),deflate}){
  if(!codec||!['cropSpec','encodePng','makeZip'].every(k=>typeof codec[k]==='function')||typeof compile!=='function'||typeof createScene!=='function'||!['webgl1','webgl2','webgpu'].includes(backend))fail('dependencies/backend');
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();
  const plan=compile(settings),frozen=snapshot(plan.settings),asset=snapshot(assetInfo),c=codec.cropSpec(crop);
  if(frozen?.schemaVersion!==1||frozen.mode!=='oneShot')fail('preset version');
  const duration=integer(plan.meta.frames,'preset frames',1,3600),count=integer(frameCount??duration,'frame count',1,3600);
  const normalizedTime=i=>i/60;
  let scene,error,result,total=0;const entries=[];
  try{
   scene=await createScene({settings:frozen,backend,crop:c,signal});check();
   if(!scene||scene.backend!==backend||typeof scene.readFrame!=='function'||typeof scene.destroy!=='function')fail('isolated scene mismatch');
   const normalized=snapshot(scene.settings);
   if(normalized?.schemaVersion!==1||JSON.stringify(normalized)!==JSON.stringify(frozen))fail('scene settings mismatch');
   const manifest={schemaVersion:1,effectId:'fx.ice.chain-lightning',backend,settings:normalized,asset,crop:c,width:c.width,height:c.height,fps:60,count,authoredFrames:duration,mode:frozen.mode,targetOrder:frozen.targets.map(t=>t.id),contactFrames:plan.meta.plans.map(p=>({id:p.id,frame:p.contactFrame})),overflow:plan.meta.overflow,frameFormula:'frameIndex/60',alpha:'straight-rgba8',frames:[]};
   const max=integer(scene.maxTextureSize,'texture limit',1,65536);if(c.width>max||c.height>max)fail('texture limit');
   for(let i=0;i<count;i++){
    check();const seconds=i/60,frame=await scene.readFrame(normalizedTime(i));check();
    if(frame?.width!==c.width||frame?.height!==c.height||frame.alpha!==(backend==='webgpu'?'straight':'premultiplied'))fail('readback contract');
    const data=await codec.encodePng(frame,deflate);check();total+=data.length;if(total>192*1048576)fail('PNG budget');
    const file='frames/frame_'+String(i).padStart(5,'0')+'.png';entries.push({name:file,data});manifest.frames.push({file,frame:i,timeSeconds:seconds,sampleSeconds:normalizedTime(i)});
    progress(i+1,count);await yieldFrame();check();
   }
   entries.push({name:'sequence.json',data:enc(JSON.stringify(manifest,null,2))},{name:'README.txt',data:enc('Chain Lightning PNG sequence. 60 FPS; straight RGBA8; untrimmed logical crop. One-shot frames after the authored end contain no effect; Spine uses absolute sample time. No preview overlays.')});
   const zip=codec.makeZip(entries,check);check();result={zip,manifest};
  }catch(e){error=e;throw e;}finally{if(scene&&typeof scene.destroy==='function')try{await scene.destroy();}catch(e){if(error)throw new AggregateError([error,e],'Chain Lightning export and cleanup failed');throw e;}}
  check();return result;
 }
 return {VERSION:1,bakeSequence};
});
