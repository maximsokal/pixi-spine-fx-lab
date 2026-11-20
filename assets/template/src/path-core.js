// FX-CORE-08: deterministic renderer-independent ribbon and branch geometry.
// Uses existing FxSpacing arc-length oracle; no Pixi, DOM or application state.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(
   root.FxSpacing||(typeof require==='function'?require('./spacing-core.js'):null),
   root.FxCurves||(typeof require==='function'?require('./curve-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxPath=api;
})(globalThis,function(Spacing,Curves){
 'use strict';
 if(!Spacing||!Curves)throw new Error('FxPath requires FxSpacing and FxCurves v1');
 const BUDGETS=Object.freeze({
  low:Object.freeze({maxSegments:64,maxBranches:8,maxVertices:2048,maxTriangles:2048}),
  balanced:Object.freeze({maxSegments:128,maxBranches:32,maxVertices:8192,maxTriangles:8192}),
  high:Object.freeze({maxSegments:256,maxBranches:64,maxVertices:16384,maxTriangles:16384})
 });
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),smooth=x=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function fail(message){throw new TypeError('Invalid FX path: '+message);}
 function num(v,name,min,max){if(!finite(v)||v<min||v>max)fail(name+' must be finite in ['+min+','+max+']');return v;}
 function integer(v,name,min,max){num(v,name,min,max);if(!Number.isInteger(v))fail(name+' must be integer');return v;}
 const vec=(x,y)=>({x,y});
 const length=v=>Math.hypot(v.x,v.y);
 function unit(x,y,fallback={x:1,y:0}){const d=Math.hypot(x,y);return d>1e-9?vec(x/d,y/d):{...fallback};}
 const normal=t=>({x:-t.y,y:t.x});
 function object(o,name){if(!o||typeof o!=='object'||Array.isArray(o))fail(name+' must be object');return o;}
 function known(o,keys,name){for(const k of Object.keys(o))if(!keys.includes(k))fail(name+' unknown field '+k);}
 function seed32(v,name='seed'){return integer(v,name,-2147483648,2147483647);}
 function hash(seed,stream){
   let v=(seed|0)^(stream|0);
   v=Math.imul(v^(v>>>16),0x7feb352d);
   v=Math.imul(v^(v>>>15),0x846ca68b);
   return (v^(v>>>16))>>>0;
 }
 function random(seed,salt){
   let state=hash(seed,salt);
   return ()=>{state=(state+0x6d2b79f5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
   };
 }
 function normalizeWidth(input){
   const w=object(input,'width');
   known(w,['start','middle','end','curve','startTaper','endTaper','minVisiblePx'],'width');
   const curve=w.curve==null?null:Curves.normalize(w.curve);
   if(curve&&(curve.parameterKey!=='widthMultiplier'||curve.domain!=='pathPosition'||
      curve.inputUnit!=='normalized-path'||curve.valueUnit!=='normalized'||
      curve.inputRange[0]!==0||curve.inputRange[1]!==1))
     fail('width curve must bind widthMultiplier to normalized pathPosition');
   return {
    start:num(w.start,'start width',0,10000),
    middle:num(w.middle,'middle width',0,10000),
    end:num(w.end,'end width',0,10000),
    startTaper:num(w.startTaper??0,'start taper',0,1),
    endTaper:num(w.endTaper??0,'end taper',0,1),
    minVisiblePx:num(w.minVisiblePx??.25,'minimum visible width',0,100),
    curve
   };
 }
 function widthAt(input,u){
   const w=normalizeWidth(input);
   return evaluateWidth(w,u);
 }
 function evaluateWidth(w,u){
   num(u,'normalized distance',0,1);
   const mid=u<=.5?smooth(u*2):smooth((u-.5)*2);
   const base=u<=.5?w.start+(w.middle-w.start)*mid:w.middle+(w.end-w.middle)*mid;
   const taper=u<=.5?1-w.startTaper*(1-smooth(u*2)):1-w.endTaper*smooth((u-.5)*2);
   const multiplier=w.curve?Curves.evaluate(w.curve,u):1;
   const result=Math.max(0,base*taper*multiplier);
   // Allow artist-authored fully pointed tips, but avoid disappearing interior stripes.
   return u>0&&u<1&&base*taper>0?Math.max(w.minVisiblePx,result):result;
 }
 function emptyResult(table,quality,usedWidth){
   return {schemaVersion:1,quality,table,errorBound:table.errorBound,
    width:usedWidth,samples:[],positions:new Float32Array(0),
    uvs:new Float32Array(0),indices:new Uint16Array(0)};
 }
 function smoothPath(input,strength){
   const amount=num(strength,'curvature smoothing',0,1);
   const path=Spacing.normalizePath(input);
   if(amount===0||path.segments.length===1)return path;
   const segments=path.segments;
   const joints=[];
   for(let i=1;i<segments.length;i++)joints.push([i-1,i]);
   if(path.closed){
     const last=segments.at(-1).p3,first=segments[0].p0;
     if(Math.hypot(last[0]-first[0],last[1]-first[1])<=1e-6)
       joints.push([segments.length-1,0]);
   }
   for(const [a,b] of joints){
     const before=segments[a],after=segments[b],join=before.p3;
     const inX=join[0]-before.p2[0],inY=join[1]-before.p2[1];
     const outX=after.p1[0]-join[0],outY=after.p1[1]-join[1];
     const inLen=Math.hypot(inX,inY),outLen=Math.hypot(outX,outY);
     if(inLen<1e-8||outLen<1e-8)continue;
     const inDir=unit(inX,inY),outDir=unit(outX,outY);
     const sum=unit(inDir.x+outDir.x,inDir.y+outDir.y,inDir);
     const inBlend=unit((1-amount)*inDir.x+amount*sum.x,
                        (1-amount)*inDir.y+amount*sum.y,inDir);
     const outBlend=unit((1-amount)*outDir.x+amount*sum.x,
                         (1-amount)*outDir.y+amount*sum.y,outDir);
     before.p2=[join[0]-inBlend.x*inLen,join[1]-inBlend.y*inLen];
     after.p1=[join[0]+outBlend.x*outLen,join[1]+outBlend.y*outLen];
   }
   return {...path,segments};
 }
 function buildRibbon(input){
   const cfg=object(input,'ribbon');
   known(cfg,['path','width','quality','sampleSpacingPx','edgeIrregularity','seed',
              'miterLimit','tolerancePx','curvatureSmoothing'],'ribbon');
   const quality=cfg.quality??'balanced',budget=BUDGETS[quality];
   if(!budget)fail('unsupported quality budget');
   const spacing=num(cfg.sampleSpacingPx??6,'sample spacing',.25,512);
   const edge=num(cfg.edgeIrregularity??0,'edge irregularity',0,1);
   const seed=seed32(cfg.seed??0);
   const miterLimit=num(cfg.miterLimit??2,'miter limit',1,4);
   const width=normalizeWidth(cfg.width);
   const smoothing=num(cfg.curvatureSmoothing??0,'curvature smoothing',0,1);
   const path=smoothPath(cfg.path,smoothing);
   if(path.segments.length>budget.maxSegments)fail('segment budget exceeded');
   if(path.closed){
     if(Math.abs(evaluateWidth(width,0)-evaluateWidth(width,1))>1e-6 ||
        width.startTaper!==0||width.endTaper!==0)
       fail('closed path must have matching seam widths and no end taper');
   }
   const table=Spacing.buildArcTable(path,{tolerancePx:cfg.tolerancePx??.25,
        maxPoints:Math.min(8192,budget.maxVertices)});
   if(table.length===0||(width.start===0&&width.middle===0&&width.end===0))
     return emptyResult(table,quality,width);
   // Include exact ends, midpoint, and every control-segment boundary.
   const samplesNeeded=Math.ceil(table.length/spacing)+1;
   if((samplesNeeded+path.segments.length+2)*2>budget.maxVertices)
     fail('ribbon vertex budget exceeded');
   const distances=[0,table.length/2,table.length];
   for(let d=spacing;d<table.length;d+=spacing)distances.push(d);
   for(const node of table.nodes)if(node.t===1)distances.push(node.s);
   distances.sort((a,b)=>a-b);
   const dist=[];
   for(const d of distances)if(!dist.length||d-dist.at(-1)>1e-7)dist.push(d);
   if(dist.length*2>budget.maxVertices||(dist.length-1)*2>budget.maxTriangles)
     fail('ribbon tessellation/triangle budget exceeded');
   const points=dist.map(d=>Spacing.pointAtDistance(table,d));
   const sampleNodes=[];
   for(let i=0;i<points.length;i++){
     const current=points[i],prev=points[Math.max(0,i-1)],
       next=points[Math.min(points.length-1,i+1)];
     let incoming,outgoing;
     if(i===0){
       incoming=unit(current.tangent.x,current.tangent.y);
     }else incoming=unit(current.x-prev.x,current.y-prev.y,current.tangent);
     if(i===points.length-1){
       outgoing=unit(current.tangent.x,current.tangent.y);
     }else outgoing=unit(next.x-current.x,next.y-current.y,current.tangent);
     const sideIn=normal(incoming),sideOut=normal(outgoing);
     const bisector=unit(sideIn.x+sideOut.x,sideIn.y+sideOut.y,sideOut);
     let denom=bisector.x*sideOut.x+bisector.y*sideOut.y;
     if(denom<1e-5)denom=1;
     const miter=clamp(1/denom,1,miterLimit);
     const normalVector=vec(bisector.x*miter,bisector.y*miter);
     const u=dist[i]/table.length;
     sampleNodes.push({x:current.x,y:current.y,distance:dist[i],u,
      tangent:current.tangent,normal:normalVector,width:evaluateWidth(width,u)});
   }
   if(path.closed){
     // A single ring-normal at the two UV seam vertices; never duplicate divergent caps.
     const first=sampleNodes[0],last=sampleNodes.at(-1);
     const prev=sampleNodes.at(-2),next=sampleNodes[1];
     const tIn=unit(first.x-prev.x,first.y-prev.y,last.tangent);
     const tOut=unit(next.x-first.x,next.y-first.y,first.tangent);
     const nIn=normal(tIn),nOut=normal(tOut);
     const b=unit(nIn.x+nOut.x,nIn.y+nOut.y,nOut);
     const inv=clamp(1/Math.max(1e-5,b.x*nOut.x+b.y*nOut.y),1,miterLimit);
     first.normal={x:b.x*inv,y:b.y*inv};
     last.normal={...first.normal};
     last.x=first.x;last.y=first.y;
   }
   const positions=new Float32Array(sampleNodes.length*4);
   const uvs=new Float32Array(sampleNodes.length*4);
   const indices=new Uint16Array((sampleNodes.length-1)*6);
   for(let i=0;i<sampleNodes.length;i++){
     const s=sampleNodes[i],wave=Math.sin(Math.PI*s.u);
     const left=edge?((random(seed,hash(i,0x1221))()*2-1)*edge*s.width/2*wave):0;
     const right=edge?((random(seed,hash(i,0x2411))()*2-1)*edge*s.width/2*wave):0;
     const halfL=Math.max(0,s.width/2+left);
     const halfR=Math.max(0,s.width/2+right);
     positions.set([s.x+s.normal.x*halfL,s.y+s.normal.y*halfL,
                    s.x-s.normal.x*halfR,s.y-s.normal.y*halfR],i*4);
     uvs.set([s.u,0,s.u,1],i*4);
     if(i<sampleNodes.length-1)indices.set([i*2,i*2+1,i*2+2,
                                             i*2+1,i*2+3,i*2+2],i*6);
   }
   if(!positions.every(Number.isFinite))fail('nonfinite ribbon vertices');
   return {schemaVersion:1,quality,table,errorBound:table.errorBound,width,
    samples:sampleNodes,positions,uvs,indices};
 }
 function placeElements({path,spacingPx,seed=0,mode='even',jitter=0,
                         minSpacing=.25,maxSpacing=100000,maxPoints=1024,
                         spacingCurve=null}){
   return Spacing.createSpatialPlacement({path,baseSpacingPx:spacingPx,minSpacing,
    maxSpacing,seed,mode,jitter,maxPoints,spacingCurve,alignToTangent:true,pathFollow:'clamp'});
 }
 function transformPath(local,anchor){
   const path=Spacing.normalizePath(local);
   const t=anchor.tangent,n=normal(t);
   function xf(q){return [anchor.x+q[0]*t.x+q[1]*n.x,
                          anchor.y+q[0]*t.y+q[1]*n.y];}
   return {...path,segments:path.segments.map(s=>({
      p0:xf(s.p0),p1:xf(s.p1),p2:xf(s.p2),p3:xf(s.p3)}))};
 }
 function buildGraph(input){
   const cfg=object(input,'branch graph');
   known(cfg,['schemaVersion','seed','quality','sampleSpacingPx','root','branches',
              'edgeIrregularity','miterLimit','curvatureSmoothing'],'graph');
   if(cfg.schemaVersion!==1)fail('graph schemaVersion must be 1');
   const quality=cfg.quality??'balanced',budget=BUDGETS[quality];
   if(!budget)fail('unknown graph quality budget');
   const seed=seed32(cfg.seed??0);
   const root=object(cfg.root,'root');
   known(root,['id','path','width'],'root');
   if(typeof root.id!=='string'||!/^[a-z][a-z0-9._-]*$/.test(root.id))fail('root ID required');
   const defs=cfg.branches??[];
   if(!Array.isArray(defs)||defs.length>budget.maxBranches)fail('branch count budget exceeded');
   const byId=new Map([[root.id,root]]);
   for(const row of defs){
     object(row,'branch');
     known(row,['id','parentId','attachDistancePx','path','widthRatio','width'],'branch');
     if(typeof row.id!=='string'||!/^[a-z][a-z0-9._-]*$/.test(row.id)||byId.has(row.id))
       fail('duplicate or invalid branch ID');
     byId.set(row.id,row);
   }
   const inProgress=new Set(),cache=new Map();
   let totalTriangles=0,totalVertices=0,totalSegments=0;
   function resolve(id){
     if(cache.has(id))return cache.get(id);
     if(inProgress.has(id))fail('branch cycle detected');
     const row=byId.get(id);
     if(!row)fail('branch parent missing: '+id);
     inProgress.add(id);
     let path,width;
     if(id===root.id){path=root.path;width=root.width;}
     else {
       if(typeof row.parentId!=='string')fail('branch parent ID required');
       const parent=resolve(row.parentId);
       if(parent.table.length===0)fail('cannot attach to zero-length parent');
       const d=num(row.attachDistancePx,'branch attach distance',0,parent.table.length);
       const anchor=Spacing.pointAtDistance(parent.table,d);
       const ratio=num(row.widthRatio??.6,'branch width ratio',.01,4);
       const start=widthAt(parent.width,d/parent.table.length)*ratio;
       width=row.width??{start,middle:start*.8,end:start*.2,startTaper:0,endTaper:.6};
       if(row.width)width={
         ...row.width,start:row.width.start*ratio,middle:row.width.middle*ratio,
         end:row.width.end*ratio};
       const local=Spacing.normalizePath(row.path);
       if(Math.hypot(...local.segments[0].p0)>1e-7)
         fail('branch local path must begin at [0,0]');
       path=transformPath(local,anchor);
     }
     const idSalt=[...id].reduce((h,c)=>Math.imul(h,31)+c.charCodeAt(0)|0,0);
    const mesh=buildRibbon({path,width,seed:hash(seed,idSalt)|0,
       quality,sampleSpacingPx:cfg.sampleSpacingPx??6,
       edgeIrregularity:cfg.edgeIrregularity??0,miterLimit:cfg.miterLimit??2,
       curvatureSmoothing:cfg.curvatureSmoothing??0});
     totalTriangles+=mesh.indices.length/3;
     totalVertices+=mesh.positions.length/2;
     totalSegments+=mesh.table.path.segments.length;
     if(totalTriangles>budget.maxTriangles||totalVertices>budget.maxVertices||
        totalSegments>budget.maxSegments)
       fail('global graph geometry budget exceeded');
     const result={id,parentId:id===root.id?null:row.parentId,
       path:mesh.table.path,width:mesh.width,table:mesh.table,
       samples:mesh.samples,positions:mesh.positions,uvs:mesh.uvs,indices:mesh.indices};
     cache.set(id,result);
     inProgress.delete(id);
     return result;
   }
   resolve(root.id);
   for(const row of defs)resolve(row.id);
   // Parent-before-child order is deterministic regardless of source array order.
   const ordered=[cache.get(root.id)];
   const pending=new Map([...cache.entries()].filter(([id])=>id!==root.id));
   while(pending.size){
     let advanced=false;
     for(const id of [...pending.keys()].sort()){
       const row=cache.get(id);
       if(ordered.some(parent=>parent.id===row.parentId)){
         ordered.push(row);pending.delete(id);advanced=true;
       }
     }
     if(!advanced)fail('unresolvable branch dependency cycle');
   }
   return {schemaVersion:1,quality,seed,budget,totalVertices,totalTriangles,totalSegments,branches:ordered};
 }
 function generateBranches(input){
   const cfg=object(input,'procedural branches');
   known(cfg,['parentId','parentPath','seed','branchCount','branchSpacingPx',
    'branchLengthPx','spreadDeg','widthRatio','countRandomness','curvatureRandomness',
    'thicknessRandomness','intervalRandomness'],'procedural branches');
   if(typeof cfg.parentId!=='string'||!/^[a-z][a-z0-9._-]*$/.test(cfg.parentId))
     fail('procedural parent ID invalid');
   const seed=seed32(cfg.seed??0),count=integer(cfg.branchCount, 'branch count',0,BUDGETS.high.maxBranches);
   const gap=num(cfg.branchSpacingPx,'branch spacing',.25,100000);
   const branchLength=num(cfg.branchLengthPx,'branch length',.25,100000);
   const spread=num(cfg.spreadDeg??45,'branch spread degrees',0,180);
   const widthRatio=num(cfg.widthRatio??.6,'base width ratio',.01,4);
   const changeCount=num(cfg.countRandomness??0,'count randomness',0,1);
   const changeCurve=num(cfg.curvatureRandomness??0,'curvature randomness',0,1);
   const changeThick=num(cfg.thicknessRandomness??0,'thickness randomness',0,1);
   const changeGap=num(cfg.intervalRandomness??0,'interval randomness',0,1);
   const table=Spacing.buildArcTable(cfg.parentPath);
   if(table.length===0||count===0)return [];
   const rngCount=random(seed,11),rngCurve=random(seed,23),
      rngThick=random(seed,37),rngInterval=random(seed,53);
   const target=clamp(Math.round(count*(1+(rngCount()*2-1)*changeCount)),0,BUDGETS.high.maxBranches);
   const branches=[];let distance=0;
   for(let i=0;i<target;i++){
     distance+=Math.max(.25,gap*(1+(rngInterval()*2-1)*changeGap));
     if(distance>=table.length-1e-7)break;
     const sign=(i%2===0?1:-1);
     const angle=(spread*Math.PI/180)*(.6+changeCurve*(rngCurve()-.5));
     const bend=changeCurve*(rngCurve()*2-1);
     const thick=clamp(widthRatio*(1+(rngThick()*2-1)*changeThick),.01,4);
     const end=[branchLength*Math.cos(angle),sign*branchLength*Math.sin(angle)];
     const first=[branchLength*.2,sign*branchLength*(.16+bend*.14)];
     const second=[end[0]*.7+bend*branchLength*.35,end[1]*.7];
     branches.push({id:cfg.parentId+'.branch.'+String(i+1).padStart(3,'0'),
       parentId:cfg.parentId,attachDistancePx:distance,widthRatio:thick,
       path:{schemaVersion:1,closed:false,segments:[{
         p0:[0,0],p1:first,p2:second,p3:end
       }]}});
   }
   return branches;
 }
 return {schemaVersion:1,BUDGETS,normalizeWidth,widthAt,smoothPath,buildRibbon,
   buildGraph,generateBranches,placeElements};
});
