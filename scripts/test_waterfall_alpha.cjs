#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('./fx_visual_png.cjs');
const dir=process.argv[2]||path.join(process.env.TEMP||'.','fxlab_waterfall_webgl2');
const bytes=fs.readFileSync(path.join(dir,'frame30.png'));
const img=P.decodePng(bytes);
let count=0,minRed=255,minGreen=255,minBlue=255;
for(let i=0;i<img.pixels.length;i+=4){
 const q=img.pixels,a=q[i+3];
 if(a<48||a>=255)continue;
 count++;
 minRed=Math.min(minRed,q[i]);minGreen=Math.min(minGreen,q[i+1]);
 minBlue=Math.min(minBlue,q[i+2]);
}
A.ok(count>100,'Need real semitransparent waterfall pixels for PMA test');
A.ok(minRed>=12&&minGreen>=78&&minBlue>=115,
 'PNG must hold straight high RGB inside semitransparent rain, not PMA-dark fringes; observed '+JSON.stringify({minRed,minGreen,minBlue}));
console.log('PASS WATER-04 straight-alpha waterfall RGB',{count,minRed,minGreen,minBlue});
