'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../assets/loot-sparkle/src/loot-core.js'),X=require('../assets/loot-sparkle/src/loot-export.js');
const src=fs.readFileSync(path.join(__dirname,'../assets/loot-sparkle/src/loot-export-browser.js'),'utf8');
const scope={FxLootExport:X};new Function('globalThis','FxLoot','TextEncoder',src)(scope,L,TextEncoder);const D=scope.FxLootExportBrowser;
const names=['curve-core.js','spacing-core.js','color-core.js','timeline-core.js','loot-core.js','loot-runtime.js','loot-spine.js'];
const bytes=(data,name)=>({name,size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer});
const fixture=()=>({target:'webgpu',settings:L.defaults(),source:{name:'skeleton.skel',skeleton:bytes([1,2,3]),atlas:bytes([4,5],'skeleton.atlas'),images:new Map([['skeleton.skel',bytes([6,7])],['../page.png',bytes([8,9])]])},options:{animation:'walk',skin:'default',speed:1,visible:true},assetInfo:{version:'4.2.22'},previewSeconds:.25,crop:{x:0,y:0,width:512,height:512},frameCount:40,sources:Object.fromEntries(names.map(n=>[n,'// '+n])),licenses:'runtime notices'});
function zip(b){const v=new DataView(b.buffer,b.byteOffset,b.length),out=new Map();let at=0;
 while(v.getUint32(at,true)===0x04034b50){const size=v.getUint32(at+18,true),n=v.getUint16(at+26,true),name=String.fromCharCode(...b.subarray(at+30,at+30+n)),data=b.slice(at+30+n,at+30+n+size);A.equal(v.getUint32(at+14,true),X.crc32(data));out.set(name,data);at+=30+n+size;}A.equal(v.getUint32(at,true),0x02014b50);return out;}
test('snapshot image map, atlas, crop and source strings before first await',async()=>{
 const o=fixture(),p=D.developer(o);o.source.images.clear();o.source.atlas=bytes([90]);o.crop.x=100;o.sources['loot-core.js']='// changed';o.options.speed=2;
 const r=await p,f=zip(r.zip);A.equal(r.preset.asset.images.length,2);A.equal(r.preset.crop.x,0);A.equal(r.preset.asset.options.speed,1);
 A.deepEqual(Array.from(f.get('public/assets/skeleton.atlas')),[4,5]);
 A.deepEqual(Array.from(f.get('public/assets/page_000.png')),[6,7]);A.deepEqual(Array.from(f.get('public/assets/page_001.png')),[8,9]);
 A.equal(String.fromCharCode(...f.get('loot-core.js')),'// loot-core.js');
});
test('large and malformed sources reject before reading',async()=>{
 for(const kind of ['skeleton','images','emptySources','notices','version','tooMany']){
  const o=fixture();let reads=0;const b={size:3,arrayBuffer:async()=>{reads++;return Uint8Array.of(1,2,3).buffer}};
  o.source.skeleton=b;if(kind==='skeleton')b.size=65*1024*1024;
  if(kind==='images')o.source.images.set('large.png',{...b,size:193*1024*1024});
  if(kind==='emptySources')delete o.sources['loot-core.js'];if(kind==='notices')o.licenses='';if(kind==='version')o.assetInfo.version='4.3.0';
  if(kind==='tooMany')for(let i=0;i<65;i++)o.source.images.set('p'+i,b);
  await A.rejects(()=>D.developer(o));A.equal(reads,0,kind);
 }
});
test('reject inconsistent blob length; unchanged valid output and no asset case',async()=>{
 const o=fixture();o.source.skeleton={size:1,arrayBuffer:async()=>Uint8Array.of(1,2).buffer};await A.rejects(()=>D.developer(o),/size changed/);
 const valid=fixture(),a=await D.developer(valid),b=await D.developer(valid);A.deepEqual(a,b);A.equal(a.preset.asset.sourceSkeletonName,'skeleton.skel');
 const n=await D.developer({...valid,source:null});A.equal(n.preset.asset,null);A.ok(zip(n.zip).has('example.js'));
});
