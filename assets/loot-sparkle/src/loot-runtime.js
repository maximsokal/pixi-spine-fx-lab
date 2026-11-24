// GAME-12 T02: native Pixi 8.22 drawing of the compiled Loot plan.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxLoot||(typeof require==='function'?require('./loot-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLootRuntime=api;
})(globalThis,function(L){
 'use strict';
 const ORDER=['halo','sweep','stars'],HALO_STEPS=12;
 const color=rgba=>(Math.round(rgba[0])<<16)|(Math.round(rgba[1])<<8)|Math.round(rgba[2]);
 function createLoot({PIXI,host,settings}){
  if(!L||!PIXI||typeof PIXI.Container!=='function'||typeof PIXI.Graphics!=='function'||!host||host.destroyed)throw TypeError('GAME-12 requires live Pixi host and FxLoot');
  let plan=L.compile(settings),dead=false,seconds=0,poses={},last=null,current=null,totalCreated=0;
  const wrapper=new PIXI.Container();wrapper.label='GAME-12 loot';
  function release(tree){if(!tree)return;tree.root.removeFromParent();tree.root.destroy({children:true});}
  // Preallocate the actual per-emitter peak; never allocate graphics while seeking.
  function makeTree(p){
   const root=new PIXI.Container();root.label='loot plan';const rows=new Map();
   try{
    for(let i=0;i<p.settings.emitters.length;i++){
     const e=p.settings.emitters[i],owner=new PIXI.Container(),layers={};owner.label=e.id;root.addChild(owner);
     for(const k of ORDER){
      const l=e.layers[k],active=e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
      const cap=active?(k==='stars'?p.emitters[i].maxActive:1):0;
      const surface=new PIXI.Container();surface.label=k;owner.addChild(surface);const pool=[];
      for(let j=0;j<cap;j++){const g=new PIXI.Graphics();g.visible=false;g.label=k+' '+j;surface.addChild(g);pool.push(g);totalCreated++;}
      layers[k]=pool;
     }rows.set(e.id,layers);
    }
    return {root,rows};
   }catch(error){release({root});throw error;}
  }
  function draw(g,p,k){
   g.clear();g.blendMode=p.blend;g.alpha=1;
   const rgb=color(p.rgba),alpha=p.rgba[3];
   if(k==='halo'){
    // Concentric bounded geometry, normal-over alpha profile (no filter/texture).
    // Each disk increases cumulative alpha toward the center; outer radius is exact.
    let accumulated=0;
    for(let i=HALO_STEPS;i>=1;i--){
     const u=(HALO_STEPS-i+1)/HALO_STEPS,target=alpha*u*u;
     const a=(target-accumulated)/Math.max(1e-12,1-accumulated);
     if(a>0)g.circle(p.x,p.y,p.radius*i/HALO_STEPS).fill({color:rgb,alpha:a});
     accumulated=target;
    }
   }else g.poly(p.points.flat(),true).fill({color:rgb,alpha});
   g.visible=true;
  }
  function paint(tree,snapshot){
   for(const row of snapshot.emitters){
    const layers=tree.rows.get(row.id);
    for(const k of ORDER){
     const pool=layers[k],items=row.layers[k];
     if(items.length>pool.length)throw Error('GAME-12 compiled graphics budget violated');
     for(let i=0;i<pool.length;i++){
      if(i<items.length)draw(pool[i],items[i],k);
      else pool[i].visible=false;
     }
    }
   }
  }
  function alive(){if(dead||wrapper.destroyed||host.destroyed)throw Error('GAME-12 renderer destroyed');}
  function copyPoses(input){
   if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('GAME-12 pose map required');
   return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v&&typeof v==='object'?{x:v.x,y:v.y,rotation:v.rotation,scale:v.scale}:null]));
  }
  function seek(t,nextPoses=poses){
   alive();const p=copyPoses(nextPoses),snapshot=plan.sample(t,p);
   paint(current,snapshot);last=snapshot;seconds=t;poses=p;return snapshot;
  }
  function configure(input){
   alive();const compiled=L.compile(input),snapshot=compiled.sample(seconds,poses);
   // Stage replacement detached; invalid settings or drawing error leave live tree untouched.
   let candidate;
   try{candidate=makeTree(compiled);paint(candidate,snapshot);wrapper.addChild(candidate.root);}
   catch(error){release(candidate);throw error;}
   const previous=current;current=candidate;plan=compiled;last=snapshot;release(previous);return plan.settings;
  }
  function destroy(){if(dead)return;dead=true;release(current);current=null;wrapper.removeFromParent();if(!wrapper.destroyed)wrapper.destroy({children:true});}
  try{current=makeTree(plan);last=plan.sample(0,poses);paint(current,last);wrapper.addChild(current.root);host.addChild(wrapper);}
  catch(error){destroy();throw error;}
  return Object.freeze({seek,configure,destroy,get owned(){return wrapper},get settings(){return plan.settings},get sample(){return last},get totalCreated(){return totalCreated},
   get allocated(){return current?Array.from(current.rows.values()).reduce((n,l)=>n+ORDER.reduce((m,k)=>m+l[k].length,0),0):0;}});
 }
 return {VERSION:1,createLoot};
});
