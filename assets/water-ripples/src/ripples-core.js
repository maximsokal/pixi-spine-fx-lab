// WATER-03 pure 40f concentric ripple scheduler and ellipse primitives.
// Shared verbatim by offline editor and WebGL/WebGPU developer ZIPs.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxRipples=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('WATER-03 FX-CORE missing');
 const VERSION=1,DEG=Math.PI/180,PERIOD=40/60,
  LAYERS=Object.freeze(['primary','secondary','highlights']);
 const BUDGETS=Object.freeze({
  low:{segments:48,vertices:12000,highlights:192,maxRings:48},
  balanced:{segments:96,vertices:42000,highlights:480,maxRings:48},
  high:{segments:160,vertices:80000,highlights:960,maxRings:48}
 });
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const valid=(x,name,min,max,integer=false)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||
     (integer&&!Number.isInteger(x)))throw TypeError('WATER-03 invalid '+name);
  return x;
 };
 const shape=(x,fields,label)=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw TypeError('WATER-03 invalid '+label);
  for(const key of Object.keys(x))if(!fields.includes(key))
   throw TypeError('WATER-03 unknown '+label+'.'+key);
 };
 const hash=x=>{let h=2166136261;for(let i=0;i<x.length;i++)h=Math.imul(h^x.charCodeAt(i),16777619);return h|0};
 const random=(seed,i,stream=0)=>{
  let n=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b);
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
 };
 function curve(key,domain,values,unit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:[0,3],
   defaultValue:values[0][1],clamp:'hold',monotonic:false,
   keys:values.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function anchor(type='inherit',x=0,y=0){
  return {type,space:'world',name:'',slot:'',x,y,rotation:0};
 }
 function newEmitter(index=0){
  const layer=(enabled,alpha)=>({enabled,visible:true,x:0,y:0,
   rotation:0,timeOffset:0,alpha,blend:'normal',anchor:anchor()});
  return {id:'emitter'+(index+1),name:'Ripple source '+(index+1),
   enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,
   seed:1033+index*137,anchor:anchor('world',256,256),
   layers:{primary:layer(true,1),secondary:layer(true,.85),
    highlights:layer(false,.75)}};
 }
 function defaults(){
  return {schemaVersion:1,durationFrames:40,exportFrames:40,loop:false,
   rings:3,startRadius:5,finalRadius:120,ringDelayFrames:7,
   radialGapPx:20,thickness:3,ellipticity:1,
   highlightArcGapPx:20,highlightJitter:0,highlightDistribution:'even',
   seed:83291,quality:'balanced',style:'natural',
   radiusCurve:curve('radius','emitterTime',[[0,0],[.5,.85],[1,1]]),
   thicknessCurve:curve('thickness','particleAge',[[0,1],[1,.35]]),
   ringAlphaCurve:curve('ringAlpha','particleAge',[[0,.8],[.4,.65],[1,0]]),
   ringDelayCurve:curve('ringDelay','emitterTime',[[0,1],[.5,1],[1,1]]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'rippleColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',
    clamp:'hold',stops:[{id:'foam',position:0,rgba:[226,250,255,.96]},
     {id:'water',position:1,rgba:[91,190,213,.75]}]}),
   emitters:[newEmitter(0)]};
 }
 const keys=Object.keys(defaults()),numeric={
  durationFrames:[40,40],exportFrames:[1,3600],rings:[1,12],
  startRadius:[0,90],finalRadius:[20,350],ringDelayFrames:[0,60],
  radialGapPx:[1,90],thickness:[.5,20],ellipticity:[.2,3],
  highlightArcGapPx:[1,90],highlightJitter:[0,.45],seed:[-2147483648,2147483647]
 };
 const int=new Set(['durationFrames','exportFrames','rings','ringDelayFrames','seed']);
 const ANCHOR=['inherit','world','skeleton','bone','slot','attachment'];
 const anchorFields=['type','space','name','slot','x','y','rotation'];
 function anchorNormalize(a,kind){
  shape(a,anchorFields,'anchor');
  if(!ANCHOR.includes(a.type)||(kind==='emitter'&&a.type==='inherit')||
    !['world','local'].includes(a.space)||typeof a.name!=='string'||
    typeof a.slot!=='string'||(a.type==='attachment'&&!a.slot.trim())||
    (['bone','slot','attachment'].includes(a.type)&&!a.name.trim()))
   throw TypeError('WATER-03 invalid anchor');
  return {type:a.type,space:a.space,name:a.name,slot:a.slot,
   x:valid(a.x,'anchor.x',-10000,10000),
   y:valid(a.y,'anchor.y',-10000,10000),
   rotation:valid(a.rotation,'anchor.rotation',-360,360)};
 }
 function normalize(input){
  shape(input,keys,'settings');
  if(input.schemaVersion!==1)throw TypeError('WATER-03 unsupported version');
  const c={schemaVersion:1};
  for(const [key,[lo,hi]] of Object.entries(numeric))
   c[key]=valid(input[key],key,lo,hi,int.has(key));
  if(!(c.finalRadius>c.startRadius))throw TypeError('WATER-03 final radius must exceed start radius');
  if(typeof input.loop!=='boolean')throw TypeError('WATER-03 invalid loop');
  c.loop=input.loop;
  for(const [key,vals] of Object.entries({
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical'],
   highlightDistribution:['even','stratified','random','clustered']})){
   if(!vals.includes(input[key]))throw TypeError('WATER-03 invalid '+key);
   c[key]=input[key];
  }
  for(const [field,param,domain] of [
   ['radiusCurve','radius','emitterTime'],
   ['thicknessCurve','thickness','particleAge'],
   ['ringAlphaCurve','ringAlpha','particleAge'],
   ['ringDelayCurve','ringDelay','emitterTime']]){
   const v=Curves.normalize(input[field]);
   if(v.parameterKey!==param||v.domain!==domain||v.valueUnit!=='multiplier')
    throw TypeError('WATER-03 invalid '+field);
   c[field]=v;
  }
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='rippleColor'||c.palette.domain!=='particleAge')
   throw TypeError('WATER-03 invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('WATER-03 max 4 emitters');
  const ids=new Set();c.emitters=[];
  for(const e of input.emitters){
   shape(e,['id','name','enabled','visible','x','y','rotation','timeOffset','seed','anchor','layers'],'emitter');
   if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))
    throw TypeError('WATER-03 duplicate emitter id');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>128)
    throw TypeError('WATER-03 invalid emitter name');
   if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('WATER-03 invalid emitter enabled/visible');
   const v={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:valid(e.x,'emitter.x',-10000,10000),
    y:valid(e.y,'emitter.y',-10000,10000),
    rotation:valid(e.rotation,'emitter.rotation',-360,360),
    timeOffset:valid(e.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:valid(e.seed,'emitter.seed',-2147483648,2147483647,true),
    anchor:anchorNormalize(e.anchor,'emitter'),layers:{}};
   if(!e.layers||Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('WATER-03 exactly three layers required');
   for(const k of LAYERS){
    const l=e.layers[k];
    shape(l,['enabled','visible','x','y','rotation','timeOffset','alpha','blend','anchor'],'layer');
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
      !['normal','add'].includes(l.blend))throw TypeError('WATER-03 invalid layer '+k);
    v.layers[k]={enabled:l.enabled,visible:l.visible,
     x:valid(l.x,k+'.x',-10000,10000),y:valid(l.y,k+'.y',-10000,10000),
     rotation:valid(l.rotation,k+'.rotation',-360,360),
     timeOffset:valid(l.timeOffset,k+'.timeOffset',-3600,3600,true),
     alpha:valid(l.alpha,k+'.alpha',0,1),blend:l.blend,
     anchor:anchorNormalize(l.anchor,'layer')};
   }
   c.emitters.push(v);
  }
  for(const e of c.emitters)if(e.enabled)generateSchedule(c,e);
  return c;
 }
 const scheduleCache=new Map();
 function memo(key,compute){
  if(scheduleCache.has(key))return scheduleCache.get(key);
  const result=compute();
  if(scheduleCache.size>40)scheduleCache.delete(scheduleCache.keys().next().value);
  scheduleCache.set(key,result);return result;
 }
 function generateSchedule(c,e){
  const key=JSON.stringify([c.rings,c.ringDelayFrames,c.ringDelayCurve,e.seed,e.id,c.seed]);
  return memo(key,()=>{
   if(c.ringDelayFrames===0)
    return Array.from({length:c.rings},(_,i)=>({index:i,time:0}));
   const rate=60/c.ringDelayFrames;
   const rateCurve=Curves.normalize({...c.ringDelayCurve,
    parameterKey:'emissionRate'});
   const timed=Spacing.createTemporalSchedule({schemaVersion:1,
    mode:'custom',frequencySource:'rate',baseRate:rate,interval:1/rate,
    duration:PERIOD,minInterval:0,jitter:0,burstCount:1,burstDelay:0,
    seed:c.seed^e.seed^hash(e.id),maxEvents:96,
    rateCurve,intervalCurve:null});
   if(timed.capped)throw RangeError('WATER-03 timing schedule overflow');
   const births=[{index:0,time:0},...timed.events.slice(0,c.rings-1)
    .map((x,i)=>({index:i+1,time:x.time}))];
   if(births.length!==c.rings||
      births.some(x=>x.time>=39/60-1e-9))
    throw RangeError('WATER-03 ring birth schedule exceeds 40-frame window');
   return births;
  });
 }
 function schedule(input,e){
  const c=normalize(input),em=c.emitters.find(x=>x.id===e.id);
  if(!em)throw TypeError('WATER-03 unknown emitter');
  return generateSchedule(c,em);
 }
 function ringColor(c,u,alpha,i,seed){
  const rgba=Colors.sample(c.palette,u);
  const style=c.style==='natural'?[1,1,1]:
   c.style==='stylized'?[1.03,1.14,1.19]:[1.19,.91,1.32];
  return rgba.slice(0,3).map((v,j)=>clamp(v*style[j],0,255))
   .concat([clamp(rgba[3]*alpha*(.94+.06*random(seed,i,11)),0,1)]);
 }
 function ellipsePath(rx,ry){
  const k=.5522847498307936;
  return {schemaVersion:1,closed:true,segments:[
   {p0:[rx,0],p1:[rx,k*ry],p2:[k*rx,ry],p3:[0,ry]},
   {p0:[0,ry],p1:[-k*rx,ry],p2:[-rx,k*ry],p3:[-rx,0]},
   {p0:[-rx,0],p1:[-rx,-k*ry],p2:[-k*rx,-ry],p3:[0,-ry]},
   {p0:[0,-ry],p1:[k*rx,-ry],p2:[rx,-k*ry],p3:[rx,0]}
  ]};
 }
 function highlights(c,e,r,ringIndex,seed){
  if(r.radiusX<2||r.radiusY<2)return [];
  const spatial=Spacing.createSpatialPlacement({
   schemaVersion:1,path:ellipsePath(r.radiusX,r.radiusY),
   baseSpacingPx:c.highlightArcGapPx,minSpacing:1,maxSpacing:90,
   spacingCurve:null,mode:c.highlightDistribution,jitter:c.highlightJitter,
   seed:seed^ringIndex,maxPoints:512,pathFollow:'clamp',
   alignToTangent:true,tolerancePx:.25});
  if(spatial.capped)throw RangeError('WATER-03 highlight spatial placement overflow');
  return spatial.points.map((v,i)=>({
   kind:'highlight',ringIndex,cycle:r.cycle,age:r.age,x:v.x,y:v.y,
   angle:v.angle,length:clamp(c.highlightArcGapPx*.35,2,16),
   width:Math.max(.6,r.thickness*.7),
   rgba:ringColor(c,r.age,Math.min(.8,r.rgba[3]*.85),ringIndex+i,seed),
   id:r.id+'-highlight-'+i
  }));
 }
 function sample(input,seconds){
  const c=normalize(input);
  valid(seconds,'time',0,1e8);
  const time=c.loop?Math.round(((seconds%PERIOD)+PERIOD)%PERIOD*1e9)/1e9:seconds;
  const emitted=[];let totalRings=0,totalHighlights=0;
  const span=39/60,fadeBegin=33/60;
  for(const e of c.emitters){
   if(!e.enabled||!e.visible)continue;
   const layers=Object.fromEntries(LAYERS.map(x=>[x,[]]));
   const births=generateSchedule(c,e),seed=c.seed^e.seed^hash(e.id);
   for(const kind of ['primary','secondary','highlights']){
    const layer=e.layers[kind];
    if(!layer.enabled||!layer.visible||layer.alpha<=0)continue;
    const t=time-(e.timeOffset+layer.timeOffset)/60;
    const count=c.loop?2:1;
    for(let past=0;past<count;past++){
     for(const ev of births){
      const bornAt=ev.time-past*PERIOD,rawAge=t-bornAt,age=Math.max(0,rawAge);
      if(rawAge < -1e-8||age>=span||(!c.loop&&t>=span))continue;
      if(kind==='primary'&&ev.index>0)continue;
      if(kind==='secondary'&&ev.index===0)continue;
      const u=clamp(age/span,0,1);
      const growth=Curves.evaluate(c.radiusCurve,u);
      const radius=c.startRadius+ev.index*c.radialGapPx+
       (c.finalRadius-c.startRadius)*growth;
      const rx=radius*Math.sqrt(c.ellipticity),ry=radius/Math.sqrt(c.ellipticity);
      const thickness=c.thickness*Curves.evaluate(c.thicknessCurve,u);
      const globalFade=c.loop?1:Math.min(1,Math.max(0,(span-t)/(span-fadeBegin)));
      const alpha=Curves.evaluate(c.ringAlphaCurve,u)*layer.alpha*globalFade;
      if(alpha<=0)continue;
      const obj={kind:'ring',id:e.id+'-ring-'+ev.index+'-cycle-'+(-past),
       index:ev.index,cycle:-past,age:u,bornAt,
       radiusX:rx,radiusY:ry,radius,thickness,
       rgba:ringColor(c,u,alpha,ev.index,seed)};
      if(kind==='highlights')layers[kind].push(...highlights(c,e,obj,ev.index,seed));
      else layers[kind].push(obj);
     }
    }
   }
   totalRings+=layers.primary.length+layers.secondary.length;
   totalHighlights+=layers.highlights.length;
   emitted.push({id:e.id,layers});
  }
  const budget=BUDGETS[c.quality];
  const vertices=totalRings*(budget.segments+1)*8+totalHighlights*4;
  if(totalRings>budget.maxRings||totalHighlights>budget.highlights||
    vertices>budget.vertices)
   throw RangeError('WATER-03 quality budget exceeded: rings='+totalRings+
    ' highlights='+totalHighlights+' vertices='+vertices);
  return {schemaVersion:1,time,frame:time*60,emitters:emitted,
   counters:{rings:totalRings,highlights:totalHighlights,vertices,
    triangles:totalRings*budget.segments*6+totalHighlights*2},diagnostics:[]};
 }
 function bounds(frame,settings,anchors=null){
  const c=normalize(settings),out={inside:true,empty:true,
   minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const row of frame.emitters){
   const e=c.emitters.find(x=>x.id===row.id);
   if(!e)continue;
   for(const kind of LAYERS){
    const l=e.layers[kind],a=anchors?.[e.id]?.[kind]||
     (l.anchor.type==='world'?l.anchor:e.anchor);
    const rot=(e.rotation+e.anchor.rotation+l.rotation+l.anchor.rotation)*DEG;
    const cs=Math.cos(rot),sn=Math.sin(rot);
    const fixed=anchors?.[e.id]?.[kind];
    const ox=fixed?fixed.x:a.x+e.x+l.x+l.anchor.x*(l.anchor.type==='inherit'?1:0),
     oy=fixed?fixed.y:a.y+e.y+l.y+l.anchor.y*(l.anchor.type==='inherit'?1:0);
    for(const v of row.layers[kind]){
     let minX,maxX,minY,maxY;
     if(v.kind==='ring'){
      const ex=Math.sqrt((v.radiusX*cs)**2+(v.radiusY*sn)**2)+v.thickness/2+1.5,
       ey=Math.sqrt((v.radiusX*sn)**2+(v.radiusY*cs)**2)+v.thickness/2+1.5;
      minX=ox-ex;maxX=ox+ex;minY=oy-ey;maxY=oy+ey;
     }else{
      const x=ox+v.x*cs-v.y*sn,y=oy+v.x*sn+v.y*cs;
      const ex=v.length/2+v.width/2+1.5;
      minX=x-ex;maxX=x+ex;minY=y-ex;maxY=y+ex;
     }
     out.empty=false;out.minX=Math.min(out.minX,minX);
     out.maxX=Math.max(out.maxX,maxX);
     out.minY=Math.min(out.minY,minY);
     out.maxY=Math.max(out.maxY,maxY);
    }
   }
  }
  out.inside=out.empty||[out.minX,out.minY].every(x=>x>=0)&&
   [out.maxX,out.maxY].every(x=>x<=512);
  return out;
 }
 return Object.freeze({VERSION,LAYERS,BUDGETS,defaults,newEmitter,
  normalize,schedule,sample,bounds,ellipsePath,random});
});
