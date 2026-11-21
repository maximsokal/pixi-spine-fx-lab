// FIRE-05: pure smoke plume scene model — deterministic absolute-time simulation.
// No Pixi, DOM or browser APIs. Shared FX v1 curves, spacing, colors.
(function(root,create){
 'use strict';
 const api=Object.freeze(create(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSmoke=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('Smoke requires FxCurves/FxSpacing/FxColors v1');
 const LAYERS=Object.freeze(['core','wisps','ash']),TAU=Math.PI*2;
 const BUDGETS=Object.freeze({low:{maxPuffs:64,maxPrimitives:64},
  balanced:{maxPuffs:192,maxPrimitives:192},
  high:{maxPuffs:384,maxPrimitives:384}});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const num=(x,name,lo,hi)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)
   throw TypeError('Smoke invalid '+name+' expected ['+lo+','+hi+']');
  return x;
 };
 const int=(x,n,a,b)=>{num(x,n,a,b);if(!Number.isInteger(x))throw TypeError('Smoke invalid integer '+n);return x};
 const keys=(input,allowed,what)=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Smoke invalid '+what);
  for(const k of Object.keys(input))if(!allowed.includes(k))throw TypeError('Smoke unknown '+what+'.'+k);
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
  return {id:'emitter'+(n+1),name:'Smoke '+(n+1),enabled:true,visible:true,
   x:n*38,y:0,rotation:0,timeOffset:0,seed:1219+n*997,rateScale:1,speedScale:1,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:350,rotation:0},
   motion:{mode:'stationary',speed:55,path:motionPath()},
   layers:{
    core:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'normal'},
    wisps:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:.7,blend:'normal'},
    ash:{enabled:false,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:.8,blend:'normal'}
   }
  };
 }
 function defaults(){
  return {schemaVersion:1,mode:'loop',rate:18,initialSize:12,expansion:2.5,
   riseSpeed:55,swirl:.4,density:.65,lifetimeSeconds:2,windX:0,
   nozzleWidth:64,originGap:16,spatialJitter:.2,intervalJitter:.15,
   emissionFrames:40,stopFrame:60,fadeFrames:60,durationFrames:120,
   exportFrames:120,seed:217,style:'natural',quality:'balanced',
   spatialMode:'even',emissionMode:'time',spacingCurveEnabled:false,
   minGapSeconds:0,curlScale:16,
   emissionRateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,3]),
   sizeCurve:curve('puffSize','particleAge',[[0,.7],[.6,1.8],[1,2.5]],[0,6]),
   opacityCurve:curve('puffOpacity','particleAge',[[0,0],[.15,.65],[.6,.45],[1,0]],[0,1]),
   riseCurve:curve('riseSpeedMultiplier','particleAge',[[0,1],[1,.4]],[0,3]),
   spacingCurve:curve('originSpacingPx','pathPosition',[[0,16],[.5,12],[1,24]],[0,80],'px'),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'smokeColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'light',position:0,rgba:[166,164,165,1]},
     {id:'mid',position:.5,rgba:[102,99,106,1]},
     {id:'dark',position:1,rgba:[45,48,55,1]}]}),
   emitters:[newEmitter(0)]};
 }
 const FIELDS=Object.keys(defaults());
 function normalize(input){
  keys(input,FIELDS,'settings');
  if(input.schemaVersion!==1)throw TypeError('Smoke unsupported schemaVersion');
  const numeric={rate:[0,120],initialSize:[2,80],expansion:[1,6],
   riseSpeed:[0,250],swirl:[0,1],density:[0,1],lifetimeSeconds:[.1,10],
   windX:[-250,250],nozzleWidth:[0,500],originGap:[0,80],
   spatialJitter:[0,.45],intervalJitter:[0,.45],
   emissionFrames:[1,600],stopFrame:[1,600],fadeFrames:[1,600],
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
   if(!options.includes(input[key]))throw TypeError('Smoke invalid '+key);out[key]=input[key];
  }
  if(typeof input.spacingCurveEnabled!=='boolean')throw TypeError('Smoke spacingCurveEnabled');
  out.spacingCurveEnabled=input.spacingCurveEnabled;
  // A looping puff can outlive one cycle: pre-roll across as many previous
  // repetitions as its lifetime needs, then cap globally rather than reject.
  if(out.mode==='stop'&&out.stopFrame+out.fadeFrames>out.durationFrames)
   throw TypeError('Smoke stop+fade exceeds durationFrames');
  if(out.mode==='burst'&&out.emissionFrames+out.fadeFrames>out.durationFrames)
   throw TypeError('Smoke burst+fade exceeds durationFrames');
  for(const [key,id,domain,unit] of [
   ['emissionRateCurve','emissionRate','emitterTime','multiplier'],
   ['sizeCurve','puffSize','particleAge','multiplier'],
   ['opacityCurve','puffOpacity','particleAge','multiplier'],
   ['riseCurve','riseSpeedMultiplier','particleAge','multiplier'],
   ['spacingCurve','originSpacingPx','pathPosition','px']]){
   const c=Curves.normalize(input[key]);
   if(c.parameterKey!==id||c.domain!==domain||c.valueUnit!==unit)
    throw TypeError('Smoke wrong curve domain/key '+key);
   out[key]=c;
  }
  out.palette=Colors.normalize(input.palette);
  if(out.palette.parameterKey!=='smokeColor'||out.palette.domain!=='particleAge')
   throw TypeError('Smoke invalid color palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('Smoke max four emitters');
  const ids=new Set();out.emitters=[];
  for(const e of input.emitters){
   keys(e,['id','name','enabled','visible','x','y','rotation','timeOffset','seed',
    'rateScale','speedScale','anchor','motion','layers'],'emitter');
   if(typeof e.id!=='string'||!/^[A-Za-z][\w-]{0,63}$/.test(e.id)||ids.has(e.id))
    throw TypeError('Smoke duplicate/invalid ID');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80)
    throw TypeError('Smoke invalid emitter name');
   if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('Smoke emitter enabled/visible must be boolean');
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
      (a.type==='attachment'&&!a.slot.trim()))throw TypeError('Smoke invalid anchor');
   emitter.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:num(a.x,'anchor.x',-10000,10000),y:num(a.y,'anchor.y',-10000,10000),
    rotation:num(a.rotation,'anchor.rotation',-360,360)};
   const m=e.motion;keys(m,['mode','speed','path'],'motion');
   if(!['stationary','path'].includes(m.mode))throw TypeError('Smoke invalid path mode');
   emitter.motion={mode:m.mode,speed:num(m.speed,'motion.speed',0,900),
    path:Spacing.normalizePath(m.path)};
   if(emitter.motion.path.closed||emitter.motion.path.segments.length!==1)
    throw TypeError('Smoke motion guide needs one open cubic');
   if(!e.layers||Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('Smoke requires three independently owned layers');
   emitter.layers={};
   for(const key of LAYERS){
    const layer=e.layers[key];
    keys(layer,['enabled','visible','x','y','rotation','timeOffset','alpha','blend'],'layer');
    if(typeof layer.enabled!=='boolean'||typeof layer.visible!=='boolean'||
     !['normal','add','screen','multiply'].includes(layer.blend))
     throw TypeError('Smoke invalid layer '+key);
    emitter.layers[key]={enabled:layer.enabled,visible:layer.visible,blend:layer.blend,
     x:num(layer.x,'layer.x',-10000,10000),y:num(layer.y,'layer.y',-10000,10000),
     rotation:num(layer.rotation,'layer.rotation',-360,360),
     timeOffset:int(layer.timeOffset,'layer.timeOffset',-3600,3600),
     alpha:num(layer.alpha,'layer.alpha',0,1)};
   }
   out.emitters.push(emitter);
  }
  return out;
 }
 function pathPoint(e,seconds){
  if(e.motion.mode==='stationary'||e.motion.speed===0)
   return {x:0,y:0,angle:-Math.PI/2,distance:0};
  const table=Spacing.buildArcTable(e.motion.path);
  const point=Spacing.pointAtDistance(table,clamp(seconds*e.motion.speed,0,table.length));
  return {...point,total:table.length};
 }
 function mouth(cfg,index,seed){
  if(cfg.nozzleWidth===0||cfg.originGap===0)return {x:0,y:0,slots:1,capped:false};
  const t=rng(seed,index,43);
  const gap=cfg.spacingCurveEnabled?Curves.evaluate(cfg.spacingCurve,t):cfg.originGap;
  if(gap===0)return {x:0,y:0,slots:1,capped:false};
  if(gap>cfg.nozzleWidth)return {x:0,y:0,slots:1,capped:true};
  const slots=Math.min(128,Math.floor(cfg.nozzleWidth/gap)+1);
  let pos=index%slots;
  if(cfg.spatialMode==='random')pos=Math.floor(rng(seed,index,44)*slots);
  else if(cfg.spatialMode==='clustered'){
   const center=(slots-1)/2;
   pos=clamp(Math.round(center+(rng(seed,index,45)-.5)*slots*.4),0,slots-1);
  }
  const x=(pos-(slots-1)/2)*gap;
  const jitter=(rng(seed,index,46)*2-1)*cfg.spatialJitter*gap;
  return {x:clamp(x+jitter,-cfg.nozzleWidth/2,cfg.nozzleWidth/2),
   y:0,slots,capped:false};
 }
 const scheduleCache=new Map();
 function schedule(cfg,e){
  const total=cfg.mode==='loop'?cfg.durationFrames/60:
   (cfg.mode==='stop'?cfg.stopFrame:cfg.emissionFrames)/60;
  if(cfg.rate===0||e.rateScale===0)return {events:[],capped:false};
  const seed=(cfg.seed^e.seed^hash(e.id))|0;
  const key=JSON.stringify([total,cfg.rate,e.rateScale,cfg.intervalJitter,
   cfg.minGapSeconds,seed,cfg.emissionRateCurve]);
  if(scheduleCache.has(key))return scheduleCache.get(key);
  const raw=Spacing.createTemporalSchedule({
   schemaVersion:1,mode:'custom',frequencySource:'rate',baseRate:cfg.rate*e.rateScale,
   interval:1/Math.max(.0001,cfg.rate*e.rateScale),duration:total,
   minInterval:cfg.minGapSeconds,jitter:cfg.intervalJitter,
   burstCount:1,burstDelay:0,seed,maxEvents:4096,rateCurve:cfg.emissionRateCurve,
   intervalCurve:null
  });
  const result={events:[{time:0,index:0},...raw.events
   .filter(x=>x.time>1e-8&&x.time<total-1e-8)
   .map((x,i)=>({time:x.time,index:i+1}))],capped:raw.capped};
  if(scheduleCache.size>20)scheduleCache.clear();
  scheduleCache.set(key,result);return result;
 }
 function births(cfg,e,time){
  const sec=cfg.mode==='loop'?cfg.durationFrames/60:
   (cfg.mode==='stop'?cfg.stopFrame:cfg.emissionFrames)/60;
  const seed=(cfg.seed^e.seed^hash(e.id))|0;
  const temporal=schedule(cfg,e);
  if(cfg.emissionMode!=='time'&&e.motion.mode!=='path')
   return {events:[],capped:false,diagnostic:'distance emission requires moving source'};
  let original=temporal.events;
  if(cfg.emissionMode!=='time'){
   if(e.motion.speed===0||cfg.originGap===0)
    return {events:[],capped:false,diagnostic:'distance mode needs moving source and originGap > 0'};
   const placement=Spacing.createSpatialPlacement({
    schemaVersion:1,path:e.motion.path,mode:cfg.spatialMode==='clustered'?'clustered':cfg.spatialMode==='random'?'random':'even',
    baseSpacingPx:cfg.originGap,minSpacing:.25,maxSpacing:80,
    jitter:cfg.spatialJitter,seed,maxPoints:1000,alignToTangent:true,
    pathFollow:'clamp',spacingCurve:cfg.spacingCurveEnabled?cfg.spacingCurve:null});
   const allowed=placement.points.filter(pt=>pt.distance>0&&pt.distance<=e.motion.speed*sec+1e-8);
   if(cfg.emissionMode==='distance'){
    original=allowed.map((pt,i)=>({time:pt.distance/e.motion.speed,
     index:i,position:{x:pt.x,y:pt.y}}));
   }else{
    const steps=Math.max(2,Math.ceil(sec*240));
    const motion=Array.from({length:steps},(_,j)=>{
     const ts=sec*j/(steps-1),pt=pathPoint(e,ts);
     return {time:ts,x:pt.x,y:pt.y};
    });
    const combined=Spacing.combineSchedule({schedule:temporal,placement,motion,mode:'both',
     teleportThresholdPx:512,maxEvents:4096});
    original=combined.events.map((ev,i)=>({time:ev.time,index:i,position:pathPoint(e,ev.time)}));
   }
  }
  const result=[];
  let capped=temporal.capped;
  // Stationary loop pre-roll keeps steady smoke at frame zero and exact cycle boundary.
  const period=cfg.durationFrames/60,back=cfg.mode==='burst'?0:
   Math.ceil(cfg.lifetimeSeconds/(cfg.mode==='loop'?period:sec))+1;
  const startCycle=cfg.mode==='loop'?-back:cfg.mode==='stop'?-back:0;
  for(let cycle=startCycle;cycle<=0;cycle++){
   const shift=cycle*(cfg.mode==='loop'?period:sec);
   for(const ev of original){
    const bt=shift+ev.time;
    if(bt>time+1e-9||time-bt>=cfg.lifetimeSeconds+1e-8||bt>=
       (cfg.mode==='stop'?sec:cfg.mode==='burst'?sec:Infinity))continue;
    const mouthPos=mouth(cfg,ev.index,seed);
    const travel=ev.position||(e.motion.mode==='path'?pathPoint(e,ev.time):{x:0,y:0});
    result.push({time:bt,index:ev.index,position:{
     x:travel.x+mouthPos.x,y:travel.y+mouthPos.y},
     capped:mouthPos.capped});
    capped ||= mouthPos.capped;
    if(result.length>=4096){capped=true;break}
   }
   if(capped&&result.length>=4096)break;
  }
  result.sort((a,b)=>a.time-b.time||a.index-b.index);
  return {events:result,capped};
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
 function sample(input,seconds){
  const cfg=normalize(input),t=num(seconds,'seconds',0,1e7),period=cfg.durationFrames/60,
   // Quantize only the normalized loop phase to nanoseconds: mathematically equal
   // positions (frame 10 vs 130) must produce byte-identical geometry.
   time=cfg.mode==='loop'?Math.round((t%period)*1e9)/1e9:t;
  const report={time,total:period,emitters:[],primitives:0,activePuffs:0,
   capped:false,diagnostics:[],phase:time/period};
  if(cfg.mode!=='loop'&&time>=period)return report;
  const riseIntegral=makeRiseLookup(cfg.riseCurve),budget=BUDGETS[cfg.quality];
  const sourceStop=(cfg.mode==='stop'?cfg.stopFrame:cfg.emissionFrames)/60;
  // The final INCLUDED frame of a finite sequence must already be fully
  // transparent: 40 emission + 60 fade means PNG indices 0..99, not 0..100.
  const fadeSeconds=Math.max(1/60,(cfg.fadeFrames-1)/60);
  const fade=cfg.mode==='loop'?1:clamp(1-(time-sourceStop)/fadeSeconds,0,1);
  const all=[...cfg.emitters].sort((a,b)=>a.id.localeCompare(b.id));
  for(const e of all){
   const output={id:e.id,active:0,layers:Object.fromEntries(LAYERS.map(k=>[k,[]])),
    events:[],capped:false};
   report.emitters.push(output);
   if(!e.enabled||!e.visible||fade<=0)continue;
   const elapsed=time-e.timeOffset/60;
   if(elapsed<0&&!['loop','stop'].includes(cfg.mode))continue;
   const born=births(cfg,e,elapsed);
   output.events=born.events;output.capped=born.capped;report.capped ||= born.capped;
   if(born.diagnostic){report.diagnostics.push(e.id+': '+born.diagnostic);continue}
   const seed=(cfg.seed^e.seed^hash(e.id))|0;
   for(const ev of born.events.slice().reverse()){
    const ageSeconds=elapsed-ev.time,u=ageSeconds/cfg.lifetimeSeconds;
    if(u<0)continue;if(u>=1)continue;
    if(report.activePuffs>=budget.maxPuffs){report.capped=true;break}
    const opacity=Curves.evaluate(cfg.opacityCurve,u)*cfg.density*fade;
    const color=Colors.sample(cfg.palette,u),alpha=opacity*color[3];
    if(alpha<=.00001)continue;
    const scale=cfg.initialSize*Curves.evaluate(cfg.sizeCurve,u)*
     (1+(cfg.expansion-1)*u)*(0.78+.5*rng(seed,ev.index,51));
    if(scale<=.01)continue;
    const phase=rng(seed,ev.index,52)*TAU,swirl=cfg.swirl*cfg.curlScale*
     (Math.sin(phase+u*TAU*1.4)-Math.sin(phase))*Math.sin(Math.PI*u);
    const x=ev.position.x+cfg.windX*ageSeconds+swirl,
     y=ev.position.y-cfg.riseSpeed*e.speedScale*cfg.lifetimeSeconds*riseIntegral(u);
    const rot=(rng(seed,ev.index,53)-.5)*u*TAU*cfg.swirl;
    const aspect=(cfg.style==='stylized'?.95:cfg.style==='magical'?1.4:.8)+
     (cfg.style==='stylized'?.08:.45)*rng(seed,ev.index,54);
    const variant=cfg.style==='stylized'?0:cfg.style==='magical'?
     3:Math.floor(rng(seed,ev.index,55)*4);
    const base={kind:'puff',x,y,width:scale*2*aspect,height:scale*2/aspect,
     rotation:rot,variant,rgba:[...color.slice(0,3),alpha]};
    function add(layerKey,puff){
     const layer=e.layers[layerKey];
     if(!layer.enabled||!layer.visible||!layer.alpha)return;
     const la=elapsed-layer.timeOffset/60;
     if(la<ev.time||la-ev.time>=cfg.lifetimeSeconds)return;
     if(report.primitives>=Math.min(1400,budget.maxPrimitives)){
      report.capped=true;return;
     }
     const angle=layer.rotation*Math.PI/180;
     const cx=puff.x,cy=puff.y;
     puff.x=cx*Math.cos(angle)-cy*Math.sin(angle)+layer.x;
     puff.y=cx*Math.sin(angle)+cy*Math.cos(angle)+layer.y;
     puff.rotation+=angle;
     puff.rgba[3]*=layer.alpha;
     puff.emitterId=e.id;
     output.layers[layerKey].push(puff);report.primitives++;
    }
    add('core',{...base,rgba:[...base.rgba]});
    // Broader wisps are independently owned, larger and more diffuse.
    if(ev.index%2===0)add('wisps',{...base,kind:'puff',variant:(variant+1)%4,
     x:x+(rng(seed,ev.index,61)-.5)*scale*.8,
     y:y-(rng(seed,ev.index,62)-.5)*scale*.5,
     width:base.width*1.28,height:base.height*1.3,
     rgba:[...color.slice(0,3),alpha*.38]});
    if(ev.index%4===0)add('ash',{kind:'ash',
     x:x+(rng(seed,ev.index,71)-.5)*scale,
     y:y-(rng(seed,ev.index,72)-.5)*scale,
     radius:Math.max(.5,scale*.08),rotation:rot,
     rgba:[...color.slice(0,3),alpha*.55]});
    output.active++;report.activePuffs++;
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
  sample,schedule,births,mouth,makeRiseLookup,pathPoint,bounds};
});
