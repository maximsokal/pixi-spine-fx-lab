// GAME-11 D02: isolated, world-aligned source capture, exact backend and raw alpha.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDissolveSurface=api;})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('Dissolve surface: '+m);};
 function backendOf(renderer,env=globalThis){if(renderer.gl)return typeof env.WebGL2RenderingContext==='function'&&renderer.gl instanceof env.WebGL2RenderingContext?'webgl2':'webgl1';if(renderer.gpu?.device)return 'webgpu';fail('unsupported renderer');}
 function limits(renderer,backend){if(backend==='webgpu')return renderer.gpu.device.limits.maxTextureDimension2D;const gl=renderer.gl,high=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);if(!high||high.precision<23)fail('fragment highp precision required');if(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)<36)fail('fragment uniform limit');return gl.getParameter(gl.MAX_TEXTURE_SIZE);}
 function alphaPlane(raw,width,height,stride){if(!(raw instanceof Uint8Array||raw instanceof Uint8ClampedArray)||raw.length<stride*height||stride<width*4)fail('invalid readback');const out=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)out[y*width+x]=raw[y*stride+x*4+3];return out;}
 function create({PIXI,renderer,source,rect,backend,poseFrame,env=globalThis}){
  if(!source||source.parent||typeof poseFrame!=='function')fail('detached identity source host and poseFrame required');
  const actual=backendOf(renderer,env);if(actual!==backend)fail('requested '+backend+' but got '+actual);const limit=limits(renderer,actual);
  if(!Number.isSafeInteger(limit)||Math.max(rect.width,rect.height)>limit)fail('source exceeds texture limit');
  let target,buffer,dead=false,busy=false,count=0,lastFrame=-1,lastPoses=null;const stride=Math.ceil(rect.width*4/256)*256;
  try{target=PIXI.RenderTexture.create({width:rect.width,height:rect.height,resolution:1,antialias:false});
   if(actual==='webgpu')buffer=renderer.gpu.device.createBuffer({size:stride*rect.height,usage:env.GPUBufferUsage.COPY_DST|env.GPUBufferUsage.MAP_READ});
  }catch(e){target?.destroy(true);throw e;}
  const matrix=new PIXI.Matrix(1,0,0,1,-rect.x,-rect.y);
  function check(){if(source.parent||source.destroyed||source.x!==0||source.y!==0||source.rotation!==0||source.scale.x!==1||source.scale.y!==1||source.skew.x!==0||source.skew.y!==0||source.pivot.x!==0||source.pivot.y!==0||source.alpha!==1)fail('source must remain detached identity host');if(source.visible&&source.renderable){const b=source.getLocalBounds();if(b.width>0&&b.height>0&&(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<rect.x-1e-5||b.y<rect.y-1e-5||b.x+b.width>rect.x+rect.width+1e-5||b.y+b.height>rect.y+rect.height+1e-5))fail('source bounds exceed capture rect');}}
  async function capture(frame,signal){if(dead||busy)fail('capture unavailable');if(!Number.isInteger(frame)||frame<0||frame>=3600)fail('invalid canonical frame');busy=true;try{if(signal?.aborted)fail('cancelled');if(frame!==lastFrame){const poses=await poseFrame(frame);if(signal?.aborted)fail('cancelled');check();if(source.visible&&source.renderable)renderer.render({container:source,target,transform:matrix,clear:true,clearColor:[0,0,0,0]});else renderer.clear({target,clearColor:[0,0,0,0]});lastFrame=frame;lastPoses=poses||{};count++;}return lastPoses;}catch(e){lastFrame=-1;throw e;}finally{busy=false;}}
  async function readAlpha(signal){if(dead||busy||lastFrame<0)fail('read unavailable');busy=true;let mapped=false;try{if(signal?.aborted)fail('cancelled');let alpha;
   if(buffer){const device=renderer.gpu.device,texture=renderer.texture.getGpuSource(target.source);if(!['rgba8unorm','bgra8unorm'].includes(texture.format))fail('unsupported GPU format');const enc=device.createCommandEncoder();enc.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride,rowsPerImage:rect.height},{width:rect.width,height:rect.height});device.queue.submit([enc.finish()]);await buffer.mapAsync(env.GPUMapMode.READ);mapped=true;alpha=alphaPlane(new Uint8Array(buffer.getMappedRange()),rect.width,rect.height,stride);}
   else{const p=renderer.extract.pixels(target);if(p.width!==rect.width||p.height!==rect.height)fail('readback size');alpha=alphaPlane(p.pixels,rect.width,rect.height,rect.width*4);}
   if(signal?.aborted)fail('cancelled');return alpha;
  }finally{if(mapped)buffer.unmap();busy=false;}}
  function destroy(){if(dead)return;if(busy)fail('capture busy');dead=true;try{buffer?.destroy();}finally{target.destroy(true);}}
  return Object.freeze({target,backend:actual,limit,capture,readAlpha,destroy,get count(){return count;},invalidate(){if(busy||dead)fail('capture unavailable');lastFrame=-1;}});
 }
 return {backendOf,limits,alphaPlane,create};
});
