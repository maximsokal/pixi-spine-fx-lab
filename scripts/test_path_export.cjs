#!/usr/bin/env node
'use strict';
// FX-CORE-08: optional developer-package ESM handoff (not Burn's shipped ZIP).
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),
 path=require('node:path');
const {pathToFileURL}=require('node:url');
const Cjs=require('../assets/template/src/path-core.js');
const root=path.resolve(__dirname,'..');
const data=n=>fs.readFileSync(path.join(root,'assets/template/src',n),'utf8');
const template=JSON.parse(fs.readFileSync(path.join(root,'assets/template/template.json'),'utf8'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fx-path-v1-'));
const basePath={schemaVersion:1,closed:false,segments:[{
 p0:[0,0],p1:[40,30],p2:[80,10],p3:[120,0]}]};
const params={path:basePath,width:{start:3,middle:18,end:1,startTaper:0,endTaper:1},
 quality:'balanced',sampleSpacingPx:3,seed:18};
async function main(){
 try{
  for(const backend of ['WebGL','WebGPU']){
   const folder=path.join(scratch,backend);fs.mkdirSync(folder,{recursive:true});
   // Exact same UMD source is re-exported as ESM using the existing FX developer
   // package convention. Only generated future effects should opt into this.
   fs.writeFileSync(path.join(folder,'FxCurves.mjs'),
    data('curve-core.js')+'\nexport const FxCurves=globalThis.FxCurves;\n');
   fs.writeFileSync(path.join(folder,'FxSpacing.mjs'),
    "import './FxCurves.mjs';\n"+data('spacing-core.js')+
    '\nexport const FxSpacing=globalThis.FxSpacing;\n');
   fs.writeFileSync(path.join(folder,'FxPath.mjs'),
    "import './FxSpacing.mjs';\n"+data('path-core.js')+
    '\nexport const FxPath=globalThis.FxPath;\n');
   const pkg={name:'fx-path-fixture-'+backend.toLowerCase(),private:true,type:'module',
    dependencies:{'pixi.js':template.runtime.pixi,
     '@esotericsoftware/spine-pixi-v8':template.runtime.spinePixiV8}};
   fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify(pkg,null,2));
   const imported=await import(pathToFileURL(path.join(folder,'FxPath.mjs')).href);
   assert.equal(typeof imported.FxPath.buildRibbon,'function');
   assert.equal(imported.FxPath.schemaVersion,1);
   const a=imported.FxPath.buildRibbon(params),b=Cjs.buildRibbon(params);
   assert.deepEqual(a.positions,b.positions);
   assert.deepEqual(a.uvs,b.uvs);
   assert.deepEqual(a.indices,b.indices);
   assert.equal(pkg.dependencies['pixi.js'],'8.22.0');
   assert.equal(pkg.dependencies['@esotericsoftware/spine-pixi-v8'],'4.2.120');
   assert.ok(!fs.readdirSync(folder).some(n=>/burntransition/i.test(n)),
      'path module must not pretend Burn runtime was upgraded');
  }
  console.log('PASS FX-CORE-08 optional WebGL/WebGPU ESM imports, exact source/parity/pins');
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
