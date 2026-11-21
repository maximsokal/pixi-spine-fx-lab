#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs');
const root=path.resolve(__dirname,'..');
const preference=process.argv[2]||'webgl2';
const files=[
 'assets/template/vendor/pixi-8.22.0.min.js',
 'assets/template/src/curve-core.js',
 'assets/template/src/spacing-core.js',
 'assets/template/src/path-core.js',
 'assets/template/src/color-core.js',
 'assets/water-splash/src/splash-core.js',
 'assets/water-splash/src/splash-runtime.js'
];
async function run(){
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(preference==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:610,height:650},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(require('node:url').pathToFileURL(
    path.join(root,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of files)await page.addScriptTag({path:path.join(root,f)});
  const data=await page.evaluate(async pref=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,backgroundAlpha:0,resolution:1,
    preference:pref==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:pref==='webgl1'?1:2});
   document.body.appendChild(app.canvas);
   const host=new PIXI.Container();app.stage.addChild(host);
   const cfg=FxSplash.defaults();
   const fx=FxSplashRuntime.createSplash({PIXI,app,host,settings:cfg});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?
    'webgl2':'webgl1'):'webgpu';
   const png=async()=>Array.from(Uint8Array.from(atob(
    (await app.renderer.extract.base64({target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'})).split(',')[1]),
    ch=>ch.charCodeAt(0)));
   fx.seek(8/60);app.render();const on=await png();
   const originalCount=fx.owned.children.length;
   const noCrown=structuredClone(cfg);noCrown.emitters[0].layers.crown.enabled=false;
   fx.configure(noCrown);fx.seek(8/60);app.render();const noCrownPng=await png();
   fx.configure(cfg);fx.seek(39/60);app.render();const last=await png();
   fx.seek(8/60);app.render();const again=await png();
   const empty=structuredClone(cfg);
   for(const layer of FxSplash.LAYERS)empty.emitters[0].layers[layer].enabled=false;
   fx.configure(empty);fx.seek(8/60);app.render();const disabled=await png();
   const parent=host.parent===app.stage;
   const disposeTest=fx.owned;
   fx.destroy();
   const gone=disposeTest.destroyed&&host.parent===app.stage;
   return {actual,on,noCrownPng,last,again,disabled,originalCount,parent,gone};
  },preference);
  assert.equal(data.actual,preference);
  const decode=b=>P.decodePng(Buffer.from(b));
  const on=decode(data.on),noCrown=decode(data.noCrownPng),
   last=decode(data.last),again=decode(data.again),disabled=decode(data.disabled);
  const delta=(a,b)=>P.comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
  assert.ok(delta(on,noCrown)>40);
  assert.equal(delta(on,again),0);
  assert.equal(P.countAlpha(last).opaque+P.countAlpha(last).partial,0);
  assert.equal(P.countAlpha(disabled).opaque+P.countAlpha(disabled).partial,0);
  assert.ok(data.originalCount>0&&data.parent&&data.gone);
  assert.deepEqual(errors,[]);
  console.log('PASS WATER-01 RUNTIME',preference,JSON.stringify({
   crownPixels:delta(on,noCrown),visible:P.countAlpha(on).partial+P.countAlpha(on).opaque,
   lastAlpha:0,sourcePreserved:data.parent,destroyed:data.gone}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-01 RUNTIME',e.stack||e);process.exitCode=1});
