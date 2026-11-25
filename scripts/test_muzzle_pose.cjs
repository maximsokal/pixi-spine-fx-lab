'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),P=require('../assets/muzzle-flash/src/muzzle-pose.js');
function fixture(physics=true){
 const calls=[],skeleton={time:0,skin:null,physicsConstraints:[],setSkin(s){this.skin=s;},setSkinByName(name){this.skin={name};},setToSetupPose(){calls.push('setup');}},state={clearTracks(){calls.push('clear');},setAnimation(i,name,loop){calls.push(['animation',i,name,loop]);}};
 let value=0;if(physics)skeleton.physicsConstraints.push({reset(){value=0;calls.push('reset');}});
 const model={skeleton,state,visible:true,update(dt){skeleton.time+=dt;value=value*.9+dt*(1+skeleton.time);calls.push(dt);},updateLocalTransform(){}};
 const asset={model},loader={pose(a,t,o){calls.push('legacy');return {time:t,options:o};},anchorPoses(){return {value,time:skeleton.time};}};return {asset,loader,calls,model};
}
const o={animation:'shoot',skin:'default',speed:1,visible:true};
const run=(f,t,opts=o)=>P.pose(f.asset,t,opts,f.loader);
test('direct seek, sequential playback, backward seek and replay match',()=>{const a=fixture(),b=fixture();for(let i=0;i<=30;i++)run(a,i/60);const expected=run(b,.5);A.deepEqual(run(a,.5),expected);run(a,3/60);A.deepEqual(run(a,.5),expected);A.deepEqual(run(a,0),run(fixture(),0));});
test('same frame never advances twice; visibility does not reset physics',()=>{const f=fixture();run(f,0);run(f,1/60);run(f,1.5/60,{...o,visible:false});A.deepEqual(f.calls.filter(x=>typeof x==='number'),[0,1/60]);A.equal(f.model.visible,false);A.equal(f.calls.filter(x=>x==='reset').length,1);});
test('zero speed freezes; high speed subdivides; speed changes replay',()=>{const f=fixture();A.deepEqual(run(f,1,{...o,speed:0}),run(fixture(),0,{...o,speed:0}));A.deepEqual(f.calls.filter(x=>typeof x==='number'),[0]);run(f,2/60,{...o,speed:4});A.deepEqual(f.calls.filter(x=>typeof x==='number'),[0,0,...Array(8).fill(1/60)]);A.deepEqual(run(f,.25,{...o,speed:.5}),run(fixture(),.25,{...o,speed:.5}));});
test('skin and animation changes restart; setup pose resets',()=>{const f=fixture();run(f,.5);run(f,.5,{...o,skin:'other'});run(f,.5,{...o,animation:'idle'});A.equal(f.calls.filter(x=>x==='reset').length,3);A.deepEqual(run(f,.5,{...o,animation:'',skin:''}),run(fixture(),0,{...o,animation:'',skin:''}));A.equal(f.model.skeleton.skin,null);});
test('invalid options do not mutate; failed update forces replay',()=>{const f=fixture();for(const [t,opt] of [[-1,o],[61,o],[0,{...o,speed:-1}],[0,{...o,speed:5}],[NaN,o]])A.throws(()=>run(f,t,opt));A.equal(f.calls.length,0);const old=f.model.update;f.model.update=dt=>{if(dt)throw Error('step');old.call(f.model,dt);};A.throws(()=>run(f,1/60),/step/);f.model.update=old;A.deepEqual(run(f,1/60),run(fixture(),1/60));});
test('nonphysics rigs keep exact fractional time and absent asset is a no-op',()=>{const f=fixture(false);A.deepEqual(run(f,.123),{time:.123,options:o});A.deepEqual(P.pose(null,0,o,f.loader),{});});
