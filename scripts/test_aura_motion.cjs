'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const M=require('../assets/electric-aura/src/aura-motion.js');
const C=require('../assets/template/src/curve-core.js');
const options={center:1,amplitude:.25,cycles:2,phaseCycles:.125,tolerance:.003};
test('generates editable multiplier curve with independent cosine oracle',()=>{
 for(const frames of [6,60,119,3600]){
  const r=M.glowCurve(frames,options),c=r.curve;
  A.equal(c.parameterKey,'glowPulse');A.equal(c.valueUnit,'multiplier');A.equal(c.domain,'effectTime');A.equal(c.inputUnit,'normalized-duration');A.deepEqual(c.valueRange,[0,2]);A.equal(c.monotonic,false);A.equal(c.clamp,'hold');
  A.deepEqual(C.deserialize(C.serialize(c)),c);A.ok(c.keys.length<=64);A.equal(c.keys[0].y,c.keys.at(-1).y);
  for(let i=0;i<=1024;i++){const u=i/1024;A.ok(Math.abs(C.evaluate(c,u)-(1+.25*Math.cos(2*Math.PI*(2*u+.125))))<=options.tolerance);}
  A.ok(r.diagnostics.errorBound<=options.tolerance);
 }
});
test('reject invalid controls, impossible ranges and impossible tolerance',()=>{
 for(const patch of [{center:0,amplitude:.1},{center:2,amplitude:.1},{center:NaN},{cycles:0},{cycles:1.5},{phaseCycles:1},{tolerance:0},{cycles:20,tolerance:1e-10},{unknown:1}])A.throws(()=>M.glowCurve(60,{...options,...patch}));
 for(const frames of [0,5,6.5,3601])A.throws(()=>M.glowCurve(frames,options));
});
test('constant intensity and zero floor survive without widening or mutation',()=>{
 const o={...options,center:.5,amplitude:.5,cycles:1},before=JSON.stringify(o),r=M.glowCurve(60,o);A.equal(JSON.stringify(o),before);
 A.ok(r.curve.keys.some(k=>k.y===0));
 const c=M.glowCurve(60,{...options,center:.75,amplitude:0}).curve;for(const x of [0,.3,1])A.equal(C.evaluate(c,x),.75);
});
