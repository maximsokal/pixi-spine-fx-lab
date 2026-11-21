// FIRE-05 PixiJS v8 owned pooled soft-sprite render adapter.
// All alpha texture generation is one-time per runtime; no 60fps retessellation of smoke.
(function(root){
 'use strict';
 function createSmoke({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage||
    host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
   throw Error('Smoke requires identity-transform stage-owned host');
  let cfg=root.FxSmoke.normalize(settings),dead=false,last=null,diagnostics=null;
  const wrapper=new PIXI.Container(),stage=app.stage,owned=new Map(),anchors={};
  wrapper.label='FIRE-05 Smoke (owned)';
  stage.addChild(wrapper);
  // Four RGBA8 masks with zero-alpha border and bounded, irregular organic shapes.
  // White RGB is kept even where alpha is zero; Pixi applies straight tint+alpha.
  function makeMask(variant){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Smoke alpha-mask canvas unsupported');
   const data=ctx.createImageData(96,96);
   for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const px=(x+.5-48)/43,py=(y+.5-48)/43;
    const angle=Math.atan2(py,px),r=Math.hypot(px,py);
    const lobes=1+.11*Math.sin(3*angle+variant*1.37)+
     .08*Math.sin(5*angle-variant*.83)+.035*Math.cos(9*angle+variant*.9);
    const nr=r/lobes;
    const base=Math.max(0,Math.min(1,(.96-nr)/.69));
    const envelope=base*base*(3-2*base);
    // Additional high-frequency center variation, not a hard opacity boundary.
    const mottled=Math.min(1,Math.max(.1,.85+.09*Math.sin(px*11+variant*2)*
     Math.cos(py*10-variant)));
    const offset=(y*96+x)*4;
    data.data[offset]=255;data.data[offset+1]=255;data.data[offset+2]=255;
    data.data[offset+3]=Math.round(Math.min(1,envelope*mottled)*255);
   }
   ctx.putImageData(data,0,0);
   const texture=PIXI.Texture.from(canvas);
   return {canvas,texture};
  }
  const masks=Array.from({length:4},(_,i)=>makeMask(i));
  function ensure(){
   const ids=new Set(cfg.emitters.map(e=>e.id));
   for(const [id,record] of owned)if(!ids.has(id)){
    wrapper.removeChild(record.container);record.container.destroy({children:true});
    owned.delete(id);delete anchors[id];
   }
   for(const e of cfg.emitters)if(!owned.has(e.id)){
    const container=new PIXI.Container(),layers={};
    container.label='Smoke '+e.id;
    for(const k of root.FxSmoke.LAYERS){
     const layer=new PIXI.Container();layer.label=e.id+' '+k;
     container.addChild(layer);
     layers[k]={container:layer,pool:[],ash:new PIXI.Graphics()};
     if(k==='ash')layer.addChild(layers[k].ash);
    }
    owned.set(e.id,{container,layers});wrapper.addChild(container);
   }
  }
  ensure();
  function fromSpine(x,y){
   if(!model)return null;
   const at=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:at.x+worldOffset.x,y:at.y+worldOffset.y};
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
     let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
     for(let i=0;i<verts.length;i+=2){
      minX=Math.min(minX,verts[i]);minY=Math.min(minY,verts[i+1]);
      maxX=Math.max(maxX,verts[i]);maxY=Math.max(maxY,verts[i+1]);
     }
     px=(minX+maxX)/2;py=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){px=bone.worldX;py=bone.worldY}
   if(a.space==='local')return fromSpine(px+bone.a*a.x+bone.b*a.y,
                                          py+bone.c*a.x+bone.d*a.y);
   const pos=fromSpine(px,py);
   return pos?{x:pos.x+a.x,y:pos.y+a.y}:null;
  }
  function drawGroup(layer,primitives,settings){
   const {container,pool,ash}=layer;ash.clear();
   container.blendMode=settings.blend;
   let count=0;
   for(const p of primitives){
    if(p.kind==='ash'){
     const rgba=p.rgba,hex=(Math.round(rgba[0])<<16)|
      (Math.round(rgba[1])<<8)|Math.round(rgba[2]);
     if(p.radius>0&&rgba[3]>0)ash.circle(p.x,p.y,p.radius)
      .fill({color:hex,alpha:rgba[3]});
     continue;
    }
    if(p.kind!=='puff'||p.rgba[3]<=0)continue;
    let sprite=pool[count];
    if(!sprite){
     sprite=new PIXI.Sprite(masks[p.variant%4].texture);
     sprite.anchor.set(.5);
     sprite.label='smoke reusable sprite';
     pool.push(sprite);container.addChild(sprite);
    }
    sprite.texture=masks[p.variant%4].texture;
    sprite.position.set(p.x,p.y);
    sprite.width=p.width;sprite.height=p.height;
    sprite.rotation=p.rotation;
    sprite.tint=(Math.round(p.rgba[0])<<16)|(Math.round(p.rgba[1])<<8)|
      Math.round(p.rgba[2]);
    sprite.alpha=p.rgba[3];sprite.visible=true;
    count++;
   }
   for(let i=count;i<pool.length;i++)pool[i].visible=false;
  }
  function seek(seconds){
   if(dead)throw Error('Smoke runtime destroyed');
   last=root.FxSmoke.sample(cfg,seconds);
   diagnostics=null;ensure();
   const active=new Set(last.emitters.map(x=>x.id));
   for(const [id,r] of owned)if(!active.has(id)){
    r.container.visible=false;
    for(const group of Object.values(r.layers))drawGroup(group,[],{blend:'normal'});
   }
   for(const result of last.emitters){
    const emitter=cfg.emitters.find(e=>e.id===result.id),
     record=owned.get(emitter.id),anchor=resolveAnchor(emitter);
    anchors[emitter.id]=anchor;
    record.container.visible=!!anchor&&emitter.enabled&&emitter.visible;
    if(!anchor&&emitter.enabled&&emitter.visible)
     diagnostics='Smoke anchor missing/inactive: '+emitter.id+'/'+emitter.anchor.type+
      '/'+emitter.anchor.name;
    if(anchor){
     const a=emitter.anchor.rotation*Math.PI/180,
       ox=emitter.x*Math.cos(a)-emitter.y*Math.sin(a),
       oy=emitter.x*Math.sin(a)+emitter.y*Math.cos(a);
     record.container.position.set(anchor.x+ox,anchor.y+oy);
     record.container.rotation=a;
    }
    for(const key of root.FxSmoke.LAYERS)
     drawGroup(record.layers[key],anchor?result.layers[key]:[],
      emitter.layers[key]);
   }
   if(last.diagnostics.length)diagnostics=last.diagnostics.join('; ');
   return last;
  }
  function configure(next){
   if(dead)throw Error('Smoke runtime destroyed');
   cfg=root.FxSmoke.normalize(next);ensure();return cfg;
  }
  function currentBounds(){
   if(!last)return {empty:true,inside:false};
   return root.FxSmoke.bounds(last,anchors,cfg);
  }
  function destroy(){
   if(dead)return;
   dead=true;
   wrapper.removeFromParent();wrapper.destroy({children:true});
   owned.clear();
   for(const m of masks)m.texture.destroy(true);
  }
  return {seek,configure,destroy,resolveAnchor,currentBounds,
   get sample(){return last},get settings(){return cfg},
   get diagnostics(){return diagnostics},get owned(){return wrapper},
   get emitters(){return owned},get masks(){return masks}};
 }
 root.FxSmokeRuntime=Object.freeze({createSmoke});
})(globalThis);
