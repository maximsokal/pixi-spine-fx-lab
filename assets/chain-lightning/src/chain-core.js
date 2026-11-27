// ELEC-02 L01 — deterministic Chain Lightning, no renderer or browser ownership.
(function(root,make){
 'use strict';
 const load=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
 const api=Object.freeze(make(load('FxCurves','../../template/src/curve-core.js'),load('FxSpacing','../../template/src/spacing-core.js'),load('FxPath','../../template/src/path-core.js'),load('FxColors','../../template/src/color-core.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxChainLightning=api;
})(globalThis,function(C,S,P,K){
 'use strict';
 if(!C||!S||!P||!K)throw Error('Chain Lightning dependencies');
 const FPS=60,TAU=2*Math.PI,RAD=Math.PI/180,EPS=1e-8,MAX_EVENTS=4096,MAX_VERTICES=8192,LAYERS=Object.freeze(['arcs','branches','glow']),BUDGETS=Object.freeze({low:256,balanced:1024,high:2048});
 const fail=m=>{throw RangeError('Chain Lightning: '+m);},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>((v%n)+n)%n;
 function exact(o,keys,k){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(x=>!Object.hasOwn(o,x)))fail(k);}
 function dense(v){if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('sparse array');dense(v[i]);}}else if(v&&typeof v==='object')Object.values(v).forEach(dense);}
 function num(v,k,a,b,i=false){if(!Number.isFinite(v)||v<a||v>b||i&&!Number.isInteger(v))fail(k);return v;}
 function choice(v,k,values){if(!values.includes(v))fail(k);return v;}
 function bool(v,k){if(typeof v!=='boolean')fail(k);return v;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function rand(seed,i,salt){let n=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296;}
 const MAX_LINK=1024,MAX_SEGMENTS=8,SPARK_REACH=100;
 const specs={
  jump:['jumpTiming','effectTime','normalized-duration','normalized',[0,1],[[0,0],[.2,.25],[.5,.75],[1,1]]],
  width:['widthMultiplier','pathPosition','normalized-path','normalized',[0,2],[[0,.7],[.4,1],[1,.1]]],
  glow:['glowDecay','emitterTime','normalized-duration','multiplier',[0,1],[[0,1],[.6,.5],[1,0]]],
  rate:['emissionRate','emitterTime','normalized-duration','multiplier',[0,4],[[0,1],[1,1]]],
  interval:['emissionInterval','emitterTime','normalized-duration','multiplier',[.05,4],[[0,1],[1,1]]],
  spacing:['spacingPx','pathPosition','normalized-path','px',[2,90],[[0,12],[1,12]]],
  alpha:['alphaOverLife','particleAge','normalized-lifetime','multiplier',[0,1],[[0,1],[1,0]]]
 };
 function curve(k){const [parameterKey,domain,inputUnit,valueUnit,valueRange,keys]=specs[k];return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit,valueUnit,valueRange,inputRange:[0,1],defaultValue:keys[0][1],clamp:'hold',monotonic:k==='jump',keys:keys.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function palette(k){return K.normalize({schemaVersion:1,parameterKey:k+'Palette',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'head',position:0,rgba:[244,251,255,1]},{id:'mid',position:.5,rgba:[102,191,255,.85]},{id:'end',position:1,rgba:[104,86,246,0]}]});}
 function anchor(x=0,y=0){return {type:'world',space:'world',name:'',slot:'',x,y,rotation:0};}
 function newTarget(id='target-1',x=144,y=192,seed=4109){return {id,enabled:true,anchor:anchor(x,y),x:0,y:0,delayFrames:0,seed,layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,visible:true,x:0,y:0,delayFrames:0,seed:seed+i,opacity:1,blend:'add',order:k==='glow'?'behind':'front'}]))};}
 const ranges={durationFrames:[6,3600,true],fadeFrames:[1,120,true],arcWidth:[1,24],jumpDelay:[0,40],arcGap:[2,90],branchSpread:[0,160],jitter:[0,1],smoothness:[0,1],arcLifeFrames:[1,120,true],branchLifeFrames:[1,120,true],glowLifeFrames:[1,120,true],branchCount:[0,4,true],branchLength:[2,80],branchWidthRatio:[.1,1],sparkGap:[15,100],sparkSize:[.25,15],sparkSpeed:[0,500],glowRadius:[2,100],glowStrength:[0,2],restrikeRate:[0,120],intervalFrames:[.25,600],minIntervalFrames:[0,120],timeJitter:[0,.45],minGap:[2,90],maxGap:[2,90],spatialJitter:[0,.45]};
 function defaults(){return {schemaVersion:1,mode:'oneShot',quality:'balanced',durationFrames:40,fadeFrames:8,arcWidth:4,jumpDelay:5,arcGap:12,branchSpread:25,jitter:.45,smoothness:.2,arcLifeFrames:10,branchLifeFrames:12,glowLifeFrames:14,branchCount:2,branchLength:25,branchWidthRatio:.45,sparkGap:30,sparkSize:2,sparkSpeed:65,glowRadius:18,glowStrength:1,restrikes:false,restrikeRate:12,frequencySource:'rate',intervalFrames:5,minIntervalFrames:1,timeJitter:.25,minGap:2,maxGap:90,spatialJitter:0,spacingCurveEnabled:false,source:anchor(64,256),targets:[[144,192],[240,280],[340,180],[440,256]].map(([x,y],i)=>newTarget('target-'+(i+1),x,y,4109+i*3)),curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,palette(k)]))};}
 function normalizeAnchor(a){exact(a,['type','space','name','slot','x','y','rotation'],'anchor');choice(a.type,'anchor type',['world','skeleton','bone','slot','attachment']);choice(a.space,'anchor space',['world','local']);if(a.type==='world'&&a.space!=='world')fail('anchor space');for(const k of ['name','slot'])if(typeof a[k]!=='string'||a[k].length>256)fail('anchor name');if(['bone','slot','attachment'].includes(a.type)&&!a.name.trim()||a.type==='attachment'&&!a.slot.trim())fail('anchor identity');return {...a,x:num(a.x,'anchor x',-10000,10000),y:num(a.y,'anchor y',-10000,10000),rotation:num(a.rotation,'anchor rotation',-360,360)};}
 function normalize(input){
  exact(input,Object.keys(defaults()),'preset shape');dense(input);if(input.schemaVersion!==1||input.mode!=='oneShot')fail('version/mode');
  const o={schemaVersion:1,mode:'oneShot'};for(const [k,r] of Object.entries(ranges))o[k]=num(input[k],k,...r);
  o.quality=choice(input.quality,'quality',Object.keys(BUDGETS));o.frequencySource=choice(input.frequencySource,'frequency',['rate','interval']);o.restrikes=bool(input.restrikes,'restrikes');o.spacingCurveEnabled=bool(input.spacingCurveEnabled,'spacing curve');if(o.minGap>o.maxGap||o.fadeFrames>=o.durationFrames-1)fail('phase/gap bounds');
  exact(input.curves,Object.keys(specs),'curves');o.curves={};for(const k of Object.keys(specs)){const c=C.normalize(input.curves[k]),d=curve(k);for(const f of ['parameterKey','domain','inputUnit','valueUnit','clamp','monotonic'])if(c[f]!==d[f])fail('curve binding '+k);if(c.valueRange.some((v,i)=>v!==d.valueRange[i]))fail('curve range');if(k==='jump'&&(c.keys[0].y!==0||c.keys.at(-1).y!==1))fail('jump endpoints');o.curves[k]=c;}
  exact(input.palettes,LAYERS,'palettes');o.palettes=Object.fromEntries(LAYERS.map(k=>{const p=K.normalize(input.palettes[k]),d=palette(k);if(p.parameterKey!==d.parameterKey||p.domain!==d.domain||p.inputUnit!==d.inputUnit)fail('palette binding');return [k,p];}));
  o.source=normalizeAnchor(input.source);if(!Array.isArray(input.targets)||input.targets.length<2||input.targets.length>8)fail('target count');const ids=new Set(['source']);
  o.targets=input.targets.map(t=>{exact(t,['id','enabled','anchor','x','y','delayFrames','seed','layers'],'target');if(typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(t.id)||ids.has(t.id))fail('target id');ids.add(t.id);exact(t.layers,LAYERS,'layers');return {id:t.id,enabled:bool(t.enabled,'target enabled'),anchor:normalizeAnchor(t.anchor),x:num(t.x,'offset x',-10000,10000),y:num(t.y,'offset y',-10000,10000),delayFrames:num(t.delayFrames,'target delay',0,120,true),seed:num(t.seed,'target seed',-2147483648,2147483647,true),layers:Object.fromEntries(LAYERS.map(k=>{const l=t.layers[k];exact(l,['enabled','visible','x','y','delayFrames','seed','opacity','blend','order'],'layer');return [k,{enabled:bool(l.enabled,k),visible:bool(l.visible,k),x:num(l.x,k,-10000,10000),y:num(l.y,k,-10000,10000),delayFrames:num(l.delayFrames,k,0,120,true),seed:num(l.seed,k,-2147483648,2147483647,true),opacity:num(l.opacity,k,0,1),blend:choice(l.blend,k,['normal','add']),order:choice(l.order,k,['behind','front'])}];}))};});return freeze(o);
 }
 const hash=s=>[...s].reduce((h,c)=>Math.imul(h,31)+c.charCodeAt(0)|0,0),active=l=>l.enabled&&l.visible&&l.opacity>0;
 const life=(c,k)=>(k==='arcs'?c.arcLifeFrames:k==='branches'?c.branchLifeFrames:c.glowLifeFrames)/FPS;
 function linkPath(a,b,c,seed,ordinal,heading=0){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<EPS||d>MAX_LINK)return null;const points=[[a.x,a.y]],n=Math.min(MAX_SEGMENTS,Math.max(1,Math.ceil(d/c.arcGap)));
  for(let i=1;i<n;i++){const u=i/n,off=(rand(seed,ordinal,i)*2-1)*c.jitter*Math.min(c.arcGap,d/n)*.45;points.push([a.x+dx*u-dy/d*off,a.y+dy*u+dx/d*off]);}points.push([b.x,b.y]);
  const path={schemaVersion:1,closed:false,segments:points.slice(1).map((b,i)=>{const a=points[i];return {p0:a,p1:a.map((v,j)=>v+(b[j]-v)/3),p2:a.map((v,j)=>v+(b[j]-v)*2/3),p3:b};})};const angle=mod(heading,360)*RAD;if(angle!==0){const s=path.segments[0],x=s.p1[0]-s.p0[0],y=s.p1[1]-s.p0[1],co=Math.cos(angle),si=Math.sin(angle);s.p1=[s.p0[0]+x*co-y*si,s.p0[1]+x*si+y*co];}return P.smoothPath(path,c.smoothness);
 }
 const width=(c,m=1)=>({start:c.arcWidth*m,middle:c.arcWidth*m,end:c.arcWidth*m,curve:c.curves.width,minVisiblePx:0});
 function mesh(r){return {positions:Array.from(r.positions),uvs:Array.from(r.uvs),indices:Array.from(r.indices),sections:r.samples.map(s=>({x:s.x,y:s.y,distance:s.distance,width:s.width})),length:r.table.length,errorBound:r.table.errorBound};}
 function pose(a,id,poses,x=0,y=0){const b=a.type==='world'?{x:a.x,y:a.y,rotation:a.rotation,scale:1}:poses?.[id];if(!b||![b.x,b.y,b.rotation,b.scale].every(Number.isFinite)||b.scale<=0||b.scale>100)return null;const r=b.rotation*RAD,p={x:b.x+b.scale*(x*Math.cos(r)-y*Math.sin(r)),y:b.y+b.scale*(x*Math.sin(r)+y*Math.cos(r)),rotation:b.rotation,scale:b.scale};return Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6?p:null;}
 function offset(b,l){return pose({type:'bone'},'layer',{layer:b},l.x,l.y);}
 function compile(input){
  const c=normalize(input),end=(c.durationFrames-1)/FPS,duration=c.durationFrames/FPS,plans=[],overflow=[],sweep=[];let eventCount=0;
  // Ribbon sample count includes fixed gap, endpoints, midpoint and up to 8 cubic boundaries.
  const mainVertices=2*(Math.ceil(MAX_LINK/c.arcGap)+MAX_SEGMENTS+3),branchVertices=2*(Math.ceil(c.branchLength/c.arcGap)+5),sparkBound=Math.floor(SPARK_REACH/c.sparkGap)+1;
  const cap={arcs:{primitives:1,vertices:mainVertices},branches:{primitives:c.branchCount+sparkBound,vertices:c.branchCount*branchVertices+4*sparkBound},glow:{primitives:1,vertices:4}};
  for(let i=0;i<c.targets.length;i++){const t=c.targets[i],from=i?c.targets[i-1].id:'source',edge=from+'>'+t.id,seed=t.seed^hash(edge),frame=2+c.jumpDelay*(c.targets.length-1)*C.evaluate(c.curves.jump,i/(c.targets.length-1))+t.delayFrames,contact=frame/FPS,events=[];
   if(t.enabled&&contact<end){events.push({id:0,time:contact});if(c.restrikes){const schedule=S.createTemporalSchedule({schemaVersion:1,mode:'custom',frequencySource:c.frequencySource,baseRate:c.restrikeRate,interval:c.intervalFrames/FPS,duration:end-contact,minInterval:c.minIntervalFrames/FPS,jitter:c.timeJitter,seed,maxEvents:MAX_EVENTS,rateCurve:c.curves.rate,intervalCurve:c.curves.interval});if(schedule.capped)fail('event budget');for(const ev of schedule.events)if(ev.time>EPS&&contact+ev.time<end&&ev.time+EPS>=c.minIntervalFrames/FPS)events.push({id:ev.index+1,time:contact+ev.time});}}else if(t.enabled)overflow.push(t.id);
   eventCount+=events.length;if(eventCount>MAX_EVENTS)fail('whole effect event budget');
   const layers={};for(const k of LAYERS){const l=t.layers[k],list=t.enabled&&active(l)?events.map(e=>({...e,time:e.time+l.delayFrames/FPS})).filter(e=>e.time<end):[],bound=cap[k],span=life(c,k);layers[k]={events:list,life:span,...bound};for(const e of list){const stop=Math.min(end,e.time+span);sweep.push([e.time,bound.primitives,bound.vertices],[stop,-bound.primitives,-bound.vertices]);}}
   plans.push({id:t.id,from,edge,contactFrame:frame,contact,events,layers});
  }
  sweep.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let pc=0,vc=0,primitiveBound=0,vertexBound=0;for(const [,p,v] of sweep){pc+=p;vc+=v;primitiveBound=Math.max(primitiveBound,pc);vertexBound=Math.max(vertexBound,vc);}if(primitiveBound>BUDGETS[c.quality]||vertexBound>MAX_VERTICES)fail('whole effect live budget');
  const meta=freeze({frames:c.durationFrames,duration,loop:false,eventCount,primitiveBound,vertexBound,overflow,plans,capacity:cap,maxLink:MAX_LINK});
  function sample(seconds,poses){
   num(seconds,'sample time',0,3600);const source=pose(c.source,'source',poses),resolved=c.targets.map(t=>t.enabled?pose(t.anchor,t.id,poses,t.x,t.y):null),out={source,targets:c.targets.map((t,i)=>({id:t.id,pose:resolved[i]})),arcs:[],branches:[],glow:[],missing:[],overflow:meta.overflow.slice(),capacityExceeded:[]};let vertices=0;
   if(!source)out.missing.push('source');for(let i=0;i<c.targets.length;i++)if(c.targets[i].enabled&&!resolved[i])out.missing.push(c.targets[i].id);
   if(seconds<0||seconds>=end)return out;const fade=clamp((end-seconds)*FPS/c.fadeFrames,0,1);
   for(let i=0;i<c.targets.length;i++){const t=c.targets[i],plan=plans[i],a=i?resolved[i-1]:source,b=resolved[i];if(!b)continue;const cache=new Map();
    function geometry(ev){if(cache.has(ev.id))return cache.get(ev.id);let result=null;
     if(a){const dist=Math.hypot(b.x-a.x,b.y-a.y);if(dist>MAX_LINK){if(!out.capacityExceeded.includes(plan.edge))out.capacityExceeded.push(plan.edge);}else if(dist>EPS){const path=linkPath(a,b,c,t.seed^hash(plan.edge)^t.layers.arcs.seed,ev.id,i===0?a.rotation:0),table=S.buildArcTable(path,{tolerancePx:.0625});if(table.length<=MAX_LINK)result={path,table};else if(!out.capacityExceeded.includes(plan.edge))out.capacityExceeded.push(plan.edge);}}
     cache.set(ev.id,result);return result;
    }
    for(const k of LAYERS){const l=t.layers[k],p=plan.layers[k],origin=offset(b,l);if(!origin)continue;const dx=origin.x-b.x,dy=origin.y-b.y,seed=l.seed^t.seed^hash(plan.edge);
     for(const ev of p.events){const age=seconds-ev.time;if(age<0||age>=p.life)continue;const f=age/p.life,rgba=K.sample(c.palettes[k],f);rgba[3]*=C.evaluate(c.curves.alpha,f)*fade*l.opacity*(k==='glow'?C.evaluate(c.curves.glow,f)*c.glowStrength:1);rgba[3]=clamp(rgba[3],0,1);if(rgba[3]<=0)continue;
      const id=plan.edge+':'+ev.id,common={emitterId:t.id,blend:l.blend,order:l.order,rgba};
      const ribbon=(r,key)=>{const m=mesh(r);if(!m.positions.length)return;vertices+=m.positions.length/2;const sections=m.sections.map(q=>({...q,x:q.x+dx,y:q.y+dy}));out[k].push({...common,kind:'ribbon',id:id+':'+key,...m,sections,positions:m.positions.map((v,j)=>v+(j%2?dy:dx))});};
      const disc=(q,key,radius)=>{vertices+=4;out[k].push({...common,kind:'disc',id:id+':'+key,x:q.x,y:q.y,radius});};
      if(k==='glow'){const variation=l.seed===t.seed+2?1:1-.1*rand(seed,ev.id,300);disc(origin,'glow',c.glowRadius*b.scale*(1+.25*f)*variation);continue;}
      const g=geometry(ev);
      if(k==='arcs'){if(g)ribbon(P.buildRibbon({path:g.path,width:width(c),quality:'high',sampleSpacingPx:c.arcGap,tolerancePx:.0625}),'main');continue;}
      if(g&&c.branchCount){const placement=S.createSpatialPlacement({path:g.path,baseSpacingPx:c.arcGap,minSpacing:c.minGap,maxSpacing:c.maxGap,spacingCurve:c.spacingCurveEnabled?c.curves.spacing:null,mode:'even',jitter:c.spatialJitter,seed,maxPoints:4096,tolerancePx:.0625});const candidates=placement.points.filter(q=>q.distance>EPS&&q.distance<g.table.length-EPS).slice(-c.branchCount);
       const branches=candidates.map((q,j)=>{const angle=(rand(seed,ev.id,20+j)*2-1)*c.branchSpread*RAD,tip=[c.branchLength*Math.cos(angle),c.branchLength*Math.sin(angle)],path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:tip.map(v=>v/3),p2:tip.map(v=>v*2/3),p3:tip}]};return {id:'root.branch.'+j,parentId:'root',attachDistancePx:q.distance,widthRatio:c.branchWidthRatio,path};});
       if(branches.length){const graph=P.buildGraph({schemaVersion:1,seed,quality:'high',sampleSpacingPx:c.arcGap,root:{id:'root',path:g.path,width:width(c)},branches});for(const row of graph.branches.slice(1))ribbon(row,row.id);}
      }
      const reach=g?Math.min(SPARK_REACH,g.table.length):0;for(let j=0;j<=Math.floor(reach/c.sparkGap);j++){const q=g?S.pointAtDistance(g.table,g.table.length-j*c.sparkGap):b,angle=rand(seed,ev.id,100+j)*TAU;disc({x:q.x+dx+Math.cos(angle)*age*c.sparkSpeed,y:q.y+dy+Math.sin(angle)*age*c.sparkSpeed},'spark-'+j,c.sparkSize*b.scale*(1-.6*f));}
     }
    }
   }
   if(out.arcs.length+out.branches.length+out.glow.length>primitiveBound||vertices>vertexBound)fail('sample exceeded compiled budget');return out;
  }
  return Object.freeze({settings:c,meta,sample});
 }
 return {VERSION:1,FPS,LAYERS,BUDGETS,MAX_EVENTS,MAX_VERTICES,MAX_LINK,defaults,newTarget,normalize,compile};
});
