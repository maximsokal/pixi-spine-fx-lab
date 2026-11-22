// WATER-03: pooled Pixi 8.22 elliptical annulus MeshSimple renderer.
// One shared 1D soft radial-alpha strip, stable vertex/index buffers, no
// Graphics.clear() or per-frame mesh/context creation.
(function(root){
 'use strict';
 function createRipples({PIXI,app,host,model=null,settings}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
    host.x!==0||host.y!==0||host.rotation!==0||
    host.scale.x!==1||host.scale.y!==1)
   throw TypeError('WATER-03 requires stage-owned identity host');
  if(typeof PIXI.MeshSimple!=='function')
   throw TypeError('WATER-03 requires native PixiJS 8.22 MeshSimple');
  const R=root.FxRipples,DEG=Math.PI/180;
  let cfg=R.normalize(settings),dead=false,last=null,
   diagnostics=null,totalCreated=0,totalUpdates=0;
  const wrapper=new PIXI.Container(),owners=new Map(),anchors={};
  wrapper.label='WATER-03 independent ripples only';
  app.stage.addChild(wrapper);
  // Some WebGPU drivers ignore dynamic MeshSimple tint updates. The actual
  // artist palette is encoded in this reusable 2D age x radial alpha ramp,
  // while mesh alpha carries ring/layer/seed + palette stop alpha. This
  // remains the same renderer source in preview, bake and developer handoff.
  const paletteKey=x=>JSON.stringify([x.palette,x.style]);
  function newPaletteTexture(settings){
   const image=document.createElement('canvas');
   image.width=32;image.height=128;
   const ctx=image.getContext('2d',{willReadFrequently:true});
   const pixels=ctx.createImageData(image.width,image.height);
   const style=settings.style==='natural'?[1,1,1]:
    settings.style==='stylized'?[1.03,1.14,1.19]:[1.19,.91,1.32];
   for(let y=0;y<image.height;y++){
    const age=y/(image.height-1),
     rgba=root.FxColors.sample(settings.palette,age);
    for(let x=0;x<image.width;x++){
     const t=x/(image.width-1),
      edge=Math.min(1,Math.max(0,Math.min(t/.2,(1-t)/.2)));
     const i=(y*image.width+x)*4;
     for(let c=0;c<3;c++)pixels.data[i+c]=Math.min(255,Math.round(rgba[c]*style[c]));
     pixels.data[i+3]=Math.round(edge*255);
    }
   }
   ctx.putImageData(pixels,0,0);
   return new PIXI.Texture({source:new PIXI.ImageSource({
    resource:image,alphaMode:'premultiply-alpha-on-upload',
    autoGenerateMipmaps:false})});
  }
  let currentPaletteKey=paletteKey(cfg),
   featherTexture=newPaletteTexture(cfg);
  const newOwner=e=>{
   const container=new PIXI.Container(),layers={};
   for(const kind of R.LAYERS){
    const surface=new PIXI.Container();
    surface.label='WATER-03 '+e.id+' '+kind;
    container.addChild(surface);
    layers[kind]={surface,pool:[]};
   }
   wrapper.addChild(container);
   owners.set(e.id,{container,layers});
  };
  function sync(){
   const valid=new Set(cfg.emitters.map(x=>x.id));
   for(const [id,owner] of owners)if(!valid.has(id)){
    owner.container.removeFromParent();
    owner.container.destroy({children:true});owners.delete(id);
   }
   for(const e of cfg.emitters)if(!owners.has(e.id))newOwner(e);
  }
  sync();
  const indexMap=new Map();
  function geometry(segments){
   if(indexMap.has(segments))return indexMap.get(segments);
   const uv=new Float32Array((segments+1)*8),indices=new Uint32Array(segments*18);
   for(let j=0;j<=segments;j++)for(let k=0;k<4;k++){
    const n=j*4+k;
    uv[n*2]=[0,.25,.75,1][k];uv[n*2+1]=.5;
   }
   for(let j=0;j<segments;j++)for(let k=0;k<3;k++){
    const a=j*4+k,b=a+4,at=(j*3+k)*6;
    indices.set([a,b,a+1,b,b+1,a+1],at);
   }
   const entry={uv,indices};indexMap.set(segments,entry);return entry;
  }
  function makeMesh(kind){
   const segments=kind==='highlights'?1:R.BUDGETS[cfg.quality].segments,
    info=geometry(segments),positions=new Float32Array((segments+1)*8);
   const mesh=new PIXI.MeshSimple({
    texture:featherTexture,vertices:positions,
    uvs:new Float32Array(info.uv),indices:info.indices,
    topology:'triangle-list'});
   mesh.autoUpdate=false;mesh.visible=false;mesh.label=kind;
   totalCreated++;return {mesh,kind,segments,positions,uvs:mesh.geometry.uvs};
  }
  function placeRing(pool,item){
   const N=pool.segments,thick=Math.max(0,item.thickness),
    feather=Math.max(.6,Math.min(1.5,thick*.4)),
    offsets=[-thick/2-feather,-thick/2,thick/2,thick/2+feather],
    out=pool.positions,rx=item.radiusX,ry=item.radiusY;
   for(let j=0;j<=N;j++){
    const a=j/N*2*Math.PI,cs=Math.cos(a),sn=Math.sin(a);
    const x=rx*cs,y=ry*sn;
    const nx=rx>1e-9?cs/rx:cs,ny=ry>1e-9?sn/ry:sn,
      length=Math.hypot(nx,ny)||1;
    for(let k=0;k<4;k++){
     const offset=offsets[k];
     const scale=Math.max(0,Math.hypot(x,y)+offset)/
       Math.max(1e-10,Math.hypot(x,y)+offset);
     const n=(j*4+k)*2;
     out[n]=(x+nx/length*offset)*scale;
     out[n+1]=(y+ny/length*offset)*scale;
    }
   }
  }
  function placeHighlight(pool,item){
   const a=item.angle,dx=Math.cos(a)*item.length*.5,
    dy=Math.sin(a)*item.length*.5,
    nx=-Math.sin(a),ny=Math.cos(a);
   const thick=Math.max(.5,item.width),feather=.65,
    offsets=[-thick/2-feather,-thick/2,thick/2,thick/2+feather];
   for(let j=0;j<2;j++){
    const x=item.x+(j?dx:-dx),y=item.y+(j?dy:-dy);
    for(let k=0;k<4;k++){
     const n=(j*4+k)*2;
     pool.positions[n]=x+nx*offsets[k];
     pool.positions[n+1]=y+ny*offsets[k];
    }
   }
  }
  function paint(layer,items,kind){
   while(layer.pool.length<items.length){
    const p=makeMesh(kind);
    layer.pool.push(p);layer.surface.addChild(p.mesh);
   }
   for(let i=0;i<layer.pool.length;i++){
    const p=layer.pool[i],item=items[i];
    p.mesh.visible=!!item&&item.rgba[3]>0;
    if(!p.mesh.visible)continue;
    if(kind==='highlights')placeHighlight(p,item);
    else placeRing(p,item);
    p.mesh.geometry.getBuffer('aPosition').update();
    for(let u=1;u<p.uvs.length;u+=2)p.uvs[u]=item.age;
    p.mesh.geometry.getBuffer('aUV').update();
    totalUpdates++;
    p.mesh.tint=0xffffff; // RGB comes from the age-lookup texture on every backend.
    p.mesh.alpha=item.rgba[3];
   }
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
     if(!att||att.name!==a.name||
        typeof att.computeWorldVertices!=='function')return null;
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
   if(a.space==='local')
    return fromSpine(x+bone.a*a.x+bone.b*a.y,
     y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);
   return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }
  function seek(seconds){
   if(dead)throw Error('WATER-03 renderer destroyed');
   sync();last=R.sample(cfg,seconds);diagnostics=null;
   for(const e of cfg.emitters){
    if(!e.enabled||!e.visible)continue;
    const origin=resolveAnchor(e.anchor);
    anchors[e.id]={};
    const owner=owners.get(e.id);owner.container.visible=true;
    const row=last.emitters.find(x=>x.id===e.id);
    for(const kind of R.LAYERS){
     const l=e.layers[kind],layer=owner.layers[kind],a=l.anchor;
     let center;
     if(a.type==='inherit'&&origin){
      const rot=(e.rotation+e.anchor.rotation)*DEG;
      const x=e.x+l.x+a.x,y=e.y+l.y+a.y;
      center={x:origin.x+x*Math.cos(rot)-y*Math.sin(rot),
       y:origin.y+x*Math.sin(rot)+y*Math.cos(rot)};
     }else if(a.type==='inherit')center=null;
     else{
      const p=resolveAnchor(a);
      const rot=(e.rotation+a.rotation)*DEG;
      const x=e.x+l.x,y=e.y+l.y;
      center=p?{x:p.x+x*Math.cos(rot)-y*Math.sin(rot),
       y:p.y+x*Math.sin(rot)+y*Math.cos(rot)}:null;
     }
     anchors[e.id][kind]=center;
     layer.surface.visible=!!center&&l.enabled&&l.visible;
     if(!center){
      if(l.enabled&&l.visible)
       diagnostics=(diagnostics?diagnostics+'; ':'')+
        'Missing/inactive ripple anchor: '+e.id+'/'+kind;
      continue;
     }
     layer.surface.position.set(center.x,center.y);
     layer.surface.rotation=(e.rotation+l.rotation+
       (a.type==='inherit'?e.anchor.rotation+a.rotation:a.rotation))*DEG;
     layer.surface.blendMode=l.blend;
     paint(layer,row?.layers[kind]||[],kind);
    }
   }
   for(const [id,owner] of owners){
    if(cfg.emitters.some(e=>e.id===id&&e.enabled&&e.visible))continue;
    owner.container.visible=false;
   }
   return last;
  }
  function configure(next){
   if(dead)throw Error('WATER-03 renderer destroyed');
   const changed=next.quality!==cfg.quality;
   const normalized=R.normalize(next),nextPaletteKey=paletteKey(normalized);
   cfg=normalized;sync();
   if(nextPaletteKey!==currentPaletteKey){
    const old=featherTexture;
    featherTexture=newPaletteTexture(cfg);
    for(const owner of owners.values())for(const layer of Object.values(owner.layers))
     for(const item of layer.pool)item.mesh.texture=featherTexture;
    old.destroy(true);currentPaletteKey=nextPaletteKey;
   }
   if(changed)for(const owner of owners.values())
    for(const [kind,layer] of Object.entries(owner.layers)){
     // Segment-count change is explicit authoring action, not per-frame churn.
     for(const item of layer.pool){
      item.mesh.removeFromParent();item.mesh.destroy();
     }
     layer.pool.length=0;
    }
   return cfg;
  }
  function currentBounds(){return last?R.bounds(last,cfg,anchors):
   {inside:true,empty:true}};
  function destroy(){
   if(dead)return;dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});
   featherTexture.destroy(true);owners.clear();
  }
  return Object.freeze({seek,configure,
   setModel(next){model=next},
   resolveAnchor,currentBounds,destroy,
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get emitters(){return owners},get sceneSource(){return host},
   get anchors(){return anchors},
   get totalCreated(){return totalCreated},
   get totalUpdates(){return totalUpdates}});
 }
 root.FxRipplesRuntime=Object.freeze({createRipples});
})(globalThis);
