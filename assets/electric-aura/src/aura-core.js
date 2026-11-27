// ELEC-03 A01 — deterministic Electric Aura, no renderer or browser ownership.
(function(root,make){
 'use strict';
 const load=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
 const api=Object.freeze(make(load('FxCurves','../../template/src/curve-core.js'),load('FxSpacing','../../template/src/spacing-core.js'),load('FxPath','../../template/src/path-core.js'),load('FxColors','../../template/src/color-core.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxElectricAura=api;
})(globalThis,function(C,S,P,K){
 'use strict';
 if(!C||!S||!P||!K)throw Error('Electric Aura dependencies');
 const FPS=60,TAU=2*Math.PI,RAD=Math.PI/180,EPS=1e-8,MAX_EVENTS=4096,MAX_VERTICES=8192,LAYERS=Object.freeze(['halo','arcs','sparks']),BUDGETS=Object.freeze({low:256,balanced:1024,high:2048});
 const fail=m=>{throw RangeError('Electric Aura: '+m);},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>((v%n)+n)%n;
 function loopSeconds(seconds,frames,delayFrames=0){
  const nearest=Math.round(seconds*FPS);
  if(Math.abs(seconds-nearest/FPS)<=1e-9)return mod(nearest-delayFrames,frames)/FPS;
  const duration=frames/FPS,rest=(seconds-delayFrames/FPS)%duration;
  return rest<0?rest+duration:rest||0;
 }
 function exact(o,keys,k){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(x=>!Object.hasOwn(o,x)))fail(k);}
 function dense(v){if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('sparse array');dense(v[i]);}}else if(v&&typeof v==='object')Object.values(v).forEach(dense);}
 function num(v,k,a,b,i=false){if(!Number.isFinite(v)||v<a||v>b||i&&!Number.isInteger(v))fail(k);return v;}
 function choice(v,k,values){if(!values.includes(v))fail(k);return v;}
 function bool(v,k){if(typeof v!=='boolean')fail(k);return v;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function rand(seed,i,salt){let n=seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296;}
 const specs={
  frequency:['arcFrequency','effectTime','normalized-duration','multiplier',[0,4],[[0,.55],[.4,1],[1,.55]]],
  glow:['glowPulse','effectTime','normalized-duration','multiplier',[0,2],[[0,.8],[.5,1],[1,.8]]],
  width:['widthMultiplier','pathPosition','normalized-path','normalized',[0,2],[[0,.2],[.3,1],[1,0]]],
  rate:['emissionRate','emitterTime','normalized-duration','multiplier',[0,4],[[0,1],[1,1]]],
  interval:['emissionInterval','emitterTime','normalized-duration','multiplier',[.05,4],[[0,1],[1,1]]],
  spacing:['spacingPx','pathPosition','normalized-path','px',[2,80],[[0,15],[1,15]]],
  alpha:['alphaOverLife','particleAge','normalized-lifetime','multiplier',[0,1],[[0,1],[1,0]]]
 };
 function curve(k){const [parameterKey,domain,inputUnit,valueUnit,valueRange,keys]=specs[k];return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit,valueUnit,valueRange,inputRange:[0,1],defaultValue:keys[0][1],clamp:'hold',monotonic:false,keys:keys.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function palette(k){const halo=k==='halo';return K.normalize({schemaVersion:1,parameterKey:k+'Palette',domain:halo?'effectTime':'particleAge',inputUnit:halo?'normalized-duration':'normalized-lifetime',space:'srgb',clamp:'hold',stops:halo?[{id:'head',position:0,rgba:[96,198,255,.65]},{id:'mid',position:.5,rgba:[223,250,255,.8]},{id:'end',position:1,rgba:[96,198,255,.65]}]:[{id:'head',position:0,rgba:[223,250,255,1]},{id:'mid',position:.5,rgba:[96,198,255,.85]},{id:'end',position:1,rgba:[102,96,232,0]}]});}
 function anchor(type='world'){return {type,space:'world',name:'',slot:'',x:type==='world'?256:0,y:type==='world'?256:0,rotation:0};}
 function newEmitter(id='emitter-1',seed=4109){return {id,enabled:true,anchor:anchor(),layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,visible:true,x:0,y:0,rotation:0,delayFrames:0,seed:seed+i,opacity:1,blend:'add',order:k==='halo'?'behind':'front',anchor:anchor('inherit')}]))};}
 const ranges={durationFrames:[6,3600,true],fadeFrames:[1,120,true],auraRadius:[10,260],ellipseRatio:[.25,4],arcCount:[0,60,true],pulseRate:[0,15],arcLength:[2,140],arcWidth:[.5,14],glowStrength:[0,2],haloWidth:[.5,20],arcLifeFrames:[1,120,true],jaggedness:[0,1],branchChance:[0,1],branchLengthRatio:[.1,1],intervalFrames:[.25,600],minIntervalFrames:[0,120],timeJitter:[0,.45],perimeterGap:[2,80],minGap:[2,80],maxGap:[2,80],spatialJitter:[0,.45],sparkRate:[0,120],sparkTimeJitter:[0,.45],sparkMinIntervalFrames:[0,120],sparkGap:[2,80],sparkLifeFrames:[1,120,true],sparkSpeed:[0,500],sparkSize:[.25,15]};
 function defaults(){return {schemaVersion:1,mode:'loop',quality:'balanced',durationFrames:60,fadeFrames:8,auraRadius:80,ellipseRatio:1,arcCount:12,pulseRate:2,arcLength:35,arcWidth:2,glowStrength:.7,haloWidth:2,arcLifeFrames:10,jaggedness:.7,branchChance:.25,branchLengthRatio:.4,frequencySource:'rate',intervalFrames:2.5,minIntervalFrames:0,timeJitter:.25,perimeterGap:15,minGap:2,maxGap:80,spatialJitter:0,distribution:'even',spacingCurveEnabled:false,sparkRate:8,sparkTimeJitter:.25,sparkMinIntervalFrames:0,sparkGap:23,sparkLifeFrames:18,sparkSpeed:65,sparkSize:2,curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,palette(k)])),emitters:[newEmitter()]};}
 function normalizeAnchor(a,layer){exact(a,['type','space','name','slot','x','y','rotation'],'anchor');choice(a.type,'anchor type',[...(layer?['inherit']:[]),'world','skeleton','bone','slot','attachment']);choice(a.space,'anchor space',['world','local']);if(['world','inherit'].includes(a.type)&&a.space!=='world')fail('anchor space');for(const k of ['name','slot'])if(typeof a[k]!=='string'||a[k].length>256)fail('anchor name');if(['bone','slot','attachment'].includes(a.type)&&!a.name.trim()||a.type==='attachment'&&!a.slot.trim())fail('anchor identity');return {...a,x:num(a.x,'anchor x',-10000,10000),y:num(a.y,'anchor y',-10000,10000),rotation:num(a.rotation,'anchor rotation',-360,360)};}
 function normalize(input){
  exact(input,Object.keys(defaults()),'preset shape');dense(input);if(input.schemaVersion!==1)fail('version');
  const o={schemaVersion:1};for(const [k,r] of Object.entries(ranges))o[k]=num(input[k],k,...r);
  o.mode=choice(input.mode,'mode',['loop','oneShot']);o.quality=choice(input.quality,'quality',Object.keys(BUDGETS));o.frequencySource=choice(input.frequencySource,'frequency',['rate','interval']);o.distribution=choice(input.distribution,'distribution',['even','random','stratified','clustered']);o.spacingCurveEnabled=bool(input.spacingCurveEnabled,'spacing curve');
  if(o.minGap>o.maxGap||o.mode==='oneShot'&&o.fadeFrames>=o.durationFrames-1||o.mode==='loop'&&Math.max(o.arcLifeFrames,o.sparkLifeFrames)>o.durationFrames)fail('phase/gap/lifetime bounds');
  exact(input.curves,Object.keys(specs),'curves');o.curves={};for(const k of Object.keys(specs)){const c=C.normalize(input.curves[k]),d=curve(k);for(const f of ['parameterKey','domain','inputUnit','valueUnit','clamp','monotonic'])if(c[f]!==d[f])fail('curve binding '+k);if(c.inputRange[0]!==0||c.inputRange[1]!==1||c.valueRange.some((v,i)=>v!==d.valueRange[i]))fail('curve range');o.curves[k]=c;}
  exact(input.palettes,LAYERS,'palettes');o.palettes=Object.fromEntries(LAYERS.map(k=>{const p=K.normalize(input.palettes[k]),d=palette(k);if(p.parameterKey!==d.parameterKey||p.domain!==d.domain)fail('palette binding');return [k,p];}));
  if(o.mode==='loop'){for(const k of ['frequency','glow','rate','interval']){const c=o.curves[k],last=c.keys.at(-1),prev=c.keys.at(-2),start=C.evaluate(c,0);if(Math.abs(start-C.evaluate(c,1))>EPS||prev&&prev.mode==='stepped'&&last.x===1&&Math.abs(prev.y-start)>EPS)fail('curve seam '+k);}const a=K.sample(o.palettes.halo,0),b=K.sample(o.palettes.halo,1);if(a.some((v,i)=>Math.abs(v-b[i])>EPS))fail('halo palette seam');}
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitters');const ids=new Set();
  o.emitters=input.emitters.map(e=>{exact(e,['id','enabled','anchor','layers'],'emitter');if(typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);exact(e.layers,LAYERS,'layers');return {id:e.id,enabled:bool(e.enabled,'emitter enabled'),anchor:normalizeAnchor(e.anchor,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];exact(l,['enabled','visible','x','y','rotation','delayFrames','seed','opacity','blend','order','anchor'],'layer');return [k,{enabled:bool(l.enabled,k),visible:bool(l.visible,k),x:num(l.x,k,-10000,10000),y:num(l.y,k,-10000,10000),rotation:num(l.rotation,k,-360,360),delayFrames:num(l.delayFrames,k,0,120,true),seed:num(l.seed,k,-2147483648,2147483647,true),opacity:num(l.opacity,k,0,1),blend:choice(l.blend,k,['normal','add']),order:choice(l.order,k,['behind','front']),anchor:normalizeAnchor(l.anchor,true)}];}))};});return freeze(o);
 }
 function perimeter(r,ratio){const y=r*ratio,k=.5522847498307936;return {schemaVersion:1,closed:true,segments:[{p0:[r,0],p1:[r,k*y],p2:[k*r,y],p3:[0,y]},{p0:[0,y],p1:[-k*r,y],p2:[-r,k*y],p3:[-r,0]},{p0:[-r,0],p1:[-r,-k*y],p2:[-k*r,-y],p3:[0,-y]},{p0:[0,-y],p1:[k*r,-y],p2:[r,-k*y],p3:[r,0]}]};}
 // Midpoint integration of composed authored effectTime and emitterTime curves.
 // Mid-count thresholds keep endpoints exclusive; bounded jitter stays in its
 // own neighboring threshold interval. The canonical schedule repeats by ID.
 function timetable(c,d,seed,spark=false){
  const base=spark?c.sparkRate:!c.arcCount||!c.pulseRate?0:c.frequencySource==='rate'?c.arcCount*c.pulseRate:FPS/c.intervalFrames;
  if(!base)return [];
  const N=4096,dt=d/N,integral=new Float64Array(N+1);
  for(let i=1;i<=N;i++){const t=(i-.5)*dt,u=t/d,rate=spark?base:base*C.evaluate(c.curves.frequency,u)*(c.frequencySource==='rate'?C.evaluate(c.curves.rate,u):1/Math.max(.05,C.evaluate(c.curves.interval,u)))*(1+.65*Math.cos(TAU*c.pulseRate*t));integral[i]=integral[i-1]+rate*dt;}
  const count=Math.floor(integral[N]+EPS);if(count>MAX_EVENTS)fail('event budget');const slots=[];
  for(let k=0;k<count;k++){const target=k+.5;let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(integral[m]<target)lo=m;else hi=m;}slots.push((lo+(target-integral[lo])/Math.max(EPS,integral[hi]-integral[lo]))*dt);}
  const gap=(spark?c.sparkMinIntervalFrames:c.minIntervalFrames)/FPS,jitter=spark?c.sparkTimeJitter:c.timeJitter,out=[];
  for(let i=0;i<slots.length;i++){const t=slots[i],prev=slots[i-1]??(c.mode==='loop'?slots.at(-1)-d:0),next=slots[i+1]??(c.mode==='loop'?slots[0]+d:d),span=Math.max(0,Math.min(t-prev,next-t)),time=clamp(t+(rand(seed,i,1)*2-1)*jitter*span,0,d-EPS);if(!out.length||time-out.at(-1).time>=Math.max(gap,EPS))out.push({id:i,time});}
  if(c.mode==='loop')while(out.length>1&&d-out.at(-1).time+out[0].time<Math.max(gap,EPS))out.pop();
  return out;
 }
 function placement(c,path,seed,spark=false){const gap=spark?c.sparkGap:c.perimeterGap,minimum=spark?gap:c.minGap,maximum=spark?gap:c.maxGap,r=S.createSpatialPlacement({path,baseSpacingPx:gap,minSpacing:minimum,maxSpacing:maximum,mode:spark?'even':c.distribution,jitter:spark?0:c.spatialJitter,seed,maxPoints:4096,tolerancePx:.0625,spacingCurve:!spark&&c.spacingCurveEnabled?c.curves.spacing:null});const points=r.points.slice();while(points.length>1&&r.table.length-points.at(-1).distance+points[0].distance<minimum-EPS)points.pop();if(!points.length){const p=S.pointAtDistance(r.table,0);points.push({...p,index:0,normalizedDistance:0});}return {length:r.table.length,errorBound:r.table.errorBound,points,table:r.table};}
 function linePath(points,closed=false){return {schemaVersion:1,closed,segments:points.slice(1).map((b,i)=>{const a=points[i];return {p0:a,p1:a.map((v,j)=>v+(b[j]-v)/3),p2:a.map((v,j)=>v+(b[j]-v)*2/3),p3:b};})};}
 function mesh(path,width,curve=null,spacing=6){const r=P.buildRibbon({path,width:{start:width,middle:width,end:width,curve,minVisiblePx:0},quality:'high',sampleSpacingPx:spacing,tolerancePx:.0625,miterLimit:1.5});return {positions:Array.from(r.positions),uvs:Array.from(r.uvs),indices:Array.from(r.indices),sections:r.samples.map(s=>({x:s.x,y:s.y,distance:s.distance,width:s.width})),length:r.table.length};}
 function bolt(c,start,seed,id,branch=false){const sign=rand(seed,id,2)<.5?-1:1,angle=start.angle+(branch?sign*.9:sign*.18),tx=Math.cos(angle),ty=Math.sin(angle),length=c.arcLength*(branch?c.branchLengthRatio:1),points=[[0,0]];for(let j=1;j<=5;j++){const u=j/5;points.push([u,(j===5?0:(rand(seed,id,3+j)*2-1)*.22*c.jaggedness)]);}const total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);const path=linePath(points.map(([x,y])=>[start.x+(tx*x-ty*y)*length/total,start.y+(ty*x+tx*y)*length/total]));return {path,mesh:mesh(path,c.arcWidth*(branch?.55:1),c.curves.width,Math.max(2,length/8))};}
 const active=l=>l.enabled&&l.visible&&l.opacity>0;
 // Use identical half-open event endpoints in capacity planning and sampling.
 function peak(events,life,d,loop){if(loop&&life>=d)return events.length;const edges=[];for(const e of events){const end=e.time+life;edges.push([e.time,1],[Math.min(d,end),-1]);if(loop&&end>d)edges.push([0,1],[end-d,-1]);}edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let n=0,max=0;for(const [,delta] of edges){n+=delta;max=Math.max(max,n);}return max;}
 function liveAge(t,birth,life,d,loop){const end=birth+life;if(t>=birth){if(!(loop&&life>=d)&&t>=end)return null;return t-birth;}if(!loop||life<d&&t>=end-d)return null;return Math.max(0,t-(birth-d));}
 function compile(input){
  const c=normalize(input),loop=c.mode==='loop',duration=c.durationFrames/FPS,path=perimeter(c.auraRadius,c.ellipseRatio),table=S.buildArcTable(path,{tolerancePx:.0625}),plans=[];let events=0,primitiveBound=0,vertexBound=0;
  for(const e of c.emitters){const plan={id:e.id,layers:{}};for(const k of LAYERS){const l=e.layers[k];if(!e.enabled||!active(l)){plan.layers[k]={events:[],points:[],primitiveBound:0,vertexBound:0};continue;}
   if(k==='halo'){const halo=c.glowStrength?mesh(path,c.haloWidth,null,Math.max(6,table.length/128)):null,glow=c.glowStrength?mesh(path,c.haloWidth+12*c.glowStrength,null,Math.max(6,table.length/128)):null;const rows=[halo,glow].filter(Boolean);plan.layers[k]={halo,glow,events:[],points:[],primitiveBound:rows.length,vertexBound:rows.reduce((n,m)=>n+m.positions.length/2,0)};}
   else{const spark=k==='sparks',life=(spark?c.sparkLifeFrames:c.arcLifeFrames)/FPS,list=timetable(c,duration,l.seed,spark),p=placement(c,path,l.seed,spark);events+=list.length;if(events>MAX_EVENTS)fail('whole effect event budget');
    const rows=list.map(ev=>{const q=p.points[(Math.floor(rand(l.seed,0,17)*p.points.length)+ev.id)%p.points.length],base={...ev,distance:q.distance,x:q.x,y:q.y,angle:q.angle};if(spark)return {...base,angle:q.angle-Math.PI/2+(rand(l.seed,ev.id,18)*2-1)*.7};const main=bolt(c,q,l.seed,ev.id),branch=rand(l.seed,ev.id,19)<c.branchChance?bolt(c,S.pointAtDistance(S.buildArcTable(main.path,{tolerancePx:.0625}),c.arcLength*.48),l.seed^0x7123,ev.id,true).mesh:null;return {...base,main:main.mesh,branch};});
    const concurrency=peak(rows,life,duration,loop),maxV=spark?0:rows.reduce((n,r)=>Math.max(n,r.main.positions.length/2+(r.branch?.positions.length??0)/2),0),maxP=spark?1:rows.some(r=>r.branch)?2:1;
    plan.layers[k]={events:rows,points:p.points,length:p.length,errorBound:p.errorBound,life,primitiveBound:concurrency*maxP,vertexBound:concurrency*maxV};
   }
   primitiveBound+=plan.layers[k].primitiveBound;vertexBound+=plan.layers[k].vertexBound;if(primitiveBound>BUDGETS[c.quality]||vertexBound>MAX_VERTICES)fail('whole effect live budget');
  }plans.push(plan);}
  const meta=freeze({frames:c.durationFrames,duration,loop,perimeterLength:table.length,errorBound:table.errorBound,nominalArcRate:c.arcCount*c.pulseRate,eventCount:events,primitiveBound,vertexBound,plans});
  function pose(e,l,k,poses){const a=l.anchor.type==='inherit'?e.anchor:l.anchor,id=l.anchor.type==='inherit'?e.id:e.id+':'+k,b=a.type==='world'?{x:a.x,y:a.y,rotation:a.rotation,scale:1}:poses?.[id];if(!b||![b.x,b.y,b.rotation,b.scale].every(Number.isFinite)||b.scale<=0||b.scale>100)return null;const r=b.rotation*RAD;return {x:b.x+b.scale*(l.x*Math.cos(r)-l.y*Math.sin(r)),y:b.y+b.scale*(l.x*Math.sin(r)+l.y*Math.cos(r)),rotation:b.rotation+l.rotation,scale:b.scale};}
  function sample(seconds,poses){num(seconds,'sample time',0,3600);const out={emitters:[],halo:[],arcs:[],sparks:[]};let vertices=0;
   for(let i=0;i<c.emitters.length;i++){const e=c.emitters[i],summary={id:e.id,layers:{}};out.emitters.push(summary);for(const k of LAYERS){const l=e.layers[k],p=meta.plans[i].layers[k],b=pose(e,l,k,poses);summary.layers[k]={origin:b?{x:b.x,y:b.y}:null};if(!e.enabled||!active(l)||!b)continue;
    const raw=seconds-l.delayFrames/FPS,t=loop?loopSeconds(seconds,c.durationFrames,l.delayFrames):raw,end=(c.durationFrames-1)/FPS;if(!loop&&(t<0||t>=end||seconds>=end))continue;const u=t/duration,env=loop?1:Math.min(clamp(t*FPS/2,0,1),clamp((end-seconds)*FPS/c.fadeFrames,0,1)),theta=b.rotation*RAD,co=Math.cos(theta),si=Math.sin(theta),xy=(x,y)=>[b.x+b.scale*(x*co-y*si),b.y+b.scale*(x*si+y*co)];
    const emitMesh=(m,color,id)=>{if(!m||color[3]<=0)return;const positions=[];for(let j=0;j<m.positions.length;j+=2)positions.push(...xy(m.positions[j],m.positions[j+1]));vertices+=positions.length/2;out[k].push({kind:'ribbon',id,emitterId:e.id,blend:l.blend,order:l.order,positions,uvs:m.uvs,indices:m.indices,rgba:color});};
    if(k==='halo'){const color=K.sample(c.palettes.halo,u),factor=C.evaluate(c.curves.glow,u)*c.glowStrength*env*l.opacity;emitMesh(p.glow,[...color.slice(0,3),clamp(color[3]*factor*.25,0,1)],'glow');emitMesh(p.halo,[...color.slice(0,3),clamp(color[3]*factor,0,1)],'halo');continue;}
    for(const ev of p.events){const age=liveAge(t,ev.time,p.life,duration,loop);if(age===null)continue;const f=clamp(age/p.life,0,1),color=K.sample(c.palettes[k],f);color[3]*=C.evaluate(c.curves.alpha,f)*env*l.opacity;if(color[3]<=0)continue;
     if(k==='arcs'){emitMesh(ev.main,color,ev.id+':main');emitMesh(ev.branch,color,ev.id+':branch');}
     else{const [x,y]=xy(ev.x+Math.cos(ev.angle)*age*c.sparkSpeed,ev.y+Math.sin(ev.angle)*age*c.sparkSpeed);out.sparks.push({kind:'disc',id:ev.id,emitterId:e.id,blend:l.blend,order:l.order,x,y,radius:c.sparkSize*b.scale*(1-.6*f),rgba:color});}
    }
   }}
   if(out.halo.length+out.arcs.length+out.sparks.length>primitiveBound||vertices>vertexBound)fail('sample exceeded compiled budget');return out;
  }
  return Object.freeze({settings:c,meta,sample});
 }
 return {VERSION:1,FPS,LAYERS,BUDGETS,MAX_EVENTS,MAX_VERTICES,defaults,newEmitter,normalize,compile,loopSeconds};
});
