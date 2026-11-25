// GAME-06: independent Pixi bake scene, no live editor ownership.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxPortalExport||(typeof require==='function'?require('./portal-export.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPortalBake=api;
})(globalThis,function(X){
 'use strict';
 const TILE=512;
 const fail=m=>{throw Error('GAME-06 bake: '+m);};
 function gpuReader(renderer,target,width,height,env){
  const device=renderer.gpu.device,stride=Math.ceil(width*4/256)*256;
  const buffer=device.createBuffer({size:stride*height,usage:env.GPUBufferUsage.COPY_DST|env.GPUBufferUsage.MAP_READ});
  let dead=false,reading=false;
  return {
   async read(){
    if(dead||reading)fail('GPU reader unavailable');reading=true;
    let mapped=false;
    try{
     const texture=renderer.texture.getGpuSource(target.source);
     if(!['rgba8unorm','bgra8unorm'].includes(texture.format))fail('unsupported GPU format '+texture.format);
     const encoder=device.createCommandEncoder();
     encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride,rowsPerImage:height},{width,height});
     device.queue.submit([encoder.finish()]);await buffer.mapAsync(env.GPUMapMode.READ);mapped=true;
     const raw=new Uint8Array(buffer.getMappedRange()),pixels=new Uint8Array(width*height*4),bgra=texture.format==='bgra8unorm';
     for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*stride+x*4,j=(y*width+x)*4;
      pixels[j]=raw[i+(bgra?2:0)];pixels[j+1]=raw[i+1];pixels[j+2]=raw[i+(bgra?0:2)];pixels[j+3]=raw[i+3];
     }
     return X.straightRgba(pixels,width,height,'premultiplied');
    }finally{try{if(mapped)buffer.unmap()}finally{reading=false;}}
   },
   destroy(){if(dead)return;if(reading)fail('GPU read in progress');dead=true;buffer.destroy();}
  };
 }
 function sceneFactory({source=null,poseOptions={},env=globalThis}={}){
  // Blobs are immutable; snapshot the mutable map and animation options now.
  const saved=source?{name:source.name,skeleton:source.skeleton,atlas:source.atlas,images:new Map(source.images)}:null;
  const options=Object.freeze({...poseOptions});
  return async function createScene({settings,backend,crop}){
   const {PIXI,FxPortalRuntime,FxPortalSpine}=env;
   if(!PIXI||!FxPortalRuntime||!X||(saved&&!FxPortalSpine))fail('runtime unavailable');
   if(!['webgl1','webgl2','webgpu'].includes(backend))fail('unknown backend');
   let app,root,host,asset,fx,target,reader,dead=false,reading=false;
   function destroy(){
    if(dead)return;if(reading)fail('frame read in progress');dead=true;
    let error;const dispose=f=>{try{f()}catch(e){error??=e}};
    dispose(()=>reader?.destroy());dispose(()=>fx?.destroy());dispose(()=>asset?.destroy());
    dispose(()=>target?.destroy(true));dispose(()=>root?.destroy({children:true}));
    if(app?.renderer)dispose(()=>app.destroy(true,{children:true}));
    if(error)throw error;
   }
   try{
    app=new PIXI.Application();await app.init({width:1,height:1,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
    const renderer=app.renderer,actual=renderer.gl?(renderer.gl instanceof env.WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
    if(actual!==backend)fail('requested '+backend+' but got '+actual);
    const maxTextureSize=actual==='webgpu'?renderer.gpu.device.limits.maxTextureDimension2D:renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    if(!Number.isSafeInteger(maxTextureSize)||maxTextureSize<1||Math.max(TILE,crop.width,crop.height)>maxTextureSize)fail('crop exceeds actual texture limit');
    root=new PIXI.Container();host=new PIXI.Container();root.addChild(host);
    // World-aligned fixed-size tiles keep projection/raster precision independent of crop size.
    // The same world pixel always comes from the same target and tile transform.
    if(saved){asset=await FxPortalSpine.create(saved,env);host.addChild(asset.model);}
    fx=FxPortalRuntime.createPortal({PIXI,host,settings});
    target=PIXI.RenderTexture.create({width:TILE,height:TILE,resolution:1,antialias:false});
    if(actual==='webgpu')reader=gpuReader(renderer,target,TILE,TILE,env);
    async function readFrame(seconds){
     if(dead||reading)fail('scene unavailable');if(!Number.isFinite(seconds)||seconds<0)fail('invalid frame time');reading=true;
     try{
      const poses=asset?asset.pose(seconds,options):{};
      fx.seek(seconds,poses);
      const output=new Uint8Array(crop.width*crop.height*4),right=crop.x+crop.width,bottom=crop.y+crop.height;
      for(let ty=Math.floor(crop.y/TILE)*TILE;ty<bottom;ty+=TILE)for(let tx=Math.floor(crop.x/TILE)*TILE;tx<right;tx+=TILE){
       root.position.set(-tx,-ty);
       renderer.render({container:root,target,clear:true,clearColor:[0,0,0,0]});
       let pixels;
       if(reader)pixels=await reader.read();
       else{const read=renderer.extract.pixels(target);if(read.width!==TILE||read.height!==TILE)fail('unexpected readback dimensions');pixels=read.pixels;}
       if(pixels.length!==TILE*TILE*4)fail('invalid tile readback');
       const x0=Math.max(tx,crop.x),x1=Math.min(tx+TILE,right),y0=Math.max(ty,crop.y),y1=Math.min(ty+TILE,bottom);
       for(let y=y0;y<y1;y++){
        const start=((y-ty)*TILE+x0-tx)*4;
        output.set(pixels.subarray(start,start+(x1-x0)*4),((y-crop.y)*crop.width+x0-crop.x)*4);
       }
      }
      return {pixels:output,width:crop.width,height:crop.height,alpha:reader?'straight':'premultiplied'};
    }finally{reading=false;}
    }
    return Object.freeze({backend:actual,maxTextureSize,readFrame,destroy});
   }catch(e){try{destroy()}catch(cleanup){e.cleanupError=cleanup;}throw e;}
  };
 }
 return {VERSION:1,sceneFactory,gpuReader};
});
