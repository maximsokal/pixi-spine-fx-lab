'use strict';
const A=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function main(){
 const html=process.argv[2];A.ok(html,'Pass built standalone HTML');
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({offline:true,viewport:{width:1280,height:900}}),errors=[],net=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))net.push(r.url())});
  await page.goto(pathToFileURL(path.resolve(html)).href);await page.waitForSelector('body[data-ready=true]');
  page.setDefaultTimeout(8000);const l=id=>page.locator('#'+id),cfg=async()=>JSON.parse(await l('preset').inputValue()),canvas=()=>l('surface').locator('canvas').screenshot();
  const set=async(id,value)=>{await l(id).fill(String(value));await l(id).dispatchEvent('change')};
  const choose=async(id,value)=>l(id).selectOption(value);
  A.equal(await l('backendActual').textContent(),'WEBGL2');A.equal((await cfg()).durationFrames,120);
  const before=await canvas();await set('p-portalRadius',120);A.equal((await cfg()).portalRadius,120);A.notDeepEqual(await canvas(),before);
  await set('p-portalRadius',999);A.equal((await cfg()).portalRadius,120);A.equal(await l('p-portalRadius').inputValue(),'120');
  await set('p-durationFrames',24);A.equal((await cfg()).particleLifetimeFrames,24);A.equal(await l('frame').getAttribute('max'),'23');
  await set('frame',18);A.equal(await l('frameLabel').textContent(),'18 / 23');
  await choose('p-mode','oneShot');await set('frame',23);A.equal(await l('frameLabel').textContent(),'23 / 23');await l('resetSettings').click();
  await l('addEmitter').click();A.equal((await cfg()).emitters.length,2);await l('duplicateEmitter').click();A.equal((await cfg()).emitters.length,3);await l('addEmitter').click();A.equal((await cfg()).emitters.length,4);A.ok(await l('addEmitter').isDisabled());A.ok(await l('duplicateEmitter').isDisabled());
  await l('removeEmitter').click();await choose('emitterSelect','portal3');await l('removeEmitter').click();A.equal((await cfg()).emitters.length,2);
  await choose('emitterSelect','portal1');await choose('layerSelect','rim');await l('rim-enabled').uncheck();A.equal((await cfg()).emitters[0].layers.rim.enabled,false);
  await set('rim-x',12);A.equal((await cfg()).emitters[0].layers.rim.x,12);
  await choose('layerSelect','emitter');await l('actualSize').click();await l('zoomOut').click();
  const pos=await l('originHandle').boundingBox();await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();await page.mouse.move(pos.x+pos.width/2+16,pos.y+pos.height/2+8);await page.mouse.up();
  A.equal((await cfg()).emitters[0].x,276);A.equal((await cfg()).emitters[0].y,266);
  await set('emitter-rotation',90);await choose('layerSelect','rim');
  const local=await l('originHandle').boundingBox();await page.mouse.move(local.x+local.width/2,local.y+local.height/2);await page.mouse.down();await page.mouse.move(local.x+local.width/2,local.y+local.height/2+16);await page.mouse.up();
  A.equal((await cfg()).emitters[0].layers.rim.x,32);
  await choose('rim-anchorType','bone');await set('rim-anchorName','hand');A.ok(await l('originHandle').isHidden());
  await l('rim-enabled').check();A.match(await l('anchorDiagnostics').textContent(),/missing anchor/);await choose('rim-anchorType','inherit');
  await choose('curveSelect','swirlCurve');await choose('portalCurveMode','stepped');A.equal((await cfg()).swirlCurve.keys[0].mode,'stepped');
  await l('portalPalettePanel').locator('summary').click();await choose('portalPalettePreset','magical');A.equal((await cfg()).palette.parameterKey,'portalColor');
  const beforePalette=await cfg();A.equal(beforePalette.palette.parameterKey,'portalColor');
  await choose('p-mode','oneShot');await set('p-durationFrames',12);await l('resetFrame').click();await l('play').click();
  await page.waitForFunction(()=>document.getElementById('frame').value==='11'&&document.getElementById('play').textContent==='Play');
  await l('reverse').click();await page.waitForFunction(()=>document.getElementById('frame').value==='0'&&document.getElementById('play').textContent==='Play');
  await choose('p-mode','loop');await set('p-durationFrames',120);
  const good=await cfg();await l('preset').fill(JSON.stringify({...good,warp:2}));await l('applyPreset').click();A.equal(await l('status').getAttribute('data-error'),'true');await l('syncPreset').click();A.deepEqual(await cfg(),good);
  const download=page.waitForEvent('download');await l('downloadPreset').click();const file=await download;A.equal(file.suggestedFilename(),'magic-portal-preset.json');
  A.deepEqual(JSON.parse(require('node:fs').readFileSync(await file.path(),'utf8')),good);
  await set('frame',12);for(const b of ['webgl1','webgpu','webgl2']){await choose('backend',b);await page.waitForFunction(v=>document.getElementById('backendActual').textContent===v.toUpperCase()&&!document.getElementById('backend').disabled,b);A.equal(await l('surface').locator('canvas').count(),1);A.deepEqual(await cfg(),good);A.equal(await l('frame').inputValue(),'12');}
  await page.setViewportSize({width:390,height:844});await l('fit').click();const b=await l('surface').boundingBox();A.ok(b.width<=390&&Math.abs(b.width-b.height)<2,JSON.stringify(b));
  A.deepEqual(errors,[]);A.deepEqual(net,[]);console.log('PASS GAME-06 offline editor: controls, curves, palette, preset rollback, drag, three backends, responsive preview');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
