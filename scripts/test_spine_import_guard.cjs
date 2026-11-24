'use strict';
// #53: execute the actual Burn Lab loader functions with instrumented boundaries.
// This is not a Pixi GPU or real Spine binary-parser integration test.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(process.env.BURN_IMPORT_SOURCE||path.join(__dirname,'../assets/template/src/ui.html'),'utf8');
const start=html.indexOf('function readVersion(bytes)');
const end=html.indexOf('\nasync function loadSample()',start);
assert.ok(start>=0);
const source=html.slice(start,end<0?undefined:end);
function harness(){
 const overlay={style:{display:'none'},textContent:'ready'}, prior={name:'prior.json'}, oldAtlas={name:'prior.atlas'}, oldImages=new Map([['prior.png',{}]]), oldModel={}, oldAsset={version:'4.2.43'};
 const boundary=new Error('atlas allocation boundary');
 let allocs=0,pauses=0,renders=0;
 // Minimal instrumented 4.2 header reader; real parser compatibility is separate.
 class BinaryInput{
  constructor(bytes){this.bytes=bytes;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);this.offset=0;}
  readInt32(){const value=this.view.getInt32(this.offset);this.offset+=4;return value;}
  readString(){const n=this.view.getUint8(this.offset++);if(n<2)return n===0?null:'';let s='';for(let i=1;i<n;i++)s+=String.fromCharCode(this.view.getUint8(this.offset++));return s;}
 }
 const ctx=vm.createContext({loadSerial:7,loading:false,rendererBusy:false,bakeBusy:false,playing:true,model:oldModel,loadedAsset:oldAsset,selectedSkeleton:prior,selectedAtlas:oldAtlas,selectedImages:oldImages,textureSources:[],
  Uint8Array,Map,Array,Blob,$:()=>overlay,renderAssetSelection:()=>{renders++;},setPlaying:v=>{pauses++;ctx.playing=v;},setStatus:()=>{},assetMessage:()=>{},spine:{BinaryInput,TextureAtlas:class{constructor(){allocs++;throw boundary;}}}});
 vm.runInContext(source,ctx);
 const snapshot=()=>({serial:ctx.loadSerial,loading:ctx.loading,playing:ctx.playing,overlay:overlay.style.display,message:overlay.textContent,model:ctx.model,asset:ctx.loadedAsset,skeleton:ctx.selectedSkeleton,atlas:ctx.selectedAtlas,images:ctx.selectedImages,allocs,pauses,renders});
 return {ctx,boundary,snapshot,allocs:()=>allocs};
}
const json=v=>JSON.stringify({skeleton:{spine:v}});
function binary(v){const a=Buffer.from(v);return Uint8Array.from([0,0,0,0,0,0,0,0,a.length+1,...a]);}
async function rejectsUnchanged(data,isBinary=false){const h=harness(),before=h.snapshot();await assert.rejects(h.ctx.installAsset(data,'atlas',new Map(),'candidate',isBinary));assert.deepEqual(h.snapshot(),before);}
for(const v of ['4.1.99','4.3.1','4.2.','4.2.invalid','4.2.4.5','4.2.01','4.2.43\n',null])test('JSON rejects '+JSON.stringify(v)+' before preview mutation',()=>rejectsUnchanged(json(v)));
test('invalid JSON and null root reject before preview mutation',async()=>{for(const s of ['{','null','{}'])await rejectsUnchanged(s);});
test('binary mismatches and incomplete header reject before preview mutation',async()=>{for(const b of [binary('4.1.99'),binary('4.3.1'),binary('4.2.invalid'),new Uint8Array(0),new Uint8Array(7),binary('4.2.43').slice(0,-1)])await rejectsUnchanged(b,true);});
test('valid JSON and binary headers reach atlas allocation',async()=>{for(const [data,isBinary] of [[json('4.2.43'),false],[binary('4.2.43'),true]]){const h=harness();await assert.rejects(h.ctx.installAsset(data,'atlas',new Map(),'candidate',isBinary),e=>e===h.boundary);assert.equal(h.allocs(),1);assert.equal(h.ctx.loading,false);}});
const files=v=>[{name:'candidate.json',text:async()=>json(v)},{name:'candidate.atlas',text:async()=>'atlas'},{name:'candidate.png'}];
test('rejected drop retains selected files and loaded asset',async()=>{const h=harness(),before=h.snapshot();assert.equal(await h.ctx.loadFiles(files('4.3.1')),false);assert.deepEqual(h.snapshot(),before);});
test('busy state rechecked after asynchronous file reads',async()=>{const h=harness(),f=files('4.2.43');f[0].text=async()=>{h.ctx.bakeBusy=true;return json('4.2.43');};assert.equal(await h.ctx.loadFiles(f),false);assert.equal(h.allocs(),0);assert.equal(h.ctx.playing,true);});
test('successful installation updates selection only after install resolves',async()=>{const h=harness(),f=files('4.2.43'),before=h.snapshot();h.ctx.installAsset=async()=>{assert.equal(h.ctx.selectedSkeleton,before.skeleton);assert.equal(h.ctx.selectedImages,before.images);};assert.equal(await h.ctx.loadFiles(f),true);assert.equal(h.ctx.selectedSkeleton,f[0]);assert.equal(h.ctx.selectedAtlas,f[1]);assert.equal(h.ctx.selectedImages.get(f[2].name),f[2]);});
