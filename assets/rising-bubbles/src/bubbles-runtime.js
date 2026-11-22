// WATER-05: native Pixi 8.22 ParticleContainer renderer, strict owner isolation.
// No shader dependencies, global mutable application state or per-frame texture creation.
(function(root){
 'use strict';
 const DEG=Math.PI/180;
 function createBubbles({PIXI,app,host,model=null,settings}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
   host.x!==0||host.y!==0||host.rotation!==0||host.scale.x!==1||
   host.scale.y!==1)throw TypeError('WATER-05 needs identity stage-owned Spine host');
  if(typeof PIXI.Particle!=='function'||typeof PIXI.ParticleContainer!=='function')
   throw TypeError('WATER-05 requires PixiJS 8.22 native particles');
  const B=root.FxBubbles;
  if(!B)throw Error('Load FxBubbles numerical core before runtime');
  let cfg=B.normalize(settings),last=null,diagnostics=null,dead=false;
  let totalCreated=0,totalActive=0,totalUpdated=0;
  const wrapper=new PIXI.Container(),owners=new Map(),anchors={};
  wrapper.label='WATER-05 Rising Bubbles owned stage';
  app.stage.addChild(wrapper);
  function makeTexture(fn){
   const size=64,canvas=document.createElement('canvas');
   canvas.width=canvas.height=size;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const bitmap=ctx.createImageData(size,size);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5-size/2)/(size/2),dy=(y+.5-size/2)/(size/2);
    const alpha=Math.max(0,Math.min(1,fn(dx,dy,Math.hypot(dx,dy))));
    const index=(y*size+x)*4;
    bitmap.data[index]=255;bitmap.data[index+1]=255;
    bitmap.data[index+2]=255;bitmap.data[index+3]=Math.round(alpha*255);
   }
   ctx.putImageData(bitmap,0,0);
   return new PIXI.Texture({source:new PIXI.ImageSource({resource:canvas,
    alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false})});
  }
  // Soft inner fill (partial), thin rim, a clipped arc highlight and a pop annulus.
  const textures={
   bubbles:makeTexture((x,y,r)=>r>=1?0:
    Math.min(.82,Math.exp(-(((r-.83)/.087)**2))*.68+
     .058*Math.max(0,1-r)+.11*Math.max(0,1-r/1.2))),
   highlights:makeTexture((x,y,r)=>{
    if(r>.99||r<.61)return 0;
    const angle=Math.atan2(y,x),angular=Math.exp(-(((angle+2.35)/.48)**2));
    return Math.exp(-(((r-.83)/.075)**2))*angular*.98;
   }),
   popRings:makeTexture((x,y,r)=>r>=1?0:
    Math.exp(-(((r-.86)/.063)**2))*.88)
  };
  const rgb=v=>(Math.round(v[0])<<16)|(Math.round(v[1])<<8)|Math.round(v[2]);
  function addEmitter(e){
   const container=new PIXI.Container(),layers={};
   for(const name of B.LAYERS){
    const surface=new PIXI.Container();
    surface.label=e.id+'/'+name;
    const particles=new PIXI.ParticleContainer({dynamicProperties:{
     position:true,rotation:true,vertex:true,color:true}});
    particles.label='WATER-05 native '+name+' particles';
    surface.addChild(particles);container.addChild(surface);
    layers[name]={surface,particles,pool:[]};
   }
   wrapper.addChild(container);
   owners.set(e.id,{container,layers});
  }
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,o] of owners)if(!ids.has(id)){
    o.container.removeFromParent();o.container.destroy({children:true});owners.delete(id);
   }
   for(const e of cfg.emitters)if(!owners.has(e.id))addEmitter(e);
  }
  sync();
  function updatePool(layer,items,name){
   const pool=layer.pool,particles=layer.particles;
   const active=particles.particleChildren.length;
   for(let i=active;i>items.length;i--)particles.removeParticle(pool[i-1]);
   for(let i=active;i<items.length;i++){
    if(i===pool.length){
     pool.push(new PIXI.Particle({texture:textures[name],x:0,y:0,
      scaleX:1,scaleY:1,anchorX:.5,anchorY:.5,alpha:0,tint:0xffffff}));
     totalCreated++;
    }
    particles.addParticle(pool[i]);
   }
   for(let i=0;i<items.length;i++){
    const item=items[i],p=pool[i];
    p.x=item.x;p.y=item.y;p.rotation=item.rotation||0;
    // Particle.scale is relative to its 64x64 texture, not pixel radius.
    p.scaleX=p.scaleY=2*item.radius/64;
    p.tint=rgb(item.rgba);p.alpha=item.rgba[3];
   }
   if(items.length)particles.update();
   totalUpdated+=items.length;totalActive+=items.length;
  }
  function fromSpine(x,y){
   if(!model?.worldTransform)return null;
   return model.worldTransform.apply({x,y},{x:0,y:0});
  }
  function resolveAnchor(a){
   if(a.type==='world')return {x:a.x,y:a.y};
   if(!model?.skeleton)return null;
   if(a.type==='skeleton')return fromSpine(a.x,a.y);
   const sk=model.skeleton;
   let bone=null,x=0,y=0;
   if(a.type==='bone')bone=sk.findBone(a.name);
   else{
    const slot=sk.findSlot(a.type==='attachment'?a.slot:a.name);
    if(!slot?.bone?.active)return null;
    bone=slot.bone;
    if(a.type==='attachment'){
     const att=slot.getAttachment?.();
     if(!att||att.name!==a.name||typeof att.computeWorldVertices!=='function')
      return null;
     let vertices;
     try{
      if(typeof att.worldVerticesLength==='number'&&att.worldVerticesLength>1){
       vertices=new Float32Array(Math.min(512,att.worldVerticesLength));
       att.computeWorldVertices(slot,0,vertices.length,vertices,0,2);
      }else{
       vertices=new Float32Array(8);
       att.computeWorldVertices(slot,vertices,0,2);
      }
     }catch{return null}
     let lx=Infinity,rx=-Infinity,ly=Infinity,ry=-Infinity;
     for(let i=0;i<vertices.length;i+=2){
      lx=Math.min(lx,vertices[i]);rx=Math.max(rx,vertices[i]);
      ly=Math.min(ly,vertices[i+1]);ry=Math.max(ry,vertices[i+1]);
     }
     x=(lx+rx)/2;y=(ly+ry)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY}
   if(a.space==='local')return fromSpine(
    x+bone.a*a.x+bone.b*a.y,y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);
   return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }
  function computeAnchors(e){
   const main=resolveAnchor(e.anchor),angle=(e.rotation+e.anchor.rotation)*DEG;
   const cs=Math.cos(angle),sn=Math.sin(angle),result={};
   for(const name of B.LAYERS){
    const layer=e.layers[name],a=layer.anchor;
    let origin=null;
    if(main&&a.type==='inherit'){
     const x=e.x+layer.x+a.x,y=e.y+layer.y+a.y;
     origin={x:main.x+x*cs-y*sn,y:main.y+x*sn+y*cs};
    }else{
     const position=resolveAnchor(a);
     if(position){
      const x=e.x+layer.x,y=e.y+layer.y;
      origin={x:position.x+x*cs-y*sn,y:position.y+x*sn+y*cs};
     }
    }
    result[name]={origin,angle:(e.rotation+layer.rotation+a.rotation+
     (a.type==='inherit'?e.anchor.rotation:0))*DEG};
   }
   return result;
  }
  function seek(seconds){
   if(dead)throw Error('WATER-05 renderer destroyed');
   sync();last=B.sample(cfg,seconds);diagnostics=null;totalActive=0;
   for(const e of cfg.emitters){
    const owner=owners.get(e.id),row=last.emitters.find(x=>x.id===e.id);
    owner.container.visible=e.enabled&&e.visible&&!!row;
    if(!owner.container.visible)continue;
    const resolved=computeAnchors(e);anchors[e.id]=resolved;
    for(const name of B.LAYERS){
     const layer=owner.layers[name],spec=e.layers[name],origin=resolved[name].origin;
     layer.surface.visible=spec.enabled&&spec.visible&&!!origin;
     if(!origin){
      if(spec.enabled&&spec.visible)
       diagnostics=(diagnostics?diagnostics+'; ':'')+
        'Missing/inactive bubbles anchor: '+e.id+'/'+name;
      continue;
     }
     layer.surface.position.set(origin.x,origin.y);
     layer.surface.rotation=resolved[name].angle;
     layer.surface.blendMode=spec.blend;
     updatePool(layer,row?.layers[name]||[],name);
    }
   }
   return last;
  }
  function configure(input){
   if(dead)throw Error('WATER-05 renderer destroyed');
   cfg=B.normalize(input);sync();return cfg;
  }
  function currentBounds(){
   const b={inside:true,empty:true,minX:Infinity,minY:Infinity,
    maxX:-Infinity,maxY:-Infinity,topExits:0};
   if(!last)return b;
   for(const row of last.emitters)for(const name of B.LAYERS){
    const geo=anchors[row.id]?.[name];
    if(!geo?.origin)continue;
    const cs=Math.cos(geo.angle),sn=Math.sin(geo.angle);
    for(const item of row.layers[name]){
     const x=geo.origin.x+item.x*cs-item.y*sn;
     const y=geo.origin.y+item.x*sn+item.y*cs;
     const radius=item.radius+1;
     if(y+radius<=0){b.topExits++;continue}
     // Intentional ascent through upper crop edge is an explicit lifecycle event.
     if(y-radius<0)b.topExits++;
     b.empty=false;
     b.minX=Math.min(b.minX,x-radius);
     b.maxX=Math.max(b.maxX,x+radius);
     b.minY=Math.min(b.minY,Math.max(0,y-radius));
     b.maxY=Math.max(b.maxY,y+radius);
    }
   }
   b.inside=b.empty||b.minX>=0&&b.maxX<=512&&b.minY>=0&&b.maxY<=512;
   return b;
  }
  function destroy(){
   if(dead)return;dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});owners.clear();
   for(const t of Object.values(textures))t.destroy(true);
  }
  return Object.freeze({seek,configure,resolveAnchor,currentBounds,destroy,
   setModel(next){model=next},
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get sceneSource(){return host},get emitters(){return owners},
   get anchors(){return anchors},get totalCreated(){return totalCreated},
   get totalUpdated(){return totalUpdated},get totalActive(){return totalActive}});
 }
 root.FxBubblesRuntime=Object.freeze({createBubbles});
})(globalThis);
