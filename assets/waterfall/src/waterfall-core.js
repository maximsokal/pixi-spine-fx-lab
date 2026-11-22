// WATER-04 independent deterministic waterfall source, CJS/UMD and ESM-exact export.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxWaterfall=api;
})(globalThis,function(Curves,Spacing,Path,Colors){
 'use strict';
 if(!Curves||!Spacing||!Path||!Colors)
  throw Error('WATER-04 requires FX-CORE 01/02/04/08');
 const VERSION=1,PERIOD=1,DEG=Math.PI/180,
  LAYERS=Object.freeze(['streams','fragments','baseSprayFoam']);
 const BUDGETS=Object.freeze({
  low:{segments:12,maxVertices:12000,maxTriangles:15000,
   maxFragments:240,maxFoam:120,maxCandidates:2048},
  balanced:{segments:24,maxVertices:42000,maxTriangles:49000,
   maxFragments:480,maxFoam:240,maxCandidates:4096},
  high:{segments:36,maxVertices:80000,maxTriangles:90000,
   maxFragments:900,maxFoam:480,maxCandidates:4096}
 });
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function finite(x,name,lo,hi,integer=false){
  if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi||
    (integer&&!Number.isInteger(x)))throw TypeError('WATER-04 invalid '+name);
  return x;
 }
 function strict(o,fields,name){
  if(!o||typeof o!=='object'||Array.isArray(o))throw TypeError('WATER-04 invalid '+name);
  for(const k of Object.keys(o))if(!fields.includes(k))
   throw TypeError('WATER-04 unknown '+name+'.'+k);
 }
 function hash(s){
  let x=2166136261;
  for(let i=0;i<s.length;i++)x=Math.imul(x^s.charCodeAt(i),16777619);
  return x|0;
 }
 function random(seed,index,stream=0){
  let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,values,valueUnit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit,inputRange:[0,1],valueRange:[0,3],
   defaultValue:values[0][1],clamp:'hold',monotonic:false,
   keys:values.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function anchor(type='world',x=0,y=0){
  return {type,space:'world',name:'',slot:'',x,y,rotation:0};
 }
 function newEmitter(index=0){
  const layer=(enabled,alpha,type)=>({
   enabled,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha,blend:'normal',
   anchor:anchor(type)});
  return {id:'emitter'+(index+1),name:'Waterfall '+(index+1),
   enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,seed:3481+index*139,
   anchor:anchor('world',256+index*30,64),
   layers:{streams:layer(true,.65,'inherit'),fragments:layer(true,.85,'inherit'),
    baseSprayFoam:layer(true,.6,'endpoint')}};
 }
 function defaults(){
  return {schemaVersion:1,mode:'loop',durationFrames:60,exportFrames:60,
   streamWidth:75,flowSpeed:180,strands:8,breakup:.4,foamRadius:45,
   turbulence:.35,strandGap:9,fragmentRate:30,breakupDistance:14,
   flowLength:300,seed:94147,quality:'balanced',style:'natural',
   spatialMode:'even',spatialJitter:0,
   sheetWidthCurve:curve('sheetWidth','pathPosition',[[0,.65],[.7,1],[1,1.2]]),
   flowTurbulenceCurve:curve('flowTurbulence','effectTime',[[0,.3],[.5,.7],[1,.3]]),
   sprayAlphaCurve:curve('sprayAlpha','particleAge',[[0,1],[1,0]]),
   fragmentRateCurve:curve('fragmentRate','effectTime',[[0,1],[.5,1],[1,1]]),
   breakupDistanceCurve:curve('breakupDistance','pathPosition',[[0,1],[.5,1],[1,1]]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'waterfallColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'upper',position:0,rgba:[237,249,255,.95]},
     {id:'middle',position:.5,rgba:[84,189,225,.85]},
     {id:'lower',position:1,rgba:[22,116,172,.55]}]}),
   emitters:[newEmitter(0)]};
 }
 const fields=Object.keys(defaults()),ranges={
  durationFrames:[40,60],exportFrames:[1,3600],streamWidth:[12,250],
  flowSpeed:[20,800],strands:[1,40],breakup:[0,1],foamRadius:[0,140],
  turbulence:[0,1],strandGap:[1,60],fragmentRate:[0,120],
  breakupDistance:[2,120],flowLength:[60,400],
  spatialJitter:[0,.45],seed:[-2147483648,2147483647]
 },integers=new Set(['durationFrames','exportFrames','strands','seed']);
 const anchorTypes=['inherit','endpoint','world','skeleton','bone','slot','attachment'];
 const anchorKeys=['type','space','name','slot','x','y','rotation'];
 const emitterKeys=['id','name','enabled','visible','x','y','rotation',
  'timeOffset','seed','anchor','layers'];
 const layerKeys=['enabled','visible','x','y','rotation','timeOffset','alpha','blend','anchor'];
 function validateAnchor(a,layer=false){
  strict(a,anchorKeys,'anchor');
  if(!anchorTypes.includes(a.type)||
    (!layer&&['inherit','endpoint'].includes(a.type))||
    !['world','local'].includes(a.space)||
    typeof a.name!=='string'||typeof a.slot!=='string'||
    (['bone','slot'].includes(a.type)&&!a.name.trim())||
    (a.type==='attachment'&&(!a.name.trim()||!a.slot.trim())))
   throw TypeError('WATER-04 invalid anchor');
  return {type:a.type,space:a.space,name:a.name,slot:a.slot,
   x:finite(a.x,'anchor.x',-10000,10000),
   y:finite(a.y,'anchor.y',-10000,10000),
   rotation:finite(a.rotation,'anchor.rotation',-360,360)};
 }
 function normalize(input){
  strict(input,fields,'settings');
  if(input.schemaVersion!==1)throw TypeError('WATER-04 unsupported schema version');
  const c={schemaVersion:1};
  for(const [key,[lo,hi]] of Object.entries(ranges))
   c[key]=finite(input[key],key,lo,hi,integers.has(key));
  if(!['loop','shutdown'].includes(input.mode))throw TypeError('WATER-04 invalid mode');
  c.mode=input.mode;
  if(c.durationFrames!==(c.mode==='loop'?60:40))
   throw TypeError('WATER-04 durationFrames must match loop 60 / shutdown 40');
  if((c.strands-1)*c.strandGap>c.streamWidth+1e-9)
   throw RangeError('WATER-04 strand gap exceeds stream width; reduce strands/gap or enlarge sheet');
  for(const [key,values] of Object.entries({
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical'],
   spatialMode:['even','random','clustered']})){
   if(!values.includes(input[key]))throw TypeError('WATER-04 invalid '+key);
   c[key]=input[key];
  }
  for(const [field,name,domain] of [
   ['sheetWidthCurve','sheetWidth','pathPosition'],
   ['flowTurbulenceCurve','flowTurbulence','effectTime'],
   ['sprayAlphaCurve','sprayAlpha','particleAge'],
   ['fragmentRateCurve','fragmentRate','effectTime'],
   ['breakupDistanceCurve','breakupDistance','pathPosition']]){
   const v=Curves.normalize(input[field]);
   if(v.parameterKey!==name||v.domain!==domain||v.valueUnit!=='multiplier')
    throw TypeError('WATER-04 incompatible '+field);
   c[field]=v;
  }
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='waterfallColor'||c.palette.domain!=='particleAge')
   throw TypeError('WATER-04 invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('WATER-04 max 4 emitters');
  const ids=new Set();c.emitters=[];
  for(const e of input.emitters){
   strict(e,emitterKeys,'emitter');
   if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||
    ids.has(e.id))throw TypeError('WATER-04 duplicate emitter id');
   ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>128)
    throw TypeError('WATER-04 invalid emitter name');
   if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')
    throw TypeError('WATER-04 invalid emitter visible/enabled');
   const v={id:e.id,name:e.name,enabled:e.enabled,visible:e.visible,
    x:finite(e.x,'emitter.x',-10000,10000),
    y:finite(e.y,'emitter.y',-10000,10000),
    rotation:finite(e.rotation,'emitter.rotation',-360,360),
    timeOffset:finite(e.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:finite(e.seed,'emitter.seed',-2147483648,2147483647,true),
    anchor:validateAnchor(e.anchor),layers:{}};
   strict(e.layers,LAYERS,'emitter layers');
   if(Object.keys(e.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('WATER-04 requires exactly three layers');
   for(const kind of LAYERS){
    const l=e.layers[kind];strict(l,layerKeys,kind);
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
      !['normal','add'].includes(l.blend))
     throw TypeError('WATER-04 invalid layer '+kind);
    v.layers[kind]={enabled:l.enabled,visible:l.visible,
     x:finite(l.x,kind+'.x',-10000,10000),
     y:finite(l.y,kind+'.y',-10000,10000),
     rotation:finite(l.rotation,kind+'.rotation',-360,360),
     timeOffset:finite(l.timeOffset,kind+'.timeOffset',-3600,3600,true),
     alpha:finite(l.alpha,kind+'.alpha',0,1),blend:l.blend,
     anchor:validateAnchor(l.anchor,true)};
   }
   c.emitters.push(v);
  }
  if(c.emitters.length*c.strands>120&&c.quality==='low')
   throw RangeError('WATER-04 quality strand budget exceeded');
  return c;
 }
 const plans=new Map();
 function memo(k,create){
  if(plans.has(k))return plans.get(k);
  const v=create();
  if(plans.size>=24)plans.delete(plans.keys().next().value);
  plans.set(k,v);return v;
 }
 function scheduleConfig(c,e){
  const key=JSON.stringify([c.streamWidth,c.strands,c.strandGap,c.fragmentRate,
   c.fragmentRateCurve,c.breakupDistance,c.breakupDistanceCurve,c.flowLength,
   c.spatialMode,c.spatialJitter,c.seed,e.seed,e.id]);
  return memo(key,()=>{
   const spread=(c.strands-1)*c.strandGap,slack=c.streamWidth-spread,
    extra=c.strands>1?slack*.16/(c.strands-1):0;
   const positions=Array.from({length:c.strands},(_,i)=>
    (i-(c.strands-1)/2)*(c.strandGap+extra));
   const seed=(c.seed^e.seed^hash(e.id))|0;
   const rateCurve=Curves.normalize({...c.fragmentRateCurve,
    parameterKey:'emissionRate',domain:'emitterTime'});
   const temporal=Spacing.createTemporalSchedule({
    schemaVersion:1,mode:'custom',frequencySource:'rate',
    baseRate:c.fragmentRate,interval:c.fragmentRate?1/c.fragmentRate:1,
    duration:PERIOD,minInterval:0,jitter:0,burstCount:1,burstDelay:0,
    seed,maxEvents:256,rateCurve,intervalCurve:null});
   if(temporal.capped)throw RangeError('WATER-04 temporal schedule budget exceeded');
   const spatialCurve=Curves.normalize({...c.breakupDistanceCurve,
    parameterKey:'spacingPx',valueUnit:'px',valueRange:[0,500],
    defaultValue:c.breakupDistance*c.breakupDistanceCurve.defaultValue,
    keys:c.breakupDistanceCurve.keys.map(k=>({...k,y:k.y*c.breakupDistance}))});
   const p={schemaVersion:1,closed:false,segments:[
    {p0:[0,0],p1:[0,c.flowLength/3],
     p2:[0,2*c.flowLength/3],p3:[0,c.flowLength]}]};
   const placed=Spacing.createSpatialPlacement({schemaVersion:1,path:p,
    baseSpacingPx:c.breakupDistance,minSpacing:1,maxSpacing:360,
    spacingCurve:spatialCurve,mode:c.spatialMode,jitter:c.spatialJitter,
    seed,maxPoints:512,alignToTangent:true,pathFollow:'clamp',
    tolerancePx:.25});
   if(placed.capped)throw RangeError('WATER-04 spatial placement budget exceeded');
   return {events:temporal.events.map(v=>({...v,
      time:v.time-(temporal.events[0]?.time||0)})),
    positions,distancePositions:placed.points.map(v=>v.distance),
    arcErrorBound:placed.table.errorBound,sourceId:e.id};
  });
 }
 function schedule(settings,emitter){
  const c=normalize(settings),e=c.emitters.find(x=>x.id===emitter.id);
  if(!e)throw Error('WATER-04 emitter not present');
  return scheduleConfig(c,e);
 }
 function color(c,u,opacity,i,seed){
  const col=Colors.sample(c.palette,clamp(u,0,1)),
   style=c.style==='natural'?[1,1,1]:
    c.style==='stylized'?[1.04,1.10,1.14]:[1.20,.87,1.30];
  return col.slice(0,3).map((v,j)=>clamp(v*style[j],0,255))
   .concat([clamp(col[3]*opacity*(.94+.06*random(seed,i,991)),0,1)]);
 }
 function wave(c,e,index,d,t){
  const amplitude=c.turbulence*12*
   Curves.evaluate(c.flowTurbulenceCurve,t)*Math.sin(Math.PI*d/c.flowLength);
  return amplitude*Math.sin(2*Math.PI*(d/(Math.max(20,c.flowSpeed)*1)-t)+
   index*1.714+e.seed*.001);
 }
 function ribbon(c,e,index,plan,t){
  const y0=0,len=c.flowLength,level=c.quality,
   N=BUDGETS[level].segments,baseX=plan.positions[index],
   pieces=4,segs=[];
  function point(d){
   return [baseX+wave(c,e,index,d,t),d];
  }
  for(let n=0;n<pieces;n++){
   const a=n*len/pieces,b=(n+1)*len/pieces,m=(b-a)/3;
   segs.push({p0:point(a),p1:point(a+m),p2:point(b-m),p3:point(b)});
  }
  const path={schemaVersion:1,closed:false,segments:segs},
   baseWidth=Math.max(.7,Math.min(9,c.streamWidth/c.strands*.58,
    (c.strands>1?c.strandGap:100)*.75)),
   widthCurve=Curves.normalize({...c.sheetWidthCurve,
    parameterKey:'widthMultiplier',valueUnit:'normalized'});
  const shape=Path.buildRibbon({path,width:{start:baseWidth,middle:baseWidth,
    end:baseWidth,minVisiblePx:0,startTaper:0,endTaper:0,
    curve:widthCurve},quality:level,sampleSpacingPx:len/N,
   edgeIrregularity:0,seed:c.seed^e.seed^index,miterLimit:2});
  // Dynamic intermittent detachment gaps along the downstream path, with
  // periodic world-distance advection and stable per-stream hash.
  const pos=shape.positions;
  if(c.breakup>0&&shape.samples.length>0){
   const periodBins=12,stripe= c.flowSpeed/periodBins;
   const seed=c.seed^e.seed^hash(e.id)^index;
   for(let i=0;i<shape.samples.length;i++){
    const s=shape.samples[i],trav=(s.distance-c.flowSpeed*t)/stripe;
    const bin=((Math.floor(trav)%periodBins)+periodBins)%periodBins,
     frac=trav-Math.floor(trav),chance=random(seed,bin,101);
    if(chance>=c.breakup)continue;
    const soft=clamp((Math.abs(frac-.5)-.22)/.12,0,1);
    const keep=soft*soft*(3-2*soft);
    const at=i*4,x1=pos[at],y1=pos[at+1],x2=pos[at+2],y2=pos[at+3];
    const midX=(x1+x2)*.5,midY=(y1+y2)*.5;
    pos[at]=midX+(x1-midX)*keep;pos[at+1]=midY+(y1-midY)*keep;
    pos[at+2]=midX+(x2-midX)*keep;pos[at+3]=midY+(y2-midY)*keep;
   }
  }
  // Repeat-friendly animated stream brightness from true moving geometry.
  const pulse=.84+.16*Math.sin(2*Math.PI*t+index*2.3);
  return {kind:'ribbon',id:e.id+'-strand-'+index,index,x:0,y:0,
   positions:pos,uvs:shape.uvs,indices:shape.indices,
   endpoint:{x:baseX,y:len},rgba:color(c,index/Math.max(1,c.strands-1),
    c.emitters[0]?pulse:1,index,c.seed^e.seed)};
 }
 function shutdownEnvelope(c,time){
  if(c.mode==='loop')return 1;
  if(time>=39/60)return 0;
  return clamp((39/60-time)/(6/60),0,1);
 }
 function inLayer(c,e,kind,time,plan){
  const layer=e.layers[kind];
  if(!e.enabled||!e.visible||!layer.enabled||!layer.visible||!layer.alpha)
   return [];
  const local=(time-(e.timeOffset+layer.timeOffset)/60);
  const periodic=((local%1)+1)%1,t=Math.round(periodic*1e9)/1e9;
  const global=shutdownEnvelope(c,time);
  if(global===0)return [];
  const seed=(c.seed^e.seed^hash(e.id))|0;
  if(kind==='streams')return plan.positions.map((_,i)=>{
   const v=ribbon(c,e,i,plan,t);
   v.rgba[3]*=layer.alpha*global;
   return v;
  });
  if(kind==='baseSprayFoam'&&c.foamRadius===0)return [];
  if(kind==='fragments'&&c.breakup===0)return [];
  const result=[],lifetime=c.flowLength/c.flowSpeed,
   cycles=Math.ceil(lifetime+.6)+1;
  if(cycles*plan.events.length>BUDGETS[c.quality].maxCandidates)
   throw RangeError('WATER-04 candidate event history budget exceeded');
  for(let back=0;back<=cycles;back++)
   for(const ev of plan.events){
    // The history is evaluated at the same canonical period for every
    // absolute seek. Repeat phase at t=0 and t=1 is bitwise identical.
    const birth=ev.time-back,age=t-birth;
    if(age<0)continue;
    const idx=ev.index,
     strand=idx%c.strands,
     originDist=plan.distancePositions[idx%Math.max(1,plan.distancePositions.length)]||0,
     x0=plan.positions[strand]+
      (random(seed,idx,219)-.5)*c.strandGap*.5,
     d=originDist+c.flowSpeed*age;
    if(random(seed,idx,401)>=c.breakup)continue;
    const wobble=c.turbulence*4*
     Math.sin(2*Math.PI*(t+idx*.141))*
     Math.sin(Math.PI*clamp(d/c.flowLength,0,1));
    if(kind==='fragments'&&d<c.flowLength&&age<lifetime){
     const u=clamp(d/c.flowLength,0,1);
     result.push({kind:'drop',id:e.id+'-drop-'+idx+'-'+back,index:idx,
      cycle:-back,x:x0+wobble,y:d,
      radius:1.5+random(seed,idx,91)*2.5,
      rotation:.07*Math.sin(idx+t*2*Math.PI),
      bornAt:birth,age,
      rgba:color(c,u,layer.alpha*global*(.78-.25*u),idx,seed)});
    }else if(kind==='baseSprayFoam'&&d>=c.flowLength){
     const after=(d-c.flowLength)/c.flowSpeed;
     if(after<0||after>=.36)continue;
     const life=after/.36,alpha=Curves.evaluate(c.sprayAlphaCurve,life);
     if(alpha<=0)continue;
     const side=(random(seed,idx,319)*2-1),
      x=x0+side*c.foamRadius*(.15+.85*life),
      y=c.flowLength+(random(seed,idx,327)-.5)*c.foamRadius*.5-
       c.foamRadius*life*.17;
     result.push({kind:'foam',id:e.id+'-foam-'+idx+'-'+back,
      index:idx,cycle:-back,x,y,
      radius:Math.max(.5,2+c.foamRadius*.08*
       (.3+.7*random(seed,idx,504))*(1-life)),
      age:life,rgba:color(c,life,
       layer.alpha*global*alpha*.45,idx,seed)});
    }
   }
  return result.sort((a,b)=>a.bornAt-b.bornAt||a.index-b.index);
 }
 function sample(settings,seconds){
  const c=normalize(settings);
  finite(seconds,'time',0,1e8);
  const time=c.mode==='loop'?Math.round((seconds%PERIOD)*1e9)/1e9:seconds,
   emitters=[],counters={vertices:0,triangles:0,fragments:0,foam:0,
    ribbons:0,scheduled:0};
  for(const e of c.emitters){
   if(!e.enabled||!e.visible)continue;
   const plan=scheduleConfig(c,e),layers={};
   counters.scheduled+=plan.events.length;
   for(const kind of LAYERS){
    const items=inLayer(c,e,kind,time,plan);layers[kind]=items;
    if(kind==='streams')for(const shape of items){
     counters.ribbons++;counters.vertices+=shape.positions.length/2;
     counters.triangles+=shape.indices.length/3;
    }
    else counters[kind==='fragments'?'fragments':'foam']+=items.length;
   }
   emitters.push({id:e.id,layers});
  }
  const max=BUDGETS[c.quality];
  for(const [k,cap] of [['vertices',max.maxVertices],
   ['triangles',max.maxTriangles],['fragments',max.maxFragments],
   ['foam',max.maxFoam]]){
   if(counters[k]>cap)throw RangeError('WATER-04 quality '+k+
     ' budget exceeded '+counters[k]+' > '+cap);
  }
  return {schemaVersion:1,time,frame:time*60,emitters,counters,
   diagnostics:[]};
 }
 function bounds(frame,settings,anchors=null){
  const c=normalize(settings),out={inside:true,empty:true,
   minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  const visit=(x,y,rad=0)=>{
   out.empty=false;
   out.minX=Math.min(out.minX,x-rad);out.maxX=Math.max(out.maxX,x+rad);
   out.minY=Math.min(out.minY,y-rad);out.maxY=Math.max(out.maxY,y+rad);
  };
  for(const row of frame.emitters){
   const e=c.emitters.find(x=>x.id===row.id);
   const base=anchors?.[e.id]||e.anchor;
   for(const kind of LAYERS){
    const l=e.layers[kind];
    const p=anchors?.[e.id]?.[kind]||base;
    const ox=(p.x??e.anchor.x)+e.x+l.x,
     oy=(p.y??e.anchor.y)+e.y+l.y+
      (kind==='baseSprayFoam'&&l.anchor.type==='endpoint'?c.flowLength:0),
     rot=(e.rotation+l.rotation)*DEG,cs=Math.cos(rot),sn=Math.sin(rot);
    const check=(x,y,rad=0)=>visit(ox+x*cs-y*sn,oy+x*sn+y*cs,rad);
    for(const item of row.layers[kind]){
     if(item.kind==='ribbon'){
      for(let i=0;i<item.positions.length;i+=2)
       check(item.positions[i],item.positions[i+1],2);
     }else check(item.x,item.y-
      (kind==='baseSprayFoam'&&l.anchor.type==='endpoint'?c.flowLength:0),
      item.radius+2);
    }
   }
  }
  out.inside=out.empty||
   out.minX>=0&&out.minY>=0&&out.maxX<=512&&out.maxY<=512;
  return out;
 }
 return Object.freeze({VERSION,LAYERS,BUDGETS,defaults,newEmitter,
  normalize,schedule,sample,bounds,random});
});
