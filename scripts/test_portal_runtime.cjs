'use strict';
const A=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const PNG=require('./fx_visual_png.cjs');
const repo=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2';
async function main(){
 A.ok(['webgl1','webgl2','webgpu'].includes(backend));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:['--enable-webgl'])]});
 try{
  const page=await browser.newPage({offline:true}),errors=[],net=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))net.push(r.url())});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of ['assets/template/vendor/pixi-8.22.0.min.js','assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/magic-portal/src/portal-core.js','assets/magic-portal/src/portal-runtime.js'])await page.addScriptTag({path:path.join(repo,f)});
  const r=await page.evaluate(async backend=>{
   const app=new PIXI.Application();await app.init({width:512,height:320,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   const host=new PIXI.Container();app.stage.addChild(host);
   const c=FxPortal.defaults();c.emitters[0].y=160;
   const fx=FxPortalRuntime.createPortal({PIXI,host,settings:c});
   async function png(t){fx.seek(t);app.render();const uri=await app.renderer.extract.base64({target:app.stage,frame:new PIXI.Rectangle(0,0,512,320),format:'png'});return Array.from(Uint8Array.from(atob(uri.split(',')[1]),x=>x.charCodeAt(0)));}
   const middle=await png(.4),repeat=await png(2.4),first=await png(0),last=await png(2);
   const n=fx.totalCreated;for(let i=0;i<120;i++)fx.seek(i/60);const warmed=fx.totalCreated;
   const only=k=>{const p=structuredClone(c);for(const [id,l] of Object.entries(p.emitters[0].layers))l.enabled=id===k;return p;};
   fx.configure(only('aperture'));const aperture=await png(.4),movedTime=await png(.8);
   const warped=only('aperture');warped.warp=0;fx.configure(warped);const flat=await png(.4);
   fx.configure(only('rim'));const rim=await png(.4);
   const wide=only('rim');wide.portalRadius=15;wide.rimWidth=70;fx.configure(wide);const wideRim=await png(.4);
   const moved=only('aperture');moved.emitters[0].layers.aperture.x=20;fx.configure(moved);const shifted=await png(.4);
   const red=only('aperture');red.glow=0;for(const stop of red.palette.stops)stop.rgba=[255,0,0,1];fx.configure(red);const redPixels=await png(.4);
   fx.configure(only('particles'));const particles=await png(.4);
   let refused=false;try{fx.configure({...c,portalRadius:NaN});}catch{refused=true}
   const after=await png(.4);
   fx.configure(only('none'));const off=await png(.4);
   const one=structuredClone(c);one.mode='oneShot';fx.configure(one);const start=await png(0),end=await png(119/60);
   const owned=fx.owned;fx.destroy();fx.destroy();let dead=false;try{fx.seek(0)}catch{dead=true}
   const preserved=!host.destroyed&&host.parent===app.stage;app.destroy();
   return {actual,middle,repeat,first,last,n,warmed,aperture,movedTime,flat,rim,wideRim,shifted,redPixels,particles,after,off,start,end,refused,dead,preserved,destroyed:owned.destroyed};
  },backend);
  A.equal(r.actual,backend);const dec=x=>PNG.decodePng(Buffer.from(x)),count=x=>{const a=PNG.countAlpha(dec(x));return a.partial+a.opaque;};
  const diff=(x,y)=>PNG.comparePixels(dec(x),dec(y),{step:1,channelTolerance:0}).changedPixels;
  for(const k of ['middle','aperture','rim','particles'])A.ok(count(r[k])>100,k+' not visible: '+count(r[k]));
  A.equal(diff(r.middle,r.repeat),0);A.equal(diff(r.first,r.last),0);A.ok(diff(r.aperture,r.movedTime)>100);A.ok(diff(r.aperture,r.flat)>100);
  for(const k of ['off','start','end'])A.equal(count(r[k]),0,k);
  A.ok(count(r.wideRim)>100);A.ok(diff(r.rim,r.wideRim)>100);
  function bounds(bytes){const q=dec(bytes);let x0=q.width,x1=-1,y0=q.height,y1=-1;for(let y=0;y<q.height;y++)for(let x=0;x<q.width;x++)if(q.pixels[(y*q.width+x)*4+3]>10){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return {x0,x1,y0,y1};}
  const a=bounds(r.aperture),b=bounds(r.shifted);A.ok(Math.abs((a.x1-a.x0)-(a.y1-a.y0))<=2);A.equal(b.x0-a.x0,20);A.equal(b.y0,a.y0);
  const red=dec(r.redPixels);let colored=0;for(let i=0;i<red.pixels.length;i+=4)if(red.pixels[i+3]>20){A.ok(red.pixels[i]>0&&red.pixels[i+1]===0&&red.pixels[i+2]===0);colored++}A.ok(colored>100);
  A.equal(diff(r.particles,r.after),0);A.equal(r.n,r.warmed);A.ok(r.refused&&r.dead&&r.preserved&&r.destroyed);A.deepEqual(errors,[]);A.deepEqual(net,[]);
  console.log('PASS GAME-06 native renderer',JSON.stringify({backend,aperture:count(r.aperture),rim:count(r.rim),particles:count(r.particles),allocated:r.n,offline:true}));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
