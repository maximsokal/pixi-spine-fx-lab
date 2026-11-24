// AIR-02 — pure periodic pre-roll kernel. No renderer or frame-driven state.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxSnow=api;
})(globalThis,function(Curves,Colors){
 'use strict';
 const MAX_EVENTS=4096,MAX_PARTICLES=4096;
 function number(value,name,min,max){
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)
   throw RangeError('AIR-02 invalid '+name);
  return value;
 }
 // Events describe a single half-open period [0,period), in time order.
 // Cycle numbers are relative to phase, not persistent particle identities.
 // Across a seam, a surviving event's cycle decreases by one; its age advances.
 function periodicAges(events,seconds,options){
  if(!options||typeof options!=='object')throw TypeError('AIR-02 options required');
  const period=number(options.period,'period',1/60,3600),
   lifetime=number(options.lifetime,'lifetime',0,3600),
   limit=number(options.limit,'particle limit',1,MAX_PARTICLES),
   phase=number(seconds,'seconds',0,1e8)%period||0;
  if(!Number.isInteger(limit)||!Array.isArray(events)||events.length>MAX_EVENTS)
   throw TypeError('AIR-02 invalid event schedule or limit');
  const ids=new Set(),ranges=[];
  let previous=-Infinity,count=0;
  for(const event of events){
   if(!event||!Number.isSafeInteger(event.id)||event.id<0||ids.has(event.id))
    throw TypeError('AIR-02 invalid/duplicate event ID');
   ids.add(event.id);
   const time=number(event.time,'event time',0,period);
   number(event.x,'event x',-1000000,1000000);
   if(time>=period||time<=previous)throw RangeError('AIR-02 unordered or non-half-open schedule');
   previous=time;
   if(lifetime===0)continue;
   const delta=phase-time,age=cycle=>delta-cycle*period;
   const live=cycle=>age(cycle)>=0&&age(cycle)<lifetime;
   let first=Math.floor((delta-lifetime)/period)+1,last=Math.floor(delta/period);
   // Correct division rounding at exact birth/expiry boundaries using age itself.
   if(live(first-1))first--;
   if(live(last+1))last++;
   if(!live(first))first++;
   if(!live(last))last--;
   if(first>last)continue;
   count+=last-first+1;
   if(count>limit)throw RangeError('AIR-02 particle budget exceeded');
   ranges.push({event,first,last});
  }
  const particles=[];
  // Do not allocate particle records until every event and the full count pass.
  for(const {event,first,last} of ranges)for(let cycle=first;cycle<=last;cycle++){
   particles.push({id:event.id,time:event.time,x:event.x,cycle,age:phase-event.time-cycle*period||0});
  }
  return particles.sort((a,b)=>a.cycle-b.cycle||a.time-b.time);
 }
 // Flight motion is independent of event construction and renderer state.
 function curve(key,domain,knots,max){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':'normalized-duration',
   valueUnit:'multiplier',inputRange:[0,1],valueRange:[0,max],
   defaultValue:knots[0][1],clamp:'hold',monotonic:false,
   keys:knots.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function flightDefaults(){
  return {period:1,fieldWidth:512,fieldHeight:512,limit:2048,seed:7321,
   flakeSize:7,fallSpeed:50,windDrift:24,rotationSpeed:45,depthVariation:.45,
   layers:{near:true,far:true},
   driftCurve:curve('drift','effectTime',[[0,.3],[.5,.8],[1,.3]],3),
   flakeAlphaCurve:curve('flakeAlpha','particleAge',[[0,0],[.15,1],[.85,1],[1,0]],1),
   rotationCurve:curve('rotation','particleAge',[[0,0],[1,1]],3),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'snowColor',domain:'particleAge',
    inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[
     {id:'start',position:0,rgba:[255,255,255,1]},
     {id:'end',position:1,rgba:[214,234,251,1]}]})};
 }
 function validateFlightCurve(input,key,domain,max){
  const c=Curves.normalize(input);
  if(c.parameterKey!==key||c.domain!==domain||c.valueUnit!=='multiplier'||
     c.inputUnit!==(domain==='particleAge'?'normalized-lifetime':'normalized-duration')||
     c.valueRange[0]<0||c.valueRange[1]>max)
   throw RangeError('AIR-02 incompatible '+key+' curve');
  return c;
 }
 // Midpoint integral table; normalize by total so one complete period has
 // precisely the authored mean speed. A zero curve means no motion.
 function integral(curve){
  const n=256,values=new Float64Array(n+1);
  for(let i=0;i<n;i++)values[i+1]=values[i]+Curves.evaluate(curve,(i+.5)/n)/n;
  const total=values[n];
  return u=>{
   if(!total)return 0;
   const cycles=Math.floor(u),part=(u-cycles)*n,i=Math.min(n-1,Math.floor(part));
   return cycles+(values[i]+(part-i)*(values[i+1]-values[i]))/total;
  };
 }
 function mod(x,n){return ((x%n)+n)%n;}
 function random(seed,id,salt){
  let x=seed^Math.imul(id+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function sampleFlights(events,seconds,config){
  if(!config||typeof config!=='object')throw TypeError('AIR-02 flight configuration required');
  const c=config,period=number(c.period,'period',1/60,16),
   width=number(c.fieldWidth,'fieldWidth',64,2048),height=number(c.fieldHeight,'fieldHeight',64,2048),
   size=number(c.flakeSize,'flakeSize',2,20),speed=number(c.fallSpeed,'fallSpeed',5,240),
   drift=number(c.windDrift,'windDrift',-120,120),spin=number(c.rotationSpeed,'rotationSpeed',-180,180),
   depth=number(c.depthVariation,'depthVariation',0,1),limit=number(c.limit,'limit',1,MAX_PARTICLES),
   seed=number(c.seed,'seed',-2147483648,2147483647);
  if(!Number.isInteger(limit)||!Number.isInteger(seed)||typeof c.layers?.near!=='boolean'||typeof c.layers?.far!=='boolean')
   throw TypeError('AIR-02 invalid flight configuration');
  const driftIntegral=integral(validateFlightCurve(c.driftCurve,'drift','effectTime',3)),
   spinIntegral=integral(validateFlightCurve(c.rotationCurve,'rotation','particleAge',3)),
   alpha=validateFlightCurve(c.flakeAlphaCurve,'flakeAlpha','particleAge',1),palette=Colors.normalize(c.palette);
  if(palette.domain!=='particleAge'||palette.parameterKey!=='snowColor')throw TypeError('AIR-02 incompatible palette');
  // Validate the complete timetable even when both layers are disabled.
  periodicAges(events,seconds,{period,lifetime:0,limit});
  const margin=size*2,travel=height+2*margin,span=width+2*margin;
  const out=[];
  for(const layer of ['near','far']){
   if(!c.layers[layer])continue;
   const near=layer==='near',factor=near?1:-1,
    v=speed*(1+factor*.4*depth),diameter=size*(1+factor*.5*depth),life=travel/v,
    births=events.filter(e=>(((e.id%20)*7)%20<7)===near);
   if(!births.length)continue;
   const remaining=limit-out.length;
   const live=periodicAges(births,seconds,{period,lifetime:life,limit:Math.max(1,remaining)});
   if(live.length>remaining)throw RangeError('AIR-02 particle budget exceeded');
   for(const p of live){
    const age=p.age/life,phase=p.time/period,
     dx=drift*period*(driftIntegral(phase+p.age/period)-driftIntegral(phase)),
     x=mod(p.x+dx+span/2,span)-span/2,
     rgba=Colors.sample(palette,age);
    rgba[3]*=Curves.evaluate(alpha,age)*(near?1:1-.45*depth);
    out.push({...p,layer,x,y:-height/2-margin+p.age*v,size:diameter,speed:v,
     rotation:random(seed,p.id,1)*360+spin*life*spinIntegral(age),
     shape:Math.floor(random(seed,p.id,2)*3),rgba});
   }
  }
  return out;
 }
 return {periodicAges,flightDefaults,sampleFlights};
});
