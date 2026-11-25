'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function crc(b){let c=~0;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (~c)>>>0;}
function unzip(b){const m=new Map();let i=0;while(b.readUInt32LE(i)===0x04034b50){const n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28),z=b.readUInt32LE(i+18),name=b.subarray(i+30,i+30+n).toString(),a=i+30+n+e;A.equal(b.readUInt16LE(i+8),0);A.ok(!m.has(name));A.equal(crc(b.subarray(a,a+z)),b.readUInt32LE(i+14));m.set(name,b.subarray(a,a+z));i=a+z}return m}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dash-dev-ui-')),html=path.join(dir,'dash.html'),out=process.argv[2];let browser;
 try{
  execFileSync('python',[path.join(__dirname,'build_dash_editor.py'),'--output',html]);
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
  const page=await browser.newPage({offline:true,acceptDownloads:true,viewport:{width:1400,height:1000}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const ready=()=>page.waitForFunction(()=>!document.getElementById('webglZip').disabled);
  const state=()=>page.evaluate(()=>({preset:JSON.parse(document.getElementById('preset').value),frame:document.getElementById('frame').value,animation:document.getElementById('animation').value,skin:document.getElementById('skin').value,visible:document.getElementById('showSpine').checked}));
  const download=async target=>{const e=page.waitForEvent('download');await page.locator('#'+target+'Zip').click();const dl=await e;await ready();A.equal(dl.suggestedFilename(),'TeleportDash_'+target+'.zip');return fs.readFileSync(await dl.path())};
  A.equal(await page.locator('#webglZip').count(),1,'Developer export control missing');
  const noAsset=unzip(await download('webgl'));A.equal(JSON.parse(noAsset.get('preset.json')).asset,null);
  await page.locator('#spinePanel summary').click();await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('assetLabel').textContent.includes('2 atlas pages'));
  await page.locator('#animation').selectOption('attack_1');await ready();await page.locator('#loopAnimation').uncheck();await ready();await page.locator('#showSpine').uncheck();
  const c=(await state()).preset;c.trailWidth=36;for(const k of Object.keys(c.emitters[0].layers))c.emitters[0].layers[k].enabled=k==='echoes';await page.locator('#preset').locator('..').locator('summary').click();
  await page.locator('#preset').fill(JSON.stringify(c));await page.locator('#applyPreset').click();
  await page.locator('#frame').evaluate(e=>{e.value='20';e.dispatchEvent(new Event('input',{bubbles:true}))});
  const prior=await state(),before=await page.locator('#surface canvas').screenshot();
  for(const target of ['webgl','webgpu']){
   const bytes=await download(target),files=unzip(bytes),meta=JSON.parse(files.get('preset.json'));
   A.deepEqual(meta.settings,prior.preset);A.equal(meta.rendererPreference,target);A.equal(meta.asset.options.animation,'attack_1');A.equal(meta.asset.options.visible,false);A.equal(meta.asset.options.loop,false);A.equal(meta.previewSeconds,20/60);A.equal(meta.asset.images.length,2);
   A.deepEqual(files.get('preset.json'),files.get('public/preset.json'));A.deepEqual(await state(),prior);A.ok(before.equals(await page.locator('#surface canvas').screenshot()));
   A.deepEqual(await download(target),bytes);
   for(const n of ['example.js','index.html','README.md','LICENSES.txt','package.json','dash-core.js','dash-runtime.js','dash-spine.js','curve-core.js','spacing-core.js','color-core.js','path-core.js'])A.ok(files.has(n),n);
   if(out){const root=path.join(out,target);for(const [name,data] of files){A.ok(!name.includes('..')&&!path.isAbsolute(name));const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data)}}
   console.log('PASS offline editor developer download',target,files.size,'files');
  }
  A.deepEqual(errors,[]);A.deepEqual(network,[]);
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
