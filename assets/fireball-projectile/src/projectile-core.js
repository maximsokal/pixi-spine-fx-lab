// FIRE-03: renderer-independent, deterministic fireball motion, tail and emission.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxProjectile=api;
})(globalThis,function(Curves,Spacing,Path,Colors){
 'use strict';
 if(!Curves||!Spacing||!Path||!Colors)throw Error('FxProjectile requires curves/spacing/path/colors');
 const TAU=Math.PI*2,LAYERS=Object.freeze(['core','ribbon','sparks','embers','haze']);
 const BUDGETS=Object.freeze({
  low:{maxSparkParticles:10,maxEmbers:20,maxRibbonVertices:1024,maxPrimitives:68},
  balanced:{maxSparkParticles:30,maxEmbers:60,maxRibbonVertices:4096,maxPrimitives:160},
  high:{maxSparkParticles:120,maxEmbers:160,maxRibbonVertices:8192,maxPrimitives:350}
 });
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function scalar(v,name,lo,hi){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)
  throw TypeError('Invalid Projectile '+name+' range '+lo+'..'+hi);return v}
 function integer(v,name,lo,hi){scalar(v,name,lo,hi);if(!Number.isInteger(v))throw TypeError('Invalid integer '+name);return v}
 function hash(seed,a,b=0){let x=(seed^Math.imul(a+1,0x9e3779b1)^Math.imul(b+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296}
 function curve(key,domain,keys,range,unit='normalized'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='pathPosition'?'normalized-path':domain==='particleAge'?'normalized-lifetime':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:keys[0][1],
   clamp:'hold',monotonic:false,keys:keys.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function pathDefault(){
  return {schemaVersion:1,closed:false,segments:[
   {p0:[-152,93],p1:[-111,82],p2:[-91,-9],p3:[-4,-5]},
   {p0:[-4,-5],p1:[54,-3],p2:[83,-90],p3:[140,-79]}
  ]};
 }
 function defaults(){
  return {
   schemaVersion:1,trajectory:pathDefault(),speed:200,coreRadius:35,
   tailLength:65,tailWidth:28,sparkCount:15,turnLag:.25,
   trailRate:25,trailSpacing:6,trailJitter:.15,sparkGap:16,sparkRate:12,
   sparkLifeFrames:18,particleSize:2.5,trailLifeFrames:30,fadeFrames:24,
   launchFrames:6,fadeStartFrame:96,durationFrames:120,exportFrames:120,
   loop:false,unlockTail:false,tailX:-75,tailY:12,
   emissionMode:'distance',spatialMode:'even',spacingCurveEnabled:false,
   heatHaze:false,quality:'balanced',style:'natural',seed:31415,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:256,rotation:0},
   palette:Colors.normalize({schemaVersion:1,parameterKey:'projectilePalette',
    domain:'flameIntensity',inputUnit:'normalized-intensity',space:'srgb',clamp:'hold',
    stops:[{id:'outer',position:0,rgba:[174,36,19,.95]},
     {id:'middle',position:.5,rgba:[250,118,29,1]},
     {id:'inner',position:1,rgba:[255,233,160,1]}]}),
   tailTaperCurve:curve('widthMultiplier','pathPosition',[[0,1],[.65,.65],[1,0]],[0,2]),
   trailAlphaCurve:curve('trailAlpha','particleAge',[[0,.9],[.4,.65],[1,0]],[0,1]),
   corePulseCurve:curve('corePulse','effectTime',[[0,.9],[.5,1.1],[1,.9]],[.2,2]),
   emissionRateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,3]),
   trailSpacingCurve:curve('spacingPx','pathPosition',[[0,6],[.5,9],[1,6]],[.25,100],'px'),
   layers:Object.fromEntries(LAYERS.map(k=>[k,{enabled:k!=='haze',visible:true,x:0,y:0,
    rotation:0,timeOffset:0,blend:k==='core'||k==='sparks'?'add':'normal',alpha:1}]))
  };
 }
 const KNOWN=Object.keys(defaults());
 function normalize(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||input.schemaVersion!==1)
   throw TypeError('Invalid Projectile schema');
  for(const k of Object.keys(input))if(!KNOWN.includes(k))throw TypeError('Unknown Projectile key '+k);
  const out={schemaVersion:1},ranges={
   speed:[0,900],coreRadius:[5,120],tailLength:[0,240],tailWidth:[1,120],
   sparkCount:[0,120],turnLag:[0,1],trailRate:[0,120],trailSpacing:[.25,100],
   trailJitter:[0,.45],sparkGap:[8,30],sparkRate:[0,120],
   sparkLifeFrames:[1,180],particleSize:[.2,20],trailLifeFrames:[1,180],
   fadeFrames:[1,180],launchFrames:[0,120],fadeStartFrame:[1,600],
   durationFrames:[6,600],exportFrames:[1,3600],tailX:[-1000,1000],
   tailY:[-1000,1000],seed:[-2147483648,2147483647]
  };
  const ints=new Set(['sparkCount','sparkLifeFrames','trailLifeFrames',
   'fadeFrames','launchFrames','fadeStartFrame','durationFrames','exportFrames','seed']);
  for(const [k,[a,b]] of Object.entries(ranges))out[k]=ints.has(k)?
   integer(input[k],k,a,b):scalar(input[k],k,a,b);
  if(out.fadeStartFrame>=out.durationFrames||
     out.launchFrames>out.fadeStartFrame||out.fadeFrames>out.durationFrames)
    throw TypeError('Invalid Projectile phase ordering');
  for(const k of ['loop','unlockTail','spacingCurveEnabled','heatHaze']){
   if(typeof input[k]!=='boolean')throw TypeError('Invalid Projectile boolean '+k);out[k]=input[k];
  }
  for(const [k,values] of [
   ['emissionMode',['time','distance','both']],
   ['spatialMode',['even','random','stratified','clustered']],
   ['quality',Object.keys(BUDGETS)],['style',['natural','stylized','magical']]
  ]){if(!values.includes(input[k]))throw TypeError('Invalid Projectile '+k);out[k]=input[k]}
  out.trajectory=Spacing.normalizePath(input.trajectory);
  if(out.trajectory.closed||out.trajectory.segments.length!==2)
   throw TypeError('Projectile requires an open two-cubic path');
  for(const [k,id,domain,unit] of [
   ['tailTaperCurve','widthMultiplier','pathPosition','normalized'],
   ['trailAlphaCurve','trailAlpha','particleAge','normalized'],
   ['corePulseCurve','corePulse','effectTime','normalized'],
   ['emissionRateCurve','emissionRate','emitterTime','normalized'],
   ['trailSpacingCurve','spacingPx','pathPosition','px']
  ]){
   const c=Curves.normalize(input[k]);
   if(c.parameterKey!==id||c.domain!==domain||c.valueUnit!==unit)
    throw TypeError('Invalid Projectile curve '+k);
   out[k]=c;
  }
  out.palette=Colors.normalize(input.palette);
  if(out.palette.parameterKey!=='projectilePalette'||out.palette.domain!=='flameIntensity')
   throw TypeError('Invalid Projectile palette');
  const a=input.anchor;
  if(!a||Object.keys(a).sort().join(',')!=='name,rotation,slot,space,type,x,y'||
   !['world','skeleton','bone','slot','attachment'].includes(a.type)||
   !['world','local'].includes(a.space)||typeof a.name!=='string'||
   typeof a.slot!=='string'||a.name.length>80||a.slot.length>80||
   (['bone','slot','attachment'].includes(a.type)&&!a.name.trim()))
   throw TypeError('Invalid Projectile anchor');
  out.anchor={...a,x:scalar(a.x,'anchor.x',-10000,10000),
   y:scalar(a.y,'anchor.y',-10000,10000),
   rotation:scalar(a.rotation,'anchor.rotation',-360,360)};
  if(!input.layers||Object.keys(input.layers).sort().join(',')!==[...LAYERS].sort().join(','))
   throw TypeError('Invalid Projectile layers');
  out.layers={};
  for(const k of LAYERS){
   const v=input.layers[k];
   if(!v||Object.keys(v).sort().join(',')!=='alpha,blend,enabled,rotation,timeOffset,visible,x,y'||
      typeof v.enabled!=='boolean'||typeof v.visible!=='boolean'||
      !['normal','add','screen','multiply'].includes(v.blend))
    throw TypeError('Invalid Projectile layer '+k);
   out.layers[k]={enabled:v.enabled,visible:v.visible,blend:v.blend,
    x:scalar(v.x,k+'.x',-10000,10000),y:scalar(v.y,k+'.y',-10000,10000),
    alpha:scalar(v.alpha,k+'.alpha',0,1),
    rotation:scalar(v.rotation,k+'.rotation',-360,360),
    timeOffset:scalar(v.timeOffset,k+'.timeOffset',-3600,3600)};
  }
  return out;
 }
 function rotate(x,y,angle){return [Math.cos(angle)*x-Math.sin(angle)*y,
  Math.sin(angle)*x+Math.cos(angle)*y]}
 function headAt(table,cfg,seconds){
  const travel=Math.min(Math.max(0,seconds),cfg.fadeStartFrame/60),
   dist=Math.min(table.length,cfg.speed*travel),p=Spacing.pointAtDistance(table,dist);
  return {x:p.x,y:p.y,angle:p.angle,tangent:p.tangent,distance:dist,
   pathLength:table.length,travelEnded:dist>=table.length-1e-8};
 }
 function trailPath(table,cfg,head){
  if(cfg.tailLength<=0||head.distance<.25)return null;
  const d0=Math.max(0,head.distance-cfg.tailLength),d1=head.distance;
  const pieces=Math.min(60,Math.max(4,Math.ceil((d1-d0)/13)));
  const pts=[];
  const first=Spacing.pointAtDistance(table,d1);
  const last=Spacing.pointAtDistance(table,d0);
  for(let i=0;i<=pieces;i++){
   const f=i/pieces,d=d1-(d1-d0)*f,p=Spacing.pointAtDistance(table,d);
   // 0=straight behind current heading; 1=exact historical curved trajectory.
   const straight={x:first.x-head.tangent.x*(d1-d),
    y:first.y-head.tangent.y*(d1-d)};
   let x=straight.x*(1-cfg.turnLag)+p.x*cfg.turnLag,
       y=straight.y*(1-cfg.turnLag)+p.y*cfg.turnLag;
   if(cfg.unlockTail){
    // Explicit unlocked tail endpoint relative to the head, with a smooth ease.
    const w=f*f*(3-2*f),endX=first.x+cfg.tailX,endY=first.y+cfg.tailY;
    x+=(endX-(straight.x*(1-cfg.turnLag)+last.x*cfg.turnLag))*w;
    y+=(endY-(straight.y*(1-cfg.turnLag)+last.y*cfg.turnLag))*w;
   }
   pts.push([x,y]);
  }
  const segments=[];
  for(let i=0;i<pieces;i++){
   const a=pts[i],b=pts[i+1],prev=pts[Math.max(0,i-1)],
    next=pts[Math.min(pieces,i+2)];
   segments.push({p0:a,p1:[a[0]+(b[0]-prev[0])/6,a[1]+(b[1]-prev[1])/6],
    p2:[b[0]-(next[0]-a[0])/6,b[1]-(next[1]-a[1])/6],p3:b});
  }
  return {schemaVersion:1,closed:false,segments};
 }
 function schedule(cfg,table){
  const duration=Math.min(cfg.fadeStartFrame/60,
   cfg.speed>0?table.length/cfg.speed:cfg.fadeStartFrame/60);
  const timetable=Spacing.createTemporalSchedule({
   schemaVersion:1,mode:'custom',frequencySource:'rate',
   baseRate:cfg.trailRate,interval:1/Math.max(cfg.trailRate,.1),
   duration,minInterval:0,jitter:cfg.trailJitter,burstCount:1,burstDelay:0,
   seed:cfg.seed,maxEvents:Math.min(4096,Math.ceil(duration*cfg.trailRate)+4),
   rateCurve:cfg.emissionRateCurve,intervalCurve:null
  });
  const placement=Spacing.createSpatialPlacement({
   path:cfg.trajectory,baseSpacingPx:cfg.trailSpacing,minSpacing:.25,maxSpacing:100,
   spacingCurve:cfg.spacingCurveEnabled?cfg.trailSpacingCurve:null,
   mode:cfg.spatialMode,jitter:0,seed:(cfg.seed+23)|0,maxPoints:1000,
   alignToTangent:true,pathFollow:'clamp'});
  let events=[];
  if(cfg.emissionMode==='distance'){
   if(cfg.speed>0)events=placement.points
    .filter(p=>p.distance>0&&p.distance<=Math.min(table.length,cfg.speed*duration))
    .map((p,i)=>({time:p.distance/cfg.speed,index:i,distance:p.distance,x:p.x,y:p.y,
     angle:p.angle}));
  }else{
   const motion=Array.from({length:Math.ceil(duration*240)+1},(_,i)=>{
    const time=Math.min(duration,i/240),p=headAt(table,cfg,time);
    return {time:time+i*1e-10,x:p.x,y:p.y}
   });
   const combined=Spacing.combineSchedule({schedule:timetable,placement,motion,
    mode:cfg.emissionMode,teleportThresholdPx:512,maxEvents:4096});
   events=combined.events.map((ev,i)=>{
    const p=headAt(table,cfg,ev.time);
    return {time:ev.time,index:i,distance:p.distance,x:p.x,y:p.y,angle:p.angle};
   });
  }
  return {events,capped:events.length>=4096,placement,timetable};
 }
 function sample(input,seconds){
  const cfg=normalize(input),t0=scalar(seconds,'time',0,1e7),total=cfg.durationFrames/60;
  const time=cfg.loop?t0%total:t0,table=Spacing.buildArcTable(cfg.trajectory);
  const result={time,total,phase:clamp(time/total,0,1),head:headAt(table,cfg,time),
   layers:Object.fromEntries(LAYERS.map(k=>[k,[]])),events:{trail:[],sparks:[]},
   impact:null,quality:cfg.quality,primitives:0,bounds:null};
  const head=result.head,quality=BUDGETS[cfg.quality];
  if(!cfg.loop&&time>=total)return result; // terminal one-shot has no future emissions or allocations
  const phaseTime=k=>time-cfg.layers[k].timeOffset/60;
  const enabled=k=>cfg.layers[k].enabled&&cfg.layers[k].visible&&cfg.layers[k].alpha>0;
  const fade=clamp((cfg.durationFrames/60-time)/(cfg.fadeFrames/60),0,1);
  const start=cfg.launchFrames===0?1:clamp(.48+.52*time/(cfg.launchFrames/60),0,1);
  const opacity=fade*start;
  const rgba=u=>Colors.sample(cfg.palette,clamp(u,0,1));
  function add(key,item){
   const layer=cfg.layers[key];
   if(!enabled(key))return;
   const a=layer.rotation*Math.PI/180;
   if(item.kind==='ribbon'){
    const pos=item.positions;
    for(let i=0;i<pos.length;i+=2){
     const [x,y]=rotate(pos[i],pos[i+1],a);pos[i]=x+layer.x;pos[i+1]=y+layer.y;
    }
   }else if(item.kind==='poly'){
    item.points=item.points.map(([x,y])=>{const [u,v]=rotate(x,y,a);
     return [u+layer.x,v+layer.y]});
   }else{
    const [x,y]=rotate(item.x,item.y,a);
    item.x=x+layer.x;item.y=y+layer.y;
    if(item.kind==='rect')item.rotation+=a;
   }
   item.rgba[3]*=layer.alpha;
   if(item.rgba[3]<=1e-7)return;
   result.layers[key].push(item);
  }
  if(enabled('core')&&time>=0&&time<=total){
   const local=phaseTime('core');
   if(local>=0&&local<=total){
    const phase=clamp(local/total,0,1),
     pulse=Curves.evaluate(cfg.corePulseCurve,phase),
     radius=cfg.coreRadius*pulse*opacity;
    if(radius>0){
     add('core',{kind:'circle',x:head.x,y:head.y,radius,rgba:(()=>{
      const c=rgba(.68);c[3]*=.97;return c})()});
     add('core',{kind:'circle',x:head.x,y:head.y,radius:radius*.52,
      rgba:(()=>{const c=rgba(.99);c[3]*=.92;return c})()});
     if(cfg.style==='magical')add('core',{kind:'ring',x:head.x,y:head.y,
      radius:radius*1.25,width:1.6,rgba:[142,139,255,.31*opacity]});
    }
   }
  }
  if(enabled('ribbon')&&phaseTime('ribbon')>=0&&phaseTime('ribbon')<=total&&opacity>0){
   const p=trailPath(table,cfg,head);
   if(p){
    const mesh=Path.buildRibbon({path:p,
     width:{start:cfg.tailWidth,middle:cfg.tailWidth,end:cfg.tailWidth,
      startTaper:0,endTaper:0,minVisiblePx:0,curve:cfg.tailTaperCurve},
     quality:cfg.quality,sampleSpacingPx:5,seed:cfg.seed,miterLimit:2,
     edgeIrregularity:cfg.style==='stylized'?0:.07});
    if(mesh.positions.length/2>quality.maxRibbonVertices)throw Error('Projectile ribbon budget');
    if(mesh.indices.length){
     const c=rgba(.45);c[3]*=opacity*.8;
     add('ribbon',{kind:'ribbon',positions:mesh.positions,indices:mesh.indices,
      rgba:c,vertices:mesh.positions.length/2,triangles:mesh.indices.length/3});
    }
   }
  }
  if(enabled('embers')||enabled('sparks')){
   const emitted=schedule(cfg,table);result.events.trail=emitted.events;
   const local=phaseTime('embers'),life=cfg.trailLifeFrames/60;
   if(enabled('embers')&&local>=0){
    let displayed=0;
    for(let i=emitted.events.length-1;i>=0&&displayed<quality.maxEmbers;i--){
     const ev=emitted.events[i],age=(local-ev.time)/life;
     if(age<0)continue;if(age>=1)break;
     const drift=(hash(cfg.seed,i,11)-.5)*9*age;
     const c=rgba(.16+.35*hash(cfg.seed,i,4));
     c[3]*=Curves.evaluate(cfg.trailAlphaCurve,age)*opacity*.7;
     add('embers',{kind:'circle',x:ev.x+drift,y:ev.y-11*age,
      radius:cfg.particleSize*(.5+.5*hash(cfg.seed,i,24))*(1-age*.4),rgba:c});
     displayed++;
    }
   }
   const sparkDuration=Math.min(cfg.fadeStartFrame/60,
    cfg.speed>0?table.length/cfg.speed:cfg.fadeStartFrame/60);
   const sparks=Spacing.createTemporalSchedule({schemaVersion:1,mode:'uniform',
    frequencySource:'rate',baseRate:cfg.sparkCount===0?0:cfg.sparkRate,
    interval:.1,duration:sparkDuration,minInterval:0,jitter:cfg.trailJitter,
    burstCount:1,burstDelay:0,seed:(cfg.seed+71)|0,
    maxEvents:Math.max(1,Math.ceil(sparkDuration*Math.max(1,cfg.sparkRate))+5),
    rateCurve:null,intervalCurve:null});
   result.events.sparks=sparks.events;
   if(enabled('sparks')&&phaseTime('sparks')>=0){
    let active=0,local=phaseTime('sparks'),life=cfg.sparkLifeFrames/60;
    for(let i=sparks.events.length-1;i>=0&&active<Math.min(cfg.sparkCount,quality.maxSparkParticles);i--){
     const ev=sparks.events[i],age=(local-ev.time)/life;
     if(age<0)continue;if(age>=1)break;
     const birthplace=headAt(table,cfg,ev.time),
      angle=TAU*hash(cfg.seed,i,88),
      gap=cfg.sparkGap*(.75+.25*hash(cfg.seed,i,14)),
      speed=55+160*hash(cfg.seed,i,35);
     const x=birthplace.x+Math.cos(angle)*(gap+speed*age*life),
      y=birthplace.y+Math.sin(angle)*(gap+speed*age*life)+25*age*age;
     const c=rgba(.85);c[3]*=(1-age)*opacity;
     add('sparks',{kind:'circle',x,y,radius:cfg.particleSize*(1-age*.5),rgba:c});
     active++;
    }
   }
  }
  if(enabled('haze')&&cfg.heatHaze&&phaseTime('haze')>=0&&opacity>0){
   // Stylized heat shimmer contour (NOT true framebuffer refraction). UI diagnostic required.
   for(let i=0;i<3;i++){
    const theta=time*12+i*TAU/3,mod=Math.sin(theta)*.12,
     rad=cfg.coreRadius*(1.35+i*.18+mod);
    add('haze',{kind:'ring',x:head.x+Math.cos(theta)*2,
     y:head.y+Math.sin(theta)*2,radius:rad,width:1.2+i*.4,
     rgba:[255,181,116,(.1-.025*i)*opacity]});
   }
  }
  if(cfg.speed>0&&time>=Math.min(cfg.fadeStartFrame/60,table.length/cfg.speed)&&time<=total)
   result.impact={
   type:'fireball-impact-ready',time:Math.min(cfg.fadeStartFrame/60,table.length/cfg.speed),
   x:head.x,y:head.y,angle:head.angle,source:'fx.fire.fireball-projectile'};
  result.primitives=Object.values(result.layers).reduce((n,arr)=>n+arr.length,0);
  if(result.primitives>quality.maxPrimitives)throw Error('Projectile global primitive budget');
  return result;
 }
 function bounds(snapshot,anchor,angle=0){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function hit(x,y){const [a,b]=rotate(x,y,angle),px=a+anchor.x,py=b+anchor.y;
   minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py)}
  for(const items of Object.values(snapshot.layers))for(const item of items){
   if(item.kind==='ribbon'){for(let i=0;i<item.positions.length;i+=2)
    hit(item.positions[i],item.positions[i+1]);continue}
   if(item.kind==='poly'){for(const p of item.points)hit(p[0],p[1]);continue}
   const rad=item.radius+(item.kind==='ring'?item.width/2:0);
   const [x,y]=rotate(item.x,item.y,angle),cx=x+anchor.x,cy=y+anchor.y;
   minX=Math.min(minX,cx-rad);maxX=Math.max(maxX,cx+rad);
   minY=Math.min(minY,cy-rad);maxY=Math.max(maxY,cy+rad);
  }
  return {empty:minX===Infinity,minX,minY,maxX,maxY,
   inside:minX===Infinity||(minX>=0&&minY>=0&&maxX<=512&&maxY<=512)};
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,normalize,sample,bounds,headAt,trailPath,schedule};
});
