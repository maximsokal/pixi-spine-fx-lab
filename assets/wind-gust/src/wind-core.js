// AIR-01 Wind Gust: deterministic CJS/UMD geometry without renderer or DOM.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxWind=api;
})(globalThis,function(Curves,Spacing,Path,Colors){
 'use strict';
 if(!Curves||!Spacing||!Path||!Colors)throw Error('AIR-01 needs FX-CORE 01/02/04/08');
 const LAYERS=Object.freeze(['streaks','dust']),DEG=Math.PI/180;
 const BUDGETS=Object.freeze({
  low:{maxStreaks:64,maxDust:100,maxEvents:300,maxVertices:6500},
  balanced:{maxStreaks:160,maxDust:320,maxEvents:700,maxVertices:16000},
  high:{maxStreaks:320,maxDust:700,maxEvents:1200,maxVertices:32000}
 });
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function num(v,name,min,max,int=false){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||
   int&&!Number.isInteger(v))throw TypeError('AIR-01 invalid '+name);
  return v;
 }
 function strict(v,fields,name){
  if(!v||typeof v!=='object'||Array.isArray(v))throw TypeError('AIR-01 invalid '+name);
  for(const k of Object.keys(v))if(!fields.includes(k))
   throw TypeError('AIR-01 unknown '+name+'.'+k);
 }
 function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h|0}
 function rng(seed,index,salt=0){
  let x=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,knots,range=[0,3]){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:'multiplier',inputRange:[0,1],valueRange:range,
   defaultValue:knots[0][1],clamp:'hold',monotonic:false,
   keys:knots.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function anchor(type='world',x=0,y=0){
  return {type,space:'world',name:'',slot:'',x,y,rotation:0};
 }
 function newEmitter(i=0){
  const layer=(enabled,alpha)=>({enabled,visible:true,x:0,y:0,
   rotation:0,timeOffset:0,seed:71+i*17,alpha,blend:'normal',
   anchor:anchor('inherit')});
  return {id:'emitter'+(i+1),name:'Wind Gust '+(i+1),
   enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,
   seed:1991+i*337,anchor:anchor('world',256+i*14,256),
   layers:{streaks:layer(true,.86),dust:layer(true,.6)}};
 }
 function defaults(){
  return {schemaVersion:1,mode:'burst',durationFrames:40,exportFrames:40,
   windSpeed:160,gustWidth:120,streakCount:12,curveAmount:.3,
   streakThickness:3,windDirection:0,birthRate:20,streakGap:14,
   streakLifetime:.6,streakLength:90,dustRate:4,
   spatialJitter:.12,spatialMode:'even',quality:'balanced',
   style:'natural',seed:7321,
   gustStrengthCurve:curve('gustStrength','effectTime',
    [[0,0],[.16,1],[.65,.65],[1,0]],[0,2]),
   streakWidthCurve:curve('streakWidth','pathPosition',
    [[0,0],[.2,1],[1,0]],[0,2]),
   streakAlphaCurve:curve('streakAlpha','particleAge',
    [[0,0],[.12,.7],[1,0]],[0,1]),
   emissionRateCurve:curve('emissionRate','effectTime',[[0,1],[1,1]],[0,3]),
   spacingCurve:curve('spacingMultiplier','pathPosition',[[0,1],[1,1]],[.1,3]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'windColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',
    space:'srgb',clamp:'hold',stops:[
     {id:'start',position:0,rgba:[234,245,248,.9]},
     {id:'end',position:1,rgba:[168,206,215,.75]}]}),
   emitters:[newEmitter(0)]};
 }
 const FIELDS=Object.keys(defaults());
 const RANGES={durationFrames:[40,60],exportFrames:[1,3600],
  windSpeed:[0,700],gustWidth:[10,320],streakCount:[0,80],
  curveAmount:[0,1],streakThickness:[.5,18],
  windDirection:[-180,180],birthRate:[0,100],streakGap:[2,90],
  streakLifetime:[.12,3],streakLength:[10,220],
  dustRate:[0,80],spatialJitter:[0,.45],seed:[-2147483648,2147483647]};
 const INTEGER=new Set(['durationFrames','exportFrames','streakCount','seed']);
 const AK=['type','space','name','slot','x','y','rotation'],
  EK=['id','name','enabled','visible','x','y','rotation','timeOffset','seed','anchor','layers'],
  LK=['enabled','visible','x','y','rotation','timeOffset','seed','alpha','blend','anchor'];
 function validAnchor(a,layer=false){
  strict(a,AK,'anchor');
  if(!['world','skeleton','bone','slot','attachment',...(layer?['inherit']:[])].includes(a.type)||
   !['world','local'].includes(a.space)||typeof a.name!=='string'||
   typeof a.slot!=='string'||(['bone','slot'].includes(a.type)&&!a.name.trim())||
   a.type==='attachment'&&(!a.name.trim()||!a.slot.trim()))
   throw TypeError('AIR-01 invalid anchor');
  return {type:a.type,space:a.space,name:a.name,slot:a.slot,
   x:num(a.x,'anchor.x',-10000,10000),y:num(a.y,'anchor.y',-10000,10000),
   rotation:num(a.rotation,'anchor.rotation',-360,360)};
 }
 function normalize(input){
  strict(input,FIELDS,'settings');
  if(input.schemaVersion!==1)throw TypeError('AIR-01 invalid schemaVersion');
  const c={schemaVersion:1};
  for(const [k,[a,b]] of Object.entries(RANGES))c[k]=
   num(input[k],k,a,b,INTEGER.has(k));
  if(!['loop','burst'].includes(input.mode)||
   c.durationFrames!==(input.mode==='loop'?60:40))
   throw TypeError('AIR-01 invalid mode/duration');
  c.mode=input.mode;
  for(const [k,values] of Object.entries({
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical'],
   spatialMode:['even','random','clustered']})){
   if(!values.includes(input[k]))throw TypeError('AIR-01 invalid '+k);
   c[k]=input[k];
  }
  for(const [field,key,domain] of [
   ['gustStrengthCurve','gustStrength','effectTime'],
   ['streakWidthCurve','streakWidth','pathPosition'],
   ['streakAlphaCurve','streakAlpha','particleAge'],
   ['emissionRateCurve','emissionRate','effectTime'],
   ['spacingCurve','spacingMultiplier','pathPosition']]){
   const v=Curves.normalize(input[field]);
   if(v.parameterKey!==key||v.domain!==domain||v.valueUnit!=='multiplier')
    throw TypeError('AIR-01 incompatible '+field);
   c[field]=v;
  }
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='windColor'||c.palette.domain!=='particleAge')
   throw TypeError('AIR-01 incompatible palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('AIR-01 max 4 emitters');
  const ids=new Set();c.emitters=[];
  for(const e of input.emitters){
   strict(e,EK,'emitter');
   if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))
    throw TypeError('AIR-01 duplicate/invalid emitter ID');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>128||
    typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('AIR-01 invalid emitter');
   const v={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:num(e.x,'emitter.x',-10000,10000),y:num(e.y,'emitter.y',-10000,10000),
    rotation:num(e.rotation,'emitter.rotation',-360,360),
    timeOffset:num(e.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:num(e.seed,'emitter.seed',-2147483648,2147483647,true),
    anchor:validAnchor(e.anchor),layers:{}};
   strict(e.layers,LAYERS,'layers');
   if(Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('AIR-01 exactly two layers required');
   for(const kind of LAYERS){
    const l=e.layers[kind];strict(l,LK,'layer');
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
     !['normal','add','screen','multiply'].includes(l.blend))
     throw TypeError('AIR-01 invalid layer '+kind);
    v.layers[kind]={enabled:l.enabled,visible:l.visible,
     x:num(l.x,kind+'.x',-10000,10000),y:num(l.y,kind+'.y',-10000,10000),
     rotation:num(l.rotation,kind+'.rotation',-360,360),
     timeOffset:num(l.timeOffset,kind+'.timeOffset',-3600,3600,true),
     seed:num(l.seed,kind+'.seed',-2147483648,2147483647,true),
     alpha:num(l.alpha,kind+'.alpha',0,1),blend:l.blend,
     anchor:validAnchor(l.anchor,true)};
   }
   c.emitters.push(v);
  }
  const budget=BUDGETS[c.quality];
  if(c.emitters.length*c.streakCount>budget.maxStreaks)
   throw RangeError('AIR-01 ribbon budget exceeded');
  if(c.emitters.length*Math.ceil(c.dustRate*c.streakLifetime+1)>budget.maxDust)
   throw RangeError('AIR-01 dust budget exceeded');
  const maxRate=Math.max(1,...c.emissionRateCurve.keys.map(k=>k.y));
  if(c.emitters.length*Math.ceil(c.birthRate*maxRate*Math.max(1,c.streakLifetime))>
   budget.maxEvents)throw RangeError('AIR-01 event budget exceeded');
  return c;
 }
 const cache=new Map();
 function memo(key,fn){
  if(cache.has(key))return cache.get(key);
  const value=fn();if(cache.size>=24)cache.delete(cache.keys().next().value);
  cache.set(key,value);return value;
 }
 function physicalPath(c){
  const l=c.streakLength;
  return {schemaVersion:1,closed:false,segments:[{
   p0:[0,0],p1:[l*.33,c.curveAmount*20],
   p2:[l*.67,-c.curveAmount*24],p3:[l,0]}]};
 }
 function physicalCurve(c){
  const m=c.streakGap,src=c.spacingCurve;
  return Curves.normalize({...src,parameterKey:'spacingPx',valueUnit:'px',
   valueRange:[0,500],defaultValue:src.defaultValue*m,
   keys:src.keys.map(k=>({...k,y:k.y*m,
    ...(k.in?{in:[k.in[0],k.in[1]*m]}:{}),
    ...(k.out?{out:[k.out[0],k.out[1]*m]}:{})}))});
 }
 function makeSchedule(c,e,kind='streaks'){
  const layer=e.layers[kind],seed=(c.seed^e.seed^layer.seed^hash(e.id)^hash(kind))|0,
   period=c.durationFrames/60,rate=kind==='dust'?c.dustRate:c.birthRate,
   key=JSON.stringify([c.mode,period,rate,c.streakGap,c.streakLength,
    c.curveAmount,c.emissionRateCurve,c.spacingCurve,c.spatialMode,
    c.spatialJitter,seed,kind]);
  return memo(key,()=>{
   const rateCurve=Curves.normalize({...c.emissionRateCurve,
    parameterKey:'emissionRate',domain:'emitterTime'});
   const temporal=Spacing.createTemporalSchedule({
    schemaVersion:1,mode:'custom',frequencySource:'rate',
    baseRate:rate,interval:rate?1/rate:1,duration:period,
    minInterval:0,jitter:0,burstCount:1,burstDelay:0,
    seed,maxEvents:400,rateCurve,intervalCurve:null});
   if(temporal.capped)throw RangeError('AIR-01 temporal schedule capped');
   const events=temporal.events.map((v,i)=>{
    const time=c.mode==='loop'&&Math.abs(v.time-period)<1e-9?0:v.time;
    return {time,index:i};
   }).sort((a,b)=>a.time-b.time||a.index-b.index);
   const spatial=Spacing.createSpatialPlacement({
    schemaVersion:1,path:physicalPath(c),baseSpacingPx:c.streakGap,
    minSpacing:1,maxSpacing:500,spacingCurve:physicalCurve(c),
    mode:c.spatialMode,jitter:c.spatialJitter,
    seed,maxPoints:512,alignToTangent:true,pathFollow:'clamp',
    tolerancePx:.25});
   if(spatial.capped)throw RangeError('AIR-01 spatial schedule capped');
   return {events,distances:spatial.points.map(v=>v.distance),
    origins:spatial.points.map(v=>({x:v.x,y:v.y})),
    arcErrorBound:spatial.table.errorBound,sourceId:e.id,seed};
  });
 }
 function schedule(input,e){
  const c=normalize(input),found=c.emitters.find(x=>x.id===e.id);
  if(!found)throw TypeError('AIR-01 emitter missing');
  return makeSchedule(c,found);
 }
 function active(c,e,kind,seconds){
  const layer=e.layers[kind],period=c.durationFrames/60,
   t=seconds-e.timeOffset/60-layer.timeOffset/60;
  if(c.mode==='burst'&&t<0)return [];
  const plan=makeSchedule(c,e,kind),history=c.mode==='loop'?
   Math.ceil(c.streakLifetime/period)+2:0,evs=[];
  for(let cycle=-history;cycle<=0;cycle++){
   if(c.mode==='burst'&&cycle!==0)continue;
   for(const ev of plan.events){
    const born=ev.time+cycle*period,age=t-born;
    if(age<-1e-9||age>=c.streakLifetime)continue;
    evs.push({born,age,index:ev.index,
     position:plan.origins[ev.index%Math.max(1,plan.origins.length)]||{x:0,y:0}});
   }
  }
  return evs.sort((a,b)=>b.born-a.born||b.index-a.index);
 }
 function rotated(x,y,angle){
  return {x:x*Math.cos(angle)-y*Math.sin(angle),
   y:x*Math.sin(angle)+y*Math.cos(angle)};
 }
 function colored(c,u,alpha){
  const rgba=Colors.sample(c.palette,clamp(u,0,1)),
   mult=c.style==='natural'?[1,1,1]:
    c.style==='stylized'?[1.04,1.1,1.14]:[1.16,.88,1.27];
  return rgba.slice(0,3).map((v,i)=>clamp(v*mult[i],0,255))
   .concat([clamp(rgba[3]*alpha,0,1)]);
 }
 function streak(c,e,ev,strength){
  const u=ev.age/c.streakLifetime,
   seed=c.seed^e.seed^e.layers.streaks.seed^hash(e.id),
   bend=c.curveAmount*(14+16*rng(seed,ev.index,13))*
    (.65+.35*Math.sin(2*Math.PI*u+ev.index*.9)),
   y=(rng(seed,ev.index,11)-.5)*c.gustWidth+ev.position.y,
   x=-1.5*c.streakLength+ev.position.x+
    ev.age*c.windSpeed*(.92+.15*rng(seed,ev.index,12)),
   len=c.streakLength*(.68+.32*rng(seed,ev.index,21));
  const path={schemaVersion:1,closed:false,segments:[{
   p0:[x,y],p1:[x+len*.27,y+bend],
   p2:[x+len*.73,y-bend*.65],p3:[x+len,y]}]};
  const widthCurve=Curves.normalize({...c.streakWidthCurve,
   parameterKey:'widthMultiplier',valueUnit:'normalized'});
  const shape=Path.buildRibbon({path,width:{
   start:c.streakThickness,middle:c.streakThickness,end:c.streakThickness,
   startTaper:1,endTaper:1,minVisiblePx:.02,curve:widthCurve},
   quality:c.quality,sampleSpacingPx:c.quality==='low'?6:4,
   edgeIrregularity:0,seed:seed^ev.index,tolerancePx:.25});
  const positions=shape.positions,angle=c.windDirection*DEG;
  if(angle!==0)for(let i=0;i<positions.length;i+=2){
   const q=rotated(positions[i],positions[i+1],angle);
   positions[i]=q.x;positions[i+1]=q.y;
  }
  const opacity=Curves.evaluate(c.streakAlphaCurve,clamp(u,0,1));
  return {kind:'ribbon',index:ev.index,age:u,positions,uvs:shape.uvs,
   indices:shape.indices,errorBound:shape.errorBound,
   tipWidths:[shape.samples[0]?.width??0,shape.samples.at(-1)?.width??0],
   rgba:colored(c,u,opacity*strength*(.87+.13*rng(seed,ev.index,41)))};
 }
 function dust(c,e,ev,strength){
  const u=ev.age/c.streakLifetime,
   seed=c.seed^e.seed^e.layers.dust.seed^hash(e.id),
   pt=rotated(-c.streakLength*1.35+ev.position.x+ev.age*c.windSpeed*.65,
    (rng(seed,ev.index,51)-.5)*c.gustWidth+ev.position.y+
    c.curveAmount*Math.sin(8*u+ev.index)*12,c.windDirection*DEG);
  return {kind:'dust',index:ev.index,age:u,x:pt.x,y:pt.y,
   radius:1.25+rng(seed,ev.index,52)*1.6,rotation:0,
   rgba:colored(c,u,Math.sin(Math.PI*u)*strength*.5)};
 }
 function sample(input,seconds){
  const c=normalize(input),t=num(seconds,'seconds',0,1e8),
   period=c.durationFrames/60,phase=c.mode==='loop'?t%period:t,
   strength=c.mode==='burst'&&t>=39/60?0:
    Curves.evaluate(c.gustStrengthCurve,clamp(phase/period,0,1)),
   result={schemaVersion:1,time:phase,total:period,phase,emitters:[],
    primitives:0,activeStreaks:0,activeDust:0,diagnostics:[],capped:false};
  if(strength<=0)return result;
  const budget=BUDGETS[c.quality];
  for(const e of [...c.emitters].sort((a,b)=>a.id.localeCompare(b.id))){
   const row={id:e.id,layers:{streaks:[],dust:[]},
    active:0,candidateEvents:0,visibleLimitDrops:0};
   result.emitters.push(row);
   if(!e.enabled||!e.visible)continue;
   for(const kind of LAYERS){
    const l=e.layers[kind];
    if(!l.enabled||!l.visible||!l.alpha)continue;
    const events=active(c,e,kind,phase),
     maximum=kind==='streaks'?c.streakCount:
      Math.ceil(c.dustRate*c.streakLifetime)+1;
    row.candidateEvents+=events.length;
    row.visibleLimitDrops+=Math.max(0,events.length-maximum);
    for(const ev of events.slice(0,maximum)){
     const p=kind==='streaks'?streak(c,e,ev,strength):dust(c,e,ev,strength);
     p.rgba[3]*=l.alpha;
     if(p.rgba[3]<=0)continue;
     row.layers[kind].push(p);row.active++;result.primitives++;
     if(kind==='streaks')result.activeStreaks++;
     else result.activeDust++;
     if(result.activeStreaks>budget.maxStreaks||result.activeDust>budget.maxDust)
      throw RangeError('AIR-01 live primitive budget exceeded');
    }
   }
   if(row.visibleLimitDrops>0)result.diagnostics.push(e.id+
    ': visible limit '+c.streakCount+' suppressed '+row.visibleLimitDrops+' candidates');
  }
  return result;
 }
 return {schemaVersion:1,LAYERS,BUDGETS,defaults,newEmitter,
  normalize,schedule,sample,physicalPath};
});
