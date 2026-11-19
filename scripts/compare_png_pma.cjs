#!/usr/bin/env node
// Compare actual original Spine burn/glow frames, not only synthetic fixtures.
// Usage: node compare_png_pma.cjs OLD_WEBGL_ZIP FIXED_WEBGL_ZIP
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {entries,decodeRgba} = require('./test_png_pma.cjs');
if (process.argv.length !== 4) { console.error('Usage: node compare_png_pma.cjs OLD_ZIP FIXED_ZIP'); process.exit(2); }
const oldZip = entries(fs.readFileSync(process.argv[2])), fixedZip = entries(fs.readFileSync(process.argv[3]));
let semitransparent = 0, brightened = 0, alphaChanged = 0, opaqueChanged = 0, incorrect = 0;
let maxAlphaDiff = 0, deltaRed = 0;
const frames = [...oldZip.keys()].filter(n => n.endsWith('.png'));
assert.ok(frames.length > 0);
for (const name of frames) {
  assert.ok(fixedZip.has(name), 'missing fixed frame ' + name);
  const a = decodeRgba(oldZip.get(name)), b = decodeRgba(fixedZip.get(name));
  assert.equal(a.width,b.width); assert.equal(a.height,b.height);
  for (let y=0;y<a.height;y++) for(let x=0;x<a.width;x++) {
    const old=a.rgba(x,y), fixed=b.rgba(x,y);
    if(old[3]!==fixed[3]) { alphaChanged++; maxAlphaDiff=Math.max(maxAlphaDiff,Math.abs(old[3]-fixed[3])); }
    if(old[3]===255 && old.some((c,i)=>i<3&&c!==fixed[i])) opaqueChanged++;
    if(old[3]>=32 && old[3]<=224){
      semitransparent++;
      const rgbOld=old[0]+old[1]+old[2], rgbFixed=fixed[0]+fixed[1]+fixed[2];
      if(rgbFixed>rgbOld+5)brightened++;
      if(rgbFixed+6<rgbOld)incorrect++;
      deltaRed+=fixed[0]-old[0];
    }
  }
}
console.log('REAL BURN/FLAME/HALO DIFFERENCE',JSON.stringify({
  frames:frames.length,semiAlpha32To224:semitransparent,brightened,alphaChanged,maxAlphaDiff,
  opaqueChanged,darkened:incorrect,meanRedGain:semitransparent?Number((deltaRed/semitransparent).toFixed(2)):0
}));
assert.equal(alphaChanged,0,'PMA-08 alpha must not change');
assert.equal(opaqueChanged,0,'PMA-08 opaque RGB must not change');
assert.ok(semitransparent>50,'PMA-08 must examine real partially transparent pixels');
assert.ok(brightened>0,'PMA-08 must demonstrate real burn/glow dark-RGB fix');
assert.equal(incorrect,0,'PMA-08 must not introduce systematic RGB darkening');
console.log('PASS PMA-08 real effect and alpha/opaque invariants');
