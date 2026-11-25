// GAME-06 M02: independent native polar surfaces and pooled accents.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxPortal||(typeof require==='function'?require('./portal-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPortalRuntime=api;
})(globalThis,function(P){
 'use strict';
 const DEG=Math.PI/180,ORDER=['aperture','rim','particles'];
 const vertex=`
 in vec2 aPosition;
 in vec2 aUV;
 uniform mat3 uProjectionMatrix,uWorldTransformMatrix,uTransformMatrix;
 uniform vec4 uWorldColorAlpha,uColor;
 out vec2 vUV;
 out vec4 vColor;
 void main(){
  vec3 p=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.);
  gl_Position=vec4(p.xy,0.,1.);vUV=aUV;vColor=uWorldColorAlpha*uColor;
 }`;
 const fragment=`
 precision highp float;
 in vec2 vUV;
 in vec4 vColor;
 uniform vec4 uTint,uPolar;
 out vec4 finalColor;
 void main(){
  vec2 p=vUV*2.-1.;float r=length(p);
  float a=atan(p.y,p.x+0.000001);
  float wave=0.5+0.5*sin(2.*a-2.*uPolar.x+9.*r+uPolar.y*3.*sin(4.*a+6.*r));
  float shape=0.;float light=0.;
  if(uPolar.w==0.){
   shape=(1.-smoothstep(0.72,1.,r))*(0.18+0.54*wave)*smoothstep(0.,0.15,r);
   light=0.45+0.55*wave;
  }else{
   float d=abs(r+uPolar.w);float w=max(uPolar.y,0.0001);
   shape=(1.-smoothstep(0.,w,d))*(0.55+0.45*wave);
   shape=max(shape,0.22*uPolar.z*(1.-smoothstep(w,2.5*w,d)));
   light=0.65+0.35*wave;
  }
  float alpha=clamp(shape*uTint.a,0.,1.);
  vec3 rgb=mix(uTint.rgb,vec3(1.),clamp(light*uPolar.z*0.35,0.,0.85));
  finalColor=vec4(rgb*alpha,alpha)*vColor;
 }`;
 const gpu=`
 struct GlobalUniforms {uProjectionMatrix:mat3x3<f32>,uWorldTransformMatrix:mat3x3<f32>,uWorldColorAlpha:vec4<f32>,uResolution:vec2<f32>}
 struct LocalUniforms {uTransformMatrix:mat3x3<f32>,uColor:vec4<f32>,uRound:f32}
 struct PortalUniforms {uTint:vec4<f32>,uPolar:vec4<f32>}
 @group(0) @binding(0) var<uniform> globalUniforms:GlobalUniforms;
 @group(1) @binding(0) var<uniform> localUniforms:LocalUniforms;
 @group(2) @binding(0) var<uniform> portalUniforms:PortalUniforms;
 struct Out {@builtin(position) position:vec4<f32>,@location(0) uv:vec2<f32>,@location(1) color:vec4<f32>}
 @vertex fn mainVertex(@location(0) aPosition:vec2<f32>,@location(1) aUV:vec2<f32>)->Out{
  var o:Out;
  let p=globalUniforms.uProjectionMatrix*globalUniforms.uWorldTransformMatrix*localUniforms.uTransformMatrix*vec3<f32>(aPosition,1.);
  o.position=vec4<f32>(p.xy,0.,1.);o.uv=aUV;o.color=globalUniforms.uWorldColorAlpha*localUniforms.uColor;return o;
 }
 @fragment fn mainFragment(v:Out)->@location(0) vec4<f32>{
  let uTint=portalUniforms.uTint;let uPolar=portalUniforms.uPolar;
  let p=v.uv*2.-1.;let r=length(p);let a=atan2(p.y,p.x+0.000001);
  let wave=0.5+0.5*sin(2.*a-2.*uPolar.x+9.*r+uPolar.y*3.*sin(4.*a+6.*r));
  var shape=0.;var light=0.;
  if(uPolar.w==0.){
   shape=(1.-smoothstep(0.72,1.,r))*(0.18+0.54*wave)*smoothstep(0.,0.15,r);
   light=0.45+0.55*wave;
  }else{
   let d=abs(r+uPolar.w);let w=max(uPolar.y,0.0001);
   shape=(1.-smoothstep(0.,w,d))*(0.55+0.45*wave);
   shape=max(shape,0.22*uPolar.z*(1.-smoothstep(w,2.5*w,d)));
   light=0.65+0.35*wave;
  }
  let alpha=clamp(shape*uTint.a,0.,1.);
  let rgb=mix(uTint.rgb,vec3<f32>(1.),clamp(light*uPolar.z*0.35,0.,0.85));
  return vec4<f32>(rgb*alpha,alpha)*v.color;
 }`;
 const color=rgba=>(Math.round(rgba[0])<<16)|(Math.round(rgba[1])<<8)|Math.round(rgba[2]);
 const validGeometry=(x,y,r)=>[x,y,r].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e30);
 function createPortal({PIXI,host,settings}){
  if(!P||!PIXI||typeof PIXI.Mesh!=='function'||!host||host.destroyed)throw TypeError('GAME-06 requires a live Pixi host');
  let plan=P.compile(settings),dead=false,time=0,poses={},last=null,current=null,totalCreated=0;
  const wrapper=new PIXI.Container();wrapper.label='GAME-06 portal';
  function alive(){if(dead||wrapper.destroyed||host.destroyed)throw Error('GAME-06 renderer destroyed');}
  function release(tree){
   if(!tree)return;
   tree.root.removeFromParent();
   for(const r of tree.resources){r.mesh.removeFromParent();r.mesh.destroy();r.shader.destroy();r.geometry.destroy();}
   tree.root.destroy({children:true});
  }
  function mesh(tree,surface){
   const geometry=new PIXI.MeshGeometry({positions:new Float32Array([-1,-1,1,-1,1,1,-1,1]),uvs:new Float32Array([0,0,1,0,1,1,0,1])});
   let shader,view;
   try{
    shader=new PIXI.Shader({
     glProgram:PIXI.GlProgram.from({vertex,fragment,name:'portal-polar'}),
     gpuProgram:PIXI.GpuProgram.from({vertex:{source:gpu,entryPoint:'mainVertex'},fragment:{source:gpu,entryPoint:'mainFragment'},name:'portal-polar'}),
     resources:{portalUniforms:{uTint:{value:new Float32Array(4),type:'vec4<f32>'},uPolar:{value:new Float32Array(4),type:'vec4<f32>'}}}
    });
    view=new PIXI.Mesh({geometry,shader});view.visible=false;
    surface.addChild(view);tree.resources.push({mesh:view,geometry,shader});totalCreated++;return view;
   }catch(error){if(view)view.destroy();if(shader)shader.destroy();geometry.destroy();throw error;}
  }
  function makeTree(p){
   const tree={root:new PIXI.Container(),rows:new Map(),resources:[]};
   try{
    for(const e of p.settings.emitters){
     const owner=new PIXI.Container(),layers={};owner.label=e.id;tree.root.addChild(owner);
     for(const k of ORDER){
      const surface=new PIXI.Container();surface.label=k;owner.addChild(surface);
      const l=e.layers[k],active=e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
      const view=active&&k!=='particles'?mesh(tree,surface):null;
      const accents=active&&k!=='aperture'?new PIXI.Graphics():null;
      if(accents){surface.addChild(accents);totalCreated++;}
      layers[k]={surface,view,accents};
     }
     tree.rows.set(e.id,layers);
    }return tree;
   }catch(error){release(tree);throw error;}
  }
  function drawSurface(view,p,k){
   if(!view)return;
   view.visible=false;if(!p)return;
   const rim=k==='rim',extent=rim?p.radius+p.width*2.5:p.radius;
   if(!validGeometry(p.x,p.y,extent)||extent<=0)return;
   view.position.set(p.x,p.y);view.scale.set(extent);view.rotation=p.rotation*DEG;view.blendMode=p.blend;
   const uniforms=view.shader.resources.portalUniforms;
   uniforms.uniforms.uTint.set([p.rgba[0]/255,p.rgba[1]/255,p.rgba[2]/255,p.rgba[3]]);
   uniforms.uniforms.uPolar.set([p.phaseDegrees*DEG,rim?p.width/extent:p.warp,p.glow,rim?-p.radius/extent:0]);
   uniforms.update();view.visible=true;
  }
  function drawAccents(g,items,k){
   if(!g)return;g.clear();g.visible=false;if(!items.length)return;
   g.blendMode=items[0].blend;
   if(k==='rim'){
    const p=items[0];
    for(const r of p.runes){
     if(!validGeometry(r.x,r.y,r.width)||r.width<=0)continue;
     const a=r.angle*DEG,s=r.width*(0.1+0.15*r.accent),dx=Math.cos(a)*s,dy=Math.sin(a)*s;
     g.poly([r.x+dx*2,r.y+dy*2,r.x-dy,r.y+dx,r.x-dx*2,r.y-dy*2,r.x+dy,r.y-dx],true).fill({color:color(p.rgba),alpha:p.rgba[3]*(0.4+0.6*r.accent)});
    }
   }else for(const p of items){
    if(!validGeometry(p.x,p.y,p.radius)||p.radius<=0)continue;
    if(p.glow>0)g.circle(p.x,p.y,p.radius*1.8).fill({color:color(p.rgba),alpha:p.rgba[3]*p.glow*.15});
    g.circle(p.x,p.y,p.radius).fill({color:color(p.rgba),alpha:p.rgba[3]});
   }
   g.visible=true;
  }
  function paint(tree,snapshot){
   for(const row of snapshot.emitters)for(const k of ORDER){
    const l=tree.rows.get(row.id)[k],items=row.layers[k];l.surface.visible=items.length>0;
    drawSurface(l.view,items[0],k);drawAccents(l.accents,items,k);
   }
  }
  function seek(t,nextPoses=poses){
   alive();if(!nextPoses||typeof nextPoses!=='object'||Array.isArray(nextPoses))throw TypeError('GAME-06 pose map required');
   const copy=Object.fromEntries(Object.entries(nextPoses).map(([k,v])=>[k,v?{...v}:null]));
   const snapshot=plan.sample(t,copy);paint(current,snapshot);time=t;poses=copy;last=snapshot;return snapshot;
  }
  function configure(input){
   alive();const compiled=P.compile(input),snapshot=compiled.sample(time,poses);let candidate;
   try{candidate=makeTree(compiled);paint(candidate,snapshot);wrapper.addChild(candidate.root);}
   catch(error){release(candidate);throw error;}
   const previous=current;current=candidate;plan=compiled;last=snapshot;release(previous);return plan.settings;
  }
  function destroy(){if(dead)return;dead=true;release(current);current=null;wrapper.removeFromParent();if(!wrapper.destroyed)wrapper.destroy({children:true});}
  try{current=makeTree(plan);last=plan.sample(0,poses);paint(current,last);wrapper.addChild(current.root);host.addChild(wrapper);}
  catch(error){destroy();throw error;}
  return Object.freeze({seek,configure,destroy,get owned(){return wrapper},get settings(){return plan.settings},get sample(){return last},get totalCreated(){return totalCreated}});
 }
 return {VERSION:1,createPortal};
});
