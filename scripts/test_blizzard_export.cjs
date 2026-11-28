'use strict';
function run(read,A,T,env){
 const {TextEncoder,TextDecoder,Blob,deflate,inflate}=env,g={},base='assets/blizzard/src/',common='assets/template/src/',vendor='assets/template/vendor/';
 for(const p of [common+'curve-core.js',common+'spacing-core.js',common+'color-core.js',base+'blizzard-core.js',base+'blizzard-png.js',base+'zip-core.js'])new Function('globalThis','TextEncoder','TextDecoder','Blob',read(p))(g,TextEncoder,TextDecoder,Blob);
 const m={exports:{}};new Function('globalThis','module','require',read(base+'blizzard-export.js'))(g,m,()=>{throw Error('unexpected require');});
 const E=m.exports,B=g.FxBlizzard,P=g.FxBlizzardPng,Z=g.FxBlizzardZip,enc=new TextEncoder(),dec=new TextDecoder();
 const eq=(a,b)=>A.deepEqual(Array.from(a),Array.from(b));
 function crc(bytes){let s=0xffffffff;for(const b of bytes){s^=b;for(let k=0;k<8;k++)s=(s>>>1)^((s&1)?0xedb88320:0);}return (~s)>>>0;}
 async function unzip(blob){
  const data=new Uint8Array(await blob.arrayBuffer()),v=new DataView(data.buffer),end=data.length-22,count=v.getUint16(end+10,true),central=v.getUint32(end+16,true),map=new Map();A.equal(v.getUint32(end,true),0x06054b50);
  let pos=central;
  for(let i=0;i<count;i++){
   A.equal(v.getUint32(pos,true),0x02014b50);const size=v.getUint32(pos+24,true),crcExpected=v.getUint32(pos+16,true),len=v.getUint16(pos+28,true),local=v.getUint32(pos+42,true),name=dec.decode(data.subarray(pos+46,pos+46+len));
   A.equal(v.getUint32(local,true),0x04034b50);A.equal(v.getUint16(local+8,true),0);A.equal(dec.decode(data.subarray(local+30,local+30+v.getUint16(local+26,true))),name);
   const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),bytes=data.slice(start,start+size);
   A.equal(crc(bytes),crcExpected);A.ok(!map.has(name));map.set(name,bytes);pos+=46+len+v.getUint16(pos+30,true)+v.getUint16(pos+32,true);
  }
  A.equal(pos,end);return map;
 }
 async function decodePng(data){
  eq(data.slice(0,8),[137,80,78,71,13,10,26,10]);const v=new DataView(data.buffer,data.byteOffset,data.byteLength),idat=[];let width,height,pos=8;
  while(pos<data.length){const n=v.getUint32(pos),name=dec.decode(data.slice(pos+4,pos+8)),bytes=data.slice(pos+8,pos+8+n);A.equal(crc(data.slice(pos+4,pos+8+n)),v.getUint32(pos+8+n));
   if(name==='IHDR'){width=v.getUint32(pos+8);height=v.getUint32(pos+12);A.equal(bytes[8],8);A.equal(bytes[9],6);}if(name==='IDAT')idat.push(bytes);pos+=12+n;
  }
  const compressed=new Uint8Array(idat.reduce((n,v)=>n+v.length,0));let k=0;for(const a of idat){compressed.set(a,k);k+=a.length;}
  const raw=await inflate(compressed),out=new Uint8Array(width*height*4);A.equal(raw.length,(width*4+1)*height);
  for(let y=0;y<height;y++){A.equal(raw[y*(width*4+1)],0);out.set(raw.subarray(y*(width*4+1)+1,(y+1)*(width*4+1)),y*width*4);}
  return {width,height,pixels:out};
 }
 const modules={fxCurveCore:common+'curve-core.js',fxSpacingCore:common+'spacing-core.js',fxColorCore:common+'color-core.js',fxBlizzardCore:base+'blizzard-core.js',fxBlizzardRuntime:base+'blizzard-runtime.js',fxBlizzardPose:base+'blizzard-pose.js',blizzardPixiVendor:vendor+'pixi-8.22.0.min.js',blizzardSpineVendor:vendor+'spine-pixi-v8-4.2.120.min.js'};
 const source=id=>id==='runtimeLicenses'?read('assets/template/licenses/spine.txt')+'\n'+read('assets/template/licenses/pixi.txt'):modules[id]?read(modules[id]):undefined;
 T('RGBA8 PNG straight alpha and independent chunk CRC/readback',async()=>{
  const a=Uint8Array.of(64,32,16,128,9,8,7,0,255,128,64,255);
  for(const alpha of ['premultiplied','straight']){
   const png=await P.encodePng({pixels:a,width:3,height:1,alpha},deflate),out=await decodePng(png);
   A.equal(out.width,3);A.equal(out.height,1);eq(out.pixels,alpha==='premultiplied'?[128,64,32,128,0,0,0,0,255,128,64,255]:[64,32,16,128,0,0,0,0,255,128,64,255]);
  }
  A.throws(()=>P.straightRgba(a,4,1,'straight'));A.throws(()=>P.straightRgba(a,3,1,'unknown'));
 });
 T('both developer ZIPs preserve exact modules, pins, controls and safe unique atlas page aliases',async()=>{
  const settings=B.defaults();settings.angle=-47;settings.emitters[0].layers.whiteout.enabled=true;
  const asset={skeletonName:'rig.json',skeleton:'{}',atlasName:'rig.atlas',atlas:'original atlas',images:new Map([['x','imageA'],['y','imageB'],['z','imageC'],['unused','unreferenced']]),pageBindings:[{name:'nested/A.png',key:'x'},{name:'nested/a.PNG',key:'y'},{name:'snow #1.png',key:'z'}],skin:'default',animation:'idle'};
  for(const target of ['webgl','webgpu']){
   const p=E.packageEntries({settings,asset,source,target}),map=await unzip(await Z.makeZip(p.entries));
   const get=n=>dec.decode(map.get(n)),preset=JSON.parse(get('preset.json'));A.deepEqual(preset.settings,B.normalize(settings));A.equal(get('preset.json'),get('public/preset.json'));A.equal(preset.rendererPreference,target);A.equal(preset.asset.skin,'default');A.equal(preset.asset.animation,'idle');
   A.equal(JSON.parse(get('package.json')).dependencies['pixi.js'],'8.22.0');A.equal(JSON.parse(get('package.json')).dependencies['@esotericsoftware/spine-pixi-v8'],'4.2.120');
   A.equal(get('public/offline/core.js'),source('fxBlizzardCore'));A.equal(get('public/offline/runtime.js'),source('fxBlizzardRuntime'));A.equal(get('public/offline/pose.js'),source('fxBlizzardPose'));A.equal(get('public/offline/pixi.js'),source('blizzardPixiVendor'));A.equal(get('public/offline/spine.js'),source('blizzardSpineVendor'));
   A.ok(get('Blizzard.mjs').includes(source('fxBlizzardRuntime')));A.ok(get('FxBlizzard.mjs').includes(source('fxBlizzardCore')));A.ok(get('FxBlizzardPose.mjs').includes(source('fxBlizzardPose')));
   A.equal(get('public/'+preset.asset.atlas),'original atlas');A.equal(new Set(preset.asset.pages.map(p=>p.path.toLowerCase())).size,3);
   for(let i=0;i<3;i++){A.equal(preset.asset.pages[i].name,asset.pageBindings[i].name);A.equal(get('public/'+preset.asset.pages[i].path),['imageA','imageB','imageC'][i]);}
   A.ok(![...map.values()].some(b=>b.length===12&&dec.decode(b)==='unreferenced'));A.ok(get('public/offline.html').includes('./offline/demo.js'));new Function(get('public/offline/demo.js'));
   A.ok(get('example.js').includes('Object.fromEntries(p.asset.pages.map'));A.ok(!get('public/offline.html').includes('https://'));A.ok(get('LICENSES.txt').length>100);
  }
  for(const bad of ['../p.png','/p.png','C:/p.png','a//b.png'])A.throws(()=>E.assetArchive({...asset,pageBindings:[{name:bad,key:'x'}]}));
  A.throws(()=>E.packageEntries({settings,source:()=>null,target:'webgl'}));A.throws(()=>E.packageEntries({settings,source,target:'fake'}));
 });
 T('sequence timing, real codec, isolated renderer fixture and independent ZIP/PNG oracle',async()=>{
  const settings={...B.defaults(),mode:'oneShot',durationFrames:40,exportFrames:40};const cfg=B.normalize(settings);
  A.equal(E.manifest(settings,{actual:'webgl2'},40).frames.at(-1).timeSeconds,39/60);A.equal(E.manifest(B.defaults(),{actual:'webgpu'},60).frames.at(-1).timeSeconds,59/60);
  A.throws(()=>E.manifest(settings,{actual:'unknown'},1));A.throws(()=>E.manifest(settings,{actual:'webgl2'},41));
  for(const backend of ['webgl1','webgl2','webgpu']){
   let disposed=0,seen=[];const pixels=new Uint8Array(512*512*4);pixels.set(backend==='webgpu'?[200,100,50,128]:[100,50,25,128]);
   const result=await E.bakeSequence({settings,backend:{actual:backend},frames:2,codec:P,zip:Z,deflate,createScene:async(c,b)=>({settings:c,backend:b,dispose(){disposed++;},readFrame(t){seen.push(t);return {pixels,width:512,height:512,alpha:b==='webgpu'?'straight':'premultiplied'};}})});
   A.equal(disposed,1);A.deepEqual(seen,[0,1/60]);A.deepEqual(result.manifest.settings,cfg);const entries=await unzip(result.blob),out=await decodePng(entries.get('frames/0000.png'));
   A.equal(out.width,512);A.equal(out.height,512);eq(out.pixels.slice(0,8),[199+(backend==='webgpu'?1:0),100,50,128,0,0,0,0]);A.equal(JSON.parse(dec.decode(entries.get('sequence.json'))).backend.actual,backend);
  }
 });
 T('cancellation after each asynchronous boundary including cleanup and package assembly, no result',async()=>{
  const settings=B.defaults(),backend={actual:'webgl2'},pixels=new Uint8Array(512*512*4);
  for(const stage of ['init','read','encode','yield','zip','dispose','mismatch','budget']){
   let disposed=0,signal={aborted:false};
   const createScene=async(c,b)=>{if(stage==='init')signal.aborted=true;return {settings:c,backend:stage==='mismatch'?'webgpu':b,async dispose(){disposed++;if(stage==='dispose')signal.aborted=true;},async readFrame(){if(stage==='read')signal.aborted=true;return {pixels,width:512,height:512,alpha:'premultiplied'};}}};
   const codec={async encodePng(f,d){if(stage==='encode')signal.aborted=true;return Uint8Array.of(1,2,3);}},zip={async makeZip(){if(stage==='zip')signal.aborted=true;return new Blob([]);}};
   await A.rejects(()=>E.bakeSequence({settings,backend,frames:1,codec,zip,signal,createScene,yieldFrame:async()=>{if(stage==='yield')signal.aborted=true;},pngLimit:stage==='budget'?2:100}));
   A.equal(disposed,1);
  }
 });
 T('developer readiness waits for actual asset load and first frame; failed startup disposes resources',async()=>{
  const asset={skeletonName:'x.json',atlasName:'x.atlas',skeleton:'{}',atlas:'a',images:new Map([['x.png','data']]),pageBindings:[{name:'x.png',key:'x.png'}],animation:'idle'};
  for(const target of ['webgl','webgpu'])for(const kind of ['ok','load','anchor']){
   const pack=E.packageEntries({settings:B.defaults(),asset,source,target}),demo=pack.entries.find(e=>e.name==='public/offline/demo.js').data;
   let resolve,reject,hide;const wait=new Promise((a,b)=>{resolve=a;reject=b;}),status={dataset:{state:'loading'},textContent:'Starting'},calls=[];
   class App{constructor(){this.renderer=target==='webgl'?{gl:{}}:{type:9};this.canvas={};this.stage={addChild(){}};this.ticker={add(){calls.push('ticker');}};}async init(){}render(){calls.push('render');}start(){calls.push('start');}destroy(){calls.push('destroy');}}
   const model={update(){},getLocalBounds(){return {x:0,y:0,width:100,height:100};},scale:{set(){}},position:{set(){}}};
   const root={PIXI:{Application:App,RendererType:{WEBGPU:9},Container:class{addChild(){}},Assets:{add(){},load(){calls.push('load');return wait;}}},spine:{Spine:{from(){calls.push('model');return model;}}},FxBlizzard:B,FxBlizzardRuntime:{createBlizzard(){return {seek(){calls.push('seek');},diagnostics:kind==='anchor'?[{code:'missing-anchor'}]:[],destroy(){calls.push('fxdestroy');}};}},FxBlizzardPose:{seek(){calls.push('pose');}}};
   const doc={getElementById:()=>status,body:{append(){calls.push('canvas');},textContent:''}};
   new Function('globalThis','document','fetch','window','console',demo)(root,doc,async()=>({ok:true,json:async()=>pack.preset}),{addEventListener(_,fn){hide=fn;}},{error(){calls.push('error');}});
   for(let i=0;i<12;i++)await Promise.resolve();
   A.equal(status.dataset.state,'loading');A.ok(calls.includes('load'));A.ok(!calls.includes('render'));
   if(kind==='load')reject(Error('atlas failed'));else resolve();
   for(let i=0;i<12;i++)await Promise.resolve();
   A.equal(status.dataset.state,kind==='ok'?'ready':'error');
   if(kind==='ok'){A.ok(calls.indexOf('render')>calls.indexOf('seek'));A.ok(calls.indexOf('start')>calls.indexOf('render'));hide();hide();A.equal(calls.filter(c=>c==='destroy').length,1);A.equal(calls.filter(c=>c==='fxdestroy').length,1);}
   else{A.ok(calls.includes('destroy'));A.ok(!calls.includes('start'));A.ok(calls.includes('error'));if(kind==='anchor')A.ok(calls.includes('fxdestroy'));}
  }
 });
 T('readFrame uses exact logical crop and disposes generated texture even when readback fails',async()=>{
  let destroyed=0,opts,fail=false;g.PIXI={Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}};
  const stage={},texture={destroy(v){A.equal(v,true);destroyed++;}},scene={app:{stage,renderer:{extract:{texture(o){opts=o;return texture;},pixels(t){A.equal(t,texture);if(fail)throw Error('readback fault');return {width:512,height:512,pixels:new Uint8Array(512*512*4)};}}}}};
  A.equal((await E.readFrame(scene,'webgl1')).alpha,'premultiplied');A.equal(opts.target,stage);A.deepEqual({...opts.frame},{x:0,y:0,width:512,height:512});A.equal(opts.resolution,1);A.equal(opts.antialias,false);
  A.equal((await E.readFrame(scene,'webgpu')).alpha,'straight');A.equal(opts.antialias,true);fail=true;await A.rejects(()=>E.readFrame(scene,'webgl2'));A.equal(destroyed,3);
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test,{TextEncoder,TextDecoder,Blob,deflate:b=>new Uint8Array(z.deflateSync(b)),inflate:b=>new Uint8Array(z.inflateSync(b))});}
