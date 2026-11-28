// AIR-03: deterministic PNG encoding; backend alpha representation is explicit.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxBlizzardPng=api;})(globalThis,function(){
 'use strict';
 const MiB=1048576,PNG_CAP=192*MiB;
 const fail=m=>{throw Error('AIR-03 PNG: '+m);};
 function integer(v,k,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid '+k);return v;}
 const enc=s=>new TextEncoder().encode(s);
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n;});
 function crc32(b){let c=~0;for(const v of b)c=(c>>>8)^crcTable[(c^v)&255];return (~c)>>>0;}
 function join(parts){const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){b.set(p,i);i+=p.length;}return b;}
 function cropSpec(c={x:0,y:0,width:512,height:512}){if(!c||Object.keys(c).length!==4)fail('invalid crop');return Object.freeze({x:integer(c.x,'x',-16384,16384),y:integer(c.y,'y',-16384,16384),width:integer(c.width,'width',1,4096),height:integer(c.height,'height',1,4096)});}
 function straightRgba(pixels,width,height,alpha){cropSpec({x:0,y:0,width,height});if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==width*height*4)fail('invalid RGBA readback');if(!['straight','premultiplied'].includes(alpha))fail('unknown alpha representation');const out=new Uint8Array(pixels);for(let i=0;i<out.length;i+=4){const a=out[i+3];if(!a)out.fill(0,i,i+3);else if(alpha==='premultiplied'&&a!==255)for(let j=0;j<3;j++)out[i+j]=Math.min(255,Math.round(out[i+j]*255/a));}return out;}
 function chunk(name,data){const b=new Uint8Array(data.length+12),v=new DataView(b.buffer);v.setUint32(0,data.length);b.set(enc(name),4);b.set(data,8);v.setUint32(8+data.length,crc32(b.subarray(4,8+data.length)));return b;}
 async function browserDeflate(b){if(typeof CompressionStream!=='function')fail('PNG compression unavailable');return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());}
 async function encodePng({pixels,width,height,alpha},deflate=browserDeflate){const p=straightRgba(pixels,width,height,alpha),stride=width*4,raw=new Uint8Array((stride+1)*height);for(let y=0;y<height;y++)raw.set(p.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);const compressed=await deflate(raw);if(!(compressed instanceof Uint8Array)||compressed.length<6||compressed.length>PNG_CAP)fail('invalid compressed PNG');const h=new Uint8Array(13),v=new DataView(h.buffer);v.setUint32(0,width);v.setUint32(4,height);h[8]=8;h[9]=6;return join([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',h),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())]);}
 return {straightRgba,encodePng};
});
