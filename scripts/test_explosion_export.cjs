#!/usr/bin/env node
'use strict';
// FIRE-02 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Explosion=require('../assets/fire-explosion/src/explosion-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_explosion_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.fire-explosion');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'FireExplosion.mjs')).href);
 assert.equal(typeof module.createExplosion,'function');
 assert.equal(module.FxExplosion.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxExplosion.sample(preset.settings,t),Explosion.sample(preset.settings,t));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.notDeepEqual(module.FxExplosion.sample(preset.settings,0),
   module.FxExplosion.sample(preset.settings,preset.settings.durationFrames/60));
 const loop={...preset.settings,loop:true};
 assert.deepEqual(module.FxExplosion.sample(loop,0),
   module.FxExplosion.sample(loop,loop.durationFrames/60));
 console.log('PASS Explosion exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
