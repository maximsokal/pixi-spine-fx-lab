#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const T=require('../assets/template/src/timeline-core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
assert.equal(T.FPS,60);
const p=T.createPrng(8),seq=Array.from({length:20},()=>p.next());
const s=p.state;p.reset();assert.deepEqual(Array.from({length:20},()=>p.next()),seq);assert.equal(p.state,s);
assert.notDeepEqual(Array.from({length:20},()=>T.createPrng(1).next()),seq);
const q=T.createPrng(8);q.setState(s);assert.equal(q.next(),p.next());
assert.throws(()=>T.createPrng(2.5),/int32/);
let tr=T.createTransport({duration:3,time:.5});
assert.equal(tr.state.time,.5);close(tr.tick(.5).time,.5);
tr.play();close(tr.tick(.1).time,.6);tr.pause();close(tr.tick(3).time,.6);
tr.play(-1);close(tr.tick(.3).time,.3);
tr.setLoop(true);close(tr.tick(.6).time,2.7);tr.setLoop(false);close(tr.tick(3).time,0);
assert.equal(tr.state.playing,false);
tr.reset();assert.equal(tr.state.time,0);
tr.seek(2.4);close(tr.state.phase,.8);
tr.play(1);close(tr.tick(30).time,3);assert.equal(tr.state.playing,false);
assert.throws(()=>tr.seek(4),/seek/);
assert.throws(()=>tr.tick(-1),/elapsed/);
assert.deepEqual(T.domains({effectTime:2,emitterOffset:1,particleBirth:1.5,
 particleLife:1,pathDistance:30,pathLength:120,spineTime:10}),{
 effectTime:2,emitterLocalTime:1,particleAge:.5,pathPosition:.25,spineAnimationTime:10});
assert.throws(()=>T.domains({effectTime:1,particleLife:0}),/particleLife/);
const renders=[],deltas=[];
let state={elapsed:0,value:0,rng:42};
const replay=T.createReplay({capture:()=>state,restore:v=>{state=v},step:(dt,time,index)=>{
 deltas.push(dt);state.elapsed=time;state.value+=index/17;state.rng=(state.rng+index)|0;
},partial:(dt,time)=>{state.elapsed=time;state.value+=dt*17;},render:time=>renders.push(time)});
const sample30=replay.seek(30);const a=structuredClone(state);
assert.ok(sample30.checkpointCount<=64);
assert.equal(replay.checkpointFrames.at(-1),1800);
replay.seek(10);const mid=structuredClone(state);
replay.seek(30);assert.deepEqual(state,a,'30 -> 10 -> 30 must restore identical state');
replay.seek(10);assert.deepEqual(state,mid);
const x=replay.seek(10.123).fraction;close(x,10.123-607/60);
const fractionState=structuredClone(state);
replay.seek(10.123);assert.deepEqual(state,fractionState,'fractional seek idempotent');
replay.seek(10);assert.deepEqual(state,mid);
const all=[30,60,120].map(fps=>{
 let result;
 const times=Array.from({length:Math.floor(2*fps)+1},(_,i)=>i/fps);
 for(const seconds of times)result=replay.seek(seconds);
 return {result,state:structuredClone(state)};
});
assert.deepEqual(all[0].state,all[1].state);assert.deepEqual(all[1].state,all[2].state);
const clock60=T.createTransport({duration:2,playing:true});
const seqFrames=[];for(let i=0;i<120;i++)seqFrames.push(clock60.tick(1/60).time);
close(seqFrames[0],1/60);close(seqFrames[119],2);
assert.equal(clock60.state.playing,false);
for(const i of [0,39,3599])close(i/60,T.createReplay({
 capture:()=>({}),restore:()=>{},step:()=>{}}).seek(i/60).seconds);
replay.seek(3100/60);assert.ok(replay.checkpointCount<=64);
replay.invalidate();assert.deepEqual(state,{elapsed:0,value:0,rng:42});
assert.equal(replay.time,0);assert.deepEqual(replay.checkpointFrames,[0]);
assert.ok(renders.length>0&&deltas.every(t=>t===1/60));
console.log('PASS FX-CORE-05 transport seconds, reverse/pause/loop, PRNG, 30/60/120 FPS, fractional seek, 30→10→30, 64 checkpoints, 3600 frame indexing');

// A fractional duration is authoritative even within the frame-snap epsilon.
const {test}=require('node:test');
for(const duration of [1-5e-10,1+5e-10]){
 test('constructor preserves exact endpoint '+duration,()=>{
  const state=T.createTransport({duration,time:duration}).state;
  assert.equal(state.time,duration);assert.equal(state.phase,1);
 });
 test('seek preserves exact endpoint '+duration,()=>{
  const clock=T.createTransport({duration});
  const state=clock.seek(duration);
  assert.equal(state.time,duration);assert.equal(state.phase,1);
 });
 test('forward tick stops at exact endpoint '+duration,()=>{
  const clock=T.createTransport({duration,playing:true});
  const state=clock.tick(2);
  assert.equal(state.time,duration);assert.equal(state.phase,1);assert.equal(state.playing,false);
 });
}
test('near-end seek cannot round past fractional duration',()=>{
 const duration=1-5e-10,time=1-7e-10;
 const state=T.createTransport({duration}).seek(time);
 assert.equal(state.time,time);assert.ok(state.phase<1);
});
test('looping forward tick stays inside fractional duration',()=>{
 const duration=1-5e-10,time=1-7e-10;
 const clock=T.createTransport({duration,loop:true,playing:true});
 const state=clock.tick(time);
 assert.equal(state.time,time);assert.ok(state.phase<1);assert.equal(state.playing,true);
});
test('looping reverse exact wrap preserves fractional endpoint',()=>{
 const duration=1+5e-10;
 const clock=T.createTransport({duration,direction:-1,loop:true,playing:true});
 const state=clock.tick(duration);
 assert.equal(state.time,duration);assert.equal(state.phase,1);assert.equal(state.playing,true);
});
test('in-range frame snap and forward loop seam remain unchanged',()=>{
 const clock=T.createTransport({duration:2,loop:true,playing:true});
 assert.equal(clock.seek(1-5e-10).time,1);
 assert.equal(clock.tick(1).time,0);
});

// Replay must never simulate a whole frame later than its canonical seek time.
function replayProbe(fps,maxSeconds=3600){
 let snapshot={steps:[],parts:[]};
 const instance=T.createReplay({fps,maxSeconds,capture:()=>snapshot,restore:value=>{snapshot=value;},
  step:(dt,time,index)=>snapshot.steps.push({dt,time,index}),
  partial:(dt,time,index)=>snapshot.parts.push({dt,time,index})});
 return {instance,get snapshot(){return snapshot;}};
}
test('120 FPS seek just before a frame does not execute that frame',()=>{
 const probe=replayProbe(120),seconds=1/120-5e-12;
 const result=probe.instance.seek(seconds);
 assert.equal(result.frame,0);assert.equal(result.fraction,seconds);
 assert.deepEqual(probe.snapshot,{steps:[],parts:[{dt:seconds,time:seconds,index:0}]});
});
test('120 FPS seek preserves a small real remainder after an off-grid frame',()=>{
 const probe=replayProbe(120),seconds=1/120+5e-10;
 const result=probe.instance.seek(seconds);
 assert.equal(result.frame,1);assert.equal(result.fraction,seconds-1/120);
 assert.deepEqual(probe.snapshot.parts,[{dt:seconds-1/120,time:seconds,index:1}]);
});
test('repeated and backward fractional seeks do not accumulate partial state',()=>{
 const probe=replayProbe(120),seconds=1/120+5e-10;
 probe.instance.seek(seconds);const expected=structuredClone(probe.snapshot);
 assert.equal(expected.parts.length,1);
 probe.instance.seek(0.1);probe.instance.seek(seconds);
 assert.deepEqual(probe.snapshot,expected);
 probe.instance.seek(seconds);assert.deepEqual(probe.snapshot,expected);
 probe.instance.seek(1/120);assert.equal(probe.snapshot.parts.length,0);
});
test('exact custom-FPS frame survives floating-point multiplication underflow',()=>{
 const probe=replayProbe(7),seconds=61/7;
 const result=probe.instance.seek(seconds);
 assert.equal(result.frame,61);assert.equal(result.fraction,0);
 assert.equal(probe.snapshot.steps.at(-1).time,seconds);
});
test('frame snapping cannot exceed the replay maxSeconds limit',()=>{
 const limit=1-5e-10,probe=replayProbe(60,limit);
 const result=probe.instance.seek(limit);
 assert.equal(result.seconds,limit);assert.equal(result.frame,59);
 assert.equal(result.fraction,limit-59/60);
 assert.ok(probe.snapshot.steps.every(step=>step.time<=limit));
 assert.equal(probe.instance.time,limit);
});
test('default 60 FPS still canonicalizes timestamps within one nanosecond',()=>{
 const probe=replayProbe(60),result=probe.instance.seek(1-5e-10);
 assert.equal(result.seconds,1);assert.equal(result.frame,60);assert.equal(result.fraction,0);
 assert.equal(probe.snapshot.parts.length,0);
});
