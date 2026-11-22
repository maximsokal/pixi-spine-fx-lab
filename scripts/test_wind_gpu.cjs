#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const mode=process.argv[2]||'webgl2',root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(mode==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:700,height:700},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'scripts/fixtures/splash-runtime.html')).href);
  for(const file of ['assets/template/vendor/pixi-8.22.0.min.js',
   'assets/template/src/curve-core.js','assets/template/src/spacing-core.js',
   'assets/template/src/path-core.js','assets/template/src/color-core.js',
   'assets/wind-gust/src/wind-core.js','assets/wind-gust/src/wind-runtime.js'])
   await page.addScriptTag({path:path.join(root,file)});
  const result=await page.evaluate(async requested=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,
    preference:requested==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=app.renderer.gl?
    app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1':'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const cfg=FxWind.defaults();
   const fx=FxWindRuntime.createWind({PIXI,app,host,settings:cfg});
   const png=async()=>{app.render();const str=await app.renderer.extract.base64({
     target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
    return Array.from(Uint8Array.from(atob(str.split(',')[1]),x=>x.charCodeAt(0)))};
   fx.seek(0);const initial=await png();
   fx.seek(20/60);const peak=await png();
   fx.seek(39/60);const ending=await png();
   const loop=structuredClone(cfg);loop.mode='loop';
   loop.durationFrames=60;loop.exportFrames=60;fx.configure(loop);
   fx.seek(0);const start=await png();
   fx.seek(.5);const half=await png();
   fx.seek(1);const seam=await png();
   const rotated=structuredClone(loop);rotated.windDirection=90;
   fx.configure(rotated);fx.seek(.5);const rotatedPng=await png();
   const disabled=structuredClone(loop);
   for(const layer of Object.values(disabled.emitters[0].layers))layer.enabled=false;
   fx.configure(disabled);fx.seek(.5);const absent=await png();
   fx.configure(loop);
   for(let i=0;i<90;i++)fx.seek(i/60);
   const warm=fx.totalCreated;
   for(let i=0;i<120;i++)fx.seek(i%60/60);
   const after=fx.totalCreated;
   const owner=fx.emitters.get('emitter1');
   const native=owner.layers.streaks.pool.every(x=>x.mesh instanceof PIXI.MeshSimple)&&
    owner.layers.dust.particles instanceof PIXI.ParticleContainer;
   const out={actual,initial,peak,ending,start,half,seam,rotatedPng,absent,
    warm,after,native,inside:fx.currentBounds().inside,
    preserved:host.parent===app.stage};
   fx.destroy();fx.destroy();out.destroyed=fx.owned.destroyed;
   app.destroy(true);return out;
  },mode);
  const img=b=>P.decodePng(Buffer.from(b)),count=b=>{
   const c=P.countAlpha(img(b));return c.partial+c.opaque};
  const diff=(a,b)=>P.comparePixels(img(a),img(b),{step:1,channelTolerance:0}).changedPixels;
  A.equal(result.actual,mode,'requested renderer fallback');
  A.equal(count(result.initial),0,'burst frame0 must be transparent');
  A.ok(count(result.peak)>100,'peak gust missing');
  A.equal(count(result.ending),0,'burst f39 alpha should be zero');
  A.equal(diff(result.start,result.seam),0,'60f seam must be identical');
  A.ok(count(result.half)>100);
  A.ok(diff(result.start,result.half)>100,'loop frozen');
  A.ok(diff(result.rotatedPng,result.half)>100,'direction inert');
  A.equal(count(result.absent),0,'disabled layers still draw');
  A.ok(result.native,'must use native MeshSimple and ParticleContainer');
  A.equal(result.warm,result.after,'GPU pool allocations after warmup');
  A.ok(result.inside,'default gust exceeds 512 crop');
  A.ok(result.preserved&&result.destroyed,'owner destroys caller');
  A.deepEqual(errors,[]);
  console.log('PASS AIR-01 real '+mode,JSON.stringify({
   burstPixels:count(result.peak),seam:diff(result.start,result.seam),
   rotationPixels:diff(result.rotatedPng,result.half),pool:result.after}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 GPU '+mode,e.stack||e);process.exitCode=1});
