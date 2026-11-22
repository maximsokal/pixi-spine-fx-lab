#!/usr/bin/env node
'use strict';
// WATER-04 independent decode of EVERY baked frame; ZIP CRC is checked separately
// with Python stdlib zipfile.testzip() (never rely on filename count alone).
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_rain_png_zip.cjs EXTRACTED_ZIP_DIR');
const dir=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'sequence.json'),'utf8'));
A.equal(manifest.schemaVersion,1);
A.equal(manifest.effectId,'fx.water.waterfall');
A.equal(manifest.width,512);A.equal(manifest.height,512);
A.equal(manifest.fps,60);A.equal(manifest.frameCount,60);
A.equal(manifest.alpha,'straight-rgba8');
A.equal(manifest.frames.length,60);
A.equal(manifest.loopPolicy,'seamless-periodic-60');
let nonEmptyFrames=0,partialTotal=0;
for(let f=0;f<60;f++){
 const m=manifest.frames[f],name='frames/'+String(f).padStart(4,'0')+'.png';
 A.equal(m.file,name);A.equal(m.frame,f);A.ok(Math.abs(m.timeSeconds-f/60)<1e-12);
 const bytes=fs.readFileSync(path.join(dir,name));
 const im=P.decodePng(bytes);
 A.equal(im.width,512);A.equal(im.height,512);
 A.equal(im.pixels.length,512*512*4);
 const count=P.countAlpha(im),visible=count.partial+count.opaque;
 partialTotal+=count.partial;
 if(visible)nonEmptyFrames++;
 if(f===0||f===4||f===16||f===32)
  A.ok(visible>10,'Phase visible pixels missing frame'+f);
 if(f===59)A.ok(visible>100,'Last included frame must contain visible continuous rain');
 if(f>=0&&f<60)A.ok(count.transparent>100000,'Baked PNG unexpectedly includes non-transparent background');
}
A.ok(nonEmptyFrames===60);
A.ok(partialTotal>100);
console.log('PASS WATER-04 FULL 60 RGBA8 PNG decoded and time-indexed',{
 frameCount:manifest.frameCount,nonEmptyFrames,partialTotal,frame59VisiblePixels:'nonzero'});
