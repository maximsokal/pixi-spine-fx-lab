(function(root,make){'use strict';const api=Object.freeze(make(root.FxMotion||(typeof require==='function'?require('./motion-core.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMotionSpine42=api;})(globalThis,function(M){
 'use strict';
 const VERSION=1,RUNTIME='4.2.120',MAX_KEYS=256,AUDIT_STEPS=4096;
 const fail=m=>{throw new TypeError('Spine motion: '+m);};
 function convert(input,options,Spine,target){
  if(M?.VERSION!==1)fail('requires motion v1');
  const motion=M.compile(input),c=motion.settings,d=c.durationFrames/60;
  if(c.type!=='pulse'||c.center-c.amplitude<0||c.center+c.amplitude>1)fail('pulse alpha must stay in [0,1]');
  const fields=['runtimeVersion','slotName','tolerance','protectedSeconds'];
  if(!options||typeof options!=='object'||Reflect.ownKeys(options).length!==fields.length||!fields.every(k=>Object.hasOwn(options,k)))fail('explicit options required');
  const {runtimeVersion,slotName,tolerance,protectedSeconds}=options;
  if(runtimeVersion!==RUNTIME||typeof Spine?.SkeletonData!=='function'||typeof Spine.SkeletonJson!=='function'||!(target instanceof Spine.SkeletonData)||!/^4\.2\.(0|[1-9]\d*)$/.test(target.version??''))fail('requires pinned Spine 4.2 runtime and matching target');
  if(typeof slotName!=='string'||!slotName||Object.hasOwn(Object.prototype,slotName)||!target.findSlot(slotName))fail('unknown or reserved target slot');
  if(!Number.isFinite(tolerance)||tolerance<=0)fail('positive tolerance required');
  if(!Array.isArray(protectedSeconds)||protectedSeconds.length>MAX_KEYS||!Array.from(protectedSeconds).every(t=>Number.isFinite(t)&&t>=0&&t<=d))fail('protected seconds');
  const w=2*Math.PI*c.cycles/d,A=c.amplitude,second=A*w*w,seam=A*w*1e-9,roundoff=64*Number.EPSILON*(1+w*d);
  const value=t=>c.center+A*Math.cos(2*Math.PI*(c.phaseCycles+c.cycles*t/d));
  const velocity=t=>-A*w*Math.sin(2*Math.PI*(c.phaseCycles+c.cycles*t/d));
  const knots=new Set([0,d,...protectedSeconds]),extrema=new Map();
  if(A>0)for(let k=0;k<=2*c.cycles+2;k++){
   const cycle=k/2-c.phaseCycles;
   if(cycle>0&&cycle<c.cycles){const t=cycle*d/c.cycles;knots.add(t);extrema.set(t,k%2?c.center-A:c.center+A);}
  }
  if(c.phaseCycles===0||c.phaseCycles===.5){const y=c.phaseCycles===0?c.center+A:c.center-A;extrema.set(0,y);extrema.set(d,y);}
  const keyValue=t=>extrema.has(t)?extrema.get(t):value(t===d?0:t);
  const keyVelocity=t=>extrema.has(t)?0:velocity(t===d?0:t);
  const times=[...knots].sort((a,b)=>a-b);
  function timeCheck(){if(times.length>MAX_KEYS)fail('256 key budget');for(let i=1;i<times.length;i++)if(!(Math.fround(times[i])>Math.fround(times[i-1])))fail('Float32 key time collapse');}
  const inRange=y=>Number.isFinite(y)&&y>=0&&y<=1;
  function piece(a,b){const h=b-a,p=keyValue(a),q=keyValue(b),ys=[p,p+keyVelocity(a)*h/3,q-keyVelocity(b)*h/3,q];return {curve:[a+h/3,ys[1],b-h/3,ys[2]],range:ys.every(inRange),estimate:A*(w*h)**4/384+second*(h/10)**2/8+seam+roundoff};}
  function split(i){if(times.length>=MAX_KEYS)fail('256 key budget');const a=times[i],b=times[i+1],m=a+(b-a)/2;if(!(Math.fround(m)>Math.fround(a)&&Math.fround(m)<Math.fround(b)))fail('Float32 subdivision collapse');times.splice(i+1,0,m);}
  timeCheck();
  for(;;){let worst=-1,score=1;
   for(let i=0;i<times.length-1;i++){const p=piece(times[i],times[i+1]),s=p.range?p.estimate/tolerance:Infinity;if(s>score){score=s;worst=i;}}
   if(worst<0)break;split(worst);
  }
  for(;;){
   const keys=times.map((t,i)=>({time:t,value:keyValue(t),...(A>0&&i<times.length-1?{curve:piece(t,times[i+1]).curve}:{})}));
   const fragment={slots:{[slotName]:{alpha:keys}}};
   const rig={skeleton:{spine:RUNTIME},bones:[{name:'root'}],slots:[{name:slotName,bone:'root'}],skins:[{name:'default'}],animations:{motion:fragment}};
   const parsed=new Spine.SkeletonJson({}).readSkeletonData(JSON.parse(JSON.stringify(rig))),animation=parsed.findAnimation('motion'),timeline=animation?.timelines?.[0],frames=timeline?.frames,curves=timeline?.curves;
   if(animation?.timelines.length!==1||!(timeline instanceof Spine.AlphaTimeline)||frames?.length!==2*keys.length||curves?.length!==keys.length+(A>0?18*(keys.length-1):0)||frames.BYTES_PER_ELEMENT!==4||curves.BYTES_PER_ELEMENT!==4)fail('unexpected pinned runtime timeline representation');
   let bound=0,worst=-1;
   for(let i=0;i<keys.length-1;i++){
    const points=[[frames[2*i],frames[2*i+1]]];
    if(A>0){const start=curves[i]-2;if(start!==keys.length+18*i)fail('unexpected Bezier representation');for(let j=0;j<18;j+=2)points.push([curves[start+j],curves[start+j+1]]);}
    else if(curves[i]!==0)fail('unexpected linear representation');
    points.push([frames[2*i+2],frames[2*i+3]]);
    let segmentBound=0;
    for(let j=1;j<points.length;j++){
     const [a,p]=points[j-1],[b,q]=points[j];
     if(!(b>a)||!inRange(p)||!inRange(q))fail('collapsed or out-of-range runtime samples');
     segmentBound=Math.max(segmentBound,Math.max(Math.abs(p-value(a)),Math.abs(q-value(b)))+second*(b-a)**2/8+seam+roundoff);
    }
    if(segmentBound>bound){bound=segmentBound;worst=i;}
   }
   const runtimeDuration=animation.duration,endBound=Math.abs(frames.at(-1)-value(runtimeDuration))+A*w*Math.abs(d-runtimeDuration)+seam+roundoff;
   if(endBound>tolerance)fail('runtime endpoint exceeds tolerance');
   if(bound>tolerance){split(worst);continue;}
   bound=Math.max(bound,endBound);
   const sk=new Spine.Skeleton(parsed);let measured=0;
   for(let i=0;i<=AUDIT_STEPS;i++){
    const t=d*i/AUDIT_STEPS;
    animation.apply(sk,0,t,false,null,1,Spine.MixBlend.setup,Spine.MixDirection.mixIn);
    const a=sk.slots[0].color.a;
    if(!inRange(a))fail('invalid runtime alpha');
    measured=Math.max(measured,Math.abs(a-motion.sample(t).value));
   }
   if(measured>bound||measured>tolerance)fail('runtime round-trip exceeds bound');
   return {fragment,diagnostics:{runtimeVersion:RUNTIME,slotName,property:'alpha',durationSeconds:d,runtimeDurationSeconds:runtimeDuration,keyCount:keys.length,requestedTolerance:tolerance,errorBound:bound,measuredMaxError:measured,measuredSamples:AUDIT_STEPS+1,protectedSeconds:[...new Set([0,d,...protectedSeconds])].sort((a,b)=>a-b)}};
  }
 }
 return {VERSION,RUNTIME,MAX_KEYS,convert};
});
