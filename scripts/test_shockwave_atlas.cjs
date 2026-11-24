'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shock-page-')),html=path.join(dir,'shock.html');let browser;
 try{
 execFileSync('python',[path.join(__dirname,'build_shockwave_editor.py'),'--output',html]);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 const page=await browser.newPage({offline:true}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const result=await page.evaluate(async()=>{
  const src=FxShockwaveSpine.sample(JSON.parse(document.getElementById('sampleData').textContent)),atlas=await src.atlas.text(),pages=new spine.TextureAtlas(atlas).pages.map(p=>p.name);
  const original=await FxShockwaveSpine.create(src);original.destroy();
  const [a,b]=pages,rename=n=>atlas.split(/\r?\n/).map(s=>s===b?n:s).join('\n');
  async function run(next){let decoded=0,asset;const prior=Image.prototype.decode;Image.prototype.decode=function(){decoded++;return prior.call(this)};
   try{asset=await FxShockwaveSpine.create(next);return {accepted:true,decoded}}catch(e){return {accepted:false,error:e.message,decoded}}finally{asset?.destroy();Image.prototype.decode=prior}}
  const duplicate=await run({...src,atlas:new Blob([rename(a)]),images:new Map([[a,src.images.get(a)]])});
  const reuse=await run({...src,atlas:new Blob([rename('other/'+a)]),images:new Map([[a,src.images.get(a)]])});
  const exact=await run({...src,atlas:new Blob([rename('other/'+a)]),images:new Map([[a,src.images.get(a)],['other/'+a,src.images.get(b)]])});
  const fallback=await run({...src,images:new Map(pages.map(n=>['dir/'+n,src.images.get(n)]))});
  return {pages,duplicate,reuse,exact,fallback}
 });
 console.log(JSON.stringify(result));
 A.equal(result.pages.length,2);A.match(result.duplicate.error||'',/Duplicate atlas page/i);A.equal(result.duplicate.decoded,0);
 A.match(result.reuse.error||'',/Texture reused/i);A.equal(result.reuse.decoded,0);
 A.equal(result.exact.accepted,true);A.equal(result.fallback.accepted,true);
 A.deepEqual(errors,[]);A.deepEqual(network,[]);
 console.log('PASS real atlas one-to-one page assignment');
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
