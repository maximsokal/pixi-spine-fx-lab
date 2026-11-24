// AIR-02 — pure periodic pre-roll kernel. No renderer or frame-driven state.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxSnow=api;
})(globalThis,function(Curves,Colors,Spacing){
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
   inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration',
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
     c.inputUnit!==(domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration')||
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
 // Full document and shared scheduling; all positions remain in authoring space.
 const LAYERS=Object.freeze(['near','far','windSwirls']);
 const BUDGETS=Object.freeze({low:512,balanced:2048,high:4096});
 function strict(o,keys,name){
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))
   throw TypeError('AIR-02 invalid '+name);
 }
 function integer(v,name,lo,hi){
  number(v,name,lo,hi);if(!Number.isInteger(v))throw RangeError('AIR-02 invalid '+name);return v;
 }
 function choice(v,values,name){if(!values.includes(v))throw TypeError('AIR-02 invalid '+name);return v;}
 function bool(v,name){if(typeof v!=='boolean')throw TypeError('AIR-02 invalid '+name);return v;}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function anchor(type='world',x=0,y=0){return {type,space:'world',name:'',slot:'',x,y,rotation:0};}
 function newEmitter(index=0){
  integer(index,'emitter index',0,2147483646);
  const layer=(kind,i)=>({enabled:kind!=='windSwirls',visible:true,x:0,y:0,rotation:0,timeOffset:0,
   seed:(71+17*index+i*313)|0,alpha:1,blend:'normal',anchor:anchor('inherit')});
  return {id:'emitter'+(index+1),name:'Snowfall '+(index+1),enabled:true,visible:true,
   x:0,y:0,rotation:0,timeOffset:0,seed:(1991+337*index)|0,
   anchor:anchor('world',256,256),layers:Object.fromEntries(LAYERS.map((k,i)=>[k,layer(k,i)]))};
 }
 function stylePalette(style){
  choice(style,['natural','stylized','magical'],'style');
  const p=flightDefaults().palette;
  const colors=style==='natural'?[[255,255,255,1],[214,234,251,1]]:
   style==='stylized'?[[255,255,255,1],[166,215,255,1]]:
   [[255,249,255,1],[207,187,255,1]];
  return Colors.normalize({...p,stops:p.stops.map((s,i)=>({...s,rgba:colors[i]}))});
 }
 function defaults(style='natural'){
  const {period,fieldHeight,limit,layers,...flight}=flightDefaults();
  return {schemaVersion:1,...flight,mode:'loop',durationFrames:60,exportFrames:60,quality:'balanced',
   style,flakesPerSecond:22,horizontalGapPx:24,spatialMode:'even',spatialJitter:.12,
   emissionRateCurve:curve('emissionRate','effectTime',[[0,1],[1,1]],3),
   horizontalSpacingCurve:curve('horizontalSpacing','pathPosition',[[0,1],[1,1]],3),
   palette:stylePalette(style),emitters:[newEmitter()]};
 }
 const FIELDS=Object.keys(defaults()),EK=Object.keys(newEmitter()),LK=Object.keys(newEmitter().layers.near),
  AK=Object.keys(anchor());
 function normalizeAnchor(a,allowInherit){
  strict(a,AK,'anchor');
  const type=choice(a.type,['world','skeleton','bone','slot','attachment',...(allowInherit?['inherit']:[])],'anchor type');
  if(typeof a.name!=='string'||typeof a.slot!=='string'||a.name.length>128||a.slot.length>128||
   (['bone','slot','attachment'].includes(type)&&!a.name.trim())||(type==='attachment'&&!a.slot.trim()))
   throw TypeError('AIR-02 invalid anchor name');
  return {type,space:choice(a.space,['world','local'],'anchor space'),name:a.name,slot:a.slot,
   x:number(a.x,'anchor x',-10000,10000),y:number(a.y,'anchor y',-10000,10000),
   rotation:number(a.rotation,'anchor rotation',-360,360)};
 }
 function normalize(input){
  strict(input,FIELDS,'settings');
  if(input.schemaVersion!==1)throw TypeError('AIR-02 unsupported schemaVersion');
  const mode=choice(input.mode,['loop','oneShot'],'mode'),durationFrames=integer(input.durationFrames,'durationFrames',40,960);
  if(mode==='oneShot'?durationFrames!==40:durationFrames!==60&&(durationFrames<600||durationFrames>960))
   throw RangeError('AIR-02 invalid mode/duration');
  const c={schemaVersion:1};
  for(const [key,lo,hi] of [['fieldWidth',64,2048],['flakeSize',2,20],['fallSpeed',5,240],
    ['windDrift',-120,120],['rotationSpeed',-180,180],['depthVariation',0,1],
    ['flakesPerSecond',0,120],['horizontalGapPx',4,100],['spatialJitter',0,.45]])
   c[key]=number(input[key],key,lo,hi);
  Object.assign(c,{seed:integer(input.seed,'seed',-2147483648,2147483647),mode,durationFrames,
   exportFrames:integer(input.exportFrames,'exportFrames',1,3600),
   quality:choice(input.quality,Object.keys(BUDGETS),'quality'),
   style:choice(input.style,['natural','stylized','magical'],'style'),
   spatialMode:choice(input.spatialMode,['even','random','clustered','stratified'],'spatialMode')});
  for(const [field,key,domain,max] of [['driftCurve','drift','effectTime',3],
   ['flakeAlphaCurve','flakeAlpha','particleAge',1],['rotationCurve','rotation','particleAge',3],
   ['emissionRateCurve','emissionRate','effectTime',3],['horizontalSpacingCurve','horizontalSpacing','pathPosition',3]])
   c[field]=validateFlightCurve(input[field],key,domain,max);
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='snowColor'||c.palette.domain!=='particleAge')throw TypeError('AIR-02 incompatible palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)throw TypeError('AIR-02 max 4 emitters');
  const ids=new Set();
  const common=(v,name)=>({enabled:bool(v.enabled,name+' enabled'),visible:bool(v.visible,name+' visible'),
   x:number(v.x,name+' x',-10000,10000),y:number(v.y,name+' y',-10000,10000),
   rotation:number(v.rotation,name+' rotation',-360,360),
   timeOffset:integer(v.timeOffset,name+' timeOffset',-3600,3600),
   seed:integer(v.seed,name+' seed',-2147483648,2147483647)});
  c.emitters=input.emitters.map(e=>{
   strict(e,EK,'emitter');
   if(typeof e.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(e.id)||ids.has(e.id)||
      typeof e.name!=='string'||!e.name.trim()||e.name.length>128)throw TypeError('AIR-02 invalid/duplicate emitter');
   ids.add(e.id);strict(e.layers,LAYERS,'layers');
   const layers={};
   for(const kind of LAYERS){
    const l=e.layers[kind];strict(l,LK,kind);
    layers[kind]={...common(l,kind),alpha:number(l.alpha,kind+' alpha',0,1),
     blend:choice(l.blend,['normal','add','screen','multiply'],kind+' blend'),
     anchor:normalizeAnchor(l.anchor,true)};
   }
   return {id:e.id,name:e.name,...common(e,'emitter'),anchor:normalizeAnchor(e.anchor,false),layers};
  });
  return c;
 }
 function seedFor(c,e,kind='schedule'){return (c.seed^e.seed^hash(e.id)^hash(kind)^(e.layers[kind]?.seed??0))|0;}
 function isNear(id){return ((id%20)*7)%20<7;}
 function scheduleFor(c,e){
  const period=c.durationFrames/60,seed=seedFor(c,e),w=c.fieldWidth,gap=c.horizontalGapPx,
   curve=c.horizontalSpacingCurve;
  const rateCurve=Curves.normalize({...c.emissionRateCurve,domain:'emitterTime'});
  const temporal=Spacing.createTemporalSchedule({schemaVersion:1,mode:'custom',baseRate:c.flakesPerSecond,
   frequencySource:'rate',duration:period,seed,maxEvents:MAX_EVENTS,rateCurve});
  if(temporal.capped)throw RangeError('AIR-02 event cap exceeded');
  const physical=Curves.normalize({...curve,parameterKey:'spacingPx',valueUnit:'px',
   defaultValue:curve.defaultValue*gap,valueRange:curve.valueRange.map(v=>v*gap),
   keys:curve.keys.map(k=>({...k,y:k.y*gap,...(k.in?{in:[k.in[0],k.in[1]*gap]}:{}),
    ...(k.out?{out:[k.out[0],k.out[1]*gap]}:{})}))});
  const spatial=Spacing.createSpatialPlacement({schemaVersion:1,
   path:{schemaVersion:1,closed:false,segments:[{p0:[-w/2,0],p1:[-w/6,0],p2:[w/6,0],p3:[w/2,0]}]},
   baseSpacingPx:gap,minSpacing:.25,maxSpacing:500,spacingCurve:physical,mode:c.spatialMode,
   jitter:c.spatialJitter,seed,maxPoints:8192,pathFollow:'clamp',tolerancePx:.25});
  if(spatial.capped)throw RangeError('AIR-02 spatial cap exceeded');
  // A gap wider than the field has one center launch point, not zero emissions.
  const points=spatial.points.length?spatial.points:[{x:0,distance:w/2}];
  const events=temporal.events.map(({time,index:id})=>{
   const p=points[id%points.length];
   return {id,time:time>=period?0:time,x:p.x,distance:p.distance,layer:isNear(id)?'near':'far'};
  }).sort((a,b)=>a.time-b.time||a.id-b.id);
  return {period,events,launchDistances:points.map(p=>p.distance),arcErrorBound:spatial.table.errorBound,
   effectiveRate:events.length/period};
 }
 function schedule(input,emitter){
  const c=normalize(input),e=c.emitters.find(e=>e.id===(typeof emitter==='string'?emitter:emitter?.id));
  if(!e)throw TypeError('AIR-02 emitter missing');return scheduleFor(c,e);
 }
 function phaseSeconds(t,p){
  // Stabilize equivalent authored phases across fractional-frame offsets.
  const v=Math.round(mod(t,p)*1e12)/1e12;return v>=p-1e-12?0:v;
 }
 const SWIRL_LIFE=1.2;
 function active(e,l){return e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;}
 function transform(e,l){
  const angle=e.rotation*Math.PI/180;
  return {x:e.x+l.x*Math.cos(angle)-l.y*Math.sin(angle),
   y:e.y+l.x*Math.sin(angle)+l.y*Math.cos(angle),rotation:e.rotation+l.rotation};
 }
 function swirls(c,events,t,period,seed,limit){
  const span=c.fieldWidth+32;
  return periodicAges(events,t,{period,lifetime:SWIRL_LIFE,limit}).map(p=>{
   const u=p.age/SWIRL_LIFE,angle=2*Math.PI*u+random(seed,p.id,7)*2*Math.PI,
    rgba=Colors.sample(c.palette,u);
   rgba[3]*=.23*Math.sin(Math.PI*u);
   return {...p,layer:'windSwirls',x:mod(p.x+c.windDrift*p.age*1.5+12*Math.sin(angle)+span/2,span)-span/2,
    y:(random(seed,p.id,8)-.5)*480+10*Math.cos(angle),size:c.flakeSize*.6,
    speed:c.windDrift*1.5,rotation:angle*180/Math.PI,shape:0,rgba};
  });
 }
 function createPlan(input){
  const c=freeze(normalize(input)),period=c.durationFrames/60,limit=BUDGETS[c.quality],compiled=[];
  let peakUpperBound=0;
  for(const e of c.emitters){
   const plan=scheduleFor(c,e),layerPlans=[];
   for(const kind of LAYERS){
    const l=e.layers[kind],events=kind==='windSwirls'?plan.events.filter(p=>p.id%5===0):plan.events.filter(p=>p.layer===kind);
    const lifetime=kind==='windSwirls'?SWIRL_LIFE:(512+4*c.flakeSize)/(c.fallSpeed*(1+(kind==='near'?1:-1)*.4*c.depthVariation));
    // Safe full-period upper bound: at most ceil(lifetime/period) copies of each birth.
    if(active(e,l))peakUpperBound+=events.length*Math.ceil(lifetime/period);
    if(peakUpperBound>limit)throw RangeError('AIR-02 full-effect particle budget exceeded');
    layerPlans.push({kind,l,events,seed:seedFor(c,e,kind),transform:transform(e,l)});
   }
   compiled.push({e,plan,layerPlans});
  }
  const stop=(c.durationFrames-1)/60;
  function sample(seconds){
   number(seconds,'seconds',0,1e8);
   const one=c.mode==='oneShot',time=one?Math.min(seconds,stop):phaseSeconds(seconds,period),
    fade=one?Math.max(0,Math.min(1,(stop-time)/(stop*.25))):1;
   let cost=0;
   const emitters=compiled.map(({e,layerPlans})=>({id:e.id,anchor:e.anchor,layers:layerPlans.map(({kind,l,events,seed,transform})=>{
    const local=time-(e.timeOffset+l.timeOffset)/60;
    let particles=[];
    if(active(e,l)&&fade>0&&(!one||local>=0&&local<stop)&&events.length){
     const t=phaseSeconds(local,period);
     particles=kind==='windSwirls'?swirls(c,events,t,period,seed,limit):sampleFlights(events,t,{
      ...c,period,fieldHeight:512,limit,seed,layers:{near:kind==='near',far:kind==='far'}});
     for(const p of particles)p.rgba[3]*=l.alpha*fade;
     cost+=particles.length;
     if(cost>limit)throw RangeError('AIR-02 full-effect particle budget exceeded');
    }
    return {id:kind,enabled:active(e,l),anchor:l.anchor.type==='inherit'?e.anchor:l.anchor,
     transform:{...transform},blend:l.blend,particles};
   })}));
   return {schemaVersion:1,time,cost,emitters};
  }
  return Object.freeze({settings:c,period,peakUpperBound,sample});
 }
 function sample(input,seconds){return createPlan(input).sample(seconds);}
 function bounds(frame){
  // Authored local bounds only; Spine/world anchor resolution belongs to the renderer.
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const e of frame.emitters)for(const l of e.layers){
   const a=l.transform.rotation*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
   for(const p of l.particles){
    if(p.rgba[3]<=0)continue;
    const x=l.transform.x+p.x*co-p.y*si,y=l.transform.y+p.x*si+p.y*co,r=p.size*Math.SQRT2/2;
    left=Math.min(left,x-r);right=Math.max(right,x+r);top=Math.min(top,y-r);bottom=Math.max(bottom,y+r);
   }
  }
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:null;
 }
 return {periodicAges,flightDefaults,sampleFlights,LAYERS,BUDGETS,defaults,newEmitter,normalize,stylePalette,schedule,createPlan,sample,bounds};
});
