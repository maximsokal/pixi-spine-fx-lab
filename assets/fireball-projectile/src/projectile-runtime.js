// FIRE-03 PixiJS 8 render adapter. Owns only its effect containers.
(function(root){
 'use strict';
 function createProjectile({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  if(!PIXI||!app?.stage||!host||host.parent!==app.stage)
   throw Error('Projectile requires a stage-owned identity-transform host');
  if(host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
   throw Error('Projectile host must be identity');
  let cfg=root.FxProjectile.normalize(settings),dead=false,last=null,diagnostic=null;
  const layers={},wrap=new PIXI.Container(),stage=app.stage;
  wrap.label='FX Projectile (owned)';
  for(const key of ['haze','embers','ribbon','sparks','core']){
   const graphics=new PIXI.Graphics();graphics.label='FX Projectile '+key;
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
    if(p.kind==='ribbon'){
     const v=p.positions;
     // Renderer-neutral FxPath numeric vertices consumed as connected filled quads.
     // No unbounded per-frame MeshGeometry allocations or orphaned filters.
     for(let i=0;i+7<v.length;i+=4)
      g.poly([v[i],v[i+1],v[i+2],v[i+3],
       v[i+6],v[i+7],v[i+4],v[i+5]],true).fill({color:rgb,alpha});
    }else if(p.kind==='poly'){
     if(p.points.length>=3)g.poly(p.points.flat(),true).fill({color:rgb,alpha});
    }else if(p.kind==='circle')
     g.circle(p.x,p.y,p.radius).fill({color:rgb,alpha});
    else if(p.kind==='ring')
     g.circle(p.x,p.y,p.radius).stroke({color:rgb,alpha,width:p.width});
    else if(p.kind==='rect'){
     const c=Math.cos(p.rotation),s=Math.sin(p.rotation),w=p.w/2,h=p.h/2;
     const pts=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>
      [p.x+x*c-y*s,p.y+x*s+y*c]);
     g.poly(pts.flat(),true).fill({color:rgb,alpha});
    }
   }
  }
  function seek(seconds){
   if(dead)throw Error('Projectile runtime destroyed');
   const anchor=resolveAnchor();
   diagnostic=anchor?null:'Projectile anchor missing or inactive: '+cfg.anchor.type+'/'+cfg.anchor.name;
   wrap.visible=!!anchor;
   if(!anchor){Object.values(layers).forEach(g=>g.clear());last=null;return null}
   wrap.position.set(anchor.x,anchor.y);
   wrap.rotation=cfg.anchor.rotation*Math.PI/180;
   last=root.FxProjectile.sample(cfg,seconds);
   for(const [key,g] of Object.entries(layers)){
    draw(g,last.layers[key]);
    g.blendMode=cfg.layers[key].blend;
   }
   return last;
  }
  function configure(next){if(dead)throw Error('Projectile runtime destroyed');
   cfg=root.FxProjectile.normalize(next);return cfg}
  function currentBounds(){
   if(!last||!wrap.visible)return {empty:true,inside:false};
   return root.FxProjectile.bounds(last,{x:wrap.x,y:wrap.y},wrap.rotation);
  }
  function destroy(){if(dead)return;dead=true;stage.removeChild(wrap);wrap.destroy({children:true})}
  return {seek,configure,destroy,resolveAnchor,currentBounds,
   get settings(){return cfg},get diagnostics(){return diagnostic},
   get sample(){return last},get owned(){return wrap}};
 }
 root.FxProjectileRuntime=Object.freeze({createProjectile});
})(globalThis);
