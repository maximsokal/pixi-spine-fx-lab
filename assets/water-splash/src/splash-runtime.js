// WATER-01 owned bounded PixiJS v8 renderer for the shared FxSplash numerical source.
(function(root){
 'use strict';
 function createSplash({PIXI,app,host,model=null,settings}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
   host.x!==0||host.y!==0||host.rotation!==0||
   host.scale.x!==1||host.scale.y!==1)
   throw TypeError('WATER-01 requires a stage-owned identity-transform host');
  const DEG=Math.PI/180;
  let cfg=root.FxSplash.normalize(settings),dead=false,last=null,diagnostics=null;
  const stage=app.stage,wrapper=new PIXI.Container(),owned=new Map(),anchors={};
  wrapper.label='WATER-01 splash owned rendering only';
  stage.addChild(wrapper);
  const color=rgba=>(Math.round(rgba[0])<<16)|
   (Math.round(rgba[1])<<8)|Math.round(rgba[2]);
  function draw(g,primitives){
   g.clear();
   for(const item of primitives){
    if(!item.rgba||item.rgba[3]<=0)continue;
    if(item.kind==='circle'&&item.radius>.05)
     g.circle(item.x,item.y,item.radius).fill({
      color:color(item.rgba),alpha:item.rgba[3]});
    else if(item.kind==='ring'&&item.radius>0)
     g.circle(item.x,item.y,item.radius).stroke({
      color:color(item.rgba),alpha:item.rgba[3],width:item.thickness});
   }
  }
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,obj] of owned){
    if(ids.has(id))continue;
    obj.container.removeFromParent();
    obj.container.destroy({children:true});owned.delete(id);
   }
   for(const e of cfg.emitters){
    if(owned.has(e.id))continue;
    const container=new PIXI.Container(),layers={};
    container.label='WATER-01 '+e.id;
    for(const kind of root.FxSplash.LAYERS){
     const l=new PIXI.Container();l.label=kind+' independent layer';
     if(kind!=='crown')l.addChild(new PIXI.Graphics());
     layers[kind]=l;container.addChild(l);
    }
    wrapper.addChild(container);owned.set(e.id,{container,layers});
   }
  }
  sync();
  function fromSpine(x,y){
   if(!model)return null;
   const pt=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:pt.x,y:pt.y};
  }
  function resolveAnchor(e){
   const a=e.anchor;
   if(a.type==='world')return {x:a.x,y:a.y};
   if(!model?.skeleton)return null;
   const sk=model.skeleton;
   if(a.type==='skeleton')return fromSpine(a.x,a.y);
   let bone=null,px=0,py=0;
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
       vertices=new Float32Array(8);att.computeWorldVertices(slot,vertices,0,2);
      }
     }catch{return null}
     let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
     for(let i=0;i<vertices.length;i+=2){
      minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);
      minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);
     }
     px=(minX+maxX)/2;py=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){px=bone.worldX;py=bone.worldY}
   if(a.space==='local')
    return fromSpine(px+bone.a*a.x+bone.b*a.y,py+bone.c*a.x+bone.d*a.y);
   const base=fromSpine(px,py);
   return base?{x:base.x+a.x,y:base.y+a.y}:null;
  }
  function seek(seconds){
   if(dead)throw Error('WATER-01 runtime destroyed');
   last=root.FxSplash.sample(cfg,seconds);
   diagnostics=null;sync();
   const activeIDs=new Set(last.emitters.map(x=>x.id));
   for(const [id,owner] of owned){
    if(!activeIDs.has(id)){
     owner.container.visible=false;
     for(const l of Object.values(owner.layers)){
      for(const sprite of l.removeChildren())sprite.destroy({children:true});
     }
     for(const kind of root.FxSplash.LAYERS)
      if(kind!=='crown')owner.layers[kind].addChild(new PIXI.Graphics());
    }
   }
   for(const entry of last.emitters){
    const e=cfg.emitters.find(x=>x.id===entry.id),owner=owned.get(entry.id);
    const origin=resolveAnchor(e);
    anchors[e.id]=origin;
    owner.container.visible=!!origin&&e.enabled&&e.visible;
    if(!origin){
     diagnostics=(diagnostics?diagnostics+'; ':'')+'Missing/inactive splash anchor: '+e.id;
     continue;
    }
    const theta=(e.anchor.rotation+e.rotation)*DEG;
    owner.container.position.set(
     origin.x+e.x*Math.cos(theta)-e.y*Math.sin(theta),
     origin.y+e.x*Math.sin(theta)+e.y*Math.cos(theta));
    owner.container.rotation=theta;
    for(const kind of root.FxSplash.LAYERS){
     const lcfg=e.layers[kind],surface=owner.layers[kind];
     surface.position.set(lcfg.x,lcfg.y);
     surface.rotation=lcfg.rotation*DEG;
     surface.blendMode=lcfg.blend;
     surface.visible=lcfg.enabled&&lcfg.visible;
     if(kind==='crown'){
      for(const old of surface.removeChildren())old.destroy({children:true});
      for(const item of entry.layers[kind]){
       if(item.kind!=='mesh'||item.indices.length<3||item.rgba[3]<=0)continue;
       const geometry=new PIXI.MeshGeometry({positions:item.positions,
        uvs:item.uvs,indices:item.indices,topology:'triangle-list'});
       const mesh=new PIXI.Mesh({geometry,texture:PIXI.Texture.WHITE,
        tint:color(item.rgba),alpha:item.rgba[3]});
       mesh.label='continuous real FxPath ribbon';
       surface.addChild(mesh);
      }
     }else{
      let g=surface.children[0];
      if(!g){g=new PIXI.Graphics();surface.addChild(g)}
      draw(g,entry.layers[kind]);
     }
    }
   }
   return last;
  }
  function configure(next){
   if(dead)throw Error('WATER-01 runtime destroyed');
   cfg=root.FxSplash.normalize(next);sync();return cfg;
  }
  function setModel(next){model=next}
  function currentBounds(){
   if(!last)return {empty:true,inside:true};
   return root.FxSplash.bounds(last,anchors,cfg);
  }
  function destroy(){
   if(dead)return;dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});
   owned.clear();
  }
  return Object.freeze({seek,configure,setModel,resolveAnchor,currentBounds,destroy,
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get emitters(){return owned},get sceneSource(){return host}});
 }
 root.FxSplashRuntime=Object.freeze({createSplash});
})(globalThis);
