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
