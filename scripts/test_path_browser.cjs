#!/usr/bin/env node
'use strict';
// FX-CORE-08 real PixiJS 8.22 isolated MeshGeometry QA; never modifies Burn Lab.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 crypto=require('node:crypto'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {decodePng,comparePixels,countAlpha}=require('./fx_visual_png.cjs');
function arg(key,def){const i=process.argv.indexOf('--'+key);return i<0?def:process.argv[i+1];}
const requested=arg('backend','webgl'),output=path.resolve(arg('output','path-qa'));
const gl1=process.argv.includes('--webgl1');
if(!['webgl','webgpu'].includes(requested)||gl1&&requested!=='webgl')
 throw Error('Usage: node test_path_browser.cjs --backend webgl|webgpu [--webgl1] --output DIR');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{ }),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]
 });
 const page=await browser.newPage({viewport:{width:1300,height:1200},deviceScaleFactor:1,offline:true});
 let network=0;const errors=[];
 page.on('request',r=>{if(/^https?:/i.test(r.url()))network++});
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 fs.mkdirSync(output,{recursive:true});
 const evidence=[];
 async function screenshot(name){
   const dataUri=await page.evaluate(()=>__fixture.exportPng());
   assert.ok(dataUri.startsWith('data:image/png;base64,'),'Pixi PNG extraction');
   const bytes=Buffer.from(dataUri.slice(dataUri.indexOf(',')+1),'base64');
   const file=path.join(output,name+'.png');fs.writeFileSync(file,bytes);
   const pic=decodePng(bytes);
   evidence.push({name,file,sha256:sha(bytes),width:pic.width,height:pic.height,
      alpha:countAlpha(pic)});
   return pic;
 }
 const digest=()=>page.evaluate(async()=>{
   const d=await __fixture.extract(),bytes=d.pixels;
   let h=2166136261;
   for(let i=0;i<bytes.length;i++){h=Math.imul(h^bytes[i],16777619);}
   return {width:d.width,height:d.height,hash:h>>>0};
 });
 try {
   const uri=pathToFileURL(path.resolve(__dirname,'fixtures/path-qa.html'));
   uri.searchParams.set('renderer',requested);
   if(gl1)uri.searchParams.set('webgl1','1');
   await page.goto(uri.href);
   await page.waitForFunction(()=>window.__fixture?.ready||window.__fixture?.error,
      null,{timeout:60000});
   const failure=await page.evaluate(()=>__fixture.error);
   assert.ok(!failure,'Fixture startup failed: '+failure);
   const environment=await page.evaluate(()=>__fixture.actualBackend());
   const wanted=requested==='webgpu'?'webgpu':(gl1?'webgl1':'webgl2');
   assert.equal(environment.actual,wanted,'actual backend fallback is NOT a PASS');
   assert.equal(environment.pixi,'8.22.0','pinned PixiJS version changed');
   const baseline=await screenshot('baseline');
   assert.equal(baseline.width,512);
   assert.equal(baseline.height,512);
   const alpha=countAlpha(baseline);
   assert.ok(alpha.opaque+alpha.partial>600,'actual path mesh not rendered');
   assert.ok(alpha.transparent>0,'PNG must preserve transparent outside bounds');
   const before=await digest();
   assert.equal(before.width,512);
   assert.equal(before.height,512);
   for(const zoom of [.5,1,2]){
     await page.evaluate(z=>__fixture.setPreviewZoom(z),zoom);
     const after=await digest();
     assert.deepEqual(after,before,'preview zoom must not change model/image pixels');
     const png=await screenshot('preview-zoom-'+zoom);
     assert.equal(comparePixels(baseline,png,{step:1,channelTolerance:0}).changedPixels,0,
       'same-backend PNG must be zoom invariant');
     const visual=await page.locator('#stage canvas').screenshot({timeout:60000});
     const cameraImage=decodePng(visual);
     assert.equal(cameraImage.width,Math.round(512*zoom));
     assert.equal(cameraImage.height,Math.round(512*zoom));
     const filename='camera-zoom-'+zoom+'.png';
     fs.writeFileSync(path.join(output,filename),visual);
     evidence.push({name:filename,file:path.join(output,filename),sha256:sha(visual),
       width:cameraImage.width,height:cameraImage.height,alpha:countAlpha(cameraImage)});
   }
   await page.evaluate(()=>__fixture.setPreviewZoom(1));
   await page.evaluate(()=>__fixture.draw({middleWidth:58}));
   const wide=await screenshot('middle-width-58');
   const delta=comparePixels(baseline,wide,{step:3,channelTolerance:2});
   assert.ok(delta.changedPixels>120,'middle width must visibly change ribbon geometry');
   await page.evaluate(()=>__fixture.draw({middleWidth:28,branches:0}));
   const noBranches=await screenshot('branches-disabled');
   const branchDelta=comparePixels(baseline,noBranches,{step:3,channelTolerance:2});
   assert.ok(branchDelta.changedPixels>50,'disabling branches removes real geometry');
   const unchanged=await page.evaluate(()=>__fixture.draw({seed:91}));
   assert.ok(unchanged.count>1&&unchanged.totalVertices>0&&unchanged.triangles>0);
   const same=await screenshot('seed-repeated');
   const equality=comparePixels(baseline,same,{step:1,channelTolerance:0});
   assert.equal(equality.changedPixels,0,'same seed/geometry must reproduce identical PNG pixels');
   await page.evaluate(()=>__fixture.draw({seed:92}));
   const regenerated=await screenshot('seed-changed');
   assert.ok(comparePixels(baseline,regenerated,{step:3,channelTolerance:2}).changedPixels>5,
     'seed variation must alter branch/edge geometry');
   await page.evaluate(()=>__fixture.clear());
   const empty=await screenshot('all-paths-disabled');
   const disabledAlpha=countAlpha(empty);
   assert.equal(disabledAlpha.partial+disabledAlpha.opaque,0,
     'removing every owned path must not leave ghost lines, glow or particles');
   assert.equal(network,0,'offline fixture must not fetch remote assets');
   assert.deepEqual(errors,[],'no renderer/shader exceptions');
   const report={suite:'FX-CORE-08 isolated path mesh',status:'PASS',
     backend:environment,host:os.platform()+' '+os.release()+' '+os.arch(),
     browser:browser.version(),quality:'balanced',
     checks:['tessellation','alpha','zoom-independent-extraction',
       'per-parameter-width','branch-toggles','deterministic-seed',
       'all-disabled-cleanup','actual-backend','offline'], evidence,changedPixels:{width:delta.changedPixels,
       branches:branchDelta.changedPixels},networkRequests:network};
   fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
   console.log('PASS FX-CORE-08 PIXI MESH',JSON.stringify({
     backend:environment.actual,version:environment.pixi,
     samples:unchanged,alpha,changedPixels:report.changedPixels,
     images:evidence.length,offline:true}));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
