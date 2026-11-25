// GAME-01 M04a: separate Pixi/Spine ownership; 512px world-aligned tiles.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzleBake=api;
})(globalThis,function(){
 'use strict';const TILE=512,fail=m=>{throw Error('Muzzle bake: '+m);};
 function unpackGpu(raw,width,height,stride,format){
  if(!['rgba8unorm','bgra8unorm'].includes(format)||!(raw instanceof Uint8Array)||![width,height,stride].every(Number.isSafeInteger)||width<1||height<1||stride<width*4||raw.length<stride*height)fail('invalid GPU readback');
  const out=new Uint8Array(width*height*4),b=format==='bgra8unorm';
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*stride+x*4,j=(y*width+x)*4;out[j]=raw[i+(b?2:0)];out[j+1]=raw[i+1];out[j+2]=raw[i+(b?0:2)];out[j+3]=raw[i+3];}return out;
 }
 function readerFor(r,target,env){
  const d=r.gpu.device,stride=TILE*4,buffer=d.createBuffer({size:stride*TILE,usage:env.GPUBufferUsage.COPY_DST|env.GPUBufferUsage.MAP_READ});let dead=false;
  return {async read(){if(dead)fail('reader destroyed');let mapped=false;try{const texture=r.texture.getGpuSource(target.source),e=d.createCommandEncoder();e.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride,rowsPerImage:TILE},{width:TILE,height:TILE});d.queue.submit([e.finish()]);await buffer.mapAsync(env.GPUMapMode.READ);mapped=true;return unpackGpu(new Uint8Array(buffer.getMappedRange()),TILE,TILE,stride,texture.format);}finally{if(mapped)buffer.unmap();}},destroy(){if(!dead){dead=true;buffer.destroy();}}};
 }
 function sceneFactory({source=null,poseOptions={},env=globalThis}={}){
  const saved=source?{name:source.name,skeleton:source.skeleton,atlas:source.atlas,images:new Map(source.images)}:null;
  const options=Object.freeze({animation:'',skin:'',speed:1,visible:true,...poseOptions});
  if(typeof options.animation!=='string'||typeof options.skin!=='string'||typeof options.visible!=='boolean'||!Number.isFinite(options.speed)||options.speed<0||options.speed>4)fail('Spine options');
  return async function createScene({settings,backend,crop}){
   const {PIXI,FxMuzzle:M,FxMuzzleAnchors:A,FxMuzzleSmoke:S,FxMuzzleRuntime:R,FxColors,FxShockwaveSpine:Sp,FxShieldExport:X}=env;
   if(!PIXI||!M||!A||!S||!R||!FxColors||!Sp||!X||!['webgl1','webgl2','webgpu'].includes(backend))fail('dependencies/backend');
   const c=X.cropSpec(crop);let app,world,asset,fx,target,reader,dead=false,reading=false;
   function destroy(){if(dead)return;if(reading)fail('read in progress');dead=true;const errors=[];const drop=f=>{try{f()}catch(e){errors.push(e);}};drop(()=>reader?.destroy());drop(()=>fx?.destroy());drop(()=>asset?.destroy());drop(()=>target?.destroy(true));drop(()=>world?.destroy({children:true}));if(app?.renderer)drop(()=>app.destroy(true,{children:true}));if(errors.length)throw new AggregateError(errors,'Muzzle bake cleanup failed');}
   try{
    app=new PIXI.Application();await app.init({width:1,height:1,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
    const r=app.renderer,actual=r.gl?(typeof env.WebGL2RenderingContext==='function'&&r.gl instanceof env.WebGL2RenderingContext?'webgl2':'webgl1'):r.gpu?.device?'webgpu':'unsupported';
    if(actual!==backend)fail('requested '+backend+' got '+actual);
    const maxTextureSize=actual==='webgpu'?r.gpu.device.limits.maxTextureDimension2D:r.gl.getParameter(r.gl.MAX_TEXTURE_SIZE);
    if(!Number.isSafeInteger(maxTextureSize)||Math.max(TILE,c.width,c.height)>maxTextureSize)fail('texture limit');
    world=new PIXI.Container();const models=new PIXI.Container(),host=new PIXI.Container();world.addChild(models,host);
    if(saved){asset=await Sp.create(saved);models.addChild(asset.model);}
    const compile=S.createCompiler({compileEffect:M.compile,anchors:A,colors:FxColors,host,world,model:asset?.model||null});
    fx=R.createRenderer({PIXI,host,compile,settings});target=PIXI.RenderTexture.create({width:TILE,height:TILE,resolution:1,antialias:false});if(actual==='webgpu')reader=readerFor(r,target,env);
    async function readFrame(seconds){
     if(dead||reading||!Number.isFinite(seconds)||seconds<0||seconds>3600)fail('invalid read');reading=true;
     try{
      world.position.set(0,0);Sp.pose(asset,seconds,options);fx.seek(seconds);
      const out=new Uint8Array(c.width*c.height*4),right=c.x+c.width,bottom=c.y+c.height;
      for(let ty=Math.floor(c.y/TILE)*TILE;ty<bottom;ty+=TILE)for(let tx=Math.floor(c.x/TILE)*TILE;tx<right;tx+=TILE){
       world.position.set(-tx,-ty);r.render({container:world,target,clear:true,clearColor:[0,0,0,0]});
       let pixels;if(reader)pixels=await reader.read();else{const p=r.extract.pixels(target);if(p.width!==TILE||p.height!==TILE)fail('tile size');pixels=p.pixels;}
       if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==TILE*TILE*4)fail('tile pixels');
       const x0=Math.max(tx,c.x),x1=Math.min(tx+TILE,right),y0=Math.max(ty,c.y),y1=Math.min(ty+TILE,bottom);
       for(let y=y0;y<y1;y++){const start=((y-ty)*TILE+x0-tx)*4;out.set(pixels.subarray(start,start+(x1-x0)*4),((y-c.y)*c.width+x0-c.x)*4);}
      }
      return {pixels:reader?X.straightRgba(out,c.width,c.height,'premultiplied'):out,width:c.width,height:c.height,alpha:reader?'straight':'premultiplied'};
     }finally{reading=false;}
    }
    return Object.freeze({backend:actual,maxTextureSize,readFrame,destroy});
   }catch(e){try{destroy();}catch(cleanup){throw new AggregateError([e,cleanup],'Muzzle bake initialization and cleanup failed');}throw e;}
  };
 }
 return {VERSION:1,sceneFactory,unpackGpu};
});
