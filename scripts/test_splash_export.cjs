#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Splash=require('../assets/water-splash/src/splash-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node scripts/test_splash_export.cjs EXTRACTED_ZIP_DIR');
async function run(){
 const root=path.resolve(__dirname,'..'),base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 A.equal(preset.effectId,'fx.water.water-splash');
 A.equal(preset.schemaVersion,1);
 A.equal(preset.compatibility.pixi,'8.22.0');
 A.equal(preset.compatibility.spine,'4.2.120');
 A.equal(preset.compatibility.vite,'7.1.12');
 const pack=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
 A.equal(pack.dependencies['pixi.js'],'8.22.0');
 A.equal(pack.dependencies['@esotericsoftware/spine-pixi-v8'],'4.2.120');
 A.equal(pack.devDependencies.vite,'7.1.12');
 for(const [file,original] of [
  ['FxSplash.mjs','assets/water-splash/src/splash-core.js'],
  ['WaterSplash.mjs','assets/water-splash/src/splash-runtime.js'],
  ['FxPath.mjs','assets/template/src/path-core.js'],
  ['FxSpacing.mjs','assets/template/src/spacing-core.js'],
  ['FxCurves.mjs','assets/template/src/curve-core.js'],
  ['FxColors.mjs','assets/template/src/color-core.js'],
  ['FxTimeline.mjs','assets/template/src/timeline-core.js']
 ]){
  const code=fs.readFileSync(path.join(base,file),'utf8');
  const source=fs.readFileSync(path.join(root,original),'utf8');
  A.ok(code.includes(source),'Developer ZIP has diverged source: '+file);
 }
 const mod=await import(pathToFileURL(path.join(base,'WaterSplash.mjs')).href);
 A.equal(typeof mod.createSplash,'function');
 A.equal(mod.FxSplash.VERSION,1);
 const c=preset.settings;
 A.equal(mod.FxSplash.sample(c,0).emitters[0].layers.droplets.length,24);
 for(const t of [0,.1,8/60,.35,32/60,39/60,40/60])
  A.deepEqual(mod.FxSplash.sample(c,t),Splash.sample(c,t),
   'Exported numerical implementation differs at '+t);
 const loop={...c,loop:true};
 A.deepEqual(mod.FxSplash.sample(loop,40/60),Splash.sample(loop,0));
 A.deepEqual(mod.FxSplash.schedule(c,c.emitters[0]),
   Splash.schedule(c,c.emitters[0]));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 A.equal(timeline.FxTimeline.FPS,60);
 console.log('PASS WATER-01 developer core ESM parity',path.basename(base),
  preset.rendererPreference,'pinned Pixi+Spine+Vite; 7 exact source modules');
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
