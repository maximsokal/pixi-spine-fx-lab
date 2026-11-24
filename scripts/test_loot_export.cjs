'use strict';
// Real offline PNG sequence acceptance. Run separately on each backend.
const A=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{pathToFileURL}=require('node:url'),P=require('./fx_visual_png.cjs');
function zip(b){const out=new Map();let at=0;while(b.readUInt32LE(at)===0x04034b50){const size=b.readUInt32LE(at+18),n=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28),name=b.subarray(at+30,at+30+n).toString(),data=at+30+n+extra;out.set(name,b.subarray(data,data+size));at=data+size;}return out;}
(async()=>{
 const backend=process.argv[3]||'webgl2',browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({offline:true}),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(process.argv[2]).href);await page.waitForFunction(()=>lootEditor.ready);
  await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>lootEditor.ready&&lootEditor.backend===b,backend);
  await page.evaluate(()=>lootEditor.seek(.25));const before=await page.evaluate(()=>({sample:lootEditor.sample,settings:lootEditor.settings}));
  const bake=()=>page.evaluate(async()=>{const r=await lootEditor.bakePng({download:false});return {zip:Array.from(r.zip),manifest:r.manifest}});
  const r=await bake(),files=zip(Buffer.from(r.zip));A.equal(r.manifest.backend,backend);A.equal(r.manifest.count,40);A.equal(files.size,41);
  const frame=i=>P.decodePng(files.get('frames/frame_'+String(i).padStart(5,'0')+'.png')),count=i=>{const q=P.countAlpha(frame(i));return q.partial+q.opaque};
  A.equal(frame(0).width,512);A.equal(frame(0).height,512);A.equal(count(0),0);A.ok(count(15)>0);A.equal(count(39),0);
  await page.evaluate(()=>lootEditor.zoom(.5));A.deepEqual((await bake()).zip,r.zip);
  A.deepEqual(await page.evaluate(()=>({sample:lootEditor.sample,settings:lootEditor.settings})),before);
  const cancelled=await page.evaluate(async()=>{const p=lootEditor.bakePng({download:false});lootEditor.cancelBake();try{await p;return false}catch(e){return /cancelled/.test(e.message)}});
  A.ok(cancelled);A.ok(await page.evaluate(()=>lootEditor.ready));
  const small=await page.evaluate(async()=>{const r=await lootEditor.bakePng({download:false,crop:{x:20,y:10,width:300,height:280},frameCount:2});return Array.from(r.zip)});
  const crop=P.decodePng(zip(Buffer.from(small)).get('frames/frame_00000.png'));A.equal(crop.width,300);A.equal(crop.height,280);
  A.deepEqual(await page.evaluate(()=>({sample:lootEditor.sample,settings:lootEditor.settings})),before);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS GAME-12 isolated PNG sequence',backend);
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
