// WATER-02 bounded PixiJS 8.22.0 ParticleContainer Rainfall renderer.
// Particle objects and GPU ownership persist across seek/scroll/export.
(function(root){
 'use strict';
 function createRain({PIXI,app,host,model=null,settings}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
   host.x!==0||host.y!==0||host.rotation!==0||
   host.scale.x!==1||host.scale.y!==1)
   throw TypeError('WATER-02 requires stage-owned identity host');
  if(typeof PIXI.Particle!=='function'||typeof PIXI.ParticleContainer!=='function')
   throw Error('WATER-02 requires supported PixiJS 8 ParticleContainer');
  const DEG=Math.PI/180;
  let cfg=root.FxRain.normalize(settings),dead=false,last=null,diagnostics=null,
   totalCreated=0,totalActive=0;
  const wrapper=new PIXI.Container(),owned=new Map(),anchors={};
  wrapper.label='WATER-02 Rainfall own stage tree only';
  app.stage.addChild(wrapper);
  const tint=rgba=>(Math.round(rgba[0])<<16)|
   (Math.round(rgba[1])<<8)|Math.round(rgba[2]);
  function addOwner(e){
   const container=new PIXI.Container(),layers={};
   container.label='WATER-02 '+e.id;
   for(const kind of root.FxRain.LAYERS){
    const surface=new PIXI.Container();surface.label=kind;
    if(kind==='impacts'){
     const draw=new PIXI.Graphics();surface.addChild(draw);
     layers[kind]={surface,draw,particles:null,allocated:[]};
    }else{
     const particles=new PIXI.ParticleContainer({dynamicProperties:{
      position:true,rotation:true,vertex:true,color:true}});
     surface.addChild(particles);
     layers[kind]={surface,particles,allocated:[]};
    }
    container.addChild(surface);
   }
   wrapper.addChild(container);
   owned.set(e.id,{container,layers});
  }
  function sync(){
   const valid=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,obj] of owned){
    if(valid.has(id))continue;
    obj.container.removeFromParent();
    obj.container.destroy({children:true});owned.delete(id);
   }
   for(const e of cfg.emitters)if(!owned.has(e.id))addOwner(e);
  }
  sync();
  function fromSpine(x,y){
   if(!model?.worldTransform)return null;
   const p=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:p.x,y:p.y};
  }
  function resolveAnchor(e){
   const a=e.anchor;
   if(a.type==='world')return {x:a.x,y:a.y};
   if(!model?.skeleton)return null;
   if(a.type==='skeleton')return fromSpine(a.x,a.y);
   let bone=null,x=0,y=0;
   if(a.type==='bone')bone=model.skeleton.findBone(a.name);
   else{
    const slot=model.skeleton.findSlot(a.type==='attachment'?a.slot:a.name);
    if(!slot?.bone?.active)return null;
    bone=slot.bone;
    if(a.type==='attachment'){
     const attachment=slot.getAttachment?.();
     if(!attachment||attachment.name!==a.name||
      typeof attachment.computeWorldVertices!=='function')return null;
     let vertices;
     try{
      if(typeof attachment.worldVerticesLength==='number'&&
       attachment.worldVerticesLength>1){
       vertices=new Float32Array(Math.min(512,attachment.worldVerticesLength));
       attachment.computeWorldVertices(slot,0,vertices.length,vertices,0,2);
      }else{
       vertices=new Float32Array(8);
       attachment.computeWorldVertices(slot,vertices,0,2);
      }
     }catch{return null}
     let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
     for(let i=0;i<vertices.length;i+=2){
      minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);
      minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);
     }
     x=(minX+maxX)/2;y=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY}
   if(a.space==='local')
    return fromSpine(x+bone.a*a.x+bone.b*a.y,y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);
   return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }
  function applyParticles(layer,items){
   const container=layer.particles,pool=layer.allocated;
   const active=container.particleChildren.length;
   for(let i=active;i>items.length;i--)container.removeParticle(pool[i-1]);
   for(let i=active;i<items.length;i++){
    if(i===pool.length){
     const part=new PIXI.Particle({
      texture:PIXI.Texture.WHITE,x:0,y:0,
      scaleX:1,scaleY:1,anchorX:.5,anchorY:.5,
      alpha:0,tint:0xffffff});
     pool.push(part);totalCreated++;
    }
    container.addParticle(pool[i]);
   }
   for(let i=0;i<items.length;i++){
    const item=items[i],p=pool[i];
    p.x=item.x;p.y=item.y;
    p.scaleX=item.width;p.scaleY=item.length;
    p.rotation=item.rotation;
    p.tint=tint(item.rgba);p.alpha=item.rgba[3];
   }
   totalActive+=items.length;
   // Dynamic positions, vertices, tint and alpha are opted in on the container.
   // The explicit update also accommodates static anchor or texture changes.
   container.update();
  }
  function seek(seconds){
   if(dead)throw Error('WATER-02 renderer destroyed');
   sync();
   diagnostics=null;
   for(const e of cfg.emitters)anchors[e.id]=resolveAnchor(e);
   last=root.FxRain.sample(cfg,seconds,anchors);
   const activeIDs=new Set(last.emitters.map(x=>x.id));
   totalActive=0;
   for(const [id,owner] of owned){
    if(!activeIDs.has(id)){
     owner.container.visible=false;
     for(const kind of root.FxRain.LAYERS){
      const layer=owner.layers[kind];
      if(kind==='impacts')layer.draw.clear();
      else applyParticles(layer,[]);
     }
    }
   }
   for(const entry of last.emitters){
    const e=cfg.emitters.find(v=>v.id===entry.id),
     owner=owned.get(entry.id),origin=anchors[e.id];
    owner.container.visible=!!origin&&e.enabled&&e.visible;
    if(!origin){
     diagnostics=(diagnostics?diagnostics+'; ':'')+
      'Missing/inactive rain anchor: '+e.id;
     continue;
    }
    const angle=(e.rotation+e.anchor.rotation)*DEG;
    owner.container.position.set(
     origin.x+e.x*Math.cos(angle)-e.y*Math.sin(angle),
     origin.y+e.x*Math.sin(angle)+e.y*Math.cos(angle));
    owner.container.rotation=angle;
    for(const kind of root.FxRain.LAYERS){
     const l=e.layers[kind],ownedLayer=owner.layers[kind],
      view=ownedLayer.surface;
     view.position.set(l.x,l.y);
     view.rotation=l.rotation*DEG;
     view.visible=l.enabled&&l.visible;
     view.blendMode=l.blend;
     if(kind!=='impacts')applyParticles(ownedLayer,entry.layers[kind]);
     else{
      const g=ownedLayer.draw;g.clear();
      for(const hit of entry.layers.impacts){
       if(hit.rgba[3]<=0||hit.radius<=0)continue;
       g.circle(hit.x,hit.y,hit.radius).stroke({
        color:tint(hit.rgba),alpha:hit.rgba[3],width:hit.thickness});
      }
     }
    }
   }
   return last;
  }
  function configure(next){
   if(dead)throw Error('WATER-02 renderer destroyed');
   cfg=root.FxRain.normalize(next);sync();return cfg;
  }
  function setModel(next){model=next}
  function currentBounds(){
   return last?root.FxRain.bounds(last,anchors,cfg):
    {empty:true,inside:true,horizontalInside:true};
  }
  function destroy(){
   if(dead)return;
   dead=true;wrapper.removeFromParent();
   wrapper.destroy({children:true});owned.clear();
  }
  return Object.freeze({configure,seek,setModel,resolveAnchor,currentBounds,destroy,
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get sceneSource(){return host},get emitters(){return owned},
   get totalCreated(){return totalCreated},
   get totalActive(){return totalActive}});
 }
 root.FxRainRuntime=Object.freeze({createRain});
})(globalThis);
