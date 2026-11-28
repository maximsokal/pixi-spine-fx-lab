(function(root,make){'use strict';const api=Object.freeze(make(root.FxMotion||(typeof require==='function'?require('./motion-core.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMotionChoreography=api;})(globalThis,function(M){
 'use strict';
 const VERSION=1,FPS=60,TAU=2*Math.PI,MAX_ELEMENTS=64;
 const fail=m=>{throw new TypeError('Invalid motion choreography: '+m);};
 const fields={anticipationAmplitude:[0,10],peakAmplitude:[0,10],lagFrames:[0,60],jitterFrames:[0,60],attenuation:[0,1],secondaryAmplitude:[0,10],frequencyHz:[.1,20],dampingRatio:[0,4],phaseJitterCycles:[0,1]};
 const profiles={calm:[.08,.5,4,1,.65,.15,.8,1,.05],elegant:[.15,.8,5,1,.8,.3,1.2,.8,.05],power:[.35,1.5,3,1,.7,.9,2,.65,.1],playful:[.3,1,5,2,.85,.8,2.2,.3,.2],joy:[.18,1,4,2,.8,.65,2,.45,.25],urgent:[.12,1.2,1,0,.5,.35,4,.8,.05],energy:[.25,1.6,2,2,.85,1.2,3,.4,.3]};
 const PROFILES=Object.freeze(Object.keys(profiles));
 function num(v,k,lo,hi){if(!Number.isFinite(v)||v<lo||v>hi)fail(k+' out of range');return v===0?0:v;}
 function integer(v,k,lo,hi){num(v,k,lo,hi);if(!Number.isSafeInteger(v))fail(k+' must be integer');return v;}
 function object(o,keys,partial=false){if(!o||typeof o!=='object'||(Object.getPrototypeOf(o)!==Object.prototype&&Object.getPrototypeOf(o)!==null)||Reflect.ownKeys(o).some(k=>!keys.includes(k))||(!partial&&!keys.every(k=>Object.hasOwn(o,k))))fail('unknown or missing settings keys');}
 function normalizeStyle(s){object(s,Object.keys(fields));return Object.freeze(Object.fromEntries(Object.entries(fields).map(([k,[lo,hi]])=>[k,num(s[k],k,lo,hi)])));}
 function profile(name,overrides={}){if(!PROFILES.includes(name))fail('unknown profile');object(overrides,Object.keys(fields),true);return normalizeStyle({...Object.fromEntries(Object.keys(fields).map((k,i)=>[k,profiles[name][i]])),...overrides});}
 function normalize(input){
  object(input,['schemaVersion','durationFrames','anticipationFrame','releaseFrame','peakFrame','seed','style','elements']);if(input.schemaVersion!==VERSION)fail('schemaVersion');
  const durationFrames=integer(input.durationFrames,'durationFrames',4,3600),anticipationFrame=integer(input.anticipationFrame,'anticipationFrame',1,durationFrames-3),releaseFrame=integer(input.releaseFrame,'releaseFrame',anticipationFrame+1,durationFrames-2),peakFrame=integer(input.peakFrame,'peakFrame',releaseFrame+1,durationFrames-1),seed=integer(input.seed,'seed',-2147483648,2147483647),style=normalizeStyle(input.style);
  if(!Array.isArray(input.elements)||input.elements.length>MAX_ELEMENTS)fail('elements budget');const ids=new Set();
  const elements=Array.from(input.elements,e=>{object(e,['id','depth','seed','enabled','weight','phaseCycles']);if(typeof e.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(e.id)||ids.has(e.id))fail('distinct stable element ID');ids.add(e.id);if(typeof e.enabled!=='boolean')fail('enabled');const phaseCycles=num(e.phaseCycles,'phaseCycles',0,1);if(phaseCycles===1)fail('phaseCycles must be less than 1');return Object.freeze({id:e.id,depth:integer(e.depth,'depth',0,63),seed:integer(e.seed,'element seed',-2147483648,2147483647),enabled:e.enabled,weight:num(e.weight,'weight',0,10),phaseCycles});});
  return Object.freeze({schemaVersion:VERSION,durationFrames,anticipationFrame,releaseFrame,peakFrame,seed,style,elements:Object.freeze(elements)});
 }
 function keyed(seed,e,channel){const key=seed+':'+e.id+':'+e.seed+':'+channel;let h=2166136261;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);h=(h+0x6d2b79f5)>>>0;let n=Math.imul(h^h>>>15,1|h);n^=n+Math.imul(n^n>>>7,61|n);return ((n^n>>>14)>>>0)/4294967296;}
 const smooth=u=>u*u*(3-2*u),slope=u=>6*u*(1-u);
 function result(value,velocity){return {value:value===0?0:value,velocity:velocity===0?0:velocity};}
 function compile(input){
  if(M?.VERSION!==1)fail('requires motion v1');
  const settings=normalize(input),s=settings.style,duration=settings.durationFrames/FPS;
  const cues=Object.freeze({start:0,anticipation:settings.anticipationFrame/FPS,release:settings.releaseFrame/FPS,peak:settings.peakFrame/FPS,end:duration});
  const knots=[[0,0],[cues.anticipation,-s.anticipationAmplitude],[cues.release,0],[cues.peak,s.peakAmplitude],[duration,0]];
  const spring=M.compile({schemaVersion:1,type:'spring',durationFrames:settings.durationFrames,frequencyHz:s.frequencyHz,dampingRatio:s.dampingRatio,initialDisplacement:0,initialVelocity:1});
  const plans=settings.elements.map(e=>{
   const startSeconds=(settings.peakFrame+e.depth*s.lagFrames+s.jitterFrames*keyed(settings.seed,e,'delay'))/FPS;
   const phaseCycles=(e.phaseCycles+s.phaseJitterCycles*keyed(settings.seed,e,'phase'))%1;
   const gain=s.secondaryAmplitude*TAU*s.frequencyHz*e.weight*s.attenuation**e.depth;
   if(gain>0&&startSeconds>=duration)fail('secondary delay exceeds recovery window: '+e.id);
   return {metadata:Object.freeze({id:e.id,startSeconds,phaseCycles}),active:e.enabled&&gain>0,gain};
  });
  const elements=Object.freeze(plans.map(p=>p.metadata));
  function primary(t){if(t>=duration)return result(0,0);for(let i=1;i<knots.length;i++){const [a,x]=knots[i-1],[b,y]=knots[i];if(t<=b){const u=(t-a)/(b-a);return result(u===1?y:x+(y-x)*smooth(u),(y-x)*slope(u)/(b-a));}}return result(0,0);}
  function secondary(p,t){const {id,startSeconds}=p.metadata;if(!p.active||t<startSeconds||t>=duration)return {id,...result(0,0)};const age=t-startSeconds,window=duration-startSeconds,u=age/window,fade=(1-u)**2*(1+2*u),df=-slope(u)/window,q=spring.sample(age);return {id,...result(p.gain*q.value*fade,p.gain*(q.velocity*fade+q.value*df))};}
  return Object.freeze({settings,cues,elements,sample(seconds){const t=num(seconds,'seconds',0,Number.MAX_VALUE);return {primary:primary(t),secondary:plans.map(p=>secondary(p,t))};}});
 }
 return {VERSION,PROFILES,profile,normalize,compile};
});
