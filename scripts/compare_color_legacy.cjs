#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {entries,decodeRgba}=require('./test_png_pma.cjs');
if(process.argv.length!==4)throw Error('Usage: compare_color_legacy.cjs BASELINE_ZIP NEW_ZIP');
const old=entries(fs.readFileSync(process.argv[2])),updated=entries(fs.readFileSync(process.argv[3]));
const frames=[...old.keys()].filter(n=>n.endsWith('.png')).sort();
assert.equal(frames.length,6,'expected 6 legacy smoke frames');
let pixels=0,diffs=0,maxRgbDelta=0,alphaDiffs=0,largeDelta=0;
for(const frame of frames){
 assert.ok(updated.has(frame),frame+' missing');
 const a=decodeRgba(old.get(frame)),b=decodeRgba(updated.get(frame));
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const one=a.rgba(x,y),two=b.rgba(x,y);pixels++;
  if(one.some((v,i)=>v!==two[i]))diffs++;
  if(one[3]!==two[3])alphaDiffs++;
  for(let c=0;c<3;c++){
    const difference=Math.abs(one[c]-two[c]);
    maxRgbDelta=Math.max(maxRgbDelta,difference);
    if(difference>2)largeDelta++;
  }
 }
}
assert.equal(alphaDiffs,0,'opt-in color feature changed legacy alpha');
assert.equal(largeDelta,0,'opt-in feature changed legacy RGB by more than 2 byte values');
assert.ok(diffs/pixels<.01,'too many legacy PNG pixels changed');
console.log('PASS FX-CORE-04 disabled-compat PNG',JSON.stringify({frames:6,pixels,diffs,
 share:diffs/pixels,alphaDiffs,maxRgbDelta}));
