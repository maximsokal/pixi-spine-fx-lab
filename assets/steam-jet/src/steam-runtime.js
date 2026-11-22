// WATER-06 Steam Jet: three effect-owned native Pixi 8.22 particle layers.
// Procedural soft-vapor atlas shares one TextureSource per ParticleContainer.
// No shader, filter, external CDN, per-tick texture upload, or caller-owned destruction.
(function(root){
 'use strict';
 const DEG=Math.PI/180, SIZE=96, VARIANTS=4;
 function createSteam({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||host?.parent!==app.stage||
   host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
   throw TypeError('WATER-06 requires identity stage-owned host');
  if(typeof PIXI.ParticleContainer!=='function'||typeof PIXI.Particle!=='function')
   throw TypeError('WATER-06 requires pinned Pixi8.22 native particles');
  const Core=root.FxSteam;
  if(!Core)throw Error('Load Steam numerical core before renderer');
  let cfg=Core.normalize(settings),dead=false,last=null,diagnostics=null;
  let totalCreated=0,totalActive=0,atlasUploads=0;
  const owned=new PIXI.Container(),owners=new Map(),anchors={};
  owned.label='WATER-06 Steam Jet (owned only)';app.stage.addChild(owned);
  const atlases={};
  function mask(layer,variant,r,x,y,softness){
   const angle=Math.atan2(y,x),
    lobes=1+.09*Math.sin(3*angle+variant*1.3)+
      .055*Math.cos(7*angle-variant*.7);
   const nr=r/lobes;
   if(nr>=1)return 0;
   const feather=.035+softness*.67;
   const falloff=Math.max(0,Math.min(1,(1-nr)/feather));
   const smooth=falloff*falloff*(3-2*falloff);
   const density=layer==='wisps'?.62:layer==='droplets'?.9:.95;
   const flecks=1-.12*softness*Math.sin(x*6+variant)*Math.cos(y*7-variant);
   return Math.max(0,Math.min(1,density*smooth*flecks));
  }
  function paintAtlas(record,layer,softness){
   const {ctx,canvas}=record,bitmap=ctx.createImageData(canvas.width,canvas.height);
   for(let variant=0;variant<VARIANTS;variant++)
    for(let py=0;py<SIZE;py++)for(let px=0;px<SIZE;px++){
     const x=(px+.5-SIZE/2)/(SIZE/2),y=(py+.5-SIZE/2)/(SIZE/2);
     const alpha=mask(layer,variant,Math.hypot(x,y),x,y,softness);
     const at=(py*canvas.width+variant*SIZE+px)*4;
     bitmap.data[at]=255;bitmap.data[at+1]=255;bitmap.data[at+2]=255;
     bitmap.data[at+3]=Math.round(alpha*255);
    }
   ctx.putImageData(bitmap,0,0);
   if(record.source){record.source.update();atlasUploads++}
  }
  for(const name of Core.LAYERS){
   const canvas=document.createElement('canvas');
   canvas.width=SIZE*VARIANTS;canvas.height=SIZE;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Steam procedural atlas canvas unavailable');
   const record={canvas,ctx,source:null,frames:[]};
   paintAtlas(record,name,cfg.softness);
   record.source=new PIXI.ImageSource({resource:canvas,
    alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
   record.frames=Array.from({length:VARIANTS},(_,i)=>new PIXI.Texture({
    source:record.source,frame:new PIXI.Rectangle(i*SIZE,0,SIZE,SIZE)}));
   atlases[name]=record;
  }
  const tint=v=>(Math.round(v[0])<<16)|(Math.round(v[1])<<8)|Math.round(v[2]);
  function addEmitter(e){
   const container=new PIXI.Container(),layers={};
   container.label='Steam '+e.id;
   for(const name of Core.LAYERS){
    const surface=new PIXI.Container();
    surface.label=e.id+'/'+name;
    const particles=new PIXI.ParticleContainer({dynamicProperties:{
     position:true,rotation:true,vertex:true,color:true,uvs:true}});
    particles.label='WATER-06 '+name+' native particles';
    surface.addChild(particles);container.addChild(surface);
    layers[name]={surface,particles,pool:[]};
   }
   owned.addChild(container);owners.set(e.id,{container,layers});
  }
  function sync(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,item] of owners)if(!ids.has(id)){
    item.container.removeFromParent();item.container.destroy({children:true});
    owners.delete(id);delete anchors[id];
   }
   for(const e of cfg.emitters)if(!owners.has(e.id))addEmitter(e);
  }
  sync();
  function updatePool(layer,items,name){
   const {pool,particles}=layer,active=particles.particleChildren.length;
   for(let i=active;i>items.length;i--)particles.removeParticle(pool[i-1]);
   for(let i=active;i<items.length;i++){
    if(i===pool.length){
     pool.push(new PIXI.Particle({texture:atlases[name].frames[0],
      x:0,y:0,scaleX:1,scaleY:1,anchorX:.5,anchorY:.5,
      tint:0xffffff,alpha:0}));
     totalCreated++;
    }
    particles.addParticle(pool[i]);
   }
   for(let i=0;i<items.length;i++){
    const p=pool[i],item=items[i];
    p.texture=atlases[name].frames[(item.variant||0)%VARIANTS];
    p.x=item.x;p.y=item.y;p.rotation=item.rotation||0;
    p.scaleX=item.width/SIZE;p.scaleY=item.height/SIZE;
    p.tint=tint(item.rgba);p.alpha=item.rgba[3];
   }
   if(items.length)particles.update();
   totalActive+=items.length;
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
     const att=slot.getAttachment?.();
     if(!att||att.name!==a.name||typeof att.computeWorldVertices!=='function')
      return null;
     let verts;
     try{
      if(typeof att.worldVerticesLength==='number'&&att.worldVerticesLength>1){
       verts=new Float32Array(Math.min(512,att.worldVerticesLength));
       att.computeWorldVertices(slot,0,verts.length,verts,0,2);
      }else{
       verts=new Float32Array(8);att.computeWorldVertices(slot,verts,0,2);
      }
     }catch{return null}
     let lx=Infinity,rx=-Infinity,ly=Infinity,ry=-Infinity;
     for(let i=0;i<verts.length;i+=2){
      lx=Math.min(lx,verts[i]);rx=Math.max(rx,verts[i]);
      ly=Math.min(ly,verts[i+1]);ry=Math.max(ry,verts[i+1]);
     }
     x=(lx+rx)/2;y=(ly+ry)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){x=bone.worldX;y=bone.worldY}
   if(a.space==='local')return fromSpine(x+bone.a*a.x+bone.b*a.y,
                                         y+bone.c*a.x+bone.d*a.y);
   const pos=fromSpine(x,y);
   return pos?{x:pos.x+a.x,y:pos.y+a.y}:null;
  }
  function computeAnchors(e){
   const out={},main=resolveAnchor(e.anchor);
   for(const name of Core.LAYERS){
    const layer=e.layers[name],a=layer.anchor;
    const origin=a.type==='inherit'?main:resolveAnchor(a);
    const rad=(e.anchor.rotation+e.rotation+(a.type==='inherit'?0:a.rotation))*DEG;
    out[name]={origin,angle:rad};
   }
   return out;
  }
  function seek(seconds){
   if(dead)throw Error('Steam renderer destroyed');
   sync();last=Core.sample(cfg,seconds);diagnostics=null;totalActive=0;
   for(const e of cfg.emitters){
    const item=owners.get(e.id),row=last.emitters.find(x=>x.id===e.id);
    item.container.visible=e.enabled&&e.visible&&!!row;
    if(!item.container.visible)continue;
    const resolved=computeAnchors(e);anchors[e.id]=resolved;
    for(const name of Core.LAYERS){
     const layer=item.layers[name],setting=e.layers[name],a=resolved[name];
     const enabled=setting.enabled&&setting.visible&&!!a.origin;
     layer.surface.visible=enabled;
     if(!enabled){
      if(setting.enabled&&setting.visible&&!a.origin)
       diagnostics=(diagnostics?diagnostics+'; ':'')+
        'Missing/inactive Steam anchor: '+e.id+'/'+name;
      updatePool(layer,[],name);continue;
     }
     layer.surface.position.set(a.origin.x+e.x,a.origin.y+e.y);
     layer.surface.rotation=a.angle;
     layer.surface.blendMode=setting.blend;
     updatePool(layer,row?.layers[name]||[],name);
    }
   }
   if(last.diagnostics.length)diagnostics=(diagnostics?diagnostics+'; ':'')+
    last.diagnostics.join('; ');
   return last;
  }
  function configure(input){
   if(dead)throw Error('Steam renderer destroyed');
   const next=Core.normalize(input),changeSoft=next.softness!==cfg.softness;
   cfg=next;sync();
   if(changeSoft)for(const name of Core.LAYERS)
    paintAtlas(atlases[name],name,cfg.softness);
   return cfg;
  }
  function currentBounds(){
   const out={empty:true,inside:true,minX:Infinity,maxX:-Infinity,
    minY:Infinity,maxY:-Infinity,topExits:0};
   if(!last)return out;
   for(const row of last.emitters){
    const e=cfg.emitters.find(x=>x.id===row.id);
    if(!e)continue;
    for(const name of Core.LAYERS){
     if(!e.layers[name].enabled||!e.layers[name].visible)continue;
     const a=anchors[row.id]?.[name];if(!a?.origin)continue;
     const cx=a.origin.x+e.x,cy=a.origin.y+e.y,
      cs=Math.cos(a.angle),sn=Math.sin(a.angle);
     for(const p of row.layers[name]){
      const x=cx+p.x*cs-p.y*sn,y=cy+p.x*sn+p.y*cs,
       r=Math.hypot(p.width,p.height)/2;
      if(y+r<=0){out.topExits++;continue}
      if(y-r<0)out.topExits++;
      out.empty=false;
      out.minX=Math.min(out.minX,x-r);
      out.maxX=Math.max(out.maxX,x+r);
      out.minY=Math.min(out.minY,Math.max(0,y-r));
      out.maxY=Math.max(out.maxY,y+r);
     }
    }
   }
   out.inside=out.empty||out.minX>=0&&out.minY>=0&&
    out.maxX<=512&&out.maxY<=512;
   return out;
  }
  function destroy(){
   if(dead)return;
   dead=true;owned.removeFromParent();owned.destroy({children:true});owners.clear();
   for(const entry of Object.values(atlases)){
    for(const frame of entry.frames)frame.destroy(false);
    entry.source.destroy();
   }
  }
  return Object.freeze({seek,configure,resolveAnchor,currentBounds,destroy,
   setModel(next){model=next},
   get sample(){return last},get settings(){return cfg},
   get diagnostics(){return diagnostics},get owned(){return owned},
   get sceneSource(){return host},get emitters(){return owners},
   get anchors(){return anchors},get totalCreated(){return totalCreated},
   get totalActive(){return totalActive},get atlasUploads(){return atlasUploads},
   get atlasSources(){return Object.values(atlases).map(x=>x.source.uid)}});
 }
 root.FxSteamRuntime=Object.freeze({createSteam});
})(globalThis);
