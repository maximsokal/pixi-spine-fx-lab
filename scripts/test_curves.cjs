#!/usr/bin/env node
'use strict';
// FX-CORE-01 deterministic numerical/serialization contract.
const assert = require('node:assert/strict');
const C = require('../assets/template/src/curve-core.js');
const eq = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<=eps, String(a)+' != '+String(b));
function clone(x) { return JSON.parse(JSON.stringify(x)); }
const hit = (obj,regex) => assert.throws(()=>C.normalize(obj),new RegExp(regex));
assert.equal(C.VERSION,1);
assert.equal(C.PRESETS.length,8);
for (const name of C.PRESETS) {
  const curve=C.createPreset(name);
  assert.deepEqual(C.deserialize(C.serialize(curve)),curve);
  for (const x of [0,.001,.01,.125,.25,.5,.75,.999,1]) {
    const y=C.evaluate(curve,x);
    assert.ok(Number.isFinite(y)&&y>=0&&y<=1,name+'@'+x);
    eq(y,C.evaluate(C.deserialize(C.serialize(curve)),x));
  }
}
let v=C.createPreset('linear');
eq(C.evaluate(v,0),0);eq(C.evaluate(v,.5),.5);eq(C.evaluate(v,1),1);
eq(C.evaluate(v,-1),0);eq(C.evaluate(v,2),1);
v.keys[0].mode='stepped';eq(C.evaluate(v,.75),0);
v=C.createPreset('easeInOut');
eq(C.evaluate(v,0),0);eq(C.evaluate(v,.5),.5,1e-7);eq(C.evaluate(v,1),1);
let last=-1;
for(let i=0;i<=1000;i++){
 const value=C.evaluate(v,i/1000);
 assert.ok(value>=last-1e-8, 'monotonic sample');
 last=value;
}
// Steep/vertical handles: x(t) inversion cannot assume t=x.
const steep=C.createPreset('linear');
steep.keys[0].mode='bezier';
steep.keys[0].out=[0,0];
steep.keys[1].in=[0,1];
eq(C.evaluate(steep,.125),.5,1e-5);
const cases=[
  [o=>o.keys[0].x=NaN,'nonfinite'],
  [o=>o.keys[1].x=0,'strictly increasing'],
  [o=>o.keys[0].mode='quadratic','interpolation'],
  [o=>o.keys[0].id=o.keys[1].id,'distinct'],
  [o=>o.monotonic='yes','boolean'],
  [o=>o.inputUnit='pixels','incompatible'],
  [o=>o.keys[0].out=[Infinity,0],'finite'],
  [o=>{o.keys[0].mode='bezier';delete o.keys[1].in;},'handles'],
  [o=>{o.keys[0].mode='bezier';o.keys[0].out=[.8,.9];o.keys[1].in=[.2,.8];},'ordered'],
  [o=>{o.keys[0].mode='bezier';o.keys[0].out=[.25,.8];o.keys[1].in=[.75,.7];},'nondecreasing'],
  [o=>o.keys.push({...o.keys[1],id:'new',x:1}),'strictly increasing'],
  [o=>o.zoom=2,'unknown curve'],
  [o=>o.schemaVersion=99,'unsupported'],
  [o=>o.domain='cameraZoom','domain'],
  [o=>{o.parameterKey='transitionProgress';o.keys[0].y=.1},'begin at 0']
];
for(const [mutate,error] of cases){const data=clone(v);mutate(data);hit(data,error);}
assert.throws(()=>C.evaluate(v,NaN),/finite/);
assert.throws(()=>C.deserialize('{'),/invalid JSON/);
assert.throws(()=>C.deserialize('{}'),/unsupported/);
const smooth=C.createPreset('easeInOut');
assert.equal(C.evaluate(smooth,.5),C.evaluate(smooth,30/60));
for(const fps of [30,60,120])for(let n=0;n<=fps;n++)
  eq(C.evaluate(smooth,n/fps), C.evaluate(C.deserialize(C.serialize(smooth)),n/fps));
const pathPulse=C.createPreset('pulse',{parameterKey:'sparkSize',domain:'pathPosition',inputUnit:'pixels',
  inputRange:[0,100],valueRange:[2,12],defaultValue:2,monotonic:false,valueUnit:'px'});
eq(C.evaluate(pathPulse,25),7);eq(C.evaluate(pathPulse,50),12);eq(C.evaluate(pathPulse,100),2);
assert.deepEqual(C.deserialize(C.serialize(pathPulse)),pathPulse);
const seconds=C.createPreset('linear',{parameterKey:'glow',domain:'effectTime',inputUnit:'seconds',
  inputRange:[0,5],valueRange:[-2,8],defaultValue:1,clamp:'default',valueUnit:'px'});
eq(C.evaluate(seconds,2.5),3);eq(C.evaluate(seconds,-10),1);eq(C.evaluate(seconds,10),1);
assert.deepEqual(C.deserialize(C.serialize(seconds)),seconds);
assert.throws(()=>C.createPreset('pulse',{monotonic:true}),/nondecreasing/);
assert.throws(()=>C.createPreset('slowDecay',{monotonic:true}),/nondecreasing/);
console.log('PASS FX-CORE-01: 8 presets, numeric oracle, Bezier inversion, strict schema, malformed keys, FPS and JSON roundtrip');
