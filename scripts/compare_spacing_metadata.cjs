#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {entries}=require('./test_png_pma.cjs');
if(process.argv.length!==4)throw new Error('Usage: compare_spacing_metadata.cjs WEBGL_ZIP WEBGPU_ZIP');
const get=file=>JSON.parse(entries(fs.readFileSync(file)).get('sequence.json'));
const a=get(process.argv[2]),b=get(process.argv[3]);
assert.equal(a.spacing.enabled,true);assert.equal(b.spacing.enabled,true);
for(const key of ['mode','pathLengthPx','capped','eventTimesSeconds','eventAnchors',
    'actuallySpawned','spatialDistancesPx','coordinateSpace','emissionClock']){
 assert.deepEqual(a.spacing[key],b.spacing[key],key+' differs between backends');
}
const aCfg={...a.effectSettings},bCfg={...b.effectSettings};
// WebGL 1 requires the actual low quality profile; sampling is deliberately backend-neutral.
delete aCfg.quality;delete bCfg.quality;
assert.deepEqual(aCfg,bCfg,'Authoring settings (excluding selected GPU quality) must agree');
console.log('PASS FX-CORE-02 cross-backend event metadata',JSON.stringify({
 webgl:a.renderer,webgpu:b.renderer,scheduled:a.spacing.eventTimesSeconds.length,
 emitted:a.spacing.actuallySpawned.length,anchors:a.spacing.spatialDistancesPx.length}));
