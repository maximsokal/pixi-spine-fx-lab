(function(root,factory){
 const api=Object.freeze(factory(root.FxBlizzard||(typeof require==='function'?require('./blizzard-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxBlizzardRuntime=api;
})(globalThis,function(Blizzard){
 'use strict';
 const SIZE=32,DEG=Math.PI/180,TAU=Math.PI*2;
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const clamp=v=>Math.max(0,Math.min(1,v));
 function segment(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
  return Math.hypot(x-ax-dx*t,y-ay-dy*t);
 }
 function maskRGBA(kind){
  if(!Blizzard.LAYERS.includes(kind))throw RangeError('AIR-03 invalid mask');
  const out=new Uint8ClampedArray(SIZE*SIZE*4);
  function inside(x,y){
   if(kind==='whiteout')return true;
   if(kind==='streaks')return Math.hypot(Math.max(0,Math.abs(x)-.72)/.22,y/.85)<=1;
   if(Math.hypot(x,y)<=.22)return true;
   for(let i=0;i<6;i++){
    const a=i*TAU/6,c=Math.cos(a),s=Math.sin(a),u=x*c+y*s,v=-x*s+y*c;
    if(segment(u,v,0,0,.81,0)<.09)return true;
    for(const side of [-1,1])if(segment(u,v,.48,0,.66,side*.22)<.075)return true;
   }
   return false;
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   let hits=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)hits+=Number(inside((x+(sx+.5)/4)/SIZE*2-1,(y+(sy+.5)/4)/SIZE*2-1));
   const i=(y*SIZE+x)*4;out[i]=out[i+1]=out[i+2]=255;out[i+3]=Math.round(hits*255/16);
  }return out;
 }
 function createBlizzard({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0},makeCanvas=()=>document.createElement('canvas')}){
  const stage=app?.stage;
  if(!stage||!host||host.parent!==stage||host.x!==0||host.y!==0||host.rotation!==0||host.scale.x!==1||host.scale.y!==1||
    (host.pivot&&(host.pivot.x!==0||host.pivot.y!==0))||(host.skew&&(host.skew.x!==0||host.skew.y!==0))||!finite(worldOffset))
   throw TypeError('AIR-03 requires identity stage-owned host and finite crop offset');
  for(const key of ['Container','Particle','ParticleContainer','Texture','ImageSource','Rectangle'])if(typeof PIXI?.[key]!=='function')throw TypeError('AIR-03 missing PixiJS '+key);
  const offset={...worldOffset},owners=new Map(),textures={},free=[],owned={behind:null,front:null};
  let plan=Blizzard.createPlan(settings),dead=false,clock=0,last=null,lastBounds=null,diagnostics=[],totalActive=0,totalCreated=0;
  function guard(){if(dead)throw Error('AIR-03 renderer destroyed');}
  function makeTexture(kind){
   const canvas=makeCanvas();canvas.width=canvas.height=SIZE;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('AIR-03 canvas unavailable');
   const bitmap=ctx.createImageData(SIZE,SIZE);bitmap.data.set(maskRGBA(kind));ctx.putImageData(bitmap,0,0);
   const source=new PIXI.ImageSource({resource:canvas,alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
   try{return new PIXI.Texture({source});}catch(error){source.destroy();throw error;}
  }
  function createOwner(id){
   const layers={};
   try{
    for(const k of Blizzard.LAYERS){
     const surface=new PIXI.Container();layers[k]={surface,batch:null};surface.label='AIR-03 '+id+'/'+k;
     const batch=new PIXI.ParticleContainer({texture:textures[k],dynamicProperties:{position:true,rotation:true,vertex:true,color:true,uvs:false}});
     layers[k].batch=batch;batch.boundsArea=new PIXI.Rectangle(0,0,0,0);surface.addChild(batch);
    }return {layers};
   }catch(error){disposeOwner({layers},false);throw error;}
  }
  function release(batch,n,pool){
   const p=batch.particleChildren;if(p.length<=n)return;
   if(pool)for(let i=n;i<p.length;i++)pool.push(p[i]);p.length=n;batch.update();
  }
  function disposeOwner(o,recycle){
   for(const {surface,batch} of Object.values(o.layers)){
    if(batch){release(batch,0,recycle?free:null);if(batch.parent!==surface)batch.destroy();}
    surface.destroy({children:true});
   }
  }
  function fromSpine(x,y){
   if(!model||!Number.isFinite(x)||!Number.isFinite(y))return null;
   const p=stage.toLocal(model.toGlobal({x,y}));return finite(p)?p:null;
  }
  function resolveAnchor(a){
   if(a.type==='world')return {x:a.x+offset.x,y:a.y+offset.y};
   const sk=model?.skeleton;if(!sk)return null;
   if(a.type==='skeleton'){
    const p=fromSpine(a.space==='local'?a.x:0,a.space==='local'?a.y:0);
    return !p?null:a.space==='local'?p:{x:p.x+a.x,y:p.y+a.y};
   }
   let bone,x,y;
   if(a.type==='bone')bone=sk.findBone(a.name);
   else{
    const slot=sk.findSlot(a.type==='attachment'?a.slot:a.name);
    bone=slot?.bone;if(!bone?.active)return null;
    if(a.type==='attachment'){
     const at=slot.getAttachment?.();if(at?.name!==a.name)return null;
     if(typeof at.computeWorldPosition==='function'){
      let p;try{p=at.computeWorldPosition(bone,{x:NaN,y:NaN});}catch{return null}
      if(!finite(p))return null;
      x=p.x;y=p.y;
     }else{
      if(typeof at.computeWorldVertices!=='function')return null;
      const count=at.worldVerticesLength??8;
      if(!Number.isInteger(count)||count<2||count%2||count>65536)return null;
      const verts=new Float32Array(count);verts.fill(NaN);
      try{if(at.worldVerticesLength!==undefined)at.computeWorldVertices(slot,0,count,verts,0,2);
       else at.computeWorldVertices(slot,verts,0,2);}catch{return null}
      let loX=Infinity,loY=Infinity,hiX=-Infinity,hiY=-Infinity;
      for(let i=0;i<count;i+=2){if(!Number.isFinite(verts[i])||!Number.isFinite(verts[i+1]))return null;
       loX=Math.min(loX,verts[i]);hiX=Math.max(hiX,verts[i]);loY=Math.min(loY,verts[i+1]);hiY=Math.max(hiY,verts[i+1]);}
      x=(loX+hiX)/2;y=(loY+hiY)/2;
     }
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY;}
   if(a.space==='local')return fromSpine(x+bone.a*a.x+bone.b*a.y,y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }

  function pose(e,l){
   const own=e.layers[l.id].anchor,base=l.anchor,p=resolveAnchor(base);if(!p)return null;
   let dx=0,dy=0;
   if(own.type==='inherit'){
    const zero=resolveAnchor({...base,x:0,y:0}),delta=resolveAnchor({...base,space:own.space,x:own.x,y:own.y});
    if(!zero||!delta)return null;dx=delta.x-zero.x;dy=delta.y-zero.y;
   }
   const angle=base.rotation*DEG,co=Math.cos(angle),si=Math.sin(angle),x=l.transform.x,y=l.transform.y,
    result={x:p.x+dx+x*co-y*si,y:p.y+dy+x*si+y*co,rotation:angle+(l.transform.rotation+(own.type==='inherit'?own.rotation:0))*DEG};
   return finite(result)&&Number.isFinite(result.rotation)?result:null;
  }
  function prepare(next,seconds,available){
   const frame=next.sample(seconds),work=[],notes=[],settingsById=new Map(next.settings.emitters.map(e=>[e.id,e]));
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,cost=0;
   const emitters=frame.emitters.map(row=>({...row,layers:row.layers.map(l=>{
    const e=settingsById.get(row.id),p=l.enabled?pose(e,l):null,dst=available.get(row.id).layers[l.id];
    if(l.enabled&&!p)notes.push({code:'missing-anchor',emitter:row.id,layer:l.id});
    const particles=p?l.particles.filter(v=>v.rgba[3]>0):[],whiteout=p?l.whiteout:null,
     items=whiteout?[{x:whiteout.x,y:whiteout.y,length:whiteout.width,width:whiteout.height,rotation:0,rgba:whiteout.rgba}]:particles;
    cost+=items.length;work.push({dst,p,items,k:l.id,blend:l.blend});
    if(p){const co=Math.cos(p.rotation),si=Math.sin(p.rotation);for(const v of items){
     const x=p.x+v.x*co-v.y*si,y=p.y+v.x*si+v.y*co,a=p.rotation+v.rotation*DEG,
      rx=(Math.abs(Math.cos(a))*v.length+Math.abs(Math.sin(a))*v.width)/2,
      ry=(Math.abs(Math.sin(a))*v.length+Math.abs(Math.cos(a))*v.width)/2;
     left=Math.min(left,x-rx);right=Math.max(right,x+rx);top=Math.min(top,y-ry);bottom=Math.max(bottom,y+ry);
    }}return {...l,particles,whiteout};
   })}));
   if(cost>Blizzard.BUDGETS[next.settings.quality]||cost>frame.cost)throw RangeError('AIR-03 render budget exceeded');
   return {work,notes,frame:{...frame,emitters,cost},bounds:Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:null};
  }
  function allocate(prepared){
   const allocated=free.length+totalActive,extra=[];
   for(let i=allocated;i<prepared.frame.cost;i++)extra.push(new PIXI.Particle({texture:textures.streaks,anchorX:.5,anchorY:.5}));
   return extra;
  }
  function apply(prepared,extra,next,seconds){
   free.push(...extra);totalCreated+=extra.length;
   for(const w of prepared.work)release(w.dst.batch,w.items.length,free);
   for(const {dst,p,items,k,blend} of prepared.work){
    const {surface,batch}=dst,list=batch.particleChildren,old=list.length;
    surface.visible=!!p;if(p){surface.position.set(p.x,p.y);surface.rotation=p.rotation;}
    for(let i=old;i<items.length;i++){const v=free.pop();if(!v)throw Error('AIR-03 pool invariant');v.texture=textures[k];list.push(v);}
    if(old!==list.length)batch.update();
    batch.blendMode=blend;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(let i=0;i<items.length;i++){
     const a=items[i],v=list[i],angle=a.rotation*DEG,co=Math.cos(angle),si=Math.sin(angle),
      rx=(Math.abs(co)*a.length+Math.abs(si)*a.width)/2,ry=(Math.abs(si)*a.length+Math.abs(co)*a.width)/2;
     v.x=a.x;v.y=a.y;v.scaleX=a.length/SIZE;v.scaleY=a.width/SIZE;v.rotation=angle;
     v.tint=(Math.round(a.rgba[0])<<16)|(Math.round(a.rgba[1])<<8)|Math.round(a.rgba[2]);v.alpha=a.rgba[3];
     left=Math.min(left,a.x-rx);right=Math.max(right,a.x+rx);top=Math.min(top,a.y-ry);bottom=Math.max(bottom,a.y+ry);
    }
    Object.assign(batch.boundsArea,items.length?{x:left,y:top,width:right-left,height:bottom-top}:{x:0,y:0,width:0,height:0});
   }
   totalActive=prepared.frame.cost;free.length=Math.min(free.length,Math.max(0,Blizzard.BUDGETS[next.settings.quality]-totalActive));
   last=prepared.frame;lastBounds=prepared.bounds;diagnostics=prepared.notes;clock=seconds;
   return last;
  }
  function configure(input){
   guard();const next=Blizzard.createPlan(input),available=new Map(),staged=new Map();let prepared,extra;
   try{
    for(const e of next.settings.emitters){let o=owners.get(e.id);if(!o){o=createOwner(e.id);staged.set(e.id,o);}available.set(e.id,o);}
    prepared=prepare(next,clock,available);extra=allocate(prepared);
   }catch(error){for(const o of staged.values())disposeOwner(o,false);throw error;}
   for(const [id,o] of owners)if(!available.has(id)){disposeOwner(o,true);owners.delete(id);}
   for(const [id,o] of staged)owners.set(id,o);
   for(const e of next.settings.emitters)for(const k of Blizzard.LAYERS)owned[k==='streaks'?'behind':'front'].addChild(owners.get(e.id).layers[k].surface);
   plan=next;apply(prepared,extra,plan,clock);return plan.settings;
  }
  function seek(seconds){guard();const prepared=prepare(plan,seconds,owners),extra=allocate(prepared);return apply(prepared,extra,plan,seconds);}
  function destroy(){
   if(dead)return;dead=true;
   for(const o of owners.values())disposeOwner(o,false);owners.clear();
   for(const g of Object.values(owned))g?.destroy({children:true});
   for(const t of Object.values(textures))t.destroy(true);
   free.length=0;totalActive=0;last=null;lastBounds=null;diagnostics=[];
  }
  try{
   for(const k of Blizzard.LAYERS)textures[k]=makeTexture(k);
   owned.behind=new PIXI.Container();owned.front=new PIXI.Container();
   owned.behind.label='AIR-03 streaks';owned.front.label='AIR-03 foreground/whiteout';
   stage.addChildAt(owned.behind,stage.getChildIndex(host));stage.addChildAt(owned.front,stage.getChildIndex(host)+1);
   configure(settings);
  }catch(error){try{destroy();}catch(cleanup){throw new AggregateError([error,cleanup],'AIR-03 initialization cleanup failed');}throw error;}
  return Object.freeze({seek,configure,resolveAnchor,currentBounds:()=>lastBounds?{...lastBounds}:null,
   setModel(next){guard();const old=model;model=next;try{return seek(clock);}catch(error){model=old;throw error;}},
   destroy,get settings(){return plan.settings},get sample(){return last},get diagnostics(){return diagnostics.slice()},get owned(){return owned},get emitters(){return owners},get sceneSource(){return host},
   get totalActive(){return totalActive},get totalCreated(){return totalCreated},get totalAllocated(){return totalActive+free.length}});
 }
 return {createBlizzard,maskRGBA};
});
