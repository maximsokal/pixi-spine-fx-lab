'use strict';
function run(read,A,T){
 const vendor='assets/template/vendor/',doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const modules=[['electric-aura/aura-pose','FxAuraPose'],['energy-projectile/energy-pose','FxEnergyPose'],['hit-sparks/hit-sparks-pose','FxHitSparksPose'],['muzzle-flash/muzzle-pose','FxMuzzlePose'],['sword-slash/sword-slash-pose','FxSwordSlashPose'],['chain-lightning/chain-session','FxChainSession']];
 const g={},base={animation:'',skin:'',speed:1,visible:true};
 const close=(a,b)=>{A.equal(a.length,b.length);for(let i=0;i<a.length;i++)A.ok(Math.abs(a[i]-b[i])<=1e-7, a[i]+' != '+b[i]);};
 function rig(){
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',x:20,length:40}],physics:[{name:'lag',bone:'weapon',x:1,y:1,rotate:1,step:60,inertia:1,strength:20,damping:.7,wind:5,gravity:3}],animations:{idle:{bones:{root:{translate:[{x:0},{time:.5,x:80},{time:1,x:0}]}}}}};
  const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false});return {model,animations:['idle'],skins:['default']};
 }
 function coordinates(m){const b=m.skeleton.findBone('weapon');return [b.worldX,b.worldY,b.a,b.b,b.c,b.d,m.skeleton.time];}
 const loader={anchorPoses:coordinates};
 function oracle(o,frame){
  const {model:m}=rig();try{
   m.state.clearTracks();m.skeleton.setSkin(null);if(o.skin)m.skeleton.setSkinByName(o.skin);m.skeleton.setToSetupPose();m.skeleton.time=0;
   for(const c of m.skeleton.physicsConstraints)c.reset();if(o.animation)m.state.setAnimation(0,o.animation,true);m.update(0);
   const steps=Math.max(1,Math.ceil(o.speed));if(o.speed>0)for(let i=0;i<frame;i++)for(let j=0;j<steps;j++)m.update(o.speed/(60*steps));
   return coordinates(m);
  }finally{m.destroy();}
 }
 for(const [path,key] of modules){
  const [dir,name]=path.split('/');new Function('globalThis',read('assets/'+dir+'/src/'+name+'.js'))(g);
  T(dir+': setup physics without animation matches independent runtime integration',()=>{
   A.equal(P.VERSION,'8.22.0');const a=rig(),b=rig(),pose=g[key].pose;
   try{
    const start=oracle(base,0),end=oracle(base,30);A.ok(Math.hypot(end[0]-start[0],end[1]-start[1])>1);
    for(const speed of [0,.5,1,2.5,4]){
     const o={...base,speed},expected=oracle(o,30);
     pose(a,.5,o,loader);close(coordinates(a.model),expected);A.equal(a.model.state.getCurrent(0),null);
     for(let f=0;f<=30;f++)pose(b,f/60,o,loader);close(coordinates(b.model),expected);
     pose(a,6/60,o,loader);close(coordinates(a.model),oracle(o,6));pose(a,.5,o,loader);close(coordinates(a.model),expected);
     pose(a,.5,{...o,visible:false},loader);close(coordinates(a.model),expected);A.equal(a.model.visible,false);
    }
   }finally{a.model.destroy();b.model.destroy();}
  });
  T(dir+': animated/setup transitions, speed zero and fractional seeks retain parity',()=>{
   const a=rig(),pose=g[key].pose;
   try{
    for(const [o,frame,t] of [[{...base,animation:'idle'},30,.5],[base,30,.5],[base,7,7.8/60],[{...base,speed:0},40,40/60],[{...base,speed:2.5,animation:'idle'},21,21/60],[{...base,speed:2.5},21,21/60],[base,0,0]]){
     pose(a,t,o,loader);close(coordinates(a.model),oracle(o,frame));A.equal(a.model.state.getCurrent(0)?.animation.name??'',o.animation);
    }
   }finally{a.model.destroy();}
  });
 }
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
