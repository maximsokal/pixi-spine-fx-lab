'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const P=require('../assets/magic-shield/src/shield-physics.js');
function fixture(physics=true){
 const calls=[],skeleton={time:0,skin:null,physicsConstraints:[],setSkin(s){this.skin=s;calls.push('clear skin');},setSkinByName(name){this.skin={name};calls.push('skin '+name);},setToSetupPose(){calls.push('setup');}},state={clearTracks(){calls.push('clear tracks');},setAnimation(i,name,loop){calls.push(['animation',i,name,loop]);}};
 let value=0; if(physics)skeleton.physicsConstraints.push({reset(){value=0;calls.push('reset');}});
 const model={skeleton,state,visible:true,update(dt){skeleton.time+=dt;value=value*.9+dt*(1+skeleton.time);calls.push(dt);},updateLocalTransform(){calls.push('transform');}};
 const asset={model},loader={pose(a,t,o){calls.push('legacy');return {legacy:t};},anchorPoses(){return {bone:{x:value,time:skeleton.time}};}};
 return {asset,loader,calls,model};
}
const o={animation:'idle',skin:'default',speed:1,visible:true};
const run=(f,t,opts=o)=>P.pose(f.asset,t,opts,f.loader);
test('direct seek equals sequential replay; reverse and loop restart physics',()=>{const a=fixture(),b=fixture();for(let i=0;i<=40;i++)run(a,i/60);const expected=run(b,40/60);A.deepEqual(run(a,40/60),expected);run(a,5/60);A.deepEqual(run(a,40/60),expected);A.deepEqual(run(a,0),run(fixture(),0));A.equal(a.model.skeleton.time,0);});
test('forward seek only advances missing fixed steps and same frame does not step again',()=>{const f=fixture();run(f,0);run(f,1/60);run(f,2/60);run(f,2.5/60);A.deepEqual(f.calls.filter(x=>typeof x==='number'),[0,1/60,1/60]);A.equal(f.calls.filter(x=>x==='reset').length,1);});
test('speed above one subdivides steps; fractional speed and visibility independent',()=>{const f=fixture();run(f,2/60,{...o,speed:4});A.deepEqual(f.calls.filter(x=>typeof x==='number'),[0,...Array(8).fill(1/60)]);const a=run(f,3/60,{...o,speed:.5,visible:false});A.deepEqual(a,run(fixture(),3/60,{...o,speed:.5}));A.equal(f.model.visible,false);A.ok(Math.abs(f.model.skeleton.time-.025)<1e-12);});
test('skin/animation changes reset state, setup pose clears previous simulation',()=>{const f=fixture();run(f,1);run(f,1,{...o,skin:'other'});A.equal(f.calls.filter(x=>x==='reset').length,2);const setup=run(f,1,{...o,animation:'',skin:''});A.deepEqual(setup,run(fixture(),0,{...o,animation:'',skin:''}));A.equal(f.model.skeleton.skin,null);});
test('nonphysics path unchanged and no asset remains empty',()=>{const f=fixture(false);A.deepEqual(run(f,.123),{legacy:.123});A.deepEqual(P.pose(null,0,o,f.loader),{});});
test('invalid requests reject before mutations; failed step forces clean replay',()=>{const f=fixture();for(const [t,opt] of [[-1,o],[61,o],[0,{...o,speed:5}],[NaN,o]])A.throws(()=>run(f,t,opt));A.equal(f.calls.length,0);const update=f.model.update;f.model.update=dt=>{if(dt)throw Error('update failed');update.call(f.model,dt);};A.throws(()=>run(f,1/60),/update failed/);f.model.update=update;A.deepEqual(run(f,1/60),run(fixture(),1/60));});
