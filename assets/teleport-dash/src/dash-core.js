// GAME-07 T01: deterministic motion and historical echo descriptors; no renderer ownership.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDash=api;
})(globalThis,function(C,S,P,K){
 'use strict';
 const LAYERS=Object.freeze(['trail','echoes','flash','particles']),DEG=Math.PI/180;
 const BUDGETS=Object.freeze({low:Object.freeze({echoes:8,vertices:512,particles:128}),balanced:Object.freeze({echoes:24,vertices:2048,particles:512}),high:Object.freeze({echoes:24,vertices:4096,particles:1024})});
 const fail=m=>{throw RangeError('GAME-07 '+m)},clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const number=(v,k,a,b,integer=false)=>{if(!Number.isFinite(v)||v<a||v>b||integer&&!Number.isInteger(v))fail('invalid '+k);return v};
 const choose=(v,k,values)=>{if(!values.includes(v))fail('invalid '+k);return v};
 const bool=(v,k)=>{if(typeof v!=='boolean')fail('invalid '+k);return v};
 function fields(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid fields');}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 const idhash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0};
 function rand(seed,index,salt){let x=seed^Math.imul(index+1,0x9e3779b1)^idhash(salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 const anchor=type=>({type,name:''});
 function newEmitter(i=0){
  number(i,'emitter index',0,100000,true);
  const transform=(seed,type)=>({enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed,anchor:anchor(type)});
  return {id:'dash'+(i+1),...transform(271+i*137,'world'),x:170,y:256,
   layers:Object.fromEntries(LAYERS.map((k,j)=>[k,{...transform(17+j*97,'inherit'),alpha:1,blend:k==='flash'||k==='particles'?'add':'normal'}]))};
 }
 function curve(key,domain,points,range=[0,1],unit='normalized',monotonic=false){
  return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:domain==='pathPosition'?'normalized-path':domain==='particleAge'?'normalized-lifetime':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],clamp:'hold',monotonic,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function line(length){return {schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[length/3,0],p2:[length*2/3,0],p3:[length,0]}]};}
 function defaults(){return {
  schemaVersion:1,mode:'dash',durationFrames:40,teleportFrame:16,dashLength:170,path:line(170),
  afterimageCount:5,temporalEchoGap:3,spatialEchoGap:14,trailWidth:24,afterimageAlpha:.6,echoLifetimeFrames:18,
  echoMode:'time',frequencySource:'interval',echoRate:20,burstCount:1,burstDelayFrames:0,minIntervalFrames:0,timeJitter:0,
  minGapPx:1,maxGapPx:100,spatialJitter:0,distribution:'even',particleCount:16,particleLifetimeFrames:12,particleSize:2,flashLifetimeFrames:6,flashRadius:28,
  seed:6179,quality:'balanced',
  progressCurve:curve('dashProgress','effectTime',[[0,0],[.2,.1],[.5,.9],[1,1]],[0,1],'normalized',true),
  widthCurve:curve('widthMultiplier','pathPosition',[[0,1],[.55,.5],[1,0]],[0,1]),
  echoAlphaCurve:curve('echoAlpha','particleAge',[[0,1],[.55,7/12],[1,0]]),
  rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,4],'multiplier'),
  intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4],'multiplier'),
  spacingCurve:curve('spacingPx','pathPosition',[[0,14],[1,14]],[1,100],'px'),
  palette:K.normalize({schemaVersion:1,parameterKey:'dashColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
   stops:[{id:'light',position:0,rgba:[208,248,255,1]},{id:'dark',position:1,rgba:[81,157,234,1]}]}),
  emitters:[newEmitter()]};}
 function normalize(input){
  const base=defaults();fields(input,Object.keys(base));if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1,mode:choose(input.mode,'mode',['dash','teleport']),durationFrames:number(input.durationFrames,'durationFrames',2,3600,true)};
  // Inactive teleport settings remain valid when switching to a shorter dash.
  c.teleportFrame=number(input.teleportFrame,'teleportFrame',1,3599,true);
  if(c.mode==='teleport'&&c.teleportFrame>=c.durationFrames-1)fail('teleport must be inside one-shot');
  for(const [k,a,b,i] of [['dashLength',10,600],['afterimageCount',0,24,true],['temporalEchoGap',1,20],['spatialEchoGap',1,100],['trailWidth',.5,110],['afterimageAlpha',0,1],
   ['echoLifetimeFrames',1,3600,true],['echoRate',0,60],['burstCount',1,8,true],['burstDelayFrames',0,3600],['minIntervalFrames',0,3600],['timeJitter',0,.45],
   ['minGapPx',1,100],['maxGapPx',1,100],['spatialJitter',0,.45],['particleCount',0,128,true],['particleLifetimeFrames',1,3600,true],['particleSize',.1,20],['flashLifetimeFrames',1,3600,true],['flashRadius',1,300],['seed',-2147483648,2147483647,true]])c[k]=number(input[k],k,a,b,i);
  if(c.minGapPx>c.maxGapPx)fail('gap range');
  c.echoMode=choose(input.echoMode,'echoMode',['time','distance']);c.frequencySource=choose(input.frequencySource,'frequencySource',['rate','interval']);
  c.distribution=choose(input.distribution,'distribution',['even','random','stratified','clustered']);c.quality=choose(input.quality,'quality',Object.keys(BUDGETS));
  fields(input.path,['schemaVersion','closed','segments']);
  if(!Array.isArray(input.path.segments))fail('path segments');
  for(const s of input.path.segments){fields(s,['p0','p1','p2','p3']);for(const k of ['p0','p1','p2','p3']){if(!Array.isArray(s[k])||s[k].length!==2)fail('path point');for(const v of s[k])number(v,'path coordinate',-600,600);}}
  c.path=S.normalizePath(input.path);
  if(c.path.closed||c.path.segments[0].p0.some(v=>v!==0))fail('open path must start at local origin');
  const table=S.buildArcTable(c.path);if(table.length<=0||Math.abs(table.length-c.dashLength)>.25)fail('path length must match dashLength within 0.25 px');
  for(const k of ['progressCurve','widthCurve','echoAlphaCurve','rateCurve','intervalCurve','spacingCurve']){
   const a=C.normalize(input[k]),b=base[k];
   for(const key of ['parameterKey','domain','inputUnit','valueUnit','monotonic','clamp'])if(a[key]!==b[key])fail('invalid '+k+' binding');
   if(a.valueRange[0]<b.valueRange[0]||a.valueRange[1]>b.valueRange[1])fail('invalid '+k+' range');c[k]=a;
  }
  if(c.progressCurve.keys[0].y!==0||c.progressCurve.keys.at(-1).y!==1)fail('progress endpoints');
  c.palette=K.normalize(input.palette);if(c.palette.parameterKey!=='dashColor'||c.palette.domain!=='particleAge')fail('palette binding');
  const ids=new Set();
  function transform(t,layer){
   fields(t.anchor,['type','name']);const a=t.anchor;
   choose(a.type,'anchor',layer?['world','local','bone','inherit']:['world','local','bone']);
   if(typeof a.name!=='string'||a.name.length>128||(a.type==='bone'?!a.name.trim():a.name!==''))fail('anchor name');
   return {enabled:bool(t.enabled,'enabled'),visible:bool(t.visible,'visible'),x:number(t.x,'x',-16384,16384),y:number(t.y,'y',-16384,16384),rotation:number(t.rotation,'rotation',-3600,3600),
    scale:number(t.scale,'scale',.01,20),timeOffset:number(t.timeOffset,'timeOffset',-3600,3600),seed:number(t.seed,'seed',-2147483648,2147483647,true),anchor:{...a}};
  }
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');
  c.emitters=input.emitters.map(e=>{const b=newEmitter();fields(e,Object.keys(b));if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);fields(e.layers,LAYERS);
   return {id:e.id,...transform(e,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];fields(l,Object.keys(b.layers[k]));return [k,{...transform(l,true),alpha:number(l.alpha,'alpha',0,1),blend:choose(l.blend,'blend',['normal','add','screen','multiply'])}]}))};});
  return c;
 }
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 const snapFrame=f=>Math.abs(f-Math.round(f))<1e-8?Math.round(f):f;
 function compile(input){
  const c=freeze(normalize(input)),table=S.buildArcTable(c.path),end=c.durationFrames-1,duration=end/60,keys=c.progressCurve.keys,budget=BUDGETS[c.quality];
  const motion=[],jumps=[],runs=[];let total=0,run=null;
  // Distinguish path distance (position on authored curve) from actual traversed arc.
  // A stepped key or explicit teleport skips an arc interval, and starts a new ribbon.
  if(c.mode==='teleport')jumps.push({frame:c.teleportFrame,from:0,to:table.length});
  else for(let i=0;i<keys.length-1;i++){
   const a=keys[i],b=keys[i+1],from=a.y*table.length,to=b.y*table.length,t0=a.x*end,t1=b.x*end;
   if(a.mode==='stepped'&&to>from){jumps.push({frame:t1,from,to});run=null;continue;}
   if(to<=from)continue;
   if(!run){run={from,to,segments:[]};runs.push(run);}
   run.to=to;const part={t0,t1,from,to,travelStart:total,travelEnd:total+to-from};total=part.travelEnd;
   motion.push(part);run.segments.push(part);
  }
  function headAt(frame,seconds=frame/60,offset=0){
   const f=clamp(frame,0,end),at=localFrame=>(localFrame+offset)/60;
   let pathDistance;
   if(c.mode==='teleport')pathDistance=seconds>=at(c.teleportFrame)?table.length:0;
   else{
    // The comparison is in the original seconds domain. A multiplication by
    // 60, a normalized curve coordinate or frame snapping may round across a
    // discontinuity for adjacent representable timestamps.
    let i=0;
    while(i+1<keys.length&&seconds>=at(keys[i+1].x*end))i++;
    const a=keys[i],b=keys[i+1];
    const v=!b||a.mode==='stepped'||seconds===at(a.x*end)?a.y:clamp(C.evaluate(c.progressCurve,f/end),a.y,b.y);
    pathDistance=v*table.length;
   }
   let travelDistance=0;
   for(const m of motion){if(seconds<at(m.t0))break;travelDistance=m.travelStart+clamp(pathDistance-m.from,0,m.to-m.from);if(seconds<at(m.t1))break;}
   const q=S.pointAtDistance(table,pathDistance);
   return {x:q.x,y:q.y,angle:q.angle,tangent:{...q.tangent},pathDistance,travelDistance};
  }
  function invert(part,d){
   if(d<=part.from)return part.t0;if(d>=part.to)return part.t1;
   let lo=part.t0,hi=part.t1;
   for(let i=0;i<52;i++){const m=(lo+hi)/2;if(C.evaluate(c.progressCurve,m/end)*table.length<d)lo=m;else hi=m;}
   return (lo+hi)/2;
  }
  function seedFor(e,k){return c.seed^e.seed^e.layers[k].seed^idhash(e.id+':'+k);}
  function temporal(seed){
   if(c.burstCount>1&&c.burstDelayFrames<c.minIntervalFrames)fail('burst delay violates minimum interval');
   const sched=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.echoRate,interval:c.temporalEchoGap/60,duration,
    minInterval:c.minIntervalFrames/60,jitter:c.timeJitter,seed,maxEvents:4096,rateCurve:c.rateCurve,intervalCurve:c.intervalCurve});
   if(sched.capped)fail('temporal event budget');
   const triggers=sched.events.map(x=>snapFrame(x.time*60)).filter(x=>x<end),births=[];
   for(let i=0;i<triggers.length;i++){
    const t=triggers[i],span=(c.burstCount-1)*c.burstDelayFrames;
    const next=triggers[i+1]??Infinity;
    if(span>0&&t+span>=next-1e-8)fail('overlapping echo groups');
    if(next-t-span<c.minIntervalFrames-1e-8)fail('echo group violates minimum interval');
    for(let j=0;j<c.burstCount;j++){const f=snapFrame(t+j*c.burstDelayFrames);if(f<end)births.push(f);if(births.length===c.afterimageCount)return births;}
   }
   return births;
  }
  function spatial(seed){
   if(total<=0)return [];
   // The 1-D proxy is in cumulative *traveled* arc units, not cubic t or
   // straight-line world displacement. It excludes all discontinuities.
   const factor=c.spatialEchoGap/14,scale=v=>v*factor,raw=c.spacingCurve;
   const spacingCurve={...raw,valueRange:raw.valueRange.map(scale),defaultValue:scale(raw.defaultValue),
    keys:raw.keys.map(k=>({...k,y:scale(k.y),...(k.in?{in:[k.in[0],scale(k.in[1])]}:{}),...(k.out?{out:[k.out[0],scale(k.out[1])]}:{})}))};
   const placement=S.createSpatialPlacement({path:line(total),baseSpacingPx:c.spatialEchoGap,minSpacing:c.minGapPx,maxSpacing:c.maxGapPx,spacingCurve,
    mode:c.distribution,jitter:c.spatialJitter,seed,maxPoints:4096});
   if(placement.capped)fail('spatial event budget');
   const births=[];
   for(const a of placement.points){
    // If a threshold lands exactly at a discontinuity, use the pre-jump
    // continuous arrival, never fabricate an intermediate position.
    const m=motion.find(p=>a.distance<=p.travelEnd+1e-8);if(!m)continue;
    const pathDistance=clamp(m.from+a.distance-m.travelStart,m.from,m.to),birthFrame=invert(m,pathDistance);
    if(birthFrame>=end)continue;
    const q=S.pointAtDistance(table,pathDistance);
    births.push({birthFrame,pathDistance,travelDistance:a.distance,x:q.x,y:q.y,angle:q.angle,tangent:{...q.tangent}});
    if(births.length===c.afterimageCount)break;
   }
   return births;
  }
  const width={start:c.trailWidth,middle:c.trailWidth,end:c.trailWidth,startTaper:1,endTaper:1,minVisiblePx:0,curve:c.widthCurve};
  // Distances sampled at fixed logical arc intervals. Control-segment boundaries
  // are included to preserve corners, and each run has exact pointed tips.
  function sampleDistances(from,to){
   const ds=[from,(from+to)/2,to];for(let d=from+4;d<to;d+=4)ds.push(d);
   for(const n of table.nodes)if(n.t===1&&n.s>from&&n.s<to)ds.push(n.s);
   ds.sort((a,b)=>a-b);return ds.filter((d,i)=>!i||d-ds[i-1]>1e-8);
  }
  const maxRunVertices=runs.reduce((n,r)=>n+2*(Math.ceil((r.to-r.from)/4)+3+table.path.segments.length),0);
  let vertices=0,particles=0;
  const rows=c.emitters.map(e=>{
   const echoLayer=e.layers.echoes,particleLayer=e.layers.particles;
   let echoes=[];
   if(active(e,echoLayer)&&c.afterimageCount){
    const seed=seedFor(e,'echoes');
    const local=c.echoMode==='time'?temporal(seed).map(birthFrame=>({...headAt(birthFrame),birthFrame})):spatial(seed);
    const offset=e.timeOffset+echoLayer.timeOffset;
    echoes=local.map((b,index)=>({...b,index,birthSeconds:(b.birthFrame+offset)/60,sourceSeconds:(b.birthFrame+offset)/60}))
     .filter(b=>b.birthSeconds>=0&&b.birthSeconds<duration);
    if(echoes.length>budget.echoes)fail('echo budget exceeded');
   }
   const births=[];
   if(active(e,particleLayer)&&c.particleCount){
    const seed=seedFor(e,'particles'),offset=e.timeOffset+particleLayer.timeOffset;
    for(let i=0;i<c.particleCount;i++){
     const f=(i+(.25+.5*rand(seed,i,'birth')))/c.particleCount*end,at=(f+offset)/60;
     if(at>=0&&at<duration)births.push({...headAt(f),index:i,birthFrame:f,birthSeconds:at,sourceSeconds:at});
    }
    particles+=births.length;
   }
   if(active(e,e.layers.trail))vertices+=maxRunVertices;
   return {id:e.id,echoes,particles:births};
  });
  if(vertices>budget.vertices)fail('ribbon vertex budget exceeded');if(particles>budget.particles)fail('particle budget exceeded');
  freeze(rows);
  function compose(p,t){
   const a=p.rotation*DEG,x=t.x*p.scale,y=t.y*p.scale;
   return {x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),rotation:p.rotation+t.rotation,scale:p.scale*t.scale};
  }
  const valid=p=>p&&[p.x,p.y,p.rotation,p.scale].every(Number.isFinite)&&p.scale>1e-10&&p.scale<=1e20&&Math.abs(p.x)<=1e25&&Math.abs(p.y)<=1e25&&Math.abs(p.rotation)<=1e15;
  function resolve(t,parent,poses){
   let p={x:0,y:0,rotation:0,scale:1};if(t.anchor.type==='inherit')p=parent;
   else if(t.anchor.type!=='world'){const key=t.anchor.type==='local'?'$local':t.anchor.name;p=poses&&Object.hasOwn(poses,key)?poses[key]:null;}
   if(!valid(p))return null;const q=compose(p,t);return valid(q)?q:null;
  }
  function point(p,q){
   const a=p.rotation*DEG,x=q.x*p.scale,y=q.y*p.scale;
   return {x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),angle:q.angle+a};
  }
  const envelope=f=>clamp(f/3,0,1)*clamp((end-f)/6,0,1);
  function color(age,alpha){const rgba=K.sample(c.palette,clamp(age,0,1));rgba[3]*=clamp(alpha,0,1);return rgba;}
  function sample(seconds,poses={}){
   number(seconds,'seconds',0,1e7);if(typeof poses!=='function'&&(!poses||typeof poses!=='object'||Array.isArray(poses)))fail('pose map or absolute-time pose provider required');
   // Compare exact key timestamps rather than interpolating across a jump.
   const raw=seconds*60,frame=seconds>=duration?end:snapFrame(raw),head=headAt(raw,seconds),diagnostics=[];
   let cost=0;
   function poseMap(t){const map=typeof poses==='function'?poses(t):poses;if(!map||typeof map!=='object'||Array.isArray(map))fail('invalid pose map');return map;}
   const globalAlpha=seconds>=duration?0:clamp(raw/3,0,1)*clamp((duration-seconds)*10,0,1),emitters=c.emitters.map((e,i)=>{
    const layers=Object.fromEntries(LAYERS.map(k=>[k,[]])),r=rows[i],seen=new Set();
    const poseFor=(k,t)=>{const map=poseMap(t),p=resolve(e.layers[k],resolve(e,null,map),map);if(!p&&!seen.has(k)){seen.add(k);diagnostics.push({emitterId:e.id,layer:k,reason:'missing or invalid anchor'});}return p;};
    if(globalAlpha<=0)return {id:e.id,layers};
    for(const k of LAYERS){
     const l=e.layers[k];if(!active(e,l))continue;
     const offset=e.timeOffset+l.timeOffset,local=raw-offset;if(seconds<offset/60||seconds>=(end+offset)/60)continue;
     const fade=Math.min(globalAlpha,envelope(local))*l.alpha;if(fade<=0)continue;
     const seed=seedFor(e,k);
     if(k==='echoes'){
      for(const b of r.echoes){if(seconds<b.birthSeconds)continue;const age=snapFrame((seconds-b.birthSeconds)*60);if(age<0||age>=c.echoLifetimeFrames)continue;
       const p=poseFor(k,b.birthSeconds);if(!p)continue;const u=age/c.echoLifetimeFrames,rgba=color(u,fade*c.afterimageAlpha*C.evaluate(c.echoAlphaCurve,u));if(rgba[3]<=0)continue;
       layers[k].push({...point(p,b),id:e.id+'-echo-'+b.index,scale:p.scale,rotation:p.rotation,age,birthSeconds:b.birthSeconds,sourceSeconds:b.sourceSeconds,pathDistance:b.pathDistance,travelDistance:b.travelDistance,rgba,blend:l.blend});
      }
     }else if(k==='trail'){
      const p=poseFor(k,seconds);if(!p)continue;const h=headAt(local,seconds,offset);
      for(let j=0;j<runs.length;j++){
       const run=runs[j],to=Math.min(run.to,h.pathDistance);if(seconds<(run.segments[0].t0+offset)/60||to-run.from<=1e-8)continue;
       const ds=sampleDistances(run.from,to).reverse(),points=ds.map((d,n)=>{
        const q=S.pointAtDistance(table,d),u=(to-d)/(to-run.from),w=n===0||n===ds.length-1?0:P.widthAt(width,u)*p.scale;
        return {...point(p,q),pathDistance:d,width:w,rgba:color(u,fade*(1-u))};
       });
       layers[k].push({id:e.id+'-trail-'+j,points,blend:l.blend});
      }
     }else if(k==='flash'){
      const p=poseFor(k,seconds);if(!p)continue;
      const events=jumps.length?jumps.flatMap(j=>[{frame:j.frame,d:j.from},{frame:j.frame,d:j.to}]):[{frame:0,d:0},{frame:end,d:table.length}];
      for(let j=0;j<events.length;j++){const event=events[j],age=(seconds-(event.frame+offset)/60)*60;if(age<0||age>=c.flashLifetimeFrames)continue;
       const u=age/c.flashLifetimeFrames,q=S.pointAtDistance(table,event.d);
       layers[k].push({...point(p,q),id:e.id+'-flash-'+j,radius:c.flashRadius*p.scale*(.5+u*.5),rgba:color(u,fade*(1-u)),blend:l.blend});
      }
     }else for(const b of r.particles){
      if(seconds<b.birthSeconds)continue;
      const age=snapFrame((seconds-b.birthSeconds)*60);if(age<0||age>=c.particleLifetimeFrames)continue;
      const p=poseFor(k,b.birthSeconds);if(!p)continue;
      const u=age/c.particleLifetimeFrames,theta=b.angle+Math.PI+(rand(seed,b.index,'angle')-.5)*Math.PI/2,d=age*(1+rand(seed,b.index,'speed')),q={...b,x:b.x+Math.cos(theta)*d,y:b.y+Math.sin(theta)*d};
      layers[k].push({...point(p,q),id:e.id+'-particle-'+b.index,birthSeconds:b.birthSeconds,age,radius:c.particleSize*p.scale*(1-u),rgba:color(u,fade*(1-u)),blend:l.blend});
     }
    }
    cost+=layers.trail.reduce((n,l)=>n+l.points.length*2,0)+layers.echoes.length+layers.flash.length+layers.particles.length;
    return {id:e.id,layers};
   });
   return {frame,head,emitters,diagnostics,cost};
  }
  return Object.freeze({settings:c,emitters:rows,travelLength:total,pathLength:table.length,arcErrorBound:table.errorBound,reserved:Object.freeze({vertices,particles}),sample});
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,newEmitter,normalize,compile};
});
