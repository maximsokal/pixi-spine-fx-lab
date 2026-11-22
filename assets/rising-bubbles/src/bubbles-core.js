// WATER-05: deterministic rising bubbles. Pure CJS / browser UMD numerical contract.
// All coordinates and radii are logical pixels; time is always absolute seconds.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxBubbles=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('WATER-05 requires FX-CORE curves, spacing, colors');
 const VERSION=1,PERIOD=1,LAYERS=Object.freeze(['bubbles','highlights','popRings']);
 const BUDGETS=Object.freeze({
  low:{maxCandidates:350,maxVisible:400,maxOrigins:200},
  balanced:{maxCandidates:1100,maxVisible:1600,maxOrigins:400},
  high:{maxCandidates:2800,maxVisible:3500,maxOrigins:800}
 });
 const clamp=(n,a,b)=>Math.max(a,Math.min(n,b));
 const finite=(n,label,a,b,integer=false)=>{
  if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b||
   integer&&!Number.isInteger(n))throw TypeError('WATER-05 invalid '+label);
  return n;
 };
 const strict=(v,keys,label)=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw TypeError('WATER-05 invalid '+label);
  for(const k of Object.keys(v))if(!keys.includes(k))throw TypeError('WATER-05 unknown '+label+'.'+k);
 };
 const hash=s=>{let h=2166136261;for(const ch of s)
  h=Math.imul(h^ch.charCodeAt(0),16777619);return h|0};
 function random(seed,index,stream=0){
  let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,values){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:'multiplier',inputRange:[0,1],valueRange:[0,3],
   defaultValue:values[0][1],clamp:'hold',monotonic:false,
   keys:values.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function anchor(type='world',x=0,y=0){
  return {type,space:'world',name:'',slot:'',x,y,rotation:0};
 }
 function newEmitter(i=0){
  const layer=(enabled,alpha)=>({
   enabled,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha,blend:'normal',
   anchor:anchor('inherit')
  });
  return {id:'emitter'+(i+1),name:'Rising Bubbles '+(i+1),
   enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,
   seed:6107+i*173,anchor:anchor('world',256+i*24,440),
   layers:{bubbles:layer(true,.83),highlights:layer(true,.72),
    popRings:layer(true,.62)}};
 }
 function defaults(){
  return {schemaVersion:1,mode:'loop',durationFrames:60,exportFrames:60,
   rate:16,radius:8,buoyancy:90,wobble:12,lifetime:1.8,highlightStrength:.6,
   originGap:22,originSpan:320,nozzleBend:9,spatialJitter:.25,radiusVariation:.20,
   popLifetime:.22,seed:87119,quality:'balanced',style:'natural',
   temporalMode:'uniform',spatialMode:'even',
   sizeCurve:curve('size','particleAge',[[0,.5],[.7,1],[1,.9]]),
   lateralDriftCurve:curve('lateralDrift','particleAge',[[0,0],[.4,1],[1,0]]),
   alphaCurve:curve('bubbleAlpha','particleAge',[[0,0],[.1,1],[.85,1],[1,0]]),
   emissionRateCurve:curve('emissionRate','effectTime',[[0,1],[.5,1],[1,1]]),
   originGapCurve:curve('originGap','pathPosition',[[0,1],[.5,1],[1,1]]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'bubbleColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'surface',position:0,rgba:[230,253,255,.75]},
     {id:'deep',position:1,rgba:[107,207,236,.65]}]}),
   emitters:[newEmitter(0)]};
 }
 const fields=Object.keys(defaults());
 const ranges={durationFrames:[40,60],exportFrames:[1,3600],
  rate:[0,90],radius:[2,22],buoyancy:[0,450],wobble:[0,45],
  lifetime:[.1,8],highlightStrength:[0,1],originGap:[4,100],
  originSpan:[10,480],nozzleBend:[-80,80],spatialJitter:[0,.45],radiusVariation:[0,.8],
  popLifetime:[.05,.6],seed:[-2147483648,2147483647]};
 const ints=new Set(['durationFrames','exportFrames','seed']);
 const anchorTypes=['world','skeleton','bone','slot','attachment','inherit'];
 const anchorKeys=['type','space','name','slot','x','y','rotation'];
 const emitterKeys=['id','name','enabled','visible','x','y','rotation',
  'timeOffset','seed','anchor','layers'];
 const layerKeys=['enabled','visible','x','y','rotation','timeOffset','alpha','blend','anchor'];
 function validateAnchor(a,layer=false){
  strict(a,anchorKeys,'anchor');
  if(!anchorTypes.includes(a.type)||(!layer&&a.type==='inherit')||
   !['world','local'].includes(a.space)||typeof a.name!=='string'||
   typeof a.slot!=='string'||(['bone','slot'].includes(a.type)&&!a.name.trim())||
   a.type==='attachment'&&(!a.name.trim()||!a.slot.trim()))
   throw TypeError('WATER-05 invalid anchor');
  return {type:a.type,space:a.space,name:a.name,slot:a.slot,
   x:finite(a.x,'anchor x',-10000,10000),y:finite(a.y,'anchor y',-10000,10000),
   rotation:finite(a.rotation,'anchor rotation',-360,360)};
 }
 function normalize(input){
  strict(input,fields,'settings');
  if(input.schemaVersion!==1)throw TypeError('WATER-05 unsupported schema version');
  const c={schemaVersion:1};
  for(const [name,[min,max]] of Object.entries(ranges))
   c[name]=finite(input[name],name,min,max,ints.has(name));
  if(!['loop','shutdown'].includes(input.mode))throw TypeError('WATER-05 invalid mode');
  c.mode=input.mode;
  if(c.durationFrames!==(c.mode==='loop'?60:40))
   throw TypeError('WATER-05 durationFrames inconsistent with mode');
  for(const [field,options] of Object.entries({
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical'],
   spatialMode:['even','random','clustered'],temporalMode:['uniform','clustered']
  })){
   if(!options.includes(input[field]))throw TypeError('WATER-05 invalid '+field);
   c[field]=input[field];
  }
  if(c.originSpan<c.originGap*2)
   throw RangeError('WATER-05 nozzle span too short for independent origin gap');
  for(const [field,key,domain] of [
   ['sizeCurve','size','particleAge'],['lateralDriftCurve','lateralDrift','particleAge'],
   ['alphaCurve','bubbleAlpha','particleAge'],['emissionRateCurve','emissionRate','effectTime'],
   ['originGapCurve','originGap','pathPosition']]){
   c[field]=Curves.normalize(input[field]);
   if(c[field].parameterKey!==key||c[field].domain!==domain||
    c[field].valueUnit!=='multiplier')
    throw TypeError('WATER-05 invalid '+field);
  }
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='bubbleColor'||c.palette.domain!=='particleAge')
   throw TypeError('WATER-05 invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('WATER-05 maximum 4 emitters');
  c.emitters=[];const ids=new Set();
  for(const e of input.emitters){
   strict(e,emitterKeys,'emitter');
   if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))
    throw TypeError('WATER-05 duplicate/invalid emitter id');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>128)
    throw TypeError('WATER-05 invalid emitter name');
   if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('WATER-05 invalid emitter toggle');
   const v={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:finite(e.x,'emitter.x',-10000,10000),
    y:finite(e.y,'emitter.y',-10000,10000),
    rotation:finite(e.rotation,'emitter.rotation',-360,360),
    timeOffset:finite(e.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:finite(e.seed,'emitter.seed',-2147483648,2147483647,true),
    anchor:validateAnchor(e.anchor),layers:{}};
   strict(e.layers,LAYERS,'layers');
   if(Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('WATER-05 requires exactly 3 layers');
   for(const name of LAYERS){
    const l=e.layers[name];strict(l,layerKeys,name);
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
     !['normal','add'].includes(l.blend))throw TypeError('WATER-05 invalid '+name);
    v.layers[name]={enabled:l.enabled,visible:l.visible,
     x:finite(l.x,name+'.x',-10000,10000),
     y:finite(l.y,name+'.y',-10000,10000),
     rotation:finite(l.rotation,name+'.rotation',-360,360),
     timeOffset:finite(l.timeOffset,name+'.timeOffset',-3600,3600,true),
     alpha:finite(l.alpha,name+'.alpha',0,1),blend:l.blend,
     anchor:validateAnchor(l.anchor,true)};
   }
   c.emitters.push(v);
  }
  // Reject worst-case event-history allocation, not just a visually sparse sample.
  const expected=Math.ceil(c.rate*(c.lifetime+c.popLifetime+1))*c.emitters.length;
  if(expected>BUDGETS[c.quality].maxCandidates)
   throw RangeError('WATER-05 '+c.quality+' quality history budget exceeded: '+
    expected+' > '+BUDGETS[c.quality].maxCandidates);
  return c;
 }
 const plans=new Map();
 function plan(c,e){
  const key=JSON.stringify([c.rate,c.originSpan,c.originGap,c.nozzleBend,c.spatialJitter,
   c.seed,e.seed,e.id,c.spatialMode,c.temporalMode,
   c.emissionRateCurve,c.originGapCurve]);
  if(plans.has(key))return plans.get(key);
  const seeded=(c.seed^e.seed^hash(e.id))|0;
  const rateCurve=Curves.normalize({...c.emissionRateCurve,
   parameterKey:'emissionRate',domain:'emitterTime'});
  const temporal=Spacing.createTemporalSchedule({schemaVersion:1,
   mode:c.temporalMode==='clustered'?'clustered':'custom',
   frequencySource:'rate',baseRate:c.rate,interval:c.rate?1/c.rate:1,
   duration:PERIOD,minInterval:0,jitter:0,burstCount:1,burstDelay:0,
   seed:seeded,maxEvents:1024,rateCurve,intervalCurve:null});
  if(temporal.capped)throw RangeError('WATER-05 temporal budget exceeded');
  const half=c.originSpan/2;
  const nozzle={schemaVersion:1,closed:false,segments:[
   {p0:[-half,0],p1:[-half/3,-c.nozzleBend],p2:[half/3,-c.nozzleBend],p3:[half,0]}]};
  const gapCurve=Curves.normalize({...c.originGapCurve,
   parameterKey:'spacingPx',valueUnit:'px',valueRange:[0,1000],
   defaultValue:c.originGap*c.originGapCurve.defaultValue,
   keys:c.originGapCurve.keys.map(k=>({...k,y:k.y*c.originGap}))});
  // minSpacing enforces a real hard gap EVEN under random/clustered/jitter placement.
  const spatial=Spacing.createSpatialPlacement({schemaVersion:1,path:nozzle,
   baseSpacingPx:c.originGap,minSpacing:c.originGap,maxSpacing:1000,
   spacingCurve:gapCurve,mode:c.spatialMode,jitter:c.spatialJitter,
   seed:seeded,maxPoints:512,alignToTangent:true,pathFollow:'clamp',
   tolerancePx:.25});
  if(spatial.capped)throw RangeError('WATER-05 origin placement budget exceeded');
  const origins=[{index:0,distance:0,x:-half,y:0}].concat(
   spatial.points.map((p,i)=>({index:i+1,distance:p.distance,x:p.x,y:p.y})));
  if(origins.length<2)throw RangeError('WATER-05 nozzle has insufficient spaced origins');
  const value={events:temporal.events,origins,arcErrorBound:spatial.table.errorBound,
   sourceId:e.id};
  if(plans.size>=24)plans.delete(plans.keys().next().value);
  plans.set(key,value);return value;
 }
 function schedule(settings,emitter){
  const c=normalize(settings),e=c.emitters.find(v=>v.id===emitter.id);
  if(!e)throw Error('WATER-05 missing emitter');
  return plan(c,e);
 }
 function items(c,e,kind,t,p){
  const layer=e.layers[kind],result=[];
  if(!layer.enabled||!layer.visible||!layer.alpha)return result;
  if(kind==='highlights'&&c.highlightStrength===0)return result;
  const seconds=t+e.timeOffset/60+layer.timeOffset/60;
  const phase=c.mode==='loop'?((seconds%1)+1)%1:seconds;
  // For one-shot, no new emission after t=0; preexisting bubbles fade.
  const activeEnd=c.mode==='shutdown'?0:phase;
  const span=Math.ceil(c.lifetime+c.popLifetime)+1;
  const first=-span;
  const globalFade=c.mode==='shutdown'?clamp(1-t/(39/60),0,1):1;
  if(globalFade<=0)return result;
  const seeded=(c.seed^e.seed^hash(e.id))|0;
  for(let cycle=first;cycle<=0;cycle++){
   for(const ev of p.events){
    const birth=ev.time+cycle;
    if(birth>activeEnd+1e-9)continue;
    const age=phase-birth;
    if(age<0||age>c.lifetime+c.popLifetime+1e-9)continue;
    const index=ev.index,originIndex=(index+Math.abs(seeded)%p.origins.length)%p.origins.length;
    const origin=p.origins[originIndex];
    const sizeRandom=1+(2*random(seeded,index,17)-1)*c.radiusVariation;
    const driftPhase=random(seeded,index,9)*2*Math.PI;
    const x=origin.x+c.wobble*Curves.evaluate(c.lateralDriftCurve,
      clamp(age/c.lifetime,0,1))*Math.sin(age*7.2+driftPhase);
    const y=origin.y-.5*c.buoyancy*age*age;
    const normalAge=clamp(age/c.lifetime,0,1);
    const size=c.radius*sizeRandom*Math.max(.1,Curves.evaluate(c.sizeCurve,normalAge));
    // Palette is user-authored straight RGBA; style changes actual color, not just label.
    const color=Colors.sample(c.palette,normalAge);
    const rgbFactor=c.style==='natural'?[1,1,1]:
     c.style==='stylized'?[1.08,1.04,1.08]:[1.12,.89,1.2];
    const rgb=color.slice(0,3).map((v,i)=>clamp(v*rgbFactor[i],0,255));
    const visibleAlpha=clamp(Curves.evaluate(c.alphaCurve,normalAge),0,1);
    const identity=index+':'+cycle;
    if(kind==='bubbles'&&age<c.lifetime){
     const alpha=clamp(layer.alpha*globalFade*color[3]*visibleAlpha,0,1);
     if(alpha>0)result.push({kind:'bubble',index,originIndex,id:identity,
      x,y,radius:size,age,rgba:[...rgb,alpha],rotation:0});
    }
    if(kind==='highlights'&&age<c.lifetime){
     const alpha=clamp(layer.alpha*globalFade*color[3]*visibleAlpha*
      c.highlightStrength,0,1);
     if(alpha>0)result.push({kind:'highlight',index,originIndex,id:identity,
      x:x-size*.20,y:y-size*.24,radius:size,age,
      rgba:[...rgb.map(v=>Math.min(255,v*1.09)),alpha],rotation:random(seeded,index,71)*.9});
    }
    if(kind==='popRings'&&age>=c.lifetime&&age<c.lifetime+c.popLifetime){
     // Impact/lifetime events are produced in local space. World/Spine
     // visibility belongs to the renderer after anchor transforms; never
     // reject based on local y as though it were global screen coordinates.
     const pop=(age-c.lifetime)/c.popLifetime;
     const alpha=clamp(layer.alpha*globalFade*.35*(1-pop)*color[3],0,1);
     if(alpha>0)result.push({kind:'pop',index,originIndex,id:identity,
      x,y,radius:size*(1+pop*1.75),age,
      rgba:[...rgb,alpha],rotation:0});
    }
   }
  }
  return result.sort((a,b)=>a.age-b.age||a.index-b.index||
   a.originIndex-b.originIndex);
 }
 function sample(settings,timeSeconds){
  const c=normalize(settings);
  finite(timeSeconds,'time',0,1e8);
  const time=c.mode==='loop'?Math.round((timeSeconds%1)*1e9)/1e9:timeSeconds;
  const emitters=[],counters={scheduled:0,bubbles:0,highlights:0,
   popRings:0,historyCycles:Math.ceil(c.lifetime+c.popLifetime)+2};
  for(const e of c.emitters){
   if(!e.enabled||!e.visible)continue;
   const p=plan(c,e),layers={};
   counters.scheduled+=p.events.length;
   for(const kind of LAYERS){
    layers[kind]=items(c,e,kind,time,p);
    counters[kind]+=layers[kind].length;
   }
   emitters.push({id:e.id,layers});
  }
  const total=counters.bubbles+counters.highlights+counters.popRings;
  if(total>BUDGETS[c.quality].maxVisible)throw RangeError('WATER-05 visual budget exceeded');
  return {schemaVersion:1,time,frame:time*60,emitters,counters,diagnostics:[]};
 }
 function bounds(frame,settings,anchors=null){
  const c=normalize(settings),out={inside:true,empty:true,
   minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const row of frame.emitters){
   const e=c.emitters.find(v=>v.id===row.id);
   if(!e)continue;
   for(const name of LAYERS){
    const layer=e.layers[name];
    const a=anchors?.[e.id]?.[name]?.origin||anchors?.[e.id]?.[name]||
     e.anchor;
    const ox=(a.x??0)+e.x+layer.x;
    const oy=(a.y??0)+e.y+layer.y;
    const theta=((a.angle||0)*180/Math.PI+e.rotation+layer.rotation)*Math.PI/180;
    const cs=Math.cos(theta),sn=Math.sin(theta);
    for(const item of row.layers[name]){
     const x=ox+item.x*cs-item.y*sn,y=oy+item.x*sn+item.y*cs;
     const r=item.radius+1;
     out.empty=false;
     out.minX=Math.min(out.minX,x-r);out.maxX=Math.max(out.maxX,x+r);
     out.minY=Math.min(out.minY,y-r);out.maxY=Math.max(out.maxY,y+r);
    }
   }
  }
  out.inside=out.empty||(out.minX>=0&&out.minY>=0&&out.maxX<=512&&out.maxY<=512);
  return out;
 }
 return Object.freeze({VERSION,LAYERS,BUDGETS,defaults,newEmitter,
  normalize,schedule,sample,bounds,random});
});