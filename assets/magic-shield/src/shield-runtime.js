// GAME-08 M02: native Pixi radial meshes, independent front/behind ownership.
(function(root,factory){
 const api=Object.freeze(factory(root));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShieldRuntime=api;
})(globalThis,function(root){
 'use strict';
 const KINDS=['shell','halo','ripple','spark'],SIDES=['behind','front'],LAYERS=['shell','halo','impact'];
 const fail=m=>{throw Error('GAME-08 renderer: '+m);},finite=Number.isFinite;
 function radialMesh(p){
  if(!p||!KINDS.includes(p.kind)||!SIDES.includes(p.placement)||!['normal','add','screen','multiply'].includes(p.blend)||
   ![p.x,p.y,p.radius,p.innerRadius].every(finite)||p.radius<=0||p.innerRadius<0||p.innerRadius>p.radius||
   Math.max(Math.abs(p.x),Math.abs(p.y))+p.radius>1e6||!Array.isArray(p.rgba)||p.rgba.length!==4||
   Array.from(p.rgba).some((v,i)=>!finite(v)||v<0||v>(i===3?1:255)))fail('invalid primitive');
  const r=p.radius,inner=p.innerRadius,w=r-inner;
  const center=p.kind==='shell'?p.centerAlpha:0;
  if(!finite(center)||center<0||center>p.rgba[3])fail('invalid center alpha');
  const ratio=p.rgba[3]===0?0:center/p.rgba[3];
  const bands=(p.kind==='spark'?[[0,1],[r*.25,.95],[r*.5,.55],[r*.8,.15],[r,0]]:
   [[0,ratio],[inner,ratio],[inner+w*.38,1],[inner+w*.7,.65],[r,0]]).map(([radius,alpha])=>({radius,alpha}));
  const n=p.kind==='spark'?16:96,positions=new Float32Array(n*bands.length*2),uvs=new Float32Array(positions.length),indices=new Uint32Array(n*(bands.length-1)*6);
  for(let b=0;b<bands.length;b++)for(let i=0;i<n;i++){
   const a=i/n*2*Math.PI,j=(b*n+i)*2;positions[j]=p.x+bands[b].radius*Math.cos(a);positions[j+1]=p.y+bands[b].radius*Math.sin(a);
   uvs[j]=(bands[b].alpha*255+.5)/256;uvs[j+1]=.5;
   if(b+1<bands.length){const v=b*n+i,next=b*n+(i+1)%n,k=(b*n+i)*6;indices.set([v,v+n,next,next,v+n,next+n],k);}
  }
  return {positions,uvs,indices,bands};
 }
 // Already premultiplied RGBA: use the same alpha ramp on all backends.
 function alphaRamp(){const data=new Uint8Array(256*4);for(let i=0;i<256;i++)data.fill(i,i*4,i*4+4);return data;}
 function createRenderer({PIXI,front,behind,compile,settings}){
  if(!PIXI||['Container','Texture','BufferImageSource','MeshSimple'].some(k=>typeof PIXI[k]!=='function')||typeof compile!=='function')fail('dependencies');
  if(!front||!behind||front===behind||front.destroyed||behind.destroyed||typeof front.addChild!=='function'||typeof behind.addChild!=='function')fail('distinct live hosts required');
  let texture=null,current=null,dead=false,seconds=0,poses={},last=null,totalCreated=0;
  const live=()=>{if(dead||front.destroyed||behind.destroyed)fail('destroyed');};
  function release(mesh){const geometry=mesh.geometry;mesh.removeFromParent();try{mesh.destroy({texture:false,textureSource:false});}finally{geometry.destroy();}}
  function dispose(g){if(!g)return;for(const side of SIDES){for(const pool of Object.values(g.pools[side]))for(const mesh of pool)release(mesh);g.groups[side].removeFromParent();g.groups[side].destroy({children:false});}}
  function prepare(config){const plan=compile(config);if(!Number.isInteger(plan.reserved)||plan.reserved<0||plan.reserved>2048)fail('budget');
   const groups={behind:new PIXI.Container(),front:new PIXI.Container()};const pools=Object.fromEntries(SIDES.map(side=>[side,Object.fromEntries(KINDS.map(k=>[k,[]]))]));
   for(const side of SIDES)groups[side].label='GAME-08 '+side;return {plan,groups,pools,allocated:0,visible:0};}
  function snapshot(v){if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid poses');const p={...v};if(v.local)p.local={...v.local};if(v.bones)p.bones=Object.fromEntries(Object.entries(v.bones).map(([k,b])=>[k,b?{...b}:b]));return p;}
  function paint(g,t,nextPoses){
   const result=g.plan.sample(t,nextPoses),counts=Object.fromEntries(SIDES.map(side=>[side,Object.fromEntries(KINDS.map(k=>[k,0]))])),jobs=[];
   for(const row of result.emitters)for(const layer of LAYERS)for(const item of row.layers[layer]){
    if(item.rgba?.[3]===0)continue;const data=radialMesh(item),side=item.placement,k=item.kind,i=counts[side][k]++;jobs.push({item,data,side,k,i});
   }
   const required=SIDES.reduce((n,side)=>n+KINDS.reduce((m,k)=>m+Math.max(counts[side][k],g.pools[side][k].length),0),0);
   if(jobs.length>g.plan.reserved||required>g.plan.reserved)fail('primitive budget');
   // Allocate new views first. Failed allocation cannot remove a live frame.
   const added=[];
   try{for(const j of jobs){const pool=g.pools[j.side][j.k];if(j.i<pool.length)continue;
    const mesh=new PIXI.MeshSimple({texture,vertices:j.data.positions,uvs:j.data.uvs,indices:j.data.indices,topology:'triangle-list'});
    mesh.autoUpdate=false;mesh.visible=false;pool.push(mesh);added.push({pool,mesh});g.allocated++;totalCreated++;
    g.groups[j.side].addChild(mesh);
   }}catch(error){for(const {pool,mesh} of added.reverse()){pool.pop();g.allocated--;release(mesh);}throw error;}
   for(const side of SIDES)for(const k of KINDS)for(const mesh of g.pools[side][k])mesh.visible=false;
   for(const j of jobs){const mesh=g.pools[j.side][j.k][j.i],p=j.item;
    mesh.vertices.set(j.data.positions);mesh.geometry.uvs.set(j.data.uvs);mesh.geometry.getBuffer('aPosition').update();mesh.geometry.getBuffer('aUV').update();
    mesh.tint=(Math.round(p.rgba[0])<<16)|(Math.round(p.rgba[1])<<8)|Math.round(p.rgba[2]);mesh.alpha=p.rgba[3];mesh.blendMode=p.blend;
    // Match numerical order within each host even when kinds interleave.
    g.groups[j.side].addChild(mesh);mesh.visible=true;
   }
   g.visible=jobs.length;return result;
  }
  function replace(config){const g=prepare(config);let next;
   try{next=paint(g,seconds,poses);behind.addChild(g.groups.behind);front.addChild(g.groups.front);}catch(error){dispose(g);throw error;}
   const old=current;current=g;last=next;dispose(old);return g.plan.settings;
  }
  try{const source=new PIXI.BufferImageSource({resource:alphaRamp(),width:256,height:1,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false});
   try{texture=new PIXI.Texture({source});}catch(error){source.destroy();throw error;}replace(settings);
  }catch(error){dispose(current);texture?.destroy(true);throw error;}
  function seek(t,nextPoses=poses){live();if(!finite(t)||t<0||t>1e6)fail('invalid seconds');const p=snapshot(nextPoses);const next=paint(current,t,p);seconds=t;poses=p;last=next;return last;}
  function configure(config){live();return replace(config);}
  function destroy(){if(dead)return;dead=true;try{dispose(current);}finally{current=null;last=null;texture.destroy(true);}}
  return Object.freeze({seek,configure,destroy,get settings(){return current?.plan.settings??null;},get sample(){return last;},get stats(){return {allocated:current?.allocated??0,visible:current?.visible??0,totalCreated};}});
 }
 function createShield(options){const core=root.FxShield||(typeof require==='function'?require('./shield-core.js'):null);if(!core)fail('shield core missing');return createRenderer({...options,compile:core.compile});}
 return {radialMesh,alphaRamp,createRenderer,createShield};
});
