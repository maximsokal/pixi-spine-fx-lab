#!/usr/bin/env node
'use strict';
// FIRE-06 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Haze=require('../assets/heat-haze/src/haze-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_haze_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.heat-haze');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'HeatHaze.mjs')).href);
 assert.equal(typeof module.createHaze,'function');
 assert.equal(module.FxHaze.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxHaze.sampleAt(module.FxHaze.prepare(preset.settings,t),256,310),Haze.sampleAt(Haze.prepare(preset.settings,t),256,310));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.deepEqual(module.FxHaze.sampleAt(module.FxHaze.prepare(preset.settings,0),256,310),
   module.FxHaze.sampleAt(module.FxHaze.prepare(preset.settings,preset.settings.durationFrames/60),256,310));
 const loop={...preset.settings,mode:'loop'};
 assert.deepEqual(module.FxHaze.sampleAt(module.FxHaze.prepare(loop,0),256,310),
   module.FxHaze.sampleAt(module.FxHaze.prepare(loop,loop.durationFrames/60),256,310));
 console.log('PASS Haze exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
