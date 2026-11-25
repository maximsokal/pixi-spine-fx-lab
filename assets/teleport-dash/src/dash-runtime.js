// GAME-07 T02b: pooled native graphics and detached historical Spine echoes.
(function(root,make){'use strict';const api=Object.freeze(make(root.FxDash||(typeof require==='function'?require('./dash-core.js'):null),root.FxDashSpine||(typeof require==='function'?require('./dash-spine.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDashRuntime=api;})(globalThis,function(D,S){
 'use strict';
 const fail=m=>{throw Error('GAME-07 renderer: '+m);},DEG=Math.PI/180,finite=Number.isFinite;
 const EMPTY=Object.freeze(Object.create(null)),WORLD=Object.freeze({x:256,y:256,rotation:0,scale:1});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function rgba(v){if(!Array.isArray(v)||v.length!==4||!v.every(finite)||v.some((x,i)=>x<0||x>(i===3?1:255)))fail('invalid RGBA');return v;}
 const tint=v=>(Math.round(v[0])<<16)|(Math.round(v[1])<<8)|Math.round(v[2]);
 function fill(v){rgba(v);return {color:tint(v),alpha:v[3]};}
 function ribbonGeometry(points){
  if(!Array.isArray(points)||points.length<2||points.length>2048)fail('invalid ribbon points');
  for(const p of points){if(!p||![p.x,p.y,p.width,p.angle].every(finite)||p.width<0)fail('invalid ribbon point');rgba(p.rgba);}
  const positions=new Float32Array(points.length*4),indices=new Uint32Array((points.length-1)*6);
  function direction(a,b,p){const x=b.x-a.x,y=b.y-a.y,l=Math.hypot(x,y);return l>1e-10?[x/l,y/l]:[Math.cos(p.angle),Math.sin(p.angle)];}
  for(let i=0;i<points.length;i++){
   const p=points[i],before=points[Math.max(i-1,0)],after=points[Math.min(i+1,points.length-1)],a=i?direction(before,p,p):direction(p,after,p),b=i===points.length-1?a:direction(p,after,p);
   const na=[-a[1],a[0]],nb=[-b[1],b[0]],mx=na[0]+nb[0],my=na[1]+nb[1],l=Math.hypot(mx,my),n=l>1e-8?[mx/l,my/l]:nb;
   const miter=clamp(1/Math.max(.5,n[0]*nb[0]+n[1]*nb[1]),1,2),w=p.width*.5*miter,dx=n[0]*w,dy=n[1]*w;
   positions.set([p.x+dx,p.y+dy,p.x-dx,p.y-dy],i*4);
   if(i+1<points.length){const v=i*2;indices.set([v,v+1,v+2,v+1,v+3,v+2],i*6);}
  }
  if(!positions.every(finite))fail('ribbon coordinate overflow');return {positions,indices};
 }
 const active=(e,k)=>{const l=e.layers[k];return e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;};
 function anchor(e,k){const a=e.layers[k].anchor;return a.type==='inherit'?e.anchor:a;}
 function reference(e,k,map){const a=anchor(e,k);if(a.type==='world')return WORLD;return map[a.type==='local'?'$local':a.name]||null;}
 function createDash({PIXI,host,settings,asset=null,poseOptions={}}){
  if(!D||!S||typeof PIXI?.Container!=='function'||typeof PIXI?.Graphics!=='function'||!host||host.destroyed)fail('requires live Pixi 8 host and dash modules');
  let dead=false,current=null,seconds=0,last=null,totalCreated=0;
  const live=()=>{if(dead)fail('destroyed');if(host.destroyed)fail('host destroyed');};
  function dispose(g){if(!g)return;let error;const attempt=fn=>{try{fn();}catch(e){error??=e;}};
   for(const m of g.clones.values())attempt(()=>g.asset.releaseClone(m));g.clones.clear();g.history.clear();
   attempt(()=>g.owned.removeFromParent());attempt(()=>g.owned.destroy({children:true,texture:false,textureSource:false}));if(error)throw error;
  }
  function prepare(config,nextAsset,opts){
   if(!opts||typeof opts!=='object'||Array.isArray(opts))fail('invalid pose options');const plan=D.compile(config),options=Object.freeze({...opts,visible:false}),history=new Map(),clones=new Map(),owners=new Map();
   const echoJobs=[],anchorTimes=new Set();let currentAnchor=false;
   for(let i=0;i<plan.settings.emitters.length;i++){
    const e=plan.settings.emitters[i],row=plan.emitters[i];
    for(const k of ['trail','flash'])if(active(e,k)&&anchor(e,k).type!=='world')currentAnchor=true;
    for(const b of row.echoes){echoJobs.push({e,b,id:e.id+'-echo-'+b.index});if(anchor(e,'echoes').type!=='world')anchorTimes.add(b.birthSeconds);}
    if(anchor(e,'particles').type!=='world')for(const b of row.particles)anchorTimes.add(b.birthSeconds);
   }
   if(nextAsset){
    // Atomic replacement temporarily needs both generations. Refuse rather
    // than exceed the asset's hard clone cap or destroy the current scene.
    nextAsset.checkCapacity(nextAsset.cloneCount+echoJobs.length);
    nextAsset.checkReplay([...echoJobs.map(j=>j.b.sourceSeconds),...anchorTimes,...(currentAnchor?[(plan.settings.durationFrames-1)/60]:[])],options);
   }
   const owned=new PIXI.Container();totalCreated++;owned.label='GAME-07 dash';
   const g={plan,asset:nextAsset,options,owned,owners,clones,history,currentAnchor};
   try{
    for(const e of plan.settings.emitters){const group=new PIXI.Container();totalCreated++;group.label=e.id;owned.addChild(group);const layers={};
     for(const k of D.LAYERS){const layer=k==='echoes'?new PIXI.Container():new PIXI.Graphics();totalCreated++;layer.label=k;group.addChild(layer);layers[k]=layer;}
     owners.set(e.id,{e,layers});
    }
    if(nextAsset){for(const t of anchorTimes)history.set(t,nextAsset.anchorAt(t,options));
     for(const {e,b,id} of echoJobs){const m=nextAsset.createClone();clones.set(id,m);totalCreated++;owners.get(e.id).layers.echoes.addChild(m);nextAsset.poseAt(b.sourceSeconds,options,m);m.visible=false;}
    }
    return g;
   }catch(e){try{dispose(g);}catch(cleanup){e.cleanupError=cleanup;}throw e;}
  }
  function commandsFor(points){const {positions}=ribbonGeometry(points),commands=[];
   // One native polygon batch per continuous strip cell. Color is sampled
   // at the cell midpoint; no shader dependency or cross-run triangle.
   for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],v=a.rgba.map((x,k)=>(x+b.rgba[k])*.5);if(v[3]<=0||a.width===0&&b.width===0)continue;
    const n=i*4,xy=[positions[n],positions[n+1],positions[n+2],positions[n+3],positions[n+6],positions[n+7],positions[n+4],positions[n+5]];
    commands.push({xy,fill:fill(v)});
   }return commands;
  }
  function sample(g,t){
   if(!finite(t)||t<0||t>1e7)fail('invalid seconds');let now;
   const provider=time=>{if(g.history.has(time))return g.history.get(time);if(g.asset&&g.currentAnchor&&time===t){if(!now){g.asset.checkReplay([t],g.options);now=g.asset.anchorAt(t,g.options);}return now;}return EMPTY;};
   const result=g.plan.sample(t,provider),diagnostics=[...result.diagnostics],paint=[];
   for(const row of result.emitters){const owner=g.owners.get(row.id),layers=row.layers,echoes=[],ribbons=[],dots={flash:[],particles:[]};
    if(!g.asset&&layers.echoes.length)diagnostics.push({emitterId:row.id,layer:'echoes',reason:'no Spine asset selected'});
    if(g.asset)for(const item of layers.echoes){const m=g.clones.get(item.id);if(!m)fail('unknown historical echo');const F=reference(owner.e,'echoes',provider(item.birthSeconds));if(!F)continue;const transform=S.relativeTransform(g.asset.fit,F,item);rgba(item.rgba);echoes.push({m,transform,item});}
    for(const run of layers.trail)ribbons.push(...commandsFor(run.points));
    for(const k of ['flash','particles'])for(const item of layers[k]){if(![item.x,item.y,item.radius].every(finite)||item.radius<0)fail('invalid primitive');const f=fill(item.rgba);if(f.alpha>0&&item.radius>0)dots[k].push({item,fill:f});}
    paint.push({owner,layers,echoes,ribbons,dots});
   }
   return {result:{...result,diagnostics},paint};
  }
  function draw(g,frame){
   for(const m of g.clones.values())m.visible=false;
   for(const {owner,layers,echoes,ribbons,dots} of frame.paint){const views=owner.layers;
    for(const k of ['trail','flash','particles']){const v=views[k];v.clear();v.visible=false;v.blendMode=layers[k][0]?.blend||'normal';}
    views.trail.visible=ribbons.length>0;for(const cmd of ribbons)views.trail.poly(cmd.xy).fill(cmd.fill);
    for(const k of ['flash','particles']){views[k].visible=dots[k].length>0;for(const {item,fill} of dots[k])views[k].circle(item.x,item.y,item.radius).fill(fill);}
    views.echoes.visible=echoes.length>0;for(const {m,transform:p,item} of echoes){m.position.set(p.x,p.y);m.rotation=p.rotation*DEG;m.scale.set(p.scale);m.tint=tint(item.rgba);m.alpha=item.rgba[3];m.blendMode=item.blend;m.visible=true;}
   }
  }
  function configure(next,options={}){
   live();if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['asset','poseOptions'].includes(k)))fail('invalid configure options');
   const a=Object.hasOwn(options,'asset')?options.asset:current?current.asset:asset,o=Object.hasOwn(options,'poseOptions')?options.poseOptions:current?current.options:poseOptions;
   const candidate=prepare(next,a,o);let frame;try{frame=sample(candidate,seconds);draw(candidate,frame);host.addChild(candidate.owned);}catch(e){try{dispose(candidate);}catch(cleanup){e.cleanupError=cleanup;}throw e;}
   const previous=current;current=candidate;last=frame.result;dispose(previous);return current.plan.settings;
  }
  function seek(t){live();const frame=sample(current,t);draw(current,frame);seconds=t;last=frame.result;return last;}
  function destroy(){if(dead)return;dead=true;const g=current;current=null;last=null;dispose(g);}
  configure(settings,{asset,poseOptions});
  return Object.freeze({seek,configure,destroy,get owned(){return current?.owned??null;},get settings(){return current?.plan.settings??null;},get sample(){return last;},get totalCreated(){return totalCreated;},get residentClones(){return current?.clones.size??0;}});
 }
 return {VERSION:1,ribbonGeometry,createDash};
});
