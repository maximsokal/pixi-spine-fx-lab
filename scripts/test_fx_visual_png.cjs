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

// Invalid QA input must fail rather than hide changes or hang a test run.
for(const step of [NaN,Infinity,1.5,'2']){
 test('reject invalid pixel step '+String(step),()=>{
  assert.throws(()=>comparePixels(rgb,rgba,{step}),/step/);
 });
}
for(const step of [0,-1]){
 test('reject nonpositive pixel step '+step+' without hanging',()=>{
  const {spawnSync}=require('node:child_process');
  const script='const assert=require("node:assert/strict");'+
   'const {comparePixels}=require('+JSON.stringify(require.resolve('./fx_visual_png.cjs'))+');'+
   'const p={width:1,height:1,pixels:Buffer.alloc(4)};'+
   'assert.throws(()=>comparePixels(p,p,{step:'+step+'}),/step/);';
  const result=spawnSync(process.execPath,['-e',script],{encoding:'utf8',timeout:1500});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
 });
}
for(const channelTolerance of [NaN,Infinity,-1,256,'2']){
 test('reject invalid channel tolerance '+String(channelTolerance),()=>{
  assert.throws(()=>comparePixels(rgb,rgba,{channelTolerance}),/channelTolerance/);
 });
}
for(const [name,invalid] of [
 ['short buffer',{...rgba,pixels:rgba.pixels.subarray(0,4)}],
 ['long buffer',{...rgba,pixels:Buffer.alloc(12)}],
 ['non-byte array',{...rgba,pixels:[...rgba.pixels]}],
 ['zero width',{width:0,height:1,pixels:Buffer.alloc(0)}],
 ['fractional height',{width:2,height:0.5,pixels:Buffer.alloc(4)}],
]){
 test('reject '+name+' in comparison and alpha counts',()=>{
  assert.throws(()=>comparePixels(invalid,invalid),/RGBA|dimensions/);
  assert.throws(()=>comparePixels(rgb,invalid),/RGBA|dimensions/);
  assert.throws(()=>countAlpha(invalid),/RGBA|dimensions/);
 });
}
test('valid pixel metrics retain exact sampling and fractional tolerance',()=>{
 assert.deepEqual(comparePixels(rgb,rgba,{step:1,channelTolerance:190.5}),{
  changedPixels:1,sampledPixels:2,meanAbsoluteChannelDelta:191/8,step:1,channelTolerance:190.5,
 });
 assert.equal(comparePixels(rgb,rgba,{step:20,channelTolerance:191}).sampledPixels,1);
 assert.equal(comparePixels(rgb,rgba,{step:20,channelTolerance:191}).changedPixels,0);
 assert.deepEqual(countAlpha({...rgba,pixels:new Uint8Array(rgba.pixels)}),{transparent:0,partial:1,opaque:1});
});

// Standalone PNG framing: valid CRCs are not enough to prove chunk ordering.
const signature=rgbFixture.subarray(0,8),header=rgbFixture.subarray(8,33);
const compressed=zlib.deflateSync(Buffer.from([0,1,50,250,255,0,170]));
const imageData=chunk('IDAT',compressed),trailer=chunk('IEND',Buffer.alloc(0));
const textChunk=chunk('tEXt',Buffer.from('Comment\0QA'));
const palette=chunk('PLTE',Buffer.from([1,50,250,255,0,170]));
const assemble=(...chunks)=>Buffer.concat([signature,...chunks]);
test('reject ancillary chunk before IHDR',()=>{
 assert.throws(()=>decodePng(assemble(textChunk,header,imageData,trailer)),/IHDR/);
});
test('reject IDAT before IHDR',()=>{
 assert.throws(()=>decodePng(assemble(imageData,header,trailer)),/IHDR/);
});
test('reject interrupted IDAT sequence',()=>{
 assert.throws(()=>decodePng(assemble(header,chunk('IDAT',compressed.subarray(0,4)),
  textChunk,chunk('IDAT',compressed.subarray(4)),trailer)),/IDAT/);
});
test('reject duplicate IEND',()=>{
 assert.throws(()=>decodePng(assemble(header,imageData,trailer,trailer)),/IEND/);
});
test('reject trailing bytes after IEND',()=>{
 assert.throws(()=>decodePng(Buffer.concat([rgbFixture,Buffer.from([0,1,2])])),/IEND/);
});
test('accept consecutive split IDAT with empty chunks and trailing metadata',()=>{
 const decoded=decodePng(assemble(header,chunk('IDAT',Buffer.alloc(0)),
  chunk('IDAT',compressed.subarray(0,4)),chunk('IDAT',compressed.subarray(4)),
  chunk('IDAT',Buffer.alloc(0)),textChunk,trailer));
 assert.deepEqual(decoded.pixels,rgb.pixels);
});
test('accept unused padding inside final IDAT as specified by PNG',()=>{
 const decoded=decodePng(assemble(header,chunk('IDAT',Buffer.concat([compressed,Buffer.alloc(3)])),trailer));
 assert.deepEqual(decoded.pixels,rgb.pixels);
});
test('reject truncated zlib stream even with valid PNG CRC',()=>{
 assert.throws(()=>decodePng(assemble(header,chunk('IDAT',compressed.subarray(0,-1)),trailer)));
});
test('reject excess decompressed scanline bytes',()=>{
 const oversized=zlib.deflateSync(Buffer.from([0,1,50,250,255,0,170,0]));
 assert.throws(()=>decodePng(assemble(header,chunk('IDAT',oversized),trailer)));
});
test('accept optional RGB8 PLTE without changing raw pixel values',()=>{
 assert.deepEqual(decodePng(assemble(header,palette,imageData,trailer)).pixels,rgb.pixels);
});
test('accept optional RGBA8 PLTE without changing raw pixel values',()=>{
 assert.deepEqual(decodePng(insertChunk(fixture(6,source),palette)).pixels,rgba.pixels);
});
test('accept RGB8 PLTE followed by tRNS',()=>{
 const decoded=decodePng(assemble(header,palette,transparentKey,imageData,trailer));
 assert.deepEqual(decoded.rgba(0,0),[1,50,250,0]);
});
for(const [name,body] of [['empty',Buffer.alloc(0)],['unaligned',Buffer.alloc(4)],['oversized',Buffer.alloc(771)]]){
 test('reject '+name+' PLTE',()=>{
  assert.throws(()=>decodePng(assemble(header,chunk('PLTE',body),imageData,trailer)),/PLTE/);
 });
}
test('reject duplicate PLTE',()=>{
 assert.throws(()=>decodePng(assemble(header,palette,palette,imageData,trailer)),/PLTE/);
});
test('reject PLTE after IDAT',()=>{
 assert.throws(()=>decodePng(assemble(header,imageData,palette,trailer)),/PLTE/);
});
test('reject PLTE after tRNS',()=>{
 assert.throws(()=>decodePng(assemble(header,transparentKey,palette,imageData,trailer)),/PLTE/);
});
