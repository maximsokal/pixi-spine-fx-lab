// FIRE-04 — PixiJS 8 rendering adapter: owns effect containers, never the caller's Spine.
(function(root){
 'use strict';
 function createEmbers({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage)
   throw Error('Embers requires a stage-owned identity host');
  if(host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
   throw Error('Embers host must have identity transform');
  let cfg=root.FxEmbers.normalize(settings),dead=false,last=null,diagnostics=null;
  const stage=app.stage,wrapper=new PIXI.Container(),owned=new Map(),anchors={};
  wrapper.label='FIRE-04 owned multi-emitter';
  stage.addChild(wrapper);
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,obj] of owned)if(!ids.has(id)){
    wrapper.removeChild(obj.container);obj.container.destroy({children:true});owned.delete(id);
   }
   for(const e of cfg.emitters){
    if(owned.has(e.id))continue;
    const container=new PIXI.Container(),layers={};
    container.label='Embers '+e.id;
    for(const key of root.FxEmbers.LAYERS){
     const g=new PIXI.Graphics();g.label=e.id+' '+key;
     layers[key]=g;container.addChild(g);
    }
    owned.set(e.id,{container,layers});wrapper.addChild(container);
   }
  }
  sync();
  function fromSpine(x,y){
   if(!model)return null;
   const output=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:output.x+worldOffset.x,y:output.y+worldOffset.y};
  }
  function resolveAnchor(e){
   const a=e.anchor;
   if(a.type==='world')return {x:a.x+worldOffset.x,y:a.y+worldOffset.y};
   if(!model?.skeleton)return null;
   const skeleton=model.skeleton;
   if(a.type==='skeleton')return fromSpine(a.x,a.y);
   let bone=null,px=0,py=0;
   if(a.type==='bone')bone=skeleton.findBone(a.name);
   else{
    const slot=skeleton.findSlot(a.type==='attachment'?a.slot:a.name);
    if(!slot||!slot.bone?.active)return null;
    bone=slot.bone;
    if(a.type==='attachment'){
     const att=slot.getAttachment?.();
     if(!att||att.name!==a.name||typeof att.computeWorldVertices!=='function')return null;
     let vertices;
     try{
      if(typeof att.worldVerticesLength==='number'&&att.worldVerticesLength>1){
       vertices=new Float32Array(Math.min(512,att.worldVerticesLength));
       att.computeWorldVertices(slot,0,vertices.length,vertices,0,2);
      }else{vertices=new Float32Array(8);att.computeWorldVertices(slot,vertices,0,2)}
     }catch{return null}
     let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
     for(let i=0;i<vertices.length;i+=2){
      minX=Math.min(minX,vertices[i]);minY=Math.min(minY,vertices[i+1]);
      maxX=Math.max(maxX,vertices[i]);maxY=Math.max(maxY,vertices[i+1]);
     }
     px=(minX+maxX)/2;py=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){px=bone.worldX;py=bone.worldY}
   if(a.space==='local')return fromSpine(px+bone.a*a.x+bone.b*a.y,
                                          py+bone.c*a.x+bone.d*a.y);
   const pt=fromSpine(px,py);
   return pt?{x:pt.x+a.x,y:pt.y+a.y}:null;
  }
  function draw(g,primitives){
   g.clear();
   for(const p of primitives){
    const rgb=(Math.round(p.rgba[0])<<16)|(Math.round(p.rgba[1])<<8)|Math.round(p.rgba[2]);
    const alpha=p.rgba[3];
    if(alpha<=0)continue;
    if(p.kind==='circle'&&p.radius>.01)
     g.circle(p.x,p.y,p.radius).fill({color:rgb,alpha});
    else if(p.kind==='poly'&&p.points.length>=3)
     g.poly(p.points.flat(),true).fill({color:rgb,alpha});
   }
  }
  function seek(seconds){
   if(dead)throw Error('Embers runtime destroyed');
   last=root.FxEmbers.sample(cfg,seconds);
   diagnostics=null;sync();
   // Seek after the one-shot endpoint must not leave stale Pixi drawings.
   const activeIds=new Set(last.emitters.map(e=>e.id));
   for(const [id,o] of owned)if(!activeIds.has(id)){
    o.container.visible=false;
    Object.values(o.layers).forEach(g=>g.clear());
   }
   for(const output of last.emitters){
    const e=cfg.emitters.find(x=>x.id===output.id),o=owned.get(output.id);
    const anchor=resolveAnchor(e);
    anchors[e.id]=anchor;
    o.container.visible=!!anchor&&e.enabled&&e.visible;
    if(!anchor){
     if(e.enabled&&e.visible)diagnostics='Embers anchor missing/inactive: '+e.id+' / '+e.anchor.type+'/'+e.anchor.name;
     Object.values(o.layers).forEach(g=>g.clear());continue;
    }
    const a=e.anchor.rotation*Math.PI/180;
    const dx=e.x*Math.cos(a)-e.y*Math.sin(a),
          dy=e.x*Math.sin(a)+e.y*Math.cos(a);
    o.container.position.set(anchor.x+dx,anchor.y+dy);
    o.container.rotation=a;
    for(const [key,g] of Object.entries(o.layers)){
     draw(g,output.layers[key]);g.blendMode=e.layers[key].blend;
    }
   }
   if(last.diagnostics.length)diagnostics=last.diagnostics.join('; ');
   return last;
  }
  function configure(next){
   if(dead)throw Error('Embers runtime destroyed');
   cfg=root.FxEmbers.normalize(next);sync();return cfg;
  }
  function currentBounds(){
   if(!last)return {empty:true,inside:false};
   return root.FxEmbers.bounds(last,anchors,cfg);
  }
  function destroy(){
   if(dead)return;dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});owned.clear();
  }
  return {seek,configure,destroy,resolveAnchor,currentBounds,
   get settings(){return cfg},get diagnostics(){return diagnostics},
   get sample(){return last},get owned(){return wrapper},get emitters(){return owned}};
 }
 root.FxEmbersRuntime=Object.freeze({createEmbers});
})(globalThis);
