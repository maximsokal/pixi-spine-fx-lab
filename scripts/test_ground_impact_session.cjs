'use strict';
async function run(read,A,T){
 const b='assets/template/',fx='assets/ground-impact/src/',g={};
 for(const p of [...['curve','spacing','color'].map(k=>b+'src/'+k+'-core.js'),...['core','anchors','runtime','authoring','pose','session'].map(k=>fx+'ground-impact-'+k+'.js')])new Function('globalThis',read(p))(g);
 const H=g.FxGroundImpact,Q=g.FxGroundImpactPose,S=g.FxGroundImpactSession,R=g.FxGroundImpactRuntime;
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(b+'vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(b+'vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 function rig(physics=true){
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'tip',parent:'root',x:20,length:40}],skins:[{name:'default'},{name:'red'}],animations:{move:{bones:{root:{translate:[{x:0,y:0},{time:.5,x:80,y:15},{time:1,x:0,y:0}]}}}}};
  if(physics)data.physics=[{name:'lag',bone:'tip',x:1,y:1,inertia:1,strength:20,damping:.7,wind:5,gravity:3}];
  const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false});
  return {model,animations:['move'],skins:['default','red'],defaultSkin:'red',defaultAnimation:'move',destroy(){model.removeFromParent();model.destroy();}};
 }
 const opt={animation:'move',skin:'red',speed:1,visible:true},pos=a=>{const b=a.model.skeleton.findBone('tip');return [b.worldX,b.worldY,b.a,b.b,b.c,b.d];},near=(x,y)=>A.ok(Math.abs(x-y)<1e-6,x+' != '+y),equalPose=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
 function oracle(a,o,frames){const m=a.model,s=m.skeleton;s.setSkin(null);if(o.skin)s.setSkinByName(o.skin);s.setToSetupPose();s.time=0;for(const c of s.physicsConstraints)c.reset();if(o.animation)m.state.setAnimation(0,o.animation,true);m.update(0);const steps=Math.max(1,Math.ceil(o.speed));if(o.speed>0)for(let i=0;i<frames*steps;i++)m.update(o.speed/(60*steps));}
 await T('real physics independent fixed-step oracle, setup pose and speed changes',()=>{
  for(const animation of ['move',''])for(const speed of [0,.5,1,2.5,4]){const a=rig(),o=rig(),v={...opt,animation,speed};try{oracle(o,v,24);Q.seek(a,.4,v);equalPose(pos(a),pos(o));const first=pos(a);Q.seek(a,.4,v);equalPose(pos(a),first);Q.seek(a,.1,v);Q.seek(a,.4,v);equalPose(pos(a),first);Q.seek(a,.4,{...v,speed:1.5});Q.seek(a,.4,v);equalPose(pos(a),first);A.equal(a.model.visible,true);}finally{a.destroy();o.destroy();}}
 });
 await T('nonphysics absolute time, invalid names leave pose, skin and animation clear',()=>{
  const a=rig(false);try{Q.seek(a,.25,opt);near(pos(a)[0],60);Q.seek(a,.1,opt);near(pos(a)[0],36);const before=pos(a);A.throws(()=>Q.seek(a,.2,{...opt,skin:'bad'}));A.throws(()=>Q.seek(a,.2,{...opt,speed:5}));equalPose(pos(a),before);Q.seek(a,.2,{...opt,animation:'',skin:'',visible:false});near(pos(a)[0],20);A.equal(a.model.skeleton.skin,null);A.equal(a.model.state.getCurrent(0),null);A.equal(a.model.visible,false);}finally{a.destroy();}
 });
 function fixture(){
  const world=new P.Container(),behindHost=new P.Container(),models=new P.Container(),host=new P.Container();world.addChild(behindHost,models,host);const foreign=new P.Container();models.addChild(foreign);
  const assets=[],renderers=[];let load=async()=>{const a=rig();assets.push(a);return a;},fault=null,persist=false;
  const hit=k=>{if(fault===k){if(!persist)fault=null;throw Error('injected '+k);}};
  const runtime={createRenderer(args){hit('create');const f=R.createRenderer(args),wrapper={...f,destroy(){hit('dispose');f.destroy();},seek(t){hit('paint');return f.seek(t);},get settings(){return f.settings;},get meta(){return f.meta;},get sample(){return f.sample;},get missing(){return f.missing;},get owned(){return f.owned;}};renderers.push({f,roots:f.owned});return wrapper;}};
  const loader={create:s=>load(s)},c=H.defaults();c.contact.anchor={type:'bone',name:'tip',slot:''};c.contact.x=0;c.contact.y=0;const session=S.createSession({PIXI:P,Spine:Sp,world,host,behindHost,models,loader,runtime,initial:c});
  const source={name:'fixture.json',skeleton:Object.freeze({}),atlas:Object.freeze({}),images:new Map([['a.png',Object.freeze({})],['b.png',Object.freeze({})]])};
  return {session,source,world,models,host,behindHost,foreign,assets,renderers,setLoad:f=>load=f,fault(k,p=false){fault=k;persist=p;},clear(){fault=null;},close(){session.destroy();A.ok(renderers.every(x=>x.roots.front.destroyed&&x.roots.behind.destroyed));A.ok(assets.every(a=>a.model.destroyed));A.equal(models.children.length,1);A.equal(models.children[0],foreign);A.equal(foreign.destroyed,false);world.destroy({children:true});}};
 }
 await T('source replacement failure, busy and independent snapshots',async()=>{
  const f=fixture(),s=f.session;try{await s.replaceSource(f.source);s.seek(.4);const old=s.asset,settings=s.settings,sample=s.sample,original=pos(old);let resolve;f.setLoad(()=>new Promise(r=>{resolve=r;}));const next=s.replaceSource(f.source);A.equal(s.busy,true);A.throws(()=>s.seek(0),/busy/);f.source.images.clear();const a=rig();f.assets.push(a);f.fault('create');resolve(a);await A.rejects(next,/injected create/);A.equal(a.model.destroyed,true);A.equal(s.asset,old);A.equal(s.settings,settings);A.equal(s.sample,sample);equalPose(pos(old),original);A.equal(s.source.images.size,2);s.source.images.clear();A.equal(s.source.images.size,2);A.equal(s.busy,false);f.setLoad(async()=>{throw Error('corrupt second page');});await A.rejects(s.replaceSource(s.source),/corrupt second page/);A.equal(s.asset,old);A.equal(s.sample,sample);
   f.setLoad(async()=>{const a=rig();f.assets.push(a);return a;});await s.replaceSource(s.source);A.ok(old.model.destroyed);A.equal(s.seconds,.4);equalPose(pos(s.asset),original);await s.replaceSource(null);A.equal(s.asset,null);A.equal(s.source,null);A.deepEqual(s.missing,['ring','debris']);A.equal(s.seconds,.4);
  }finally{f.close();}
 });
 await T('configure and seek faults preserve accepted sample and pose, retry succeeds',async()=>{
  const f=fixture(),s=f.session;try{await s.replaceSource(f.source);s.seek(.2);const settings=s.settings,sample=s.sample,pose=pos(s.asset),n=JSON.parse(JSON.stringify(settings));n.gravity=900;f.fault('create');A.throws(()=>s.configure(n),/injected create/);A.equal(s.settings,settings);A.equal(s.sample,sample);f.fault('paint');A.throws(()=>s.seek(.4),/injected paint/);A.equal(s.seconds,.2);A.deepEqual(s.sample,sample);equalPose(pos(s.asset),pose);A.equal(s.broken,false);f.fault('paint');A.throws(()=>s.setOptions({...s.options,speed:2}),/injected paint/);A.equal(s.options.speed,1);equalPose(pos(s.asset),pose);s.configure(n);A.equal(s.settings.gravity,900);s.seek(.4);A.equal(s.seconds,.4);
  }finally{f.close();}
 });
 await T('failed rollback hides owned FX and model, no stale public sample',async()=>{
  const f=fixture(),s=f.session;try{await s.replaceSource(f.source);s.seek(.2);f.fault('paint',true);A.throws(()=>s.seek(.4),/rollback failed/);A.equal(s.broken,true);A.equal(s.sample,null);A.deepEqual(s.missing,[]);A.equal(s.seconds,.2);A.equal(s.asset.model.visible,false);A.ok(f.host.children.every(x=>!x.visible));A.ok(f.behindHost.children.every(x=>!x.visible));A.equal(f.foreign.visible,true);f.clear();A.throws(()=>s.configure(s.settings),/recreate/);
  }finally{f.close();}
 });
 await T('postcommit disposal failure hides old roots and exposes cleanup diagnostic',async()=>{
  const f=fixture(),s=f.session;try{await s.replaceSource(f.source);s.seek(.2);const old=f.renderers.at(-1).roots,n=JSON.parse(JSON.stringify(s.settings));n.gravity=800;f.fault('dispose');s.configure(n);A.equal(s.settings.gravity,800);A.equal(s.cleanupError,'injected dispose');A.equal(old.front.visible,false);A.equal(old.behind.visible,false);A.equal(s.broken,false);A.ok(s.sample.primitives>0);
  }finally{f.close();}
 });
 await T('late loader completion after destroy cannot publish or leak',async()=>{
  const f=fixture(),s=f.session;let resolve;f.setLoad(()=>new Promise(r=>{resolve=r;}));const pending=s.replaceSource(f.source);s.destroy();const a=rig();f.assets.push(a);resolve(a);await A.rejects(pending,/destroyed/);A.equal(a.model.destroyed,true);A.equal(s.asset,null);A.equal(s.sample,null);f.close();
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),cases=[];run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),(n,f)=>{cases.push([n,f]);}).then(()=>{for(const [n,f] of cases)require('node:test').test(n,f);}).catch(e=>{console.error(e);process.exitCode=1;});}
