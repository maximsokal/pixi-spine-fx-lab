// GAME-02 H02: bounded Pixi v8 adapter; no clock, asset or camera ownership.
(function(root,make){
 'use strict';
 const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHitSparksRuntime=api;
})(globalThis,function(){
 'use strict';
 const ORDER=['dust','primary','flash'],CAPS={flash:1,primary:140,dust:70},RAD=Math.PI/180;
 const fail=s=>{throw Error('Hit Sparks renderer: '+s);};
 function number(n,min,max){if(!Number.isFinite(n)||n<min||n>max)fail('invalid number');return n;}
 function point(p){if(!p)fail('missing point');return [number(p.x,-2e6,2e6),number(p.y,-2e6,2e6)];}
 function outline(vertices){
  const a=[];for(const p of vertices){const [x,y]=p;if(a.length&&x===a.at(-2)&&y===a.at(-1))continue;a.push(x,y);}
  if(a.length>=4&&a[0]===a.at(-2)&&a[1]===a.at(-1))a.splice(-2);
  if(a.length<6)return null;
  let area=0;for(let i=2;i+3<a.length;i+=2)area+=(a[i]-a[0])*(a[i+3]-a[1])-(a[i+1]-a[1])*(a[i+2]-a[0]);
  return Math.abs(area)>1e-9?a:null;
 }
 function job(k,p){
  const [x,y]=point(p);
  if(!Array.isArray(p.rgba)||p.rgba.length!==4||!['normal','add'].includes(p.blend))fail('RGBA/blend');
  const [r,g,b,alpha]=Array.from(p.rgba,(n,i)=>number(n,0,i===3?1:255));
  const tint=(Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b),blend=p.blend;
  if(k==='dust'){const size=number(p.radius,0,6);return size&&alpha?{x,y,rotation:0,size,tint,alpha,blend,key:'circle',poly:null}:null;}
  const n=k==='flash'?12:18;
  if(!Array.isArray(p.vertices)||p.vertices.length!==n)fail('vertex count');
  const rotation=k==='primary'?number(p.angle,-361000,361000)*RAD:0,cos=Math.cos(rotation),sin=Math.sin(rotation);
  // Local-space ribbon: translation/rotation update the transform, not the mesh.
  // Quantize only its shape key to absorb floating-point noise; draw original
  // local coordinates (no quantization of artist data or sample coordinates).
  const pairs=Array.from(p.vertices,v=>{const [vx,vy]=point(v),dx=vx-x,dy=vy-y;return [dx*cos+dy*sin,-dx*sin+dy*cos];});
  let vertices=pairs;
  if(k==='primary'){const left=[],right=[];for(let i=0;i<n;i+=2){left.push(pairs[i]);right.push(pairs[i+1]);}vertices=left.concat(right.reverse());}
  const poly=outline(vertices);
  return poly&&alpha?{x,y,rotation,size:1,tint,alpha,blend,poly,key:poly.map(v=>Math.round(v*1e7)).join(',')}:null;
 }
 function jobsFor(sample){
  if(!sample||typeof sample!=='object'||Object.keys(sample).length!==3)fail('sample shape');
  return Object.fromEntries(ORDER.map(k=>{const v=sample[k];if(!Array.isArray(v)||v.length>CAPS[k])fail('budget '+k);return [k,Array.from(v,p=>job(k,p)).filter(Boolean)];}));
 }
 function createRenderer({PIXI,host,compile,settings}){
  if(!PIXI||typeof PIXI.Container!=='function'||typeof PIXI.Graphics!=='function'||!host||host.destroyed||typeof host.addChild!=='function'||typeof compile!=='function')fail('dependencies');
  let current=null,dead=false,seconds=0,last=null;
  function live(){if(dead||host.destroyed)fail('destroyed');}
  function dispose(g){if(g&&!g.group.destroyed){g.group.removeFromParent();g.group.destroy({children:true});}}
  function prepare(config){
   const plan=compile(config);if(!plan||typeof plan.sample!=='function')fail('plan');
   const group=new PIXI.Container(),layers={};group.label='GAME-02 Hit Sparks';group.eventMode='none';
   try{for(const k of ORDER){const layer=new PIXI.Container();layer.label=k;group.addChild(layer);layers[k]={layer,pool:[]};}}
   catch(e){dispose({group});throw e;}return {plan,group,layers};
  }
  function paint(g,t){
   // Validate all geometry and budgets before mutating any live Graphics.
   const result=g.plan.sample(t),jobs=jobsFor(result),added=[];
   try{
    for(const k of ORDER){const {pool,layer}=g.layers[k];for(let i=pool.length;i<jobs[k].length;i++){
     const view=new PIXI.Graphics();view.visible=false;pool.push({view,key:null});added.push({pool,view});layer.addChild(view);
    }}
    for(const k of ORDER){const {pool}=g.layers[k];for(let i=0;i<pool.length;i++){
     const entry=pool[i],v=entry.view,j=jobs[k][i];v.visible=!!j;if(!j)continue;
     if(entry.key!==j.key){entry.key=null;v.clear();if(j.poly)v.poly(j.poly,true);else v.circle(0,0,1);v.fill(0xffffff);entry.key=j.key;}
     v.position.set(j.x,j.y);v.rotation=j.rotation;v.scale.set(j.size);v.tint=j.tint;v.alpha=j.alpha;v.blendMode=j.blend;
    }}
    g.group.visible=true;return result;
   }catch(e){for(const {pool,view} of added.reverse()){pool.pop();if(!view.destroyed){view.removeFromParent();view.destroy();}}g.group.visible=false;throw e;}
  }
  function configure(next){
   live();const staged=prepare(next);let result;
   try{result=paint(staged,seconds);host.addChild(staged.group);}
   catch(e){dispose(staged);throw e;}
   const old=current;current=staged;last=result;dispose(old);return staged.plan.settings;
  }
  function seek(t){live();number(t,0,3600);const result=paint(current,t);seconds=t;last=result;return result;}
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;}
  configure(settings);
  return Object.freeze({configure,seek,destroy,get owned(){return current?.group??null;},get settings(){return current?.plan.settings??null;},get sample(){return last;},get allocated(){return current?ORDER.reduce((n,k)=>n+current.layers[k].pool.length,0):0;}});
 }
 return {VERSION:1,createRenderer};
});
