// GAME-03 S02: fixed authored-frame history; never mutate the live Spine model.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxSwordSlash||(typeof require==='function'?require('./sword-slash-core.js'):null),root.FxSwordSlashAnchors||(typeof require==='function'?require('./sword-slash-anchors.js'):null),root.FxSwordSlashPose||(typeof require==='function'?require('./sword-slash-pose.js'):null),root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSwordSlashHistory=api;
})(globalThis,function(H,A,Pose,P,S,C,K){
 'use strict';
 const FPS=60,RAD=Math.PI/180,EPS=1e-8,MAX=512,LAYERS=H.LAYERS;
 const fail=m=>{throw TypeError('Sword Slash history: '+m);};
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),finite=Number.isFinite;
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function number(x,lo,hi){if(!finite(x)||x<lo||x>hi)fail('number');return x;}
 function defaults(){return {schemaVersion:1,effect:H.defaults(),anchors:A.defaults(),trajectory:Object.fromEntries(LAYERS.map(k=>[k,'authored'])),teleportThreshold:128};}
 function config(v){
  if(!v||typeof v!=='object'||Object.keys(v).length!==5||v.schemaVersion!==1||!Object.hasOwn(v,'effect')||!Object.hasOwn(v,'anchors')||!Object.hasOwn(v,'trajectory')||!Object.hasOwn(v,'teleportThreshold'))fail('preset shape');
  const tr=v.trajectory;if(!tr||typeof tr!=='object'||Object.keys(tr).length!==3||LAYERS.some(k=>!Object.hasOwn(tr,k)||!['authored','recorded'].includes(tr[k])))fail('trajectory mode');
  return {anchors:A.normalizeMap(v.anchors),trajectory:Object.freeze({...tr}),teleportThreshold:number(v.teleportThreshold,1,10000)};
 }
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function lerp(a,b,u){return a+(b-a)*u;}
 function interpolate(a,b,t){const u=b.time===a.time?0:clamp((t-a.time)/(b.time-a.time),0,1);return {time:t,x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u),d:lerp(a.d,b.d,u)};}
 function byTime(run,t){if(t<=run[0].time)return {...run[0]};if(t>=run.at(-1).time)return {...run.at(-1)};let i=1;while(run[i].time<t)i++;return interpolate(run[i-1],run[i],t);}
 function byDistance(run,d){let i=1;while(i<run.length&&run[i].d<d)i++;if(i>=run.length)return {...run.at(-1)};const a=run[i-1],b=run[i],u=b.d===a.d?0:clamp((d-a.d)/(b.d-a.d),0,1);return interpolate(a,b,lerp(a.time,b.time,u));}
 function direction(a,b){const d=dist(a,b);return d>EPS?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:null;}
 function history(raw,threshold,c,k,times){
  const runs=[];let run=null,prev=null,total=0;
  for(const q of raw){
   if(q===null){run=null;prev=null;continue;}
   if(!prev||dist(prev,q)>threshold){run=[];runs.push(run);run.push({...q,d:total});}
   else{total+=dist(prev,q);run.push({...q,d:total});}
   prev=q;
  }
  const valid=runs.filter(r=>r.length>=2&&r.at(-1).d-r[0].d>EPS);
  let events=[],rejected=0;
  if(c.triggerMode==='time'){
   for(const t of times){const r=valid.find(r=>t>=r[0].time-EPS&&t<=r.at(-1).time+EPS);if(r)events.push(byTime(r,t));else rejected++;}
  }else if(total>EPS){
   const path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[total/3,0],p2:[2*total/3,0],p3:[total,0]}]};
   const p=S.createSpatialPlacement({path,baseSpacingPx:c.gap,minSpacing:c.minGap,maxSpacing:c.maxGap,spacingCurve:c.spacingCurveEnabled?c.curves.spacing:null,mode:c.distribution,jitter:c.spatialJitter,seed:c.layers[k].seed,maxPoints:MAX});
   if(p.capped)fail('recorded placement cap');
   for(const d of [0,...p.points.map(v=>v.distance)]){
    const r=valid.find(r=>d>=r[0].d-EPS&&d<=r.at(-1).d+EPS);
    if(r){const q=byDistance(r,d);if(!events.length||q.time>events.at(-1).time+EPS&&q.time-events.at(-1).time+EPS>=c.minIntervalFrames/FPS)events.push(q);else rejected++;}else rejected++;
   }
  }
  // Keep endpoints of each run independent of emission density. Interior
  // samples are actual time/distance triggers; no interpolation across gaps.
  const sampled=valid.map(r=>{
   const a=r[0],b=r.at(-1),turns=[];
   // A low emission rate must not erase a reversal of the recorded weapon.
   // Keep geometric turn vertices separate from the authored event schedule.
   let incoming=null,arrival=null;
   for(let i=1;i<r.length;i++){
    const next=direction(r[i-1],r[i]);if(!next)continue;
    if(incoming&&incoming.x*next.x+incoming.y*next.y<=0)turns.push(arrival);
    incoming=next;arrival=r[i];
   }
   const interior=[...turns,...events.filter(v=>v.time>a.time+EPS&&v.time<b.time-EPS&&v.d>a.d+EPS&&v.d<b.d-EPS)].sort((x,y)=>x.time-y.time);
   const list=[a,...interior,b];
   return list.filter((v,i)=>!i||v.d-list[i-1].d>EPS);
  }).filter(r=>r.length>=2);
  if(sampled.reduce((n,r)=>n+r.length,0)>MAX)fail('history section cap');
  return freeze({raw:valid,runs:sampled,total,events,rejected});
 }
 function record({plan,anchors,trajectory,teleportThreshold,historyAsset,poseOptions,loader,host,world,model,Spine}){
  const c=plan.settings,keys=LAYERS.filter(k=>trajectory[k]==='recorded'&&c.layers[k].enabled&&c.layers[k].opacity>0);
  if(!keys.length)return {};
  if(!historyAsset?.model||historyAsset.model===model||historyAsset.model.destroyed||!loader||typeof loader.anchorPoses!=='function')fail('recording requires separate Spine model');
  if(!historyAsset.model.parent)fail('recording model requires logical scene parent');
  const raw=Object.fromEntries(keys.map(k=>[k,[]])),end=c.sweepFrames-1,maxDelay=Math.max(...keys.map(k=>c.layers[k].delayFrames));
  for(let f=0;f<=end+maxDelay;f++){
   Pose.pose(historyAsset,f/FPS,{...poseOptions,visible:false},loader);
   for(const k of keys){const l=c.layers[k],local=f-l.delayFrames;if(local<0||local>end)continue;
    const p=A.resolve(anchors[k],{host,world,model:historyAsset.model,Spine});
    if(!p){raw[k].push(null);continue;}
    const a=p.rotation*RAD;raw[k].push({time:local/FPS,x:p.x+l.x*Math.cos(a)-l.y*Math.sin(a),y:p.y+l.x*Math.sin(a)+l.y*Math.cos(a)});
   }
  }
  const duration=end/FPS;
  return Object.fromEntries(keys.map(k=>[k,history(raw[k],teleportThreshold,c,k,plan.meta.events[k].map(e=>e.time).filter(t=>t<duration))]));
 }
 function sampleRecorded(h,c,k,t){
  const l=c.layers[k],life=c.lifetimeFrames/FPS;if(!h||!l.enabled||!l.opacity||t<0||h.total<=EPS)return [];
  const width={start:c.startWidth,middle:c.middleWidth,end:c.endWidth,startTaper:0,endTaper:0,minVisiblePx:0,curve:c.curves.width},result=[];
  function color(age,gain){const rgba=K.sample(c.palettes[k],clamp(age,0,1));rgba[3]*=age>=1?0:clamp(l.opacity*gain*C.evaluate(c.curves.alpha,clamp(age,0,1)),0,1);return rgba;}
  let slices=h.runs.map((r,i)=>({r,raw:h.raw[i],lo:Math.max(r[0].time,t-life),hi:Math.min(r.at(-1).time,t)})).filter(v=>v.hi-v.lo>EPS);
  if(k==='edge')slices=slices.slice(-1);
  let count=0;
  if(k==='main'||k==='edge'&&c.edgeGlow>0||k==='residual'&&c.glowEnabled)for(const {r,raw,lo,hi} of slices){
   // Clip time and distance on the original recorded motion, not the emission-decimated geometry.
   const a=byTime(raw,lo),b=byTime(raw,hi),start=k==='edge'&&b.d-a.d>6?byDistance(raw,b.d-6):a;
   const points=[start,...r.filter(v=>v.time>start.time+EPS&&v.time<hi-EPS&&v.d>start.d+EPS&&v.d<b.d-EPS),b].filter((v,i,all)=>!i||dist(v,all[i-1])>EPS);
   if(points.length<2)continue;count+=points.length;if(count>MAX)fail('visible history cap');
   const positions=[],uvs=[],indices=[],sections=[],colors=[];
   for(let i=0;i<points.length;i++){
    const p=points[i],a=direction(points[Math.max(0,i-1)],p),b=direction(p,points[Math.min(points.length-1,i+1)]),u=clamp(p.d/h.total,0,1),age=Math.max(0,(t-p.time)/life),rgba=color(age,k==='edge'?c.edgeGlow:k==='residual'?.25:1);
    const v=a||b,w=b||a,dx=-v.y-w.y,dy=v.x+w.x,n=Math.hypot(dx,dy),nx=n>EPS?dx/n:-w.y,ny=n>EPS?dy/n:w.x,m=clamp(1/Math.max(.5,nx*(-w.y)+ny*w.x),1,2);
    const base=P.widthAt(width,u),size=k==='edge'?Math.min(3,base*.15):k==='residual'?base*1.5:base,half=size*m/2;
    positions.push(p.x+nx*half,p.y+ny*half,p.x-nx*half,p.y-ny*half);uvs.push(u,0,u,1);colors.push(...rgba,...rgba);sections.push({distance:p.d,x:p.x,y:p.y,width:size,age,rgba});
    if(i+1<points.length)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);
   }
   if(sections.some(s=>s.width>0&&s.rgba[3]>0))result.push({kind:'ribbon',positions,uvs,indices,colors,sections,blend:l.blend});
  }
  if(k==='residual'&&c.sparksEnabled){
   const birth=c.contactFrame/FPS,dt=t-birth,span=c.sparkLifetimeFrames/FPS,r=h.raw.find(r=>birth>=r[0].time&&birth<=r.at(-1).time);
   if(r&&dt>=0&&dt<span-1e-12){
    const p=byTime(r,birth),before=byTime(r,birth-1/FPS),after=byTime(r,birth+1/FPS),v=direction(before,after);
    if(v){const age=dt/span,rgba=color(age,1),base=Math.atan2(v.y,v.x)+l.rotation*RAD;
     const rand=(i,s)=>{let x=l.seed^Math.imul(i+1,0x9e3779b1)^Math.imul(s+1,0x85ebca6b);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;};
     if(rgba[3]>0)for(let i=0;i<c.sparkCount;i++){const a=base+(rand(i,1)-.5)*Math.PI,d=c.sparkSpeed*(.5+.5*rand(i,2))*dt*(1-age*.5);result.push({kind:'spark',index:i,x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d,radius:1.5*(1-age*.8),rgba:rgba.slice(),blend:l.blend});}
    }
   }
  }
  return result;
 }
 function prepare(input){const v=config(input),plan=H.compile(input.effect);return {v,plan,settings:freeze({schemaVersion:1,effect:plan.settings,...v})};}
 function normalizeSettings(input){return prepare(input).settings;}
 function createCompiler({host,world,model=null,Spine=null,historyAsset=null,poseOptions={},loader=null}){
  return function(input){
   const {v,plan,settings}=prepare(input),recorded=record({plan,...v,historyAsset,poseOptions,loader,host,world,model,Spine});
   function resolvePoses(){const poses=Object.fromEntries(LAYERS.map(k=>[k,v.trajectory[k]==='recorded'?null:A.resolve(v.anchors[k],{host,world,model,Spine})]));return {poses,missing:LAYERS.filter(k=>settings.effect.layers[k].enabled&&(v.trajectory[k]==='recorded'?!recorded[k]?.runs.length:!poses[k]))};}
   return Object.freeze({settings,meta:freeze({...plan.meta,recorded}),resolvePoses,sample(t){number(t,0,3600);const out=plan.sample(t,resolvePoses().poses);for(const k of LAYERS)if(v.trajectory[k]==='recorded')out[k]=sampleRecorded(recorded[k],settings.effect,k,t-settings.effect.layers[k].delayFrames/FPS);return out;}});
  };
 }
 return {VERSION:1,defaults,normalizeSettings,createCompiler};
});
