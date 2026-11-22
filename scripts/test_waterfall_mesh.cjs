#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs'),backend=process.argv[2]||'webgl2';
const repo=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:780,height:780},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const name of ['assets/template/vendor/pixi-8.22.0.min.js',
   'assets/template/src/curve-core.js','assets/template/src/spacing-core.js',
   'assets/template/src/path-core.js','assets/template/src/color-core.js',
   'assets/waterfall/src/waterfall-core.js',
   'assets/waterfall/src/waterfall-runtime.js'])
   await page.addScriptTag({path:path.join(repo,name)});
  const result=await page.evaluate(async requested=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,backgroundAlpha:0,resolution:1,
    preference:requested==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?
    'webgl2':'webgl1'):'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const settings=FxWaterfall.defaults(),
    fx=FxWaterfallRuntime.createWaterfall({PIXI,app,host,settings});
   const png=async()=>{
    app.render();
    const data=await app.renderer.extract.base64({target:app.stage,
     frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
    return Array.from(Uint8Array.from(atob(data.split(',')[1]),x=>x.charCodeAt(0)));
   };
   fx.seek(0);const initial=await png(),initialCreated=fx.totalCreated;
   fx.seek(.5);const middle=await png();
   fx.seek(59/60);const tail=await png();
   fx.seek(1);const seam=await png();
   for(let i=0;i<60;i++)fx.seek(i/60);
   const warmedCreated=fx.totalCreated;
   for(let i=0;i<90;i++)fx.seek((i%60)/60);
   const scrubCreated=fx.totalCreated;
   const bounds=fx.currentBounds();
   const disable=structuredClone(settings);
   for(const l of Object.values(disable.emitters[0].layers))l.enabled=false;
   fx.configure(disable);fx.seek(.5);const disabled=await png();
   const shutdown=structuredClone(settings);
   shutdown.mode='shutdown';shutdown.durationFrames=40;shutdown.exportFrames=40;
   fx.configure(shutdown);fx.seek(38/60);const dying=await png();
   fx.seek(39/60);const ended=await png();
   const panel=fx.emitters.get('emitter1').layers;
   const before=host.parent===app.stage;
   fx.destroy();const after=host.parent===app.stage;
   return {actual,initial,middle,tail,seam,disabled,dying,ended,bounds,
    initialCreated,warmedCreated,scrubCreated,modelPreserved:before&&after,
    hasNativeMesh:panel.streams.pool.every(x=>x.mesh instanceof PIXI.MeshSimple),
    hasParticleContainer:panel.fragments.particles instanceof PIXI.ParticleContainer,
    destroyed:fx.owned.destroyed};
  },backend);
  A.equal(result.actual,backend);
  const decode=x=>P.decodePng(Buffer.from(x)),pixels=x=>{
   const n=P.countAlpha(decode(x));return n.partial+n.opaque;
  },changed=(a,b)=>P.comparePixels(decode(a),decode(b),{
   step:1,channelTolerance:0}).changedPixels;
  A.ok(pixels(result.initial)>700,'waterfall invisible first frame');
  A.ok(pixels(result.middle)>700,'waterfall invisible mid');
  A.ok(pixels(result.tail)>700,'waterfall invisible tail');
  A.equal(changed(result.initial,result.seam),0,
   'loop not pixel-seamless t0/1');
  A.ok(changed(result.initial,result.middle)>120,
   'falling sheet is static / not animated');
  A.equal(pixels(result.disabled),0,'all layers off must be transparent');
  A.ok(pixels(result.dying)>20,'f38 shutdown should be fading');
  A.equal(pixels(result.ended),0,'f39 shutdown must be entirely empty');
  A.ok(result.initialCreated>=8);
  A.equal(result.scrubCreated,result.warmedCreated,
   'GPU pool allocations must be stable after a full 60-frame warmup');
  A.ok(result.bounds.inside);
  A.ok(result.hasNativeMesh&&result.hasParticleContainer&&
   result.modelPreserved&&result.destroyed);
  A.deepEqual(errors,[]);
  console.log('PASS WATER-04 REAL MESH '+backend,JSON.stringify({
   pixels:[pixels(result.initial),pixels(result.middle),
    pixels(result.tail),pixels(result.dying),pixels(result.ended)],
   seamDelta:changed(result.initial,result.seam),
   motionDelta:changed(result.initial,result.middle),
   created:result.initialCreated,warmed:result.warmedCreated,
   afterScrub:result.scrubCreated,
   bounds:result.bounds,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-04 MESH',e.stack||e);process.exitCode=1});
