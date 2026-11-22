// AIR-01 — real pooled MeshSimple curved gust + native ParticleContainer dust.
(function(root){
 'use strict';
 const DEG=Math.PI/180, MAX_SAMPLES={low:80,balanced:120,high:160};
 function createWind({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
   host.x!==0||host.y!==0||host.rotation!==0||
   host.scale.x!==1||host.scale.y!==1)
   throw TypeError('AIR-01 requires identity stage-owned source host');
  if(typeof PIXI.MeshSimple!=='function'||typeof PIXI.ParticleContainer!=='function'||
   typeof PIXI.Particle!=='function')throw TypeError('AIR-01 requires native Pixi8.22');
  const W=root.FxWind;
  if(!W)throw Error('Load FxWind core before runtime');
  let cfg=W.normalize(settings),dead=false,last=null,diagnostics=null;
  let totalCreated=0,totalUpdated=0,totalActive=0;
  const owned=new PIXI.Container(),owners=new Map(),anchors={};
  owned.label='AIR-01 independently owned Wind Gust';
  app.stage.addChild(owned);
  const tint=rgba=>(Math.round(rgba[0])<<16)|
   (Math.round(rgba[1])<<8)|Math.round(rgba[2]);
  function makeTexture(width,height,draw){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),
    bitmap=ctx.createImageData(width,height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const rgba=draw(x/(width-1),y/(height-1)),off=(y*width+x)*4;
    for(let ch=0;ch<4;ch++)
     bitmap.data[off+ch]=Math.max(0,Math.min(255,Math.round(rgba[ch])));
   }
   ctx.putImageData(bitmap,0,0);
   return new PIXI.Texture({source:new PIXI.ImageSource({
    resource:canvas,alphaMode:'premultiply-alpha-on-upload',
    autoGenerateMipmaps:false})});
  }
  // Fixed soft-alpha mask. Painter gradients are applied with per-instance tint.
  const ribbonTexture=makeTexture(256,32,(u,v)=>{
   const side=Math.max(0,Math.min(1,Math.min(v/.31,(1-v)/.31)));
   const tip=Math.max(0,Math.min(1,Math.min(u/.08,(1-u)/.12)));
   const taper=tip*tip*(3-2*tip),soft=side*side*(3-2*side);
   const glint=.92+.08*Math.sin(2*Math.PI*u*6);
   return [255,255,255,255*soft*taper*glint*.85];
  });
  const dustTexture=makeTexture(32,32,(u,v)=>{
   const r=Math.hypot((u-.5)*2,(v-.5)*2);
   const alpha=Math.max(0,Math.min(1,(1-r)*3));
   return [255,255,255,Math.round(255*alpha*.83)];
  });
  function createRibbon(capacity){
   const vertices=new Float32Array(capacity*4),
    uvs=new Float32Array(capacity*4),
    indices=new Uint16Array((capacity-1)*6),
    mesh=new PIXI.MeshSimple({texture:ribbonTexture,vertices,uvs,indices,
     topology:'triangle-list'});
   mesh.autoUpdate=false;mesh.visible=false;mesh.label='AIR-01 tapered gust ribbon';
   totalCreated++;
   return {mesh,capacity,vertices,uvs,indices};
  }
  function addOwner(e){
   const container=new PIXI.Container(),layers={};
   container.label=e.id;
   for(const kind of W.LAYERS){
    const surface=new PIXI.Container();
    surface.label='AIR-01 '+e.id+'/'+kind;
    if(kind==='streaks')layers[kind]={surface,pool:[]};
    else{
     const particles=new PIXI.ParticleContainer({dynamicProperties:{
      position:true,rotation:true,vertex:true,color:true}});
     particles.label='AIR-01 native dust pool';
     surface.addChild(particles);layers[kind]={surface,particles,pool:[]};
    }
    container.addChild(surface);
   }
   owned.addChild(container);owners.set(e.id,{container,layers});
  }
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,record] of owners)if(!ids.has(id)){
    record.container.removeFromParent();record.container.destroy({children:true});
    owners.delete(id);delete anchors[id];
   }
   for(const e of cfg.emitters)if(!owners.has(e.id))addOwner(e);
  }
  sync();
  function updateRibbons(layer,items){
   while(layer.pool.length<items.length){
    const o=createRibbon(MAX_SAMPLES[cfg.quality]);
    layer.pool.push(o);layer.surface.addChild(o.mesh);
   }
   for(let i=0;i<layer.pool.length;i++){
    const p=layer.pool[i],v=items[i];
    p.mesh.visible=!!v&&v.rgba[3]>0;
    if(!p.mesh.visible)continue;
    if(v.positions.length>p.vertices.length||v.uvs.length>p.uvs.length||
     v.indices.length>p.indices.length)
     throw RangeError('AIR-01 ribbon exceeds preallocated GPU geometry');
    p.vertices.fill(0);p.uvs.fill(0);p.indices.fill(0);
    p.vertices.set(v.positions);p.uvs.set(v.uvs);p.indices.set(v.indices);
    p.mesh.geometry.getBuffer('aPosition').update();
    p.mesh.geometry.getBuffer('aUV').update();
    p.mesh.geometry.getIndex().update();
    p.mesh.tint=tint(v.rgba);p.mesh.alpha=v.rgba[3];
    totalUpdated++;totalActive++;
   }
  }
  function updateDust(layer,items){
   const p=layer.particles,pool=layer.pool,active=p.particleChildren.length;
   for(let i=active;i>items.length;i--)p.removeParticle(pool[i-1]);
   for(let i=active;i<items.length;i++){
    if(i===pool.length){
     pool.push(new PIXI.Particle({texture:dustTexture,
      x:0,y:0,anchorX:.5,anchorY:.5,scaleX:1,scaleY:1,
      tint:0xffffff,alpha:0}));totalCreated++;
    }
    p.addParticle(pool[i]);
   }
   for(let i=0;i<items.length;i++){
    const o=items[i],v=pool[i];
    v.x=o.x;v.y=o.y;v.rotation=o.rotation||0;
    v.scaleX=o.radius*2/32;v.scaleY=o.radius*2/32;
    v.tint=tint(o.rgba);v.alpha=o.rgba[3];
   }
   if(items.length)p.update();totalActive+=items.length;
  }
  function fromSpine(x,y){
   if(!model?.worldTransform)return null;
   const q=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:q.x+worldOffset.x,y:q.y+worldOffset.y};
  }
  function resolveAnchor(a){
   if(a.type==='world')return {x:a.x+worldOffset.x,y:a.y+worldOffset.y};
   if(!model?.skeleton)return null;
   const sk=model.skeleton;
   if(a.type==='skeleton')return fromSpine(a.x,a.y);
   let bone=null,x=0,y=0;
   if(a.type==='bone')bone=sk.findBone(a.name);
   else{
    const slot=sk.findSlot(a.type==='attachment'?a.slot:a.name);
    if(!slot?.bone?.active)return null;
    bone=slot.bone;
    if(a.type==='attachment'){
     const attachment=slot.getAttachment?.();
     if(!attachment||attachment.name!==a.name||
      typeof attachment.computeWorldVertices!=='function')return null;
     let verts;
     try{
      if(typeof attachment.worldVerticesLength==='number'&&
       attachment.worldVerticesLength>1){
       verts=new Float32Array(Math.min(512,attachment.worldVerticesLength));
       attachment.computeWorldVertices(slot,0,verts.length,verts,0,2);
      }else{
       verts=new Float32Array(8);
       attachment.computeWorldVertices(slot,verts,0,2);
      }
     }catch{return null}
     let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
     for(let i=0;i<verts.length;i+=2){
      loX=Math.min(loX,verts[i]);hiX=Math.max(hiX,verts[i]);
      loY=Math.min(loY,verts[i+1]);hiY=Math.max(hiY,verts[i+1]);
     }
     x=(loX+hiX)/2;y=(loY+hiY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY}
   if(a.space==='local')return fromSpine(x+bone.a*a.x+bone.b*a.y,
                                          y+bone.c*a.x+bone.d*a.y);
   const q=fromSpine(x,y);
   return q?{x:q.x+a.x,y:q.y+a.y}:null;
  }
  function computeFrameAnchors(e){
   const main=resolveAnchor(e.anchor),
    angle=(e.rotation+e.anchor.rotation)*DEG,
    cs=Math.cos(angle),sn=Math.sin(angle),result={};
   for(const kind of W.LAYERS){
    const layer=e.layers[kind],a=layer.anchor;
    const base=a.type==='inherit'?main:resolveAnchor(a);
    let origin=null;
    if(base){
     const x=e.x+layer.x+a.x,y=e.y+layer.y+a.y;
     origin={x:base.x+x*cs-y*sn,y:base.y+x*sn+y*cs};
    }
    result[kind]={origin,angle:(e.rotation+layer.rotation+
     (a.type==='inherit'?e.anchor.rotation:0)+a.rotation)*DEG};
   }
   return result;
  }
  function seek(seconds){
   if(dead)throw Error('AIR-01 renderer destroyed');
   sync();last=W.sample(cfg,seconds);diagnostics=null;totalActive=0;
   for(const e of cfg.emitters){
    const owner=owners.get(e.id),row=last.emitters.find(v=>v.id===e.id);
    owner.container.visible=e.enabled&&e.visible&&!!row;
    if(!owner.container.visible)continue;
    const resolved=computeFrameAnchors(e);anchors[e.id]=resolved;
    for(const kind of W.LAYERS){
     const dst=owner.layers[kind],l=e.layers[kind],a=resolved[kind];
     const show=l.enabled&&l.visible&&!!a.origin;
     dst.surface.visible=show;
     if(!show){
      if(l.enabled&&l.visible&&!a.origin)
       diagnostics=(diagnostics?diagnostics+'; ':'')+
        'Missing/inactive AIR-01 '+e.id+'/'+kind+' anchor';
      continue;
     }
     dst.surface.position.set(a.origin.x,a.origin.y);
     dst.surface.rotation=a.angle;dst.surface.blendMode=l.blend;
     const items=row?.layers[kind]||[];
     if(kind==='streaks')updateRibbons(dst,items);
     else updateDust(dst,items);
    }
   }
   return last;
  }
  function configure(next){
   if(dead)throw Error('AIR-01 renderer destroyed');
   const updated=W.normalize(next),reallocate=cfg.quality!==updated.quality;
   cfg=updated;sync();
   if(reallocate)for(const owner of owners.values()){
    const layer=owner.layers.streaks;
    for(const p of layer.pool){p.mesh.removeFromParent();p.mesh.destroy()}
    layer.pool.length=0;
   }
   return cfg;
  }
  function currentBounds(){
   const out={inside:true,empty:true,minX:Infinity,minY:Infinity,
    maxX:-Infinity,maxY:-Infinity};
   if(!last)return out;
   for(const row of last.emitters)for(const kind of W.LAYERS){
    const a=anchors[row.id]?.[kind];if(!a?.origin)continue;
    const e=cfg.emitters.find(v=>v.id===row.id);
    if(!e?.enabled||!e.visible||!e.layers[kind].enabled||!e.layers[kind].visible)
     continue;
    const cs=Math.cos(a.angle),sn=Math.sin(a.angle);
    function add(x,y,r){
     const px=a.origin.x+x*cs-y*sn,py=a.origin.y+x*sn+y*cs;
     out.empty=false;out.minX=Math.min(out.minX,px-r);
     out.maxX=Math.max(out.maxX,px+r);
     out.minY=Math.min(out.minY,py-r);
     out.maxY=Math.max(out.maxY,py+r);
    }
    for(const obj of row.layers[kind]){
     if(kind==='streaks')for(let i=0;i<obj.positions.length;i+=2)
      add(obj.positions[i],obj.positions[i+1],1.5);
     else add(obj.x,obj.y,obj.radius+1);
    }
   }
   out.inside=out.empty||out.minX>=0&&out.minY>=0&&
    out.maxX<=512&&out.maxY<=512;
   return out;
  }
  function destroy(){
   if(dead)return;dead=true;
   owned.removeFromParent();owned.destroy({children:true});
   owners.clear();ribbonTexture.destroy(true);dustTexture.destroy(true);
  }
  return Object.freeze({seek,configure,currentBounds,resolveAnchor,
   setModel(next){model=next},destroy,
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return owned},
   get sceneSource(){return host},get emitters(){return owners},
   get anchors(){return anchors},get totalCreated(){return totalCreated},
   get totalUpdated(){return totalUpdated},get totalActive(){return totalActive}});
 }
 root.FxWindRuntime=Object.freeze({createWind});
})(globalThis);
