#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('./fx_visual_png.cjs');
const dir=process.argv[2]||path.join(process.env.TEMP||'.','fxlab_splash_webgl2');
const bytes=fs.readFileSync(path.join(dir,'first-frame.png'));
const img=P.decodePng(bytes);
let count=0,minRed=255,minGreen=255,minBlue=255;
for(let i=0;i<img.pixels.length;i+=4){
 const q=img.pixels,a=q[i+3];
 if(a<48||a>=255)continue;
 count++;
 minRed=Math.min(minRed,q[i]);minGreen=Math.min(minGreen,q[i+1]);
 minBlue=Math.min(minBlue,q[i+2]);
}
A.ok(count>100,'Need enough real semitransparent pixels for PMA test');
A.ok(minRed>=175&&minGreen>=190&&minBlue>=190,
 'PNG must hold straight high RGB inside semitransparent water, not PMA-dark fringes; observed '+JSON.stringify({minRed,minGreen,minBlue}));
console.log('PASS WATER-01 straight-alpha watery RGB',{count,minRed,minGreen,minBlue});
