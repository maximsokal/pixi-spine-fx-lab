// GAME-10 P02: pooled native fog, spore and annular meshes.
(function(root,factory){const api=Object.freeze(factory(root));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPoisonRuntime=api;})(globalThis,function(root){
 'use strict';
 const ORDER=['fog','edge','spores'],SIDES=['behind','front'],KINDS=['fog','spore','bubble','edge'],N=32,BANDS=5,TAU=2*Math.PI;
 const fail=m=>{throw Error('GAME-10 renderer: '+m);};
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 function alphaRamp(){const data=new Uint8Array(1024);for(let i=0;i<256;i++)data.fill(i,i*4,i*4+4);return data;}

 // Fixed topology: 160 vertices and 256 triangles per primitive. The ring uses
 // a zero-alpha inner and outer edge; the disc ends in a zero-alpha perimeter.
 const COS=Array.from({length:N},(_,i)=>Math.cos(i*TAU/N)),SIN=Array.from({length:N},(_,i)=>Math.sin(i*TAU/N));
 const DISC=[0,.25,.52,.8,1],DISC_ALPHA=[1,.88,.53,.13,0],FOG_ALPHA=[.83,1,.62,.19,0],RING_ALPHA=[0,.62,1,.62,0];
 function validate(p){
  if(!p||!KINDS.includes(p.kind)||!SIDES.includes(p.placement)||!['normal','add','screen','multiply'].includes(p.blend)||![p.x,p.y,p.radius,p.rotation].every(Number.isFinite)||p.radius<=0||!Array.isArray(p.rgba)||p.rgba.length!==4||p.rgba.some((v,i)=>!Number.isFinite(v)||v<0||v>(i===3?1:255)))fail('invalid primitive');
  if((p.kind==='bubble'||p.kind==='edge')&&(!Number.isFinite(p.thickness)||p.thickness<=0))fail('invalid thickness');
  if((p.kind==='fog'||p.kind==='edge')&&(!Number.isFinite(p.aspect)||p.aspect<=0||p.aspect>1||!Number.isFinite(p.roughness)||p.roughness<0||p.roughness>1||!Number.isInteger(p.shapeSeed)))fail('invalid fog profile');
 }
 function shapePhase(seed,salt){let x=(seed^salt)|0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296*TAU;}
 function meshData(p){
  validate(p);const vertices=new Float32Array(N*BANDS*2),uvs=new Float32Array(vertices.length),indices=new Uint16Array(N*(BANDS-1)*6),profile=p.kind==='fog'?FOG_ALPHA:p.kind==='bubble'||p.kind==='edge'?RING_ALPHA:DISC_ALPHA;
  for(let b=0;b<BANDS;b++)for(let i=0;i<N;i++){
   const j=(b*N+i)*2;uvs[j]=(profile[b]*255+.5)/256;uvs[j+1]=.5;
   if(b<BANDS-1){const v=b*N+i,next=b*N+(i+1)%N,k=(b*N+i)*6;indices[k]=v;indices[k+1]=v+N;indices[k+2]=next;indices[k+3]=next;indices[k+4]=v+N;indices[k+5]=next+N;}
  }
  writeVertices(vertices,p);return {vertices,uvs,indices};
 }
 function writeVertices(out,p){
  const t=p.rotation*Math.PI/180,ct=Math.cos(t),st=Math.sin(t),organic=p.kind==='fog'||p.kind==='edge',ring=p.kind==='bubble'||p.kind==='edge',rough=organic?p.roughness:0,aspect=organic?p.aspect:1,
   w=ring?Math.min(p.radius,p.thickness):0,ph3=shapePhase(p.shapeSeed||0,31),ph5=shapePhase(p.shapeSeed||0,97),ph9=shapePhase(p.shapeSeed||0,193);
  for(let i=0;i<N;i++){
   const a=i*TAU/N,shape=1+rough*(.16*Math.sin(3*a+ph3)+.085*Math.sin(5*a+ph5)+.035*Math.cos(9*a+ph9)),dx=COS[i]*shape,dy=SIN[i]*shape*aspect;
   for(let b=0;b<BANDS;b++){const radius=ring?p.radius-w+w*b/(BANDS-1):p.radius*DISC[b],x=radius*dx,y=radius*dy,j=(b*N+i)*2;out[j]=p.x+x*ct-y*st;out[j+1]=p.y+x*st+y*ct;}
  }
 }
 function createRenderer({PIXI,front,behind,compile,settings}){
  if(!PIXI||['Container','BufferImageSource','Texture','MeshSimple'].some(k=>typeof PIXI[k]!=='function')||typeof compile!=='function'||!front||!behind||front===behind||front.destroyed||behind.destroyed)fail('dependencies or hosts');
  let texture,current,dead=false,seconds=0,poses={},last=null,totalCreated=0;
  const live=()=>{if(dead||front.destroyed||behind.destroyed)fail('destroyed');};
  function release(mesh){const geometry=mesh.geometry;mesh.removeFromParent();try{mesh.destroy({texture:false,textureSource:false});}finally{geometry.destroy();}}
  function dispose(tree){if(!tree)return;for(const row of tree.rows.values())for(const {group,pool} of Object.values(row)){for(const mesh of pool)release(mesh);group.removeFromParent();group.destroy({children:false});}for(const side of SIDES){tree.groups[side].removeFromParent();tree.groups[side].destroy({children:false});}}
  function prepare(config){const plan=compile(config);if(!Number.isInteger(plan.reserved)||plan.reserved<0||plan.reserved>2048)fail('budget');const tree={plan,groups:{behind:new PIXI.Container(),front:new PIXI.Container()},rows:new Map(),allocated:0,visible:0};
   try{for(const [i,e] of plan.settings.emitters.entries()){const row={};tree.rows.set(e.id,row);for(const key of ORDER){const l=e.layers[key],cap=active(e,l)?plan.schedules[i][key].maxActive:0;if(!Number.isInteger(cap)||cap<0||tree.allocated+cap>plan.reserved)fail('budget');const group=new PIXI.Container(),pool=[],kind=key==='spores'?plan.settings.particleMode:key;row[key]={group,pool,kind,placement:l.placement};group.label=e.id+' '+key;tree.groups[l.placement].addChild(group);
    for(let j=0;j<cap;j++){const data=meshData({kind,x:0,y:0,radius:1,rotation:0,rgba:[255,255,255,1],blend:'normal',placement:l.placement,thickness:.2,aspect:.6,roughness:0,shapeSeed:0});const mesh=new PIXI.MeshSimple({texture,...data,topology:'triangle-list'});pool.push(mesh);tree.allocated++;totalCreated++;mesh.autoUpdate=false;mesh.visible=false;group.addChild(mesh);}
   }}if(tree.allocated!==plan.reserved)fail('budget mismatch');return tree;}catch(error){dispose(tree);throw error;}}
  function paint(tree,t,p){const result=tree.plan.sample(t,p),jobs=[];if(result.cost>tree.allocated)fail('budget');for(const row of result.emitters){const slots=tree.rows.get(row.id);for(const key of ORDER){const {pool,kind,placement}=slots[key],items=row.layers[key];if(items.length>pool.length)fail('budget');for(let i=0;i<items.length;i++){const item=items[i];validate(item);if(item.kind!==kind||item.placement!==placement)fail('primitive ownership');jobs.push({mesh:pool[i],item});}}}
   for(const row of tree.rows.values())for(const {pool} of Object.values(row))for(const mesh of pool)mesh.visible=false;
   for(const {mesh,item} of jobs){writeVertices(mesh.vertices,item);mesh.geometry.getBuffer('aPosition').update();mesh.tint=(Math.round(item.rgba[0])<<16)|(Math.round(item.rgba[1])<<8)|Math.round(item.rgba[2]);mesh.alpha=item.rgba[3];mesh.blendMode=item.blend;mesh.visible=true;}
   tree.visible=jobs.length;return result;
  }
  function replace(config){const next=prepare(config);let result;try{result=paint(next,seconds,poses);behind.addChild(next.groups.behind);front.addChild(next.groups.front);}catch(error){dispose(next);throw error;}const old=current;current=next;last=result;dispose(old);return current.plan.settings;}
  try{const source=new PIXI.BufferImageSource({resource:alphaRamp(),width:256,height:1,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false});try{texture=new PIXI.Texture({source});}catch(error){source.destroy();throw error;}replace(settings);}catch(error){texture?.destroy(true);throw error;}
  function seek(t,p=poses){live();if(!Number.isFinite(t)||t<0||t>1e6||!p||typeof p!=='object'||Array.isArray(p))fail('invalid seek');const copy={...p};if(p.local)copy.local={...p.local};if(p.bones)copy.bones=Object.fromEntries(Object.entries(p.bones).map(([k,b])=>[k,b?{...b}:b]));const result=paint(current,t,copy);seconds=t;poses=copy;last=result;return result;}
  function configure(config){live();return replace(config);}
  function destroy(){if(dead)return;dead=true;try{dispose(current);}finally{current=null;last=null;texture.destroy(true);}}
  return Object.freeze({seek,configure,destroy,get settings(){return current?.plan.settings??null;},get sample(){return last;},get stats(){return {allocated:current?.allocated??0,visible:current?.visible??0,totalCreated};}});
 }
 function createPoison(options){const core=root.FxPoison||(typeof require==='function'?require('./poison-core.js'):null);if(!core)fail('missing core');return createRenderer({...options,compile:core.compile});}
 return {alphaRamp,meshData,createRenderer,createPoison};
});
