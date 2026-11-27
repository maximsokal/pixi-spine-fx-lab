// EARTH-01 G02: fixed native pools; all authored geometry is sampled by G01.
(function(root,make){
 const api=Object.freeze(make(root.FxGroundImpact||(typeof require==='function'?require('./ground-impact-core.js'):null),root.FxGroundImpactAnchors||(typeof require==='function'?require('./ground-impact-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactRuntime=api;
})(globalThis,function(H,A){
 'use strict';
 const ORDER=['dust','ring','debris'],SEGMENTS=96,PIXEL=64,finite=Number.isFinite;
 const fail=m=>{throw Error('Ground Impact renderer: '+m);};
 function num(v,min,max){if(!finite(v)||v<min||v>max)fail('numeric range');return v;}
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
  throw last??Error('Ground Impact renderer: no backend');
 }
 function samePlane(host,world){if(host===world)return;for(const p of [{x:0,y:0},{x:1,y:0},{x:0,y:1}]){const q=host.toLocal(p,world);if(![q.x,q.y].every(finite)||Math.hypot(q.x-p.x,q.y-p.y)>1e-5)fail('hosts must share logical world plane');}}

 function createRenderer({PIXI,world,host,behindHost=host,model=null,Spine=null,settings}){
  if(!H||!A||!world||world.destroyed||!host||host.destroyed||!behindHost||behindHost.destroyed||['Container','Sprite','Mesh','MeshGeometry','BufferImageSource','Texture'].some(k=>typeof PIXI?.[k]!=='function'))fail('dependencies');
  let current=null,seconds=0,last=null,dead=false,broken=false;
  function live(){if(dead||host.destroyed||behindHost.destroyed||world.destroyed)fail('destroyed');if(broken)fail('broken renderer');}
  function planes(){samePlane(host,world);samePlane(behindHost,world);}
  function group(label){const v=new PIXI.Container();v.label=label;v.eventMode='none';return v;}
  function dispose(g){if(!g)return;
   // Explicitly destroy all owned views, including a view not yet parented
   // if addChild threw during detached construction.
   for(const v of g.views)if(!v.destroyed){v.removeFromParent();v.destroy({texture:false,textureSource:false});}
   for(const root of g.roots)if(!root.destroyed){root.removeFromParent();root.destroy({children:true,texture:false,textureSource:false});}
   for(const geo of g.geometries)geo.destroy();for(const t of g.textures)if(!t.destroyed)t.destroy(true);
  }
  function texture(g,data,w,h){const src=new PIXI.BufferImageSource({resource:data,width:w,height:h,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false});try{const t=new PIXI.Texture({source:src});g.textures.push(t);return t;}catch(e){src.destroy();throw e;}}
  function mask(g,k){const data=new Uint8Array(PIXEL*PIXEL*4);for(let y=0;y<PIXEL;y++)for(let x=0;x<PIXEL;x++){
   const u=(x+.5-PIXEL/2)/(PIXEL/2),v=(y+.5-PIXEL/2)/(PIXEL/2);
   // Convex faceted silhouette for stone; soft radial opacity for dust.
   const r=k==='dust'?Math.hypot(u,v):Math.max(Math.abs(u)*1.12,Math.abs(v)*1.35,Math.abs(u+v)*.85,Math.abs(u-v)*.78);
   const a=Math.round(255*(k==='dust'?Math.max(0,1-r)**2:Math.max(0,Math.min(1,(1-r)*PIXEL/2))));
   data.fill(a,(y*PIXEL+x)*4,(y*PIXEL+x+1)*4);
  }return texture(g,data,PIXEL,PIXEL);}
  function ring(g,parent,tex){const pos=new Float32Array((SEGMENTS+1)*8),uv=new Float32Array(pos.length),idx=new Uint16Array(SEGMENTS*18);
   for(let i=0;i<=SEGMENTS;i++)for(let j=0;j<4;j++){const v=i*4+j;uv[2*v]=(j+.5)/4;uv[2*v+1]=.5;if(i<SEGMENTS&&j<3)idx.set([v,v+4,v+1,v+1,v+4,v+5],(i*3+j)*6);}
   const geo=new PIXI.MeshGeometry({positions:pos,uvs:uv,indices:idx,topology:'triangle-list'});g.geometries.push(geo);
   const view=new PIXI.Mesh({geometry:geo,texture:tex});g.views.push(view);view.visible=false;view.eventMode='none';parent.addChild(view);return {view,pos,geo};
  }
  function sprite(g,parent,tex){const view=new PIXI.Sprite(tex);g.views.push(view);view.anchor.set(.5);view.visible=false;view.eventMode='none';parent.addChild(view);return {view};}
  function prepare(config){
   const plan=H.compile(config),count=plan.meta.primitiveBound,g={plan,count,roots:[],views:[],geometries:[],textures:[],pools:{}};
   if(count>H.BUDGETS[plan.settings.quality]||count!==Object.values(plan.meta.counts).reduce((a,b)=>a+b,0))fail('capacity');
   try{
    for(const order of ['behind','front']){const root=group('ground-impact:'+order);g.roots.push(root);for(const k of ORDER){
     if(plan.settings.layers[k].order!==order)continue;const parent=group(k);root.addChild(parent);
     const n=plan.meta.counts[k];g.pools[k]=[];
     if(!n)continue;
     const tex=k==='ring'?texture(g,new Uint8Array([0,0,0,0,255,255,255,255,255,255,255,255,0,0,0,0]),4,1):mask(g,k);
     for(let i=0;i<n;i++)g.pools[k].push(k==='ring'?ring(g,parent,tex):sprite(g,parent,tex));
    }}return g;
   }catch(e){dispose(g);throw e;}
  }
  function paintRing(b,p){const rx=num(p.radiusX,0,1e6),ry=num(p.radiusY,0,1e6),w=num(p.width,0,1e6);
   // Four alpha bands: width is applied to each semi-axis (not a normal offset).
   // At birth, collapse the two inner bands to the origin for a soft contact disc.
   const x=[Math.max(0,rx-w/2),Math.max(0,rx-w/4),rx+w/4,rx+w/2],y=[Math.max(0,ry-w/2),Math.max(0,ry-w/4),ry+w/4,ry+w/2];
   for(let i=0;i<=SEGMENTS;i++){const a=i===SEGMENTS?0:i*2*Math.PI/SEGMENTS,co=Math.cos(a),si=Math.sin(a);
    for(let j=0;j<4;j++){const ix=(i*4+j)*2;b.pos[ix]=co*x[j];b.pos[ix+1]=si*y[j];}}
   b.geo.getBuffer('aPosition').update();
  }
  function paint(g,t,nextModel){try{
   const poses=A.resolvePoses(g.plan.settings,{world,model:nextModel,Spine}).poses,s=g.plan.sample(t,poses);
   for(const k of ORDER){const items=s.layers[k],pool=g.pools[k];if(items.length>pool.length)fail('primitive capacity');
    for(let i=0;i<pool.length;i++){const b=pool[i],v=b.view,p=items[i];v.visible=false;if(!p)continue;
     if(p.kind!==({ring:'ellipse-ring',debris:'fragment',dust:'soft-dust'})[k]||!['normal','add'].includes(p.blend))fail('primitive shape');
     const [r,green,blue,a]=p.rgba.map((v,i)=>num(v,0,i===3?1:255));v.position.set(num(p.x,-1e8,1e8),num(p.y,-1e8,1e8));
     v.rotation=k==='dust'?0:num(p.rotation,-1e8,1e8);
     if(k==='ring')paintRing(b,p);else v.scale.set(num(k==='debris'?p.size:p.radius*2,0,1e6)/PIXEL);
     v.tint=(Math.round(r)<<16)|(Math.round(green)<<8)|Math.round(blue);v.alpha=a;v.blendMode=p.blend;v.visible=a>0;
    }
   }for(const root of g.roots)root.visible=true;return s;
  }catch(e){for(const root of g.roots)root.visible=false;throw e;}}
  function configure(next){live();planes();const staged=prepare(next);let value;
   try{value=paint(staged,seconds,model);behindHost.addChild(staged.roots[0]);host.addChild(staged.roots[1]);}catch(e){dispose(staged);throw e;}
   const old=current;current=staged;last=value;dispose(old);return staged.plan.settings;
  }
  function seek(t){live();planes();num(t,0,1e8);const s=paint(current,t,model);seconds=t;last=s;return s;}
  function setModel(next){live();planes();try{const s=paint(current,seconds,next);model=next;last=s;return s;}catch(e){
   try{last=paint(current,seconds,model);}catch(rollback){broken=true;throw new AggregateError([e,rollback],'Ground Impact renderer: model rollback failed');}throw e;
  }}
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;model=null;}
  configure(settings);
  return Object.freeze({configure,seek,setModel,destroy,get owned(){return current?Object.freeze({behind:current.roots[0],front:current.roots[1]}):null;},get settings(){return current?.plan.settings??null;},get meta(){return current?.plan.meta??null;},get sample(){return last;},get missing(){return last?.missing.slice()??[];},get allocated(){return current?.count??0;},get broken(){return broken;}});
 }
 return {VERSION:1,SEGMENTS,actualBackend,initApplication,createRenderer};
});
