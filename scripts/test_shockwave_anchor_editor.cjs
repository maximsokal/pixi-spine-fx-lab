'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shock-anchor-')),html=path.join(dir,'shock.html');let browser;
 try{
 execFileSync('python',[path.join(__dirname,'build_shockwave_editor.py'),'--output',html]);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 const page=await browser.newPage({offline:true,viewport:{width:1400,height:1000}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 A.equal(await page.locator('#e-anchor').count(),1,'anchor control missing');
 const state=()=>page.evaluate(()=>JSON.parse(document.getElementById('preset').value));
 const apply=async c=>{await page.locator('#preset').fill(JSON.stringify(c));await page.locator('#applyPreset').click();A.equal(await page.locator('#status').getAttribute('data-error'),'false')};
 const change=async(id,v)=>page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},String(v));
 const seek=f=>change('frame',f),canvas=()=>page.locator('#surface canvas').screenshot(),handle=page.locator('#originHandle');
 const center=()=>handle.evaluate(e=>[parseFloat(e.style.left)*5.12,parseFloat(e.style.top)*5.12]);
 await page.locator('summary').filter({hasText:'Spine 4.2 assets and animation'}).click();
 await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('assetLabel').textContent.includes('2 atlas pages'));
 await page.locator('#showSpine').uncheck();
 const c=await state();c.ringCount=2;c.finalRadius=60;c.emitters[0].x=0;c.emitters[0].y=0;c.emitters[0].layers.secondary.anchor={type:'world',name:''};c.emitters[0].layers.secondary.x=390;c.emitters[0].layers.secondary.y=390;
 await apply(c);await page.locator('#e-anchor').selectOption('bone');
 const names=await page.locator('#e-bone option').evaluateAll(a=>a.map(e=>e.value));A.ok(names.length>1);
 // Independent fixture oracle via the actual runtime bone matrix.
 const oracle=await page.evaluate(async()=>{
  const s=FxShockwaveSpine.sample(JSON.parse(document.getElementById('sampleData').textContent)),asset=await FxShockwaveSpine.create(s),m=asset.model;
  try{
   const all=[];for(const animation of asset.animations){
    m.state.setAnimation(0,animation,true);
    const frames=[10,20].map(f=>{FxTimeline.seekSpine(m,f/60);m.updateLocalTransform();const a=m.localTransform;return Object.fromEntries(m.skeleton.bones.filter(b=>b.active).map(b=>[b.data.name,{x:a.a*b.worldX+a.c*b.worldY+a.tx,y:a.b*b.worldX+a.d*b.worldY+a.ty,rotation:Math.atan2(a.b*b.a+a.d*b.c,a.a*b.a+a.c*b.c)*180/Math.PI,scale:Math.hypot(a.a*b.a+a.c*b.c,a.b*b.a+a.d*b.c)}]))});
    for(const [bone,p] of Object.entries(frames[0])){const q=frames[1][bone];if(q&&Math.hypot(p.x-q.x,p.y-q.y)>2&&[p,q].every(v=>v.x>30&&v.x<470&&v.y>30&&v.y<470)){return {bone,animation,frames:[p,q]}}}
   }throw Error('No moving bone fixture');
  }finally{asset.destroy()}
 });
 await page.locator('#animation').selectOption(oracle.animation);await page.locator('#e-bone').selectOption(oracle.bone);
 const near=(a,b,t=.05)=>A.ok(Math.abs(a-b)<t,a+' != '+b);
 await seek(10);const a=await center();near(a[0],oracle.frames[0].x);near(a[1],oracle.frames[0].y);
 await seek(20);const b=await center();near(b[0],oracle.frames[1].x);near(b[1],oracle.frames[1].y);A.notDeepEqual(a,b);
 const pixels=await canvas();await seek(10);await seek(20);A.ok(pixels.equals(await canvas()));
 await page.locator('#layerSelect').selectOption('primary');await page.locator('#zoom').selectOption('0.5');
 await handle.scrollIntoViewIfNeeded();const rect=await handle.boundingBox(),p=oracle.frames[1],angle=p.rotation*Math.PI/180;
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+6,rect.y+rect.height/2+3);await page.mouse.up();
 const saved=await state(),l=saved.emitters[0].layers.primary;near(l.x,(12*Math.cos(angle)+6*Math.sin(angle))/p.scale,.2);near(l.y,(-12*Math.sin(angle)+6*Math.cos(angle))/p.scale,.2);
 await page.locator('#layerSelect').selectOption('secondary');{const q=await center();near(q[0],390);near(q[1],390)};
 for(const backend of ['webgl1','webgpu','webgl2']){
  await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);
  A.deepEqual(await state(),saved);{const q=await center();near(q[0],390);near(q[1],390)};A.equal(await page.locator('#surface canvas').count(),1);
 }
 await page.locator('#layerSelect').selectOption('primary');await page.locator('#removeSpine').click();A.equal(await handle.isHidden(),true);
 A.match(await page.locator('#anchorDiagnostics').textContent(),/primary.*missing anchor/);
 await page.locator('#layerSelect').selectOption('secondary');A.equal(await handle.isVisible(),true);{const q=await center();near(q[0],390);near(q[1],390)};
 const bad=structuredClone(saved);bad.emitters[0].anchor={type:'bone',name:''};
 await page.locator('#preset').fill(JSON.stringify(bad));await page.locator('#applyPreset').click();A.equal(await page.locator('#status').getAttribute('data-error'),'true');await page.locator('#syncPreset').click();A.deepEqual(await state(),saved);
 A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS actual animated Spine bone anchor, inverse drag and independent world layer',JSON.stringify(oracle));
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
