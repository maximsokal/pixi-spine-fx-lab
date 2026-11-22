#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs'),backend=process.argv[2]||'webgl2',
 repo=path.resolve(__dirname,'..');
async function run(){
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:800,height:800},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const file of ['assets/template/vendor/pixi-8.22.0.min.js',
   'assets/template/src/curve-core.js','assets/template/src/spacing-core.js',
   'assets/template/src/color-core.js','assets/water-ripples/src/ripples-core.js',
   'assets/water-ripples/src/ripples-runtime.js'])
   await page.addScriptTag({path:path.join(repo,file)});
  const result=await page.evaluate(async b=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,
    preference:b==='webgpu'?'webgpu':'webgl',
    preferWebGLVersion:b==='webgl1'?1:2});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?
     'webgl2':'webgl1'):'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const cfg=FxRipples.defaults();
   const fx=FxRipplesRuntime.createRipples({PIXI,app,host,settings:cfg});
   const png=async()=>{
    app.render();const uri=await app.renderer.extract.base64({
     target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
    return Array.from(Uint8Array.from(atob(uri.split(',')[1]),x=>x.charCodeAt(0)));
   };
   fx.seek(0);const initial=await png();
   fx.seek(20/60);const middle=await png();
   fx.seek(38/60);const tail=await png();
   const allocated=fx.totalCreated;
   fx.seek(39/60);const end=await png();
   fx.seek(0);const restore=await png();
   for(let j=0;j<80;j++)fx.seek((j%40)/60);
   const warmed=fx.totalCreated;
   const off=structuredClone(cfg);
   for(const l of Object.values(off.emitters[0].layers))l.enabled=false;
   fx.configure(off);fx.seek(.2);const disabled=await png();
   const cycle=structuredClone(cfg);cycle.loop=true;
   fx.configure(cycle);
   fx.seek(0);const cycle0=await png();
   fx.seek(40/60);const cycleEnd=await png();
   const owns=fx.owned,liveHost=fx.sceneSource===host;
   fx.destroy();
   return {actual,initial,middle,tail,end,restore,disabled,
    cycle0,cycleEnd,allocated,warmed,
    destroyed:owns.destroyed,sourcePreserved:host.parent===app.stage&&liveHost,
    updates:fx.totalUpdates};
  },backend);
  A.equal(result.actual,backend);
  const dec=a=>P.decodePng(Buffer.from(a));
  const vis=a=>{const q=P.countAlpha(dec(a));return q.partial+q.opaque};
  const delta=(a,b)=>P.comparePixels(dec(a),dec(b),
   {step:1,channelTolerance:0}).changedPixels;
  A.ok(vis(result.initial)>10,'first ring not visible');
  A.ok(vis(result.middle)>300,'ripple does not expand');
  A.ok(vis(result.tail)>1,'f38 prematurely empty');
  A.equal(vis(result.end),0,'f39 should be fully transparent');
  A.equal(vis(result.disabled),0);
  A.equal(delta(result.initial,result.restore),0);
  A.equal(delta(result.cycle0,result.cycleEnd),0);
  A.equal(result.allocated,result.warmed,'mesh pool kept allocating per seek');
  A.ok(result.allocated>=3&&result.allocated<=12,'bounded meshes expected');
  A.ok(result.destroyed&&result.sourcePreserved);
  A.deepEqual(errors,[]);
  console.log('PASS WATER-03 native MeshSimple ellipses '+backend,
   JSON.stringify({visible:[vis(result.initial),vis(result.middle),
    vis(result.tail),vis(result.end)],meshCreated:result.allocated,
    meshCreatedAfterScrub:result.warmed,updates:result.updates,
    loopDelta:delta(result.cycle0,result.cycleEnd),errorCount:errors.length}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-03 MESH',e.stack||e);process.exitCode=1});
