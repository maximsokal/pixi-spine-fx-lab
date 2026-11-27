'use strict';
// Run real pinned CPU Spine/Pixi objects; this is not a GPU test.
function run(read,A,test){
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read('assets/template/vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read('assets/template/vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const g={};for(const p of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/snowfall/src/snow-core.js','assets/template/src/timeline-core.js','assets/snowfall/src/snow-pose.js'])new Function('globalThis',read(p))(g);
 const H=g.FxSnow,Q=g.FxSnowPose,settings=H.defaults(),options={animation:'move',skin:'red'},near=(a,b)=>A.ok(Math.abs(a-b)<1e-6,a+' != '+b);
 function rig(physics=true){
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'tip',parent:'root',x:20,length:40}],skins:[{name:'default'},{name:'red'}],animations:{move:{bones:{root:{translate:[{x:0,y:0},{time:.5,x:80,y:15},{time:1,x:0,y:0}]}}}}};
  if(physics)data.physics=[{name:'lag',bone:'tip',x:1,y:1,inertia:1,strength:20,damping:.7,wind:5,gravity:3}];
  return new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false});
 }
 const pos=m=>{const b=m.skeleton.findBone('tip');return [b.worldX,b.worldY];};
 const eq=(a,b)=>{near(a[0],b[0]);near(a[1],b[1]);};
 test('fixed physics seek equals independently stepped actual Spine, unlike old timeline',()=>{
  const model=rig(),oracle=rig(),old=rig();try{
   for(const m of [oracle,old]){m.skeleton.setSkinByName('red');m.skeleton.setToSetupPose();m.state.setAnimation(0,'move',true);m.update(0);}
   for(let i=0;i<24;i++)oracle.update(1/60);
   g.FxTimeline.seekSpine(old,.4);Q.seek(model,settings,.4,options);
   A.ok(Math.hypot(...pos(old).map((x,i)=>x-pos(oracle)[i]))>1e-3,'RED oracle differs');
   eq(pos(model),pos(oracle));const same=pos(model);Q.seek(model,settings,.4,options);eq(pos(model),same);
   Q.seek(model,settings,.1,options);Q.seek(model,settings,.4,options);eq(pos(model),same);
   Q.seek(model,settings,1.4,options);eq(pos(model),same);
   Q.seek(model,settings,0,options);Q.seek(model,settings,.4,options);eq(pos(model),same);
  }finally{model.destroy();oracle.destroy();old.destroy();}
 });
 test('nonphysics absolute time, clearing skin and animation, invalid-name recovery',()=>{
  const m=rig(false),fresh=rig(false);try{Q.seek(m,settings,.25,options);near(m.skeleton.findBone('tip').worldX,60);Q.seek(m,settings,.1,options);near(m.skeleton.findBone('tip').worldX,36);
   A.throws(()=>Q.seek(m,settings,.2,{...options,skin:'missing'}));Q.seek(m,settings,.3,options);Q.seek(fresh,settings,.3,options);eq(pos(m),pos(fresh));
   A.throws(()=>Q.seek(m,settings,.2,{...options,animation:'missing'}));Q.seek(m,settings,.3,options);eq(pos(m),pos(fresh));
   Q.seek(m,settings,.3);near(m.skeleton.findBone('tip').worldX,20);A.equal(m.skeleton.skin,null);A.equal(m.state.getCurrent(0),null);
  }finally{m.destroy();fresh.destroy();}
 });
 test('loop/export time parity and one-shot stop, including fractional and repeated frames',()=>{
  for(const c of [settings,{...settings,mode:'oneShot',durationFrames:40,exportFrames:80}]){
   const plan=H.createPlan(c);for(let i=0;i<120;i++){const t=i/60;near(Q.time(c,t),plan.sample(t).time);}
  }A.equal(Q.time(settings,1),0);A.equal(Q.time(settings,2.25),.25);A.throws(()=>Q.time(settings,-1));A.throws(()=>Q.time(settings,NaN));
 });
 test('all production consumers and standalone module use the same pose implementation',()=>{
  const ed=read('assets/snowfall/src/snow-editor.js'),ex=read('assets/snowfall/src/snow-export.js'),build=read('scripts/build_snow_editor.py');
  A.ok(ed.includes('FxSnowPose.seek(s.model,session.settings,t'));A.ok(ed.includes('FxSnowPose.seek(sp.model,settings,0'));A.ok(ex.includes('root.FxSnowPose.seek(scene.model,settings,f.timeSeconds,asset)'));A.ok(ex.includes("source('fxSnowPose')"));A.ok(ex.includes('FxSnowPose.seek(model,settings,t,p.asset)'));A.ok(build.includes('"snow-pose.js", "fxSnowPose"'));A.ok(!ed.includes('FxTimeline.seekSpine')&&!ex.includes('FxTimeline.seekSpine'));
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
