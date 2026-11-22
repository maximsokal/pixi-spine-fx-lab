// WATER-06: pure steam plume scene model — deterministic absolute-time simulation.
// No Pixi, DOM or browser APIs. Shared FX v1 curves, spacing, colors.
(function(root,create){
 'use strict';
 const api=Object.freeze(create(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSteam=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('Steam requires FxCurves/FxSpacing/FxColors v1');
 const LAYERS=Object.freeze(['dense','wisps','droplets']),TAU=Math.PI*2;
 const BUDGETS=Object.freeze({low:{maxPuffs:350,maxPrimitives:400},
  balanced:{maxPuffs:1100,maxPrimitives:1600},
  high:{maxPuffs:2800,maxPrimitives:3500}});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const num=(x,name,lo,hi)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)
   throw TypeError('Steam invalid '+name+' expected ['+lo+','+hi+']');
  return x;
 };
 const int=(x,n,a,b)=>{num(x,n,a,b);if(!Number.isInteger(x))throw TypeError('Steam invalid integer '+n);return x};
 const keys=(input,allowed,what)=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Steam invalid '+what);
  for(const k of Object.keys(input))if(!allowed.includes(k))throw TypeError('Steam unknown '+what+'.'+k);
 };
 function rng(seed,i,salt=0){
  let x=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 const hash=str=>{let x=2166136261;for(let i=0;i<str.length;i++)
  x=Math.imul((x^str.charCodeAt(i)),16777619);return x|0};
 function curve(key,domain,points,range,unit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],
   clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 const motionPath=()=>({schemaVersion:1,closed:false,segments:[{
  p0:[0,0],p1:[20,-12],p2:[35,-34],p3:[60,-46]}]});
 function newEmitter(n=0){
  return {id:'emitter'+(n+1),name:'Steam Jet '+(n+1),enabled:true,visible:true,
   x:n*38,y:0,rotation:0,timeOffset:0,seed:1219+n*997,rateScale:1,speedScale:1,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:420,rotation:0},
   motion:{mode:'stationary',speed:55,path:motionPath()},
   layers:{
    dense:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'normal',anchor:{type:'inherit',space:'world',name:'',slot:'',x:0,y:0,rotation:0}},
    wisps:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:.7,blend:'normal',anchor:{type:'inherit',space:'world',name:'',slot:'',x:0,y:0,rotation:0}},
    droplets:{enabled:false,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:.8,blend:'normal',anchor:{type:'inherit',space:'world',name:'',slot:'',x:0,y:0,rotation:0}}
   }
  };
 }
 function defaults(){
  return {schemaVersion:1,mode:'loop',rate:12,initialSize:18,expansion:2.2,
   flowSpeed:90,diffusion:.55,softness:.7,lifetimeSeconds:1.8,windX:0,
   nozzleWidth:64,originGap:20,spatialJitter:.35,intervalJitter:0,
   emissionFrames:40,stopFrame:0,fadeFrames:40,durationFrames:60,
   exportFrames:60,seed:217,style:'natural',quality:'balanced',
   spatialMode:'even',emissionMode:'time',spacingCurveEnabled:true,
   minGapSeconds:0,curlScale:16,
   emissionRateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,3]),
   sizeCurve:curve('puffSize','particleAge',[[0,.6],[.5,1.4],[1,2.2]],[.1,4]),
   opacityCurve:curve('puffOpacity','particleAge',[[0,.9],[.5,.45],[1,0]],[0,1]),
   flowCurve:curve('flowSpeedMultiplier','particleAge',[[0,1],[1,.15]],[0,3]),
   spacingCurve:curve('spacingPx','pathPosition',[[0,20],[.5,20],[1,20]],[3,100],'px'),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'steamColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'near',position:0,rgba:[245,249,251,.92]},
     {id:'far',position:1,rgba:[173,191,200,.65]}]}),
   emitters:[newEmitter(0)]};
 }
 const FIELDS=Object.keys(defaults());
 function validateLayerAnchor(a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw TypeError('Steam invalid layer anchor');
  keys(a,['type','space','name','slot','x','y','rotation'],'layer anchor');
  if(!['inherit','world','skeleton','bone','slot','attachment'].includes(a.type)||
     !['world','local'].includes(a.space)||typeof a.name!=='string'||typeof a.slot!=='string'||
     (['bone','slot','attachment'].includes(a.type)&&!a.name.trim())||
     (a.type==='attachment'&&!a.slot.trim()))throw TypeError('Steam invalid layer anchor');
  return {type:a.type,space:a.space,name:a.name,slot:a.slot,
   x:num(a.x,'layer anchor.x',-10000,10000),y:num(a.y,'layer anchor.y',-10000,10000),
   rotation:num(a.rotation,'layer anchor.rotation',-360,360)};
 }
  function normalize(input){
  keys(input,FIELDS,'settings');
  if(input.schemaVersion!==1)throw TypeError('Steam unsupported schemaVersion');
  const numeric={rate:[0,100],initialSize:[3,90],expansion:[1,6],
   flowSpeed:[0,400],diffusion:[0,1],softness:[0,1],lifetimeSeconds:[.1,10],
   windX:[-250,250],nozzleWidth:[0,500],originGap:[0,80],
   spatialJitter:[0,.45],intervalJitter:[0,.45],
   emissionFrames:[1,600],stopFrame:[0,600],fadeFrames:[1,600],
   durationFrames:[1,1200],exportFrames:[1,3600],seed:[-2147483648,2147483647],
   minGapSeconds:[0,2],curlScale:[0,150]};
  const ints=new Set(['emissionFrames','stopFrame','fadeFrames','durationFrames','exportFrames','seed']);
  const out={schemaVersion:1};
  for(const [k,[lo,hi]] of Object.entries(numeric))
   out[k]=ints.has(k)?int(input[k],k,lo,hi):num(input[k],k,lo,hi);
  for(const [key,options] of Object.entries({
   mode:['loop','stop','burst'],style:['natural','stylized','magical'],
   quality:['low','balanced','high'],spatialMode:['even','random','clustered'],
   emissionMode:['time','distance','both']})){
   if(!options.includes(input[key]))throw TypeError('Steam invalid '+key);out[key]=input[key];
  }
  if(typeof input.spacingCurveEnabled!=='boolean')throw TypeError('Steam spacingCurveEnabled');
  out.spacingCurveEnabled=input.spacingCurveEnabled;
  // A looping puff can outlive one cycle: pre-roll across as many previous
  // repetitions as its lifetime needs, then cap globally rather than reject.
  if(out.mode==='stop'&&out.stopFrame+out.fadeFrames!==out.durationFrames)
   throw TypeError('Steam stop+fade exceeds durationFrames');
  if(out.mode==='burst'&&out.emissionFrames+out.fadeFrames!==out.durationFrames)
   throw TypeError('Steam burst+fade exceeds durationFrames');
  for(const [key,id,domain,unit] of [
   ['emissionRateCurve','emissionRate','emitterTime','multiplier'],
   ['sizeCurve','puffSize','particleAge','multiplier'],
   ['opacityCurve','puffOpacity','particleAge','multiplier'],
   ['flowCurve','flowSpeedMultiplier','particleAge','multiplier'],
   ['spacingCurve','spacingPx','pathPosition','px']]){
   const c=Curves.normalize(input[key]);
   if(c.parameterKey!==id||c.domain!==domain||c.valueUnit!==unit)
    throw TypeError('Steam wrong curve domain/key '+key);
   out[key]=c;
  }
  out.palette=Colors.normalize(input.palette);
  if(out.palette.parameterKey!=='steamColor'||out.palette.domain!=='particleAge')
   throw TypeError('Steam invalid color palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('Steam max four emitters');
  const ids=new Set();out.emitters=[];
  for(const e of input.emitters){
   keys(e,['id','name','enabled','visible','x','y','rotation','timeOffset','seed',
    'rateScale','speedScale','anchor','motion','layers'],'emitter');
   if(typeof e.id!=='string'||!/^[A-Za-z][\w-]{0,63}$/.test(e.id)||ids.has(e.id))
    throw TypeError('Steam duplicate/invalid ID');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80)
    throw TypeError('Steam invalid emitter name');
   if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('Steam emitter enabled/visible must be boolean');
   const emitter={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:num(e.x,'emitter.x',-10000,10000),y:num(e.y,'emitter.y',-10000,10000),
    rotation:num(e.rotation,'emitter.rotation',-360,360),
    timeOffset:int(e.timeOffset,'emitter.timeOffset',-600,600),
    seed:int(e.seed,'emitter.seed',-2147483648,2147483647),
    rateScale:num(e.rateScale,'emitter.rateScale',0,3),
    speedScale:num(e.speedScale,'emitter.speedScale',0,3)};
   const a=e.anchor;
   keys(a,['type','space','name','slot','x','y','rotation'],'anchor');
   if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
      !['world','local'].includes(a.space)||typeof a.name!=='string'||
      typeof a.slot!=='string'||a.name.length>128||a.slot.length>128||
      (['bone','slot','attachment'].includes(a.type)&&!a.name.trim())||
      (a.type==='attachment'&&!a.slot.trim()))throw TypeError('Steam invalid anchor');
   emitter.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:num(a.x,'anchor.x',-10000,10000),y:num(a.y,'anchor.y',-10000,10000),
    rotation:num(a.rotation,'anchor.rotation',-360,360)};
   const m=e.motion;keys(m,['mode','speed','path'],'motion');
   if(!['stationary','path'].includes(m.mode))throw TypeError('Steam invalid path mode');
   emitter.motion={mode:m.mode,speed:num(m.speed,'motion.speed',0,900),
    path:Spacing.normalizePath(m.path)};
   if(emitter.motion.path.closed||emitter.motion.path.segments.length!==1)
    throw TypeError('Steam motion guide needs one open cubic');
   if(!e.layers||Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('Steam requires three independently owned layers');
   emitter.layers={};
   for(const key of LAYERS){
    const layer=e.layers[key];
    keys(layer,['enabled','visible','x','y','rotation','timeOffset','alpha','blend','anchor'],'layer');
    if(typeof layer.enabled!=='boolean'||typeof layer.visible!=='boolean'||
     !['normal','add','screen','multiply'].includes(layer.blend))
     throw TypeError('Steam invalid layer '+key);
    emitter.layers[key]={enabled:layer.enabled,visible:layer.visible,blend:layer.blend,
     x:num(layer.x,'layer.x',-10000,10000),y:num(layer.y,'layer.y',-10000,10000),
     rotation:num(layer.rotation,'layer.rotation',-360,360),
     timeOffset:int(layer.timeOffset,'layer.timeOffset',-3600,3600),
     alpha:num(layer.alpha,'layer.alpha',0,1),anchor:validateLayerAnchor(layer.anchor)};
   }
   out.emitters.push(emitter);
  }
  const peak=out.emissionRateCurve.keys.reduce((m,k)=>Math.max(m,k.y),0);
  const upper=Math.ceil(out.rate*Math.max(1,peak)*out.lifetimeSeconds+2)*out.emitters.length;
  if(upper>BUDGETS[out.quality].maxPuffs)
   throw RangeError('Steam candidate budget exceeded '+upper+' > '+BUDGETS[out.quality].maxPuffs);
  return out;
 }
 function pathPoint(e,seconds){
  if(e.motion.mode==='stationary'||e.motion.speed===0)
   return {x:0,y:0,angle:-Math.PI/2,distance:0};
  const table=Spacing.buildArcTable(e.motion.path);
  const point=Spacing.pointAtDistance(table,clamp(seconds*e.motion.speed,0,table.length));
  return {...point,total:table.length};
 }
 const mouthCache=new Map();
 function mouth(cfg,index,seed){
  if(cfg.nozzleWidth<=0||cfg.originGap<=0)return {x:0,y:0,slots:1,capped:false};
  const key=JSON.stringify([cfg.nozzleWidth,cfg.originGap,cfg.spatialJitter,
   cfg.spatialMode,cfg.spacingCurveEnabled,cfg.spacingCurve,seed]);
  let origins=mouthCache.get(key);
  if(!origins){
   const half=cfg.nozzleWidth/2;
   const path={schemaVersion:1,closed:false,segments:[{
    p0:[-half,0],p1:[-half/3,0],p2:[half/3,0],p3:[half,0]}]};
   const factor=cfg.originGap/20;
   const source=cfg.spacingCurve;
   const physicalCurve=cfg.spacingCurveEnabled?{
    ...source,valueRange:[0,1000],defaultValue:source.defaultValue*factor,
    keys:source.keys.map(k=>({...k,y:k.y*factor,
     ...(k.in?{in:[k.in[0],k.in[1]*factor]}:{}),
     ...(k.out?{out:[k.out[0],k.out[1]*factor]}:{})}))
   }:null;
   const placement=Spacing.createSpatialPlacement({path,
    baseSpacingPx:cfg.originGap,minSpacing:3,maxSpacing:100,
    mode:'even',jitter:cfg.spatialJitter,seed,maxPoints:512,
    spacingCurve:physicalCurve});
   if(placement.capped)throw RangeError('Steam nozzle origin budget exceeded');
   const raw=placement.points.map(p=>p.distance);
   if(!raw.length)raw.push(placement.table.length/2);
   // Arc-distance recentering preserves the true inter-origin gaps.
   const middle=(raw[0]+raw[raw.length-1])/2;
   origins=raw.map(x=>Spacing.pointAtDistance(placement.table,
    x+placement.table.length/2-middle));
   if(mouthCache.size>=24)mouthCache.delete(mouthCache.keys().next().value);
   mouthCache.set(key,origins);
  }
  const slots=origins.length;
  let chosen=index%slots;
  if(cfg.spatialMode==='random')chosen=Math.floor(rng(seed,index,44)*slots);
  if(cfg.spatialMode==='clustered')
   chosen=clamp(Math.round((slots-1)/2+(rng(seed,index,45)-.5)*slots*.4),0,slots-1);
  const point=origins[chosen];return {x:point.x,y:point.y,slots,capped:false,
   origins,arcErrorBound:0};
 }
 const scheduleCache=new Map();
 function schedule(cfg,e){
  const period=1;
  if(cfg.rate===0||e.rateScale===0)return {events:[],origins:[],arcErrorBound:0,capped:false};
  const seed=(cfg.seed^e.seed^hash(e.id))|0;
  const key=JSON.stringify([cfg.rate,e.rateScale,seed,cfg.emissionRateCurve,
   cfg.temporalMode,cfg.intervalJitter,cfg.minGapSeconds,cfg.nozzleWidth,
   cfg.originGap,cfg.spatialJitter,cfg.spatialMode,cfg.spacingCurve]);
  if(scheduleCache.has(key))return scheduleCache.get(key);
  const raw=Spacing.createTemporalSchedule({
   schemaVersion:1,mode:'custom',frequencySource:'rate',baseRate:cfg.rate*e.rateScale,
   interval:1/Math.max(.0001,cfg.rate*e.rateScale),duration:period,
   minInterval:cfg.minGapSeconds,jitter:cfg.intervalJitter,
   burstCount:1,burstDelay:0,seed,maxEvents:4096,rateCurve:cfg.emissionRateCurve,
   intervalCurve:null
  });
  if(raw.capped)throw RangeError('Steam temporal schedule capped');
  const events=raw.events.map((v,i)=>{
   let time=v.time;
   if(Math.abs(time-period)<1e-9)time=0;
   return {time,index:i};
  }).sort((a,b)=>a.time-b.time||a.index-b.index);
  const first=mouth(cfg,0,seed);
  const result={events,origins:first.origins||[{x:0,y:0}],
   arcErrorBound:first.arcErrorBound||0,capped:false};
  if(scheduleCache.size>=24)scheduleCache.delete(scheduleCache.keys().next().value);
  scheduleCache.set(key,result);return result;
 }
 function births(cfg,e,time){
  const seed=(cfg.seed^e.seed^hash(e.id))|0;
  const temporal=schedule(cfg,e);
  if(cfg.emissionMode!=='time'&&e.motion.mode!=='path')
   return {events:[],capped:false,diagnostic:'distance emission needs moving source'};
  let original=temporal.events;
  if(cfg.emissionMode!=='time'){
   const table=Spacing.buildArcTable(e.motion.path);
   const points=Spacing.createSpatialPlacement({
    path:e.motion.path,mode:cfg.spatialMode==='random'?'random':
    cfg.spatialMode==='clustered'?'clustered':'even',
    baseSpacingPx:cfg.originGap,minSpacing:3,maxSpacing:100,
    jitter:cfg.spatialJitter,seed,maxPoints:1000,
    spacingCurve:cfg.spacingCurveEnabled?cfg.spacingCurve:null});
   if(e.motion.speed<=0||!points.points.length)return {events:[],capped:false};
   if(cfg.emissionMode==='distance')
    original=points.points.filter(p=>p.distance<=e.motion.speed+1e-8).map((p,i)=>({
     time:p.distance/e.motion.speed,index:i,
     position:{x:p.x,y:p.y}}));
   else{
    const motion=Array.from({length:241},(_,j)=>{
     const pt=Spacing.pointAtDistance(table,e.motion.speed*j/240);
     return {time:j/240,x:pt.x,y:pt.y};
    });
    original=Spacing.combineSchedule({schedule:temporal,placement:points,motion,
     mode:'both',maxEvents:4096}).events.map((v,i)=>({
      time:v.time,index:i,position:{x:v.x,y:v.y}}));
   }
  }
  const result=[],back=Math.ceil(cfg.lifetimeSeconds)+2;
  const limit=cfg.mode==='loop'?time:Math.min(time,0);
  for(let cycle=-back;cycle<=0;cycle++)for(const ev of original){
   const born=ev.time+cycle;
   if(born>limit+1e-9||time-born<0||time-born>=cfg.lifetimeSeconds)continue;
   const origin=mouth(cfg,ev.index,seed);
   const travel=ev.position||(e.motion.mode==='path'?pathPoint(e,ev.time):{x:0,y:0});
   result.push({time:born,index:ev.index,
    position:{x:travel.x+origin.x,y:travel.y+origin.y}});
   if(result.length>=4096)throw RangeError('Steam lifetime history capped');
  }
  result.sort((a,b)=>a.time-b.time||a.index-b.index);
  return {events:result,capped:false};
 }
 function makeRiseLookup(curve){
  const n=96,values=new Float64Array(n+1),step=1/n;
  for(let i=1;i<=n;i++)values[i]=values[i-1]+
   (Curves.evaluate(curve,(i-1)*step)+Curves.evaluate(curve,i*step))*step/2;
  return u=>{
   const x=clamp(u,0,1)*n,i=Math.min(n-1,Math.floor(x));
   return values[i]+(values[i+1]-values[i])*(x-i);
  };
 }
 function puffDiameter(cfg,u){
  const age=clamp(u,0,1),c=Curves.evaluate(cfg.sizeCurve,age),
   start=Curves.evaluate(cfg.sizeCurve,0),end=Curves.evaluate(cfg.sizeCurve,1),
   baseline=(1-age)*start+age*end;
  if(!(baseline>0)||!Number.isFinite(c))throw TypeError('Steam size curve invalid');
  return cfg.initialSize*(1+(cfg.expansion-1)*age)*(c/baseline);
 }
 function travel(cfg,u){
  const integrate=makeRiseLookup(cfg.flowCurve);
  return cfg.flowSpeed*cfg.lifetimeSeconds*integrate(clamp(u,0,1));
 }
 function sample(input,seconds){
  const cfg=normalize(input),actual=num(seconds,'seconds',0,1e7),
   phase=cfg.mode==='loop'?Math.round((actual%1)*1e9)/1e9:actual,
   now=cfg.mode==='loop'?phase:phase,
   fade=cfg.mode==='loop'?1:clamp(1-now/(39/60),0,1);
  const report={schemaVersion:1,time:phase,total:cfg.durationFrames/60,
   emitters:[],primitives:0,activePuffs:0,capped:false,diagnostics:[],phase};
  if(fade<=0||cfg.mode!=='loop'&&now>=cfg.durationFrames/60)return report;
  const flow=makeRiseLookup(cfg.flowCurve),budget=BUDGETS[cfg.quality];
  for(const e of [...cfg.emitters].sort((a,b)=>a.id.localeCompare(b.id))){
   const row={id:e.id,active:0,layers:Object.fromEntries(LAYERS.map(k=>[k,[]])),
    events:[],capped:false};
   report.emitters.push(row);
   if(!e.enabled||!e.visible)continue;
   const elapsed=phase-e.timeOffset/60,evs=births(cfg,e,elapsed);
   row.events=evs.events;
   if(evs.diagnostic){report.diagnostics.push(e.id+': '+evs.diagnostic);continue}
   const seed=(cfg.seed^e.seed^hash(e.id))|0;
   for(const ev of evs.events){
    const ageSeconds=elapsed-ev.time,u=ageSeconds/cfg.lifetimeSeconds;
    if(u<0||u>=1)continue;
    if(report.activePuffs>=budget.maxPuffs)throw RangeError('Steam live puff budget exceeded');
    const rgba=Colors.sample(cfg.palette,u),
     opacity=Curves.evaluate(cfg.opacityCurve,u)*fade*rgba[3];
    if(opacity<=0)continue;
    const diameter=puffDiameter(cfg,u),ratio=.78+.42*rng(seed,ev.index,55),
     side=cfg.diffusion*cfg.curlScale*u*
       (Math.sin(rng(seed,ev.index,52)*TAU+u*TAU*1.2)-
        Math.sin(rng(seed,ev.index,52)*TAU))*Math.sin(Math.PI*u);
    const vx=side+cfg.windX*ageSeconds,vy=-cfg.flowSpeed*e.speedScale*
      cfg.lifetimeSeconds*flow(u);
    const shape=cfg.style==='stylized'?1:cfg.style==='magical'?1.3:ratio;
    const base={kind:'puff',x:ev.position.x+vx,y:ev.position.y+vy,
     width:diameter*shape,height:diameter/shape,rotation:0,
     diffusionOffset:side,variant:Math.floor(rng(seed,ev.index,57)*4),
     rgba:[...rgba.slice(0,3),opacity]};
    function add(kind,p){
     const layer=e.layers[kind];
     if(!layer.enabled||!layer.visible||layer.alpha<=0)return;
     const relative=elapsed-layer.timeOffset/60-ev.time;
     if(relative<0||relative>=cfg.lifetimeSeconds)return;
     if(report.primitives>=budget.maxPrimitives)
      throw RangeError('Steam visible primitive budget exceeded');
     const theta=layer.rotation*Math.PI/180;
     const x=p.x,y=p.y;
     p.x=x*Math.cos(theta)-y*Math.sin(theta)+layer.x;
     p.y=x*Math.sin(theta)+y*Math.cos(theta)+layer.y;
     p.rotation+=theta;
     p.rgba[3]*=layer.alpha;p.emitterId=e.id;
     row.layers[kind].push(p);report.primitives++;
    }
    add('dense',{...base,rgba:[...base.rgba]});
    if(ev.index%2===0)add('wisps',{...base,
     x:base.x+cfg.diffusion*(rng(seed,ev.index,61)-.5)*diameter,
     y:base.y-2*u*diameter,width:base.width*(1+.55*u),
     height:base.height*(1+.55*u),rgba:[...base.rgba.slice(0,3),opacity*.55]});
    if(ev.index%5===0&&u>.55)add('droplets',{...base,
     x:base.x+(rng(seed,ev.index,71)-.5)*diameter,
     y:base.y+.5*190*(ageSeconds-cfg.lifetimeSeconds*.55)**2,
     width:Math.max(2,diameter*.13),height:Math.max(2,diameter*.13),
     rgba:[...base.rgba.slice(0,3),opacity*.8]});
    row.active++;report.activePuffs++;
   }
  }
  return report;
 }
 function bounds(snapshot,anchors,input){
  const cfg=normalize(input);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const entry of snapshot.emitters){
   const e=cfg.emitters.find(x=>x.id===entry.id),a=anchors[entry.id];
   if(!a)continue;
   const rad=e.anchor.rotation*Math.PI/180,
    ox=e.x*Math.cos(rad)-e.y*Math.sin(rad)+a.x,
    oy=e.x*Math.sin(rad)+e.y*Math.cos(rad)+a.y;
   const hit=(x,y,r)=>{
    const xx=x*Math.cos(rad)-y*Math.sin(rad)+ox,
     yy=x*Math.sin(rad)+y*Math.cos(rad)+oy;
    minX=Math.min(minX,xx-r);maxX=Math.max(maxX,xx+r);
    minY=Math.min(minY,yy-r);maxY=Math.max(maxY,yy+r);
   };
   for(const layer of Object.values(entry.layers))for(const puff of layer){
    const r=puff.kind==='ash'?puff.radius:
     Math.hypot(puff.width,puff.height)/2;
    hit(puff.x,puff.y,r);
   }
  }
  return {empty:minX===Infinity,minX,minY,maxX,maxY,
   inside:minX===Infinity||(minX>=0&&minY>=0&&maxX<=512&&maxY<=512)};
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,newEmitter,normalize,
  sample,schedule,births,mouth,makeRiseLookup,pathPoint,bounds,puffDiameter,travel};
});
