#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 P=require('./fx_visual_png.cjs');
const base=path.resolve(process.argv[2]||require('node:os').tmpdir()+'/wind-qa/extracted');
for(const mode of ['burst','loop']){
 const directory=path.join(base,mode),
  manifest=JSON.parse(fs.readFileSync(path.join(directory,'sequence.json'),'utf8')),
  n=mode==='burst'?40:60;
 A.equal(manifest.schemaVersion,1);A.equal(manifest.effectId,'fx.air.wind-gust');
 A.equal(manifest.width,512);A.equal(manifest.height,512);
 A.equal(manifest.fps,60);A.equal(manifest.alpha,'straight-rgba8');
 A.equal(manifest.frameCount,n);A.equal(manifest.frames.length,n);
 A.equal(manifest.backend.actual,'webgl2');
 let visible=0,partial=0;
 for(let i=0;i<n;i++){
  const meta=manifest.frames[i],f='frames/'+String(i).padStart(4,'0')+'.png';
  A.equal(meta.frame,i);A.equal(meta.file,f);
  A.ok(Math.abs(meta.timeSeconds-i/60)<1e-10);
  const decoded=P.decodePng(fs.readFileSync(path.join(directory,f))),
   count=P.countAlpha(decoded);
  A.equal(decoded.width,512);A.equal(decoded.height,512);
  A.ok(count.transparent>150000,'background leak in '+mode+'/'+i);
  partial+=count.partial;
  if(count.partial+count.opaque>35)visible++;
  if(mode==='burst'&&(i===0||i===39))
   A.equal(count.partial+count.opaque,0,'burst alpha0 endpoint '+i);
 }
 A.ok(visible>(mode==='burst'?15:30),'missing visible storm phases: '+visible);
 A.ok(partial>2500,'lost translucent edge gradients '+mode);
 console.log('PASS AIR-01 independently decoded '+n+' RGBA8 PNGs',mode,
  'visibleFrames='+visible,'partialAlphaPixels='+partial);
}
