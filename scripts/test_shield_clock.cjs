'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const {compilePulseClock}=require('../assets/magic-shield/src/shield-clock.js');
const near=(a,b,epsilon=1e-10)=>A.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const config=(overrides={})=>({mode:'loop',durationFrames:60,pulseRate:1.5,...overrides});
test('60-frame loop exposes requested and effective frequency',()=>{
 const c=compilePulseClock(config());
 A.equal(c.requestedHz,1.5);A.equal(c.effectiveHz,2);A.equal(c.cycles,2);A.equal(c.durationSeconds,1);
 A.deepEqual(c.sample(0),c.sample(1));A.deepEqual(c.sample(0),c.sample(100));
 near(c.sample(.125).pulse,.5);near(c.sample(.25).pulse,1);near(c.sample(.5).pulse,0);
});
test('120-frame loop preserves the exact requested 1.5 Hz',()=>{
 const c=compilePulseClock(config({durationFrames:120}));
 A.equal(c.effectiveHz,1.5);A.equal(c.cycles,3);A.deepEqual(c.sample(0),c.sample(2));
});
test('fractional seek is independent of seek order and periodic',()=>{
 const c=compilePulseClock(config({durationFrames:73,pulseRate:2.7}));
 const t=.37654321,before=c.sample(t);
 for(let i=360;i>=0;i--)c.sample(i/60);
 A.deepEqual(c.sample(t),before);
 near(c.sample(t+c.durationSeconds).phase,before.phase);near(c.sample(t+3*c.durationSeconds).pulse,before.pulse);
});
test('loop closes at non-integer-second duration and near authored frame timestamps',()=>{
 for(const frames of [7,59,61,73,3599,3600]){
  const c=compilePulseClock(config({durationFrames:frames}));
  A.deepEqual(c.sample(c.durationSeconds),c.sample(0));
  A.deepEqual(c.sample(3*c.durationSeconds),c.sample(0));
  A.deepEqual(c.sample(c.durationSeconds-1e-10),c.sample(0));
 }
});
test('zero disables oscillation without changing the authored duration',()=>{
 const c=compilePulseClock(config({pulseRate:0,durationFrames:2}));
 A.equal(c.cycles,0);A.equal(c.effectiveHz,0);A.deepEqual(c.sample(.123),{phase:0,pulse:0});
});
test('one-shot preserves frequency and clamps after the final sampled frame',()=>{
 const c=compilePulseClock(config({mode:'oneShot',durationFrames:60,pulseRate:1.5}));
 A.equal(c.effectiveHz,1.5);A.equal(c.cycles,null);A.equal(c.durationSeconds,59/60);
 near(c.sample(.25).phase,.375);near(c.sample(.25).pulse,(1-Math.cos(2*Math.PI*.375))/2);
 A.deepEqual(c.sample(1e6),c.sample(59/60));A.notDeepEqual(c.sample(0),c.sample(59/60));
});
test('frequency quantization never exceeds the artist maximum',()=>{
 const c=compilePulseClock(config({durationFrames:7,pulseRate:10}));
 A.equal(c.cycles,1);A.ok(c.effectiveHz<=10);
 A.throws(()=>compilePulseClock(config({durationFrames:5,pulseRate:1})),/cycle/);
 A.equal(compilePulseClock(config({durationFrames:6,pulseRate:10})).effectiveHz,10);
});
test('strict schema rejects unknown fields, invalid numbers and times',()=>{
 for(const bad of [NaN,Infinity,-1,10.01,'1',null])A.throws(()=>compilePulseClock(config({pulseRate:bad})),/pulseRate/);
 for(const bad of [NaN,1,1.5,3601,'60'])A.throws(()=>compilePulseClock(config({durationFrames:bad})),/durationFrames/);
 for(const bad of [null,[],{},config({mode:'reverse'}),config({extra:true})])A.throws(()=>compilePulseClock(bad));
 const c=compilePulseClock(config());for(const bad of [NaN,Infinity,-1,1e6+1,'0',null])A.throws(()=>c.sample(bad),/seconds/);
});
test('compiled clock is detached from input and immutable',()=>{
 const input=config(),c=compilePulseClock(input),a=c.sample(.2);input.pulseRate=9;
 A.ok(Object.isFrozen(c));A.deepEqual(c.sample(.2),a);A.equal(c.requestedHz,1.5);
});
test('all supported loop lengths obey rate ceiling and exact seam',()=>{
 for(let frames=6;frames<=3600;frames++){
  const c=compilePulseClock(config({durationFrames:frames,pulseRate:10}));
  A.ok(c.effectiveHz<=10);A.ok(c.cycles>=1);A.deepEqual(c.sample(c.durationSeconds),c.sample(0));
 }
});
test('accumulated 30/60/120 Hz transport gives the same authored samples',()=>{
 const c=compilePulseClock(config({durationFrames:73}));
 for(const fps of [30,60,120]){
  let t=0;for(let i=1;i<=fps*4;i++){
   t+=1/fps;if((i*60)%fps===0)A.deepEqual(c.sample(t),c.sample(i/fps));
  }
 }
 A.deepEqual(c.sample(-0),c.sample(0));
});
