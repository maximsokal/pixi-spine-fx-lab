#!/usr/bin/env node
// Regression for 40-frame bake, cancel and failure cleanup (FX-PNG-PMA-01).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {entries,decodeRgba} = require('./test_png_pma.cjs');
function arg(name, fallback) { const i = process.argv.indexOf('--'+name); return i < 0 ? fallback : process.argv[i+1]; }
const html = arg('html'), backend = arg('backend','webgl'), output = path.resolve(arg('output','fx-lifecycle-qa'));
if (!html || !['webgl','webgpu'].includes(backend)) {
  console.error('Usage: node test_bake_lifecycle.cjs --html FILE [--backend webgl|webgpu] [--output DIR]'); process.exit(2);
}
async function main() {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,
    ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}),
    args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU === '1' ? ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan'] : [])]});
  const page = await browser.newPage({viewport:{width:1200,height:900},offline:true,acceptDownloads:true});
  let downloads = 0, network = 0; const errors = [];
  page.on('download',()=>downloads++);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))network++;});
  try {
    const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
    await page.goto(url.href);
    await page.waitForFunction(()=>document.querySelector('#viewport canvas') && document.getElementById('loading').style.display==='none' && !document.getElementById('assetName').textContent.includes('Loading'));
    const actual=await page.evaluate(()=>backend);
    assert.equal(actual,backend,'backend fallback not a PASS');
    await page.locator('#animPlay').uncheck();
    const fill=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');};
    await fill('bakeWidth',160);await fill('bakeHeight',128);await fill('bakeFrames',40);
    await fill('durationFrames',40);
    const pending=page.waitForEvent('download',{timeout:120000});
    await page.locator('#bakeStart').click();
    const download=await pending;
    const file=path.join(output,backend+'-40-frames.zip');
    await download.saveAs(file);
    await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
    const archive=entries(fs.readFileSync(file));
    const frameNames=[...archive.keys()].filter(n=>n.endsWith('.png'));
    assert.equal(frameNames.length,40);
    const hashes=new Set();let alphaBetween=false;
    for(let i=0;i<40;i++){
      const name='frames/frame_'+String(i).padStart(5,'0')+'.png';
      assert.ok(archive.has(name), 'Missing '+name);
      const frame=archive.get(name), img=decodeRgba(frame);
      assert.equal(img.width,160);assert.equal(img.height,128);
      hashes.add(crypto.createHash('sha256').update(frame).digest('hex'));
      for(let y=0;y<img.height;y+=4) for(let x=0;x<img.width;x+=4) {
        const a=img.rgba(x,y)[3];
        if(a>0&&a<255)alphaBetween=true;
      }
    }
    assert.ok(hashes.size>1,'Expected a time-varying 40-frame sequence');
    assert.ok(alphaBetween, 'Real 40-frame effect must contain partially transparent pixels');
    const metadata=JSON.parse(archive.get('sequence.json'));
    assert.equal(metadata.frameCount,40);assert.equal(metadata.fps,60);assert.equal(metadata.width,160);assert.equal(metadata.height,128);
    assert.equal(downloads,1);
    console.log('PASS 40-FRAME',JSON.stringify({backend,frames:frameNames.length,uniqueFrames:hashes.size,alphaBetween}));
    await fill('bakeFrames',40);
    await page.locator('#bakeStart').click();
    await page.waitForFunction(()=>document.getElementById('bakeStart').disabled && +document.getElementById('bakeProgress').value>=2,{timeout:30000});
    await page.locator('#bakeCancel').click();
    await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled && document.getElementById('bakeMessage').textContent.includes('Bake cancelled.'),null,{timeout:30000});
    assert.equal(downloads,1,'Cancelled bake must not download partial ZIP');
    assert.equal(await page.locator('#bakeCancel').isDisabled(),true);
    console.log('PASS CANCEL',JSON.stringify({backend,downloads}));
    // Exercise existing error/finally cleanup with a deterministic readback failure.
    const injected=await page.evaluate(()=>{
      if(backend==='webgl'){
        const old=app.renderer.extract.pixels;
        app.renderer.extract.pixels=function(){throw new Error('QA injected readback failure')};
        window.__restoreQa=()=>{app.renderer.extract.pixels=old};
      }else{
        const old=app.renderer.render;
        app.renderer.render=function(options){
          if(options && options.target){app.renderer.render=old;throw new Error('QA injected render failure')}
          return old.apply(this,arguments);
        };
        window.__restoreQa=()=>{app.renderer.render=old};
      }
      return true;
    });
    assert.ok(injected);
    await page.locator('#bakeStart').click();
    await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled && document.getElementById('bakeMessage').textContent.includes('Bake failed: QA injected'),null,{timeout:30000});
    assert.equal(downloads,1,'Failed bake must not download partial ZIP');
    await page.evaluate(()=>window.__restoreQa());
    console.log('PASS FAILURE/CLEANUP',JSON.stringify({backend,downloads}));
    assert.equal(network,0);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
