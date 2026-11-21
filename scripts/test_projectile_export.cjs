#!/usr/bin/env node
'use strict';
// FIRE-03 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Projectile=require('../assets/fireball-projectile/src/projectile-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_projectile_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.fireball-projectile');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'FireballProjectile.mjs')).href);
 assert.equal(typeof module.createProjectile,'function');
 assert.equal(module.FxProjectile.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxProjectile.sample(preset.settings,t),Projectile.sample(preset.settings,t));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.notDeepEqual(module.FxProjectile.sample(preset.settings,0),
   module.FxProjectile.sample(preset.settings,preset.settings.durationFrames/60));
 const loop={...preset.settings,loop:true};
 assert.deepEqual(module.FxProjectile.sample(loop,0),
   module.FxProjectile.sample(loop,loop.durationFrames/60));
 console.log('PASS Projectile exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
