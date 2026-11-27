// MOTION-M01: pure absolute-time motion; no renderer, clock or mutable RNG.
(function(root,make){'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMotion=api;})(globalThis,function(){
 'use strict';
 const VERSION=1,FPS=60,TAU=2*Math.PI;
 const fail=m=>{throw new TypeError('Invalid FX motion: '+m);};
 const ranges=Object.freeze({spring:{frequencyHz:[.1,20],dampingRatio:[0,4],initialDisplacement:[-10,10],initialVelocity:[-100,100]},bounce:{launchSpeed:[0,1000],gravity:[1,2000],restitution:[0,.95],maxBounces:[0,32]},pulse:{center:[-10,10],amplitude:[0,10],cycles:[1,20],phaseCycles:[0,1]}});
 function num(v,k,lo,hi){if(!Number.isFinite(v)||v<lo||v>hi)fail(k+' out of range');return v===0?0:v;}
 function integer(v,k,lo,hi){num(v,k,lo,hi);if(!Number.isSafeInteger(v))fail(k+' must be integer');return v;}
 function normalize(input){
  if(!input||typeof input!=='object'||(Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null))fail('plain settings object required');
  if(!Object.hasOwn(input,'type')||typeof input.type!=='string'||!Object.hasOwn(ranges,input.type))fail('type');
  const fields=ranges[input.type],keys=['schemaVersion','type','durationFrames',...Object.keys(fields)];
  if(Reflect.ownKeys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k)))fail('unknown or missing settings keys');
  if(input.schemaVersion!==VERSION)fail('schemaVersion');
  const c={schemaVersion:VERSION,type:input.type,durationFrames:integer(input.durationFrames,'durationFrames',1,3600)};
  for(const [k,[lo,hi]] of Object.entries(fields))c[k]=(['maxBounces','cycles'].includes(k)?integer:num)(input[k],k,lo,hi);
  if(c.phaseCycles===1)fail('phaseCycles must be less than 1');
  return Object.freeze(c);
 }
 const result=(value,velocity)=>({value:value===0?0:value,velocity:velocity===0?0:velocity});
 const wrap=x=>{const r=x%1;return r<0?r+1:r===0?0:r;};
 function spring(c,duration){
  const w=TAU*c.frequencyHz,z=c.dampingRatio,a=z*w,x=c.initialDisplacement,v=c.initialVelocity;
  const delta=w*Math.sqrt(Math.abs((1-z)*(1+z)));
  function physical(t){
   if(t===0)return result(x,v);
   let C,S;
   if(z<1){const decay=Math.exp(-a*t);C=decay*Math.cos(delta*t);S=decay*Math.sin(delta*t)/delta;}
   else if(z===1){C=Math.exp(-a*t);S=C*t;}
   else{
    // Factor the decaying eigenmodes; never multiply cosh(large) by exp(-large).
    const slow=Math.exp((-w*w/(a+delta))*t),fast=Math.exp((-a-delta)*t);
    C=(slow+fast)/2;S=slow*(-Math.expm1(-2*delta*t))/(2*delta);
   }
   return result(x*C+(v+a*x)*S,v*C-(a*v+w*w*x)*S);
  }
  const end=physical(duration).value;
  return t=>t>=duration?result(end,0):physical(t);
 }
 function bounce(c,duration){
  const flights=[];let v=c.launchSpeed,start=0;
  for(let i=0;i<=c.maxBounces&&v>0;i++){
   const length=2*v/c.gravity,end=start+length;
   if(end>duration)fail('durationFrames shorter than natural bounce schedule');
   if(end===start)break; // a flight too small to advance the representable clock
   flights.push({start,end,length,v});start=end;v*=c.restitution;
  }
  return t=>{
   const f=flights.find(f=>t<f.end);
   if(!f)return result(0,0);
   const age=t-f.start;
   // Factored height avoids subtracting nearly equal large terms at contact.
   return result(Math.max(0,.5*c.gravity*age*(f.length-age)),f.v-c.gravity*age);
  };
 }
 function pulse(c,duration){
  const frequency=c.cycles/duration;
  return t=>{
   let phase=t%duration;
   // Canonical authored cycle seams, consistent with the existing 1 ns clock convention.
   if(phase<=1e-9||duration-phase<=1e-9)phase=0;
   const angle=TAU*wrap(c.phaseCycles+c.cycles*(phase/duration));
   return result(c.center+c.amplitude*Math.cos(angle),-TAU*frequency*c.amplitude*Math.sin(angle));
  };
 }
 function compile(input){
  const settings=normalize(input),duration=settings.durationFrames/FPS;
  const evaluate=({spring,bounce,pulse})[settings.type](settings,duration);
  return Object.freeze({settings,sample(seconds){return evaluate(num(seconds,'seconds',0,Number.MAX_VALUE));}});
 }
 function phaseOffset(index,count,offsetCycles=0){integer(count,'count',1,Number.MAX_SAFE_INTEGER);integer(index,'index',0,count-1);num(offsetCycles,'offsetCycles',-Number.MAX_VALUE,Number.MAX_VALUE);return wrap(index/count+wrap(offsetCycles));}
 function squashStretch(scale,preserveArea=true){num(scale,'scale',.1,10);if(typeof preserveArea!=='boolean')fail('preserveArea');return {x:preserveArea?1/scale:1,y:scale};}
 return {VERSION,normalize,compile,phaseOffset,squashStretch};
});
