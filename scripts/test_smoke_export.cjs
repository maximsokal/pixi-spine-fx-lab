#!/usr/bin/env node
'use strict';
// FIRE-05 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Smoke=require('../assets/smoke-plume/src/smoke-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_smoke_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.smoke-plume');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'SmokePlume.mjs')).href);
 assert.equal(typeof module.createSmoke,'function');
 assert.equal(module.FxSmoke.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxSmoke.sample(preset.settings,t),Smoke.sample(preset.settings,t));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.deepEqual(module.FxSmoke.sample(preset.settings,0),
   module.FxSmoke.sample(preset.settings,preset.settings.durationFrames/60));
 const loop={...preset.settings,mode:'loop'};
 assert.deepEqual(module.FxSmoke.sample(loop,0),
   module.FxSmoke.sample(loop,loop.durationFrames/60));
 console.log('PASS Smoke exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
