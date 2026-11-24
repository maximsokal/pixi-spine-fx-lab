#!/usr/bin/env node
'use strict';
// Real pinned Pixi backend/PNG contract. Run independently for webgl1/webgl2/webgpu.
const A=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),P=require('./fx_visual_png.cjs');
const repo=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2';
(async()=>{
 A.ok(['webgl1','webgl2','webgpu'].includes(backend));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:['--enable-webgl'])]});
 try{
  const page=await browser.newPage({offline:true}),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of ['assets/template/vendor/pixi-8.22.0.min.js','assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/loot-sparkle/src/loot-core.js','assets/loot-sparkle/src/loot-runtime.js'])await page.addScriptTag({path:path.join(repo,f)});
  const r=await page.evaluate(async backend=>{
   const app=new PIXI.Application();await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   const host=new PIXI.Container(),source=new PIXI.Container();app.stage.addChild(host);host.addChild(source);
   const c=FxLoot.defaults(),fx=FxLootRuntime.createLoot({PIXI,host,settings:c});
   async function png(t){fx.seek(t);app.render();const uri=await app.renderer.extract.base64({target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'});return Array.from(Uint8Array.from(atob(uri.split(',')[1]),x=>x.charCodeAt(0)));}
   const first=await png(0),middle=await png(.25),end=await png(39/60),repeat=await png(.25),n=fx.totalCreated;
   for(let i=0;i<100;i++)fx.seek((i%40)/60);const stable=n===fx.totalCreated;
   const only=k=>{const d=structuredClone(c);for(const [name,l] of Object.entries(d.emitters[0].layers))l.enabled=name===k;return d;};
   fx.configure(only('halo'));const halo=await png(.25);fx.configure(only('sweep'));const sweep=await png(.25);
   const moved=only('stars');moved.emitters[0].x+=30;fx.configure(moved);const shifted=await png(.25);
   const red=only('stars');for(const s of red.palette.stops)s.rgba=[255,0,0,1];fx.configure(red);const recolor=await png(.25);
   let rejected=false;try{fx.configure({...red,sparkleSize:NaN});}catch{rejected=true}const after=await png(.25);
   const idle=structuredClone(c);idle.mode='idle';idle.durationFrames=60;fx.configure(idle);const loop0=await png(0),loop1=await png(1);
   fx.configure(only('none'));const off=await png(.25);const owned=fx.owned;fx.destroy();fx.destroy();
   const preserved=owned.destroyed&&!host.destroyed&&!source.destroyed&&host.children.length===1&&host.children[0]===source;
   app.destroy(true,{children:true});return {actual,first,middle,end,repeat,halo,sweep,shifted,recolor,after,loop0,loop1,off,stable,rejected,preserved};
  },backend);
  const dec=a=>P.decodePng(Buffer.from(a)),count=a=>{const q=P.countAlpha(dec(a));return q.partial+q.opaque;},delta=(a,b)=>P.comparePixels(dec(a),dec(b),{step:1,channelTolerance:0}).changedPixels;
  A.equal(r.actual,backend);for(const k of ['first','end','off'])A.equal(count(r[k]),0,k);for(const k of ['middle','halo','sweep','loop0'])A.ok(count(r[k])>0,k);
  A.equal(delta(r.middle,r.repeat),0);A.equal(delta(r.loop0,r.loop1),0);A.equal(delta(r.recolor,r.after),0);A.ok(delta(r.middle,r.shifted)>0);A.ok(delta(r.middle,r.recolor)>0);A.ok(r.stable&&r.rejected&&r.preserved);A.deepEqual(errors,[]);A.deepEqual(network,[]);
  console.log('PASS GAME-12 native renderer',JSON.stringify({backend,starPixels:count(r.middle),haloPixels:count(r.halo),sweepPixels:count(r.sweep),offline:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
