// GAME-11 D01: deterministic quantized dissolve field, alpha clipping and frontier spacing.
(function(root,factory){
 const load=(key,path)=>root[key]||(typeof require==='function'?require(path):null);
 const api=Object.freeze(factory(load('FxCurves','../../template/src/curve-core.js'),load('FxSpacing','../../template/src/spacing-core.js'),load('FxColors','../../template/src/color-core.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDissolve=api;
})(globalThis,function(C,S,COL){
 'use strict';
 if(!C||!S||!COL)throw Error('GAME-11 missing shared core');
 const FPS=60,TAU=2*Math.PI,DEG=Math.PI/180,LAYERS=['mask','edge','debris'],BUDGETS={low:256,balanced:1024,high:2048};
 const fail=m=>{throw RangeError('GAME-11 '+m);},mod=(x,n)=>{const v=x%n;return v<0?v+n:v||0;},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const num=(v,k,a,b,int=false)=>{if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail('invalid '+k);return v;};
 const one=(v,choices,k)=>{if(!choices.includes(v))fail('invalid '+k);return v;};
 const bool=v=>{if(typeof v!=='boolean')fail('invalid toggle');return v;};
 function shape(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid fields');}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function rand(seed,id,salt){let x=seed^hash(id+':'+salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function curve(key,domain,points,range=[0,1],unit='multiplier'){return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:domain==='particleAge'?'normalized-lifetime':domain==='pathPosition'?'normalized-path':'normalized-duration',valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function tx(seed,type){return {enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed,anchor:{type,name:''}};}


 const CAPS=Object.freeze({maxGridNodes:1050625,maxSegments:32768,maxEvents:4096,maxCandidates:8192,maxWorkCells:32000000,alphaThreshold:16});
 const rectKeys=['x','y','width','height'];
 function rect(v){shape(v,rectKeys);return {x:num(v.x,'rect x',-16384,16384,true),y:num(v.y,'rect y',-16384,16384,true),width:num(v.width,'rect width',1,1024,true),height:num(v.height,'rect height',1,1024,true)};}
 function newEmitter(i=0){
  num(i,'emitter index',0,100000,true);
  return {id:'dissolve'+(i+1),...tx(1034+i*137,'world'),x:256,y:256,layers:Object.fromEntries(LAYERS.map(k=>[k,{...tx(31,'inherit'),alpha:1,blend:'normal',placement:'front'}]))};
 }
 function defaults(){
  const progress=curve('transitionProgress','effectTime',[[0,0],[.25,.12],[.8,.9],[1,1]]);
  progress.monotonic=true;
  return {schemaVersion:1,mode:'oneShot',durationFrames:40,endpoint:'disappear',rect:{x:0,y:0,width:512,height:512},noiseScale:.035,edgeWidth:8,edgeGlow:.7,direction:0,particleRate:30,roughness:.5,lifetimeFrames:18,particleSize:3,driftSpeed:50,intervalFrames:2,minIntervalFrames:0,timeJitter:0,burstEnabled:false,burstCount:12,burstStartFrame:1,burstDelayFrames:0,spacingPx:8,minGapPx:2,maxGapPx:95,spatialJitter:0,distribution:'even',seed:4111,quality:'balanced',style:'natural',frequencySource:'rate',
   progressCurve:C.normalize(progress),edgeCurve:curve('edgeGlow','effectTime',[[0,.3],[.5,1],[1,0]]),sizeCurve:curve('particleSize','particleAge',[[0,1],[1,0]]),rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,0]],[0,4]),intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4]),spacingCurve:curve('spacingPx','pathPosition',[[0,8],[1,8]],[2,95],'px'),
   palette:COL.normalize({schemaVersion:1,parameterKey:'dissolveColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'white',position:0,rgba:[255,255,255,1]},{id:'gold',position:.5,rgba:[255,204,114,1]},{id:'orange',position:1,rgba:[255,99,45,1]}]}),emitters:[newEmitter()]};
 }
 function normalize(input){
  const base=defaults();shape(input,Object.keys(base));if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1,mode:one(input.mode,['oneShot'],'mode'),durationFrames:num(input.durationFrames,'durationFrames',2,3600,true),endpoint:one(input.endpoint,['disappear','grayscale'],'endpoint'),rect:rect(input.rect)};
  for(const [k,a,b,i] of [['noiseScale',.002,.25],['edgeWidth',0,65],['edgeGlow',0,2],['direction',-180,180],['particleRate',0,300],['roughness',0,1],['lifetimeFrames',1,3600,true],['particleSize',.5,20],['driftSpeed',0,250],['intervalFrames',.25,3600],['minIntervalFrames',0,3600],['timeJitter',0,.45],['burstCount',1,64,true],['burstStartFrame',.0001,3600],['burstDelayFrames',0,3600],['spacingPx',2,95],['minGapPx',2,95],['maxGapPx',2,95],['spatialJitter',0,.45],['seed',-2147483648,2147483647,true]])c[k]=num(input[k],k,a,b,i);
  c.burstEnabled=bool(input.burstEnabled);if(c.minGapPx>c.maxGapPx)fail('gap range');
  if(c.burstEnabled&&c.burstStartFrame+(c.burstCount-1)*c.burstDelayFrames>=c.durationFrames-1)fail('burst exceeds duration');
  for(const [k,v] of Object.entries({style:['natural','stylized','magical'],quality:Object.keys(BUDGETS),distribution:['even','random','stratified','clustered'],frequencySource:['rate','interval']}))c[k]=one(input[k],v,k);
  for(const k of ['progressCurve','edgeCurve','sizeCurve','rateCurve','intervalCurve','spacingCurve']){
   const v=C.normalize(input[k]),b=base[k];for(const key of ['parameterKey','domain','inputUnit','valueUnit'])if(v[key]!==b[key])fail('curve binding '+k);
   if(v.valueRange[0]<b.valueRange[0]||v.valueRange[1]>b.valueRange[1]||v.inputRange[0]!==0||v.inputRange[1]!==1)fail('curve range '+k);c[k]=v;
  }
  if(!c.progressCurve.monotonic||C.evaluate(c.progressCurve,0)!==0||C.evaluate(c.progressCurve,1)!==1)fail('progress endpoints/monotonic');
  c.palette=COL.normalize(input.palette);if(c.palette.parameterKey!=='dissolveColor'||c.palette.domain!=='particleAge')fail('palette binding');
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');const ids=new Set(),example=newEmitter();
  function transform(v,layer){const a=v.anchor;shape(a,['type','name']);const type=one(a.type,layer?['inherit','world','local','bone']:['world','local','bone'],'anchor');if(typeof a.name!=='string'||a.name.length>128||(type==='bone'?!a.name.trim():a.name!==''))fail('anchor name');return {enabled:bool(v.enabled),visible:bool(v.visible),x:num(v.x,'x',-16384,16384),y:num(v.y,'y',-16384,16384),rotation:num(v.rotation,'rotation',-3600,3600),scale:num(v.scale,'scale',.01,20),timeOffset:num(v.timeOffset,'timeOffset',-3600,3600),seed:num(v.seed,'seed',-2147483648,2147483647,true),anchor:{type,name:a.name}};}
  c.emitters=input.emitters.map(e=>{shape(e,Object.keys(example));if(typeof e.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);shape(e.layers,LAYERS);return {id:e.id,...transform(e,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];shape(l,Object.keys(example.layers[k]));return [k,{...transform(l,true),alpha:num(l.alpha,'alpha',0,1),blend:one(l.blend,['normal','add','screen','multiply'],'blend'),placement:one(l.placement,['front','behind'],'placement')}];}))};});if(c.emitters.some(e=>e.layers.mask.blend!=='normal'))fail('mask blend must be normal');return c;
 } const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 const identity={x:0,y:0,rotation:0,scale:1};
 function compose(a,b){if(!a||![a.x,a.y,a.rotation,a.scale].every(Number.isFinite)||a.scale<=0)return null;const t=a.rotation*DEG,p={x:a.x+a.scale*(b.x*Math.cos(t)-b.y*Math.sin(t)),y:a.y+a.scale*(b.x*Math.sin(t)+b.y*Math.cos(t)),rotation:a.rotation+b.rotation,scale:a.scale*b.scale};return Object.values(p).every(Number.isFinite)&&p.scale>0&&Math.max(Math.abs(p.x),Math.abs(p.y))+2048*p.scale<=1e6? p:null;}
 function resolve(t,parent,poses){const a=t.anchor;return compose(a.type==='inherit'?parent:a.type==='world'?identity:a.type==='local'?poses.local:poses.bones&&Object.hasOwn(poses.bones,a.name)?poses.bones[a.name]:null,t);}


 const mix=(a,b,t)=>a+(b-a)*t,eps=1e-8,snap=v=>Math.round(v*1e8)/1e8;
 function noise(seed,x,y){
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,s=u*u*(3-2*u),t=v*v*(3-2*v),h=(a,b)=>rand(seed,a+':'+b,'field');
  return mix(mix(h(i,j),h(i+1,j),s),mix(h(i,j+1),h(i+1,j+1),s),t);
 }
 function grid(c,pose,seed){
  if(!pose||![pose.x,pose.y,pose.rotation,pose.scale].every(Number.isFinite)||pose.scale<=0)fail('grid pose');
  const r=c.rect,step=Math.min(4,pose.scale/(4*c.noiseScale)),nx=Math.ceil(r.width/step),ny=Math.ceil(r.height/step);
  if((nx+1)*(ny+1)>CAPS.maxGridNodes)fail('grid budget');
  const dx=r.width/nx,dy=r.height/ny,values=new Uint16Array((nx+1)*(ny+1)),a=(c.direction+pose.rotation)*DEG,cs=Math.cos(a),sn=Math.sin(a),b=pose.rotation*DEG,bc=Math.cos(b),bs=Math.sin(b),span=Math.abs(cs)*r.width+Math.abs(sn)*r.height;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   const x=r.x+i*dx-pose.x,y=r.y+j*dy-pose.y,u=(x*bc+y*bs)/pose.scale*c.noiseScale,v=(-x*bs+y*bc)/pose.scale*c.noiseScale;
   const n=noise(seed,u,v)*.7+noise(seed^0x2f35421,u*2.03,v*2.03)*.3;
   const raw=.5+(x*cs+y*sn)/span/pose.scale+c.roughness*.25*(2*n-1);
   values[j*(nx+1)+i]=Math.round(clamp(raw,0,1)*65535);
  }
  return {rect:{...r},nx,ny,dx,dy,values};
 }
 // One fixed diagonal (top-left to bottom-right) for both contour and shader.
 // Integer texels are decoded as node/65535; no bilinear sampler interpolation.
 function fieldAt(g,x,y){
  const u=clamp((x-g.rect.x)/g.dx,0,g.nx),v=clamp((y-g.rect.y)/g.dy,0,g.ny),i=Math.min(g.nx-1,Math.floor(u)),j=Math.min(g.ny-1,Math.floor(v)),s=u-i,t=v-j,n=g.nx+1,p=j*n+i;
  const a=g.values[p]/65535,b=g.values[p+1]/65535,c=g.values[p+n]/65535,d=g.values[p+n+1]/65535;
  if(t<=s)return {value:a+(b-a)*s+(d-b)*t,gx:(b-a)/g.dx,gy:(d-b)/g.dy};
  return {value:a+(d-c)*s+(c-a)*t,gx:(d-c)/g.dx,gy:(c-a)/g.dy};
 }
 function validateRaster(r,alpha){
  if(!(alpha instanceof Uint8Array)||alpha.length!==r.width*r.height)fail('alpha raster size');
 }
 // Conservative boundary rule: if on a pixel edge, both touching cells must
 // be opaque enough. No bilinear borrowing from a neighboring opaque pixel.
 function covered(r,alpha,x,y){
  const u=x-r.x,v=y-r.y;for(const a of [Math.floor(u-eps),Math.floor(u+eps)])for(const b of [Math.floor(v-eps),Math.floor(v+eps)])if(a<0||b<0||a>=r.width||b>=r.height||alpha[b*r.width+a]<CAPS.alphaThreshold)return false;return true;
 }
 function clipSegment(r,alpha,a,b){
  const ts=[0,1],vx=b[0]-a[0],vy=b[1]-a[1];
  for(const [p,d,o] of [[a[0],vx,r.x],[a[1],vy,r.y]])if(Math.abs(d)>eps){const z=p+d;for(let k=Math.floor(Math.min(p,z)-o)+1;k<Math.max(p,z)-o;k++){const t=(o+k-p)/d;if(t>eps&&t<1-eps)ts.push(t);}}
  ts.sort((a,b)=>a-b);const out=[];
  for(let i=1;i<ts.length;i++){const l=ts[i-1],h=ts[i];if(h-l<=eps)continue;const m=(l+h)/2;if(!covered(r,alpha,a[0]+vx*m,a[1]+vy*m))continue;
   const point=t=>[snap(a[0]+vx*t),snap(a[1]+vy*t)];out.push([point(l),point(h)]);
  }return out;
 }
 function frontier(g,progress,alpha){
  num(progress,'progress',0,1);validateRaster(g.rect,alpha);if(progress===0||progress===1)return [];
  const edges=new Map(),nodes=new Map(),n=g.nx+1,threshold=progress*65535;
  function add(a,b){const ka=a.join(','),kb=b.join(',');if(ka===kb)return;const id=ka<kb?ka+'|'+kb:kb+'|'+ka;if(edges.has(id))return;if(edges.size>=CAPS.maxSegments)fail('contour segment budget');edges.set(id,{id,ka,kb});for(const [k,p] of [[ka,a],[kb,b]]){if(!nodes.has(k))nodes.set(k,{p,edges:[]});nodes.get(k).edges.push(id);}}
  function triangle(a,b,c){const pts=[a,b,c],hits=[];for(let i=0;i<3;i++){const p=pts[i],q=pts[(i+1)%3];if((p[2]>=threshold)===(q[2]>=threshold))continue;const t=(threshold-p[2])/(q[2]-p[2]);hits.push([mix(p[0],q[0],t),mix(p[1],q[1],t)]);}if(hits.length===2)for(const [p,q] of clipSegment(g.rect,alpha,hits[0],hits[1]))add(p,q);}
  for(let j=0;j<g.ny;j++)for(let i=0;i<g.nx;i++){const p=j*n+i,x=g.rect.x+i*g.dx,y=g.rect.y+j*g.dy,a=[x,y,g.values[p]],b=[x+g.dx,y,g.values[p+1]],c=[x,y+g.dy,g.values[p+n]],d=[x+g.dx,y+g.dy,g.values[p+n+1]];triangle(a,b,d);triangle(a,d,c);}
  const seen=new Set(),runs=[];
  function walk(start,id){const path=[nodes.get(start).p];let at=start,next=id;while(next&&!seen.has(next)){seen.add(next);const e=edges.get(next);at=e.ka===at?e.kb:e.ka;const node=nodes.get(at);path.push(node.p);if(node.edges.length!==2||!covered(g.rect,alpha,...node.p)||at===start)break;next=node.edges.find(x=>!seen.has(x));}return path;}
  // Branches split into distinct runs; canonical traversal makes saddle ties stable.
  for(const k of [...nodes.keys()].sort()){const v=nodes.get(k);if(v.edges.length!==2||!covered(g.rect,alpha,...v.p))for(const id of v.edges.sort())if(!seen.has(id))runs.push(walk(k,id));}
  for(const id of [...edges.keys()].sort())if(!seen.has(id))runs.push(walk(edges.get(id).ka,id));
  return runs;
 }
 function line(a,b){return {p0:a,p1:a.map((v,i)=>mix(v,b[i],1/3)),p2:a.map((v,i)=>mix(v,b[i],2/3)),p3:b};}
 // Use shared arc tables in 256-segment chunks, carrying global distance.
 function runTable(run){
  const chunks=[];let length=0;for(let i=0;i<run.length-1;i+=256){const segments=run.slice(i,i+257).slice(1).map((p,j)=>line(run[i+j],p));const table=S.buildArcTable({schemaVersion:1,closed:false,segments});chunks.push({start:length,end:length+table.length,table});length+=table.length;}
  return {length,chunks,closed:run[0].join(',')===run.at(-1).join(',')};
 }
 function placements(runs,c,seed,alpha){
  validateRaster(c.rect,alpha);const out=[];let total=0,segmentCount=0;
  for(let k=0;k<runs.length;k++){
   const run=runs[k];if(!Array.isArray(run)||run.length<2||run.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))fail('invalid run');
   segmentCount+=run.length-1;if(segmentCount>CAPS.maxSegments)fail('contour segment budget');
   const t=runTable(run);total+=t.length;if(t.length<=eps)continue;
   function point(d){const chunk=t.chunks.find(x=>d<=x.end+eps)||t.chunks.at(-1),p=S.pointAtDistance(chunk.table,clamp(d-chunk.start,0,chunk.table.length));return {x:p.x,y:p.y,distance:d,run:k};}
   const append=d=>{const p=point(d);if(covered(c.rect,alpha,p.x,p.y)){if(out.length>=CAPS.maxCandidates)fail('candidate budget');out.push(p);return true;}return false;};
   const gapAt=(d,i)=>{let s=C.evaluate(c.spacingCurve,d/t.length)*c.spacingPx/8;if(c.distribution==='random')s*=.5+rand(seed,k+':'+i,'space');if(c.distribution==='stratified')s*=.8+.4*rand(seed,k+':'+i,'space');if(c.distribution==='clustered')s*=i%5<3?.55:1.675;s*=1+(2*rand(seed,k+':'+i,'jitter')-1)*c.spatialJitter;return clamp(s,c.minGapPx,c.maxGapPx);};
   // Start half a minimum gap from a boundary; short runs get at most one interior anchor.
   let d=Math.min(c.minGapPx/2,t.length/2),i=0,first=d,count=0;
   while(d<t.length-eps){if(t.closed&&count&&t.length-d+first<c.minGapPx-eps)break;if(append(d))count++;d+=gapAt(d,i++);if(i>CAPS.maxCandidates)fail('candidate budget');}
   if(!count)append(t.length/2);
  }return {points:out,length:total};
 }
 function timeState(c,e,k,t,poses={}){
  const l=e.layers[k];if(!active(e,l))return null;const pose=resolve(l,resolve(e,null,poses),poses);if(!pose)return null;
  const end=(c.durationFrames-1)/FPS,u=t<=0?0:t>=end?1:clamp((t-e.timeOffset-l.timeOffset)/end,0,1),progress=C.evaluate(c.progressCurve,u);
  return {id:e.id,layer:k,pose,seed:c.seed^e.seed^l.seed^hash(e.id),u,progress,alpha:l.alpha,blend:l.blend,placement:l.placement,glow:c.edgeGlow*C.evaluate(c.edgeCurve,u)};
 }
 // RGBA8 premultiplied input and output. No change to caller bytes.
 function compositePixel(c,src,x,y,t,states){
  if(!Array.isArray(src)||src.length!==4||src.some((v,i)=>!Number.isInteger(v)||v<0||v>(i===3?255:src[3])))fail('PMA pixel');
  if(src[3]===0||t<=0)return src.slice();
  const end=(c.durationFrames-1)/FPS,a=src[3]/255,base=src.slice(0,3).map(v=>v/src[3]);let rgb=base.slice(),coverage=a;
  for(const s of states.filter(s=>s.layer==='mask')){
   let removed=s.progress>=1?1:s.progress<=0?0:Number(fieldAt(s.grid,x,y).value<s.progress);removed*=s.alpha;
   if(c.endpoint==='disappear')coverage*=1-removed;else{const gray=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];rgb=rgb.map(v=>mix(v,gray,removed));}
  }
  if(t<end)for(const s of states.filter(s=>s.layer==='edge'&&s.progress>0&&s.progress<1&&s.glow>0&&c.edgeWidth>0)){
   const v=fieldAt(s.grid,x,y),gradient=Math.hypot(v.gx,v.gy);if(gradient<1e-9)continue;const distance=Math.abs(v.value-s.progress)/gradient,band=clamp(1-distance/c.edgeWidth,0,1);
   const color=COL.sample(c.palette,1-band),strength=clamp(band*s.glow*s.alpha*color[3],0,1),edgeCoverage=a*strength;
   if(strength===0)continue;const tint=color.slice(0,3).map(v=>v/255),blend=rgb.map((v,i)=>s.blend==='add'?Math.min(1,v+tint[i]):s.blend==='multiply'?v*tint[i]:s.blend==='screen'?1-(1-v)*(1-tint[i]):tint[i]);
   // Edge may restore only source-covered alpha; never paint transparent holes.
   const next=Math.max(coverage,edgeCoverage);rgb=rgb.map((v,i)=>mix(v,blend[i],strength));coverage=next;
  }
  const alpha=Math.round(coverage*255);return [...rgb.map(v=>Math.min(alpha,Math.round(clamp(v,0,1)*coverage*255))),alpha];
 }
 function compile(input){
  const c=freeze(normalize(input)),end=(c.durationFrames-1)/FPS;let events=0,reserved=0;
  const schedules=c.emitters.map(e=>{
   const l=e.layers.debris,seed=c.seed^e.seed^l.seed^hash(e.id),births=[];
   if(active(e,l)){
    const raw=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.particleRate,interval:c.intervalFrames/FPS,duration:end,minInterval:c.minIntervalFrames/FPS,jitter:c.timeJitter,seed:seed^hash('base'),rateCurve:c.rateCurve,intervalCurve:c.intervalCurve,maxEvents:CAPS.maxEvents});
    if(raw.capped)fail('event budget');const add=(id,stream,t)=>{const time=snap((t+e.timeOffset+l.timeOffset)*FPS)/FPS;if(time>0&&time<end-eps){births.push({id,stream,time,frame:Math.floor(time*FPS+eps)});if(++events>CAPS.maxEvents)fail('event budget');}};
    raw.events.forEach((v,i)=>{if(v.time>eps&&v.time<end-eps)add('base'+i,'base',v.time);});
    if(c.burstEnabled)for(let i=0;i<c.burstCount;i++)add('burst'+i,'burst',(c.burstStartFrame+i*c.burstDelayFrames)/FPS);
    births.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));const edges=[];for(const b of births)edges.push([b.time,1],[Math.min(end,snap(b.time*FPS+c.lifetimeFrames)/FPS),-1]);edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let n=0,peak=0;for(const [,delta] of edges){n+=delta;peak=Math.max(peak,n);}reserved+=peak;
   }
   reserved+=Number(active(e,e.layers.mask))+Number(active(e,e.layers.edge));return {id:e.id,seed,births};
  });
  if(reserved>BUDGETS[c.quality])fail('quality budget');freeze(schedules);
  function states(t,poses={},withGrid=false){
   num(t,'seconds',0,1e6);const result=[],diagnostics=[];
   for(const e of c.emitters)for(const k of LAYERS){if(!active(e,e.layers[k]))continue;const s=timeState(c,e,k,t,poses);if(!s){diagnostics.push({emitterId:e.id,layer:k,reason:'missing-or-invalid-anchor'});continue;}if(withGrid&&s.progress>0&&s.progress<1&&k!=='debris')s.grid=grid(c,s.pose,s.seed);result.push(s);}
   return {states:result,diagnostics};
  }
  // Provider is an injected canonical frame snapshot, not a live renderer.
  // It returns {alpha:Uint8Array, poses:{local?,bones?}} for the requested frame.
  function prepare(provider){
   if(typeof provider!=='function')fail('surface provider');let work=0,requested=0,dropped=0;const particles=[],diagnostics=[];
   const jobs=schedules.flatMap((s,i)=>s.births.map(b=>({s,i,b}))).sort((a,b)=>a.b.frame-b.b.frame||a.b.time-b.b.time||a.i-b.i||a.b.id.localeCompare(b.b.id));
   let current=-1,source=null,byTime=new Map();
   for(const {s,i,b} of jobs){
    requested++;if(b.frame!==current){current=b.frame;source=provider(current);byTime=new Map();if(source!==null){if(!source||typeof source!=='object')fail('surface snapshot');validateRaster(c.rect,source.alpha);}}
    const e=c.emitters[i],k=e.id+':'+b.time;let cached=byTime.get(k);
    if(!cached){const state=source&&timeState(c,e,'debris',b.time,source.poses||{});let points=[];
     if(state&&state.progress>0&&state.progress<1){const g=grid(c,state.pose,state.seed);work+=g.nx*g.ny;if(work>CAPS.maxWorkCells)fail('frontier work budget');points=placements(frontier(g,state.progress,source.alpha),c,s.seed,source.alpha).points;}
     cached={state,points,used:new Set()};byTime.set(k,cached);
    }
    const order=cached.points.map((p,index)=>({p,index,r:rand(s.seed,b.id+':'+index,'pick')})).sort((a,b)=>a.r-b.r||a.index-b.index),picked=order.find(v=>!cached.used.has(v.index));
    if(!picked){dropped++;diagnostics.push({emitterId:e.id,eventId:b.id,reason:'no-frontier'});continue;}
    cached.used.add(picked.index);particles.push({...b,...picked.p,id:e.id+'-'+b.id,emitterId:e.id,seed:s.seed,alpha:cached.state.alpha,blend:cached.state.blend,placement:cached.state.placement});
   }
   freeze(particles);freeze(diagnostics);
   function sample(t,poses={}){
    const f=states(t,poses,true),visible=[];if(t>0&&t<end)for(const p of particles){const age=(t-p.time)*FPS/c.lifetimeFrames;if(age<0||age>=1)continue;const e=c.emitters.find(v=>v.id===p.emitterId),l=e.layers.debris;if(!active(e,l)||!f.states.some(s=>s.id===e.id&&s.layer==='debris'))continue;const angle=TAU*rand(p.seed,p.id,'drift'),travel=c.driftSpeed*(t-p.time),radius=c.particleSize*C.evaluate(c.sizeCurve,age)*(c.style==='magical'?1.2:1);const rgba=COL.sample(c.palette,age);rgba[3]*=p.alpha*(1-age);if(radius>0&&rgba[3]>0)visible.push({id:p.id,x:p.x+Math.cos(angle)*travel,y:p.y+Math.sin(angle)*travel,radius,rgba,age,bornTime:p.time,origin:[p.x,p.y],blend:p.blend,placement:p.placement});}
    return {...f,particles:visible};
   }
   return Object.freeze({births:particles,diagnostics,requested,emitted:particles.length,dropped,work,sample});
  }
  return Object.freeze({settings:c,schedules,reserved,states,prepare});
 }
 return {CAPS,defaults,newEmitter,normalize,compile,grid,fieldAt,frontier,placements,covered,compositePixel};
});
