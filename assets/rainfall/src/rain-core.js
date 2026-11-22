// WATER-02 continuous periodic rainfall: pure seeded effect in absolute 60 Hz seconds.
// Periodic emissions are reconstructed from preceding cycles for seamless scrubbing.
// Preview, PNG and Vite ESM must embed the identical source file.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxRain=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('WATER-02 requires FX-CORE curves/spacing/colors');
 const VERSION=1,PI=Math.PI,DEG=PI/180,LAYERS=Object.freeze(['drops','far','near','impacts']);
 const BUDGETS=Object.freeze({low:{particles:260,impacts:80},
  balanced:{particles:950,impacts:220},high:{particles:2400,impacts:480}});
 const valid=(x,key,lo,hi,int=false)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi||
   (int&&!Number.isInteger(x)))throw TypeError('WATER-02 invalid '+key);
  return x;
 };
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function shape(x,fields,label){
  if(!x||typeof x!=='object'||Array.isArray(x))throw TypeError('WATER-02 invalid '+label);
  for(const k of Object.keys(x))if(!fields.includes(k))throw TypeError('WATER-02 unknown '+label+'.'+k);
 }
 function hash(x){let v=2166136261;for(let i=0;i<x.length;i++)
  v=Math.imul(v^x.charCodeAt(i),16777619);
  return v|0;
 }
 function random(seed,index,stream=0){
  let n=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b);
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,entries,unit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?
    'normalized-path':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],
   valueRange:unit==='px'?[2,100]:[0,3],defaultValue:entries[0][1],
   clamp:'hold',monotonic:false,
   keys:entries.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function newEmitter(index=0){
  const layer=(enabled,alpha)=>({enabled,visible:true,x:0,y:0,rotation:0,
   timeOffset:0,alpha,blend:'normal'});
  return {id:'emitter'+(index+1),name:'Rain source '+(index+1),
   enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,
   seed:1033+index*137,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:0,rotation:0},
   layers:{drops:layer(true,1),far:layer(false,.46),
    near:layer(false,.85),impacts:layer(true,.7)}};
 }
 function defaults(){
  return {schemaVersion:1,durationFrames:60,exportFrames:60,loop:true,
   density:45,streakLength:14,windAngle:10,fallSpeed:260,dropWidth:2,
   impactProbability:.3,groundY:450,groundBandHeight:10,
   impactSize:6,impactLifetime:.22,spawnY:-70,fieldWidth:320,
   spatialGap:18,spatialJitter:0,spatialMode:'even',spacingCurveEnabled:false,
   nearSpeed:1.45,farSpeed:.68,nearSize:1.4,farSize:.7,
   seed:83291,quality:'balanced',style:'natural',
   densityCurve:curve('density','effectTime',[[0,.7],[.4,1],[1,.7]]),
   windCurve:curve('wind','effectTime',[[0,.3],[.5,.7],[1,.3]]),
   dropAlphaCurve:curve('dropAlpha','particleAge',[[0,0],[.1,1],[.9,1],[1,0]]),
   spacingCurve:curve('spacingPx','pathPosition',[[0,25],[1,25]],'px'),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'rainColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',
    clamp:'hold',stops:[{id:'light',position:0,rgba:[199,233,255,.95]},
     {id:'deep',position:1,rgba:[97,158,202,.6]}]}),
   emitters:[newEmitter(0)]};
 }
 const top=Object.keys(defaults()),numbers={
  durationFrames:[60,60],exportFrames:[1,3600],
  density:[0,250],streakLength:[1,65],windAngle:[-75,75],
  fallSpeed:[20,1200],dropWidth:[1,8],impactProbability:[0,1],
  groundY:[0,512],groundBandHeight:[1,60],impactSize:[1,35],
  impactLifetime:[.05,1.5],spawnY:[-200,0],fieldWidth:[80,512],
  spatialGap:[2,100],spatialJitter:[0,.45],nearSpeed:[.1,4],
  farSpeed:[.1,4],nearSize:[.25,3],farSize:[.25,3],
  seed:[-2147483648,2147483647]
 };
 const ints=new Set(['durationFrames','exportFrames','seed']);
 function normalize(c){
  shape(c,top,'settings');
  if(c.schemaVersion!==1)throw TypeError('WATER-02 unsupported schema version');
  const out={schemaVersion:VERSION};
  for(const [key,[lo,hi]] of Object.entries(numbers))
   out[key]=valid(c[key],key,lo,hi,ints.has(key));
  if(c.loop!==true)throw TypeError('WATER-02 supports periodic loop only');
  out.loop=true;
  if(typeof c.spacingCurveEnabled!=='boolean')
   throw TypeError('WATER-02 invalid spacingCurveEnabled');
  out.spacingCurveEnabled=c.spacingCurveEnabled;
  for(const [name,options] of Object.entries({
   spatialMode:['even','random','stratified','clustered'],
   quality:Object.keys(BUDGETS),style:['natural','stylized','magical']})){
   if(!options.includes(c[name]))throw TypeError('WATER-02 invalid '+name);
   out[name]=c[name];
  }
  for(const [name,key,domain,unit] of [
   ['densityCurve','density','effectTime','multiplier'],
   ['windCurve','wind','effectTime','multiplier'],
   ['dropAlphaCurve','dropAlpha','particleAge','multiplier'],
   ['spacingCurve','spacingPx','pathPosition','px']]){
   out[name]=Curves.normalize(c[name]);
   if(out[name].parameterKey!==key||out[name].domain!==domain||
    out[name].valueUnit!==unit)throw TypeError('WATER-02 invalid '+name);
  }
  out.palette=Colors.normalize(c.palette);
  if(out.palette.domain!=='particleAge'||out.palette.parameterKey!=='rainColor')
   throw TypeError('WATER-02 invalid rain palette');
  if(!Array.isArray(c.emitters)||c.emitters.length>4)
   throw TypeError('WATER-02 allows max 4 emitters');
  out.emitters=[];const ids=new Set();
  for(const v of c.emitters){
   shape(v,['id','name','enabled','visible','x','y','rotation',
    'timeOffset','seed','anchor','layers'],'emitter');
   if(typeof v.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(v.id)||ids.has(v.id))
    throw TypeError('WATER-02 duplicate or invalid emitter id');
   ids.add(v.id);
   if(typeof v.name!=='string'||!v.name.trim()||v.name.length>128)
    throw TypeError('WATER-02 invalid emitter name');
   for(const key of ['enabled','visible'])
    if(typeof v[key]!=='boolean')throw TypeError('WATER-02 invalid emitter '+key);
   const e={id:v.id,name:v.name,enabled:v.enabled,visible:v.visible,
    x:valid(v.x,'emitter.x',-10000,10000),
    y:valid(v.y,'emitter.y',-10000,10000),
    rotation:valid(v.rotation,'emitter.rotation',-360,360),
    timeOffset:valid(v.timeOffset,'emitter.timeOffset',-3600,3600,true),
    seed:valid(v.seed,'emitter.seed',-2147483648,2147483647,true)};
   const a=v.anchor;
   shape(a,['type','space','name','slot','x','y','rotation'],'anchor');
   if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
    !['world','local'].includes(a.space)||typeof a.name!=='string'||
    typeof a.slot!=='string'||(a.type==='attachment'&&!a.slot.trim())||
    (['bone','slot','attachment'].includes(a.type)&&!a.name.trim()))
    throw TypeError('WATER-02 invalid anchor');
   e.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:valid(a.x,'anchor.x',-10000,10000),
    y:valid(a.y,'anchor.y',-10000,10000),
    rotation:valid(a.rotation,'anchor.rotation',-360,360)};
   if(!v.layers||Object.keys(v.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('WATER-02 expects four independent layers');
   e.layers={};
   for(const key of LAYERS){
    const l=v.layers[key];
    shape(l,['enabled','visible','x','y','rotation','timeOffset','alpha','blend'],'layer');
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
     !['normal','add'].includes(l.blend))throw TypeError('WATER-02 invalid layer '+key);
    e.layers[key]={enabled:l.enabled,visible:l.visible,
     x:valid(l.x,key+'.x',-10000,10000),y:valid(l.y,key+'.y',-10000,10000),
     rotation:valid(l.rotation,key+'.rotation',-360,360),
     timeOffset:valid(l.timeOffset,key+'.timeOffset',-3600,3600,true),
     alpha:valid(l.alpha,key+'.alpha',0,1),blend:l.blend};
   }
   out.emitters.push(e);
  }
  return out;
 }
 const cache=new Map();
 function memo(key,compute){
  if(cache.has(key))return cache.get(key);
  const result=compute();cache.set(key,result);
  if(cache.size>24)cache.delete(cache.keys().next().value);
  return result;
 }
 function scheduleNormalized(c,e){
  const key=JSON.stringify([c.seed,e.seed,e.id,c.density,c.densityCurve,
   c.spatialMode,c.spatialGap,c.spatialJitter,c.fieldWidth,
   c.spacingCurveEnabled,c.spacingCurve]);
  return memo(key,()=>{
   let total=0;
   for(let i=0;i<2048;i++)total+=Curves.evaluate(c.densityCurve,(i+.5)/2048);
   const mean=total/2048;
   const density=c.density&&mean>1e-9?c.density/mean:0;
   const rateCurve=Curves.normalize({...c.densityCurve,
    parameterKey:'emissionRate',domain:'emitterTime'});
   const seed=c.seed^e.seed^hash(e.id);
   const timed=Spacing.createTemporalSchedule({schemaVersion:1,
    mode:'custom',frequencySource:'rate',baseRate:density,
    interval:density?1/density:1,duration:1,minInterval:0,
    jitter:0,burstCount:1,burstDelay:0,seed,maxEvents:1024,
    rateCurve,intervalCurve:null});
   if(timed.capped)throw RangeError('WATER-02 emission budget overflow');
   // Exactly one row of deterministic arc-length lanes. The lane-to-particle
   // mapping is cyclic, not an attempt to force 45 drops in 18px physical gaps.
   const w=c.fieldWidth/2,path={schemaVersion:1,closed:false,
    segments:[{p0:[-w,0],p1:[-w/3,0],p2:[w/3,0],p3:[w,0]}]};
   const placed=Spacing.createSpatialPlacement({schemaVersion:1,path,
    baseSpacingPx:c.spatialGap,minSpacing:2,maxSpacing:100,
    spacingCurve:c.spacingCurveEnabled?c.spacingCurve:null,
    mode:c.spatialMode,jitter:c.spatialJitter,seed,
    maxPoints:512,pathFollow:'clamp',alignToTangent:false});
   if(placed.capped)throw RangeError('WATER-02 spatial placement budget overflow');
   return {events:timed.events.filter(v=>v.time<1-1e-9),
    positions:placed.points.map(p=>p.x),rateIntegral:mean,
    timingCapped:false,spatialCapped:false};
  });
 }
 function schedule(c,e){const v=normalize(c);
  const em=v.emitters.find(x=>x.id===e.id)||e;return scheduleNormalized(v,em);
 }
 function windTable(c){
  return memo(JSON.stringify(['wind',c.windAngle,c.fallSpeed,c.windCurve]),()=>{
   const n=512,values=new Float64Array(n+1);
   for(let i=0;i<n;i++){
    const m=(i+.5)/n;
    const factor=Curves.evaluate(c.windCurve,m);
    const vx=c.fallSpeed*Math.tan(c.windAngle*factor*2*DEG);
    values[i+1]=values[i]+vx/n;
   }
   return {n,values,total:values[n]};
  });
 }
 function windAt(t,table){
  const periods=Math.floor(t),f=t-periods,p=f*table.n,
   i=Math.min(table.n-1,Math.floor(p)),u=p-i;
  return periods*table.total+table.values[i]*(1-u)+table.values[i+1]*u;
 }
 const period=t=>Math.round(((t%1)+1)%1*1e9)/1e9;
 const identity=(c,e)=>(c.seed^e.seed^hash(e.id))|0;
 function rgba(c,age,opacity){
  const col=Colors.sample(c.palette,clamp(age,0,1));
  const style=c.style==='natural'?[1,1,1]:
   c.style==='stylized'?[1.08,1.13,1.15]:[1.03,.83,1.25];
  return col.slice(0,3).map((v,i)=>clamp(v*style[i],0,255))
   .concat([clamp(col[3]*opacity,0,1)]);
 }
 function inLayer(c,e,kind,globalTime,anchor){
  const layer=e.layers[kind];
  if(!e.enabled||!e.visible||!layer.enabled||!layer.visible||layer.alpha===0)
   return [];
  if(kind==='impacts'&&(!e.layers.drops.enabled||!e.layers.drops.visible||
    c.density===0||c.impactProbability===0))return [];
  const t=period(globalTime-(e.timeOffset+layer.timeOffset)/60);
  const seed=identity(c,e),plans=scheduleNormalized(c,e),
   table=windTable(c),list=[];
  const velocity=kind==='far'?c.fallSpeed*c.farSpeed:
   kind==='near'?c.fallSpeed*c.nearSpeed:c.fallSpeed;
  const colorFactor=kind==='far'?.55:kind==='near'?.95:1;
  const widthFactor=kind==='far'?c.farSize:kind==='near'?c.nearSize:1;
  // All candidate events from previous cycles are iterated by absolute age,
  // then re-originated into the single canonical 60-frame period.
  const duration=Math.max(0,(c.groundY+c.groundBandHeight/2-anchor.y-e.y-c.spawnY)/velocity);
  const cycles=Math.min(100,Math.ceil((duration+c.impactLifetime)/1)+2);
  for(let back=0;back<=cycles;back++){
   const cycle=-back;
   for(const event of plans.events){
    const bornAt=event.time+cycle,age=t-bornAt;
    if(age<0)continue;
    const i=event.index,place=plans.positions[i%Math.max(1,plans.positions.length)]??0,
     x0=place+(random(seed,i,17)-.5)*c.spatialJitter*c.spatialGap*.4,
     contactY=c.groundY+(random(seed,i,899)-.5)*c.groundBandHeight,
     contactDuration=Math.max(0,(contactY-anchor.y-e.y-c.spawnY)/velocity);
    const sx=kind==='near'?.25:kind==='far'?.6:1;
    const wind=windAt(t,table)-windAt(bornAt,table);
    const x=x0+wind*sx;
    const y=c.spawnY+velocity*age;
    const p=colorFactor*layer.alpha;
    if(kind==='impacts'){
     // Only truly crossing the horizontal ground band can generate a flash.
     const crossing=(contactY-anchor.y-e.y-c.spawnY)/c.fallSpeed;
     const after=age-crossing;
     if(after<0||after>=c.impactLifetime||
      random(seed,i,701)>=c.impactProbability)continue;
     const worldX=x0+windAt(bornAt+crossing,table)-windAt(bornAt,table);
     list.push({kind:'ring',x:worldX,y:c.spawnY+c.fallSpeed*crossing,
      radius:c.impactSize*(.3+.7*after/c.impactLifetime),
      thickness:Math.max(.5,c.dropWidth*.5*(1-after/c.impactLifetime)),
      rgba:rgba(c,after/c.impactLifetime,p*(1-after/c.impactLifetime)),
      bornAt:bornAt+crossing,index:i,cycle});
    }else if(age<contactDuration && y>-c.streakLength-200 && y<=contactY-anchor.y-e.y){
     const u=clamp(age/Math.max(.00001,contactDuration),0,1),
      alpha=Curves.evaluate(c.dropAlphaCurve,u);
     const vx=c.windAngle===0?0:c.fallSpeed*
      Math.tan(c.windAngle*Curves.evaluate(c.windCurve,period(t))*2*DEG)*sx;
     list.push({kind:'streak',x,y,
      width:c.dropWidth*widthFactor,length:c.streakLength*widthFactor,
      rotation:-Math.atan2(vx,velocity),rgba:rgba(c,u,p*alpha),
      age,bornAt,index:i,cycle});
    }
   }
  }
  list.sort((a,b)=>a.bornAt-b.bornAt||a.index-b.index);
  return list;
 }
 function sample(c,seconds,anchors=null){
  const s=normalize(c);
  valid(seconds,'time',0,1e8);
  const time=period(seconds),emitters=[];
  let particleCount=0,impactCount=0;
  for(const e of s.emitters){
   if(!e.enabled||!e.visible)continue;
   const anchor=anchors?.[e.id]||{x:e.anchor.x,y:e.anchor.y};
   const layers={};
   for(const kind of LAYERS){
    layers[kind]=inLayer(s,e,kind,time,anchor);
    if(kind==='impacts')impactCount+=layers[kind].length;
    else particleCount+=layers[kind].length;
   }
   emitters.push({id:e.id,layers});
  }
  const budget=BUDGETS[s.quality];
  if(particleCount>budget.particles||impactCount>budget.impacts)
   throw RangeError('WATER-02 particle budget overflow '+particleCount+
    '/'+impactCount+' exceeds '+budget.particles+'/'+budget.impacts);
  return {schemaVersion:1,time,frame:time*60,emitters,diagnostics:[],
   counters:{particles:particleCount,impacts:impactCount}};
 }
 function bounds(f,anchors,c){
  const s=normalize(c),b={inside:true,horizontalInside:true,empty:true,
   minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const x of f.emitters){
   const e=s.emitters.find(v=>v.id===x.id),a=anchors?.[x.id]||
    {x:e.anchor.x,y:e.anchor.y};
   const main=(e.rotation+e.anchor.rotation)*DEG;
   for(const kind of LAYERS){
    const l=e.layers[kind],angle=main+l.rotation*DEG,
     C=Math.cos(angle),S=Math.sin(angle),mC=Math.cos(main),mS=Math.sin(main);
    const originX=a.x+(e.x+l.x)*mC-(e.y+l.y)*mS,
     originY=a.y+(e.x+l.x)*mS+(e.y+l.y)*mC;
    for(const drop of x.layers[kind]){
     const dx=originX+drop.x*C-drop.y*S,dy=originY+drop.x*S+drop.y*C,
      radius=drop.kind==='ring'?drop.radius+drop.thickness:
       Math.max(drop.width,drop.length)/2;
     b.empty=false;
     b.minX=Math.min(b.minX,dx-radius);b.maxX=Math.max(b.maxX,dx+radius);
     b.minY=Math.min(b.minY,dy-radius);b.maxY=Math.max(b.maxY,dy+radius);
    }
   }
  }
  if(!b.empty)b.horizontalInside=b.minX>=0&&b.maxX<=512;
  b.inside=b.horizontalInside; // authorized vertical entrance/exit is clipped
  return b;
 }
 return Object.freeze({VERSION,LAYERS,BUDGETS,defaults,newEmitter,
  normalize,schedule,sample,bounds,random});
});
