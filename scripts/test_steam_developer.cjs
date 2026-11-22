#!/usr/bin/env node
'use strict';
// Launch the actual exported Vite developer project and inspect real GPU pixels.
const A=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),
 {spawn,execFileSync}=require('node:child_process'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const backend=process.argv[2]||'webgl',port=backend==='webgpu'?5367:5366;
const dir=path.join(os.tmpdir(),'steam-qa','extracted',backend);
async function verify(){
 const args=['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'];
 const server=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{
  cwd:dir,windowsHide:true,shell:process.platform==='win32',
  stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:720,height:720}});
 const errors=[],logs=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else logs.push(m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'+port+'/'))external.push(r.url())});
 try{
  let started=false;
  for(let retry=0;retry<45&&!started;retry++){
   try{const resp=await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:1400});
    started=resp?.status()===200;
   }catch{await new Promise(r=>setTimeout(r,250))}
  }
  A.ok(started,'Vite developer server unavailable: '+output.slice(-3000));
  await page.waitForFunction(()=>document.querySelector('canvas')?.width===512,null,{timeout:25000});
  await page.waitForTimeout(150);
  const before=P.decodePng(await page.locator('canvas').screenshot());
  A.ok(P.countAlpha(before).partial+P.countAlpha(before).opaque>100,'Steam editor is blank');
  await page.waitForTimeout(180);
  const after=P.decodePng(await page.locator('canvas').screenshot());
  const changed=P.comparePixels(before,after,{step:4,channelTolerance:2}).changedPixels;
  A.ok(changed>10,'Steam developer example is frozen '+changed);
  A.deepEqual(errors,[],'developer browser errors');
  A.deepEqual(external,[],'developer contacted external hosts');
  const ready=logs.find(x=>x.includes('Steam developer example ready'));
  A.ok(ready,'No actual successful Steam developer initialization '+logs.slice(-10).join('\n'));
  const expected=backend==='webgpu'?'2':'1';
  A.ok(ready.trim().endsWith(expected),'actual renderer not requested backend: '+ready);
  console.log('PASS WATER-06 REAL VITE DEV '+backend,JSON.stringify({
   renderer:ready,changed,images:[P.countAlpha(before),P.countAlpha(after)],errors,network:0}));
 }finally{
  await browser.close();
  if(server.pid){
   if(process.platform==='win32'){try{execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',timeout:6000})}catch{}}
   else server.kill('SIGTERM');
  }
 }
}
verify().catch(e=>{console.error('FAIL WATER-06 DEVELOPER '+backend,e.stack||e);process.exitCode=1});
