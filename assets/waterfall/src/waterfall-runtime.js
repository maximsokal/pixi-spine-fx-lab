// WATER-04: real PixiJS 8.22.0 reusable MeshSimple water ribbons
// and pooled ParticleContainer detached drops / sparse soft foam.
(function(root){
 'use strict';
 const DEG=Math.PI/180;
 function createWaterfall({PIXI,app,host,model=null,settings}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
    host.x!==0||host.y!==0||host.rotation!==0||
    host.scale.x!==1||host.scale.y!==1)
   throw TypeError('WATER-04 requires a stage-owned identity Spine source host');
  if(typeof PIXI.MeshSimple!=='function'||typeof PIXI.Particle!=='function'||
    typeof PIXI.ParticleContainer!=='function')
   throw TypeError('WATER-04 requires pinned Pixi8.22 native Mesh/Particle APIs');
  const W=root.FxWaterfall;
  let cfg=W.normalize(settings),dead=false,last=null,diagnostics=null,
   totalCreated=0,totalUpdated=0,totalActive=0;
  const wrapper=new PIXI.Container(),owners=new Map(),anchors={};
  wrapper.label='WATER-04 Waterfall owned-only stage tree';
  app.stage.addChild(wrapper);
  const tint=rgba=>(Math.round(rgba[0])<<16)|
    (Math.round(rgba[1])<<8)|Math.round(rgba[2]);
  function createTexture(width,height,draw){
   const c=document.createElement('canvas');c.width=width;c.height=height;
   const ctx=c.getContext('2d',{willReadFrequently:true});
   const image=ctx.createImageData(width,height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const rgba=draw(x/(width-1),y/(height-1)),idx=(y*width+x)*4;
    for(let k=0;k<4;k++)image.data[idx+k]=Math.max(0,
     Math.min(255,Math.round(rgba[k])));
   }
   ctx.putImageData(image,0,0);
   return new PIXI.Texture({source:new PIXI.ImageSource({resource:c,
    alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false})});
  }
  const paletteKey=c=>JSON.stringify([c.palette,c.style]);
  function ribbonTexture(c){
   const style=c.style==='natural'?[1,1,1]:
    c.style==='stylized'?[1.07,1.10,1.15]:[1.22,.84,1.24];
   return createTexture(256,32,(u,v)=>{
    const color=root.FxColors.sample(c.palette,u);
    const feather=Math.min(1,Math.max(0,Math.min(v/.18,(1-v)/.18)));
    const shimmer=.88+.12*Math.cos(2*Math.PI*u*5);
    return color.slice(0,3).map((x,i)=>x*style[i]*shimmer)
      .concat([255*feather*color[3]]);
   });
  }
  const dropTexture=createTexture(32,32,(u,v)=>{
   const x=(u-.5)*2,y=(v-.5)*2,r=Math.hypot(x,y);
   const opacity=Math.max(0,Math.min(1,(1-r)*3));
   return [255,255,255,opacity*255];
  });
  const foamTexture=createTexture(64,64,(u,v)=>{
   const x=(u-.5)*2,y=(v-.5)*2,r=Math.hypot(x,y),
    rim=Math.exp(-(((r-.59)/.24)**2))*.53,
    core=Math.max(0,(1-r)*.23);
   const a=r<1?Math.min(.65,rim+core):0;
   return [255,255,255,a*255];
  });
  let waterTexture=ribbonTexture(cfg),currentPalette=paletteKey(cfg);
  const MAX_SAMPLES={low:58,balanced:78,high:112};
  function makeRibbon(){
   const capacity=MAX_SAMPLES[cfg.quality],
    vertices=new Float32Array(capacity*4),
    uvs=new Float32Array(capacity*4),
    indices=new Uint16Array((capacity-1)*6),
    mesh=new PIXI.MeshSimple({texture:waterTexture,vertices,uvs,indices,
     topology:'triangle-list'});
   mesh.autoUpdate=false;mesh.visible=false;
   mesh.label='WATER-04 pooled path ribbon';
   totalCreated++;
   return {mesh,capacity,vertices,uvs,indices};
  }
  function addOwner(e){
   const container=new PIXI.Container(),layers={};
   for(const kind of W.LAYERS){
    const surface=new PIXI.Container();surface.label=e.id+'/'+kind;
    if(kind==='streams')layers[kind]={surface,pool:[],allocated:[]};
    else{
     const particles=new PIXI.ParticleContainer({dynamicProperties:{
      position:true,rotation:true,vertex:true,color:true}});
     surface.addChild(particles);
     layers[kind]={surface,particles,allocated:[]};
    }
    container.addChild(surface);
   }
   wrapper.addChild(container);owners.set(e.id,{container,layers});
  }
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,o] of owners)if(!ids.has(id)){
    o.container.removeFromParent();o.container.destroy({children:true});
    owners.delete(id);
   }
   for(const e of cfg.emitters)if(!owners.has(e.id))addOwner(e);
  }
  sync();
  function updateRibbon(layer,items){
   while(layer.pool.length<items.length){
    const p=makeRibbon();layer.pool.push(p);layer.surface.addChild(p.mesh);
   }
   for(let i=0;i<layer.pool.length;i++){
    const p=layer.pool[i],v=items[i];
    p.mesh.visible=!!v&&v.rgba[3]>0;
    if(!p.mesh.visible)continue;
    if(v.positions.length>p.vertices.length||v.uvs.length>p.uvs.length||
      v.indices.length>p.indices.length)
     throw RangeError('WATER-04 water ribbon exceeds preallocated GPU geometry');
    p.vertices.fill(0);p.uvs.fill(0);p.indices.fill(0);
    p.vertices.set(v.positions);p.uvs.set(v.uvs);p.indices.set(v.indices);
    p.mesh.geometry.getBuffer('aPosition').update();
    p.mesh.geometry.getBuffer('aUV').update();
    p.mesh.geometry.getIndex().update();
    p.mesh.alpha=v.rgba[3];p.mesh.tint=0xffffff;
    totalUpdated++;totalActive++;
   }
  }
  function updateParticles(layer,items,kind,l){
   const container=layer.particles,pool=layer.allocated;
   const active=container.particleChildren.length;
   for(let i=active;i>items.length;i--)container.removeParticle(pool[i-1]);
   for(let i=active;i<items.length;i++){
    if(i===pool.length){
     const particle=new PIXI.Particle({texture:kind==='fragments'?
      dropTexture:foamTexture,x:0,y:0,scaleX:1,scaleY:1,
      anchorX:.5,anchorY:.5,alpha:0,tint:0xffffff});
     pool.push(particle);totalCreated++;
    }
    container.addParticle(pool[i]);
   }
   for(let i=0;i<items.length;i++){
    const o=items[i],p=pool[i];
    p.x=o.x;p.y=o.y-(kind==='baseSprayFoam'&&l.anchor.type!=='inherit'?
      cfg.flowLength:0);
    p.rotation=o.rotation||0;
    // ParticleContainer scale is a multiplier of the texture dimensions,
    // not a desired pixel size (unlike rain's 1x1 Texture.WHITE).
    const textureSize=kind==='fragments'?32:64;
    p.scaleX=o.radius*2/textureSize;
    p.scaleY=o.radius*2/textureSize;
    p.alpha=o.rgba[3];p.tint=tint(o.rgba);
   }
   if(items.length)container.update();
   totalActive+=items.length;
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
   if(a.space==='local')return fromSpine(
    x+bone.a*a.x+bone.b*a.y,y+bone.c*a.x+bone.d*a.y);
   const p=fromSpine(x,y);
   return p?{x:p.x+a.x,y:p.y+a.y}:null;
  }
  function computeFrameAnchors(e){
   const main=resolveAnchor(e.anchor),
    angle=(e.rotation+e.anchor.rotation)*DEG,
    cs=Math.cos(angle),sn=Math.sin(angle),
    result={};
   for(const kind of W.LAYERS){
    const l=e.layers[kind],a=l.anchor;
    let origin=null;
    if(main&&['inherit','endpoint'].includes(a.type)){
     const along=kind==='baseSprayFoam'&&a.type==='endpoint'?
      cfg.flowLength:0;
     const x=e.x+l.x+a.x,y=e.y+l.y+a.y+along;
     origin={x:main.x+x*cs-y*sn,
      y:main.y+x*sn+y*cs};
    }else{
     const q=resolveAnchor(a);
     if(q){
      const x=e.x+l.x,y=e.y+l.y;
      origin={x:q.x+x*cs-y*sn,y:q.y+x*sn+y*cs};
     }
    }
    result[kind]={origin,angle:
     (e.rotation+l.rotation+(a.type==='inherit'||a.type==='endpoint'?
      e.anchor.rotation+a.rotation:a.rotation))*DEG};
   }
   return result;
  }
  function seek(seconds){
   if(dead)throw Error('WATER-04 renderer destroyed');
   sync();last=W.sample(cfg,seconds);diagnostics=null;totalActive=0;
   const live=new Set(last.emitters.map(x=>x.id));
   for(const e of cfg.emitters){
    const owner=owners.get(e.id),row=last.emitters.find(v=>v.id===e.id);
    owner.container.visible=e.enabled&&e.visible&&!!row;
    if(!owner.container.visible)continue;
    const positions=computeFrameAnchors(e);anchors[e.id]=positions;
    for(const kind of W.LAYERS){
     const target=owner.layers[kind],l=e.layers[kind],
      resolved=positions[kind],p=resolved.origin;
     target.surface.visible=l.enabled&&l.visible&&!!p;
     if(!p){
      if(l.enabled&&l.visible)
       diagnostics=(diagnostics?diagnostics+'; ':'')+
        'Missing/inactive waterfall anchor: '+e.id+'/'+kind;
      continue;
     }
     target.surface.position.set(p.x,p.y);
     target.surface.rotation=resolved.angle;
     target.surface.blendMode=l.blend;
     const items=row?.layers[kind]||[];
     if(kind==='streams')updateRibbon(target,items);
     else updateParticles(target,items,kind,l);
    }
   }
   return last;
  }
  function configure(input){
   if(dead)throw Error('WATER-04 renderer destroyed');
   const next=W.normalize(input),reallocate=next.quality!==cfg.quality,
    nextKey=paletteKey(next);
   cfg=next;sync();
   if(nextKey!==currentPalette){
    const old=waterTexture;waterTexture=ribbonTexture(next);
    for(const o of owners.values())for(const p of o.layers.streams.pool)
     p.mesh.texture=waterTexture;
    old.destroy(true);currentPalette=nextKey;
   }
   if(reallocate)for(const o of owners.values()){
    const layer=o.layers.streams;
    for(const p of layer.pool){
     p.mesh.removeFromParent();p.mesh.destroy();
    }
    layer.pool.length=0;
   }
   return cfg;
  }
  function currentBounds(){
   if(!last)return {inside:true,empty:true};
   const b={inside:true,empty:true,minX:Infinity,minY:Infinity,
    maxX:-Infinity,maxY:-Infinity};
   for(const row of last.emitters){
    for(const kind of W.LAYERS){
     const geo=anchors[row.id]?.[kind];if(!geo?.origin)continue;
     const C=Math.cos(geo.angle),S=Math.sin(geo.angle),
      add=(x,y,pad)=>{
       const px=geo.origin.x+x*C-y*S,py=geo.origin.y+x*S+y*C;
       b.empty=false;b.minX=Math.min(b.minX,px-pad);
       b.minY=Math.min(b.minY,py-pad);
       b.maxX=Math.max(b.maxX,px+pad);
       b.maxY=Math.max(b.maxY,py+pad);
      };
     for(const item of row.layers[kind]){
      if(kind==='streams'){
       for(let k=0;k<item.positions.length;k+=2)
        add(item.positions[k],item.positions[k+1],1.5);
      }else{
       const l=cfg.emitters.find(e=>e.id===row.id).layers[kind];
       add(item.x,item.y-(kind==='baseSprayFoam'&&
        l.anchor.type!=='inherit'?cfg.flowLength:0),item.radius+1);
      }
     }
    }
   }
   b.inside=b.empty||b.minX>=0&&b.minY>=0&&b.maxX<=512&&b.maxY<=512;
   return b;
  }
  function destroy(){
   if(dead)return;dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});
   owners.clear();waterTexture.destroy(true);dropTexture.destroy(true);
   foamTexture.destroy(true);
  }
  return Object.freeze({seek,configure,setModel(next){model=next},
   resolveAnchor,currentBounds,destroy,
   get settings(){return cfg},get sample(){return last},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get sceneSource(){return host},get emitters(){return owners},
   get anchors(){return anchors},get totalCreated(){return totalCreated},
   get totalUpdated(){return totalUpdated},get totalActive(){return totalActive}});
 }
 root.FxWaterfallRuntime=Object.freeze({createWaterfall});
})(globalThis);
