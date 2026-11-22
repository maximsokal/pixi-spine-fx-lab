#!/usr/bin/env node
'use strict';
// Real Vite developer example water rain, not just package compilation or ESM import.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const port=Number(process.argv[2]),name=process.argv[3]||'WebGL';
if(!Number.isInteger(port)||port<1)throw Error('Usage: test_rain_developer.cjs port name');
const url='http://127.0.0.1:'+port+'/';
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',
   ...(process.env.FX_ENABLE_UNSAFE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[]),
   ...(process.env.FX_SOFTWARE_GPU==='1'?[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]
 });
 const page=await browser.newPage({viewport:{width:680,height:680}});
 const errors=[],logs=[],external=[],badResources=[];
 page.on('response',r=>{if(r.status()>=400)badResources.push({status:r.status(),url:r.url()})});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',c=>{if(c.type()==='error')errors.push(c.text());else logs.push(c.text())});
 page.on('request',r=>{
  if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'+port+'/'))
   external.push(r.url());
 });
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('canvas')?.width===512,null,{timeout:60000});
  await page.waitForTimeout(90);
  const before=decodePng(await page.locator('canvas').screenshot());
  assert.ok(countAlpha(before).opaque+countAlpha(before).partial>100,
   'Developer example draws no ripple pixels');
  await page.waitForTimeout(120);
  const after=decodePng(await page.locator('canvas').screenshot());
  assert.ok(comparePixels(before,after,{step:4,channelTolerance:2}).changedPixels>10,
    'Developer example should animate expanding rings');
  console.log('RESOURCE_DIAGNOSTICS',name,badResources,errors);
  assert.deepEqual(errors,[],'Developer example browser/runtime errors');
  assert.deepEqual(external,[],'Developer example contacted a remote host');
  assert.ok(logs.some(msg=>msg.includes('Water Ripples developer example ready')),
    'Developer example did not complete startup');
  const renderer=logs.find(msg=>msg.includes('Water Ripples developer example ready'))?.trim();
  const expectedType=name.toLowerCase()==='webgpu'?'2':'1';
  assert.ok(renderer?.endsWith(expectedType),
    'Developer actual renderer does not match '+name+': '+renderer);
  console.log('PASS WATER-03 DEVELOPER EXAMPLE '+name,
   JSON.stringify({url,canvas:{width:before.width,height:before.height},
     alpha:countAlpha(before),logs:logs.slice(-3),network:0}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
