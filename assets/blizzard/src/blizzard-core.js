(function(root,factory){
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxBlizzard=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 const LAYERS=Object.freeze(['streaks','foreground','whiteout']),BUDGETS=Object.freeze({low:512,balanced:2048,high:4096}),
  LIFE=Object.freeze({streaks:3,foreground:1.2}),SPAN=864,HALF=SPAN/2,FIELD=256,MAX_EVENTS=4096;
 const NUMBERS=Object.freeze({particleRate:[75,0,400],windSpeed:[200,0,900],windVariance:[.6,0,1],streakLength:[20,2,90],density:[.75,0,1],angle:[35,-90,90],nearGapPx:[8,1,75],spatialJitter:[.25,0,.65]});
 const CURVES=Object.freeze([
  ['stormIntensityCurve','stormIntensity','effectTime',1,[[0,.5],[.3,1],[.75,.8],[1,.5]]],
  ['driftSpeedCurve','driftSpeed','particleAge',3,[[0,1],[.7,1.1],[1,.8]]],
  ['whiteoutAlphaCurve','whiteoutAlpha','effectTime',1,[[0,.1],[.4,.5],[1,.1]]],
  ['emissionRateCurve','emissionRate','effectTime',3,[[0,1],[.3,1.5],[.75,1.2],[1,1]]],
  ['spacingCurve','spacing','pathPosition',3,[[0,1],[1,1]]],
  ['particleAlphaCurve','particleAlpha','particleAge',1,[[0,0],[.12,1],[.85,1],[1,0]]]
 ]);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),mod=(v,n)=>((v%n)+n)%n;
 const phase=(v,n)=>{const t=Math.round(mod(v,n)*1e12)/1e12;return t>=n-1e-12?0:t;};
 function fail(name){throw RangeError('AIR-03 invalid '+name);}
 function num(v,name,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(name);return v;}
 function int(v,name,min,max){num(v,name,min,max);if(!Number.isInteger(v))fail(name);return v;}
 function pick(v,choices,name){if(!choices.includes(v))fail(name);return v;}
 function bool(v,name){if(typeof v!=='boolean')fail(name);return v;}
 function exact(v,keys,name){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail(name);}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function rand(seed,id,salt){let x=seed^Math.imul(id+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;}
 function unit(domain){return domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration';}
 function makeCurve(key,domain,max,knots){return Curves.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:unit(domain),valueUnit:'multiplier',inputRange:[0,1],valueRange:[0,max],defaultValue:knots[0][1],clamp:'hold',monotonic:false,keys:knots.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function stylePalette(style){
  pick(style,['natural','stylized','magical'],'style');
  const colors=style==='natural'?[[255,255,255,1],[184,213,242,1]]:style==='stylized'?[[255,255,255,1],[125,210,255,1]]:[[255,247,255,1],[199,169,255,1]];
  return Colors.normalize({schemaVersion:1,parameterKey:'stormColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:colors.map((rgba,i)=>({id:'c'+i,position:i,rgba}))});
 }
 function anchor(type='world',x=0,y=0){return {type,space:'world',name:'',slot:'',x,y,rotation:0};}
 function newEmitter(index=0){
  int(index,'emitter index',0,2147483646);
  const common=(seed,enabled=true)=>({enabled,visible:true,x:0,y:0,rotation:0,timeOffset:0,seed});
  return {id:'emitter'+(index+1),name:'Blizzard '+(index+1),...common((1991+337*index)|0),anchor:anchor('world',256,256),
   layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{...common((71+17*index+i*313)|0,k!=='whiteout'),alpha:1,blend:'normal',anchor:anchor('inherit')}]))};
 }
 function defaults(style='natural'){return {schemaVersion:1,...Object.fromEntries(Object.entries(NUMBERS).map(([k,v])=>[k,v[0]])),seed:7321,mode:'loop',durationFrames:60,exportFrames:60,quality:'balanced',style,spatialMode:'even',
  ...Object.fromEntries(CURVES.map(([f,k,d,m,knots])=>[f,makeCurve(k,d,m,knots)])),palette:stylePalette(style),emitters:[newEmitter()]};}
 const FIELDS=Object.keys(defaults()),EK=Object.keys(newEmitter()),LK=Object.keys(newEmitter().layers.streaks),AK=Object.keys(anchor());
 function normalizeAnchor(a,inherit){
  exact(a,AK,'anchor');const type=pick(a.type,['world','skeleton','bone','slot','attachment',...(inherit?['inherit']:[])],'anchor type');
  if(typeof a.name!=='string'||typeof a.slot!=='string'||a.name.length>128||a.slot.length>128||(['bone','slot','attachment'].includes(type)&&!a.name.trim())||(type==='attachment'&&!a.slot.trim()))fail('anchor name');
  return {type,space:pick(a.space,['world','local'],'anchor space'),name:a.name,slot:a.slot,x:num(a.x,'anchor x',-10000,10000),y:num(a.y,'anchor y',-10000,10000),rotation:num(a.rotation,'anchor rotation',-360,360)};
 }
 function normalize(input){
  exact(input,FIELDS,'settings');if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1};
  for(const [k,[,min,max]] of Object.entries(NUMBERS))c[k]=num(input[k],k,min,max);
  const mode=pick(input.mode,['loop','oneShot'],'mode'),durationFrames=int(input.durationFrames,'durationFrames',40,960);
  if(mode==='oneShot'?durationFrames!==40:durationFrames!==60&&durationFrames<600)fail('duration/mode');
  Object.assign(c,{seed:int(input.seed,'seed',-2147483648,2147483647),mode,durationFrames,exportFrames:int(input.exportFrames,'exportFrames',1,3600),quality:pick(input.quality,Object.keys(BUDGETS),'quality'),style:pick(input.style,['natural','stylized','magical'],'style'),spatialMode:pick(input.spatialMode,['even','random','clustered','stratified'],'spatialMode')});
  for(const [f,k,d,m] of CURVES){
   const v=Curves.normalize(input[f]);if(v.parameterKey!==k||v.domain!==d||v.inputUnit!==unit(d)||v.valueUnit!=='multiplier'||v.inputRange[0]!==0||v.inputRange[1]!==1||v.valueRange[0]<0||v.valueRange[1]>m)fail(f);c[f]=v;
  }
  c.palette=Colors.normalize(input.palette);if(c.palette.parameterKey!=='stormColor'||c.palette.domain!=='particleAge')fail('palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)fail('emitter count');
  const ids=new Set();
  function common(v){return {enabled:bool(v.enabled,'enabled'),visible:bool(v.visible,'visible'),x:num(v.x,'x',-10000,10000),y:num(v.y,'y',-10000,10000),rotation:num(v.rotation,'rotation',-360,360),timeOffset:int(v.timeOffset,'timeOffset',-3600,3600),seed:int(v.seed,'seed',-2147483648,2147483647)};}
  c.emitters=input.emitters.map(e=>{
   exact(e,EK,'emitter');if(typeof e.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(e.id)||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>128)fail('emitter ID/name');ids.add(e.id);
   exact(e.layers,LAYERS,'layers');const layers=Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];exact(l,LK,k);return [k,{...common(l),alpha:num(l.alpha,'alpha',0,1),blend:pick(l.blend,['normal','add','screen','multiply'],'blend'),anchor:normalizeAnchor(l.anchor,true)}];}));
   return {id:e.id,name:e.name,...common(e),anchor:normalizeAnchor(e.anchor,false),layers};
  });return c;
 }
 function seedFor(c,e,k){return (c.seed^e.seed^hash(e.id)^hash(k)^(e.layers[k]?.seed??0))|0;}
 function scheduleFor(c,e){
  const period=c.durationFrames/60,seed=seedFor(c,e,'schedule'),gap=c.nearGapPx;
  const rateCurve=Curves.normalize({...c.emissionRateCurve,domain:'emitterTime'});
  const temporal=Spacing.createTemporalSchedule({mode:'custom',baseRate:c.particleRate*c.density/.75,duration:period,seed,maxEvents:MAX_EVENTS,rateCurve});
  if(temporal.capped)fail('event budget exceeded');
  const v=c.spacingCurve,physical=Curves.normalize({...v,parameterKey:'spacingPx',valueUnit:'px',defaultValue:v.defaultValue*gap,valueRange:v.valueRange.map(x=>x*gap),keys:v.keys.map(k=>({...k,y:k.y*gap,...(k.in?{in:[k.in[0],k.in[1]*gap]}:{}),...(k.out?{out:[k.out[0],k.out[1]*gap]}:{})}))});
  const path={schemaVersion:1,closed:false,segments:[{p0:[-HALF,0],p1:[-HALF/3,0],p2:[HALF/3,0],p3:[HALF,0]}]};
  const placement=Spacing.createSpatialPlacement({path,baseSpacingPx:gap,minSpacing:1,maxSpacing:75,spacingCurve:physical,mode:c.spatialMode,jitter:0,seed,maxPoints:4096});
  if(placement.capped)fail('spatial budget exceeded');
  const sites=placement.points.map(p=>p.distance);
  const distances=sites.map((x,i)=>{const cell=Math.min(x-(sites[i-1]??0),(sites[i+1]??SPAN)-x)/2;return x+(rand(seed,i,19)*2-1)*cell*c.spatialJitter;});
  if(!distances.length)distances.push(HALF);
  const events=temporal.events.filter(p=>c.mode==='loop'||p.time<period).map(({time,index:id})=>({id,time:c.mode==='loop'&&time>=period?0:time,cross:distances[id%distances.length]-HALF,distance:distances[id%distances.length],layer:id%5===0?'foreground':'streaks'})).sort((a,b)=>a.time-b.time||a.id-b.id);
  return {period,events,launchDistances:distances,arcErrorBound:placement.table.errorBound,effectiveRate:events.length/period};
 }
 function schedule(input,emitter){const c=normalize(input),e=c.emitters.find(e=>e.id===emitter);if(!e)fail('missing emitter');return scheduleFor(c,e);}
 function active(e,l){return e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;}
 function transform(e,l){const a=e.rotation*Math.PI/180;return {x:e.x+l.x*Math.cos(a)-l.y*Math.sin(a),y:e.y+l.x*Math.sin(a)+l.y*Math.cos(a),rotation:e.rotation+l.rotation};}
 function occupancy(events,period,life,one){
  if(one||!events.length)return events.length;
  const cycles=Math.floor(life/period),rest=Math.max(0,life-cycles*period),times=events.map(e=>e.time),doubled=times.concat(times.map(t=>t+period));
  let max=0,j=0;
  for(let i=0;i<times.length;i++){j=Math.max(j,i);while(j<i+times.length&&doubled[j]-doubled[i]<=rest+1e-10)j++;max=Math.max(max,j-i);}
  return cycles*times.length+max;
 }
 function live(events,t,period,life,one){
  const rows=[];
  for(const e of events){
   if(one){const age=t-e.time;if(age>=0&&age<life)rows.push({event:e,cycle:0,age});continue;}
   const latest=Math.floor((t-e.time)/period);
   for(let cycle=latest;cycle>=latest-Math.ceil(life/period);cycle--){const age=t-e.time-cycle*period;if(age>=0&&age<life)rows.push({event:e,cycle,age});}
  }
  return rows.sort((a,b)=>a.cycle-b.cycle||a.event.time-b.event.time||a.event.id-b.event.id);
 }
 function integral(curve){
  const boundaries=[...new Set([0,...curve.keys.map(k=>k.x),1])].sort((a,b)=>a-b),xs=[0],ys=[0],slopes=[];
  for(let i=1;i<boundaries.length;i++){const a=boundaries[i-1],b=boundaries[i],n=Math.max(1,Math.ceil((b-a)*256));for(let j=0;j<n;j++){const left=a+(b-a)*j/n,right=a+(b-a)*(j+1)/n,m=Curves.evaluate(curve,(left+right)/2);slopes.push(m);ys.push(ys.at(-1)+m*(right-left));xs.push(right);}}
  return u=>{const t=clamp(u,0,1);let lo=0,hi=xs.length-1;while(hi-lo>1){const m=(hi+lo)>>1;if(xs[m]<=t)lo=m;else hi=m;}return ys[lo]+slopes[lo]*(t-xs[lo]);};
 }
 function createPlan(input){
  const c=freeze(normalize(input)),period=c.durationFrames/60,one=c.mode==='oneShot',stop=(c.durationFrames-1)/60,limit=BUDGETS[c.quality],drift=integral(c.driftSpeedCurve),compiled=[];let peakUpperBound=0;
  for(const e of c.emitters){
   const s=scheduleFor(c,e),layers=LAYERS.map(k=>{const l=e.layers[k],events=s.events.filter(p=>p.layer===k),on=active(e,l),life=LIFE[k];if(on)peakUpperBound+=k==='whiteout'?1:occupancy(events,period,life,one);return {k,l,on,events,life,seed:seedFor(c,e,k),transform:transform(e,l)};});
   if(peakUpperBound>limit)fail('full-effect primitive budget exceeded');compiled.push({e,layers});
  }
  const a=c.angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  function sample(seconds){
   num(seconds,'seconds',0,1e8);const time=one?Math.min(seconds,stop):phase(seconds,period),fade=one?clamp((stop-time)/(9/60),0,1):1;let cost=0;
   const emitters=compiled.map(({e,layers})=>({id:e.id,anchor:e.anchor,layers:layers.map(({k,l,on,events,life,seed,transform})=>{
    const local=time-(e.timeOffset+l.timeOffset)/60,t=one?local:phase(local,period),progress=clamp(t/period,0,1),layerFade=one?Math.min(fade,clamp((stop-t)/(9/60),0,1)):1,particles=[];let whiteout=null;
    if(on&&layerFade>0&&(!one||t>=0&&t<stop)){
     if(k==='whiteout'){const rgba=Colors.sample(c.palette,progress);rgba[3]*=Curves.evaluate(c.whiteoutAlphaCurve,progress)*l.alpha*layerFade;if(rgba[3]>0){whiteout={x:0,y:0,width:512,height:512,rgba};cost++;}}
     else {
      const intensity=Curves.evaluate(c.stormIntensityCurve,progress),foreground=k==='foreground';
      for(const {event,cycle,age} of live(events,t,period,life,one)){
       const id=event.id,u=age/life,variation=1+(rand(seed,id,0)*2-1)*c.windVariance*.4,
        distance=c.windSpeed*life*drift(u)*variation*(foreground?1.25:1),
        wobble=c.windVariance*Math.min(1,c.windSpeed/200)*(foreground?18:6),frequency=foreground?5:2,
        wave=rand(seed,id,1)*Math.PI*2,
        along=mod(rand(seed,id,2)*SPAN+distance+HALF,SPAN)-HALF,
        cross=mod(event.cross+wobble*(Math.sin(wave+age*frequency)-Math.sin(wave))+HALF,SPAN)-HALF,
        x=along*co-cross*si,y=along*si+cross*co,
        length=foreground?4+8*rand(seed,id,3):c.streakLength*(.75+.25*rand(seed,id,3)),width=foreground?length:1+2*rand(seed,id,4),radius=Math.hypot(length,width)/2,
        edge=clamp((FIELD-radius-Math.max(Math.abs(x),Math.abs(y)))/16,0,1),rgba=Colors.sample(c.palette,u);
       rgba[3]*=Curves.evaluate(c.particleAlphaCurve,u)*intensity*l.alpha*layerFade*edge;
       particles.push({id,cycle,age,x,y,length,width,rotation:c.angle+(foreground?age*80*(rand(seed,id,5)*2-1):0),rgba,layer:k});
      }
      cost+=particles.length;
     }
    }
    return {id:k,enabled:on,anchor:l.anchor.type==='inherit'?e.anchor:l.anchor,transform:{...transform},blend:l.blend,particles,whiteout};
   })}));
   if(cost>limit||cost>peakUpperBound)fail('live primitive budget exceeded');return {schemaVersion:1,time,cost,emitters};
  }
  return Object.freeze({settings:c,period,peakUpperBound,sample});
 }
 function sample(input,seconds){return createPlan(input).sample(seconds);}
 function bounds(frame){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const e of frame.emitters)for(const l of e.layers){
   const a=l.transform.rotation*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
   function add(x,y,rx,ry){const px=l.transform.x+x*co-y*si,py=l.transform.y+x*si+y*co;left=Math.min(left,px-rx);right=Math.max(right,px+rx);top=Math.min(top,py-ry);bottom=Math.max(bottom,py+ry);}
   for(const p of l.particles)if(p.rgba[3]>0){const r=Math.hypot(p.length,p.width)/2;add(p.x,p.y,r,r);}
   if(l.whiteout){const r=FIELD*(Math.abs(co)+Math.abs(si));add(0,0,r,r);}
  }
  return Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:null;
 }
 return {LAYERS,BUDGETS,defaults,newEmitter,normalize,stylePalette,schedule,createPlan,sample,bounds};
});
