// FIRE-06 renderer-independent real background refraction field and coverage.
// Effect-relative 512x512 logical pixels; deterministic absolute-time lattice/pulses.
// Preview, PNG data exports and WebGL/WebGPU developer handoffs share this code.
(function(root,create){
 'use strict';
 const core=Object.freeze(create(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=core;else root.FxHaze=core;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('Haze requires FxCurves/FxSpacing/FxColors v1');
 const PI=Math.PI,TAU=2*PI,WIDTH=512,LAYERS=Object.freeze(['refraction','thermalGlow']);
 const QUALITY=Object.freeze({low:{fieldSize:128,maxNodes:128},balanced:{fieldSize:256,maxNodes:256},
  high:{fieldSize:512,maxNodes:512}});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function check(n,name,a,b,integer=false){
  if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b||
      (integer&&!Number.isInteger(n)))throw TypeError('Haze invalid '+name);
  return n;
 }
 function strict(x,fields,label){
  if(!x||typeof x!=='object'||Array.isArray(x))throw TypeError('Haze invalid '+label);
  for(const k of Object.keys(x))if(!fields.includes(k))
   throw TypeError('Haze unexpected '+label+'.'+k);
 }
 function hash(str){
  let n=2166136261;for(let i=0;i<str.length;i++)n=Math.imul(n^str.charCodeAt(i),16777619);
  return n|0;
 }
 function random(seed,index,stream=0){
  let x=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b);
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,points,limits,unit='multiplier'){
  const inputUnit=domain==='pathPosition'?'normalized-path':'normalized-duration';
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit,
   valueUnit:unit,inputRange:[0,1],valueRange:limits,defaultValue:points[0][1],
   clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function defaultPath(){
  return {schemaVersion:1,closed:false,segments:[{
   p0:[0,0],p1:[-4,-58],p2:[6,-142],p3:[0,-200]
  }]};
 }
 function newEmitter(index=0){
  return {id:'emitter'+(index+1),name:'Heat '+(index+1),enabled:true,visible:true,
   x:index*40,y:0,rotation:0,timeOffset:0,seed:1979+index*103,
   amplitudeScale:1,anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:390,rotation:0},
   path:defaultPath(),
   layers:{
    refraction:{enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:1,blend:'normal'},
    thermalGlow:{enabled:false,visible:true,x:0,y:0,rotation:0,timeOffset:0,alpha:.5,blend:'add'}
   }};
 }
 function defaults(){
  return {schemaVersion:1,mode:'loop',durationFrames:120,stopFrame:60,fadeFrames:60,
   exportFrames:120,seed:407,amplitude:8,noiseFrequency:.035,verticalFlow:25,
   regionWidth:90,edgeFalloff:18,pulseRate:1.5,pulseJitter:.12,
   gustEnabled:false,gustRate:.5,gustJitter:0,
   nodeGap:28,nodeJitter:.12,spatialMode:'even',
   density:1,quality:'balanced',style:'natural',
   distortionCurve:curve('distortionStrength','effectTime',
     [[0,.65],[.3,1],[.65,.7],[1,.65]],[0,2]),
   edgeCurve:curve('edgeSoftness','pathPosition',[[0,0],[.2,1],[.8,1],[1,0]],[0,1]),
   pulseCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,3]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'hazeGlow',
    domain:'effectTime',inputUnit:'normalized-duration',space:'srgb',clamp:'hold',
    stops:[{id:'start',position:0,rgba:[255,255,255,0]},
           {id:'mid',position:.5,rgba:[255,253,234,.45]},
           {id:'end',position:1,rgba:[255,255,255,0]}]}),
   emitters:[newEmitter(0)]};
 }
 const expected=Object.keys(defaults());
 const ranges={
  durationFrames:[1,1200],stopFrame:[1,600],fadeFrames:[1,600],
  exportFrames:[1,3600],seed:[-2147483648,2147483647],
  amplitude:[0,32],noiseFrequency:[.005,.2],verticalFlow:[-100,150],
  regionWidth:[10,350],edgeFalloff:[0,100],
  pulseRate:[0,12],pulseJitter:[0,.45],gustRate:[0,5],gustJitter:[0,.45],
  nodeGap:[.25,100],nodeJitter:[0,.45],density:[0,1]
 };
 const intFields=new Set(['durationFrames','stopFrame','fadeFrames','exportFrames','seed']);
 function normalize(input){
  strict(input,expected,'settings');
  if(input.schemaVersion!==1)throw TypeError('Haze invalid settings version');
  const cfg={schemaVersion:1};
  for(const [k,[a,b]] of Object.entries(ranges))
   cfg[k]=check(input[k],k,a,b,intFields.has(k));
  for(const [key,allowed] of Object.entries({
   mode:['loop','stop'],quality:['low','balanced','high'],
   style:['natural','stylized','magical'],spatialMode:['even','random','clustered']})){
   if(!allowed.includes(input[key]))throw TypeError('Haze unsupported '+key);
   cfg[key]=input[key];
  }
  if(typeof input.gustEnabled!=='boolean')throw TypeError('Haze gustEnabled');
  cfg.gustEnabled=input.gustEnabled;
  if(cfg.mode==='stop'&&cfg.stopFrame+cfg.fadeFrames!==cfg.durationFrames)
   throw TypeError('Haze stop/fade duration must include both complete phases');
  for(const [key,name,domain] of [
   ['distortionCurve','distortionStrength','effectTime'],
   ['edgeCurve','edgeSoftness','pathPosition'],
   ['pulseCurve','emissionRate','emitterTime']]){
   const v=Curves.normalize(input[key]);
   if(v.parameterKey!==name||v.domain!==domain||v.valueUnit!=='multiplier')
    throw TypeError('Haze invalid curve '+key);
   cfg[key]=v;
  }
  cfg.palette=Colors.normalize(input.palette);
  if(cfg.palette.parameterKey!=='hazeGlow'||cfg.palette.domain!=='effectTime')
   throw TypeError('Haze wrong gradient domain');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('Haze permits zero to four emitters');
  cfg.emitters=[];const ids=new Set();
  for(const item of input.emitters){
   strict(item,['id','name','enabled','visible','x','y','rotation','timeOffset','seed',
    'amplitudeScale','anchor','path','layers'],'emitter');
   if(typeof item.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(item.id)||
       ids.has(item.id))throw TypeError('Haze duplicate/invalid emitter ID');
   ids.add(item.id);
   if(typeof item.name!=='string'||!item.name.trim()||item.name.length>128)
    throw TypeError('Haze invalid emitter name');
   if(typeof item.enabled!=='boolean'||typeof item.visible!=='boolean')
    throw TypeError('Haze invalid emitter visibility');
   const e={id:item.id,name:item.name,enabled:item.enabled,visible:item.visible,
    x:check(item.x,'emitter.x',-10000,10000),y:check(item.y,'emitter.y',-10000,10000),
    rotation:check(item.rotation,'emitter.rotation',-360,360),
    timeOffset:check(item.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:check(item.seed,'emitter.seed',-2147483648,2147483647,true),
    amplitudeScale:check(item.amplitudeScale,'emitter.amplitudeScale',0,3)};
   const a=item.anchor;
   strict(a,['type','space','name','slot','x','y','rotation'],'anchor');
   if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
      !['world','local'].includes(a.space)||typeof a.name!=='string'||
      typeof a.slot!=='string'||a.name.length>128||a.slot.length>128||
      (['bone','slot','attachment'].includes(a.type)&&!a.name.trim())||
      (a.type==='attachment'&&!a.slot.trim()))throw TypeError('Haze invalid anchor');
   e.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:check(a.x,'anchor.x',-10000,10000),y:check(a.y,'anchor.y',-10000,10000),
    rotation:check(a.rotation,'anchor.rotation',-360,360)};
   e.path=Spacing.normalizePath(item.path);
   if(e.path.closed)throw TypeError('Haze path must be an open rising centerline');
   if(!item.layers||Object.keys(item.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('Haze needs two independently owned layers');
   e.layers={};
   for(const key of LAYERS){
    const layer=item.layers[key];strict(layer,
     ['enabled','visible','x','y','rotation','timeOffset','alpha','blend'],'layer');
    if(typeof layer.enabled!=='boolean'||typeof layer.visible!=='boolean'||
       !['normal','add'].includes(layer.blend))
     throw TypeError('Haze invalid '+key+' layer');
    e.layers[key]={enabled:layer.enabled,visible:layer.visible,
     x:check(layer.x,'layer.x',-10000,10000),
     y:check(layer.y,'layer.y',-10000,10000),
     rotation:check(layer.rotation,'layer.rotation',-360,360),
     timeOffset:check(layer.timeOffset,'layer.timeOffset',-3600,3600,true),
     alpha:check(layer.alpha,'layer.alpha',0,1),blend:layer.blend};
   }
   cfg.emitters.push(e);
  }
  return cfg;
 }
 const normTime=(t,p)=>Math.round(((t%p)+p)%p*1e9)/1e9;
 function pulseSchedule(cfg,e,kind='pulse'){
  const period=cfg.durationFrames/60,rate=kind==='gust'?cfg.gustRate:cfg.pulseRate,
   jitter=kind==='gust'?cfg.gustJitter:cfg.pulseJitter,
   seed=(cfg.seed^e.seed^hash(e.id)^(kind==='gust'?0x77318413:0x6b217ad3))|0;
  if(!rate)return [];
  const entries=Spacing.createTemporalSchedule({schemaVersion:1,mode:kind==='gust'?'uniform':'custom',
   frequencySource:'rate',baseRate:rate,interval:1/rate,duration:period,
   minInterval:0,jitter,burstCount:1,burstDelay:0,seed,maxEvents:64,
   rateCurve:kind==='gust'?null:cfg.pulseCurve,intervalCurve:null}).events;
  // The 120f source period closes at frame120; the endpoint event is frame0.
  const events=entries.filter(x=>x.time>1e-8&&x.time<period-1e-7)
   .map(x=>x.time);
  if(entries.some(x=>x.time>=period-1e-7))events.push(0);
  return events.sort((a,b)=>a-b);
 }
 function pulseWeight(events,t,p,spread){
  if(!events.length)return .75;
  let sum=0;
  for(const event of events){
   const diff=Math.abs(event-t),dist=Math.min(diff,Math.abs(diff-p));
   sum=Math.max(sum,Math.exp(-Math.pow(dist/spread,2)));
  }
  return .62+.38*sum;
 }
 function makeGeometry(cfg,e,layer,kind,origin){
  if(!layer.enabled||!layer.visible||layer.alpha<=0||!e.enabled||!e.visible||
      !origin)return null;
  const angle=(e.rotation+e.anchor.rotation+layer.rotation)*PI/180;
  const co=Math.cos(angle),si=Math.sin(angle);
  const anchorX=origin.x+e.x+layer.x,anchorY=origin.y+e.y+layer.y;
  const table=Spacing.buildArcTable(e.path,{tolerancePx:.25});
  if(!table.length)return null;
  const points=[];
  for(let i=0;i<=48;i++){
   const p=Spacing.pointAtDistance(table,table.length*i/48);
   points.push({x:anchorX+p.x*co-p.y*si,
    y:anchorY+p.x*si+p.y*co,u:i/48,dist:p.distance});
  }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of points){
   minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
   maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  const radius=cfg.regionWidth/2;
  const fullBounds={minX:minX-radius,minY:minY-radius,
   maxX:maxX+radius,maxY:maxY+radius};
  const bbox={minX:clamp(Math.floor(fullBounds.minX-1),0,512),
   minY:clamp(Math.floor(fullBounds.minY-1),0,512),
   maxX:clamp(Math.ceil(fullBounds.maxX+1),0,512),
   maxY:clamp(Math.ceil(fullBounds.maxY+1),0,512)};
  const seed=(cfg.seed^e.seed^hash(e.id))|0;
  const placement=Spacing.createSpatialPlacement({schemaVersion:1,path:e.path,
   baseSpacingPx:cfg.nodeGap,minSpacing:.25,maxSpacing:100,
   jitter:cfg.nodeJitter,mode:cfg.spatialMode,seed,maxPoints:QUALITY[cfg.quality].maxNodes,
   alignToTangent:false,pathFollow:'clamp',spacingCurve:null});
  // Interpolated deterministic node phases; positions actually depend on gap/mode/jitter.
  const nodes=[{distance:0,phase:random(seed,0,71)*TAU},
   ...placement.points.map((n,i)=>({distance:n.distance,phase:random(seed,i+1,71)*TAU}))];
  return {cfg,e,layer,kind,origin,angle,co,si,points,table,seed,bbox,fullBounds,nodes,
   placementCapped:placement.capped};
 }
 function prepare(input,time,anchors=null){
  const cfg=normalize(input),period=cfg.durationFrames/60;
  const raw=check(time,'timeSeconds',0,1e7);
  const t=cfg.mode==='loop'?normTime(raw,period):raw;
  const end=cfg.mode==='stop'&&t>=(cfg.durationFrames-1)/60;
  const fade=cfg.mode==='loop'?1:
   clamp(1-(t-cfg.stopFrame/60)/Math.max(1/60,(cfg.fadeFrames-1)/60),0,1);
  const emitters=[],missing=[],geometries=[],caps=[];
  for(const e of cfg.emitters){
   const origin=anchors?anchors[e.id]:(e.anchor.type==='world'?
    {x:e.anchor.x,y:e.anchor.y}:null);
   if(!origin&&e.enabled)missing.push(e.id);
   const pulses=pulseSchedule(cfg,e,'pulse'),gusts=cfg.gustEnabled?
    pulseSchedule(cfg,e,'gust'):[];
   const entry={id:e.id,origin,pulses,gusts,refraction:null,thermalGlow:null};
   emitters.push(entry);
   for(const kind of LAYERS){
    const g=makeGeometry(cfg,e,e.layers[kind],kind,origin);
    if(g){
     entry[kind]=g;geometries.push(g);
     if(g.placementCapped)caps.push(e.id+': '+kind+' spatial nodes capped');
    }
   }
  }
  return {cfg,period,time:t,rawTime:raw,fade,end,emitters,geometries,
   missing,caps,quality:QUALITY[cfg.quality]};
 }
 function closestPoint(g,x,y){
  const p=g.points;let best=Infinity,u=0,along=0,lateral=0;
  for(let i=1;i<p.length;i++){
   const a=p[i-1],b=p[i],vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;
   const f=den>1e-10?clamp(((x-a.x)*vx+(y-a.y)*vy)/den,0,1):0;
   const dx=x-a.x-f*vx,dy=y-a.y-f*vy,d=dx*dx+dy*dy;
   if(d<best){best=d;u=a.u+(b.u-a.u)*f;
    along=a.dist+(b.dist-a.dist)*f;
    lateral=(-dy*vx+dx*vy)/Math.sqrt(Math.max(den,1e-10));}
  }
  return {distance:Math.sqrt(best),u,along,lateral};
 }
 const smooth=u=>{const c=clamp(u,0,1);return c*c*(3-2*c)};
 function interpolateNodes(g,along){
  const n=g.nodes;if(n.length===1)return n[0].phase;
  let i=1;while(i<n.length-1&&n[i].distance<along)i++;
  const a=n[i-1],b=n[i];
  const f=smooth((along-a.distance)/Math.max(1e-6,b.distance-a.distance));
  return a.phase*(1-f)+b.phase*f;
 }
 function noise(g,x,y,time,period){
  const f=g.cfg.noiseFrequency*(g.cfg.style==='stylized'?1.25:
   g.cfg.style==='magical'?.8:1);
  const localX=(x-g.origin.x)*g.co+(y-g.origin.y)*g.si;
  const localY=-(x-g.origin.x)*g.si+(y-g.origin.y)*g.co;
  const u=time/period,w=smooth(u),speed=g.cfg.verticalFlow;
  const phase=g.seed*.000013;
  const base=(ly,node)=>.58*Math.sin((localX*f+ly*f*.39)*TAU+phase+node)*
       Math.cos((ly*f+localX*f*.17)*TAU-node*.35)+
       .27*Math.sin((localX*f*.61-ly*f*1.31)*TAU-phase*2);
  return (node)=>clamp((1-w)*base(localY-speed*time,node)+
   w*base(localY-speed*(time-period),node),-1,1);
 }
 function sampleAt(prepared,x,y){
  const {cfg,time,period}=prepared;
  let dx=0,dy=0,alpha=0,glow=[0,0,0,0],active=0;
  if(prepared.end)return {dx:0,dy:0,coverage:0,glow,active};
  const progress=clamp(time/period,0,1),
   curve=Curves.evaluate(cfg.distortionCurve,progress),
   color=Colors.sample(cfg.palette,progress);
  const half=cfg.regionWidth/2,
   softness=Math.min(cfg.edgeFalloff,half);
  for(const item of prepared.emitters){
   const e=cfg.emitters.find(x=>x.id===item.id);
   for(const kind of LAYERS){
    const g=item[kind];if(!g)continue;
    const b=g.bbox;if(x<b.minX||x>b.maxX||y<b.minY||y>b.maxY)continue;
    const nearest=closestPoint(g,x,y);
    if(nearest.distance>half)continue;
    const radial=softness===0?1:clamp((half-nearest.distance)/softness,0,1);
    const edge=Curves.evaluate(cfg.edgeCurve,nearest.u);
    const coverage=clamp(radial*edge*cfg.density*g.layer.alpha*prepared.fade,0,1);
    if(coverage<=0)continue;
    const local=normTime(time-(e.timeOffset+g.layer.timeOffset)/60,period);
    if(kind==='refraction'){
     if(!cfg.amplitude||!e.amplitudeScale)continue;
     const node=interpolateNodes(g,nearest.along);
     const field=noise(g,x,y,local,period)(node);
     const pulse=pulseWeight(item.pulses,local,period,.17);
     const gust=cfg.gustEnabled?1+.4*(pulseWeight(item.gusts,local,period,.23)-.62):1;
     const magnitude=cfg.amplitude*e.amplitudeScale*curve*pulse*gust;
     dx+=magnitude*field*.9;
     dy+=magnitude*(Math.sin(node+local*TAU/period+nearest.along*.045)*.42);
     alpha=1-(1-alpha)*(1-coverage);
     active++;
    }else{
     const outAlpha=clamp(coverage*color[3]*.55,0,1);
     if(outAlpha>0){
      const outRGB=[color[0],color[1],color[2]];
      const newA=outAlpha+glow[3]*(1-outAlpha);
      if(newA>0){
       for(let c=0;c<3;c++)glow[c]=(outRGB[c]*outAlpha+
        glow[c]*glow[3]*(1-outAlpha))/newA;
       glow[3]=newA;
      }
      active++;
     }
    }
   }
  }
  const length=Math.hypot(dx,dy);
  if(length>32){dx*=32/length;dy*=32/length}
  // Zero amplitude => zero mask: exact unchanged source, not approx 128/255.
  return {dx,dy,coverage:cfg.amplitude>0?alpha:0,glow,active};
 }
 function rasterize(input,time,anchors=null){
  const state=prepare(input,time,anchors),
   rgba=new Uint8ClampedArray(WIDTH*WIDTH*4),
   mask=new Uint8ClampedArray(WIDTH*WIDTH*4),
   glow=new Uint8ClampedArray(WIDTH*WIDTH*4);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=128;rgba[i+1]=128;
   rgba[i+2]=0;rgba[i+3]=255}
  const bounds=state.geometries.filter(g=>g.layer.alpha>0);
  if(!bounds.length||state.end)return {state,map:rgba,mask,glow,changedPixels:0};
  const minX=Math.max(0,Math.min(...bounds.map(g=>g.bbox.minX))),
   maxX=Math.min(511,Math.max(...bounds.map(g=>g.bbox.maxX))),
   minY=Math.max(0,Math.min(...bounds.map(g=>g.bbox.minY))),
   maxY=Math.min(511,Math.max(...bounds.map(g=>g.bbox.maxY)));
  let changedPixels=0;
  const step=512/state.quality.fieldSize; // low:4, balanced:2, high:1
  for(let y=minY;y<=maxY;y+=step)for(let x=minX;x<=maxX;x+=step){
   const sample=sampleAt(state,x+step/2,y+step/2);
   const a=clamp(Math.round(sample.coverage*255),0,255);
   for(let iy=y;iy<Math.min(512,y+step);iy++)
    for(let ix=x;ix<Math.min(512,x+step);ix++){
     const i=(iy*512+ix)*4;
     if(a>0){
      rgba[i]=clamp(Math.round(128+sample.dx*127/32),1,255);
      rgba[i+1]=clamp(Math.round(128+sample.dy*127/32),1,255);
      rgba[i+2]=a; // B is the alpha coverage / bypass mask, never RGB overlay.
      mask[i]=255;mask[i+1]=255;mask[i+2]=255;mask[i+3]=a;
      changedPixels++;
     }
     if(sample.glow[3]>0){
      for(let c=0;c<3;c++)glow[i+c]=Math.round(sample.glow[c]);
      glow[i+3]=Math.round(sample.glow[3]*255);
     }
    }
  }
  return {state,map:rgba,mask,glow,changedPixels};
 }
 return Object.freeze({VERSION:1,WIDTH,QUALITY,LAYERS,defaults,newEmitter,
  normalize,prepare,pulseSchedule,closestPoint,sampleAt,rasterize,random});
});
