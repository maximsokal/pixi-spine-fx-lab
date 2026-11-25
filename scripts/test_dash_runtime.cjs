'use strict';
// GAME-07 native offline acceptance. External official fixtures are required;
// see docs/teleport-dash-t02-renderer-plan.md for exact hashes and licenses.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),PNG=require('./fx_visual_png.cjs');
const repo=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2',official=process.argv[3],extras=process.argv[4];
const count=p=>{const a=PNG.countAlpha(PNG.decodePng(Buffer.from(p,'base64')));return a.partial+a.opaque;};
const diff=(a,b)=>PNG.comparePixels(PNG.decodePng(Buffer.from(a,'base64')),PNG.decodePng(Buffer.from(b,'base64')),{step:1,channelTolerance:0}).changedPixels;
function fixture(dir,name,atlas,pages,animation,skin,hashes=[]){
 A.ok(dir,'external fixture directory required');
 const files=Object.fromEntries([name,atlas,...pages].map((n,i)=>{const b=fs.readFileSync(path.join(dir,n));if(hashes[i])A.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),hashes[i],n);return [n,b.toString('base64')];}));
 return {name,atlas,pages,animation,skin,files};
}
async function main(){
 A.ok(['webgl1','webgl2','webgpu'].includes(backend));
 const fixtures=[
 fixture(path.join(repo,'assets/template/sample'),'Doctor_head.json','Doctor_head.atlas',['Doctor_head.png','Doctor_head_2.png'],'attack_1'),
 fixture(official,'spineboy-pro.skel','spineboy.atlas',['spineboy.png'],'run',undefined,['09e564b7edc42fe37be66a4a0391862071ed948a','eca542b711e7e140de85efac07b1bccbda07c5f5','0ea9737f30707915e0bf495cdf987c6511dc0500']),
 fixture(extras,'cloud-pot.json','cloud-pot.atlas',['cloud-pot.png'],'pot-moving-followed-by-rain',undefined,['75fc72a213b978b1b82cf7133de0a0487fab61db','d7e313052a65eb2853473e2c1d233ac8da61f0be','cb5ef99a1a148e04e1d149287f33e45ba6689da7']),
 fixture(extras,'mix-and-match-pro.json','mix-and-match.atlas',['mix-and-match.png'],'walk','full-skins/boy',['1b98ebbedba4a09968a7a32175259d3e31a3c784','b8047722c742d14900a481e33278189c990bee37','634a1e230b81d96c469c3ad7800c9a49f2849ac9'])];
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{const page=await browser.newPage({offline:true}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
 for(const f of ['assets/template/vendor/pixi-8.22.0.min.js','assets/template/vendor/spine-pixi-v8-4.2.120.min.js',...['curve','spacing','path','color'].map(n=>'assets/template/src/'+n+'-core.js'),...['core','spine','runtime'].map(n=>'assets/teleport-dash/src/dash-'+n+'.js')])await page.addScriptTag({path:path.join(repo,f)});
 for(const fixture of fixtures){
 const r=await page.evaluate(async ({backend,fixture})=>{
  const app=new PIXI.Application();await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
  const actual=app.renderer.gl?(app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu',host=new PIXI.Container();app.stage.addChild(host);
  const blob=n=>new Blob([Uint8Array.from(atob(fixture.files[n]),c=>c.charCodeAt(0))],{type:n.endsWith('.png')?'image/png':'application/octet-stream'});
  const input={name:fixture.name,skeleton:blob(fixture.name),atlas:blob(fixture.atlas),images:new Map(fixture.pages.map(n=>[n,blob(n)]))};
  const asset=await FxDashSpine.create(input,globalThis,fixture.skin?{skin:fixture.skin}:{}),source=asset.model,options={animation:fixture.animation,skin:asset.defaultSkin,speed:1,loop:true,visible:true};
  host.addChild(source);
  const snap=m=>JSON.stringify({bones:m.skeleton.bones.map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]),slots:m.skeleton.slots.map(s=>[s.attachment?.name,s.sequenceIndex,s.color.r,s.color.g,s.color.b,s.color.a,Array.from(s.deform)]),skin:m.skeleton.skin?.name,track:m.state.getCurrent(0)?.trackTime,time:m.skeleton.time});
  const shot=async()=>{app.render();return (await app.renderer.extract.base64({target:app.stage,frame:new PIXI.Rectangle(0,0,512,512),format:'png'})).split(',')[1];};
  // Independent continuous replay oracle, not another call to poseAt.
  source.state.clearTracks();source.skeleton.setSkin(null);source.skeleton.setSkinByName(options.skin);source.skeleton.setToSetupPose();source.skeleton.time=0;for(const c of source.skeleton.physicsConstraints)c.reset();source.state.setAnimation(0,options.animation,true);source.update(0);for(let i=0;i<30;i++)source.update(1/60);
  const liveState=snap(source),live=await shot(),oracle=asset.createClone();
  asset.poseAt(.5,options,oracle);const stateParity=snap(oracle)===liveState;source.visible=false;host.addChild(oracle);const parity=await shot();asset.poseAt(.75,options,oracle);asset.poseAt(.5,options,oracle);const repeatPose=await shot(),repeatState=snap(oracle)===liveState;asset.releaseClone(oracle);
  const c=FxDash.defaults();c.emitters[0].x=170;c.emitters[0].y=256;
  const only=(kind,mode='dash')=>{const s=structuredClone(c);s.mode=mode;for(const l of Object.keys(s.emitters[0].layers))s.emitters[0].layers[l].enabled=l===kind;return s;};
  const fx=FxDashRuntime.createDash({PIXI,host,settings:c,asset,poseOptions:options});
  const at=async f=>{fx.seek(f/60);return shot();};
  const first=await at(0),last=await at(39),middle=await at(15);
  const n=fx.totalCreated;for(const fps of [30,60,120])for(let i=0;i<fps;i++)fx.seek(i/fps);const repeat=await at(15),poolStable=fx.totalCreated===n;
  fx.configure(only('trail'));const trail=await at(24);
  const step=only('trail');step.progressCurve.keys=[{id:'k0',x:0,y:0,mode:'linear'},{id:'k1',x:.25,y:.2,mode:'stepped'},{id:'k2',x:.5,y:.8,mode:'linear'},{id:'k3',x:1,y:1,mode:'linear'}];fx.configure(step);const stepped=await at(30),runs=fx.sample.emitters[0].layers.trail.length;
  fx.configure(only('flash','teleport'));const flash=await at(c.teleportFrame);
  fx.configure(only('trail','teleport'));const teleportTrail=await at(c.teleportFrame);
  fx.configure(only('particles'));const particles=await at(15);
  fx.configure(only('echoes'));const echo=await at(15);
  const views=fx.owned.children[0].children.find(x=>x.label==='echoes').children,visible=views.filter(x=>x.visible),descriptors=fx.sample.emitters[0].layers.echoes;
  const ownState=visible.every((v,i)=>{const ref=asset.createClone();try{asset.poseAt(descriptors[i].sourceSeconds,options,ref);return snap(v)===snap(ref)&&v.skeleton!==source.skeleton&&v.skeleton.data===source.skeleton.data;}finally{asset.releaseClone(ref);}});
  const bone=only('echoes');bone.emitters[0].anchor={type:'bone',name:asset.bones[0]};bone.emitters[0].x=0;bone.emitters[0].y=0;bone.emitters[0].scale=.75;bone.emitters[0].rotation=25;fx.configure(bone);const bonePixels=await at(15),boneViews=fx.owned.children[0].children.find(x=>x.label==='echoes').children.filter(x=>x.visible),boneDesc=fx.sample.emitters[0].layers.echoes;
  const anchorParity=boneViews.every((m,i)=>{const b=boneDesc[i],F=asset.anchorAt(b.birthSeconds,options)[asset.bones[0]],M=asset.fit,s=b.scale/F.scale,a=(b.rotation-F.rotation)*Math.PI/180,x=(M.x-F.x)*s,y=(M.y-F.y)*s;return Math.abs(m.x-(b.x+x*Math.cos(a)-y*Math.sin(a)))<1e-6&&Math.abs(m.y-(b.y+x*Math.sin(a)+y*Math.cos(a)))<1e-6&&Math.abs(m.scale.x-M.scale*s)<1e-6;});
  const before=fx.owned;let refused=false;try{fx.configure({...c,trailWidth:NaN});}catch{refused=true;}const rollback=await at(15),preserved=fx.owned===before;
  const sourceUnchanged=snap(source)===liveState;
  fx.configure(only('echoes'),{asset:null});const noAsset=await at(15),diagnostic=fx.sample.diagnostics.some(x=>x.reason.includes('no Spine asset'));
  fx.configure(only('none'));const off=await at(15);
  fx.destroy();fx.destroy();const clean=asset.cloneCount===0&&!host.destroyed&&!source.destroyed;source.visible=true;const after=await shot();
  let skinChanged=null,skinIsolated=true,fallback=null;
  if(fixture.skin){const alternate=asset.createClone();source.visible=false;host.addChild(alternate);asset.poseAt(.5,{...options,skin:'full-skins/girl'},alternate);skinChanged=await shot();skinIsolated=snap(source)===liveState;asset.releaseClone(alternate);const auto=await FxDashSpine.create(input);fallback=auto.defaultSkin;auto.destroy();}
  const physics=source.skeleton.physicsConstraints.length;asset.destroy();app.destroy();
  return {actual,first,last,middle,repeat,trail,stepped,runs,flash,teleportTrail,particles,echo,bonePixels,rollback,noAsset,off,live,parity,repeatPose,after,skinChanged,skinIsolated,fallback,physics,stateParity,repeatState,poolStable,ownState,echoCount:visible.length,anchorParity,refused,preserved,sourceUnchanged,diagnostic,clean};
 },{backend,fixture});
 A.equal(r.actual,backend);
 for(const k of ['first','last','teleportTrail','noAsset','off'])A.equal(count(r[k]),0,fixture.name+' '+k);
 for(const k of ['middle','trail','stepped','flash','particles','echo','bonePixels'])A.ok(count(r[k])>10,fixture.name+' '+k+' '+count(r[k]));
 for(const k of ['stateParity','repeatState','poolStable','ownState','anchorParity','refused','preserved','sourceUnchanged','diagnostic','clean','skinIsolated'])A.equal(r[k],true,fixture.name+' '+k);
 A.ok(r.echoCount>0);A.equal(r.runs,2);
 const gap=PNG.decodePng(Buffer.from(r.stepped,'base64'));let bridge=0;
 for(let y=0;y<gap.height;y++)for(let x=220;x<290;x++)if(gap.pixels[(y*gap.width+x)*4+3])bridge++;
 A.equal(bridge,0,'stepped teleport must have no rendered pixels between continuous runs');A.equal(diff(r.middle,r.repeat),0);A.equal(diff(r.bonePixels,r.rollback),0);
 for(const k of ['parity','repeatPose','after'])A.equal(diff(r.live,r[k]),0,fixture.name+' '+k);
 if(fixture.name==='cloud-pot.json')A.equal(r.physics,26);
 if(fixture.skin){A.ok(diff(r.live,r.skinChanged)>100);A.ok(r.fallback&&r.fallback!=='default');}
 A.deepEqual(errors,[]);A.deepEqual(network,[]);
 console.log('PASS GAME-07 native '+JSON.stringify({backend,asset:fixture.name,physics:r.physics,echoes:r.echoCount,trail:count(r.trail),flash:count(r.flash),particles:count(r.particles),echo:count(r.echo),bone:count(r.bonePixels),skinFallback:r.fallback,bridgePixels:bridge,repeatDiff:diff(r.middle,r.repeat),sourceDiff:diff(r.live,r.after)}));
 }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
