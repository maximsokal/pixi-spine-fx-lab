// GAME-04 E02: preallocated native Pixi resources, shared absolute-time sampling.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxEnergyProjectile||(typeof require==='function'?require('./energy-core.js'):null),root.FxEnergyAnchors||(typeof require==='function'?require('./energy-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxEnergyRuntime=api;
})(globalThis,function(H,A){
 'use strict';
 const ORDER=['ribbon','orbit','core'],MAX_SECTIONS=4096,MAX_VERTICES=8192,PIXEL=64,finite=Number.isFinite;
 const fail=m=>{throw Error('Energy renderer: '+m);};
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
  throw last??Error('Energy renderer: no backend');
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
  function mesh(g,parent,cap){const ramp=new Uint8Array(cap*4),tex=texture(g,ramp,cap,1),pos=new Float32Array(cap*4),uv=new Float32Array(cap*4),idx=new Uint16Array((cap-1)*6);
   const geo=new PIXI.MeshGeometry({positions:pos,uvs:uv,indices:idx,topology:'triangle-list'});g.geometries.push(geo);
   const view=new PIXI.Mesh({geometry:geo,texture:tex});view.visible=false;view.eventMode='none';parent.addChild(view);return {view,geo,pos,uv,idx,ramp,source:tex.source,cap};}
  function sprite(parent,tex){const v=new PIXI.Sprite(tex);v.anchor.set(.5);v.visible=false;v.eventMode='none';parent.addChild(v);return v;}
  function prepare(config){const plan=H.compile(config),c=plan.settings,g={plan,roots:[],textures:[],geometries:[],pools:new Map(),count:0};try{
    const back=group('energy:behind'),front=group('energy:front');g.roots.push(back,front);
    const layers={behind:{},front:{}};for(const [order,root] of [['behind',back],['front',front]])for(const k of ORDER){const v=group(k);root.addChild(v);layers[order][k]=v;}
    const disc=mask(g,false),glow=mask(g,true),loop=c.mode==='flightLoop',span=plan.meta.duration;
    const bound=(events,life)=>events.length*(loop?Math.ceil(life/H.FPS/span)+1:1);
    const enabledRibbons=c.emitters.filter(e=>e.enabled&&active(e.layers.ribbon)&&c.tailLength>0&&c.travelSpeed>0&&c.trailWidth>0);
    // All active ribbons share one trajectory. The total core bound includes
    // each emitter's spacing contribution; allocate each its own safe bound.
    const extra=e=>Math.min(plan.meta.plans[e.id].distances.length*(loop?2:1),Math.ceil(c.tailLength/c.minGap)+3);
    const extraSum=enabledRibbons.reduce((n,e)=>n+extra(e),0);
    const common=enabledRibbons.length?Math.ceil((plan.meta.vertexBound/2-extraSum)/enabledRibbons.length):0;
    let allocatedVertices=0;
    for(const e of c.emitters)for(const k of ORDER){const l=e.layers[k],p={mesh:null,discs:[],glows:[]};g.pools.set(e.id+':'+k,p);if(!e.enabled||!active(l))continue;
     const parent=group(e.id+':'+k);layers[l.order][k].addChild(parent);const events=plan.meta.plans[e.id];
     let n=0,ng=0;if(k==='core'){n=1;ng=c.glow>0?1:0;}
     if(k==='ribbon'){n=bound(events.trail,c.trailLifeFrames);if(enabledRibbons.includes(e)){const cap=common+extra(e);if(!Number.isInteger(cap)||cap<2||cap>MAX_SECTIONS)fail('mesh capacity');allocatedVertices+=cap*2;p.mesh=mesh(g,parent,cap);}}
     if(k==='orbit')n=bound(events.orbit,c.orbitLifeFrames);
     for(let i=0;i<ng;i++)p.glows.push(sprite(parent,glow));for(let i=0;i<n;i++)p.discs.push(sprite(parent,disc));g.count+=n+ng+(p.mesh?1:0);
    }
    if(g.count>H.BUDGETS[c.quality]||allocatedVertices>MAX_VERTICES)fail('allocation budget');g.vertices=allocatedVertices;return g;
   }catch(e){dispose(g);throw e;}}
  function hide(g){for(const v of g.roots)v.visible=false;}
  function paintMesh(e,p){
   const n=p.sections?.length;if(!Number.isInteger(n)||n<2||n>e.cap||p.positions.length!==n*4||p.colors.length!==n*8||p.indices.length!==(n-1)*6)fail('ribbon shape');
   e.pos.fill(0);e.uv.fill(0);e.idx.fill(0);e.ramp.fill(0);
   for(let i=0;i<n;i++){const rgba=color(p.sections[i].rgba),[r,g,b,a]=rgba,u=(i+.5)/e.cap;for(let j=0;j<8;j++)if(p.colors[i*8+j]!==rgba[j%4])fail('ribbon colors');
    for(let j=0;j<4;j++)e.pos[i*4+j]=num(p.positions[i*4+j],-8e6,8e6);
    e.uv.set([u,.5,u,.5],i*4);e.ramp.set([Math.round(r*a),Math.round(g*a),Math.round(b*a),Math.round(255*a)],i*4);
    if(i){const v=(i-1)*2,expected=[v,v+1,v+2,v+1,v+3,v+2];for(let j=0;j<6;j++){if(p.indices[(i-1)*6+j]!==expected[j])fail('ribbon indices');e.idx[(i-1)*6+j]=expected[j];}}
   }
   // Pad with degenerate triangles and the last vertex to keep bounds correct.
   for(let i=n;i<e.cap;i++){e.pos.set(e.pos.subarray((n-1)*4,n*4),i*4);e.uv.set(e.uv.subarray((n-1)*4,n*4),i*4);}
   e.geo.getBuffer('aPosition').update();e.geo.getBuffer('aUV').update();e.geo.indexBuffer.update();e.source.update();e.view.blendMode=p.blend;e.view.visible=true;
  }
  function paintSprite(v,p){const [r,g,b,a]=color(p.rgba),radius=num(p.radius,0,100000);v.position.set(num(p.x,-8e6,8e6),num(p.y,-8e6,8e6));v.scale.set(radius*2/PIXEL);v.tint=(Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b);v.alpha=a;v.blendMode=p.blend;v.visible=radius>0&&a>0;}
  function paint(g,t,nextModel){
   try{const resolved=A.resolvePoses(g.plan.settings,{world,model:nextModel,Spine}),sample=g.plan.sample(t,resolved.poses);
    for(const p of g.pools.values()){if(p.mesh)p.mesh.view.visible=false;for(const v of [...p.discs,...p.glows])v.visible=false;}
    const cursors=new Map();
    for(const k of ORDER)for(const v of sample[k]){const id=v.emitterId+':'+k,p=g.pools.get(id);if(!p||!['normal','add'].includes(v.blend))fail('primitive owner');let cursor=cursors.get(id);if(!cursor){cursor={disc:0,glow:0,ribbon:0};cursors.set(id,cursor);}
     if(v.kind==='ribbon'){if(!p.mesh||cursor.ribbon++)fail('ribbon capacity');paintMesh(p.mesh,v);}
     else if(v.kind==='disc'||v.kind==='glow'){const pool=v.kind==='disc'?p.discs:p.glows,view=pool[cursor[v.kind]++];if(!view)fail('sprite capacity');paintSprite(view,v);}
     else fail('primitive kind');
    }
    for(const v of g.roots)v.visible=true;return {sample,missing:resolved.missing};
   }catch(e){hide(g);throw e;}
  }
  function configure(next){live();planes();const staged=prepare(next);let value;try{value=paint(staged,seconds,model);behindHost.addChild(staged.roots[0]);host.addChild(staged.roots[1]);}catch(e){dispose(staged);throw e;}const old=current;current=staged;last=value;dispose(old);return current.plan.settings;}
  function seek(t){live();planes();num(t,0,3600);const value=paint(current,t,model);seconds=t;last=value;return value.sample;}
  function setModel(next){live();planes();const value=paint(current,seconds,next);model=next;last=value;return value.sample;}
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;model=null;}
  configure(settings);
  return Object.freeze({configure,seek,setModel,destroy,get owned(){return current?Object.freeze({behind:current.roots[0],front:current.roots[1]}):null;},get settings(){return current?.plan.settings??null;},get meta(){return current?.plan.meta??null;},get sample(){return last?.sample??null;},get missing(){return last?.missing.slice()??[];},get allocated(){return current?.count??0;},get allocatedVertices(){return current?.vertices??0;}});
 }
 return {VERSION:1,actualBackend,initApplication,createRenderer};
});
