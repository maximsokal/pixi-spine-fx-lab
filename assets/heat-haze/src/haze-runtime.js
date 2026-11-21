// FIRE-06 bounded real refraction compositor with owned textures and explicit scene input.
// The ONLY sampled background is sceneSource (caller-owned); never framebuffer/DOM CSS.
// Real PixiJS v8 DisplacementFilter applied to a captured COPY then alpha-masked over ORIGINAL.
(function(root){
 'use strict';
 function createHaze({PIXI,app,host,model=null,settings,sceneSource=host}){
  if(!PIXI||!app?.renderer||!app?.stage||!host||
   host.parent!==app.stage||host.scale.x!==1||host.scale.y!==1||
   host.x!==0||host.y!==0||host.rotation!==0)
   throw TypeError('Haze needs identity-transform stage-owned source host');
  let cfg=root.FxHaze.normalize(settings),dead=false,last=null,diagnostic=null;
  const stage=app.stage;
  const previousRenderable=sceneSource.renderable;
  // Source isn't shown directly on the output stage. It is rendered at most
  // once per frame into an offscreen RenderTexture and copied to the overlay.
  sceneSource.renderable=false;
  const target=PIXI.RenderTexture.create({width:512,height:512,resolution:1,
   antialias:false});
  const mapCanvas=document.createElement('canvas'),
   maskCanvas=document.createElement('canvas'),
   glowCanvas=document.createElement('canvas');
  for(const c of [mapCanvas,maskCanvas,glowCanvas]){c.width=c.height=512}
  const contexts=[mapCanvas,maskCanvas,glowCanvas].map(c=>
   c.getContext('2d',{willReadFrequently:true}));
  if(contexts.some(c=>!c))throw Error('Haze canvas RGBA8 unsupported');
  const pixels=contexts.map(c=>c.createImageData(512,512));
  const mapTexture=PIXI.Texture.from(mapCanvas),
   maskTexture=PIXI.Texture.from(maskCanvas),
   glowTexture=PIXI.Texture.from(glowCanvas);
  const displacementSprite=new PIXI.Sprite(mapTexture);
  const filter=new PIXI.DisplacementFilter({sprite:displacementSprite,
   scale:{x:32,y:32},padding:32});
  const wrapper=new PIXI.Container();
  wrapper.label='FIRE-06 heat haze compositor';
  const original=new PIXI.Sprite(target),copy=new PIXI.Sprite(target),
   mask=new PIXI.Sprite(maskTexture),glow=new PIXI.Sprite(glowTexture);
  original.label='untouched captured background';
  copy.label='displaced background copy';
  mask.label='explicit alpha coverage matte';
  glow.label='independent optional heat glow';
  copy.filters=[filter];
  copy.setMask({mask,channel:'alpha'});
  glow.blendMode='normal';
  wrapper.addChild(original,copy,mask,glow);
  stage.addChild(wrapper);
  let captureCount=0;
  const anchors={};
  function fromSpine(x,y){
   if(!model)return null;
   const v=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:v.x,y:v.y};
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
     const attachment=slot.getAttachment?.();
     if(!attachment||attachment.name!==a.name||
      typeof attachment.computeWorldVertices!=='function')return null;
     let vertices;
     try{
      if(typeof attachment.worldVerticesLength==='number'&&attachment.worldVerticesLength>1){
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
     px=(minX+maxX)/2;py=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){px=bone.worldX;py=bone.worldY}
   if(a.space==='local')
    return fromSpine(px+bone.a*a.x+bone.b*a.y,py+bone.c*a.x+bone.d*a.y);
   const pos=fromSpine(px,py);
   return pos?{x:pos.x+a.x,y:pos.y+a.y}:null;
  }
  function capture(){
   if(!sceneSource||!sceneSource.children?.length){
    diagnostic='NO REFRACTION INPUT: explicit Pixi sceneSource is empty';
    original.visible=false;copy.visible=false;return false;
   }
   const v=sceneSource.renderable;
   try{
    sceneSource.renderable=true;
    app.renderer.render({container:sceneSource,target,clear:true});
    captureCount++;
   }finally{sceneSource.renderable=v}
   original.visible=true;copy.visible=true;
   return true;
  }
  function upload(data){
   const values=[data.map,data.mask,data.glow];
   for(let i=0;i<3;i++){
    pixels[i].data.set(values[i]);
    contexts[i].putImageData(pixels[i],0,0);
   }
   // CanvasSource.update() marks the existing GPU texture dirty without
   // allocating a texture/sprite every animated frame.
   mapTexture.source.update();
   maskTexture.source.update();
   glowTexture.source.update();
  }
  function seek(seconds){
   if(dead)throw Error('Haze runtime destroyed');
   diagnostic=null;
   for(const e of cfg.emitters)anchors[e.id]=resolveAnchor(e);
   last=root.FxHaze.rasterize(cfg,seconds,anchors);
   upload(last);
   const sourceAvailable=capture();
   const effectActive=cfg.emitters.some(e=>e.layers.refraction.enabled&&
    e.layers.refraction.visible&&e.layers.refraction.alpha>0&&e.enabled&&e.visible);
   copy.visible=sourceAvailable&&effectActive&&cfg.amplitude>0&&
    last.changedPixels>0;
   glow.visible=last.glow.some((v,i)=>i%4===3&&v>0);
   // Sprite is a separate effect resource; glow tint is already authored in its
   // straight RGBA CanvasSource and must not be manually premultiplied.
   const blends=cfg.emitters.filter(e=>e.enabled&&e.visible&&
    e.layers.thermalGlow.enabled&&e.layers.thermalGlow.visible);
   glow.blendMode=blends.some(e=>e.layers.thermalGlow.blend==='add')?'add':'normal';
   if(last.state.missing.length)
    diagnostic=(diagnostic?diagnostic+'; ':'')+'Missing/inactive anchors: '+
     last.state.missing.join(',');
   if(last.state.caps.length)
    diagnostic=(diagnostic?diagnostic+'; ':'')+last.state.caps.join('; ');
   return last;
  }
  function configure(input){
   if(dead)throw Error('Haze runtime destroyed');
   cfg=root.FxHaze.normalize(input);return cfg;
  }
  function setModel(next){model=next}
  function bounds(){
   if(!last)return {empty:true,inside:true};
   const gs=last.state.geometries;
   if(!gs.length)return {empty:true,inside:true};
   const b={minX:Math.min(...gs.map(x=>x.fullBounds.minX)),
    minY:Math.min(...gs.map(x=>x.fullBounds.minY)),
    maxX:Math.max(...gs.map(x=>x.fullBounds.maxX)),
    maxY:Math.max(...gs.map(x=>x.fullBounds.maxY))};
   return {...b,empty:false,inside:b.minX>=0&&b.minY>=0&&
    b.maxX<=512&&b.maxY<=512};
  }
  function isolate(kind){
   if(!['composite','glow','original'].includes(kind))
    throw TypeError('Haze invalid isolated output');
   const old=[original.visible,copy.visible,glow.visible];
   if(kind==='glow'){
    original.visible=false;copy.visible=false;glow.visible=true;
   }else if(kind==='original'){
    original.visible=true;copy.visible=false;glow.visible=false;
   }else{
    original.visible=old[0];copy.visible=old[1];glow.visible=old[2];
   }
   return ()=>{original.visible=old[0];copy.visible=old[1];glow.visible=old[2]};
  }
  function destroy(){
   if(dead)return;dead=true;
   sceneSource.renderable=previousRenderable;
   copy.filters=[];copy.mask=null;
   wrapper.removeFromParent();wrapper.destroy({children:true});
   filter.destroy();displacementSprite.destroy();
   mapTexture.destroy(true);maskTexture.destroy(true);glowTexture.destroy(true);
   target.destroy(true);
  }
  return Object.freeze({seek,configure,setModel,bounds,isolate,destroy,resolveAnchor,
   get snapshot(){return last},get settings(){return cfg},
   get diagnostic(){return diagnostic},get captureCount(){return captureCount},
   get owned(){return wrapper},get mapCanvas(){return mapCanvas},
   get maskCanvas(){return maskCanvas},get glowCanvas(){return glowCanvas},
   get output(){return {original,copy,mask,glow,filter,displacementSprite}},
   get sceneSource(){return sceneSource}});
 }
 root.FxHazeRuntime=Object.freeze({createHaze});
})(globalThis);
