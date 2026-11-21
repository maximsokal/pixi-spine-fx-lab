// FIRE-01 PixiJS 8 runtime. Renders the same FxTorch sample used by preview and bake.
(function(root){
 'use strict';
 function createTorch({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage)
   throw Error('Torch requires a stage-owned identity-transform host');
  if(host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
   throw Error('Torch host must be identity; transform Spine under host');
  let cfg=root.FxTorch.normalize(settings),dead=false,last=null,diagnostic=null;
  const layers={};const stage=app.stage;
  const wrap=new PIXI.Container();
  wrap.label='FX Torch (owned)';
  for(const key of ['glow','tongues','core','embers']){
   const graphics=new PIXI.Graphics();graphics.label='FX Torch '+key;
   layers[key]=graphics;wrap.addChild(graphics);
  }
  stage.addChild(wrap);
  const worldFromSpine=(x,y)=>{
   if(!model)return null;
   const out=model.worldTransform.apply({x,y},{x:0,y:0});
   return {x:out.x+worldOffset.x,y:out.y+worldOffset.y};
  };
  function resolveAnchor(){
   const a=cfg.anchor;
   if(a.type==='world')return {x:a.x+worldOffset.x,y:a.y+worldOffset.y};
   if(!model?.skeleton)return null;
   const skeleton=model.skeleton;
   if(a.type==='skeleton')return worldFromSpine(a.x,a.y);
   let bone=null,px=0,py=0;
   if(a.type==='bone')bone=skeleton.findBone(a.name);
   else{
    const slot=skeleton.findSlot(a.type==='attachment'?a.slot:a.name);
    if(!slot||!slot.bone?.active)return null;
    bone=slot.bone;
    if(a.type==='attachment'){
     const att=slot.getAttachment?.();
     if(!att||att.name!==a.name||typeof att.computeWorldVertices!=='function')return null;
     let verts;
     try{
      if(typeof att.worldVerticesLength==='number'&&att.worldVerticesLength>1){
       verts=new Float32Array(Math.min(512,att.worldVerticesLength));
       att.computeWorldVertices(slot,0,verts.length,verts,0,2);
      }else{
       verts=new Float32Array(8);att.computeWorldVertices(slot,verts,0,2);
      }
     }catch{return null;}
     let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
     for(let i=0;i<verts.length;i+=2){
      minX=Math.min(minX,verts[i]);minY=Math.min(minY,verts[i+1]);
      maxX=Math.max(maxX,verts[i]);maxY=Math.max(maxY,verts[i+1]);
     }
     px=(minX+maxX)/2;py=(minY+maxY)/2;
    }
   }
   if(!bone?.active)return null;
   if(a.type!=='attachment'){px=bone.worldX;py=bone.worldY;}
   if(a.space==='local')return worldFromSpine(px+bone.a*a.x+bone.b*a.y,
                                    py+bone.c*a.x+bone.d*a.y);
   const pos=worldFromSpine(px,py);
   return pos?{x:pos.x+a.x,y:pos.y+a.y}:null;
  }
  function draw(g,primitives){
   g.clear();
   for(const p of primitives){
    const rgb=(Math.round(p.rgba[0])<<16)|(Math.round(p.rgba[1])<<8)|Math.round(p.rgba[2]);
    const alpha=p.rgba[3];
    if(alpha<=0)continue;
    if(p.kind==='poly'){
     if(p.points.length<3)continue;
     g.poly(p.points.flat(),true).fill({color:rgb,alpha});
    }else if(p.kind==='circle')g.circle(p.x,p.y,p.radius).fill({color:rgb,alpha});
    else if(p.kind==='ellipse')g.ellipse(p.x,p.y,p.rx,p.ry).fill({color:rgb,alpha});
   }
  }
  function seek(seconds){
   if(dead)throw Error('Torch runtime destroyed');
   const anchor=resolveAnchor();
   diagnostic=anchor?null:'Torch anchor missing or inactive: '+cfg.anchor.type+'/'+cfg.anchor.name;
   wrap.visible=!!anchor;
   if(!anchor){Object.values(layers).forEach(g=>g.clear());last=null;return null;}
   wrap.position.set(anchor.x,anchor.y);
   wrap.rotation=cfg.anchor.rotation*Math.PI/180;
   last=root.FxTorch.sample(cfg,seconds);
   for(const [key,g] of Object.entries(layers)){
    draw(g,last.layers[key]);
    g.blendMode=cfg.layers[key].blend;
   }
   return last;
  }
  function configure(next){
   if(dead)throw Error('Torch runtime destroyed');
   cfg=root.FxTorch.normalize(next);
   return cfg;
  }
  function destroy(){
   if(dead)return;
   dead=true;stage.removeChild(wrap);wrap.destroy({children:true});
  }
  return {seek,configure,destroy,resolveAnchor,get settings(){return cfg},
   get diagnostics(){return diagnostic},get sample(){return last},
   get owned(){return wrap}};
 }
 root.FxTorchRuntime=Object.freeze({createTorch});
})(globalThis);
