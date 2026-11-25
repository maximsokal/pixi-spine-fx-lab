// GAME-10 P01: deterministic low fog field, spores and independent edge.
(function(root,factory){
 const load=(key,path)=>root[key]||(typeof require==='function'?require(path):null);
 const api=Object.freeze(factory(load('FxCurves','../../template/src/curve-core.js'),load('FxSpacing','../../template/src/spacing-core.js'),load('FxColors','../../template/src/color-core.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPoison=api;
})(globalThis,function(C,S,COL){
 'use strict';
 if(!C||!S||!COL)throw Error('GAME-10 missing shared core');
 const FPS=60,TAU=2*Math.PI,DEG=Math.PI/180,LAYERS=['fog','spores','edge'],BUDGETS={low:256,balanced:1024,high:2048};
 const fail=m=>{throw RangeError('GAME-10 '+m);},mod=(x,n)=>{const v=x%n;return v<0?v+n:v||0;},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const num=(v,k,a,b,int=false)=>{if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail('invalid '+k);return v;};
 const one=(v,choices,k)=>{if(!choices.includes(v))fail('invalid '+k);return v;};
 const bool=v=>{if(typeof v!=='boolean')fail('invalid toggle');return v;};
 function shape(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid fields');}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function rand(seed,id,salt){let x=seed^hash(id+':'+salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function curve(key,domain,points,range=[0,1],unit='multiplier'){return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration',valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function tx(seed,type){return {enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed,anchor:{type,name:''}};}

 function newEmitter(i=0){
  num(i,'emitter index',0,100000,true);
  return {id:'poison'+(i+1),...tx(1033+i*137,'world'),x:256,y:256,layers:Object.fromEntries(LAYERS.map((k,j)=>[k,{...tx(31+j*97,'inherit'),enabled:k!=='edge',alpha:k==='edge'?.35:1,blend:k==='edge'?'add':'normal',placement:k==='fog'?'behind':'front'}]))};
 }
 function defaults(mode='loop'){
  one(mode,['loop','oneShot'],'mode');
  return {schemaVersion:1,mode,durationFrames:mode==='loop'?75:40,cloudRadius:80,particleRate:20,roughness:.5,diffusionSpeed:40,sporeSize:5,fogOpacity:.5,noiseCellPx:50,lifetimeFrames:36,intervalFrames:3,frequencySource:'rate',minIntervalFrames:0,timeJitter:0,burstEnabled:false,burstCount:12,burstDelayFrames:0,spacingPx:18,minGapPx:2,maxGapPx:95,spatialJitter:0,distribution:'even',seed:4110,quality:'balanced',style:'natural',particleMode:'spore',
   cloudSizeCurve:curve('cloudSize','effectTime',mode==='loop'?[[0,.85],[.6,1.1],[1,.85]]:[[0,.4],[.6,1],[1,1.1]],[0,2]),
   fogOpacityCurve:curve('fogOpacity','effectTime',mode==='loop'?[[0,.75],[.5,1],[1,.75]]:[[0,.9],[.5,.7],[1,0]]),
   sporeSizeCurve:curve('sporeSize','particleAge',[[0,.4],[.6,1],[1,0]],[0,2]),
   sporeAlphaCurve:curve('sporeAlpha','particleAge',[[0,0],[.15,1],[.7,.7],[1,0]]),
   rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,4]),
   intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4]),
   spacingCurve:curve('spacingPx','pathPosition',[[0,18],[1,18]],[2,95],'px'),
   palette:COL.normalize({schemaVersion:1,parameterKey:'poisonColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'light',position:0,rgba:[199,237,131,1]},{id:'green',position:.5,rgba:[122,181,77,1]},{id:'violet',position:1,rgba:[101,80,138,1]}]}),emitters:[newEmitter()]};
 }
 function normalize(input){
  const base=defaults();shape(input,Object.keys(base));if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1,mode:one(input.mode,['loop','oneShot'],'mode'),durationFrames:num(input.durationFrames,'durationFrames',2,3600,true)};
  for(const [k,a,b,i] of [['cloudRadius',10,300],['particleRate',0,120],['roughness',0,1],['diffusionSpeed',0,250],['sporeSize',1,20],['fogOpacity',0,.9],['noiseCellPx',25,110],['lifetimeFrames',1,c.durationFrames,true],['intervalFrames',.25,3600],['minIntervalFrames',0,3600],['timeJitter',0,.45],['burstCount',1,64,true],['burstDelayFrames',0,3600],['spacingPx',2,95],['minGapPx',2,95],['maxGapPx',2,95],['spatialJitter',0,.45],['seed',-2147483648,2147483647,true]])c[k]=num(input[k],k,a,b,i);
  if(c.minGapPx>c.maxGapPx)fail('gap range');c.burstEnabled=bool(input.burstEnabled);
  const end=c.mode==='loop'?c.durationFrames:c.durationFrames-1;
  if(c.burstEnabled&&c.burstDelayFrames*(c.burstCount-1)>=end)fail('burst exceeds duration');
  for(const [k,choices] of Object.entries({frequencySource:['rate','interval'],distribution:['even','random','stratified','clustered'],quality:Object.keys(BUDGETS),style:['natural','stylized','magical'],particleMode:['spore','bubble']}))c[k]=one(input[k],choices,k);
  for(const k of ['cloudSizeCurve','fogOpacityCurve','sporeSizeCurve','sporeAlphaCurve','rateCurve','intervalCurve','spacingCurve']){
   const v=C.normalize(input[k]),b=base[k];for(const key of ['parameterKey','domain','inputUnit','valueUnit'])if(v[key]!==b[key])fail('curve binding '+k);
   if(v.valueRange[0]<b.valueRange[0]||v.valueRange[1]>b.valueRange[1]||v.inputRange[0]!==0||v.inputRange[1]!==1)fail('curve range '+k);c[k]=v;
  }
  if(c.mode==='loop')for(const key of ['cloudSizeCurve','fogOpacityCurve']){
   const v=c[key],last=v.keys.at(-1),prev=v.keys.at(-2);
   if(Math.abs(C.evaluate(v,0)-C.evaluate(v,1))>1e-9||(prev?.mode==='stepped'&&last.x===1&&Math.abs(prev.y-last.y)>1e-9))fail('curve seam '+key);
  }
  c.palette=COL.normalize(input.palette);if(c.palette.parameterKey!=='poisonColor'||c.palette.domain!=='particleAge')fail('palette binding');
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');const ids=new Set(),example=newEmitter();
  function transform(v,layer){const a=v.anchor;shape(a,['type','name']);const type=one(a.type,layer?['inherit','world','local','bone']:['world','local','bone'],'anchor');if(typeof a.name!=='string'||a.name.length>128||(type==='bone'?!a.name.trim():a.name!==''))fail('anchor name');return {enabled:bool(v.enabled),visible:bool(v.visible),x:num(v.x,'x',-16384,16384),y:num(v.y,'y',-16384,16384),rotation:num(v.rotation,'rotation',-3600,3600),scale:num(v.scale,'scale',.01,20),timeOffset:num(v.timeOffset,'timeOffset',-3600,3600),seed:num(v.seed,'seed',-2147483648,2147483647,true),anchor:{type,name:a.name}};}
  c.emitters=input.emitters.map(e=>{shape(e,Object.keys(example));if(typeof e.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);shape(e.layers,LAYERS);return {id:e.id,...transform(e,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];shape(l,Object.keys(example.layers[k]));return [k,{...transform(l,true),alpha:num(l.alpha,'alpha',0,1),blend:one(l.blend,['normal','add','screen','multiply'],'blend'),placement:one(l.placement,['front','behind'],'placement')}];}))};});return c;
 }
 function ellipse(rx,ry){const k=.5522847498307936;return {schemaVersion:1,closed:true,segments:[{p0:[rx,0],p1:[rx,k*ry],p2:[k*rx,ry],p3:[0,ry]},{p0:[0,ry],p1:[-k*rx,ry],p2:[-rx,k*ry],p3:[-rx,0]},{p0:[-rx,0],p1:[-rx,-k*ry],p2:[-k*rx,-ry],p3:[0,-ry]},{p0:[0,-ry],p1:[k*rx,-ry],p2:[rx,-k*ry],p3:[rx,0]}]};}
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 const identity={x:0,y:0,rotation:0,scale:1};
 function compose(a,b){if(!a||![a.x,a.y,a.rotation,a.scale].every(Number.isFinite)||a.scale<=0)return null;const t=a.rotation*DEG,p={x:a.x+a.scale*(b.x*Math.cos(t)-b.y*Math.sin(t)),y:a.y+a.scale*(b.x*Math.sin(t)+b.y*Math.cos(t)),rotation:a.rotation+b.rotation,scale:a.scale*b.scale};return Object.values(p).every(Number.isFinite)&&p.scale>0&&Math.max(Math.abs(p.x),Math.abs(p.y))+2048*p.scale<=1e6? p:null;}
 function resolve(t,parent,poses){const a=t.anchor;return compose(a.type==='inherit'?parent:a.type==='world'?identity:a.type==='local'?poses.local:poses.bones&&Object.hasOwn(poses.bones,a.name)?poses.bones[a.name]:null,t);}

 // Stable spatial layout. No time, palette or spore controls enter this field.
 function cells(c,seed){
  const r=c.cloudRadius,step=c.noiseCellPx,nx=Math.ceil(r/step),ny=Math.ceil(r*.6/step),out=[];
  for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++){
   const x=i*step,y=j*step;if((x/r)**2+(y/(r*.6))**2>1)continue;
   const id=i+':'+j,angle=TAU*rand(seed,id,'phase');
   out.push({id,x:x+(rand(seed,id,'x')-.5)*step*.28,y:y+(rand(seed,id,'y')-.5)*step*.22,angle,shapeSeed:hash(seed+':'+id),weight:.75+.25*rand(seed,id,'weight')});
  }return out;
 }
 function snap(v){return Math.round(v*1e8)/1e8;}
 function overlap(births,life,end,loop){
  const edges=[];for(const b of births){const stop=snap(b.frame+life);edges.push([b.frame,1],[Math.min(stop,end),-1]);if(loop&&stop>end)edges.push([0,1],[snap(stop-end),-1]);}
  edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let n=0,max=0;for(const [,v] of edges){n+=v;max=Math.max(max,n);}return max;
 }
 function compile(input){
  const c=freeze(normalize(input)),loop=c.mode==='loop',end=loop?c.durationFrames:c.durationFrames-1;
  let reserved=0,events=0;
  const schedules=c.emitters.map(e=>{
   const seed=k=>c.seed^e.seed^e.layers[k].seed^hash(e.id+':'+k);
   const fog=active(e,e.layers.fog)?cells(c,seed('fog')):[],edge=Number(active(e,e.layers.edge));
   const row={id:e.id,fog:{cells:fog,maxActive:fog.length},edge:{maxActive:edge},spores:{seed:seed('spores'),births:[],anchors:[],pathLength:0,maxActive:0}};
   reserved+=fog.length+edge;const s=row.spores;
   if(active(e,e.layers.spores)){
    // spacingPx is the baseline; the curve is a relative edit of the 18px reference.
    const sc=c.spacingCurve,factor=c.spacingPx/18,scale=v=>v*factor,gap={...sc,valueRange:sc.valueRange.map(scale),defaultValue:scale(sc.defaultValue),keys:sc.keys.map(v=>({...v,y:scale(v.y),...(v.in?{in:[v.in[0],scale(v.in[1])]}:{}),...(v.out?{out:[v.out[0],scale(v.out[1])]}:{})}))};
    const placement=S.createSpatialPlacement({path:ellipse(c.cloudRadius,c.cloudRadius*.6),baseSpacingPx:c.spacingPx,minSpacing:c.minGapPx,maxSpacing:c.maxGapPx,spacingCurve:gap,mode:c.distribution,jitter:c.spatialJitter,seed:s.seed^hash('space'),maxPoints:2048});
    if(placement.capped)fail('placement budget');s.pathLength=placement.table.length;
    s.anchors=[{x:c.cloudRadius,y:0,distance:0},...placement.points.filter(a=>s.pathLength-a.distance>=c.minGapPx-1e-9).map(({x,y,distance})=>({x,y,distance}))];
    const order=stream=>s.anchors.map((_,i)=>({i,v:rand(s.seed,stream+i,'anchor')})).sort((a,b)=>a.v-b.v||a.i-b.i).map(v=>v.i);
    const add=(id,stream,frame,anchorIndex)=>{s.births.push({id,stream,frame,anchorIndex});if(++events>4096)fail('event budget');};
    const raw=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.particleRate,interval:c.intervalFrames/FPS,duration:end/FPS,minInterval:c.minIntervalFrames/FPS,jitter:c.timeJitter,seed:s.seed^hash('base'),rateCurve:c.rateCurve,intervalCurve:c.intervalCurve,maxEvents:4096});
    if(raw.capped)fail('event budget');const times=raw.events.map(v=>snap(v.time*FPS)).filter(t=>loop||t<end).map(t=>loop?mod(t,end):t).sort((a,b)=>a-b);
    for(let i=0;i<times.length;i++){const next=times[i+1]??(loop?times[0]+end:Infinity);if(next-times[i]<=1e-8||next-times[i]<c.minIntervalFrames-1e-7)fail('base event gap');}
    const baseOrder=order('base');times.forEach((t,i)=>add('base'+i,'base',t,baseOrder[i%baseOrder.length]));
    if(c.burstEnabled){const burstOrder=order('burst');if(c.burstCount>burstOrder.length)fail('burst exceeds spatial anchors');for(let i=0;i<c.burstCount;i++)add('burst'+i,'burst',snap(i*c.burstDelayFrames),burstOrder[i]);}
    s.births.sort((a,b)=>a.frame-b.frame||a.id.localeCompare(b.id));s.maxActive=overlap(s.births,c.lifetimeFrames,end,loop);reserved+=s.maxActive;
   }return row;
  });
  if(reserved>BUDGETS[c.quality])fail('quality budget');freeze(schedules);
  function sample(seconds,poses={}){
   num(seconds,'seconds',0,1e6);if(!poses||typeof poses!=='object'||Array.isArray(poses))fail('poses');
   const raw=snap(seconds*FPS),t=loop?mod(raw,end):raw,diagnostics=[];let cost=0;
   const emitters=c.emitters.map((e,i)=>{
    const parent=resolve(e,null,poses),layers={fog:[],spores:[],edge:[]};
    for(const k of LAYERS){
     const l=e.layers[k];if(!active(e,l)||(!loop&&(t<=0||t>=end)))continue;
     const local=snap(t-(e.timeOffset+l.timeOffset)*FPS),f=loop?mod(local,end):local;if(!loop&&(f<0||f>=end))continue;
     const p=resolve(l,parent,poses);if(!p){diagnostics.push({emitterId:e.id,layer:k,reason:'missing-or-invalid-anchor'});continue;}
     const u=f/end,fade=loop?1:clamp(Math.min(t,end-t,f,end-f)/Math.min(4,end/2),0,1);
     const seed=c.seed^e.seed^l.seed^hash(e.id+':'+k),size=C.evaluate(c.cloudSizeCurve,u),opacity=C.evaluate(c.fogOpacityCurve,u);
     const diffusion=loop?Math.min(c.cloudRadius*.8,c.diffusionSpeed*end/FPS/TAU)*(1-Math.cos(TAU*u))/2:c.diffusionSpeed*f/FPS;
     function push(kind,id,x,y,radius,alpha,colorPhase,extra={}){
      if(radius<=0||alpha<=0)return;const rgba=COL.sample(c.palette,clamp(colorPhase,0,1));rgba[3]=clamp(rgba[3]*alpha*l.alpha*fade,0,1);if(rgba[3]<=0)return;
      const q=compose(p,{x,y,rotation:0,scale:1});if(!q)return;
      layers[k].push({id:e.id+'-'+k+'-'+id,kind,x:q.x,y:q.y,radius:radius*p.scale,rotation:p.rotation,rgba,blend:l.blend,placement:l.placement,...extra});
     }
     if(k==='fog'){
      for(const cell of schedules[i].fog.cells){
       const turns=loop?TAU*u:TAU*f/FPS,swirl=Math.min(c.noiseCellPx*.65,c.diffusionSpeed*.16);
       const ox=swirl*(Math.sin(turns+cell.angle)-Math.sin(cell.angle)),oy=swirl*.35*(Math.cos(turns+cell.angle)-Math.cos(cell.angle));
       const spread=size+diffusion/c.cloudRadius,rad=Math.min(c.cloudRadius,c.noiseCellPx*.95)*size+diffusion*.4;
       const style=c.style==='stylized'?.65:c.style==='magical'?1:.85;
       push('fog',cell.id,cell.x*spread+ox,cell.y*spread+oy,rad,c.fogOpacity*opacity*cell.weight, .5+.45*Math.sin(turns+cell.angle),{aspect:.6,roughness:c.roughness*style,shapeSeed:cell.shapeSeed});
      }
     }else if(k==='edge'){
      push('edge','0',0,0,c.cloudRadius*size+diffusion,c.fogOpacity*opacity,1,{aspect:.6,roughness:c.roughness,shapeSeed:seed,thickness:Math.max(1,c.noiseCellPx*.1)*p.scale});
     }else{
      const s=schedules[i].spores;for(const b of s.births){
       const age=snap(loop?mod(snap(f-b.frame),end):f-b.frame);if(age<0||age>=c.lifetimeFrames)continue;
       const a=age/c.lifetimeFrames,origin=s.anchors[b.anchorIndex],angle=TAU*rand(s.seed,b.id,'direction'),travel=c.diffusionSpeed*age/FPS;
       const x=origin.x+Math.cos(angle)*travel,y=origin.y+Math.sin(angle)*travel*.35-travel*.25;
       const radius=c.sporeSize*C.evaluate(c.sporeSizeCurve,a)*(c.style==='magical'?1.2:1);
       push(c.particleMode,b.id,x,y,radius,C.evaluate(c.sporeAlphaCurve,a),a,{age,bornFrame:b.frame,distance:origin.distance,stream:b.stream,thickness:Math.max(.1,radius*.22)*p.scale});
      }
     }
     cost+=layers[k].length;
    }return {id:e.id,layers};
   });return {emitters,diagnostics,cost};
  }
  return Object.freeze({settings:c,reserved,schedules,sample});
 }
 return {defaults,newEmitter,normalize,compile};
});
