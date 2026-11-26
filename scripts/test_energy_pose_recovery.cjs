'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const {pose}=require('../assets/energy-projectile/src/energy-pose.js');
// Stateful Spine API fixture: mutations occur before invalid-name exceptions.
// This checks pose/cache recovery, not rendering or actual Spine rasterization.
function fixture(physics=false){
 let entry=null,x=0,starts=0,failure='';
 const skeleton={skin:null,time:0,physicsConstraints:physics?[{reset(){x=0;}}]:[],
  setSkin(v){this.skin=v;},setSkinByName(name){if(name!=='red'&&name!=='blue')throw Error('missing skin');this.skin={name};},setToSetupPose(){x=0;}};
 const state={clearTracks(){entry=null;},setAnimation(i,name,loop){if(name!=='idle'&&name!=='run')throw Error('missing animation');entry={animation:{name},trackTime:0};starts++;return entry;},getCurrent(){return entry;}};
 const model={skeleton,state,visible:true,update(dt){skeleton.time+=dt;if(entry){entry.trackTime+=dt;x=entry.trackTime*(entry.animation.name==='idle'?100:200);}
  if(failure==='update'){failure='';state.clearTracks();throw Error('injected update failure');}},updateLocalTransform(){}};
 const loader={anchorPoses(){if(failure==='anchor'){failure='';state.clearTracks();throw Error('injected anchor failure');}return {bone:{x,skin:skeleton.skin?.name??null}};}};
 return {asset:{model},loader,fail(v){failure=v;},get starts(){return starts;}};
}
const base={animation:'idle',skin:'red',speed:1,visible:true};
const seek=(f,t,options={})=>pose(f.asset,t,{...base,...options},f.loader);
for(const [kind,options] of [['skin',{skin:'missing'}],['animation',{animation:'missing'}]])test('nonphysics recovers previous pose after failed '+kind+' switch',()=>{
 const f=fixture();seek(f,.1);A.throws(()=>seek(f,.2,options),/missing/);
 A.deepEqual(seek(f,.3),seek(fixture(),.3));A.equal(f.asset.model.state.getCurrent(0).animation.name,'idle');
});
for(const point of ['update','anchor'])test('nonphysics invalidates cached pose after '+point+' failure',()=>{
 const f=fixture();seek(f,.1);f.fail(point);A.throws(()=>seek(f,.2),/injected/);
 A.deepEqual(seek(f,.3),seek(fixture(),.3));
});
test('valid seeks preserve track reuse and absolute time, including speed zero',()=>{
 const f=fixture();A.equal(seek(f,.5).bone.x,50);A.equal(seek(f,.1).bone.x,10);
 A.equal(seek(f,.25,{speed:2}).bone.x,50);A.equal(seek(f,.9,{speed:0}).bone.x,0);A.equal(f.starts,1);
 A.equal(seek(f,.25,{animation:'run',skin:'blue',visible:false}).bone.x,50);A.equal(f.starts,2);A.equal(f.asset.model.visible,false);
});
test('validation before mutation leaves a valid track intact',()=>{
 const f=fixture();seek(f,.1);A.throws(()=>seek(f,-1),/Invalid/);A.equal(seek(f,.4).bone.x,40);A.equal(f.starts,1);
});
test('physics reset path still recovers and reverse seek matches a fresh model',()=>{
 const f=fixture(true);seek(f,10/60);A.throws(()=>seek(f,12/60,{skin:'missing'}),/missing/);
 A.deepEqual(seek(f,5/60),seek(fixture(true),5/60));A.deepEqual(seek(f,2/60),seek(fixture(true),2/60));
});
