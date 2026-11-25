// GAME-11 D02: detached source capture, fixed-world compositing and owned debris pool.
(function(root,factory){const api=Object.freeze(factory(root));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDissolveRuntime=api;})(globalThis,function(root){
 'use strict';
 const fail=m=>{throw Error('Dissolve runtime: '+m);},MAX_ALPHA_BYTES=64*1024*1024;
 const load=(k,p)=>root[k]||(typeof require==='function'?require(p):null);
 async function createDissolve({PIXI,renderer,source,front,behind,settings,backend,poseFrame,env=globalThis,signal}){
  const D=load('FxDissolve','./dissolve-core.js'),S=load('FxDissolveSurface','./dissolve-surface.js'),H=load('FxDissolveShader','./dissolve-shader.js');
  if(!D||!S||!H||!front||!behind||front===behind||source===front||source===behind||front.destroyed||behind.destroyed)fail('invalid hosts/dependencies');
  let current=null,dead=false,busy=false,time=0,last=null,totalCreated=0;
  const abort=s=>{if(s?.aborted)fail('cancelled');};
  function dispose(b){if(!b)return;const errors=[],run=f=>{try{f()}catch(e){errors.push(e);}};
   run(()=>{if(!b.input)return;b.input.filters=null;b.input.destroy({texture:false,textureSource:false});});
   for(const sprite of b.pool)run(()=>sprite.destroy({texture:false,textureSource:false}));
   for(const group of [b.front,b.behind])run(()=>group.destroy({children:false}));
   run(()=>b.display?.destroy({texture:false,textureSource:false}));run(()=>b.shader?.destroy());run(()=>b.surface?.destroy());for(const t of b.outputs)run(()=>t.destroy(true));run(()=>b.debrisTexture?.destroy(true));if(errors.length)throw new AggregateError(errors,'Dissolve cleanup failed');
  }
  async function build(config,s){
   const plan=D.compile(config),c=plan.settings;if(c.emitters.some(e=>e.enabled&&e.visible&&['mask','edge'].some(k=>e.layers[k].enabled&&e.layers[k].visible&&e.layers[k].alpha>0&&e.layers[k].placement!=='front')))fail('mask and edge are source-bound; only debris supports behind placement');const frames=[...new Set(plan.schedules.flatMap(row=>row.births.map(x=>x.frame)))].sort((a,b)=>a-b);
   if(frames.length*c.rect.width*c.rect.height>MAX_ALPHA_BYTES)fail('birth alpha cache budget');
   const b={plan,front:new PIXI.Container(),behind:new PIXI.Container(),pool:[],outputs:[],index:0,display:null,input:null,surface:null,shader:null,debrisTexture:null,prepared:null};
   try{b.surface=S.create({PIXI,renderer,source,rect:c.rect,backend,poseFrame,env});b.shader=H.create(PIXI,b.surface.limit);b.input=new PIXI.Sprite(b.surface.target);b.input.filters=[b.shader.filter];
    for(let i=0;i<2;i++)b.outputs.push(PIXI.RenderTexture.create({width:c.rect.width,height:c.rect.height,resolution:1,antialias:false}));
    b.display=new PIXI.Sprite(b.outputs[0]);b.display.position.set(c.rect.x,c.rect.y);b.front.addChild(b.display);
    const data=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const dx=(x-7.5)/8,dy=(y-7.5)/8,dist=c.style==='stylized'?Math.max(Math.abs(dx),Math.abs(dy)):c.style==='magical'?Math.abs(dx)+Math.abs(dy):Math.hypot(dx,dy);const a=Math.round(255*Math.max(0,Math.min(1,(1-dist)*3)));data.fill(a,(y*16+x)*4,(y*16+x)*4+4);}
    b.debrisTexture=new PIXI.Texture({source:new PIXI.BufferImageSource({resource:data,width:16,height:16,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:false})});
    const count=plan.reserved-c.emitters.reduce((n,e)=>n+['mask','edge'].filter(k=>e.enabled&&e.visible&&e.layers[k].enabled&&e.layers[k].visible&&e.layers[k].alpha>0).length,0);
    for(let i=0;i<count;i++){const p=new PIXI.Sprite(b.debrisTexture);p.anchor.set(.5);p.visible=false;b.pool.push(p);totalCreated++;b.front.addChild(p);}
    const cache=new Map();for(const frame of frames){abort(s);const poses=await b.surface.capture(frame,s),alpha=await b.surface.readAlpha(s);cache.set(frame,{alpha,poses:JSON.parse(JSON.stringify(poses))});}b.prepared=plan.prepare(f=>cache.get(f)||null);cache.clear();
    return b;
   }catch(e){try{dispose(b);}catch(cleanup){throw new AggregateError([e,cleanup],'Dissolve initialization failed');}throw e;}
  }
  async function paint(b,t,s){abort(s);const c=b.plan.settings,end=(c.durationFrames-1)/60,seconds=Math.min(t,end),frame=Math.min(c.durationFrames-1,Math.floor(seconds*60+1e-8));const poses=await b.surface.capture(frame,s);const sample=b.prepared.sample(seconds,poses);if(sample.particles.length>b.pool.length)fail('debris budget');
   b.shader.update(c,seconds,sample.states);abort(s);
   const next=1-b.index,target=b.outputs[next];renderer.render({container:b.input,target,clear:true,clearColor:[0,0,0,0]});
   abort(s);b.display.texture=target;b.index=next;for(const p of b.pool)p.visible=false;
   for(const [i,p] of sample.particles.entries()){const sprite=b.pool[i],group=p.placement==='behind'?b.behind:b.front;if(sprite.parent!==group)group.addChild(sprite);sprite.position.set(p.x,p.y);sprite.width=sprite.height=p.radius*2;sprite.tint=(Math.round(p.rgba[0])<<16)|(Math.round(p.rgba[1])<<8)|Math.round(p.rgba[2]);sprite.alpha=p.rgba[3];sprite.blendMode=p.blend;sprite.visible=true;}
   return sample;
  }
  async function replace(config,s){const b=await build(config,s);try{const result=await paint(b,time,s);behind.addChild(b.behind);front.addChild(b.front);const old=current;current=b;last=result;dispose(old);return b.plan.settings;}catch(e){if(current!==b)dispose(b);throw e;}}
  try{await replace(settings,signal);}catch(e){throw e;}
  async function locked(fn){if(dead||busy)fail('runtime unavailable');busy=true;try{return await fn();}finally{busy=false;}}
  async function seek(t,s){if(!Number.isFinite(t)||t<0||t>1e6)fail('invalid time');return locked(async()=>{const result=await paint(current,t,s);time=t;last=result;return result;});}
  async function configure(config,s){return locked(()=>replace(config,s));}
  function destroy(){if(dead)return;if(busy)fail('runtime busy');dead=true;try{dispose(current);}finally{current=null;last=null;}}
  return Object.freeze({seek,configure,destroy,get settings(){return current?.plan.settings??null;},get sample(){return last;},get stats(){return {allocated:current?.pool.length??0,visible:last?.particles.length??0,totalCreated,captures:current?.surface.count??0,requested:current?.prepared.requested??0,emitted:current?.prepared.emitted??0,dropped:current?.prepared.dropped??0};}});
 }
 return {createDissolve,MAX_ALPHA_BYTES};
});
