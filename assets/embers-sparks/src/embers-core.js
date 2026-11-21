// FIRE-04 — deterministic, renderer-independent embers and sparks; absolute-time physics.
(function(root,make){
 'use strict';
 const API=Object.freeze(make(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=API;else root.FxEmbers=API;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('FIRE-04 requires versioned FxCurves/FxSpacing/FxColors');
 const LAYERS=Object.freeze(['hot','streaks','bloom']),PI2=Math.PI*2;
 const BUDGETS=Object.freeze({
  low:{maxParticles:60,maxPrimitives:96},
  balanced:{maxParticles:150,maxPrimitives:256},
  high:{maxParticles:300,maxPrimitives:512}
 });
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const number=(x,name,min,max)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)
   throw TypeError('FIRE-04 invalid '+name+' ['+min+','+max+']');
  return x;
 };
 const integer=(x,n,a,b)=>{number(x,n,a,b);if(!Number.isInteger(x))throw TypeError('FIRE-04 invalid integer '+n);return x};
 const allow=(o,keys,who)=>{
  if(!o||typeof o!=='object'||Array.isArray(o))throw TypeError('FIRE-04 invalid '+who);
  for(const k of Object.keys(o))if(!keys.includes(k))throw TypeError('FIRE-04 unknown '+who+'.'+k);
 };
 const random=(seed,index,salt=0)=>{
  let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 };
 const hash=text=>{let v=2166136261;for(let i=0;i<text.length;i++)
  v=Math.imul(v^text.charCodeAt(i),16777619);return v|0};
 const rotate=(x,y,a)=>[Math.cos(a)*x-Math.sin(a)*y,Math.sin(a)*x+Math.cos(a)*y];
 function curve(key,domain,keys,valueRange=[0,3],valueUnit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit,inputRange:[0,1],valueRange,defaultValue:keys[0][1],clamp:'hold',
   monotonic:false,keys:keys.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function motionPath(){
  return {schemaVersion:1,closed:false,segments:[{
   p0:[0,0],p1:[16,-10],p2:[37,-33],p3:[60,-40]}]};
 }
 function layerDefaults(){
  return {
   hot:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'add'},
   streaks:{enabled:false,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'add'},
   bloom:{enabled:false,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'screen'}
  };
 }
 function newEmitter(index=0){
  return {id:'emitter'+(index+1),name:'Emitter '+(index+1),enabled:true,visible:true,
   x:index*45,y:0,rotation:0,timeOffset:0,seed:419+index*997,
   rateScale:1,speedScale:1,anchor:{type:'world',space:'world',
    name:'',slot:'',x:256,y:310,rotation:0},
   motion:{mode:'stationary',speed:60,path:motionPath()},
   layers:layerDefaults()};
 }
 function defaults(){
  return {
   schemaVersion:1,rate:35,particleSize:3,spreadAngle:30,launchSpeed:110,
   gravity:-50,lifetimeSeconds:.8,emissionFrames:40,durationFrames:90,
   exportFrames:90,loop:false,intervalJitter:.15,burstMode:false,
   burstCount:3,burstDelay:.04,spatialSpacing:10,spatialJitter:.2,
   spatialMode:'even',emissionMode:'time',minGapSeconds:0,
   streakLength:14,bloomRadius:8,quality:'balanced',style:'natural',
   seed:131,
   emissionRateCurve:curve('emissionRate','emitterTime',[[0,1],[.65,.5],[1,0]],[0,3]),
   sizeCurve:curve('sizeMultiplier','particleAge',[[0,1],[.7,.65],[1,0]],[0,3]),
   temperatureCurve:curve('colorTemperature','particleAge',[[0,0],[1,1]],[0,1],'normalized'),
   alphaCurve:curve('alphaMultiplier','particleAge',[[0,1],[.6,.8],[1,0]],[0,1]),
   spacingCurve:curve('spacingPx','pathPosition',[[0,10],[.5,13],[1,10]],[.25,100],'px'),
   spacingCurveEnabled:false,
   palette:Colors.normalize({schemaVersion:1,parameterKey:'emberColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'hot',position:0,rgba:[255,231,163,1]},
     {id:'warm',position:.5,rgba:[255,157,61,1]},
     {id:'cool',position:1,rgba:[183,77,39,0]}]}),
   emitters:[newEmitter(0)]
  };
 }
 const fields=Object.keys(defaults());
 function normalize(input){
  allow(input,fields,'document');
  if(input.schemaVersion!==1)throw TypeError('FIRE-04 unsupported schemaVersion');
  const numeric={
   rate:[0,240],particleSize:[1,12],spreadAngle:[0,180],launchSpeed:[0,600],
   gravity:[-500,500],lifetimeSeconds:[.1,4],emissionFrames:[1,600],
   durationFrames:[6,900],exportFrames:[1,3600],intervalJitter:[0,.45],
   burstCount:[1,40],burstDelay:[0,2],spatialSpacing:[.25,100],
   spatialJitter:[0,.45],minGapSeconds:[0,2],streakLength:[1,120],
   bloomRadius:[1,60],seed:[-2147483648,2147483647]
  };
  const ints=new Set(['emissionFrames','durationFrames','exportFrames','burstCount','seed']);
  const out={schemaVersion:1};
  for(const [key,[lo,hi]] of Object.entries(numeric))
   out[key]=ints.has(key)?integer(input[key],key,lo,hi):number(input[key],key,lo,hi);
  if(out.emissionFrames>out.durationFrames)throw TypeError('FIRE-04 emission window exceeds duration');
  for(const key of ['loop','burstMode','spacingCurveEnabled']){
   if(typeof input[key]!=='boolean')throw TypeError('FIRE-04 invalid '+key);
   out[key]=input[key];
  }
  const choices={spatialMode:['even','random','stratified','clustered'],
   emissionMode:['time','distance','both'],
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical']};
  for(const [key,values] of Object.entries(choices)){
   if(!values.includes(input[key]))throw TypeError('FIRE-04 invalid '+key);
   out[key]=input[key];
  }
  for(const [key,id,domain,unit] of [
   ['emissionRateCurve','emissionRate','emitterTime','multiplier'],
   ['sizeCurve','sizeMultiplier','particleAge','multiplier'],
   ['temperatureCurve','colorTemperature','particleAge','normalized'],
   ['alphaCurve','alphaMultiplier','particleAge','multiplier'],
   ['spacingCurve','spacingPx','pathPosition','px']]){
   const c=Curves.normalize(input[key]);
   if(c.parameterKey!==id||c.domain!==domain||c.valueUnit!==unit)
    throw TypeError('FIRE-04 invalid curve '+key);
   out[key]=c;
  }
  out.palette=Colors.normalize(input.palette);
  if(out.palette.parameterKey!=='emberColor'||out.palette.domain!=='particleAge')
   throw TypeError('FIRE-04 invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('FIRE-04 max four emitters');
  out.emitters=[];const ids=new Set();
  for(const e of input.emitters){
   allow(e,['id','name','enabled','visible','x','y','rotation','timeOffset',
    'seed','rateScale','speedScale','anchor','motion','layers'],'emitter');
   if(typeof e.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(e.id)||ids.has(e.id))
    throw TypeError('FIRE-04 duplicate/invalid emitter ID');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80)
    throw TypeError('FIRE-04 invalid emitter name');
   for(const k of ['enabled','visible'])if(typeof e[k]!=='boolean')
    throw TypeError('FIRE-04 emitter '+k+' invalid');
   const clean={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:number(e.x,'emitter.x',-10000,10000),y:number(e.y,'emitter.y',-10000,10000),
    rotation:number(e.rotation,'emitter.rotation',-360,360),
    timeOffset:integer(e.timeOffset,'emitter.timeOffset',-600,600),
    seed:integer(e.seed,'emitter.seed',-2147483648,2147483647),
    rateScale:number(e.rateScale,'emitter.rateScale',0,3),
    speedScale:number(e.speedScale,'emitter.speedScale',0,3)};
   const a=e.anchor;
   allow(a,['type','space','name','slot','x','y','rotation'],'anchor');
   if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
      !['world','local'].includes(a.space)||typeof a.name!=='string'||
      typeof a.slot!=='string'||a.name.length>128||a.slot.length>128||
      (['bone','slot','attachment'].includes(a.type)&&!a.name.trim())||
      (a.type==='attachment'&&!a.slot.trim()))
    throw TypeError('FIRE-04 invalid anchor');
   clean.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:number(a.x,'anchor.x',-10000,10000),y:number(a.y,'anchor.y',-10000,10000),
    rotation:number(a.rotation,'anchor.rotation',-360,360)};
   const m=e.motion;
   allow(m,['mode','speed','path'],'motion');
   if(!['stationary','path'].includes(m.mode))throw TypeError('FIRE-04 invalid motion mode');
   clean.motion={mode:m.mode,speed:number(m.speed,'motion.speed',0,900),
    path:Spacing.normalizePath(m.path)};
   if(clean.motion.path.closed||clean.motion.path.segments.length!==1)
    throw TypeError('FIRE-04 motion guide must have one open cubic segment');
   if(!e.layers||Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('FIRE-04 three owned layers required');
   clean.layers={};
   for(const k of LAYERS){
    const layer=e.layers[k];
    allow(layer,['enabled','visible','x','y','rotation','timeOffset','alpha','blend'],'layer');
    if(typeof layer.enabled!=='boolean'||typeof layer.visible!=='boolean'||
       !['normal','add','multiply','screen'].includes(layer.blend))
      throw TypeError('FIRE-04 layer '+k);
    clean.layers[k]={enabled:layer.enabled,visible:layer.visible,blend:layer.blend,
     alpha:number(layer.alpha,k+'.alpha',0,1),
     x:number(layer.x,k+'.x',-10000,10000),y:number(layer.y,k+'.y',-10000,10000),
     rotation:number(layer.rotation,k+'.rotation',-360,360),
     timeOffset:integer(layer.timeOffset,k+'.timeOffset',-3600,3600)};
   }
   out.emitters.push(clean);
  }
  return out;
 }
 function trajectory(e,seconds){
  if(e.motion.mode==='stationary'||e.motion.speed===0)
   return {x:0,y:0,angle:-Math.PI/2,distance:0};
  const table=Spacing.buildArcTable(e.motion.path);
  const point=Spacing.pointAtDistance(table,clamp(seconds,0,1e7)*e.motion.speed);
  return {...point,length:table.length};
 }
 function births(cfg,e){
  const duration=cfg.emissionFrames/60,seed=(e.seed^cfg.seed^hash(e.id))|0;
  if(cfg.emissionMode!=='distance'&&(cfg.rate===0||e.rateScale===0))
   return {events:[],capped:false};
  // Distance-only measures source travel, never temporal rate.
  const sourceRate=Math.max(.001,cfg.rate*e.rateScale);
  const validMotion=e.motion.mode==='path'&&e.motion.speed>0;
  if(cfg.emissionMode!=='time'&&!validMotion)
   return {events:[],capped:false,diagnostic:'distance emission requires moving source'};
  const original=Spacing.createTemporalSchedule({
   schemaVersion:1,mode:'custom',frequencySource:'rate',
   baseRate:sourceRate,interval:1/sourceRate,duration,minInterval:cfg.minGapSeconds,
   jitter:cfg.intervalJitter,burstCount:1,burstDelay:0,
   seed,maxEvents:4096,rateCurve:cfg.emissionRateCurve,intervalCurve:null});
  // In burst mode, apply the same authored rate curve to trigger times.
  // FxSpacing's standalone burst mode is intentionally not used: its trigger
  // scheduler ignores the custom rate curve, making an artist control inert.
  const rawTimes=original.events.flatMap(ev=>cfg.burstMode?
   Array.from({length:cfg.burstCount},(_,j)=>ev.time+j*Math.max(cfg.burstDelay,.0001)):
   [ev.time]);
  const times=[0,...rawTimes.filter(v=>v>=0&&v<=duration+1e-9)]
   .sort((a,b)=>a-b);
  const events=[];let capped=original.capped;
  for(const t of times){
   if(events.length>=4096){capped=true;break}
   if(events.length&&t-events.at(-1).time<Math.max(.000001,cfg.minGapSeconds)-1e-9)continue;
   events.push({time:clamp(t,0,duration),index:events.length});
  }
  const timetable={events,capped};
  if(cfg.emissionMode==='time'){
   return {events:events.map(ev=>({...ev,position:trajectory(e,ev.time)})),capped};
  }
  const placement=Spacing.createSpatialPlacement({schemaVersion:1,
   path:e.motion.path,mode:cfg.spatialMode,baseSpacingPx:cfg.spatialSpacing,
   minSpacing:.25,maxSpacing:100,jitter:cfg.spatialJitter,seed,maxPoints:1000,
   alignToTangent:true,pathFollow:'clamp',
   spacingCurve:cfg.spacingCurveEnabled?cfg.spacingCurve:null});
  const maxDist=Math.min(placement.table.length,e.motion.speed*duration);
  if(cfg.emissionMode==='distance'){
   const list=placement.points.filter(p=>p.distance>0&&p.distance<=maxDist)
    .map((p,i)=>({time:p.distance/e.motion.speed,index:i,position:{
     x:p.x,y:p.y,distance:p.distance,angle:p.angle}}));
   return {events:list,capped:placement.capped};
  }
  const n=Math.ceil(duration*240);
  const motion=Array.from({length:n+1},(_,i)=>{
   const time=Math.min(duration,i*duration/n),pt=trajectory(e,time);
   return {time,x:pt.x,y:pt.y};
  });
  const combined=Spacing.combineSchedule({schedule:timetable,placement,motion,mode:'both',
   teleportThresholdPx:512,maxEvents:4096});
  return {events:combined.events.map((ev,i)=>({time:ev.time,index:i,
   position:trajectory(e,ev.time)})),capped:combined.capped||placement.capped||timetable.capped};
 }
 function sample(input,absoluteSeconds){
  const cfg=normalize(input),duration=cfg.durationFrames/60;
  const t=number(absoluteSeconds,'absoluteSeconds',0,10000000),
   time=cfg.loop?t%duration:t;
  const result={time,total:duration,emitters:[],primitives:0,
   diagnostics:[],capped:false,phase:clamp(time/duration,0,1)};
  const quality=BUDGETS[cfg.quality];
  if(!cfg.loop&&time>=duration)return result;
  const all=[...cfg.emitters].sort((a,b)=>a.id.localeCompare(b.id));
  for(const e of all){
   const output={id:e.id,layers:Object.fromEntries(LAYERS.map(k=>[k,[]])),
    events:[],active:0,capped:false};
   result.emitters.push(output);
   if(!e.enabled||!e.visible)continue;
   const elapsed=time-e.timeOffset/60;
   if(elapsed<0||elapsed>duration)continue;
   const {events,capped,diagnostic}=births(cfg,e);
   output.events=events;output.capped=capped;result.capped ||= capped;
   if(diagnostic){result.diagnostics.push(e.id+': '+diagnostic);continue}
   const counted=events.slice().reverse();
   const life=cfg.lifetimeSeconds,seed=(e.seed^cfg.seed^hash(e.id))|0;
   for(const ev of counted){
    const age=(elapsed-ev.time)/life;
    if(age<0)continue;
    if(age>=1)break;
    if(output.active>=quality.maxParticles){result.capped=true;break}
    const u=clamp(age,0,1),spread=cfg.spreadAngle*Math.PI/180;
    const theta=(-Math.PI/2+(random(seed,ev.index,11)-.5)*spread)+e.rotation*Math.PI/180;
    const velocity=cfg.launchSpeed*e.speedScale*(.8+.4*random(seed,ev.index,12));
    const birth=ev.position,lifeTime=elapsed-ev.time;
    const dx=Math.cos(theta)*velocity*lifeTime,
          dy=Math.sin(theta)*velocity*lifeTime+.5*cfg.gravity*lifeTime*lifeTime;
    const x=birth.x+dx,y=birth.y+dy;
    const size=cfg.particleSize*(.8+.4*random(seed,ev.index,13))*
     Curves.evaluate(cfg.sizeCurve,u);
    const temp=Curves.evaluate(cfg.temperatureCurve,u),color=Colors.sample(cfg.palette,temp);
    const opacity=clamp(color[3]*Curves.evaluate(cfg.alphaCurve,u),0,1);
    if(size<=.01||opacity<=.00001)continue;
    const dir=Math.atan2(Math.sin(theta)*velocity+cfg.gravity*lifeTime,
     Math.cos(theta)*velocity);
    function put(k,primitive){
     const layer=e.layers[k],offset=(elapsed-layer.timeOffset/60);
     if(!layer.enabled||!layer.visible||!layer.alpha||offset<ev.time||
        offset>ev.time+life)return;
     if(result.primitives>=quality.maxPrimitives){result.capped=true;return}
     const a=layer.rotation*Math.PI/180;
     if(primitive.kind==='poly'){
      primitive.points=primitive.points.map(pt=>{
       const xy=rotate(pt[0],pt[1],a);
       return [xy[0]+layer.x,xy[1]+layer.y]});
     }else{
      const xy=rotate(primitive.x,primitive.y,a);
      primitive.x=xy[0]+layer.x;primitive.y=xy[1]+layer.y;
     }
     primitive.rgba[3]*=layer.alpha;
     primitive.emitterId=e.id;
     output.layers[k].push(primitive);result.primitives++;
    }
    // Particle density and shape are distinct from time/spatial event spacing.
    const hot={kind:'circle',x,y,radius:size,rgba:[...color.slice(0,3),opacity]};
    if(cfg.style==='stylized'){
     hot.kind='poly';hot.points=[[x-size,y],[x,y-size*1.5],[x+size,y],[x,y+size*1.5]];
    }else if(cfg.style==='magical'){
     hot.kind='poly';hot.points=Array.from({length:8},(_,j)=>{
      const a=j*Math.PI/4,rad=size*(j%2?.58:1.5);
      return [x+Math.cos(a)*rad,y+Math.sin(a)*rad];
     });
    }
    put('hot',hot);
    const streak=cfg.streakLength*(1-u)*(.75+.5*random(seed,ev.index,26));
    const vx=Math.cos(dir),vy=Math.sin(dir),perp=[-vy,vx],width=size*.45;
    const back=[x-vx*streak,y-vy*streak];
    put('streaks',{kind:'poly',points:[
     [x+perp[0]*width,y+perp[1]*width],
     [x-perp[0]*width,y-perp[1]*width],
     back],rgba:[...color.slice(0,3),opacity*.65]});
    for(let i=2;i>=0;i--){
     const alpha=opacity*(.18/(i+1))*(cfg.style==='magical'?1.25:1);
     put('bloom',{kind:'circle',x,y,radius:size+cfg.bloomRadius*(i+1)/3,
      rgba:[...color.slice(0,3),alpha]});
    }
    output.active++;
   }
  }
  return result;
 }
 function bounds(snapshot,anchors,settings){
  const cfg=normalize(settings);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const entry of snapshot.emitters){
   const emitter=cfg.emitters.find(e=>e.id===entry.id),anchor=anchors[entry.id];
   if(!anchor)continue;
   const angle=(emitter.anchor.rotation)*Math.PI/180;
   const effective=rotate(emitter.x,emitter.y,angle);
   const center={x:anchor.x+effective[0],y:anchor.y+effective[1]};
   const hit=(x,y,r=0)=>{
    const v=rotate(x,y,angle),cx=v[0]+center.x,cy=v[1]+center.y;
    minX=Math.min(minX,cx-r);maxX=Math.max(maxX,cx+r);
    minY=Math.min(minY,cy-r);maxY=Math.max(maxY,cy+r);
   };
   for(const group of Object.values(entry.layers))for(const p of group){
    if(p.kind==='poly')for(const q of p.points)hit(q[0],q[1]);
    else if(p.kind==='circle')hit(p.x,p.y,p.radius);
   }
  }
  return {empty:minX===Infinity,minX,minY,maxX,maxY,
   inside:minX===Infinity||(minX>=0&&minY>=0&&maxX<=512&&maxY<=512)};
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,newEmitter,normalize,
  sample,births,trajectory,bounds};
});
