#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const backend=process.argv[2]||'webgl2',repo=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:750,height:750},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const name of ['assets/template/vendor/pixi-8.22.0.min.js',
   'assets/template/src/curve-core.js','assets/template/src/spacing-core.js',
   'assets/template/src/color-core.js','assets/rising-bubbles/src/bubbles-core.js',
   'assets/rising-bubbles/src/bubbles-runtime.js'])
   await page.addScriptTag({path:path.join(repo,name)});
  const result=await page.evaluate(async requested=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,backgroundAlpha:0,resolution:1,
    preference:requested==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=app.renderer.gl?
    app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1':'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const defaults=FxBubbles.defaults(),fx=FxBubblesRuntime.createBubbles({PIXI,app,host,settings:defaults});
   const png=async()=>{app.render();
    const data=await app.renderer.extract.base64({target:app.stage,
     frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
    return Array.from(Uint8Array.from(atob(data.split(',')[1]),x=>x.charCodeAt(0)));
   };
   fx.seek(0);const start=await png();
   fx.seek(.5);const middle=await png();
   fx.seek(59/60);const tail=await png();
   fx.seek(1);const seam=await png();
   const allOff=structuredClone(defaults);
   for(const l of Object.values(allOff.emitters[0].layers))l.enabled=false;
   fx.configure(allOff);fx.seek(.25);const disabled=await png();
   const shutdown=structuredClone(defaults);
   shutdown.mode='shutdown';shutdown.durationFrames=40;shutdown.exportFrames=40;
   fx.configure(shutdown);fx.seek(38/60);const dying=await png();
   fx.seek(39/60);const ended=await png();
   fx.configure(defaults);for(let i=0;i<60;i++)fx.seek(i/60);
   const warm=fx.totalCreated;
   for(let i=0;i<90;i++)fx.seek(i%60/60);
   const after=fx.totalCreated;
   const a=fx.emitters.get('emitter1');
   const native=FxBubbles.LAYERS.every(kind=>
    a.layers[kind].particles instanceof PIXI.ParticleContainer);
   const bounds=fx.currentBounds();
   const preserved=host.parent===app.stage;fx.destroy();
   return {actual,start,middle,tail,seam,disabled,dying,ended,warm,after,
    native,bounds,preserved,destroyed:fx.owned.destroyed};
  },backend);
  A.equal(result.actual,backend,'actual backend mismatch');
  const dec=x=>P.decodePng(Buffer.from(x)),pixels=x=>{
   const q=P.countAlpha(dec(x));return q.partial+q.opaque};
  const delta=(a,b)=>P.comparePixels(dec(a),dec(b),{step:1,channelTolerance:0}).changedPixels;
  A.ok(pixels(result.start)>100,'not visible at start');
  A.ok(pixels(result.middle)>100,'not visible midway');
  A.ok(pixels(result.tail)>100,'not visible on f59');
  A.equal(delta(result.start,result.seam),0,'not seamless at f0 and f60');
  A.ok(delta(result.start,result.middle)>100,'moving bubbles appear frozen');
  A.equal(pixels(result.disabled),0,'all off must be transparent');
  A.ok(pixels(result.dying)>0,'frame38 should retain some bubbles');
  A.equal(pixels(result.ended),0,'frame39 must be all transparent');
  A.equal(result.after,result.warm,'pool allocated after 60f warm-up');
  A.ok(result.native&&result.preserved&&result.destroyed);
  A.ok(result.bounds.inside,'default viewport exceeds authored bounds');
  A.deepEqual(errors,[]);
  console.log('PASS WATER-05 REAL PARTICLES',backend,JSON.stringify({
   pixels:[pixels(result.start),pixels(result.middle),pixels(result.tail)],
   changed:delta(result.start,result.middle),seam:delta(result.start,result.seam),
   pool:result.after,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-05 PARTICLES',e.stack||e);process.exitCode=1});
