// AIR-02 — PixiJS 8.22 native particle renderer. Numerical source: FxSnow.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(root.FxSnow||(typeof require==='function'?require('./snow-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSnowRuntime=api;
})(globalThis,function(Snow){
 'use strict';
 const SIZE=32,DEG=Math.PI/180,TAU=2*Math.PI;
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const clamp=v=>Math.max(0,Math.min(1,v));
 function segment(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
  return Math.hypot(x-ax-dx*t,y-ay-dy*t);
 }
 // White straight-alpha source texels. Supersampled silhouettes; the canvas
 // upload premultiplies once, not twice. Each batch shares exactly one texture.
 function maskRGBA(shape){
  if(!Number.isInteger(shape)||shape<0||shape>2)throw RangeError('AIR-02 invalid shape');
  const out=new Uint8ClampedArray(SIZE*SIZE*4);
  const arms=shape===1?6:shape===2?4:0;
  function inside(x,y){
   if(shape===0)return Math.hypot(x,y)<=.72;
   if(Math.hypot(x,y)<=.18)return true;
   for(let i=0;i<arms;i++){
    const a=i*TAU/arms,c=Math.cos(a),s=Math.sin(a),u=x*c+y*s,v=-x*s+y*c;
    if(segment(u,v,0,0,.81,0)<.075)return true;
    for(const side of [-1,1])if(segment(u,v,.48,0,.66,side*.22)<.065)return true;
   }
   return false;
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   let hits=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)
    hits+=Number(inside((x+(sx+.5)/4)/SIZE*2-1,(y+(sy+.5)/4)/SIZE*2-1));
   const i=(y*SIZE+x)*4;out[i]=out[i+1]=out[i+2]=255;out[i+3]=Math.round(hits*255/16);
  }
  return out;
 }
 function createSnow({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0},
  makeCanvas=()=>document.createElement('canvas')}){
  const stage=app?.stage;
  if(!Snow||!stage||!host||host.parent!==stage||host.x!==0||host.y!==0||host.rotation!==0||
    host.scale.x!==1||host.scale.y!==1||!finite(worldOffset))
   throw TypeError('AIR-02 requires identity stage-owned host and finite crop offset');
  for(const key of ['Container','Particle','ParticleContainer','Texture','ImageSource','Rectangle'])
   if(typeof PIXI?.[key]!=='function')throw TypeError('AIR-02 missing PixiJS '+key);
  const offset={...worldOffset};
  let plan=Snow.createPlan(settings),dead=false,last=null,clock=0,diagnostics=[],lastBounds=null,
   totalCreated=0,totalActive=0;
  const owners=new Map(),textures=[],free=[],owned={behind:null,front:null};
  function guard(){if(dead)throw Error('AIR-02 renderer destroyed')}
  function makeTexture(shape){
   const canvas=makeCanvas();canvas.width=canvas.height=SIZE;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('AIR-02 canvas unavailable');
   const bitmap=ctx.createImageData(SIZE,SIZE);bitmap.data.set(maskRGBA(shape));ctx.putImageData(bitmap,0,0);
   const source=new PIXI.ImageSource({resource:canvas,alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
   try{return new PIXI.Texture({source})}catch(error){source.destroy();throw error}
  }
  function createOwner(e){
   const layers={};
   try{
    for(const kind of Snow.LAYERS){
     const surface=new PIXI.Container(),batches=[];
     layers[kind]={surface,batches};surface.label='AIR-02 '+e.id+'/'+kind;
     for(let i=0;i<3;i++){
      const batch=new PIXI.ParticleContainer({texture:textures[i],dynamicProperties:{
       position:true,rotation:true,vertex:true,color:true,uvs:false}});
      batches.push(batch);surface.addChild(batch);
      batch.boundsArea=new PIXI.Rectangle(0,0,0,0);
     }
    }
    return {layers};
   }catch(error){disposeOwner({layers});throw error}
  }
  function releaseBatch(batch,n=0){
   const p=batch.particleChildren;
   if(p.length>n){for(let i=n;i<p.length;i++)free.push(p[i]);p.length=n;batch.update();}
  }
  function disposeOwner(owner){
   for(const {surface,batches} of Object.values(owner.layers)){
    for(const b of batches){releaseBatch(b);if(b.parent!==surface)b.destroy({children:true});}
    surface.destroy({children:true});
   }
  }
  function sync(next){
   const staged=new Map(),ids=new Set(next.settings.emitters.map(e=>e.id));
   try{for(const e of next.settings.emitters)if(!owners.has(e.id))staged.set(e.id,createOwner(e));}
   catch(error){for(const o of staged.values())disposeOwner(o);throw error}
   for(const [id,o] of owners)if(!ids.has(id)){disposeOwner(o);owners.delete(id)}
   for(const [id,o] of staged)owners.set(id,o);
   // Reorder only our own surfaces, preserving foreign stage siblings.
   for(const e of next.settings.emitters)for(const kind of Snow.LAYERS){
    const s=owners.get(e.id).layers[kind].surface;
    owned[kind==='far'?'behind':'front'].addChild(s);
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
     const at=slot.getAttachment?.();if(at?.name!==a.name||typeof at.computeWorldVertices!=='function')return null;
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
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY;}
   if(a.space==='local')return fromSpine(x+bone.a*a.x+bone.b*a.y,y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }
  function pose(e,l){
   const own=e.layers[l.id].anchor,base=l.anchor,p=resolveAnchor(base);if(!p)return null;
   const angle=base.rotation*DEG,co=Math.cos(angle),si=Math.sin(angle),inherited=own.type==='inherit';
   const x=l.transform.x+(inherited?own.x:0),y=l.transform.y+(inherited?own.y:0);
   return {x:p.x+x*co-y*si,y:p.y+x*si+y*co,
    rotation:angle+(l.transform.rotation+(inherited?own.rotation:0))*DEG};
  }
  function fillBatch(batch,items,shape,blend){
   const p=batch.particleChildren,old=p.length;
   for(let i=old;i<items.length;i++){
    let v=free.pop();
    if(!v){v=new PIXI.Particle({texture:textures[shape],anchorX:.5,anchorY:.5});totalCreated++}
    v.texture=textures[shape];p.push(v);
   }
   if(old!==p.length)batch.update();
   batch.blendMode=blend;
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(let i=0;i<items.length;i++){
    const a=items[i],v=p[i],r=a.size*Math.SQRT2/2;
    v.x=a.x;v.y=a.y;v.scaleX=v.scaleY=a.size/SIZE;
    v.rotation=a.rotation*DEG;v.tint=(Math.round(a.rgba[0])<<16)|(Math.round(a.rgba[1])<<8)|Math.round(a.rgba[2]);
    v.alpha=a.rgba[3];
    left=Math.min(left,a.x-r);top=Math.min(top,a.y-r);right=Math.max(right,a.x+r);bottom=Math.max(bottom,a.y+r);
   }
   Object.assign(batch.boundsArea,items.length?{x:left,y:top,width:right-left,height:bottom-top}:{x:0,y:0,width:0,height:0});
  }
  function seek(seconds){
   guard();const frame=plan.sample(seconds),work=[],cfg=plan.settings;diagnostics=[];totalActive=0;
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   const emitters=frame.emitters.map(row=>{
    const e=cfg.emitters.find(v=>v.id===row.id);
    const layers=row.layers.map(l=>{
     const dst=owners.get(row.id).layers[l.id],p=l.enabled?pose(e,l):null;
     if(l.enabled&&!p)diagnostics.push({code:'missing-anchor',emitter:row.id,layer:l.id});
     dst.surface.visible=!!p;
     if(p){dst.surface.position.set(p.x,p.y);dst.surface.rotation=p.rotation}
     const items=p?l.particles.filter(v=>v.rgba[3]>0):[];
     totalActive+=items.length;
     const byShape=[[],[],[]];for(const v of items)byShape[v.shape].push(v);
     for(let i=0;i<3;i++)work.push({batch:dst.batches[i],items:byShape[i],shape:i,blend:l.blend});
     if(p){const co=Math.cos(p.rotation),si=Math.sin(p.rotation);for(const v of items){
      const x=p.x+v.x*co-v.y*si,y=p.y+v.x*si+v.y*co,r=v.size*Math.SQRT2/2;
      left=Math.min(left,x-r);right=Math.max(right,x+r);top=Math.min(top,y-r);bottom=Math.max(bottom,y+r);
     }}
     return {...l,particles:items};
    });return {...row,layers};
   });
   // Release across ALL groups before acquiring: allocated objects never grow
   // as the same bounded population migrates among textures or layers.
   for(const w of work)releaseBatch(w.batch,w.items.length);
   for(const w of work)fillBatch(w.batch,w.items,w.shape,w.blend);
   const limit=Snow.BUDGETS[cfg.quality];free.length=Math.min(free.length,Math.max(0,limit-totalActive));
   lastBounds=Number.isFinite(left)?{x:left,y:top,width:right-left,height:bottom-top}:null;
   last={...frame,emitters,cost:totalActive};clock=seconds;return last;
  }
  function configure(settings){
   guard();const next=Snow.createPlan(settings);sync(next);plan=next;seek(clock);return plan.settings;
  }
  function destroy(){
   if(dead)return;dead=true;
   for(const o of owners.values())disposeOwner(o);owners.clear();
   for(const g of Object.values(owned))g?.destroy({children:true});
   for(const t of textures)t.destroy(true);textures.length=0;free.length=0;totalActive=0;last=null;lastBounds=null;
  }
  try{
   for(let i=0;i<3;i++)textures.push(makeTexture(i));
   owned.behind=new PIXI.Container();owned.front=new PIXI.Container();
   owned.behind.label='AIR-02 far';owned.front.label='AIR-02 near/swirl';
   stage.addChildAt(owned.behind,stage.getChildIndex(host));
   stage.addChildAt(owned.front,stage.getChildIndex(host)+1);
   sync(plan);seek(0);
  }catch(error){try{destroy()}catch(cleanup){throw new AggregateError([error,cleanup],'AIR-02 initialization cleanup failed')}throw error}
  return Object.freeze({seek,configure,resolveAnchor,currentBounds:()=>lastBounds?{...lastBounds}:null,
   setModel(next){guard();model=next;return seek(clock)},destroy,
   get settings(){return plan.settings},get sample(){return last},get diagnostics(){return diagnostics.slice()},
   get owned(){return owned},get emitters(){return owners},get sceneSource(){return host},
   get totalActive(){return totalActive},get totalCreated(){return totalCreated},get totalAllocated(){return totalActive+free.length}});
 }
 return {createSnow,maskRGBA};
});
