// GAME-09 H04c: center-relative authoring crop and single cancellable job.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHealingExportUi=api;})(globalThis,function(){
 'use strict';
 function integer(s,name,min,max){if(typeof s!=='string'||!/^[-+]?\d+$/.test(s.trim()))throw Error('Invalid '+name);const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid '+name);return n;}
 function readSpec(v,duration){const width=integer(v.width,'crop width',1,4096),height=integer(v.height,'crop height',1,4096),offsetX=integer(v.x,'center X',-16384,16384),offsetY=integer(v.y,'center Y',-16384,16384),x=256+offsetX-Math.floor(width/2),y=256+offsetY-Math.floor(height/2);if(Math.abs(x)>16384||Math.abs(y)>16384)throw Error('Crop origin outside supported range');return {crop:{x,y,width,height},frameCount:integer(v.frames.trim()===''?String(duration):v.frames,'frame count',1,3600)};}
 function createController({request,bake,begin,end,progress,report,download}){
  let job=null;
  async function run(){if(job)return false;let params;try{params=request();}catch(e){report(e.message,true);return false;}
   const controller=new AbortController();job=controller;try{begin();progress(0,params.frameCount);const result=await bake({...params,signal:controller.signal,progress});if(controller.signal.aborted){report('PNG export cancelled',false);return false;}download(result.zip);report('PNG sequence exported',false);return true;}
   catch(e){if(controller.signal.aborted)report('PNG export cancelled',false);else report(e.message,true);return false;}
   finally{job=null;end();}
  }
  return Object.freeze({run,cancel(){if(!job)return false;job.abort();return true;},get active(){return job!==null;}});
 }
 return {readSpec,createController};
});
