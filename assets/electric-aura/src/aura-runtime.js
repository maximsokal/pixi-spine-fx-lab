// ELEC-03 A02: preallocated native Pixi resources, shared absolute-time sampling.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxElectricAura||(typeof require==='function'?require('./aura-core.js'):null),root.FxAuraAnchors||(typeof require==='function'?require('./aura-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxAuraRuntime=api;
})(globalThis,function(H,A){
 'use strict';
 const ORDER=['halo','arcs','sparks'],MAX_VERTICES=8192,PIXEL=64,finite=Number.isFinite;
 const fail=m=>{throw Error('Electric Aura renderer: '+m);};
 function num(v,min,max){if(!finite(v)||v<min||v>max)fail('numeric range');return v;}
 function color(v){if(!Array.isArray(v)||v.length!==4)fail('RGBA');return v.map((x,i)=>num(x,0,i===3?1:255));}
 const active=l=>l.enabled&&l.visible&&l.opacity>0;
 function actualBackend(renderer,GL2=globalThis.WebGL2RenderingContext){
  if(renderer?.gl){const v=renderer.context?.webGLVersion;if(v===2||v===1)return 'webgl'+v;return typeof GL2==='function'&&renderer.gl instanceof GL2?'webgl2':'webgl1';}
  return renderer?.gpu?.device?'webgpu':'unsupported';
 }
 async function initApplication({PIXI,backend,width=512,height=512,allowFallback=true,GL2=globalThis.WebGL2RenderingContext}){
  if(!['webgl1','webgl2','webgpu'].includes(backend)||typeof PIXI?.Application!=='function')fail('backend/dependency');
  num(width,1,16384);num(height,1,16384);const attempts=backend==='webgpu'&&allowFallback?['webgpu','webgl2','webgl1']:[backend];let last;
  for(const requested of attempts){
   const app=new PIXI.Application();try{await app.init({width,height,resolution:1,backgroundAlpha:0,autoStart:false,preference:requested==='webgpu'?'webgpu':'webgl',preferWebGLVersion:requested==='webgl1'?1:2});
    const actual=actualBackend(app.renderer,GL2);if(actual!==requested)fail('requested '+requested+', got '+actual);
    return {app,requested:backend,actual,fallback:actual!==backend};
   }catch(e){last=e;if(app.renderer)try{app.destroy(true,{children:true});}catch{}}
  }
  throw last??Error('Electric Aura renderer: no backend');
 }
 function samePlane(host,world){if(host===world)return;for(const p of [{x:0,y:0},{x:1,y:0},{x:0,y:1}]){const q=host.toLocal(p,world);if(![q.x,q.y].every(finite)||Math.hypot(q.x-p.x,q.y-p.y)>1e-5)fail('hosts must share logical world plane');}}
 function createRenderer({PIXI,world,host,behindHost=host,model=null,Spine=null,settings}){
  if(!H||!A||!world||world.destroyed||!host||host.destroyed||!behindHost||behindHost.destroyed||['Container','Sprite','Mesh','MeshGeometry','BufferImageSource','Texture'].some(k=>typeof PIXI?.[k]!=='function'))fail('dependencies');
  let current=null,seconds=0,last=null,dead=false;
  function live(){if(dead||host.destroyed||behindHost.destroyed||world.destroyed)fail('destroyed');}
  function planes(){samePlane(host,world);samePlane(behindHost,world);}
  function texture(g,data,w,h){const source=new PIXI.BufferImageSource({resource:data,width:w,height:h,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false});try{const t=new PIXI.Texture({source});g.textures.push(t);return t;}catch(e){source.destroy();throw e;}}
  function mask(g,glow){const data=new Uint8Array(PIXEL*PIXEL*4);for(let y=0;y<PIXEL;y++)for(let x=0;x<PIXEL;x++){const r=Math.hypot((x+.5-PIXEL/2)/(PIXEL/2),(y+.5-PIXEL/2)/(PIXEL/2));const a=Math.round(255*(glow?Math.max(0,1-r)**2:Math.max(0,Math.min(1,(1-r)*PIXEL/2))));data.fill(a,(y*PIXEL+x)*4,(y*PIXEL+x+1)*4);}return texture(g,data,PIXEL,PIXEL);}
  function group(label){const v=new PIXI.Container();v.label=label;v.eventMode='none';return v;}
  function dispose(g){if(!g)return;for(const r of g.roots)if(!r.destroyed){r.removeFromParent();r.destroy({children:true,texture:false,textureSource:false});}for(const v of g.geometries)v.destroy();for(const t of g.textures)if(!t.destroyed)t.destroy(true);}
  // One batch per emitter/layer: vertices and index capacity follow the
  // compiled simultaneous bound, not the total number of scheduled events.
  // Every primitive gets a column in the PMA texture. Halo glow columns have
  // a soft across-width profile; hard halo and lightning columns stay solid.
  function batch(g,parent,vertices,primitives,soft){
   if(!Number.isInteger(vertices)||vertices<4||vertices>MAX_VERTICES||!Number.isInteger(primitives)||primitives<1||primitives>2048)fail('mesh capacity');
   const h=soft?16:1,ramp=new Uint8Array(primitives*h*4),tex=texture(g,ramp,primitives,h),pos=new Float32Array(vertices*2),uv=new Float32Array(vertices*2),idx=new Uint16Array(vertices*3);
   const geo=new PIXI.MeshGeometry({positions:pos,uvs:uv,indices:idx,topology:'triangle-list'});g.geometries.push(geo);
   const view=new PIXI.Mesh({geometry:geo,texture:tex});view.visible=false;view.eventMode='none';parent.addChild(view);
   return {view,geo,pos,uv,idx,ramp,source:tex.source,vertices,primitives,h};
  }
  function sprite(parent,tex){const v=new PIXI.Sprite(tex);v.anchor.set(.5);v.visible=false;v.eventMode='none';parent.addChild(v);return v;}
  function prepare(config){
   const plan=H.compile(config),c=plan.settings,g={plan,roots:[],textures:[],geometries:[],pools:new Map(),count:0,vertices:0,views:0};
   try{
    const back=group('aura:behind'),front=group('aura:front');g.roots.push(back,front);
    const layers={behind:{},front:{}};for(const [order,root] of [['behind',back],['front',front]])for(const k of ORDER){const v=group(k);root.addChild(v);layers[order][k]=v;}
    let disc=null;
    for(let i=0;i<c.emitters.length;i++)for(const k of ORDER){const e=c.emitters[i],l=e.layers[k],p={batch:null,discs:[]};g.pools.set(e.id+':'+k,p);
     if(!e.enabled||!active(l))continue;const cap=plan.meta.plans[i].layers[k];if(!cap.primitiveBound)continue;
     const parent=group(e.id+':'+k);layers[l.order][k].addChild(parent);
     if(k==='sparks'){if(!disc)disc=mask(g,false);for(let j=0;j<cap.primitiveBound;j++)p.discs.push(sprite(parent,disc));g.views+=p.discs.length;}
     else{p.batch=batch(g,parent,cap.vertexBound,cap.primitiveBound,k==='halo');g.vertices+=cap.vertexBound;g.views++;}
     g.count+=cap.primitiveBound;
    }
    if(g.count!==plan.meta.primitiveBound||g.vertices!==plan.meta.vertexBound||g.count>H.BUDGETS[c.quality]||g.vertices>MAX_VERTICES)fail('allocation budget');
    return g;
   }catch(e){dispose(g);throw e;}
  }
  function hide(g){for(const v of g.roots)v.visible=false;}
  function paintBatch(b,rows){
   b.view.visible=false;if(!rows.length)return;
   if(rows.length>b.primitives)fail('primitive capacity');
   b.pos.fill(0);b.uv.fill(0);b.idx.fill(0);b.ramp.fill(0);
   let v=0,j=0;
   for(let i=0;i<rows.length;i++){
    const p=rows[i],n=p.positions.length/2,[r,g,blue,a]=color(p.rgba),u=(i+.5)/b.primitives;
    if(p.kind!=='ribbon'||!Number.isInteger(n)||n<4||n%2||p.uvs.length!==n*2||p.indices.length!==(n/2-1)*6||v+n>b.vertices||j+p.indices.length>b.idx.length||p.blend!==rows[0].blend)fail('ribbon shape/capacity');
    for(let y=0;y<b.h;y++){const f=p.id==='glow'?Math.sin(Math.PI*y/(b.h-1))**2:1,alpha=a*f;b.ramp.set([Math.round(r*alpha),Math.round(g*alpha),Math.round(blue*alpha),Math.round(255*alpha)],(y*b.primitives+i)*4);}
    for(let k=0;k<n;k++){b.pos[(v+k)*2]=num(p.positions[k*2],-8e6,8e6);b.pos[(v+k)*2+1]=num(p.positions[k*2+1],-8e6,8e6);
     b.uv[(v+k)*2]=u;b.uv[(v+k)*2+1]=(.5+num(p.uvs[k*2+1],0,1)*(b.h-1))/b.h;}
    for(const ix of p.indices){if(!Number.isInteger(ix)||ix<0||ix>=n)fail('ribbon index');b.idx[j++]=v+ix;}v+=n;
   }
   // Padding is degenerate; copy last point instead of introducing (0,0)
   // into bounds. Keep fixed buffers for all frames and backend parity.
   for(let k=v;k<b.vertices;k++){b.pos.set(b.pos.subarray((v-1)*2,v*2),k*2);b.uv.set(b.uv.subarray((v-1)*2,v*2),k*2);}
   b.geo.getBuffer('aPosition').update();b.geo.getBuffer('aUV').update();b.geo.indexBuffer.update();b.source.update();b.view.blendMode=rows[0].blend;b.view.visible=true;
  }
  function paintSprite(v,p){const [r,g,b,a]=color(p.rgba),radius=num(p.radius,0,100000);v.position.set(num(p.x,-8e6,8e6),num(p.y,-8e6,8e6));v.scale.set(radius*2/PIXEL);v.tint=(Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b);v.alpha=a;v.blendMode=p.blend;v.visible=radius>0&&a>0;}
  function paint(g,t,nextModel){
   try{const resolved=A.resolvePoses(g.plan.settings,{world,model:nextModel,Spine}),sample=g.plan.sample(t,resolved.poses),rows=new Map();
    for(const k of ORDER)for(const v of sample[k]){const id=v.emitterId+':'+k;if(!g.pools.has(id)||!['normal','add'].includes(v.blend))fail('primitive owner');if(!rows.has(id))rows.set(id,[]);rows.get(id).push(v);}
    for(const [id,p] of g.pools){const list=rows.get(id)??[];if(p.batch)paintBatch(p.batch,list);
     else{if(list.length>p.discs.length)fail('sprite capacity');for(let i=0;i<p.discs.length;i++){const v=p.discs[i];v.visible=false;if(i<list.length){if(list[i].kind!=='disc')fail('primitive kind');paintSprite(v,list[i]);}}}
    }
    for(const v of g.roots)v.visible=true;return {sample,missing:resolved.missing};
   }catch(e){hide(g);throw e;}
  }
  function configure(next){live();planes();const staged=prepare(next);let value;try{value=paint(staged,seconds,model);behindHost.addChild(staged.roots[0]);host.addChild(staged.roots[1]);}catch(e){dispose(staged);throw e;}const old=current;current=staged;last=value;dispose(old);return current.plan.settings;}
  function seek(t){live();planes();num(t,0,3600);const value=paint(current,t,model);seconds=t;last=value;return value.sample;}
  function setModel(next){live();planes();const value=paint(current,seconds,next);model=next;last=value;return value.sample;}
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;model=null;}
  configure(settings);
  return Object.freeze({configure,seek,setModel,destroy,get owned(){return current?Object.freeze({behind:current.roots[0],front:current.roots[1]}):null;},get settings(){return current?.plan.settings??null;},get meta(){return current?.plan.meta??null;},get sample(){return last?.sample??null;},get missing(){return last?.missing.slice()??[];},get allocated(){return current?.count??0;},get allocatedVertices(){return current?.vertices??0;},get allocatedViews(){return current?.views??0;}});
 }
 return {VERSION:1,actualBackend,initApplication,createRenderer};
});
