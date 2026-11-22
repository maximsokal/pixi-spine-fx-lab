#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs');
const root=path.resolve(__dirname,'..');
const backend=process.argv[2]||'webgl2';
async function run(){
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:800,height:800},offline:true});
 const errors=[],http=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))http.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of [
   'assets/template/vendor/pixi-8.22.0.min.js',
   'assets/template/src/curve-core.js',
   'assets/template/src/spacing-core.js',
   'assets/template/src/color-core.js',
   'assets/rainfall/src/rain-core.js',
   'assets/rainfall/src/rain-runtime.js'])
   await page.addScriptTag({path:path.join(root,f)});
  const result=await page.evaluate(async preferred=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,backgroundAlpha:0,resolution:1,
    preference:preferred==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:preferred==='webgl1'?1:2});
   document.body.append(app.canvas);
   const host=new PIXI.Container();app.stage.addChild(host);
   const cfg=FxRain.defaults();
   const fx=FxRainRuntime.createRain({PIXI,app,host,settings:cfg});
   const real=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?
    'webgl2':'webgl1'):'webgpu';
   async function png(){
    app.render();const uri=await app.renderer.extract.base64({
     target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
    return Array.from(Uint8Array.from(atob(uri.split(',')[1]),x=>x.charCodeAt(0)));
   }
   fx.seek(0);const at0=await png();
   const created=fx.totalCreated,owners=fx.owned.children.length;
   fx.seek(59/60);const at59=await png();
   fx.seek(1);const at1=await png();
   fx.seek(0);const at0again=await png();
   for(let k=0;k<40;k++)fx.seek(k/60);
   const steady=fx.totalCreated,active=fx.totalActive;
   const noDrops=structuredClone(cfg);
   noDrops.emitters[0].layers.drops.enabled=false;
   noDrops.emitters[0].layers.impacts.enabled=false;
   fx.configure(noDrops);fx.seek(.5);const disabled=await png();
   fx.configure(cfg);
   fx.seek(.5);const running=await png();
   const sourceStill=host.parent===app.stage;
   const wrapper=fx.owned;fx.destroy();
   return {real,at0,at59,at1,at0again,disabled,running,
    created,steady,active,owners,sourceStill,
    destroyed:wrapper.destroyed&&host.parent===app.stage};
  },backend);
  A.equal(result.real,backend);
  const decode=x=>P.decodePng(Buffer.from(x)),count=x=>{
   const c=P.countAlpha(decode(x));return c.partial+c.opaque};
  const delta=(a,b)=>P.comparePixels(decode(a),decode(b),
   {step:1,channelTolerance:0}).changedPixels;
  A.ok(count(result.at0)>500,'empty first frame breaks rain pre-roll');
  A.ok(count(result.at59)>500);
  A.equal(delta(result.at0,result.at1),0,'loop endpoint must be identical');
  A.equal(delta(result.at0,result.at0again),0);
  A.ok(delta(result.at0,result.at59)>50);
  A.equal(count(result.disabled),0);
  A.ok(count(result.running)>500);
  A.ok(result.created>40&&result.steady>40&&result.steady<1500,
   'bounded particle pool did not stabilize');
  A.equal(result.owners,1);
  A.ok(result.sourceStill&&result.destroyed);
  A.deepEqual(errors,[]);A.deepEqual(http,[]);
  console.log('PASS WATER-02 true ParticleContainer renderer',backend,JSON.stringify({
   visible0:count(result.at0),visible59:count(result.at59),
   at0same1:delta(result.at0,result.at1),created:result.created,
   steady:result.steady,active:result.active,sourcePreserved:result.sourceStill,
   destroyed:result.destroyed,externalRequests:http.length}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-02 PARTICLES',e.stack||e);process.exitCode=1});
