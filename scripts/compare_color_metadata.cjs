#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),Colors=require('../assets/template/src/color-core.js');
const {entries}=require('./test_png_pma.cjs');
if(process.argv.length<4)throw Error('Usage: compare_color_metadata.cjs REFERENCE_ZIP OTHER_ZIP [OTHER_ZIP]');
const read=file=>JSON.parse(entries(fs.readFileSync(file)).get('sequence.json')).effectSettings;
const baseline=read(process.argv[2]);
for(const file of process.argv.slice(3)){
 const next=read(file);
 for(const key of ['fireGradientEnabled','fireGradient','sparkLifetime','sparkBlend','sparkColor','fireColor','hotColor','multiEmitters']){
  assert.deepEqual(next[key],baseline[key],'color authoring difference '+key+' in '+file);
 }
 for(const x of [0,.15,.25,.37,.5,.8,1]){
  assert.deepEqual(Colors.sample(next.fireGradient,x),Colors.sample(baseline.fireGradient,x),
   'backend-dependent color evaluator at '+x);
 }
}
console.log('PASS FX-CORE-04 cross-backend gradient, lifetime, pixel-independent numerical settings',process.argv.length-3);
