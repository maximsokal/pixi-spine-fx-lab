// GAME-12 T01: deterministic renderer-independent loot sparkle plan.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLoot=api;
})(globalThis,function(C,S,COL){
 'use strict';
 if(!C||!S||!COL)throw Error('GAME-12 requires curves/spacing/colors');
 const LAYERS=Object.freeze(['stars','sweep','halo']),TAU=2*Math.PI,DEG=Math.PI/180;
 const BUDGETS=Object.freeze(Object.fromEntries([['low',40,128],['balanced',160,512],['high',320,1024]].map(([k,stars,primitives])=>[k,Object.freeze({stars,primitives})])));
 const fail=m=>{throw RangeError('GAME-12 '+m);};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const mod=(n,d)=>((n%d)+d)%d;
 function num(v,k,a,b,int=false){if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail('invalid '+k);return v;}
 function bool(v){if(typeof v!=='boolean')fail('invalid toggle');return v;}
 function shape(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid fields');}
 function one(v,values,k){if(!values.includes(v))fail('invalid '+k);return v;}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function rand(seed,i,salt){let x=seed^Math.imul(i+1,0x9e3779b1)^hash(salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function curve(key,domain,points,range=[0,1],unit='multiplier'){return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration',valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 const anchor=type=>({type,name:''});
 function newEmitter(i=0){num(i,'index',0,100000,true);const layer=(enabled,k)=>({enabled,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed:31+k*97,alpha:1,blend:'normal',anchor:anchor('inherit')});return {id:'emitter'+(i+1),enabled:true,visible:true,x:256,y:256,rotation:0,scale:1,timeOffset:0,seed:(1033+i*137)|0,anchor:anchor('world'),layers:{stars:layer(true,0),sweep:layer(false,1),halo:layer(false,2)}};}
 function defaults(){return {schemaVersion:1,mode:'pickup',durationFrames:40,sparkleCount:12,sparkleSize:8,spawnIntervalFrames:6,lifetimeFrames:18,haloRadius:40,twinkleHz:2,spreadRadius:55,baseGapPx:18,minGapPx:3,maxGapPx:90,spatialJitter:.2,distribution:'even',timeJitter:0,minIntervalFrames:0,frequencySource:'interval',groupCount:1,groupDelayFrames:0,shineDelayFrames:0,seed:7321,quality:'balanced',
  sizeCurve:curve('starSize','particleAge',[[0,0],[.3,1],[1,0]]),alphaCurve:curve('starAlpha','particleAge',[[0,0],[.25,1],[1,0]]),haloCurve:curve('haloPulse','effectTime',[[0,.6],[.5,1],[1,.6]]),
  rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,4]),intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4]),spacingCurve:curve('spacingPx','pathPosition',[[0,18],[1,18]],[3,90],'px'),
  palette:COL.normalize({schemaVersion:1,parameterKey:'lootColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'white',position:0,rgba:[255,255,255,1]},{id:'gold',position:.5,rgba:[255,229,162,1]},{id:'amber',position:1,rgba:[255,201,77,1]}]}),emitters:[newEmitter()]};}
 const KEYS=Object.keys(defaults()),EK=Object.keys(newEmitter()),LK=Object.keys(newEmitter().layers.stars);
 function normAnchor(a,layer){shape(a,['type','name']);one(a.type,layer?['inherit','world','local','bone']:['world','local','bone'],'anchor');if(typeof a.name!=='string'||a.name.length>128||(a.type==='bone'?!a.name.trim():a.name!==''))fail('invalid anchor name');return {...a};}
 function transform(v,layer){return {enabled:bool(v.enabled),visible:bool(v.visible),x:num(v.x,'x',-16384,16384),y:num(v.y,'y',-16384,16384),rotation:num(v.rotation,'rotation',-3600,3600),scale:num(v.scale,'scale',.01,20),timeOffset:num(v.timeOffset,'timeOffset',-3600,3600),seed:num(v.seed,'seed',-2147483648,2147483647,true),anchor:normAnchor(v.anchor,layer)};}
 function normalize(input){shape(input,KEYS);if(input.schemaVersion!==1)fail('schemaVersion');const c={schemaVersion:1,mode:one(input.mode,['pickup','idle'],'mode')};
  c.durationFrames=num(input.durationFrames,'durationFrames',c.mode==='idle'?60:40,c.mode==='idle'?60:40,true);
  for(const [k,a,b,i] of [['sparkleCount',1,80,true],['sparkleSize',1,30],['spawnIntervalFrames',1,40],['lifetimeFrames',1,39],['haloRadius',0,160],['twinkleHz',0,15],['spreadRadius',5,230],['baseGapPx',3,90],['minGapPx',3,90],['maxGapPx',3,90],['spatialJitter',0,.45],['timeJitter',0,.45],['minIntervalFrames',0,40],['groupCount',1,8,true],['groupDelayFrames',0,40],['shineDelayFrames',0,40],['seed',-2147483648,2147483647,true]])c[k]=num(input[k],k,a,b,i);
  if(c.minGapPx>c.maxGapPx)fail('invalid gap range');
  c.quality=one(input.quality,Object.keys(BUDGETS),'quality');c.distribution=one(input.distribution,['even','random','stratified','clustered'],'distribution');c.frequencySource=one(input.frequencySource,['interval','rate'],'frequencySource');
  for(const [k,key,domain,min,max,unit] of [['sizeCurve','starSize','particleAge',0,1,'multiplier'],['alphaCurve','starAlpha','particleAge',0,1,'multiplier'],['haloCurve','haloPulse','effectTime',0,1,'multiplier'],['rateCurve','emissionRate','emitterTime',0,4,'multiplier'],['intervalCurve','emissionInterval','emitterTime',.25,4,'multiplier'],['spacingCurve','spacingPx','pathPosition',3,90,'px']]){
   const v=C.normalize(input[k]);if(v.parameterKey!==key||v.domain!==domain||v.valueUnit!==unit||v.inputUnit!==(domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration')||v.valueRange[0]<min||v.valueRange[1]>max)fail('invalid '+k);c[k]=v;
  }
  if(c.mode==='idle'&&Math.abs(C.evaluate(c.haloCurve,0)-C.evaluate(c.haloCurve,1))>1e-9)fail('idle halo curve seam');
  c.palette=COL.normalize(input.palette);if(c.palette.parameterKey!=='lootColor'||c.palette.domain!=='particleAge')fail('invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('requires 1–4 emitters');const ids=new Set();
  c.emitters=input.emitters.map(e=>{shape(e,EK);if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('invalid emitter id');ids.add(e.id);shape(e.layers,LAYERS);
   return {id:e.id,...transform(e,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];shape(l,LK);return [k,{...transform(l,true),alpha:num(l.alpha,'alpha',0,1),blend:one(l.blend,['normal','add','screen','multiply'],'blend')}];}))};
  });return c;
 }
 function ring(r){const k=.5522847498307936*r;return {schemaVersion:1,closed:true,segments:[{p0:[r,0],p1:[r,k],p2:[k,r],p3:[0,r]},{p0:[0,r],p1:[-k,r],p2:[-r,k],p3:[-r,0]},{p0:[-r,0],p1:[-r,-k],p2:[-k,-r],p3:[0,-r]},{p0:[0,-r],p1:[k,-r],p2:[r,-k],p3:[r,0]}]};}
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function compile(input){const c=freeze(normalize(input)),period=c.durationFrames,end=period-1,loop=c.mode==='idle',budget=BUDGETS[c.quality];let reservedStars=0,reservedPrimitives=0,totalBirths=0;
  const rows=c.emitters.map(e=>{const l=e.layers.stars,seed=c.seed^e.seed^l.seed^hash(e.id);let anchors=[],births=[],pathLength=0;
   if(active(e,l)){
    const factor=c.baseGapPx/18,scale=v=>v*factor,sc=c.spacingCurve;
    const gap={...sc,valueRange:sc.valueRange.map(scale),defaultValue:scale(sc.defaultValue),keys:sc.keys.map(k=>({...k,y:scale(k.y),...(k.in?{in:[k.in[0],scale(k.in[1])]}:{}),...(k.out?{out:[k.out[0],scale(k.out[1])]}:{})}))};
    const place=S.createSpatialPlacement({path:ring(c.spreadRadius),baseSpacingPx:c.baseGapPx,minSpacing:c.minGapPx,maxSpacing:c.maxGapPx,spacingCurve:gap,mode:c.distribution,jitter:c.spatialJitter,seed:seed^hash('space'),maxPoints:8192});
    if(place.capped)fail('placement budget');pathLength=place.table.length;
    const start=S.pointAtDistance(place.table,0);
    anchors=[{distance:0,x:start.x,y:start.y},...place.points.filter(p=>pathLength-p.distance>=c.minGapPx-1e-9).map(p=>({distance:p.distance,x:p.x,y:p.y}))];
    // Fixed spatial permutation, independent of event rate and count.
    anchors=anchors.map((p,i)=>({...p,order:rand(seed,i,'order')})).sort((a,b)=>a.order-b.order||a.distance-b.distance);
    const schedule=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:60/c.spawnIntervalFrames,interval:c.spawnIntervalFrames/60,duration:(loop?period:end)/60,minInterval:c.minIntervalFrames/60,jitter:c.timeJitter,seed:seed^hash('time'),rateCurve:c.rateCurve,intervalCurve:c.intervalCurve,maxEvents:4096});
    if(schedule.capped)fail('event budget');const triggers=schedule.events.map(v=>v.time*60);
    if(loop)for(let i=0;i<triggers.length;i++)triggers[i]=Math.abs(triggers[i]-period)<1e-7?0:triggers[i];
    triggers.sort((a,b)=>a-b);
    for(let i=0;i<triggers.length;i++){
     const t=triggers[i],next=triggers[i+1]??(loop?triggers[0]+period:Infinity);
     if(c.groupDelayFrames*(c.groupCount-1)>0&&t+c.groupDelayFrames*(c.groupCount-1)>=next-1e-9)fail('overlapping grouped births');
     for(let j=0;j<c.groupCount;j++){const at=t+j*c.groupDelayFrames;if(loop||at<end-1e-9)births.push({frame:loop?mod(at,period):at,index:births.length});}
    }
    births.sort((a,b)=>a.frame-b.frame||a.index-b.index);
    totalBirths+=births.length;if(totalBirths>4096)fail('event budget');
    reservedStars+=Math.min(c.sparkleCount,anchors.length,births.length);
   }
   reservedPrimitives+=Number(active(e,e.layers.sweep))+Number(active(e,e.layers.halo));
   return {id:e.id,anchors,births,pathLength,seed};
  });
  if(reservedStars>budget.stars||reservedStars+reservedPrimitives>budget.primitives)fail('quality budget exceeded');
  freeze(rows);
  function compose(p,t){const a=p.rotation*DEG,x=t.x*p.scale,y=t.y*p.scale;return {x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),rotation:p.rotation+t.rotation,scale:p.scale*t.scale};}
  function resolve(t,parent,poses){let p={x:0,y:0,rotation:0,scale:1};if(t.anchor.type==='inherit')p=parent;else if(t.anchor.type!=='world'){
    const key=t.anchor.type==='local'?'$local':t.anchor.name;p=poses&&Object.hasOwn(poses,key)?poses[key]:null;
    if(!p||![p.x,p.y,p.rotation,p.scale].every(Number.isFinite)||p.scale<=0)return null;
   }return p?compose(p,t):null;}
  function sample(seconds,poses={}){num(seconds,'time',0,1e7);const raw=seconds*60,frame=loop?mod(raw,period):Math.min(raw,end),diagnostics=[],emitters=[];let cost=0;
   for(let i=0;i<c.emitters.length;i++){const e=c.emitters[i],row=rows[i],layers={stars:[],sweep:[],halo:[]},origin=resolve(e,null,poses);let capped=false;
    for(const k of LAYERS){const l=e.layers[k];if(!active(e,l)||(!loop&&raw>=end))continue;const t=frame-e.timeOffset-l.timeOffset-(k==='sweep'?c.shineDelayFrames:0),local=loop?mod(t,period):t;if(!loop&&(local<0||local>=end))continue;
     const pose=resolve(l,origin,poses);if(!pose){diagnostics.push({emitterId:e.id,layer:k,reason:'missing anchor'});continue;}
     const fade=loop?1:clamp((end-frame)/6,0,1),seed=c.seed^e.seed^l.seed^hash(e.id+':'+k);
     if(k==='stars'){
      const available=row.births.map(b=>({b,age:loop?mod(local-b.frame,period):local-b.frame})).filter(v=>v.age>=0&&v.age<c.lifetimeFrames).sort((a,b)=>a.age-b.age||a.b.index-b.b.index);
      const used=new Set();for(const {b,age} of available){if(layers.stars.length>=c.sparkleCount){capped=true;break;}
       const u=age/c.lifetimeFrames,a=row.anchors[b.index%row.anchors.length];if(used.has(a.distance)){capped=true;continue;}used.add(a.distance);
       const twinkle=.75+.25*Math.cos(TAU*(c.twinkleHz*age/60+rand(seed,b.index,'phase')));
       const radius=c.sparkleSize*C.evaluate(c.sizeCurve,u)*twinkle*pose.scale,rgba=COL.sample(c.palette,u);rgba[3]*=l.alpha*C.evaluate(c.alphaCurve,u)*fade;
       if(radius<=0||rgba[3]<=0)continue;
       const pos=compose(pose,{x:a.x,y:a.y,rotation:0,scale:1}),angle=pose.rotation*DEG+TAU*rand(seed,b.index,'rotation'),points=[];
       for(let n=0;n<8;n++){const a=angle+n*Math.PI/4,d=radius*(n%2?.24:1);points.push([pos.x+Math.cos(a)*d,pos.y+Math.sin(a)*d]);}
       layers.stars.push({id:e.id+'-star-'+b.index,x:pos.x,y:pos.y,radius,age,bornFrame:b.frame,distance:a.distance,points,rgba,blend:l.blend});
      }
     }else{
      const u=local/(loop?period:end),rgba=COL.sample(c.palette,.5);rgba[3]*=l.alpha*fade*(k==='halo'?.45*C.evaluate(c.haloCurve,u):.55*(loop?1:Math.sin(Math.PI*u)));
      const radius=c.haloRadius*pose.scale;if(radius>0&&rgba[3]>0)layers[k].push({id:e.id+'-'+k,x:pose.x,y:pose.y,radius,rotation:pose.rotation+360*(u+rand(seed,0,'phase')),rgba,blend:l.blend});
     }
    }cost+=LAYERS.reduce((n,k)=>n+layers[k].length,0);emitters.push({id:e.id,layers,capped});
   }
   return {frame,cost,emitters,diagnostics};
  }
  return Object.freeze({settings:c,emitters:rows,reservedStars,reservedPrimitives:reservedStars+reservedPrimitives,sample});
 }
 function sample(input,seconds,poses){return compile(input).sample(seconds,poses);}
 function bounds(snapshot,crop={x:0,y:0,width:512,height:512}){for(const k of ['x','y','width','height'])num(crop[k],k,k==='width'||k==='height'?1:-1e7,1e7);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const e of snapshot.emitters)for(const k of LAYERS)for(const p of e.layers[k]){minX=Math.min(minX,p.x-p.radius);minY=Math.min(minY,p.y-p.radius);maxX=Math.max(maxX,p.x+p.radius);maxY=Math.max(maxY,p.y+p.radius);}
  if(minX===Infinity)return {empty:true,inside:true,minX:null,minY:null,maxX:null,maxY:null};
  return {empty:false,inside:minX>=crop.x&&minY>=crop.y&&maxX<=crop.x+crop.width&&maxY<=crop.y+crop.height,minX,minY,maxX,maxY};
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,normalize,newEmitter,compile,sample,bounds};
});
