'use strict';
// Independent, bounded PNG pixel decoder for captured Chromium RGB screenshots
// (color 2) and straight RGBA8 exported frames (color 6). No canvas APIs.
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function decodePng(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);
 assert.ok(bytes.length>=45&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'valid PNG signature');
 let at=8,width=0,height=0,colorType=-1,hasIHDR=false,ended=false;
 const idat=[];
 let transparentKey=null;
 while(at+12<=bytes.length){
  const len=bytes.readUInt32BE(at),end=at+12+len;
  assert.ok(len<=32*1024*1024&&end<=bytes.length,'complete, bounded PNG chunk');
  const tag=bytes.toString('ascii',at+4,at+8),body=bytes.subarray(at+8,at+8+len);
  assert.equal(crc32(bytes.subarray(at+4,at+8+len)),bytes.readUInt32BE(at+8+len),'PNG chunk CRC '+tag);
  if(tag==='IHDR'){
   assert.ok(!hasIHDR&&len===13,'single IHDR');
   hasIHDR=true;width=body.readUInt32BE(0);height=body.readUInt32BE(4);
   assert.ok(width>=1&&height>=1&&width*height<=16000000,'PNG dimensions bounded');
   assert.equal(body[8],8,'8-bit channel depth');
   colorType=body[9];assert.ok(colorType===2||colorType===6,'RGB or RGBA PNG');
   assert.equal(body[10],0);assert.equal(body[11],0);
   assert.equal(body[12],0,'non-interlaced PNG only');
  }
  else if(tag==='tRNS'){
   assert.ok(hasIHDR&&colorType===2&&len===6&&!transparentKey&&!idat.length,'invalid or misplaced RGB8 tRNS');
   // PNG stores 16-bit key samples; for RGB8 only their low bytes matter.
   transparentKey=[body[1],body[3],body[5]];
  }
  else if(tag==='IDAT')idat.push(body);
  else if(tag==='IEND'){assert.equal(len,0);ended=true;break;}
  else assert.ok(!/^[A-Z]/.test(tag[0]),'unsupported critical PNG chunk '+tag);
  at=end;
 }
 assert.ok(hasIHDR&&ended&&idat.length,'PNG must have IHDR, IDAT, IEND');
 const nch=colorType===2?3:4,rowBytes=width*nch;
 const expanded=zlib.inflateSync(Buffer.concat(idat),{maxOutputLength:(rowBytes+1)*height});
 assert.equal(expanded.length,(rowBytes+1)*height,'exact decompressed scanline size');
 const pixels=Buffer.alloc(width*height*4),previous=Buffer.alloc(rowBytes),row=Buffer.alloc(rowBytes);
 let pos=0;
 for(let y=0;y<height;y++){
  const filter=expanded[pos++];assert.ok(filter<=4,'PNG filter 0..4');
  for(let x=0;x<rowBytes;x++){
   const raw=expanded[pos++],a=x>=nch?row[x-nch]:0,b=previous[x],c=x>=nch?previous[x-nch]:0;
   let predictor=0;
   if(filter===1)predictor=a;
   else if(filter===2)predictor=b;
   else if(filter===3)predictor=(a+b)>>>1;
   else if(filter===4){const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);predictor=da<=db&&da<=dc?a:db<=dc?b:c;}
   row[x]=(raw+predictor)&255;
  }
  for(let x=0;x<width;x++){
   const si=x*nch,di=(y*width+x)*4;
   pixels[di]=row[si];pixels[di+1]=row[si+1];pixels[di+2]=row[si+2];pixels[di+3]=nch===4?row[si+3]:
    transparentKey&&row[si]===transparentKey[0]&&row[si+1]===transparentKey[1]&&row[si+2]===transparentKey[2]?0:255;
  }
  row.copy(previous);
 }
 return {width,height,colorType,pixels,rgba(x,y){
  assert.ok(Number.isInteger(x)&&x>=0&&x<width&&Number.isInteger(y)&&y>=0&&y<height,'pixel coordinates');
  return [...pixels.subarray((y*width+x)*4,(y*width+x)*4+4)];
 }};
}
function comparePixels(a,b,{step=3,channelTolerance=2}={}){
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let changed=0,total=0,sumAbs=0;
 for(let y=0;y<a.height;y+=step)for(let x=0;x<a.width;x+=step){
  total++;const i=(y*a.width+x)*4;
  let maxDelta=0;
  for(let c=0;c<4;c++){const delta=Math.abs(a.pixels[i+c]-b.pixels[i+c]);maxDelta=Math.max(maxDelta,delta);sumAbs+=delta;}
  if(maxDelta>channelTolerance)changed++;
 }
 return {changedPixels:changed,sampledPixels:total,meanAbsoluteChannelDelta:sumAbs/(total*4),
         step,channelTolerance};
}
function countAlpha(png){
 let transparent=0,partial=0,opaque=0;
 for(let i=3;i<png.pixels.length;i+=4){const a=png.pixels[i];if(a===0)transparent++;else if(a===255)opaque++;else partial++;}
 return {transparent,partial,opaque};
}
module.exports={decodePng,comparePixels,countAlpha};
