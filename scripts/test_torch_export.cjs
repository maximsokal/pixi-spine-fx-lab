#!/usr/bin/env node
'use strict';
// FIRE-01 developer ESM import parity for both ZIPs after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const Torch=require('../assets/torch-flame/src/torch-core.js');
const dir=process.argv[2];
if(!dir)throw Error('Usage: node test_torch_export.cjs ZIP_EXTRACT_DIR');
async function test(){
 const base=path.resolve(dir);
 const preset=JSON.parse(fs.readFileSync(path.join(base,'preset.json'),'utf8'));
 assert.equal(preset.effectId,'fx.fire.torch-flame');
 assert.equal(preset.schemaVersion,1);
 const module=await import(pathToFileURL(path.join(base,'TorchFlame.mjs')).href);
 assert.equal(typeof module.createTorch,'function');
 assert.equal(module.FxTorch.VERSION,1);
 const t=.25;
 assert.deepEqual(module.FxTorch.sample(preset.settings,t),Torch.sample(preset.settings,t));
 const timeline=await import(pathToFileURL(path.join(base,'FxTimeline.mjs')).href);
 assert.equal(timeline.FxTimeline.FPS,60);
 assert.deepEqual(module.FxTorch.sample(preset.settings,0),
   module.FxTorch.sample(preset.settings,preset.settings.cycleFrames/60));
 console.log('PASS Torch exported ESM source parity, pinned schema, deterministic cycle and runtime factory',base);
}
test().catch(e=>{console.error(e);process.exitCode=1});
