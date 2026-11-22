#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('./fx_visual_png.cjs');
const dir=path.resolve(process.argv[2]||'');
if(!dir)throw Error('Usage: node scripts/test_steam_png_zip.cjs EXTRACTED_DIR');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'sequence.json'),'utf8'));
A.equal(manifest.schemaVersion,1);A.equal(manifest.effectId,'fx.water.steam-jet');
A.equal(manifest.width,512);A.equal(manifest.height,512);A.equal(manifest.fps,60);
A.equal(manifest.count,60);A.equal(manifest.alpha,'straight-rgba8');
A.equal(manifest.frames.length,60);A.equal(manifest.backend.actual,'webgl2');
let partial=0,nonempty=0;
for(let frame=0;frame<60;frame++){
 const p=manifest.frames[frame],
  filename='frames/'+String(frame).padStart(4,'0')+'.png';
 A.equal(p.file,filename);A.equal(p.frame,frame);
 A.ok(Math.abs(p.timeSeconds-frame/60)<1e-12);
 const im=P.decodePng(fs.readFileSync(path.join(dir,filename))),
  count=P.countAlpha(im);
 A.equal(im.width,512);A.equal(im.height,512);
 A.ok(count.transparent>120000,'frame includes opaque background');
 A.ok(count.partial>100,'no soft vapor partial-alpha at '+frame);
 nonempty+=+(count.partial+count.opaque>100);
 partial+=count.partial;
}
A.equal(nonempty,60);
A.ok(partial>10000);
console.log('PASS WATER-06 every 60 PNG decoded (512x512 RGBA8) / partial alpha pixels='+partial);
