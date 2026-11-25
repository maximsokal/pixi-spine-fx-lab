'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),z=require('node:zlib');
const X=require('../assets/shockwave/src/shockwave-export.js'),L=require('../assets/shockwave/src/shockwave-core.js');
const enc=s=>Uint8Array.from([...s].map(x=>x.charCodeAt(0))),dec=b=>String.fromCharCode(...b);
const deflate=b=>new Uint8Array(z.deflateSync(b)),inflate=b=>new Uint8Array(z.inflateSync(b));
function crc(b){let c=~0;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (~c)>>>0;}
function png(b){const v=new DataView(b.buffer,b.byteOffset,b.length);A.deepEqual(Array.from(b.slice(0,8)),[137,80,78,71,13,10,26,10]);let at=8,w,h,raw;
 while(at<b.length){const n=v.getUint32(at),type=dec(b.subarray(at+4,at+8)),data=b.subarray(at+8,at+8+n);A.equal(v.getUint32(at+8+n),crc(b.subarray(at+4,at+8+n)));if(type==='IHDR'){w=v.getUint32(at+8);h=v.getUint32(at+12);A.equal(data[8],8);A.equal(data[9],6);}if(type==='IDAT')raw=inflate(data);at+=n+12;}
 A.equal(at,b.length);return {w,h,raw:Array.from(raw)};
}
function zip(b){const v=new DataView(b.buffer,b.byteOffset,b.length),out=new Map();let at=0;
 while(v.getUint32(at,true)===0x04034b50){const size=v.getUint32(at+18,true),n=v.getUint16(at+26,true),name=dec(b.subarray(at+30,at+30+n)),data=b.subarray(at+30+n,at+30+n+size);A.equal(v.getUint32(at+14,true),crc(data));out.set(name,data);at+=30+n+size;}
 const centralStart=at;let count=0;while(v.getUint32(at,true)===0x02014b50){const n=v.getUint16(at+28,true),name=dec(b.subarray(at+46,at+46+n)),off=v.getUint32(at+42,true);A.equal(v.getUint32(off,true),0x04034b50);A.equal(v.getUint32(at+16,true),crc(out.get(name)));at+=46+n;count++;}
 A.equal(v.getUint32(at,true),0x06054b50);A.equal(v.getUint16(at+10,true),count);A.equal(v.getUint32(at+16,true),centralStart);A.equal(at+22,b.length);return out;
}
test('exact PNG bytes, one alpha conversion, no mutation, independent CRC/inflate',async()=>{
 const pixels=Uint8Array.of(64,32,16,128,200,90,3,0,1,2,3,255);
 const a=png(await X.encodePng({pixels,width:3,height:1,alpha:'premultiplied'},deflate));
 A.deepEqual(a.raw,[0,128,64,32,128,0,0,0,0,1,2,3,255]);A.deepEqual(Array.from(pixels),[64,32,16,128,200,90,3,0,1,2,3,255]);
 const b=png(await X.encodePng({pixels,width:3,height:1,alpha:'straight'},deflate));A.deepEqual(b.raw,[0,64,32,16,128,0,0,0,0,1,2,3,255]);A.equal(a.w,3);A.equal(a.h,1);
});
function fixture(mode='pickup',backend='webgl2'){
 const settings=L.defaults();
 const state={times:[],destroyed:0,created:0};const opts={settings,backend,crop:{x:3,y:4,width:2,height:1},deflate,encodeText:enc,createScene:async s=>{state.created++;A.ok(Object.isFrozen(s.settings));A.ok(Object.isFrozen(s.crop));return {backend,maxTextureSize:1024,readFrame:async t=>{state.times.push(t);return {width:2,height:1,alpha:backend==='webgpu'?'straight':'premultiplied',pixels:Uint8Array.of(16,8,4,32,0,0,0,0)};},destroy(){state.destroyed++}}}};
 return {opts,state};
}
test('40/60 explicit fixed-step frames, valid archive, deterministic bytes and frozen inputs',async()=>{
 for(const [mode,backend] of [['pickup','webgl2'],['idle','webgpu']]){
  const {opts,state}=fixture(mode,backend),n=mode==='idle'?60:40;opts.frameCount=n;const result=await X.bakeSequence(opts);
  A.equal(result.manifest.count,n);A.equal(state.destroyed,1);A.deepEqual(state.times,Array.from({length:n},(_,i)=>i/60));
  const files=zip(result.zip);A.equal(files.size,n+2);A.equal(files.has('frames/frame_00000.png'),true);
  const meta=JSON.parse(dec(files.get('sequence.json')));A.equal(meta.frames.at(-1).timeSeconds,(n-1)/60);A.equal(meta.backend,backend);
  const a=png(files.get('frames/frame_00000.png'));A.deepEqual(a.raw,backend==='webgpu'?[0,16,8,4,32,0,0,0,0]:[0,128,64,32,32,0,0,0,0]);
  A.deepEqual(await X.bakeSequence(opts),result);
 }
});
test('cancel, budget, wrong backend, texture size, dimensions, alpha and cleanup',async()=>{
 for(const kind of ['cancel','png','zip','backend','texture','dimensions','alpha','read','destroy']){
  const {opts,state}=fixture(),create=opts.createScene,signal={aborted:false};opts.signal=signal;opts.frameCount=3;
  opts.createScene=async p=>{const s=await create(p),read=s.readFrame;return {...s,
   ...(kind==='backend'?{backend:'webgpu'}:{}),...(kind==='texture'?{maxTextureSize:1}:{}),
   readFrame:async t=>{if(kind==='read')throw Error('read failure');const f=await read(t);if(kind==='dimensions')f.width=1;if(kind==='alpha')f.alpha='straight';return f;},
   destroy(){s.destroy();if(kind==='destroy')throw Error('cleanup failure');}};};
  if(kind==='cancel')opts.progress=()=>signal.aborted=true;
  if(kind==='png')opts.pngLimit=1;if(kind==='zip')opts.zipLimit=22;
  await A.rejects(()=>X.bakeSequence(opts));A.equal(state.destroyed,1);
  if(kind==='cancel')A.equal(state.times.length,1);
 }
 const {opts,state}=fixture();opts.frameCount=3601;await A.rejects(()=>X.bakeSequence(opts));A.equal(state.created,0);
});
test('ZIP path and exact package-size guards',()=>{
 const entry={name:'a.png',data:Uint8Array.of(1,2,3)},b=X.makeZip([entry]);A.deepEqual(Array.from(zip(b).get('a.png')),[1,2,3]);
 A.throws(()=>X.makeZip([entry],()=>{},b.length-1),/budget/);A.equal(X.makeZip([entry],()=>{},b.length).length,b.length);
 for(const name of ['../bad','/bad','a\\b','a//b','C:/bad'])A.throws(()=>X.makeZip([{...entry,name}]),/unsafe/);
 A.throws(()=>X.makeZip([entry,entry]),/duplicate/);
});
