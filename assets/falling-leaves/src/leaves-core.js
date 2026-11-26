// EARTH-04 L01: pure periodic leaf simulation. Seconds internally, 60 Hz authoring.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLeaves=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('EARTH-04 requires FX-CORE 01/02/04');
 const PERIOD=2,TAU=2*Math.PI,DEG=Math.PI/180;
 const LAYERS=Object.freeze(['foreground','background','gusts']);
 const BUDGETS=Object.freeze({low:256,balanced:1024,high:4096});
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const mod=(n,p)=>((n%p)+p)%p;
 const canonical=n=>Math.abs(n-Math.round(n*60)/60)<=1e-9?Math.round(n*60)/60:n;
 function num(n,key,min,max,int=false){
  if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(int&&!Number.isInteger(n)))
   throw TypeError('EARTH-04 invalid '+key);
  return n;
 }
 function exact(o,keys,label){
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||
   keys.some(k=>!Object.hasOwn(o,k)))throw TypeError('EARTH-04 invalid fields: '+label);
 }
 function one(v,options,key){if(!options.includes(v))throw TypeError('EARTH-04 invalid '+key);return v;}
 function bool(v,key){return one(v,[true,false],key);}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function random(seed,index,stream){
  let n=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b);
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,points,range,unit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],
   clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function palette(style='natural'){
  const rgb={
   natural:[[232,178,82],[158,111,50],[143,154,85]],
   stylized:[[255,198,65],[229,85,34],[128,54,28]],
   magical:[[178,243,161],[70,203,161],[185,140,255]]
  }[one(style,['natural','stylized','magical'],'style')];
  return Colors.normalize({schemaVersion:1,parameterKey:'leafColor',domain:'particleAge',
   inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
   stops:rgb.map((v,i)=>({id:'c'+i,position:i/2,rgba:[...v,1]}))});
 }
 function newEmitter(index=0){
  const layer=(enabled,seed,rateScale,speedScale,parallax,sizeScale,alpha)=>({
   enabled,visible:true,x:0,y:0,rotation:0,timeOffset:0,seed,rateScale,speedScale,parallax,sizeScale,alpha,blend:'normal'});
  return {id:'emitter'+(index+1),name:'Leaf source '+(index+1),enabled:true,visible:true,
   x:0,y:0,rotation:0,timeOffset:0,seed:1201+index*127,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:-16,rotation:0},
   layers:{foreground:layer(true,13,1,1,1,1,1),
    background:layer(true,29,.6,.65,.55,.65,.65),gusts:layer(false,43,1,1,1,1,.25)}};
 }
 function defaults(){
  return {schemaVersion:1,durationFrames:120,exportFrames:120,loop:true,
   leafRate:10,leafSize:18,fallSpeed:55,windSpeed:30,tumble:110,shapeVariance:.4,
   lifetime:4,flutterAmplitude:22,flutterFrequency:1.2,fieldWidth:440,
   gustRate:3,spatialGap:25,minGap:5,spatialJitter:.15,spatialMode:'stratified',spacingCurveEnabled:false,
   timingMode:'custom',timeJitter:0,spawnDelay:0,burstCount:3,burstDelay:.04,
   seed:91271,quality:'balanced',style:'natural',
   rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,3]),
   spacingCurve:curve('spacingPx','pathPosition',[[0,25],[1,25]],[5,120],'px'),
   driftCurve:curve('drift','particleAge',[[0,.2],[.4,1],[1,.3]],[0,3]),
   spinCurve:curve('spin','particleAge',[[0,.7],[.5,1],[1,.5]],[0,3]),
   alphaCurve:curve('leafAlpha','particleAge',[[0,0],[.1,1],[.9,1],[1,0]],[0,1]),
   palette:palette(),emitters:[newEmitter()]};
 }
 const RANGES=Object.freeze({leafRate:[0,80],leafSize:[6,40],fallSpeed:[5,230],windSpeed:[-140,140],
  tumble:[0,360],shapeVariance:[0,1],lifetime:[.25,8],flutterAmplitude:[0,100],flutterFrequency:[0,8],
  fieldWidth:[120,512],gustRate:[0,20],spatialGap:[5,120],minGap:[5,120],spatialJitter:[0,.45],
  timeJitter:[0,.45],spawnDelay:[0,2],burstCount:[1,16],burstDelay:[0,.5],
  seed:[-2147483648,2147483647],durationFrames:[120,120],exportFrames:[120,120]});
 const TOP=Object.keys(defaults()),EMITTER=Object.keys(newEmitter()),ANCHOR=Object.keys(newEmitter().anchor),
  LAYER=Object.keys(newEmitter().layers.foreground);
 function normalize(c){
  exact(c,TOP,'settings');one(c.schemaVersion,[1],'schemaVersion');one(c.loop,[true],'loop');
  const out={schemaVersion:1,loop:true};
  for(const [k,[a,b]] of Object.entries(RANGES))out[k]=num(c[k],k,a,b,['seed','durationFrames','exportFrames','burstCount'].includes(k));
  if(c.minGap>c.spatialGap)throw TypeError('EARTH-04 minGap exceeds spatialGap');
  out.spatialMode=one(c.spatialMode,['even','stratified','random','clustered'],'spatialMode');
  out.timingMode=one(c.timingMode,['uniform','custom','clustered','burst'],'timingMode');
  out.spacingCurveEnabled=bool(c.spacingCurveEnabled,'spacingCurveEnabled');
  out.quality=one(c.quality,Object.keys(BUDGETS),'quality');
  out.style=one(c.style,['natural','stylized','magical'],'style');
  for(const [name,key,domain,unit,lo,hi] of [
   ['rateCurve','emissionRate','emitterTime','multiplier',0,3],
   ['spacingCurve','spacingPx','pathPosition','px',5,120],
   ['driftCurve','drift','particleAge','multiplier',0,3],
   ['spinCurve','spin','particleAge','multiplier',0,3],
   ['alphaCurve','leafAlpha','particleAge','multiplier',0,1]]){
   const v=Curves.normalize(c[name]);
   if(v.parameterKey!==key||v.domain!==domain||v.valueUnit!==unit||
    v.inputUnit!==(domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration')||
    v.valueRange[0]<lo||v.valueRange[1]>hi)throw TypeError('EARTH-04 invalid '+name);
   out[name]=v;
  }
  // Zero-alpha endpoints keep periodic births and deaths visually continuous.
  if(Curves.evaluate(out.alphaCurve,0)!==0||Curves.evaluate(out.alphaCurve,1)!==0)
   throw TypeError('EARTH-04 alpha endpoints must be zero');
  out.palette=Colors.normalize(c.palette);
  if(out.palette.parameterKey!=='leafColor'||out.palette.domain!=='particleAge')
   throw TypeError('EARTH-04 invalid palette');
  if(!Array.isArray(c.emitters)||c.emitters.length>4)throw TypeError('EARTH-04 maximum four emitters');
  const ids=new Set();
  out.emitters=c.emitters.map(e=>{
   exact(e,EMITTER,'emitter');
   if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id)||
    typeof e.name!=='string'||!e.name.trim()||e.name.length>128)throw TypeError('EARTH-04 invalid emitter identity');
   ids.add(e.id);
   const position=(v,label)=>({x:num(v.x,label+'.x',-10000,10000),y:num(v.y,label+'.y',-10000,10000),
    rotation:num(v.rotation,label+'.rotation',-360,360)});
   const enabled=(v,label)=>({enabled:bool(v.enabled,label+'.enabled'),visible:bool(v.visible,label+'.visible'),
    timeOffset:num(v.timeOffset,label+'.timeOffset',-3600,3600,true),seed:num(v.seed,label+'.seed',-2147483648,2147483647,true)});
   const a=e.anchor;exact(a,ANCHOR,'anchor');
   const type=one(a.type,['world','skeleton','bone','slot','attachment'],'anchor.type');
   if(typeof a.name!=='string'||typeof a.slot!=='string'||(['bone','slot','attachment'].includes(type)&&!a.name.trim())||
    (type==='attachment'&&!a.slot.trim()))throw TypeError('EARTH-04 invalid anchor name');
   exact(e.layers,LAYERS,'layers');
   const layers={};
   for(const k of LAYERS){
    const l=e.layers[k];exact(l,LAYER,k);
    layers[k]={...position(l,k),...enabled(l,k),rateScale:num(l.rateScale,k+'.rateScale',0,2),
     speedScale:num(l.speedScale,k+'.speedScale',.1,3),parallax:num(l.parallax,k+'.parallax',0,3),
     sizeScale:num(l.sizeScale,k+'.sizeScale',.1,3),alpha:num(l.alpha,k+'.alpha',0,1),
     blend:one(l.blend,['normal','add','multiply','screen'],k+'.blend')};
   }
   return {id:e.id,name:e.name,...position(e,'emitter'),...enabled(e,'emitter'),
    anchor:{type,space:one(a.space,['world','local'],'anchor.space'),name:a.name,slot:a.slot,...position(a,'anchor')},layers};
  });
  return out;
 }
 const cache=new Map();
 function memo(k,fn){if(cache.has(k))return cache.get(k);const v=fn();cache.set(k,v);
  if(cache.size>48)cache.delete(cache.keys().next().value);return v;}
 function scheduleNormalized(c,e,k){
  const l=e.layers[k],seed=c.seed^e.seed^l.seed^hash(e.id+'/'+k);
  const rate=(k==='gusts'?c.gustRate:c.leafRate)*l.rateScale;
  const key=JSON.stringify(['schedule',seed,rate,c.timingMode,c.rateCurve,c.timeJitter,c.spawnDelay,
   c.burstCount,c.burstDelay,c.fieldWidth,c.spatialGap,c.minGap,c.spatialJitter,c.spatialMode,c.spacingCurveEnabled,c.spacingCurve]);
  return memo(key,()=>{
   const timing=Spacing.createTemporalSchedule({schemaVersion:1,mode:c.timingMode,frequencySource:'rate',
    baseRate:rate,duration:PERIOD,jitter:c.timeJitter,seed,maxEvents:4096,
    burstCount:c.burstCount,burstDelay:c.burstDelay,rateCurve:c.rateCurve});
   const w=c.fieldWidth/2;
   const spatial=Spacing.createSpatialPlacement({schemaVersion:1,
    path:{schemaVersion:1,closed:false,segments:[{p0:[-w,0],p1:[-w/3,0],p2:[w/3,0],p3:[w,0]}]},
    baseSpacingPx:c.spatialGap,minSpacing:c.minGap,maxSpacing:120,
    mode:c.spatialMode,jitter:c.spatialJitter,seed,maxPoints:512,
    spacingCurve:c.spacingCurveEnabled?c.spacingCurve:null,alignToTangent:false,pathFollow:'clamp'});
   if(timing.capped||spatial.capped)throw RangeError('EARTH-04 schedule budget exceeded');
   const lanes=spatial.points.map(v=>({x:v.x,distance:v.distance}));
   // A row narrower than its requested gap has a single valid central lane.
   if(!lanes.length)lanes.push({x:0,distance:w});
   const events=timing.events.map(v=>({time:mod(v.time+c.spawnDelay,PERIOD),index:v.index,
    lane:(v.index+((seed>>>0)%lanes.length))%lanes.length})).sort((a,b)=>a.time-b.time||a.index-b.index);
   return {events,lanes,seed};
  });
 }
 function schedule(input,id,kind){
  const c=normalize(input),e=c.emitters.find(v=>v.id===id);
  if(!e||!LAYERS.includes(kind))throw TypeError('EARTH-04 unknown emitter/layer');
  const s=scheduleNormalized(c,e,kind);
  return {events:s.events.map(v=>({...v})),lanes:s.lanes.map(v=>({...v})),seed:s.seed};
 }
 function integralTable(curve){
  return memo(JSON.stringify(['integral',curve]),()=>{
   const n=128,table=new Float64Array(n+1);
   for(let i=1;i<=n;i++)table[i]=table[i-1]+Curves.evaluate(curve,(i-.5)/n)/n;
   return table;
  });
 }
 function integral(table,u){const p=clamp(u,0,1)*(table.length-1),i=Math.floor(p);
  return i===table.length-1?table[i]:table[i]+(table[i+1]-table[i])*(p-i);}
 function rotate(x,y,angle){const a=angle*DEG,C=Math.cos(a),S=Math.sin(a);return [x*C-y*S,x*S+y*C];}
 function layerFrame(c,e,k,time,a,drift,spin){
  const l=e.layers[k];if(!l.enabled||!l.visible||l.alpha===0)return [];
  const s=scheduleNormalized(c,e,k),out=[],isGust=k==='gusts';
  const local=mod(canonical(time-(e.timeOffset+l.timeOffset)/60),PERIOD);
  const baseAngle=a.rotation+e.rotation,angle=baseAngle+l.rotation;
  const [ox,oy]=rotate(e.x+l.x,e.y+l.y,baseAngle);
  for(const ev of s.events){
   const rnd=i=>random(s.seed,ev.index,i);
   const life=isGust?.4+.4*rnd(0):c.lifetime*(.8+.4*rnd(0));
   // Reconstruct every preceding cycle with a still-alive cohort. No ticker history.
   const first=mod(local-ev.time,PERIOD);
   for(let age=first,cohort=0;age<life;age+=PERIOD,cohort++){
    const u=age/life,rgba=Colors.sample(c.palette,u);
    const alpha=clamp(Curves.evaluate(c.alphaCurve,u)*rgba[3]*l.alpha,0,1);
    if(alpha===0)continue;
    const f=life*integral(drift,u),turn=life*integral(spin,u),phase=rnd(1)*TAU;
    const flutter=c.flutterAmplitude*(.6+.8*rnd(2))*l.parallax;
    const travel=c.windSpeed*l.speedScale*l.parallax*f;
    const x=s.lanes[ev.lane].x+travel+flutter*(Math.sin(phase+age*c.flutterFrequency*TAU)-Math.sin(phase));
    const y=isGust?age*8:c.fallSpeed*l.speedScale*(.85+.3*rnd(3))*age;
    const [dx,dy]=rotate(x,y,angle);
    const rotation=angle+rnd(4)*360+(rnd(5)<.5?-1:1)*c.tumble*turn*l.speedScale;
    const size=c.leafSize*l.sizeScale*(1+c.shapeVariance*(2*rnd(6)-1)*.45);
    const fold=1-.86*Math.abs(Math.sin(phase+turn*c.tumble*DEG));
    out.push({id:k+':'+ev.index+':'+cohort,kind:isGust?'gust':'leaf',age,u,
     x:a.x+ox+dx,y:a.y+oy+dy,rotation,
     width:isGust?size*2.5:size*fold,height:isGust?Math.max(1,size*.08):size*(.55+.25*rnd(7)),
     shape:(1-c.shapeVariance)*.5+c.shapeVariance*rnd(8),
     tint:Colors.hex(rgba),alpha,blend:l.blend});
   }
  }
  return out;
 }
 function sample(input,seconds,anchors={}){
  const c=normalize(input);num(seconds,'seconds',0,1e8);
  const time=mod(canonical(seconds),PERIOD),emitters=[],diagnostics=[];
  const drift=integralTable(c.driftCurve),spin=integralTable(c.spinCurve);
  let particles=0;
  for(const e of c.emitters){
   if(!e.enabled||!e.visible)continue;
   const a=Object.hasOwn(anchors,e.id)?anchors[e.id]:e.anchor.type==='world'?e.anchor:null;
   if(!a){diagnostics.push({code:'missing-anchor',emitter:e.id});continue;}
   const anchor={x:num(a.x,'resolved anchor x',-1e7,1e7),y:num(a.y,'resolved anchor y',-1e7,1e7),
    rotation:num(a.rotation??0,'resolved anchor rotation',-36000,36000)};
   const layers={};
   for(const k of LAYERS){layers[k]=layerFrame(c,e,k,time,anchor,drift,spin);particles+=layers[k].length;}
   emitters.push({id:e.id,layers});
  }
  if(particles>BUDGETS[c.quality])throw RangeError('EARTH-04 quality budget exceeded: '+particles+'/'+BUDGETS[c.quality]);
  return {schemaVersion:1,time,emitters,diagnostics,counters:{particles}};
 }
 return {schemaVersion:1,PERIOD,LAYERS,BUDGETS,defaults,newEmitter,palette,normalize,schedule,sample};
});
