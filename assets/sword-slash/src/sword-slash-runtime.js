// GAME-03 S02. Native Pixi mesh with a per-section premultiplied RGBA ramp.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSwordSlashRuntime=api;
})(globalThis,function(){
 'use strict';
 const ORDER=['residual','main','edge'],MAX=512,MAX_RUNS=120,MAX_SPARKS=64;
 const fail=m=>{throw Error('Sword Slash renderer: '+m);},finite=Number.isFinite;
 function number(v,a,b){if(!finite(v)||v<a||v>b)fail('invalid number');return v;}
 function rgba(v){if(!Array.isArray(v)||v.length!==4)fail('RGBA');for(let i=0;i<4;i++)number(v[i],0,i===3?1:255);return v;}
 function ribbon(p){
  const n=p.sections?.length;if(!Number.isInteger(n)||n<2||n>MAX||!Array.isArray(p.positions)||p.positions.length!==n*4||!Array.isArray(p.uvs)||p.uvs.length!==n*4||!Array.isArray(p.colors)||p.colors.length!==n*8||!Array.isArray(p.indices)||p.indices.length!==(n-1)*6)fail('ribbon shape');
  const positions=Float32Array.from(p.positions,x=>number(x,-2e6,2e6)),uvs=new Float32Array(n*4),indices=new Uint16Array(p.indices.length),ramp=new Uint8Array(MAX*4);
  for(let i=0;i<n;i++){
   const c=rgba(p.sections[i].rgba),a=c[3],offset=i*8;
   for(let j=0;j<8;j++)if(p.colors[offset+j]!==c[j%4])fail('inconsistent vertex color');
   const u=(i+.5)/MAX;uvs.set([u,.5,u,.5],i*4);ramp.set([Math.round(c[0]*a),Math.round(c[1]*a),Math.round(c[2]*a),Math.round(a*255)],i*4);
   if(i+1<n){const v=i*2;const expected=[v,v+1,v+2,v+1,v+3,v+2];for(let j=0;j<6;j++){if(p.indices[i*6+j]!==expected[j])fail('strip indices');indices[i*6+j]=expected[j];}}
  }
  return {positions,uvs,indices,ramp,blend:p.blend,n};
 }
 function jobs(sample){
  if(!sample||typeof sample!=='object'||Object.keys(sample).length!==3)fail('sample shape');
  return Object.fromEntries(ORDER.map(k=>{
   const list=sample[k];if(!Array.isArray(list)||list.length>MAX_RUNS+MAX_SPARKS)fail('layer budget');const ribbons=[],sparks=[];let sections=0;
   for(const p of list){
    if(!p||!['normal','add'].includes(p.blend))fail('blend');
    if(p.kind==='ribbon'){const r=ribbon(p);sections+=r.n;if(sections>MAX||ribbons.length>=MAX_RUNS)fail('ribbon budget');ribbons.push(r);}
    else if(p.kind==='spark'&&k==='residual'){if(sparks.length>=MAX_SPARKS)fail('spark budget');const [r,g,b,a]=rgba(p.rgba);sparks.push({x:number(p.x,-2e6,2e6),y:number(p.y,-2e6,2e6),radius:number(p.radius,0,100),tint:(Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b),alpha:a,blend:p.blend});}
    else fail('primitive kind');
   }
   return [k,{ribbons,sparks}];
  }));
 }
 function createRenderer({PIXI,host,compile,settings}){
  if(!host||host.destroyed||typeof host.addChild!=='function'||typeof compile!=='function'||['Container','Graphics','Mesh','MeshGeometry','BufferImageSource','Texture'].some(k=>typeof PIXI?.[k]!=='function'))fail('dependencies');
  let current=null,seconds=0,last=null,dead=false;
  function live(){if(dead||host.destroyed)fail('destroyed');}
  function release(e){if(!e.view.destroyed){e.view.removeFromParent();e.view.destroy({texture:false,textureSource:false});}if(e.geometry&&!e.geometry.destroyed)e.geometry.destroy();if(e.texture&&!e.texture.destroyed)e.texture.destroy(true);}
  function dispose(g){if(!g)return;for(const layer of Object.values(g.layers))for(const e of [...layer.ribbons,...layer.sparks])release(e);if(!g.group.destroyed){g.group.removeFromParent();g.group.destroy({children:true});}}
  function prepare(config){const plan=compile(config);if(!plan||typeof plan.sample!=='function')fail('plan');const group=new PIXI.Container(),layers={};group.label='GAME-03 Sword Slash';group.eventMode='none';
   try{for(const k of ORDER){const layer=new PIXI.Container();layer.label=k;group.addChild(layer);layers[k]={layer,ribbons:[],sparks:[]};}return {plan,group,layers};}
   catch(e){dispose({group,layers});throw e;}
  }
  function newRibbon(layer,j){
   let source,texture,geometry,view;
   try{
    source=new PIXI.BufferImageSource({resource:j.ramp.slice(),width:MAX,height:1,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false});
    texture=new PIXI.Texture({source});geometry=new PIXI.MeshGeometry({positions:j.positions,uvs:j.uvs,indices:j.indices,topology:'triangle-list'});
    view=new PIXI.Mesh({geometry,texture});view.eventMode='none';layer.addChild(view);return {view,geometry,texture,source};
   }catch(e){if(view)view.destroy({texture:false,textureSource:false});if(geometry)geometry.destroy();if(texture)texture.destroy(true);else if(source)source.destroy();throw e;}
  }
  function paint(g,t){
   const sample=g.plan.sample(t),work=jobs(sample);
   try{
    for(const k of ORDER){const l=g.layers[k],w=work[k];
     for(let i=0;i<w.ribbons.length;i++){
      const j=w.ribbons[i];let e=l.ribbons[i];
      if(!e){e=newRibbon(l.layer,j);l.ribbons.push(e);}else{
       e.geometry.positions=j.positions;e.geometry.uvs=j.uvs;e.geometry.indices=j.indices;
       e.source.resource.set(j.ramp);e.source.update();
      }
      e.view.blendMode=j.blend;e.view.visible=true;
     }
     for(let i=w.ribbons.length;i<l.ribbons.length;i++)l.ribbons[i].view.visible=false;
     for(let i=0;i<w.sparks.length;i++){
      const j=w.sparks[i];let e=l.sparks[i];
      if(!e){const view=new PIXI.Graphics();try{view.circle(0,0,1).fill(0xffffff);l.layer.addChild(view);e={view};l.sparks.push(e);}catch(err){view.destroy();throw err;}}
      e.view.position.set(j.x,j.y);e.view.scale.set(j.radius);e.view.tint=j.tint;e.view.alpha=j.alpha;e.view.blendMode=j.blend;e.view.visible=j.alpha>0&&j.radius>0;
     }
     for(let i=w.sparks.length;i<l.sparks.length;i++)l.sparks[i].view.visible=false;
    }
    g.group.visible=true;return sample;
   }catch(e){g.group.visible=false;throw e;}
  }
  function configure(next){live();const staged=prepare(next);let result;try{result=paint(staged,seconds);host.addChild(staged.group);}catch(e){dispose(staged);throw e;}const old=current;current=staged;last=result;dispose(old);return staged.plan.settings;}
  function seek(t){live();number(t,0,3600);const r=paint(current,t);seconds=t;last=r;return r;}
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;}
  configure(settings);
  return Object.freeze({configure,seek,destroy,get owned(){return current?.group??null;},get settings(){return current?.plan.settings??null;},get sample(){return last;},get meta(){return current?.plan.meta??null;},get allocated(){return current?Object.values(current.layers).reduce((n,l)=>n+l.ribbons.length+l.sparks.length,0):0;}});
 }
 return {VERSION:1,createRenderer};
});
