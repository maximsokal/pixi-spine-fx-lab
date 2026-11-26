'use strict';
const A=require('node:assert/strict'),test=require('node:test').test;
const L=require('../assets/falling-leaves/src/leaves-core.js'),X=require('../assets/falling-leaves/src/leaves-export.js'),C=require('../assets/magic-shield/src/shield-export.js');
const zlib=require('node:zlib'),dec=v=>new TextDecoder().decode(v),deflate=async raw=>new Uint8Array(zlib.deflateSync(raw));
function unzip(zip){const out=new Map();let at=0;const v=new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
 while(v.getUint32(at,true)===0x04034b50){const n=v.getUint16(at+26,true),extra=v.getUint16(at+28,true),size=v.getUint32(at+18,true),start=at+30+n+extra;out.set(dec(zip.subarray(at+30,at+30+n)),zip.slice(start,start+size));at=start+size;}return out;}
function fixture(backend='webgl2'){let destroyed=0,reads=[];const pix=new Uint8Array(512*512*4);pix.set([50,25,10,128,99,88,77,0]);
 return {get destroyed(){return destroyed},reads,createScene:async()=>({backend,readFrame:async t=>{reads.push(t);return {pixels:pix,width:512,height:512,alpha:'premultiplied'};},destroy(){destroyed++;}})};}
test('120 half-open frame timestamps and independent pose metadata',()=>{
 const m=X.manifest(L.defaults(),'webgpu',null,{followFx:false,spineTime:.7,visible:false});
 A.equal(m.frames.length,120);A.equal(m.frames.at(-1).timeSeconds,119/60);A.equal(m.pose.spineTime,.7);A.equal(m.includesSpine,false);A.equal(m.alpha,'straight-rgba8');A.throws(()=>X.manifest(L.defaults(),'unknown'));
});
test('GPU row padding and BGRA swizzle',()=>{
 const b=Uint8Array.of(10,25,50,128,9,8,7,0,99,99,99,99,1,2,3,4,5,6,7,8,99,99,99,99);
 A.deepEqual([...X.unpackGpu(b,2,2,12,'bgra8unorm')],[50,25,10,128,7,8,9,0,3,2,1,4,7,6,5,8]);A.throws(()=>X.unpackGpu(b,2,2,12,'unknown'));
});
test('120 encoded PNG entries and single alpha conversion',async()=>{
 const f=fixture(),o={codec:C,settings:L.defaults(),backend:'webgl2',createScene:f.createScene,deflate};
 const a=await X.bakeSequence(o),b=await X.bakeSequence(o);A.equal(f.destroyed,2);A.equal(f.reads.length,240);A.deepEqual(a.zip,b.zip);
 const files=unzip(a.zip);A.equal(files.size,121);
 const png=files.get('frames/frame_0000.png'),v=new DataView(png.buffer,png.byteOffset,png.byteLength);
 A.equal(v.getUint32(16),512);A.equal(v.getUint32(20),512);A.equal(png[25],6);
 const raw=zlib.inflateSync(png.subarray(41,41+v.getUint32(33)));
 A.deepEqual([...raw.subarray(0,9)],[0,100,50,20,128,0,0,0,0]);A.equal(JSON.parse(dec(files.get('sequence.json'))).frames.at(-1).timeSeconds,119/60);
});
test('cancellation and wrong backend clean isolated scene',async()=>{
 const f=fixture(),signal={aborted:false};await A.rejects(()=>X.bakeSequence({codec:C,settings:L.defaults(),backend:'webgl2',createScene:f.createScene,deflate,signal,progress(){signal.aborted=true;}}),/cancelled/);
 A.equal(f.destroyed,1);A.equal(f.reads.length,1);
 const g=fixture('webgpu');await A.rejects(()=>X.bakeSequence({codec:C,settings:L.defaults(),backend:'webgl2',createScene:g.createScene,deflate}),/mismatch/);A.equal(g.destroyed,1);
});
test('offline developer ZIP both targets with exact sources and asset pages',async()=>{
 const asset={skeletonName:'body.json',atlasName:'body.atlas',skeleton:'{}',atlas:'nested/page.png\n',skin:'default',animation:'idle',images:new Map([['nested/page.png',Uint8Array.of(1,2,3)]])};
 for(const target of ['webgl','webgpu']){const p=await X.packageEntries({settings:L.defaults(),asset,target,source:n=>'// '+n});
  const files=unzip(C.makeZip(p.entries)),html=dec(files.get('index.html'));
  A.equal(dec(files.get('vendor/pixi-8.22.0.min.js')),'// pixi-8.22.0.min.js');A.equal(dec(files.get('src/leaves-runtime.js')),'// leaves-runtime.js');
  A.deepEqual([...files.get('assets/nested/page.png')],[1,2,3]);A.ok(html.includes('AQID'));A.ok(!html.includes('https://'));A.equal(p.preset.rendererPreference,target);A.ok(dec(files.get('example.js')).includes("init('webgl')"));A.equal(p.preset.compatibility.spine,'4.2.120');}
});
test('unsafe names and case collisions rejected',async()=>{
 const asset={skeletonName:'body.json',atlasName:'body.atlas',skeleton:'{}',atlas:'x',images:new Map([['../page.png','x']])};
 await A.rejects(()=>X.packageEntries({settings:L.defaults(),asset,target:'webgl',source:()=>''}),/unsafe/);
 asset.images=new Map([['body.JSON','x']]);await A.rejects(()=>X.packageEntries({settings:L.defaults(),asset,target:'webgl',source:()=>''}),/duplicate/);
});
