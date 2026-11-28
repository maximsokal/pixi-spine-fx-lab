(function(root,make){'use strict';const api=Object.freeze(make(root.FxMotion||(typeof require==='function'?require('./motion-core.js'):null),root.FxCurves||(typeof require==='function'?require('./curve-core.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMotionCurve=api;})(globalThis,function(M,C){
 'use strict';
 const MAX_KEYS=64,AUDIT_STEPS=4096,EPS=Number.EPSILON;
 const fail=m=>{throw new TypeError('Invalid motion curve: '+m);};
 function convert(input,options){
  if(M?.VERSION!==1||C?.VERSION!==1)fail('requires motion and curve v1');
  const motion=M.compile(input),c=motion.settings,duration=c.durationFrames/60;
  const fields=['parameterKey','domain','inputUnit','valueUnit','valueRange','defaultValue','monotonic','tolerance','protectedSeconds'];
  if(!options||typeof options!=='object'||Reflect.ownKeys(options).length!==fields.length||!fields.every(k=>Object.hasOwn(options,k)))fail('explicit options required');
  const {parameterKey,domain,inputUnit,valueUnit,valueRange,defaultValue,monotonic,tolerance,protectedSeconds}=options;
  const units={effectTime:'normalized-duration',emitterTime:'normalized-duration',particleAge:'normalized-lifetime'};
  if(!Object.hasOwn(units,domain)||!['seconds',units[domain]].includes(inputUnit))fail('time domain/unit');
  if(valueUnit!==(c.type==='bounce'?'pixels':'normalized'))fail('value unit');
  if(parameterKey==='transitionProgress')fail('motion cannot be implicitly rebound to transition progress');
  if(!Number.isFinite(tolerance)||tolerance<=0)fail('positive finite tolerance required');
  if(!Array.isArray(valueRange)||valueRange.length!==2||!valueRange.every(Number.isFinite)||valueRange[0]>=valueRange[1]||!Number.isFinite(defaultValue)||defaultValue<valueRange[0]||defaultValue>valueRange[1])fail('value range');
  if(typeof monotonic!=='boolean')fail('monotonic must be boolean');
  if(!Array.isArray(protectedSeconds)||protectedSeconds.length>MAX_KEYS||!Array.from(protectedSeconds).every(t=>Number.isFinite(t)&&t>=0&&t<=duration))fail('protected seconds');
  const toX=t=>inputUnit==='seconds'?t:t/duration, inRange=y=>y>=valueRange[0]&&y<=valueRange[1];
  const times=new Set([0,duration,...protectedSeconds]),extrema=new Map();let flightEnd=0;
  if(c.type==='pulse'){
   const lo=c.center-c.amplitude,hi=c.center+c.amplitude;
   if(!inRange(lo)||!inRange(hi))fail('motion outside declared value range');
   if(c.amplitude>0){
    for(let k=0;k<=2*c.cycles+2;k++){
     const t=(k/2-c.phaseCycles)*duration/c.cycles,y=k%2?lo:hi;
     if(t>=0&&t<=duration&&(y===valueRange[0]||y===valueRange[1])){times.add(t);extrema.set(t,y);}
    }
   }
  }
  if(c.type==='bounce'){
   let velocity=c.launchSpeed;
   for(let i=0;i<=c.maxBounces&&velocity>0;i++){
    const next=flightEnd+2*velocity/c.gravity;if(next===flightEnd)break;
    times.add(next);flightEnd=next;velocity*=c.restitution;
   }
  }
  const knots=[...times].sort((a,b)=>a-b);
  if(knots.length>MAX_KEYS)fail('protected times exceed 64 keys');
  const base={schemaVersion:1,parameterKey,domain,inputUnit,valueUnit,inputRange:[0,toX(duration)],valueRange:[...valueRange],defaultValue,clamp:'hold',monotonic};
  const w=c.type==='spring'?2*Math.PI*c.frequencyHz:c.type==='pulse'?2*Math.PI*c.cycles/duration:0;
  const a=(c.dampingRatio??0)*w;
  const springFourth=c.type==='spring'?Math.abs(4*a*(w*w-2*a*a))+Math.abs(w**4-4*a*a*w*w)/w:0;
  const sample=t=>extrema.has(t)?{value:extrema.get(t),velocity:0}:motion.sample(t);
  function segment(t0,t1){
   const h=t1-t0,x0=toX(t0),x1=toX(t1),dx=x1-x0;
   if(!(dx>0))fail('protected times not representable as distinct curve keys');
   const p=sample(t0),q=sample(t1);let v1=q.velocity,analytic=0;
   if(!inRange(p.value)||!inRange(q.value))fail('motion outside declared value range');
   if(c.type==='spring'){
    const speedBound=Math.hypot(p.velocity,w*p.value);
    analytic=springFourth*speedBound*h**4/384;
    if(t1===duration){const before=duration*(1-EPS);v1=motion.sample(before).velocity;analytic+=h*(2*a+w)*speedBound*(duration-before);}
   }else if(c.type==='pulse'){
    analytic=c.amplitude*w**4*h**4/384+2*c.amplitude*w*1e-9+2*h*c.amplitude*w*w*1e-9;
   }else{
    v1=t0<flightEnd?p.velocity-c.gravity*h:0;
   }
   const y=[p.value,p.value+p.velocity*h/3,q.value-v1*h/3,q.value];
   if(!y.every(Number.isFinite)||!Number.isFinite(analytic))fail('nonfinite approximation');
   const maxDerivative=3*Math.max(...y.slice(1).map((v,i)=>Math.abs(v-y[i])));
   const numerical=64*EPS*Math.max(1,...y.map(Math.abs))+maxDerivative*Math.min(1,2**-35+64*EPS*Math.max(1,Math.abs(x0),Math.abs(x1))/dx);
   return {t0,t1,x0,x1,y,error:analytic+numerical,range:y.every(inRange)};
  }
  const segments=[];
  for(let i=1;i<knots.length;i++)segments.push(segment(knots[i-1],knots[i]));
  for(;;){
   let worst=-1,score=1;
   for(let i=0;i<segments.length;i++){
    const s=segments[i],cost=s.range?s.error/tolerance:Infinity;
    if(cost>score){score=cost;worst=i;}
   }
   if(worst<0)break;
   if(segments.length+1>=MAX_KEYS)fail(segments[worst].range?'tolerance needs more than 64 keys':'value range cannot be represented within 64 keys');
   const s=segments[worst],mid=s.t0+(s.t1-s.t0)/2;
   if(!(mid>s.t0&&mid<s.t1))fail('tolerance below time resolution');
   segments.splice(worst,1,segment(s.t0,mid),segment(mid,s.t1));
  }
  const keys=segments.map((s,i)=>({id:'motion'+i,x:s.x0,y:s.y[0],mode:'linear'}));
  const end=segments.at(-1);keys.push({id:'motion'+segments.length,x:end.x1,y:end.y[3],mode:'linear'});
  for(let i=0;i<segments.length;i++){
   const s=segments[i],dx=s.x1-s.x0;
   if(monotonic&&s.y.some((y,j)=>j>0&&y<s.y[j-1]))fail('motion is not representable as monotonic curve');
   if(s.y.every(y=>y===s.y[0]))continue;
   keys[i].mode='bezier';keys[i].out=[s.x0+dx/3,s.y[1]];keys[i+1].in=[s.x1-dx/3,s.y[2]];
  }
  const curve=C.normalize({...base,keys}),errorBound=Math.max(...segments.map(s=>s.error));
  let measuredMaxError=0;
  for(let i=0;i<=AUDIT_STEPS;i++){
   const t=duration*i/AUDIT_STEPS;
   measuredMaxError=Math.max(measuredMaxError,Math.abs(C.evaluate(curve,toX(t))-motion.sample(t).value));
  }
  if(measuredMaxError>errorBound||errorBound>tolerance)fail('measured approximation exceeds tolerance or bound');
  return {curve,diagnostics:{errorBound,measuredMaxError,measuredSamples:AUDIT_STEPS+1,protectedSeconds:knots,loopDurationSeconds:c.type==='pulse'?duration:null}};
 }
 return {VERSION:1,convert};
});
