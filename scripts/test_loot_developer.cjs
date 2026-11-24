'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const folder=path.resolve(process.argv[2]),target=process.argv[3],port=Number(process.argv[4]);
 const preset=JSON.parse(fs.readFileSync(path.join(folder,'preset.json'),'utf8'));
 const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));
 A.equal(pkg.dependencies['pixi.js'],'8.22.0');A.equal(pkg.dependencies['@esotericsoftware/spine-pixi-v8'],'4.2.120');
 const base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,[path.join(folder,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:folder,stdio:'inherit'});
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
  const page=await browser.newPage(),errors=[],external=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
  await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.continue();external.push(r.request().url());return r.abort()});
  await page.goto(base);await page.waitForFunction(()=>globalThis.lootDemo?.sample);
  const d=await page.evaluate(()=>({backend:lootDemo.backend,preset:lootDemo.preset,asset:lootDemo.asset,sample:lootDemo.sample}));
  A.equal(d.backend,target==='webgpu'?'webgpu':'webgl2');A.deepEqual(d.preset,preset);A.equal(d.asset.pages,2);
  const seek=async t=>{await page.evaluate(t=>lootDemo.seek(t),t);return page.locator('canvas').screenshot()};
  const a=await seek(.25),b=await seek(.4);A.ok(!a.equals(b));A.ok(a.equals(await seek(.25)));
  await page.evaluate(()=>lootDemo.destroy());A.equal(await page.locator('canvas').count(),0);
  A.deepEqual(errors,[]);A.deepEqual(external,[]);A.deepEqual(failed,[]);
  console.log('PASS extracted built developer ZIP',d.backend,JSON.stringify(d.asset));
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
