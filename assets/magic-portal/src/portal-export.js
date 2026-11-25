// GAME-06: fixed-step PNG sequence packaging. Scene adapter is isolated by caller.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxPortal||(typeof require==='function'?require('./portal-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPortalExport=api;
})(globalThis,function(L){
 'use strict';
 const MiB=1024*1024,PNG_CAP=192*MiB,ZIP_CAP=256*MiB,PIXEL_CAP=64*MiB;
 const fail=m=>{throw Error('GAME-06 export: '+m);};
 const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 const ascii=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));
 function join(parts){const n=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
 function ints(v,k,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid '+k);return v;}
 function cropSpec(c={x:0,y:0,width:512,height:512}){
  if(!c||Object.keys(c).length!==4)fail('invalid crop');
  const out={x:ints(c.x,'crop x',-16384,16384),y:ints(c.y,'crop y',-16384,16384),width:ints(c.width,'width',1,4096),height:ints(c.height,'height',1,4096)};
  if(out.width*out.height*4>PIXEL_CAP)fail('pixel working budget');return Object.freeze(out);
 }
 function straightRgba(pixels,width,height,alpha){
  const c=cropSpec({x:0,y:0,width,height});
  if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==c.width*c.height*4)fail('invalid RGBA8 readback');
  if(!['premultiplied','straight'].includes(alpha))fail('unknown alpha representation');
  const out=new Uint8Array(pixels);
  for(let i=0;i<out.length;i+=4){
   const a=out[i+3];if(a===0){out[i]=out[i+1]=out[i+2]=0;}
   else if(alpha==='premultiplied'&&a!==255)for(let j=0;j<3;j++)out[i+j]=Math.min(255,Math.round(out[i+j]*255/a));
  }return out;
 }
 function chunk(type,data){const name=ascii(type),out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set(name,4);out.set(data,8);v.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;}
 async function browserDeflate(raw){
  if(typeof CompressionStream!=='function')fail('PNG compression unavailable');
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
 }
 async function encodePng({pixels,width,height,alpha='straight'},deflate=browserDeflate){
  const bytes=straightRgba(pixels,width,height,alpha),stride=width*4,raw=new Uint8Array((stride+1)*height);
  for(let y=0;y<height;y++)raw.set(bytes.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
  const compressed=await deflate(raw);
  if(!(compressed instanceof Uint8Array)||compressed.length<6||compressed.length>PNG_CAP)fail('invalid compressed PNG data');
  const header=new Uint8Array(13),h=new DataView(header.buffer);h.setUint32(0,width);h.setUint32(4,height);header[8]=8;header[9]=6;
  return join([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())]);
 }
 function makeZip(entries,check=()=>{},limit=ZIP_CAP){
  if(!Array.isArray(entries)||!entries.length||entries.length>3602)fail('invalid ZIP entry count');
  ints(limit,'ZIP limit',22,ZIP_CAP);const seen=new Set(),local=[],central=[];let offset=0,centralSize=0;
  for(const {name,data} of entries){
   check();if(typeof name!=='string'||name.length>255||!name.split('/').every(p=>/^[A-Za-z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..')||seen.has(name))fail('unsafe or duplicate ZIP name');
   if(!(data instanceof Uint8Array))fail('ZIP data must be bytes');seen.add(name);
   const n=ascii(name),crc=crc32(data),lh=new Uint8Array(30),ch=new Uint8Array(46),v=new DataView(lh.buffer),w=new DataView(ch.buffer);
   if(offset+30+n.length+data.length+centralSize+46+n.length+22>limit)fail('ZIP budget');
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);
   v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);
   w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);
   w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);
   local.push(lh,n,data);central.push(ch,n);offset+=30+n.length+data.length;centralSize+=46+n.length;
  }
  check();const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return join([...local,...central,end]);
 }
 async function bakeSequence({settings,backend,crop,frameCount,assetInfo=null,createScene,signal,progress=()=>{},deflate=browserDeflate,yieldFrame=()=>Promise.resolve(),pngLimit=PNG_CAP,zipLimit=ZIP_CAP,encodeText=s=>new TextEncoder().encode(s)}){
  if(!L||!['webgl1','webgl2','webgpu'].includes(backend)||typeof createScene!=='function')fail('invalid scene or backend');
  const frozen=L.compile(settings).settings,c=cropSpec(crop),count=ints(frameCount??frozen.durationFrames,'frame count',1,3600);
  ints(pngLimit,'PNG limit',1,PNG_CAP);ints(zipLimit,'ZIP limit',22,ZIP_CAP);
  const check=()=>{if(signal?.aborted)fail('cancelled');};check();
  const manifest={schemaVersion:1,effectId:'fx.game.magic-portal',backend,settings:frozen,asset:assetInfo===null?null:JSON.parse(JSON.stringify(assetInfo)),crop:c,width:c.width,height:c.height,fps:60,count,frameFormula:'frameIndex/60',alpha:'straight-rgba8',frames:[]};
  let scene,primaryError;const entries=[];let total=0;
  try{
   scene=await createScene({settings:frozen,backend,crop:c});check();
   if(!scene||scene.backend!==backend||typeof scene.readFrame!=='function'||typeof scene.destroy!=='function')fail('isolated scene backend mismatch');
   const max=ints(scene.maxTextureSize,'texture limit',1,65536);if(c.width>max||c.height>max)fail('crop exceeds actual texture limit');
   for(let i=0;i<count;i++){
    check();const seconds=i/60,frame=await scene.readFrame(seconds);check();
    if(frame?.width!==c.width||frame?.height!==c.height)fail('readback dimensions changed');
    // WebGL texture readback is PMA; the WebGPU presentation adapter supplies straight RGBA.
    const expected=backend==='webgpu'?'straight':'premultiplied';
    if(frame.alpha!==expected)fail('readback alpha contract mismatch');
    const bytes=await encodePng(frame,deflate);check();
    total+=bytes.length;if(total>pngLimit)fail('PNG budget');
    const file='frames/frame_'+String(i).padStart(5,'0')+'.png';
    entries.push({name:file,data:bytes});manifest.frames.push({file,frame:i,timeSeconds:seconds});
    progress(i+1,count);await yieldFrame();check();
   }
   entries.push({name:'sequence.json',data:encodeText(JSON.stringify(manifest,null,2))},{name:'README.txt',data:encodeText('Magic Portal PNG sequence. 60 FPS, straight RGBA8, untrimmed. Read sequence.json for crop and animation settings. Import frames in numerical order. End time exclusive. No UI overlays.')});
   const zip=makeZip(entries,check,zipLimit);check();return {zip,manifest};
  }catch(e){primaryError=e;throw e;}
  finally{if(scene&&typeof scene.destroy==='function'){try{await scene.destroy()}catch(e){if(primaryError)primaryError.cleanupError=e;else throw e;}}}
 }
 return {VERSION:1,PNG_CAP,ZIP_CAP,crc32,straightRgba,encodePng,makeZip,bakeSequence};
});
