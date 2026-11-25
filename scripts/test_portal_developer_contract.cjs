'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../assets/magic-portal/src/portal-core.js'),X=require('../assets/magic-portal/src/portal-export.js');
const src=fs.readFileSync(path.join(__dirname,'../assets/magic-portal/src/portal-export-browser.js'),'utf8');
const scope={FxPortalExport:X};new Function('globalThis','FxPortal','TextEncoder',src)(scope,L,TextEncoder);const D=scope.FxPortalExportBrowser;
const names=['curve-core.js','spacing-core.js','color-core.js','timeline-core.js','portal-core.js','portal-runtime.js','portal-spine.js'];
const bytes=(data,name)=>({name,size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer});
const fixture=()=>({target:'webgpu',settings:L.defaults(),source:{name:'skeleton.skel',skeleton:bytes([1,2,3]),atlas:bytes([4,5],'skeleton.atlas'),images:new Map([['skeleton.skel',bytes([6,7])],['../page.png',bytes([8,9])]])},options:{animation:'walk',skin:'default',speed:1,visible:true},assetInfo:{version:'4.2.22'},previewSeconds:.25,crop:{x:0,y:0,width:512,height:512},frameCount:40,sources:Object.fromEntries(names.map(n=>[n,'// '+n])),licenses:'runtime notices'});
function zip(b){const v=new DataView(b.buffer,b.byteOffset,b.length),out=new Map();let at=0;
 while(v.getUint32(at,true)===0x04034b50){const size=v.getUint32(at+18,true),n=v.getUint16(at+26,true),name=String.fromCharCode(...b.subarray(at+30,at+30+n)),data=b.slice(at+30+n,at+30+n+size);A.equal(v.getUint32(at+14,true),X.crc32(data));out.set(name,data);at+=30+n+size;}A.equal(v.getUint32(at,true),0x02014b50);return out;}
test('snapshot image map, atlas, crop and source strings before first await',async()=>{
 const o=fixture(),p=D.developer(o);o.source.images.clear();o.source.atlas=bytes([90]);o.crop.x=100;o.sources['portal-core.js']='// changed';o.options.speed=2;
 const r=await p,f=zip(r.zip);A.equal(r.preset.asset.images.length,2);A.equal(r.preset.crop.x,0);A.equal(r.preset.asset.options.speed,1);
 A.deepEqual(Array.from(f.get('public/assets/skeleton.atlas')),[4,5]);
 A.deepEqual(Array.from(f.get('public/assets/page_000.png')),[6,7]);A.deepEqual(Array.from(f.get('public/assets/page_001.png')),[8,9]);
 A.equal(String.fromCharCode(...f.get('portal-core.js')),'// portal-core.js');
});
test('large and malformed sources reject before reading',async()=>{
 for(const kind of ['skeleton','images','emptySources','notices','version','tooMany']){
  const o=fixture();let reads=0;const b={size:3,arrayBuffer:async()=>{reads++;return Uint8Array.of(1,2,3).buffer}};
  o.source.skeleton=b;if(kind==='skeleton')b.size=65*1024*1024;
  if(kind==='images')o.source.images.set('large.png',{...b,size:193*1024*1024});
  if(kind==='emptySources')delete o.sources['portal-core.js'];if(kind==='notices')o.licenses='';if(kind==='version')o.assetInfo.version='4.3.0';
  if(kind==='tooMany')for(let i=0;i<65;i++)o.source.images.set('p'+i,b);
  await A.rejects(()=>D.developer(o));A.equal(reads,0,kind);
 }
});
test('reject inconsistent blob length; unchanged valid output and no asset case',async()=>{
 const o=fixture();o.source.skeleton={size:1,arrayBuffer:async()=>Uint8Array.of(1,2).buffer};await A.rejects(()=>D.developer(o),/size changed/);
 const valid=fixture(),a=await D.developer(valid),b=await D.developer(valid);A.deepEqual(a,b);A.equal(a.preset.asset.sourceSkeletonName,'skeleton.skel');
 const n=await D.developer({...valid,source:null});A.equal(n.preset.asset,null);A.ok(zip(n.zip).has('example.js'));
});

test('invalid preview metadata and pose options reject before reading assets',async()=>{
 for(const patch of [{previewSeconds:Infinity},{previewSeconds:2},{frameCount:0},{crop:{x:0,y:0,width:0,height:16}},{crop:{x:0,y:0,width:16,height:16,extra:1}},{options:{animation:'walk',skin:'default',speed:0,visible:true}},{target:'unknown'}]){
  const o=fixture();let reads=0;o.source.skeleton={size:1,arrayBuffer:async()=>{reads++;return Uint8Array.of(1).buffer}};
  await A.rejects(()=>D.developer({...o,...patch}));A.equal(reads,0);
 }
});

test('loop fractional last-frame time accepted, one-shot clamps at last sample',async()=>{
 const o=fixture();o.previewSeconds=119.5/60;A.equal((await D.developer(o)).preset.previewSeconds,o.previewSeconds);
 o.settings.mode='oneShot';await A.rejects(()=>D.developer(o),/preview time/);
 o.previewSeconds=119/60;A.equal((await D.developer(o)).preset.previewSeconds,o.previewSeconds);
});
