'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const get=()=>require('./compatibility-profile.cjs');
const manifest=()=>({runtime:{pixi:'8.22.0',spinePixiV8:'4.2.120',spineExport:'4.2.x'},protectedFiles:Object.fromEntries(['vendor/pixi-8.22.0.min.js','vendor/spine-pixi-v8-4.2.120.min.js','licenses/pixi.txt','licenses/spine.txt'].map(p=>[p,'a'.repeat(64)]))});
const request=()=>({pixi:8,spine:'4.2',renderer:'webgl2',pixiVersion:'8.22.0',spineVersion:'4.2.120'});
test('all 24 catalog pairs select exactly two version guides and truthful status',()=>{
 const {route}=get(),counts={};
 for(const pixi of [5,6,7,8])for(const spine of ['3.7','3.8','4.0','4.1','4.2','4.3']){
  const p=route({pixi,spine});assert.equal(p.docs.pixi,`references/compatibility/pixi/${pixi}.md`);assert.equal(p.docs.spine,`references/compatibility/spine/${spine}.md`);
  counts[p.status]=(counts[p.status]||0)+1;assert.equal(p.canResolve,pixi===8&&spine==='4.2');
  assert.equal(Boolean(p.docs.legacy),p.status==='research');
 }
 assert.deepEqual(counts,{research:12,unsupported:8,unverified:3,baseline:1});
});
test('unsupported identifiers and WebGPU on legacy Pixi fail closed',()=>{
 const {route}=get();for(const r of [{pixi:9,spine:'4.2'},{pixi:8,spine:'4.2.43'},{pixi:8,spine:'../4.2'},{pixi:'8',spine:'4.2'},{pixi:7,spine:'4.2',renderer:'webgpu'},{pixi:8,spine:'4.2',renderer:'canvas'}])assert.throws(()=>route(r),/COMPAT/);
});
test('only exact shipped pair resolves; no fallback for alternate patch or runtime',()=>{
 const {resolveProfile}=get(),r=request(),p=resolveProfile(r,manifest());
 assert.equal(p.pixi.exactVersion,'8.22.0');assert.equal(p.spine.package,'@esotericsoftware/spine-pixi-v8');assert.equal(p.spine.exactVersion,'4.2.120');assert.equal(p.validation.status,'baseline-only');assert.equal(p.validation.backendActual,null);
 for(const bad of [{pixiVersion:'8.22.1'},{spineVersion:'4.2.121'},{spine:'4.3'},{pixi:7},{pixiVersion:undefined},{renderer:undefined}])assert.throws(()=>resolveProfile({...r,...bad},manifest()),/COMPAT/);
});
test('manifest pin or missing integrity/notice metadata blocks resolution',()=>{
 const {resolveProfile}=get();for(const change of [m=>m.runtime.pixi='8.22.1',m=>delete m.protectedFiles['licenses/spine.txt'],m=>m.protectedFiles['vendor/pixi-8.22.0.min.js']='invalid']){const m=manifest();change(m);assert.throws(()=>resolveProfile(request(),m),/COMPAT/);}
});
test('inspect real JSON metadata and reject mismatches, malformed and binary inputs',()=>{
 const {inspectExport,assertExport}=get();assert.deepEqual(inspectExport({skeleton:{spine:'4.2.43'}}),{version:'4.2.43',majorMinor:'4.2',format:'json'});
 assert.equal(assertExport('{"skeleton":{"spine":"4.2.43"}}','4.2').majorMinor,'4.2');
 for(const v of [{skeleton:{spine:'4.3.1'}},{skeleton:{spine:'4.2'}},{skeleton:{spine:'4.02.1'}},{spine:'4.2.43'},Buffer.from([1,2,3]),'bad'])assert.throws(()=>assertExport(v,'4.2'),/COMPAT/);
});
test('profile copies manifest integrity and never certifies unmeasured backend',()=>{
 const {resolveProfile}=get(),m=manifest();for(const renderer of ['webgl','webgl1','webgl2','webgpu']){const p=resolveProfile({...request(),renderer},m);assert.equal(p.pixi.renderer,renderer);assert.equal(p.validation.backendActual,null);assert.equal(p.validation.currentRun,'NOT_RUN');assert.equal(p.integrity.status,'declared-not-rehashed');assert.notEqual(p.integrity.files,m.protectedFiles);}
});
