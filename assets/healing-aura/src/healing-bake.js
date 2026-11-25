// GAME-09 H04b: independent Pixi render scene with world-aligned readback.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHealingBake=api;})(globalThis,function(){
 'use strict';
 const TILE=512,fail=m=>{throw Error('GAME-09 bake: '+m);};
 function unpackGpu(raw,width,height,stride,format){
  if(!['rgba8unorm','bgra8unorm'].includes(format))fail('unsupported GPU format '+format);
  if(!(raw instanceof Uint8Array)||![width,height,stride].every(Number.isSafeInteger)||width<1||height<1||stride<width*4||raw.length<stride*height)fail('invalid GPU readback');
  const pixels=new Uint8Array(width*height*4),bgra=format==='bgra8unorm';
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*stride+x*4,j=(y*width+x)*4;pixels[j]=raw[i+(bgra?2:0)];pixels[j+1]=raw[i+1];pixels[j+2]=raw[i+(bgra?0:2)];pixels[j+3]=raw[i+3];}
  return pixels;
 }
 function gpuReader(renderer,target,env){
  const device=renderer.gpu.device,stride=TILE*4,buffer=device.createBuffer({size:stride*TILE,usage:env.GPUBufferUsage.COPY_DST|env.GPUBufferUsage.MAP_READ});let dead=false;
  return {async read(){if(dead)fail('GPU reader destroyed');let mapped=false;try{const texture=renderer.texture.getGpuSource(target.source),encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride,rowsPerImage:TILE},{width:TILE,height:TILE});device.queue.submit([encoder.finish()]);await buffer.mapAsync(env.GPUMapMode.READ);mapped=true;return unpackGpu(new Uint8Array(buffer.getMappedRange()),TILE,TILE,stride,texture.format);}finally{if(mapped)buffer.unmap();}},destroy(){if(!dead){dead=true;buffer.destroy();}}};
 }
 function sceneFactory({source=null,poseOptions={},env=globalThis}={}){
  const saved=source?{name:source.name,skeleton:source.skeleton,atlas:source.atlas,images:new Map(source.images)}:null;
  const options=Object.freeze({animation:'',skin:'',speed:1,visible:true,...poseOptions});
  if(typeof options.animation!=='string'||typeof options.skin!=='string'||typeof options.visible!=='boolean'||!Number.isFinite(options.speed)||options.speed<.1||options.speed>4)fail('invalid Spine options');
  return async function createScene({settings,backend,crop}){
   const {PIXI,FxHealingRuntime:R,FxHealingAuthoring:U,FxShockwaveSpine:Sp,FxHealingExport:X}=env;
   if(!PIXI||!R||!U||!X||!Sp)fail('runtime unavailable');
   if(!['webgl1','webgl2','webgpu'].includes(backend))fail('invalid backend');
   const c=X.cropSpec(crop),clock=Object.freeze({mode:settings.mode,durationFrames:settings.durationFrames});
   if(!['loop','oneShot'].includes(clock.mode)||!Number.isInteger(clock.durationFrames)||clock.durationFrames<2||clock.durationFrames>3600)fail('invalid timeline');
   let app,root,asset,fx,target,reader,dead=false,reading=false;
   function destroy(){if(dead)return;if(reading)fail('read in progress');dead=true;const errors=[];const dispose=f=>{try{f()}catch(e){errors.push(e);}};dispose(()=>reader?.destroy());dispose(()=>fx?.destroy());dispose(()=>asset?.destroy());dispose(()=>target?.destroy(true));dispose(()=>root?.destroy({children:true,texture:false,textureSource:false}));if(app?.renderer)dispose(()=>app.destroy(true,{children:true}));if(errors.length)throw new AggregateError(errors,'Bake scene cleanup failed');}
   try{
    app=new PIXI.Application();await app.init({width:1,height:1,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
    const r=app.renderer,actual=r.gl?(typeof env.WebGL2RenderingContext==='function'&&r.gl instanceof env.WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
    if(actual!==backend)fail('requested '+backend+' but got '+actual);
    const maxTextureSize=actual==='webgpu'?r.gpu.device.limits.maxTextureDimension2D:r.gl.getParameter(r.gl.MAX_TEXTURE_SIZE);
    if(!Number.isSafeInteger(maxTextureSize)||Math.max(TILE,c.width,c.height)>maxTextureSize)fail('crop exceeds actual texture limit');
    root=new PIXI.Container();const behind=new PIXI.Container(),models=new PIXI.Container(),front=new PIXI.Container();root.addChild(behind,models,front);
    if(saved){asset=await Sp.create(saved);models.addChild(asset.model);}
    fx=R.createHealing({PIXI,front,behind,settings});target=PIXI.RenderTexture.create({width:TILE,height:TILE,resolution:1,antialias:false});if(actual==='webgpu')reader=gpuReader(r,target,env);
    async function readFrame(seconds){
     if(dead||reading)fail('scene unavailable');if(!Number.isFinite(seconds)||seconds<0||seconds>1e6)fail('invalid frame time');reading=true;
     try{
      const time=U.advance(seconds,0,clock),poses=U.poseMap(U.pose(asset,time,options,Sp));fx.seek(time,poses);
      const out=new Uint8Array(c.width*c.height*4),right=c.x+c.width,bottom=c.y+c.height;
      for(let ty=Math.floor(c.y/TILE)*TILE;ty<bottom;ty+=TILE)for(let tx=Math.floor(c.x/TILE)*TILE;tx<right;tx+=TILE){
       root.position.set(-tx,-ty);r.render({container:root,target,clear:true,clearColor:[0,0,0,0]});
       let pixels;if(reader)pixels=await reader.read();else{const p=r.extract.pixels(target);if(p.width!==TILE||p.height!==TILE)fail('unexpected tile dimensions');pixels=p.pixels;}
       if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==TILE*TILE*4)fail('invalid tile pixels');
       const x0=Math.max(tx,c.x),x1=Math.min(tx+TILE,right),y0=Math.max(ty,c.y),y1=Math.min(ty+TILE,bottom);
       for(let y=y0;y<y1;y++){const start=((y-ty)*TILE+x0-tx)*4;out.set(pixels.subarray(start,start+(x1-x0)*4),((y-c.y)*c.width+x0-c.x)*4);}
      }
      return {pixels:reader?X.straightRgba(out,c.width,c.height,'premultiplied'):out,width:c.width,height:c.height,alpha:reader?'straight':'premultiplied'};
     }finally{reading=false;}
    }
    return Object.freeze({backend:actual,maxTextureSize,readFrame,destroy});
   }catch(e){try{destroy();}catch(cleanup){throw new AggregateError([e,cleanup],'Bake initialization and cleanup failed');}throw e;}
  };
 }
 return {VERSION:1,sceneFactory,unpackGpu};
});
