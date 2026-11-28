'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const B=require('../assets/template/src/motion-curve.js');
const C=require('../assets/template/src/curve-core.js');
const spring=(v={})=>({schemaVersion:1,type:'spring',durationFrames:120,frequencyHz:1,dampingRatio:.3,initialDisplacement:1,initialVelocity:0,...v});
const pulse=(v={})=>({schemaVersion:1,type:'pulse',durationFrames:60,center:0,amplitude:1,cycles:3,phaseCycles:.125,...v});
const bounce=(v={})=>({schemaVersion:1,type:'bounce',durationFrames:120,launchSpeed:100,gravity:200,restitution:.5,maxBounces:2,...v});
const opts=(v={})=>({parameterKey:'motion',domain:'effectTime',inputUnit:'normalized-duration',valueUnit:'normalized',valueRange:[-2,2],defaultValue:0,monotonic:false,tolerance:.01,protectedSeconds:[],...v});
function audit(r,oracle,duration,tolerance){
 A.deepEqual(C.deserialize(C.serialize(r.curve)),r.curve);
 A.ok(r.curve.keys.length>=2&&r.curve.keys.length<=64);
 A.ok(r.diagnostics.errorBound<=tolerance);
 let err=0;for(let i=0;i<=4096;i++){const t=duration*i/4096,x=r.curve.inputUnit==='seconds'?t:t/duration;err=Math.max(err,Math.abs(C.evaluate(r.curve,x)-oracle(t)));}
 A.ok(err<=r.diagnostics.errorBound+1e-10,`independent error ${err} exceeds ${r.diagnostics.errorBound}`);
 A.ok(r.diagnostics.measuredMaxError<=r.diagnostics.errorBound);
}
test('pulse conversion preserves periodic value and endpoint tangent with bounded error',()=>{
 const o=opts({protectedSeconds:[.17,.625]}),r=B.convert(pulse(),o),w=6*Math.PI,phase=Math.PI/4;
 audit(r,t=>Math.cos(w*t+phase),1,.01);
 A.equal(r.diagnostics.loopDurationSeconds,1);
 for(const x of [.17,.625])A.ok(r.curve.keys.some(k=>k.x===x));
 const ks=r.curve.keys,a=ks[0],b=ks.at(-1);
 A.ok(Math.abs((a.out[1]-a.y)/(a.out[0]-a.x)-(b.y-b.in[1])/(b.x-b.in[0]))<1e-8);
 A.deepEqual(B.convert(pulse(),o),r);
});
test('spring approximation meets independent analytic oracle and protects fractional cue',()=>{
 const r=B.convert(spring(),opts({inputUnit:'seconds',protectedSeconds:[.317]})),w=2*Math.PI,z=.3,wd=w*Math.sqrt(1-z*z);
 audit(r,t=>Math.exp(-z*w*t)*(Math.cos(wd*t)+z*w/wd*Math.sin(wd*t)),2,.01);
 A.ok(r.curve.keys.some(k=>k.x===.317));A.deepEqual(r.curve.inputRange,[0,2]);
 A.equal(r.diagnostics.loopDurationSeconds,null);
});
test('bounce contacts are exact protected keys and flight shape is preserved',()=>{
 const r=B.convert(bounce(),opts({valueUnit:'pixels',valueRange:[0,30],tolerance:1e-6,protectedSeconds:[.37]}));
 const expected=t=>t<1?100*t-100*t*t:t<1.5?50*(t-1)-100*(t-1)**2:t<1.75?25*(t-1.5)-100*(t-1.5)**2:0;
 audit(r,expected,2,1e-6);
 for(const x of [.5,.75,.875]){const k=r.curve.keys.find(k=>k.x===x);A.ok(k);A.equal(k.y,0);}
 A.ok(r.curve.keys.some(k=>k.x===.185));A.equal(r.diagnostics.loopDurationSeconds,null);
});
test('reject impossible tolerance or too many protected keys instead of truncation',()=>{
 A.throws(()=>B.convert(pulse({cycles:20}),opts({tolerance:1e-10})),/64|tolerance/);
 A.throws(()=>B.convert(pulse(),opts({protectedSeconds:Array.from({length:63},(_,i)=>(i+1)/64)})),/64/);
});
test('range and monotonic contracts are not silently altered',()=>{
 A.throws(()=>B.convert(pulse(),opts({valueRange:[-.1,.1]})),/range/i);
 A.throws(()=>B.convert(pulse(),opts({monotonic:true})),/monotonic/i);
 const r=B.convert(pulse({amplitude:0,center:.5}),opts({monotonic:true,valueRange:[0,1]}));
 A.equal(r.curve.monotonic,true);A.equal(C.evaluate(r.curve,.333),.5);
});
test('strict explicit time units and parameter metadata',()=>{
 for(const bad of [{inputUnit:'pixels'},{domain:'pathPosition'},{valueUnit:'pixels'},{tolerance:0},{tolerance:NaN},{protectedSeconds:[1.1]},{protectedSeconds:[NaN]},{protectedSeconds:'0.5'},{unknown:1},{valueRange:[2,-2]},{defaultValue:3},{monotonic:'false'}])A.throws(()=>B.convert(pulse(),opts(bad)));
 const r=B.convert(pulse({cycles:1}),opts({domain:'particleAge',inputUnit:'normalized-lifetime',parameterKey:'opacity'}));
 A.equal(r.curve.domain,'particleAge');A.equal(r.curve.parameterKey,'opacity');A.equal(r.curve.inputUnit,'normalized-lifetime');
});
test('input is unchanged; duplicate cue times are coalesced',()=>{
 const c=pulse({cycles:1}),o=opts({protectedSeconds:[0,.25,.25,1]});const before=JSON.stringify([c,o]),r=B.convert(c,o);
 A.equal(JSON.stringify([c,o]),before);A.equal(r.curve.keys.filter(k=>k.x===.25).length,1);
});
test('natural pulse range needs no artificial widening or clamping',()=>{
 for(const phaseCycles of [0,.125,.137,.5,.99]){
  const r=B.convert(pulse({center:.5,amplitude:.5,phaseCycles}),opts({valueRange:[0,1],tolerance:.001}));
  audit(r,t=>.5+.5*Math.cos(2*Math.PI*(3*t+phaseCycles)),1,.001);
  A.ok(r.curve.keys.some(k=>Math.abs(k.y-1)<1e-12));A.ok(r.curve.keys.some(k=>Math.abs(k.y)<1e-12));
  A.ok(r.curve.keys.every(k=>[k.y,k.in?.[1]??k.y,k.out?.[1]??k.y].every(y=>y>=0&&y<=1)));
 }
});
test('spring incoming endpoint tangent does not use artificial hold velocity',()=>{
 const r=B.convert(spring({durationFrames:15,dampingRatio:0}),opts({inputUnit:'seconds'}));
 const end=r.curve.keys.at(-1);A.ok(Math.abs((end.y-end.in[1])/(end.x-end.in[0])+2*Math.PI)<1e-8);
});
test('exactly 64 protected keys are accepted when tolerance fits',()=>{
 const times=Array.from({length:62},(_,i)=>(i+1)/63);
 const r=B.convert(pulse({amplitude:0}),opts({protectedSeconds:times}));A.equal(r.curve.keys.length,64);
 A.deepEqual(r.diagnostics.protectedSeconds,[0,...times,1]);
});
