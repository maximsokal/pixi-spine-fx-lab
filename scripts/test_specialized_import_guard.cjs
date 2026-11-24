'use strict';
// #53: exercise each actual loader preflight, stopping at atlas construction.
// The header reader is a test double, not a real Spine SKEL parser.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=process.env.IMPORT_GUARD_ROOT||path.resolve(__dirname,'..');
const editors=[['torch-flame','torch'],['rising-bubbles','bubbles'],['waterfall','waterfall']];
function harness(effect,editor){
 const file=fs.readFileSync(path.join(root,'assets',effect,'src',editor+'-editor.js'),'utf8');
 const start=file.indexOf(' function binaryVersion('),end=file.indexOf('\n  let newModel=null;',start);
 assert.ok(start>=0&&end>start,'loader preflight boundaries');
 const boundary=new Error('atlas allocation boundary');
 let allocations=0,atlasReads=0;
 const previous={model:{},asset:{},atlas:{},textures:[{}],playing:true,time:.5};
 class BinaryInput{
  constructor(bytes){this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);this.offset=0;}
  readInt32(){const n=this.view.getInt32(this.offset);this.offset+=4;return n;}
  readString(){const n=this.view.getUint8(this.offset++);if(n<2)return n===0?null:'';let s='';for(let i=1;i<n;i++)s+=String.fromCharCode(this.view.getUint8(this.offset++));return s;}
 }
 const ctx=vm.createContext({...previous,TextDecoder,Uint8Array,spine:{BinaryInput,TextureAtlas:class{constructor(){allocations++;throw boundary;}}}});
 vm.runInContext(file.slice(start,end)+'\n }',ctx);
 const load=(data,binary=false)=>ctx.loadSkeleton({skeletonName:binary?'fixture.skel':'fixture.json',skeleton:new Blob([data]),atlas:{text:async()=>{atlasReads++;return 'atlas';}}});
 const unchanged=()=>{for(const [key,value] of Object.entries(previous))assert.equal(ctx[key],value,key+' changed');};
 return {load,unchanged,boundary,counts:()=>[atlasReads,allocations]};
}
const json=version=>JSON.stringify({skeleton:{spine:version}});
function binary(version){const b=Buffer.from(version);return Uint8Array.from([0,0,0,0,0,0,0,0,b.length+1,...b]);}
for(const [effect,editor] of editors){
 for(const version of ['4.1.99','4.3.1','4.2.','4.2.invalid','4.2.4.5','4.2.01','4.2.43\n','4.2.43-beta',null]){
  test(effect+' rejects JSON '+JSON.stringify(version)+' before atlas read',async()=>{
   const h=harness(effect,editor);await assert.rejects(h.load(json(version)),/requires Spine 4\.2 export/);assert.deepEqual(h.counts(),[0,0]);h.unchanged();
  });
 }
 test(effect+' rejects invalid JSON and missing metadata before atlas read',async()=>{
  for(const data of ['{','null','{}']){const h=harness(effect,editor);await assert.rejects(h.load(data));assert.deepEqual(h.counts(),[0,0]);h.unchanged();}
 });
 for(const version of ['4.1.99','4.3.1','4.2.','4.2.invalid','4.2.01']){
  test(effect+' rejects SKEL header '+version+' before atlas read',async()=>{
   const h=harness(effect,editor);await assert.rejects(h.load(binary(version),true),/requires Spine 4\.2 export/);assert.deepEqual(h.counts(),[0,0]);h.unchanged();
  });
 }
 test(effect+' rejects truncated SKEL header',async()=>{
  for(const data of [new Uint8Array(0),new Uint8Array(7),binary('4.2.43').slice(0,-1)]){const h=harness(effect,editor);await assert.rejects(h.load(data,true));assert.deepEqual(h.counts(),[0,0]);h.unchanged();}
 });
 test(effect+' accepts matching JSON and SKEL headers at atlas boundary',async()=>{
  for(const version of ['4.2.0','4.2.43','4.2.120'])for(const isBinary of [false,true]){
   const h=harness(effect,editor);await assert.rejects(h.load(isBinary?binary(version):json(version),isBinary),e=>e===h.boundary);assert.deepEqual(h.counts(),[1,1]);h.unchanged();
  }
 });
}
