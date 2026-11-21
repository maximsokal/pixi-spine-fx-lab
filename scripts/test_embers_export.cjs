#!/usr/bin/env node
'use strict';
// FIRE-04 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Embers=require('../assets/embers-sparks/src/embers-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_embers_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.embers-sparks');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'EmbersSparks.mjs')).href);
 assert.equal(typeof module.createEmbers,'function');
 assert.equal(module.FxEmbers.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxEmbers.sample(preset.settings,t),Embers.sample(preset.settings,t));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.notDeepEqual(module.FxEmbers.sample(preset.settings,0),
   module.FxEmbers.sample(preset.settings,preset.settings.durationFrames/60));
 const loop={...preset.settings,loop:true};
 assert.deepEqual(module.FxEmbers.sample(loop,0),
   module.FxEmbers.sample(loop,loop.durationFrames/60));
 console.log('PASS Embers exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
