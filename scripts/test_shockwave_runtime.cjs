#!/usr/bin/env node
'use strict';
// Actual pinned Pixi runtime, independent decoded PNG evidence; not an editor/export test.
const A=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs');
const repo=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2';
async function main(){
 A.ok(['webgl1','webgl2','webgpu'].includes(backend));
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:['--enable-webgl'])]});
 const page=await browser.newPage({offline:true});const errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of ['assets/template/vendor/pixi-8.22.0.min.js','assets/template/src/curve-core.js',
   'assets/template/src/color-core.js','assets/shockwave/src/shockwave-core.js','assets/shockwave/src/shockwave-runtime.js'])
   await page.addScriptTag({path:path.join(repo,f)});
  const result=await page.evaluate(async backend=>{
   const app=new PIXI.Application();
   await app.init({width:512,height:320,resolution:1,backgroundAlpha:0,autoStart:false,
    preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const cfg=FxShockwave.defaults();cfg.emitters[0].y=160;cfg.finalRadius=110;cfg.ringCount=2;
   cfg.emitters[0].layers.particles.enabled=true;
   const fx=FxShockwaveRuntime.createShockwave({PIXI,host,settings:cfg});
   async function png(t){fx.seek(t);app.render();
    const uri=await app.renderer.extract.base64({target:app.stage,frame:new PIXI.Rectangle(0,0,512,320),format:'png'});
    return Array.from(Uint8Array.from(atob(uri.split(',')[1]),x=>x.charCodeAt(0)));
   }
   const initial=await png(0),middle=await png(20/60),end=await png(39/60),repeat=await png(20/60);
   const allocated=fx.totalCreated;
   for(let i=0;i<80;i++)fx.seek((i%40)/60);
   const warmed=fx.totalCreated;
   const only=k=>{const c=structuredClone(cfg);for(const [id,l] of Object.entries(c.emitters[0].layers))l.enabled=id===k;return c;};
   const primary=only('primary');fx.configure(primary);const ring=await png(20/60);
   fx.configure(only('secondary'));const early=await png(4/60),secondary=await png(20/60);
   fx.configure(only('particles'));const particles=await png(20/60);
   const moved=structuredClone(primary);moved.emitters[0].rotation=90;moved.emitters[0].layers.primary.x=20;
   fx.configure(moved);const shifted=await png(20/60);
   const red=structuredClone(primary);for(const stop of red.palette.stops)stop.rgba=[255,0,0,1];
   fx.configure(red);const color=await png(20/60);
   let rejected=false;try{fx.configure({...red,finalRadius:NaN});}catch{rejected=true}
   const afterRefusal=await png(20/60);
   const disabled=structuredClone(cfg);for(const l of Object.values(disabled.emitters[0].layers))l.enabled=false;
   fx.configure(disabled);const off=await png(20/60);
   const owned=fx.owned;fx.destroy();fx.destroy();
   const sourcePreserved=host.parent===app.stage&&!host.destroyed;
   let dead=false;try{fx.seek(0)}catch{dead=true}
   return {actual,initial,middle,end,repeat,ring,early,secondary,particles,shifted,color,afterRefusal,off,
    allocated,warmed,rejected,sourcePreserved,dead,destroyed:owned.destroyed};
  },backend);
  A.equal(result.actual,backend);
  const dec=a=>P.decodePng(Buffer.from(a));
  const count=a=>{const q=P.countAlpha(dec(a));return q.partial+q.opaque};
  const delta=(a,b)=>P.comparePixels(dec(a),dec(b),{step:1,channelTolerance:0}).changedPixels;
  function bounds(a){const q=dec(a);let x0=q.width,y0=q.height,x1=-1,y1=-1;
   for(let y=0;y<q.height;y++)for(let x=0;x<q.width;x++)if(q.pixels[(y*q.width+x)*4+3]>10){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
   return {x0,x1,y0,y1};
  }
  A.ok(count(result.initial)>0);A.ok(count(result.middle)>200);A.equal(count(result.end),0);
  A.equal(delta(result.middle,result.repeat),0);A.equal(count(result.off),0);
  A.equal(count(result.early),0);A.ok(count(result.secondary)>100);A.ok(count(result.particles)>0);
  const b=bounds(result.ring),m=bounds(result.shifted);
  A.ok(Math.abs((b.x1-b.x0)-(b.y1-b.y0))<=2,'ring must remain circular in non-square target');
  A.ok(Math.abs(m.x0-b.x0)<=1&&Math.abs(m.y0-b.y0-20)<=1,'rotate local emitter offset');
  A.ok(delta(result.ring,result.color)>100,'palette must affect rendered pixels');
  A.equal(delta(result.color,result.afterRefusal),0);A.ok(result.rejected);
  A.equal(result.allocated,result.warmed,'no allocations after warmup');
  A.ok(result.dead&&result.destroyed&&result.sourcePreserved);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);
  console.log('PASS GAME-05 native renderer',JSON.stringify({backend,visible:[count(result.initial),count(result.middle),count(result.end)],particlePixels:count(result.particles),allocated:result.allocated,warmed:result.warmed,ringBounds:b,shiftedBounds:m,offline:true}));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
