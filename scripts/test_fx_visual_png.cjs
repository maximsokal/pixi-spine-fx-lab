'use strict';
const assert=require('node:assert/strict'),zlib=require('node:zlib');
const {decodePng,comparePixels,countAlpha}=require('./fx_visual_png.cjs');
const t=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const crc=b=>{let c=0xffffffff;for(const v of b)c=t[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0};
function chunk(tag,body){
 const out=Buffer.alloc(12+body.length);
 out.writeUInt32BE(body.length,0);out.write(tag,4,'ascii');body.copy(out,8);
 out.writeUInt32BE(crc(out.subarray(4,8+body.length)),8+body.length);return out;
}
function fixture(type,rgba){
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=type;
 const raw=Buffer.from([0,...(type===2?rgba.flatMap(p=>p.slice(0,3)):rgba.flat())]);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const source=[[1,50,250,64],[255,0,170,255]];
const rgb=decodePng(fixture(2,source)),rgba=decodePng(fixture(6,source));
assert.deepEqual(rgb.rgba(0,0),[1,50,250,255]);
assert.deepEqual(rgba.rgba(0,0),source[0]);
assert.deepEqual(rgba.rgba(1,0),source[1]);
assert.deepEqual(countAlpha(rgba),{transparent:0,partial:1,opaque:1});
const difference=comparePixels(rgb,rgba,{step:1,channelTolerance:0});
assert.equal(difference.changedPixels,1);
assert.equal(comparePixels(rgb,rgb,{step:1,channelTolerance:0}).changedPixels,0);
const corrupted=fixture(6,source);corrupted[30]^=1;
assert.throws(()=>decodePng(corrupted),/CRC/);
const truncated=fixture(2,source).subarray(0,25);
assert.throws(()=>decodePng(truncated),/PNG|chunk/i);
const unsupported=fixture(2,source);
unsupported[25]=3;
assert.throws(()=>decodePng(unsupported),/CRC|RGB/);
console.log('PASS FX-CORE-07 independent PNG RGB/RGBA8 parser, pixel delta/alpha, malformed CRC/truncation');

// Truecolour tRNS stores three big-endian 16-bit samples; RGB8 uses low bytes.
const {test}=require('node:test');
const transparentKey=chunk('tRNS',Buffer.from([0,1,0,50,0,250]));
function insertChunk(png,extra,at=33){
 return Buffer.concat([png.subarray(0,at),extra,png.subarray(at)]);
}
const rgbFixture=fixture(2,source);
test('RGB8 tRNS preserves RGB and reconstructs binary alpha',()=>{
 const decoded=decodePng(insertChunk(rgbFixture,transparentKey));
 assert.deepEqual(decoded.rgba(0,0),[1,50,250,0]);
 assert.deepEqual(decoded.rgba(1,0),[255,0,170,255]);
 assert.deepEqual(countAlpha(decoded),{transparent:1,partial:0,opaque:1});
 assert.equal(comparePixels(rgb,decoded,{step:1,channelTolerance:0}).changedPixels,1);
});
test('RGB8 tRNS ignores unused high sample bits per PNG spec',()=>{
 const key=chunk('tRNS',Buffer.from([9,1,8,50,7,250]));
 assert.equal(decodePng(insertChunk(rgbFixture,key)).rgba(0,0)[3],0);
});
test('RGB8 tRNS nonmatching key leaves both pixels opaque',()=>{
 const key=chunk('tRNS',Buffer.from([0,1,0,50,0,249]));
 assert.deepEqual(countAlpha(decodePng(insertChunk(rgbFixture,key))),{transparent:0,partial:0,opaque:2});
});
test('reject tRNS with invalid length',()=>{
 assert.throws(()=>decodePng(insertChunk(rgbFixture,chunk('tRNS',Buffer.alloc(5)))),/tRNS/);
});
test('reject duplicate tRNS',()=>{
 assert.throws(()=>decodePng(insertChunk(rgbFixture,Buffer.concat([transparentKey,transparentKey]))),/tRNS/);
});
test('reject tRNS after IDAT',()=>{
 assert.throws(()=>decodePng(insertChunk(rgbFixture,transparentKey,rgbFixture.length-12)),/tRNS/);
});
test('reject tRNS before IHDR',()=>{
 assert.throws(()=>decodePng(insertChunk(rgbFixture,transparentKey,8)),/tRNS/);
});
test('reject tRNS in RGBA8',()=>{
 assert.throws(()=>decodePng(insertChunk(fixture(6,source),transparentKey)),/tRNS/);
});
