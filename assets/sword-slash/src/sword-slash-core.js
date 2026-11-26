// GAME-03 S01. Pure swept ribbon; absolute seconds, no scene or render history.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSwordSlash=api;
})(globalThis,function(C,S,P,K){
 'use strict';
 const FPS=60,RAD=Math.PI/180,LAYERS=Object.freeze(['main','edge','residual']),EPS=1e-7;
 const fail=k=>{throw TypeError('Sword Slash: '+k);};
 const num=(v,k,a,b,i=false)=>{if(!Number.isFinite(v)||v<a||v>b||(i&&!Number.isInteger(v)))fail(k);return v;};
 const choose=(v,k,a)=>{if(!a.includes(v))fail(k);return v;};
 const bool=(v,k)=>{if(typeof v!=='boolean')fail(k);return v;};
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function exact(o,keys,k){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(x=>!Object.hasOwn(o,x)))fail(k);}
 function dense(o){if(Array.isArray(o)){for(let i=0;i<o.length;i++){if(!Object.hasOwn(o,i))fail('sparse array');dense(o[i]);}}else if(o&&typeof o==='object')Object.values(o).forEach(dense);}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function rand(seed,i,salt){let x=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function arc(angle,length){
  const a=angle*RAD,r=length/a,n=Math.ceil(a/(Math.PI/2)),parts=[];
  for(let i=0;i<n;i++){const s=-a/2+i*a/n,t=-a/2+(i+1)*a/n,k=4/3*Math.tan((t-s)/4),p0=i?parts.at(-1).p3.slice():[r*Math.cos(s),r*Math.sin(s)],p3=[r*Math.cos(t),r*Math.sin(t)];
   parts.push({p0,p1:[p0[0]-r*k*Math.sin(s),p0[1]+r*k*Math.cos(s)],p2:[p3[0]+r*k*Math.sin(t),p3[1]-r*k*Math.cos(t)],p3});}
  return {schemaVersion:1,closed:false,segments:parts};
 }
 const specs={
  reveal:['slashReveal','effectTime','normalized-duration','normalized',0,1,true,[[0,0],[.25,.6],[.6,1],[1,1]]],
  width:['widthMultiplier','pathPosition','normalized-path','normalized',0,2,false,[[0,.1],[.4,1],[1,.05]]],
  alpha:['trailAlpha','particleAge','normalized-lifetime','normalized',0,1,false,[[0,1],[.55,.8],[1,0]]],
  rate:['emissionRate','emitterTime','normalized-duration','multiplier',0,4,false,[[0,1],[1,1]]],
  interval:['emissionInterval','emitterTime','normalized-duration','multiplier',.05,4,false,[[0,1],[1,1]]],
  spacing:['spacingPx','pathPosition','normalized-path','px',1,80,false,[[0,10],[1,10]]]
 };
 function curve(k){const [parameterKey,domain,inputUnit,valueUnit,min,max,monotonic,pts]=specs[k];return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit,valueUnit,inputRange:[0,1],valueRange:[min,max],defaultValue:pts[0][1],clamp:'hold',monotonic,keys:pts.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function palette(k){return K.normalize({schemaVersion:1,parameterKey:k+'Palette',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'hot',position:0,rgba:[255,255,255,1]},{id:'cool',position:1,rgba:[142,229,255,1]}]});}
 const ranges={arcAngle:[10,330],trailLength:[20,450],startWidth:[.5,70],middleWidth:[.5,120],endWidth:[.5,70],lifetimeFrames:[2,90,true],edgeGlow:[0,2],sweepFrames:[2,120,true],exportFrames:[1,3600,true],intervalFrames:[1,60,true],rate:[0,120],minIntervalFrames:[0,120],timeJitter:[0,.45],gap:[1,80],minGap:[1,80],maxGap:[1,80],spatialJitter:[0,.45],contactFrame:[0,119,true],sparkCount:[0,64,true],sparkLifetimeFrames:[1,90,true],sparkSpeed:[0,900]};
 function defaults(){return {schemaVersion:1,arcAngle:140,trailLength:120,startWidth:4,middleWidth:35,endWidth:2,lifetimeFrames:16,edgeGlow:.6,sweepFrames:24,exportFrames:40,intervalFrames:2,rate:30,minIntervalFrames:0,timeJitter:0,gap:10,minGap:1,maxGap:80,spatialJitter:0,contactFrame:12,sparkCount:12,sparkLifetimeFrames:8,sparkSpeed:140,pathMode:'arc',customPath:arc(140,120),triggerMode:'time',frequencySource:'interval',distribution:'even',spacingCurveEnabled:false,sparksEnabled:false,glowEnabled:false,curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,palette(k)])),layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,x:0,y:0,rotation:0,delayFrames:0,seed:4109+i,opacity:1,blend:k==='main'?'normal':'add'}]))};}
 function path(v){
  exact(v,['schemaVersion','closed','segments'],'customPath');dense(v);
  if(v.schemaVersion!==1||v.closed!==false||!Array.isArray(v.segments)||v.segments.length<1||v.segments.length>32)fail('open path segment budget');
  for(const s of v.segments){exact(s,['p0','p1','p2','p3'],'segment');for(const k of ['p0','p1','p2','p3']){if(!Array.isArray(s[k])||s[k].length!==2)fail('point');s[k].forEach(x=>num(x,'coordinate',-10000,10000));}}
  const out=S.normalizePath(v),length=S.buildArcTable(out).length;
  if(length<20-.25||length>450+.25)fail('custom length outside range');
  return out;
 }
 function normalize(v){
  exact(v,['schemaVersion',...Object.keys(ranges),'pathMode','customPath','triggerMode','frequencySource','distribution','spacingCurveEnabled','sparksEnabled','glowEnabled','curves','palettes','layers'],'preset');
  if(v.schemaVersion!==1)fail('schemaVersion');const o={schemaVersion:1};for(const [k,r] of Object.entries(ranges))o[k]=num(v[k],k,...r);
  if(o.minGap>o.maxGap)fail('gap bounds');
  o.pathMode=choose(v.pathMode,'pathMode',['arc','custom']);o.customPath=path(v.customPath);
  o.triggerMode=choose(v.triggerMode,'triggerMode',['time','distance']);o.frequencySource=choose(v.frequencySource,'frequencySource',['rate','interval']);o.distribution=choose(v.distribution,'distribution',['even','random','stratified','clustered']);
  for(const k of ['spacingCurveEnabled','sparksEnabled','glowEnabled'])o[k]=bool(v[k],k);
  exact(v.curves,Object.keys(specs),'curves');o.curves=Object.fromEntries(Object.keys(specs).map(k=>{dense(v.curves[k]);const c=C.normalize(v.curves[k]),b=curve(k);for(const key of ['parameterKey','domain','inputUnit','valueUnit','clamp','monotonic'])if(c[key]!==b[key])fail('curve binding '+k);if(c.valueRange[0]!==b.valueRange[0]||c.valueRange[1]!==b.valueRange[1])fail('curve range');if(k==='reveal'&&(c.keys[0].y!==0||c.keys.at(-1).y!==1))fail('reveal endpoints');return [k,c];}));
  exact(v.palettes,LAYERS,'palettes');o.palettes=Object.fromEntries(LAYERS.map(k=>{dense(v.palettes[k]);const p=K.normalize(v.palettes[k]);if(p.parameterKey!==k+'Palette'||p.domain!=='particleAge')fail('palette binding');return [k,p];}));
  exact(v.layers,LAYERS,'layers');o.layers=Object.fromEntries(LAYERS.map(k=>{const l=v.layers[k];exact(l,['enabled','x','y','rotation','delayFrames','seed','opacity','blend'],k);return [k,{enabled:bool(l.enabled,k),x:num(l.x,k,-10000,10000),y:num(l.y,k,-10000,10000),rotation:num(l.rotation,k,-360,360),delayFrames:num(l.delayFrames,k,0,120,true),seed:num(l.seed,k,-2147483648,2147483647,true),opacity:num(l.opacity,k,0,1),blend:choose(l.blend,k,['normal','add'])}];}));
  return o;
 }
 function actualPath(c){
  if(c.pathMode==='arc')return arc(c.arcAngle,c.trailLength);
  const raw=c.customPath,p=raw.segments[0].p0,ratio=c.trailLength/S.buildArcTable(raw).length;
  return {...raw,segments:raw.segments.map(s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,[p[0]+(v[0]-p[0])*ratio,p[1]+(v[1]-p[1])*ratio]])))};
 }
 function moveEndpoint(input,which,point){
  const c=normalize(input);if(c.pathMode!=='custom')fail('endpoint only custom');
  choose(which,'endpoint',['start','end']);if(!Array.isArray(point)||point.length!==2)fail('point');dense(point);point.forEach(x=>num(x,'point',-10000,10000));
  const p=actualPath(c),s=which==='start'?p.segments[0]:p.segments.at(-1),key=which==='start'?'p0':'p3',handle=which==='start'?'p1':'p2',dx=point[0]-s[key][0],dy=point[1]-s[key][1];
  s[key]=point.slice();s[handle]=[s[handle][0]+dx,s[handle][1]+dy];c.customPath=p;c.trailLength=S.buildArcTable(p).length;return normalize(c);
 }
 function compile(input){
  const c=freeze(normalize(input)),p=actualPath(c),width={start:c.startWidth,middle:c.middleWidth,end:c.endWidth,startTaper:0,endTaper:0,minVisiblePx:0,curve:c.curves.width};
  const mesh=P.buildRibbon({path:p,width,quality:'balanced',sampleSpacingPx:4}),table=mesh.table,len=table.length,end=(c.sweepFrames-1)/FPS,life=c.lifetimeFrames/FPS,keys=c.curves.reveal.keys;
  if(Math.abs(len-c.trailLength)>.25||mesh.samples.length>510||table.errorBound>.25)fail('geometry budget');
  const runs=[],parts=[];let active=null,travel=0;
  for(let i=0;i<keys.length-1;i++){
   const a=keys[i],b=keys[i+1],from=a.y*len,to=b.y*len,t0=a.x*end,t1=b.x*end;
   if(to<=from)continue;
   if(a.mode==='stepped'){active=null;continue;}
   if(!active){active={from,to,parts:[]};runs.push(active);}
   active.to=to;const part={from,to,t0,t1,travelStart:travel,travelEnd:travel+to-from};travel=part.travelEnd;active.parts.push(part);parts.push(part);
  }
  function distance(t){
   let i=0;while(i+1<keys.length&&t>=keys[i+1].x*end)i++;
   const a=keys[i],b=keys[i+1];
   // Select the segment in original seconds before normalization can round
   // across a stepped discontinuity (the shared evaluator receives u).
   if(!b||a.mode==='stepped'||t<=a.x*end)return a.y*len;
   return clamp(C.evaluate(c.curves.reveal,clamp(t/end,a.x,b.x)),a.y,b.y)*len;
  }
  function head(t){num(t,'time',0,3600);const d=distance(t),q=S.pointAtDistance(table,d);return {x:q.x,y:q.y,distance:d,angle:q.angle};}
  function arrival(run,d){
   const part=run.parts.find(x=>d<=x.to+1e-10)||run.parts.at(-1);
   if(d<=part.from)return part.t0;if(d>=part.to)return part.t1;
   let lo=part.t0,hi=part.t1;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(distance(mid)<d)lo=mid;else hi=mid;}return (lo+hi)/2;
  }
  function placement(path,seed){const q=S.createSpatialPlacement({path,baseSpacingPx:c.gap,minSpacing:c.minGap,maxSpacing:c.maxGap,spacingCurve:c.spacingCurveEnabled?c.curves.spacing:null,mode:c.distribution,jitter:c.spatialJitter,seed,maxPoints:512});if(q.capped)fail('placement cap');return q.points;}
  const placements={},events={};
  for(const k of LAYERS){
   const seed=c.layers[k].seed;placements[k]=placement(p,seed).map(v=>({distance:v.distance,x:v.x,y:v.y}));
   let list=[{time:0,distance:0}];
   if(c.triggerMode==='time'){
    const q=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.rate,interval:c.intervalFrames/FPS,duration:end,minInterval:c.minIntervalFrames/FPS,jitter:c.timeJitter,seed,maxEvents:512,rateCurve:c.curves.rate,intervalCurve:c.curves.interval});
    if(q.capped)fail('temporal cap');for(const e of q.events)if(e.time<end-1e-12&&e.time>list.at(-1).time+1e-12&&e.time+1e-9>=list.at(-1).time+c.minIntervalFrames/FPS)list.push({time:e.time,distance:distance(e.time)});
   }else if(travel>0){
    const proxy={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[travel/3,0],p2:[travel*2/3,0],p3:[travel,0]}]};
    for(const q of placement(proxy,seed)){const part=parts.find(x=>q.distance<=x.travelEnd+1e-9);if(!part)continue;const run=runs.find(x=>x.parts.includes(part)),d=clamp(part.from+q.distance-part.travelStart,part.from,part.to),t=arrival(run,d);if(t<end-1e-12&&t>list.at(-1).time+1e-12&&t+1e-9>=list.at(-1).time+c.minIntervalFrames/FPS)list.push({time:t,distance:d});}
   }
   events[k]=list;
  }
  const meta=freeze({path:p,length:len,errorBound:table.errorBound,sections:mesh.samples.length,widths:[0,.5,1].map(u=>P.widthAt(width,u)),runs:runs.map(r=>({from:r.from,to:r.to})),events,placements,maxSections:512,maxSparks:64});
  function section(d){
   const n=mesh.samples.find(s=>Math.abs(s.distance-d)<1e-9);if(n)return n;
   const q=S.pointAtDistance(table,d),u=d/len;return {x:q.x,y:q.y,distance:d,u,normal:{x:-q.tangent.y,y:q.tangent.x},width:P.widthAt(width,u)};
  }
  const defaultsPoses=freeze(Object.fromEntries(LAYERS.map(k=>[k,{x:256,y:256,rotation:0}])));
  function sample(seconds,poses=defaultsPoses){
   num(seconds,'time',0,3600);if(!poses||typeof poses!=='object'||Array.isArray(poses))fail('poses');
   const result={main:[],edge:[],residual:[]};
   for(const k of LAYERS){
    const l=c.layers[k],q=Object.hasOwn(poses,k)?poses[k]:null,t=seconds-l.delayFrames/FPS;
    if(!l.enabled||!l.opacity||q==null||t<0)continue;
    const a=num(q.rotation,'pose rotation',-360000,360000)*RAD,r=a+l.rotation*RAD,co=Math.cos(r),si=Math.sin(r),ox=num(q.x,'pose x',-900000,900000)+l.x*Math.cos(a)-l.y*Math.sin(a),oy=num(q.y,'pose y',-900000,900000)+l.x*Math.sin(a)+l.y*Math.cos(a);
    const xf=(x,y)=>[ox+x*co-y*si,oy+x*si+y*co];
    function color(age,gain){const rgba=K.sample(c.palettes[k],clamp(age,0,1));rgba[3]*=age>=1?0:clamp(l.opacity*gain*C.evaluate(c.curves.alpha,clamp(age,0,1)),0,1);return rgba;}
    const hi=distance(t),lo=t>=life?distance(t-life):0;
    const visible=runs.map(run=>({run,from:Math.max(run.from,lo),to:Math.min(run.to,hi)})).filter(v=>v.to-v.from>EPS);
    if(k==='edge'&&visible.length)visible.splice(0,visible.length-1);
    let sectionCount=0;
    if(k==='main'||k==='edge'&&c.edgeGlow>0||k==='residual'&&c.glowEnabled)for(const v of visible){
     const {run,to}=v,from=k==='edge'?Math.max(v.from,to-6):v.from;
     const ds=[from,...mesh.samples.filter(s=>s.distance>from+EPS&&s.distance<to-EPS).map(s=>s.distance),to];
     sectionCount+=ds.length;if(sectionCount>512)fail('clipped section budget');
     const positions=[],uvs=[],indices=[],sections=[],colors=[];
     for(let i=0;i<ds.length;i++){
      const d=ds[i],s=section(d),age=Math.max(0,(t-arrival(run,d))/life),rgba=color(age,k==='edge'?c.edgeGlow:k==='residual'?.25:1),w=k==='edge'?Math.min(3,s.width*.15):k==='residual'?s.width*1.5:s.width;
      const [x,y]=xf(s.x,s.y),lft=xf(s.x+s.normal.x*w/2,s.y+s.normal.y*w/2),rgt=xf(s.x-s.normal.x*w/2,s.y-s.normal.y*w/2);
      positions.push(...lft,...rgt);uvs.push(s.u,0,s.u,1);colors.push(...rgba,...rgba);sections.push({distance:d,x,y,width:w,age,rgba});
      if(i<ds.length-1)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);
     }
     if(sections.some(s=>s.rgba[3]>0&&s.width>0))result[k].push({kind:'ribbon',positions,uvs,indices,colors,sections,blend:l.blend});
    }
    if(k==='residual'&&c.sparksEnabled){
     const birth=c.contactFrame/FPS,dt=t-birth,span=c.sparkLifetimeFrames/FPS;
     if(c.contactFrame<c.sweepFrames&&dt>=0&&t<birth+span-1e-12){
      const origin=head(birth),age=dt/span,rgba=color(age,1);
      if(rgba[3]>0)for(let i=0;i<c.sparkCount;i++){const angle=origin.angle+(rand(l.seed,i,1)-.5)*Math.PI,dist=c.sparkSpeed*(.5+.5*rand(l.seed,i,2))*dt*(1-age*.5),[x,y]=xf(origin.x+Math.cos(angle)*dist,origin.y+Math.sin(angle)*dist);result.residual.push({kind:'spark',index:i,x,y,radius:1.5*(1-age*.8),rgba:rgba.slice(),blend:l.blend});}
     }
    }
   }
   return result;
  }
  return Object.freeze({settings:c,meta,head,sample});
 }
 function serialize(v){return JSON.stringify(normalize(v));}
 function deserialize(s){if(typeof s!=='string'||s.length>262144)fail('preset text');return normalize(JSON.parse(s));}
 return {VERSION:1,FPS,LAYERS,defaults,normalize,compile,moveEndpoint,serialize,deserialize};
});
