'use strict';
const test=require('node:test');
const A=require('node:assert/strict');
const {readSpine}=require('../assets/falling-leaves/src/leaves-spine.js');

// Deliberately stop at the atlas boundary. These are version preflight tests,
// not evidence of a successful real Spine binary parse or GPU render.
const invalid=['4.2.','4.2.invalid','4.2.01','4.2.1-rc1','4.2.1\n','4.3.0','3.8.99',42,null,undefined];
const valid=['4.2.0','4.2.22','4.2.120'];
function fixture(raw,version,binary=false){
 let atlasReads=0,headers=0;
 const source={skeletonName:binary?'sample.skel':'sample.json',skeleton:new Blob([binary?new Uint8Array(8):JSON.stringify(raw)]),atlas:{async text(){atlasReads++;throw Error('atlas boundary');}}};
 const spine={BinaryInput:class{readInt32(){headers++;return 0;}readString(){return version;}}};
 return {source,spine,get atlasReads(){return atlasReads;},get headers(){return headers;}};
}
for(const binary of [false,true]){
 for(const version of invalid)test(`${binary?'SKEL':'JSON'} rejects ${JSON.stringify(version)} before atlas`,async()=>{
  const f=fixture({skeleton:{spine:version}},version,binary);
  await A.rejects(()=>readSpine(f.source,{PIXI:{},spine:f.spine}),/requires Spine 4\.2/);
  A.equal(f.atlasReads,0);A.equal(f.headers,binary?2:0);
 });
 for(const version of valid)test(`${binary?'SKEL':'JSON'} allows ${version} to atlas boundary`,async()=>{
  const f=fixture({skeleton:{spine:version}},version,binary);
  await A.rejects(()=>readSpine(f.source,{PIXI:{},spine:f.spine}),/atlas boundary/);
  A.equal(f.atlasReads,1);A.equal(f.headers,binary?2:0);
 });
}
for(const raw of [null,{},[],{skeleton:null}])test(`JSON missing metadata: ${JSON.stringify(raw)}`,async()=>{
 const f=fixture(raw,undefined);await A.rejects(()=>readSpine(f.source,{PIXI:{},spine:f.spine}),/requires Spine 4\.2/);A.equal(f.atlasReads,0);
});
