// GAME-05 native Pixi 8.22 renderer. Geometry and emission timing belong to FxShockwave.
(function(root){
 'use strict';
 const KINDS=['primary','secondary','particles'],SEGMENTS=96,DEG=Math.PI/180;
 function createShockwave({PIXI,host,settings}){
  if(!PIXI||typeof PIXI.MeshSimple!=='function'||!host||host.destroyed)
   throw TypeError('GAME-05 requires a live Pixi 8.22 host');
  const S=root.FxShockwave;
  let plan=S.createPlan(settings),dead=false,last=null,seconds=0,totalCreated=0,poses={};
  const wrapper=new PIXI.Container(),owners=new Map();
  wrapper.label='GAME-05 shockwave';
  const textures=[];
  function texture(w,h,alpha){
   const c=document.createElement('canvas');c.width=w;c.height=h;
   const ctx=c.getContext('2d'),p=ctx.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    p.data[i]=p.data[i+1]=p.data[i+2]=255;p.data[i+3]=alpha(x,y);
   }
   ctx.putImageData(p,0,0);
   const t=new PIXI.Texture({source:new PIXI.ImageSource({
    resource:c,alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false})});
   textures.push(t);return t;
  }
  let ringTexture,dotTexture;
  function clearOwners(){
   for(const owner of owners.values()){
    for(const layer of Object.values(owner.layers)){
     for(const view of layer.pool){
      view.removeFromParent();const geometry=layer.kind==='particles'?null:view.geometry;
      view.destroy();geometry?.destroy();
     }
    }
    owner.container.removeFromParent();owner.container.destroy({children:true});
   }
   owners.clear();
  }
  function destroy(){
   if(dead)return;dead=true;
   clearOwners();wrapper.removeFromParent();wrapper.destroy({children:true});
   for(const t of textures)t.destroy(true);textures.length=0;
  }
  try{
   // Texel-center UVs reproduce the four alpha bands from annulus().
   ringTexture=texture(4,2,x=>x===0||x===3?0:255);
   dotTexture=texture(8,8,(x,y)=>Math.round(255*Math.max(0,1-Math.hypot((x-3.5)/4,(y-3.5)/4))));
   host.addChild(wrapper);
  }catch(error){destroy();throw error}
  function ownerFor(id){
   if(owners.has(id))return owners.get(id);
   const container=new PIXI.Container(),layers={};
   container.label=id;
   for(const kind of KINDS){
    const surface=new PIXI.Container();surface.label=kind;
    container.addChild(surface);layers[kind]={kind,surface,pool:[]};
   }
   wrapper.addChild(container);const owner={container,layers};owners.set(id,owner);return owner;
  }
  function newRing(item){
   const m=S.annulus(item,SEGMENTS),uv=new Float32Array(m.positions.length);
   for(let i=0;i<m.alphas.length;i++){
    uv[i*2]=((i%4)+.5)/4;uv[i*2+1]=.5;
   }
   const mesh=new PIXI.MeshSimple({texture:ringTexture,vertices:new Float32Array(m.positions),
    uvs:uv,indices:new Uint32Array(m.indices),topology:'triangle-list'});
   mesh.autoUpdate=false;return mesh;
  }
  function newDot(){
   const sprite=new PIXI.Sprite(dotTexture);sprite.anchor.set(.5);
   sprite.width=4;sprite.height=4;return sprite;
  }
  function color(rgba){
   return (Math.round(rgba[0])<<16)|(Math.round(rgba[1])<<8)|Math.round(rgba[2]);
  }
  function paint(layer,items){
   for(let i=0;i<layer.pool.length;i++)layer.pool[i].visible=i<items.length;
   for(let i=0;i<items.length;i++){
    const item=items[i],dot=layer.kind==='particles';
    let view=layer.pool[i];
    if(!view){
     view=dot?newDot():newRing(item);layer.pool.push(view);layer.surface.addChild(view);totalCreated++;
    }else if(!dot){
     view.vertices.set(S.annulus(item,SEGMENTS).positions);
     view.geometry.getBuffer('aPosition').update();
    }
    if(dot)view.position.set(item.x,item.y);
    view.tint=color(item.rgba);view.alpha=item.rgba[3];view.visible=true;
   }
  }
  function seek(t,nextPoses=poses){
   if(dead)throw Error('GAME-05 renderer destroyed');
   const snapshot=Object.fromEntries(Object.entries(nextPoses).map(([k,p])=>[k,p?{...p}:null])),next=plan.sample(t,snapshot);
   for(const row of next.emitters){
    const owner=ownerFor(row.id);
    for(const kind of KINDS){
     const layer=owner.layers[kind],transform=row.resolved[kind];
     layer.surface.visible=!!transform;
     if(transform){
      layer.surface.position.set(transform.x,transform.y);
      layer.surface.rotation=transform.rotation*DEG;
      layer.surface.scale.set(transform.scale);
     }
     paint(layer,row.layers[kind]);
    }
   }
   last=next;seconds=t;poses=snapshot;return last;
  }
  function configure(next){
   if(dead)throw Error('GAME-05 renderer destroyed');
   // Validate the complete numerical plan before touching live resources.
   const compiled=S.createPlan(next);
   // An explicit configuration change may change the distribution and budget.
   // Drop old pools so repeated configurations cannot accumulate hidden meshes.
   clearOwners();plan=compiled;seek(seconds);return plan.settings;
  }
  return Object.freeze({seek,configure,destroy,get owned(){return wrapper},
   get settings(){return plan.settings},get sample(){return last},get totalCreated(){return totalCreated}});
 }
 root.FxShockwaveRuntime=Object.freeze({createShockwave});
})(globalThis);
