'use strict';
// Optional real Spine 4.2 binary fixture; supply licensed official exports externally.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.argv[2]),html=path.resolve(process.argv[3]);
const input=['spineboy-pro.skel','spineboy.atlas','spineboy.png'].map(n=>path.join(root,n));
function zip(b){const m=new Map();let i=0;while(b.readUInt32LE(i)===0x04034b50){const n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28),z=b.readUInt32LE(i+18),name=b.subarray(i+30,i+30+n).toString(),a=i+30+n+e;A.equal(b.readUInt16LE(i+8),0);A.ok(!m.has(name));m.set(name,b.subarray(a,a+z));i=a+z}return m;}
const pixels=(b)=>{const c=P.countAlpha(P.decodePng(b));return c.partial+c.opaque;};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
 const page=await browser.newPage({offline:true,acceptDownloads:true,viewport:{width:1400,height:1000}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await page.locator('summary').filter({hasText:'Spine 4.2 assets and animation'}).click();
 for(const [i,id] of ['skeletonFile','atlasFile','textureFiles'].entries())await page.locator('#'+id).setInputFiles(input[i]);
 await page.locator('#loadSpine').click();await page.waitForFunction(()=>!document.getElementById('loadSpine').disabled);
 A.match(await page.locator('#assetLabel').textContent(),/spineboy-pro\.skel.*Spine 4\.2\.\d+/);
 const names=await page.locator('#animation option').evaluateAll(a=>a.map(x=>x.value));A.ok(names.includes('run'));
 await page.locator('#animation').selectOption('run');
 const preset=JSON.parse(await page.locator('#preset').inputValue());for(const e of preset.emitters)e.enabled=false;
 await page.locator('#preset').fill(JSON.stringify(preset));await page.locator('#applyPreset').click();
 const set=async(id,v)=>page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},v);
 const shot=()=>page.locator('#surface canvas').screenshot();
 const download=async id=>{const pending=page.waitForEvent('download');await page.locator('#'+id).click();const f=await pending;await page.waitForFunction(()=>!document.getElementById('bakePng').disabled);return zip(fs.readFileSync(await f.path()));};
 await set('bakeFrames',21);
 for(const backend of ['webgl1','webgl2','webgpu']){
  await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);
  await set('frame',0);const a=await shot();await set('frame',20);const b=await shot();A.ok(!a.equals(b),'real SKEL animation must change pixels');
  await set('frame',0);await set('frame',20);A.ok(b.equals(await shot()),'repeat seek');
  const visible=await download('bakePng'),meta=JSON.parse(visible.get('sequence.json'));A.equal(meta.asset.options.animation,'run');A.equal(meta.asset.options.visible,true);A.ok(pixels(visible.get('frames/frame_00020.png'))>100);
  await page.locator('#showSpine').uncheck();const hidden=await download('bakePng');A.equal(pixels(hidden.get('frames/frame_00020.png')),0);
  await page.locator('#showSpine').check();A.ok(b.equals(await shot()));
  A.deepEqual((await download('bakePng')).get('frames/frame_00020.png'),visible.get('frames/frame_00020.png'));
  console.log('PASS actual binary SKEL animation, visible/hidden PNG and repeat seek',backend,meta.asset.version);
 }
 for(const id of ['webglZip','webgpuZip']){
  const files=await download(id),meta=JSON.parse(files.get('preset.json'));
  A.equal(meta.asset.options.animation,'run');A.equal(meta.asset.skeleton,'assets/skeleton.skel');
  A.deepEqual(files.get('public/'+meta.asset.skeleton),fs.readFileSync(input[0]));
  A.deepEqual(files.get('public/'+meta.asset.atlas),fs.readFileSync(input[1]));
  A.deepEqual(files.get('public/'+meta.asset.images[0].path),fs.readFileSync(input[2]));
  console.log('PASS original binary SKEL/atlas/texture bytes in',id);
 }
 A.deepEqual(errors,[]);A.deepEqual(network,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
