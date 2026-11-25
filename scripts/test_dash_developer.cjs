'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const folder=path.resolve(process.argv[2]),target=process.argv[3],port=Number(process.argv[4]),fallback=process.argv[5]==='fallback';
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
  if(fallback)await page.addInitScript(()=>Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true}));
  await page.goto(base);await page.waitForFunction(()=>['webgl1','webgl2','webgpu'].includes(document.getElementById('backend').textContent));
  const backend=await page.locator('#backend').textContent();A.equal(backend,target==='webgpu'&&!fallback?'webgpu':'webgl2');A.match(await page.locator('#asset').textContent(),/2 pages/);
  const frame=page.locator('#frame');A.ok(Math.abs(Number(await frame.inputValue())-preset.previewSeconds)<1e-12,'range serializes fractional seconds');
  const seek=async t=>{await frame.evaluate((el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},t);return page.locator('canvas').screenshot();};
  const a=await seek(.15),b=await seek(.3);A.ok(!a.equals(b));A.ok(a.equals(await seek(.15)));
  const first=await seek(0),last=await seek((preset.settings.durationFrames-1)/60);A.deepEqual(first,last);A.notDeepEqual(first,a);
  await page.locator('#destroy').click();A.equal(await page.locator('canvas').count(),0);
  A.deepEqual(errors,[]);A.deepEqual(external,[]);A.deepEqual(failed,[]);
  console.log('PASS extracted built developer ZIP',backend,await page.locator('#asset').textContent());
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
