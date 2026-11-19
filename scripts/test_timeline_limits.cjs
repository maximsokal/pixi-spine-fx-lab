#!/usr/bin/env node
// FX-CORE-05 upper-bound real browser smoke; deliberately tiny GPU target.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{entries,decodeRgba}=require('./test_png_pma.cjs');
const arg=(n,v)=>{const i=process.argv.indexOf('--'+n);return i<0?v:process.argv[i+1]};
const html=arg('html'),backend=arg('backend','webgl'),output=path.resolve(arg('output','timeline-limit'));
if(!html)throw Error('--html required');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1200,height:850},offline:true,acceptDownloads:true});
 let network=0,downloads=0;const errors=[];
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 page.on('download',()=>downloads++);
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);await page.goto(url.href);
  await page.waitForFunction(()=>document.getElementById('loading').style.display==='none'&&document.getElementById('assetName').textContent.includes('Doctor'),null,{timeout:60000});
  const fill=async(id,v)=>{const el=page.locator('#'+id);await el.fill(String(v));await el.dispatchEvent('change')};
  await page.locator('#animPlay').uncheck();
  await fill('bakeWidth',4);await fill('bakeHeight',4);await fill('durationFrames',3600);await fill('bakeFrames',3600);
  await page.evaluate(()=>{setPlaying(false);cfg.sparks=0;syncUniforms()});
  const pending=page.waitForEvent('download',{timeout:240000});
  await page.locator('#bakeStart').click();
  const dl=await pending,file=path.join(output,backend+'-3600.zip');await dl.saveAs(file);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled,null,{timeout:180000});
  const zip=entries(fs.readFileSync(file));
  const images=[...zip.keys()].filter(f=>f.endsWith('.png'));
  assert.equal(images.length,3600);
  for(const i of [0,1,39,60,3598,3599]){
   const filename='frames/frame_'+String(i).padStart(5,'0')+'.png';
   assert.ok(zip.has(filename),filename);
   const image=decodeRgba(zip.get(filename));assert.equal(image.width,4);assert.equal(image.height,4);
  }
  const m=JSON.parse(zip.get('sequence.json'));
  assert.equal(m.frameCount,3600);assert.equal(m.fps,60);
  assert.ok(Math.abs(m.lastSampleSeconds-3599/60)<1e-12);
  assert.equal(m.timeline.schemaVersion,1);assert.equal(m.emitters.frames.length,3600);
  assert.equal(network,0);assert.deepEqual(errors,[]);assert.equal(downloads,1);
  console.log('PASS TIMELINE 3600 REAL PNG FRAMES',JSON.stringify({backend,
   frames:images.length,width:m.width,height:m.height,lastSampleSeconds:m.lastSampleSeconds,
   bytes:fs.statSync(file).size,renderer:m.renderer,offline:true}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
