// GAME-04 E01: immutable absolute-time energy projectile; no Pixi/Spine ownership.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxEnergyProjectile=api;
})(globalThis,function(C,S,P,K){
 'use strict';
 const FPS=60,TAU=2*Math.PI,RAD=Math.PI/180,EPS=1e-8,LAYERS=Object.freeze(['core','ribbon','orbit']),BUDGETS=Object.freeze({low:256,balanced:1024,high:2048}),MAX_EVENTS=4096,MAX_VERTICES=8192;
 const fail=m=>{throw TypeError('Energy Projectile: '+m);},finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>((v%n)+n)%n;
 function exact(v,keys,k){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(x=>!Object.hasOwn(v,x)))fail(k);}
 function number(v,k,a,b,i=false){if(!finite(v)||v<a||v>b||(i&&!Number.isInteger(v)))fail(k);return v;}
 function choice(v,k,a){if(!a.includes(v))fail(k);return v;}
 function bool(v,k){if(typeof v!=='boolean')fail(k);return v;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function dense(o){if(Array.isArray(o)){for(let i=0;i<o.length;i++){if(!Object.hasOwn(o,i))fail('sparse array');dense(o[i]);}}else if(o&&typeof o==='object')Object.values(o).forEach(dense);}
 function rng(seed,i,salt){let x=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 const curveSpecs={
  pulse:['corePulse','effectTime','normalized-duration','normalized',[.2,2],[[0,.85],[.5,1.15],[1,.85]]],
  width:['widthMultiplier','pathPosition','normalized-path','normalized',[0,2],[[0,1],[.5,.6],[1,0]]],
  alpha:['trailAlpha','particleAge','normalized-lifetime','normalized',[0,1],[[0,.8],[1,0]]],
  rate:['emissionRate','emitterTime','normalized-duration','multiplier',[0,4],[[0,1],[1,1]]],
  interval:['emissionInterval','emitterTime','normalized-duration','multiplier',[.05,4],[[0,1],[1,1]]],
  spacing:['spacingPx','pathPosition','normalized-path','px',[1,80],[[0,7],[1,7]]]
 };
 function curve(k){const [parameterKey,domain,inputUnit,valueUnit,valueRange,keys]=curveSpecs[k];return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit,valueUnit,inputRange:[0,1],valueRange,defaultValue:keys[0][1],clamp:'hold',monotonic:false,keys:keys.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function palette(k){return K.normalize({schemaVersion:1,parameterKey:k+'Palette',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'head',position:0,rgba:[221,253,255,1]},{id:'mid',position:.5,rgba:[53,190,255,.85]},{id:'tail',position:1,rgba:[69,101,247,0]}]});}
 function anchor(type='world'){return {type,space:'world',name:'',slot:'',x:type==='world'?256:0,y:type==='world'?256:0,rotation:0};}
 function newEmitter(id='emitter-1',seed=4109){return {id,enabled:true,anchor:anchor(),layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,visible:true,x:0,y:0,rotation:0,delayFrames:0,seed:seed+i,opacity:1,blend:k==='ribbon'?'normal':'add',order:k==='ribbon'?'behind':'front',anchor:anchor('inherit')}]))};}
 function defaultPath(){return {schemaVersion:1,closed:false,segments:[{p0:[-120,30],p1:[-80,30],p2:[-45,-20],p3:[0,-20]},{p0:[0,-20],p1:[45,-20],p2:[85,20],p3:[150,20]}]};}
 function defaults(){return {schemaVersion:1,mode:'oneShot',quality:'balanced',trajectory:defaultPath(),smoothing:1,durationFrames:40,chargeFrames:4,fadeFrames:6,coreRadius:20,travelSpeed:260,tailLength:95,trailGap:7,glow:.7,particleRate:18,trailRate:18,orbitGap:14,orbitPulseHz:2,orbitLifeFrames:24,trailLifeFrames:18,particleSize:2,trailWidth:24,frequencySource:'rate',intervalFrames:60/18,emissionMode:'time',minIntervalFrames:0,timeJitter:0,burstCount:1,burstDelayFrames:1,distribution:'even',minGap:1,maxGap:80,spatialJitter:0,spacingCurveEnabled:false,curves:Object.fromEntries(Object.keys(curveSpecs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,palette(k)])),emitters:[newEmitter()]};}
 const ranges={smoothing:[0,1],durationFrames:[6,3600,true],chargeFrames:[0,120,true],fadeFrames:[1,120,true],coreRadius:[3,100],travelSpeed:[0,1200],tailLength:[0,320],trailGap:[1,80],glow:[0,2],particleRate:[0,160],trailRate:[0,160],orbitGap:[1,80],orbitPulseHz:[0,20],orbitLifeFrames:[1,120,true],trailLifeFrames:[1,120,true],particleSize:[.25,20],trailWidth:[0,200],intervalFrames:[.25,600],minIntervalFrames:[0,120],timeJitter:[0,.45],burstCount:[1,16,true],burstDelayFrames:[.25,60],minGap:[1,80],maxGap:[1,80],spatialJitter:[0,.45]};
 function normalizeAnchor(a,layer){exact(a,['type','space','name','slot','x','y','rotation'],'anchor');choice(a.type,'anchor type',[...(layer?['inherit']:[]),'world','skeleton','bone','slot','attachment']);choice(a.space,'anchor space',['world','local']);if((a.type==='world'||a.type==='inherit')&&a.space!=='world')fail('anchor space');for(const k of ['name','slot'])if(typeof a[k]!=='string'||a[k].length>256)fail('anchor name');if(['bone','slot','attachment'].includes(a.type)&&!a.name.trim()||a.type==='attachment'&&!a.slot.trim())fail('anchor identity');return {...a,x:number(a.x,'anchor x',-10000,10000),y:number(a.y,'anchor y',-10000,10000),rotation:number(a.rotation,'anchor rotation',-360,360)};}
 function normalize(input){
  exact(input,Object.keys(defaults()),'preset shape');dense(input);if(input.schemaVersion!==1)fail('version');const o={schemaVersion:1};for(const [k,r] of Object.entries(ranges))o[k]=number(input[k],k,...r);
  o.mode=choice(input.mode,'mode',['oneShot','flightLoop']);o.quality=choice(input.quality,'quality',Object.keys(BUDGETS));o.frequencySource=choice(input.frequencySource,'frequency',['rate','interval']);o.emissionMode=choice(input.emissionMode,'emission',['time','distance','both']);o.distribution=choice(input.distribution,'distribution',['even','random','stratified','clustered']);o.spacingCurveEnabled=bool(input.spacingCurveEnabled,'spacing');
  if(o.minGap>o.maxGap||o.mode==='oneShot'&&o.chargeFrames+o.fadeFrames>=o.durationFrames-1)fail('phase/gap bounds');
  exact(input.trajectory,['schemaVersion','closed','segments'],'trajectory');if(!Array.isArray(input.trajectory.segments)||input.trajectory.segments.length<1||input.trajectory.segments.length>64||typeof input.trajectory.closed!=='boolean')fail('path budget');
  for(const seg of input.trajectory.segments){exact(seg,['p0','p1','p2','p3'],'cubic');for(const q of Object.values(seg)){if(!Array.isArray(q)||q.length!==2)fail('point');q.forEach(v=>number(v,'coordinate',-10000,10000));}}
  o.trajectory=S.normalizePath(input.trajectory);
  if(o.trajectory.closed!==(o.mode==='flightLoop'))fail('path/mode mismatch');
  if(o.trajectory.closed){const a=o.trajectory.segments[0].p0,b=o.trajectory.segments.at(-1).p3;if(Math.hypot(a[0]-b[0],a[1]-b[1])>EPS)fail('explicit closed seam required');}
  exact(input.curves,Object.keys(curveSpecs),'curves');o.curves={};for(const k of Object.keys(curveSpecs)){const c=C.normalize(input.curves[k]),d=curve(k);for(const key of ['parameterKey','domain','inputUnit','valueUnit','clamp','monotonic'])if(c[key]!==d[key])fail('curve binding '+k);if(c.inputRange[0]!==0||c.inputRange[1]!==1||c.valueRange.some((v,i)=>v!==d.valueRange[i]))fail('curve range');o.curves[k]=c;}
  if(o.mode==='flightLoop'&&Math.abs(C.evaluate(o.curves.pulse,0)-C.evaluate(o.curves.pulse,1))>EPS)fail('pulse seam');
  exact(input.palettes,LAYERS,'palettes');o.palettes=Object.fromEntries(LAYERS.map(k=>{const p=K.normalize(input.palettes[k]);if(p.parameterKey!==k+'Palette'||p.domain!=='particleAge')fail('palette binding');return [k,p];}));
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitters');const ids=new Set();
  o.emitters=input.emitters.map(e=>{exact(e,['id','enabled','anchor','layers'],'emitter');if(typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);exact(e.layers,LAYERS,'layers');return {id:e.id,enabled:bool(e.enabled,'emitter enabled'),anchor:normalizeAnchor(e.anchor,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];exact(l,['enabled','visible','x','y','rotation','delayFrames','seed','opacity','blend','order','anchor'],'layer');return [k,{enabled:bool(l.enabled,k),visible:bool(l.visible,k),x:number(l.x,k,-10000,10000),y:number(l.y,k,-10000,10000),rotation:number(l.rotation,k,-360,360),delayFrames:number(l.delayFrames,k,0,120,true),seed:number(l.seed,k,-2147483648,2147483647,true),opacity:number(l.opacity,k,0,1),blend:choice(l.blend,k,['normal','add']),order:choice(l.order,k,['behind','front']),anchor:normalizeAnchor(l.anchor,true)}];}))};});
  return freeze(o);
 }
 const active=l=>l.enabled&&l.visible&&l.opacity>0;
 function compile(input){
  const c=normalize(input),loop=c.mode==='flightLoop',path=P.smoothPath(c.trajectory,c.smoothing),table=S.buildArcTable(path,{tolerancePx:.0625,maxPoints:8192}),L=table.length;
  if(c.travelSpeed>0&&L<=EPS)fail('zero length moving path');
  const frames=loop&&c.travelSpeed>0?Math.round(L/c.travelSpeed*FPS):c.durationFrames;
  if(frames<6||frames>3600)fail('cycle frame budget');
  const duration=loop?frames/FPS:(frames-1)/FPS,charge=loop?0:c.chargeFrames/FPS,fadeStart=loop?duration:duration-c.fadeFrames/FPS,speed=loop&&c.travelSpeed>0?L/duration:c.travelSpeed;
  const flightEnd=loop?duration:Math.min(fadeStart,charge+(speed>0?L/speed:Infinity)),impact=!loop&&speed>0&&charge+L/speed<=fadeStart+EPS?charge+L/speed:null;
  function phase(t){if(!loop)return clamp(t,0,duration);const q=t%duration;return Math.abs(q)<EPS||Math.abs(Math.abs(q)-duration)<EPS?0:q<0?q+duration:q;}
  function distance(t){if(loop)return speed*t;return Math.min(L,speed*Math.max(0,Math.min(t,flightEnd)-charge));}
  function point(d){return S.pointAtDistance(table,d,loop?'wrap':'clamp');}
  function envelope(t){if(loop)return 1;if(t<0||t>=duration)return 0;if(charge&&t<charge)return t/charge;const fade=impact??fadeStart;return t<fade?1:Math.max(0,1-(t-fade)/Math.max(EPS,Math.min(c.fadeFrames/FPS,duration-fade)));}
  let eventCount=0,primitiveBound=0,vertexBound=0;const plans={};
  function timetable(rate,life,l,salt,orbit=false){
   const start=orbit?0:charge,end=orbit?duration:flightEnd,span=end-start;
   if(span<=EPS||(!orbit&&speed===0)||rate===0&& (orbit||c.frequencySource==='rate'))return [];
   const schedule=S.createTemporalSchedule({mode:'custom',frequencySource:orbit?'rate':c.frequencySource,baseRate:rate,interval:c.intervalFrames/FPS,duration:span,minInterval:0,jitter:c.timeJitter,seed:l.seed^salt,maxEvents:MAX_EVENTS,rateCurve:c.curves.rate,intervalCurve:c.curves.interval});
   if(schedule.capped)fail('event schedule cap');const expanded=[];
   for(const e of schedule.events)for(let j=0;j<c.burstCount;j++){const t=start+e.time+j*c.burstDelayFrames/FPS;if(t<=end+EPS){expanded.push(loop&&Math.abs(t-end)<=EPS?start:t);if(expanded.length>MAX_EVENTS)fail('burst cap');}}
   expanded.sort((a,b)=>a-b);const result=[];for(const t of expanded){if(result.length&&t-result.at(-1)<Math.max(EPS,c.minIntervalFrames/FPS)-EPS/2)continue;result.push(t);}
   while(loop&&result.length>1&&duration-result.at(-1)+result[0]<c.minIntervalFrames/FPS-EPS)result.pop();
   return result;
  }
  function placement(l){const q=S.createSpatialPlacement({path,baseSpacingPx:c.trailGap,minSpacing:c.minGap,maxSpacing:c.maxGap,spacingCurve:c.spacingCurveEnabled?c.curves.spacing:null,jitter:c.spatialJitter,mode:c.distribution,seed:l.seed,maxPoints:MAX_EVENTS,tolerancePx:.0625});if(q.capped)fail('spatial placement cap');return q.points.map(p=>p.distance);}
  function trailEvents(l,ds){if(speed===0||c.tailLength===0)return [];const ts=c.emissionMode==='distance'?[]:timetable(c.trailRate,c.trailLifeFrames,l,0x1751),limit=distance(flightEnd),thresholds=ds.filter(d=>d<=limit+EPS);if(c.emissionMode==='distance')return thresholds.map((d,i)=>({time:charge+d/speed,distance:d,index:i})).filter(e=>!loop||e.time<duration-EPS);
   let next=0;const out=[];for(const t of ts){const d=distance(t);if(c.emissionMode==='both'){if(next>=thresholds.length||d+EPS<thresholds[next])continue;next++;}out.push({time:t,distance:d,index:out.length});}return out;}
  for(const e of c.emitters){const r=e.layers.ribbon,o=e.layers.orbit,enabled=e.enabled,ds=enabled&&active(r)&&speed>0&&c.tailLength>0?placement(r):[],trail=enabled&&active(r)?trailEvents(r,ds):[],orbit=enabled&&active(o)?timetable(c.particleRate,c.orbitLifeFrames,o,0x2b31,true).map((time,index)=>({time,index})):[];
   // Pre-roll bounded by event count and lifetime, never unbounded history.
   const bound=(events,life)=>events.length*(loop?Math.ceil(life/FPS/duration)+1:1);
   eventCount+=trail.length+orbit.length;primitiveBound+=(enabled&&active(e.layers.core)?1+(c.glow>0?1:0):0)+(enabled&&active(r)&&c.tailLength>0&&speed>0?1:0)+bound(trail,c.trailLifeFrames)+bound(orbit,c.orbitLifeFrames);
   if(enabled&&active(r)&&speed>0&&c.tailLength>0&&c.trailWidth>0)vertexBound+=2*(Math.ceil(c.tailLength/.5)+2+Math.min(ds.length*(loop?2:1),Math.ceil(c.tailLength/c.minGap)+3)+Math.min(table.nodes.length*(loop?2:1),MAX_VERTICES));
   const circumference=TAU*c.coreRadius*1.5,orbitDistances=[];let cursor=0;for(let i=0;cursor<circumference-EPS;i++){orbitDistances.push(cursor);let gap=c.orbitGap;if(c.distribution==='random')gap*=.5+rng(o.seed,i,51);if(c.distribution==='stratified')gap*=.8+.4*rng(o.seed,i,51);if(c.distribution==='clustered')gap*=i%5<3?.55:1.675;gap*=1+(2*rng(o.seed,i,52)-1)*c.spatialJitter;cursor+=clamp(gap,c.minGap,c.maxGap);}Object.defineProperty(plans,e.id,{value:{distances:ds,trail,orbit,orbitDistances},enumerable:true});
  }
  if(eventCount>MAX_EVENTS||primitiveBound>BUDGETS[c.quality]||vertexBound>MAX_VERTICES)fail('whole effect budget');
  function basis(a,l,poses,eid,k){
   const find=(anchor,id)=>{if(anchor.type==='world')return {x:anchor.x,y:anchor.y,rotation:anchor.rotation,scale:1};const v=poses&&Object.hasOwn(poses,id)?poses[id]:null;if(v==null)return null;if(![v.x,v.y,v.rotation,v.scale].every(finite)||v.scale<=0||v.scale>100||Math.abs(v.x)>1e6||Math.abs(v.y)>1e6||Math.abs(v.rotation)>360000)fail('pose');return v;};
   const rotate=(x,y,r)=>[x*Math.cos(r*RAD)-y*Math.sin(r*RAD),x*Math.sin(r*RAD)+y*Math.cos(r*RAD)];
   let b=find(l.anchor.type==='inherit'?a:l.anchor,l.anchor.type==='inherit'?eid:eid+':'+k);if(!b)return null;
   if(l.anchor.type==='inherit'){const [x,y]=rotate(l.anchor.x*b.scale,l.anchor.y*b.scale,b.rotation);b={...b,x:b.x+x,y:b.y+y,rotation:b.rotation+l.anchor.rotation};}
   const [x,y]=rotate(l.x*b.scale,l.y*b.scale,b.rotation);return {x:b.x+x,y:b.y+y,rotation:b.rotation+l.rotation,scale:b.scale};
  }
  function world(p,b){const a=b.rotation*RAD;return {x:b.x+b.scale*(p.x*Math.cos(a)-p.y*Math.sin(a)),y:b.y+b.scale*(p.x*Math.sin(a)+p.y*Math.cos(a))};}
  function rgba(k,u,alpha){const v=K.sample(c.palettes[k],clamp(u,0,1));return [...v.slice(0,3),clamp(v[3]*alpha,0,1)];}
  function live(events,t,life,fn){const span=life/FPS,cycles=loop?Math.ceil(span/duration)+1:1;for(let j=0;j<cycles;j++)for(const e of events){const born=e.time-j*duration,age=t-born;if(age>=-EPS&&age<span-EPS)fn(e,Math.max(0,age),born);}}
  function ribbon(d,t,b,l,ds,alpha){
   const length=Math.min(c.tailLength,loop?L:d);if(length<=EPS||c.trailWidth===0)return null;
   const start=d-length,dist=[start,d];
   // Dense arc samples and every arc-table boundary, not control-point counts.
   const n=Math.ceil(length/.5);for(let i=1;i<n;i++)dist.push(start+i*length/n);
   const cycles=loop&&start<0?[-1,0]:[0];for(const j of cycles){for(const q of table.nodes){const v=q.s+j*L;if(v>start+EPS&&v<d-EPS)dist.push(v);}for(const q of ds){const v=q+j*L;if(v>start+EPS&&v<d-EPS)dist.push(v);}}
   dist.sort((a,b)=>b-a);const sections=[];for(const v of dist){if(sections.length&&Math.abs(v-sections.at(-1).distance)<=EPS)continue;const p=point(v),u=(d-v)/Math.max(c.tailLength,EPS),age=clamp((d-v)/Math.max(speed,EPS)/(c.trailLifeFrames/FPS),0,1),w=c.trailWidth*C.evaluate(c.curves.width,u)*b.scale;
    const q=world(p,b),angle=p.angle+b.rotation*RAD;sections.push({...q,distance:v,width:w,angle,rgba:rgba('ribbon',u,alpha*C.evaluate(c.curves.alpha,age))});}
   const positions=[],uvs=[],colors=[],indices=[];for(let i=0;i<sections.length;i++){const s=sections[i],nx=-Math.sin(s.angle)*s.width/2,ny=Math.cos(s.angle)*s.width/2;positions.push(s.x+nx,s.y+ny,s.x-nx,s.y-ny);uvs.push(i/(sections.length-1),0,i/(sections.length-1),1);colors.push(...s.rgba,...s.rgba);if(i){const v=(i-1)*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}}
   return {kind:'ribbon',sections,positions,uvs,colors,indices,blend:l.blend,order:l.order};
  }
  function sample(seconds,poses){
   number(seconds,'time',0,3600);const result={emitters:[],core:[],ribbon:[],orbit:[]};let vertices=0;
   for(const e of c.emitters){const info={id:e.id,layers:{}};result.emitters.push(info);for(const k of LAYERS){const l=e.layers[k],b=basis(e.anchor,l,poses,e.id,k),raw=seconds-l.delayFrames/FPS,t=phase(raw),d=distance(t),p=point(d),head=b?world(p,b):null;info.layers[k]={origin:b?{x:b.x,y:b.y}:null,head,distance:d};if(!e.enabled||!active(l)||!b||!loop&&(raw<0||raw>=duration||seconds>=duration))continue;const a=Math.min(envelope(t),loop?1:clamp((duration-seconds)/(c.fadeFrames/FPS),0,1))*l.opacity;if(a<=0)continue;const list=result[k],add=v=>list.push({...v,emitterId:e.id,blend:l.blend,order:l.order});
    if(k==='core'){const r=c.coreRadius*C.evaluate(c.curves.pulse,t/duration)*b.scale;add({kind:'disc',...head,radius:r,rgba:rgba(k,0,a)});if(c.glow>0)add({kind:'glow',...head,radius:r*(1+c.glow),rgba:rgba(k,.5,a*Math.min(1,c.glow)*.4)});}
    if(k==='ribbon'&&speed>0&&c.tailLength>0){const plan=plans[e.id],r=ribbon(d,t,b,l,plan.distances,a);if(r){vertices+=r.positions.length/2;add(r);}live(plan.trail,t,c.trailLifeFrames,(event,age)=>{const q=world(point(event.distance),b),u=age/(c.trailLifeFrames/FPS);add({kind:'disc',...q,radius:c.particleSize*b.scale*(1-u*.5),rgba:rgba(k,u,a*C.evaluate(c.curves.alpha,u))});});}
    if(k==='orbit'){const ds=plans[e.id].orbitDistances;live(plans[e.id].orbit,t,c.orbitLifeFrames,(event,age)=>{const u=age/(c.orbitLifeFrames/FPS),theta=ds[event.index%ds.length]/(c.coreRadius*1.5)+TAU*rng(l.seed,0,19)+age*TAU,rr=c.coreRadius*1.5*b.scale;const pulse=.65+.35*Math.cos(TAU*c.orbitPulseHz*age);add({kind:'disc',x:head.x+Math.cos(theta+b.rotation*RAD)*rr,y:head.y+Math.sin(theta+b.rotation*RAD)*rr,radius:c.particleSize*b.scale,rgba:rgba(k,u,a*pulse)});});}
   }}
   if(vertices>MAX_VERTICES||LAYERS.reduce((n,k)=>n+result[k].length,0)>BUDGETS[c.quality])fail('sample budget');return result;
  }
  return Object.freeze({settings:c,meta:freeze({frames,duration,requestedSpeed:c.travelSpeed,actualSpeed:speed,flightEnd,impact,path,length:L,errorBound:table.errorBound,plans,eventCount,primitiveBound,vertexBound}),sample,headAt:t=>{number(t,'time',0,3600);const d=distance(phase(t));return {...point(d),travelled:d};}});
 }
 return {VERSION:1,FPS,LAYERS,BUDGETS,defaults,newEmitter,normalize,compile};
});
