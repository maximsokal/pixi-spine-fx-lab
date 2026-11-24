'use strict';
const A=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),sample=path.join(root,'assets/template/sample');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shockwave-spine-'));let browser;
 try{
  const html=path.join(dir,'Shockwave.html');
  execFileSync('python',[path.join(root,'scripts/build_shockwave_editor.py'),'--output',html],{stdio:'inherit'});
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
  A.equal(await page.locator('#sample').count(),1,'Spine sample import control missing');
  await page.locator('summary').filter({hasText:'Spine 4.2 assets and animation'}).click();await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('assetLabel').textContent.includes('2 atlas pages'));
  const anim=page.locator('#animation'),skin=page.locator('#skin');
  A.ok(await anim.locator('option').count()>2);A.ok(await skin.locator('option').count()>0);
  const canvas=()=>page.locator('#surface canvas').screenshot();
  const visible=await canvas();await page.locator('#showSpine').uncheck();const hidden=await canvas();A.ok(!visible.equals(hidden));
  await page.locator('#showSpine').check();
  const scrub=async n=>page.locator('#frame').evaluate((e,n)=>{e.value=n;e.dispatchEvent(new Event('change'));},n);
  const preset=await page.locator('#preset').inputValue(),off=JSON.parse(preset);
  for(const e of off.emitters)e.enabled=false;
  await page.locator('#preset').fill(JSON.stringify(off));await page.locator('#applyPreset').click();
  await anim.selectOption({index:0});await scrub(0);const setup=await canvas();await scrub(39);
  A.ok(setup.equals(await canvas()),'setup pose must stay fixed');
  const names=await anim.locator('option').evaluateAll(a=>a.map(o=>o.value).filter(Boolean));
  let moved=false;for(const name of names){await anim.selectOption(name);await scrub(0);const a=await canvas();await scrub(39);const b=await canvas();if(!a.equals(b)){moved=true;break;}}
  A.ok(moved,'actual animated pose changes with all FX disabled');
  const animated=await canvas();await scrub(0);await scrub(39);A.ok(animated.equals(await canvas()),'repeat seek changes animation pixels');
  await page.locator('#animationSpeed').fill('0.5');await page.locator('#animationSpeed').dispatchEvent('change');
  A.ok(!animated.equals(await canvas()),'animation speed must affect the pose');
  await page.locator('#animationSpeed').fill('1');await page.locator('#animationSpeed').dispatchEvent('change');
  const last=await canvas(),animation=await anim.inputValue();
  const files=fs.readdirSync(sample).map(n=>path.join(sample,n));
  const skeleton=files.find(n=>n.endsWith('.json')),atlas=files.find(n=>n.endsWith('.atlas')),images=files.filter(n=>n.endsWith('.png'));
  A.ok(skeleton&&atlas&&images.length===2);
  const bad=JSON.parse(fs.readFileSync(skeleton,'utf8'));bad.skeleton.spine='4.3.0';
  const badFile=path.join(dir,'bad.json');fs.writeFileSync(badFile,JSON.stringify(bad));
  const select=async(s,a,imgs)=>{await page.locator('#skeletonFile').setInputFiles(s);await page.locator('#atlasFile').setInputFiles(a);await page.locator('#textureFiles').setInputFiles(imgs);await page.locator('#loadSpine').click();await page.waitForFunction(()=>!document.getElementById('loadSpine').disabled);};
  await select(badFile,atlas,images);A.match(await page.locator('#status').textContent(),/4\.2/);A.equal(await anim.inputValue(),animation);A.ok(last.equals(await canvas()),'version rejection changed live pixels');
  const badBinary=path.join(dir,'bad.skel');fs.writeFileSync(badBinary,Buffer.concat([Buffer.alloc(8),Buffer.from([6]),Buffer.from('4.3.0')]));
  await select(badBinary,atlas,images);A.match(await page.locator('#status').textContent(),/4\.2/);A.ok(last.equals(await canvas()));
  const malformed=path.join(dir,'broken.json');fs.writeFileSync(malformed,'{');
  await select(malformed,atlas,images);A.equal(await page.locator('#status').getAttribute('data-error'),'true');A.ok(last.equals(await canvas()));
  await page.locator('#clearTextures').click();await select(skeleton,atlas,[images[0]]);A.match(await page.locator('#status').textContent(),/Missing atlas page/);A.ok(last.equals(await canvas()),'missing page changed live pixels');
  await page.locator('#textureFiles').setInputFiles(images[1]);await page.locator('#loadSpine').click();await page.waitForFunction(()=>!document.getElementById('loadSpine').disabled);A.match(await page.locator('#assetLabel').textContent(),/2 atlas pages/);A.equal(await page.locator('#status').getAttribute('data-error'),'false');
  await anim.selectOption({index:1});const selected=await anim.inputValue();await scrub(18);
  for(const backend of ['webgl1','webgpu','webgl2']){
   await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);
   A.equal(await anim.inputValue(),selected);A.match(await page.locator('#assetLabel').textContent(),/2 atlas pages/);
   A.equal(await page.locator('#surface canvas').count(),1);A.equal(await page.locator('#frame').inputValue(),'18');
  }
  await page.locator('#removeSpine').click();A.equal(await anim.locator('option').count(),0);A.match(await page.locator('#assetLabel').textContent(),/No Spine/);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS GAME-05 real Spine sample, manual multi-page load, rejection preserves preview, animation and backend switches');
 }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
