'use strict';
const A=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),sample=path.join(root,'assets/template/sample');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portal-spine-'));let browser;
 try{
  const html=path.join(dir,'Portal.html');execFileSync('python',[path.join(root,'scripts/build_portal_editor.py'),'--output',html],{stdio:'inherit'});
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
  const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});page.setDefaultTimeout(10000);
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(html).href);await page.waitForSelector('body[data-ready=true]');
  const l=id=>page.locator('#'+id),canvas=()=>l('surface').locator('canvas').screenshot(),cfg=async()=>JSON.parse(await l('preset').inputValue());
  A.equal(await l('sample').count(),1,'Spine sample control missing');
  await l('spinePanel').locator('summary').click();await l('sample').click();await page.waitForFunction(()=>document.getElementById('assetLabel').textContent.includes('2 atlas pages'));
  A.ok(await l('animation').locator('option').count()>2);A.ok(await l('skin').locator('option').count()>0);
  const original=await cfg(),off=structuredClone(original);for(const e of off.emitters)e.enabled=false;
  const apply=async p=>{await l('preset').fill(JSON.stringify(p));await l('applyPreset').click();A.equal(await l('status').getAttribute('data-error'),'false')};
  const scrub=async n=>l('frame').evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('change'))},n);
  await apply(off);await l('animation').selectOption('');await scrub(0);const setup=await canvas();await scrub(60);A.deepEqual(await canvas(),setup);
  const names=await l('animation').locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));let chosen='';
  for(const name of names){await l('animation').selectOption(name);await scrub(0);const a=await canvas();await scrub(60);if(!a.equals(await canvas())){chosen=name;break}}
  A.ok(chosen,'animation must move actual rendered Spine pixels');
  const pose=await canvas();await scrub(0);await scrub(60);A.deepEqual(await canvas(),pose);
  await l('animationSpeed').fill('.5');await l('animationSpeed').dispatchEvent('change');A.notDeepEqual(await canvas(),pose);
  await l('animationSpeed').fill('1');await l('animationSpeed').dispatchEvent('change');
  // All effect layers except aperture disabled. Hide Spine so bone movement is measurable on FX pixels alone.
  const anchored=structuredClone(original),e=anchored.emitters[0];e.x=e.y=0;e.layers.rim.enabled=e.layers.particles.enabled=false;
  e.anchor={type:'bone',name:'missing_bone'};await apply(anchored);await l('showSpine').uncheck();
  A.match(await l('anchorDiagnostics').textContent(),/missing anchor/);A.ok(await l('originHandle').isHidden());
  const bones=await l('boneNames').locator('option').evaluateAll(o=>o.map(x=>x.value));A.ok(bones.length>1);
  let moved=false;for(const bone of bones){await l('emitter-anchorName').fill(bone);await l('emitter-anchorName').dispatchEvent('change');await scrub(0);const a=await canvas(),x=await l('originHandle').getAttribute('style');await scrub(60);const b=await canvas(),y=await l('originHandle').getAttribute('style');if(!a.equals(b)&&x!==y&&!(await l('originHandle').isHidden())){moved=true;break}}
  A.ok(moved,'animated bone must move visible portal and handle');A.equal(await l('anchorDiagnostics').textContent(),'');
  const anchorPose=await canvas();await scrub(0);await scrub(60);A.deepEqual(await canvas(),anchorPose);
  await l('showSpine').check();
  const last=await canvas(),saved=await cfg(),anim=await l('animation').inputValue();
  const files=fs.readdirSync(sample).map(n=>path.join(sample,n)),skeleton=files.find(n=>n.endsWith('.json')),atlas=files.find(n=>n.endsWith('.atlas')),images=files.filter(n=>n.endsWith('.png'));
  const bad=JSON.parse(fs.readFileSync(skeleton,'utf8'));bad.skeleton.spine='4.3.0';const badFile=path.join(dir,'bad.json');fs.writeFileSync(badFile,JSON.stringify(bad));
  const load=async()=>{await l('loadSpine').click();await page.waitForFunction(()=>!document.getElementById('loadSpine').disabled)};
  await l('allFiles').setInputFiles([badFile,atlas,...images]);await load();A.match(await l('status').textContent(),/4\.2/);A.deepEqual(await canvas(),last);A.deepEqual(await cfg(),saved);
  await l('clearTextures').click();await l('skeletonFile').setInputFiles(skeleton);await l('textureFiles').setInputFiles(images[0]);await load();A.match(await l('status').textContent(),/missing atlas page/i);A.deepEqual(await canvas(),last);
  await l('textureFiles').setInputFiles(images[1]);await load();A.equal(await l('status').getAttribute('data-error'),'false');A.match(await l('assetLabel').textContent(),/2 atlas pages/);
  await l('animation').selectOption(anim);await scrub(60);
  for(const backend of ['webgl1','webgpu','webgl2']){await l('backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);A.equal(await l('animation').inputValue(),anim);A.equal(await l('frame').inputValue(),'60');A.equal(await l('surface').locator('canvas').count(),1);A.deepEqual(await cfg(),saved);}
  if(process.env.PORTAL_BINARY_FIXTURE){const f=process.env.PORTAL_BINARY_FIXTURE;await l('clearTextures').click();await l('allFiles').setInputFiles([path.join(f,'spineboy-pro.skel'),path.join(f,'spineboy-pma.atlas'),path.join(f,'spineboy-pma.png')]);await load();A.equal(await l('status').getAttribute('data-error'),'false',await l('status').textContent());A.match(await l('assetLabel').textContent(),/\.skel.*1 atlas pages/);console.log('PASS actual Spine 4.2 SKEL fixture');}
  await l('removeSpine').click();A.equal(await l('animation').locator('option').count(),0);A.match(await l('anchorDiagnostics').textContent(),/missing anchor/);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS GAME-06 actual Spine: sample, animation, bone FX pixels, rollback, multipage and three backends');
 }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
