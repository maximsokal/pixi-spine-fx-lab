// EARTH-04 L02: native Pixi sprites, shared bounded pool and offline textures.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(root.FxLeaves||(typeof require==='function'?require('./leaves-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLeavesRuntime=api;
})(globalThis,function(Leaves){
 'use strict';
 const SIZE=64,DEG=Math.PI/180,ORDER=['background','foreground','gusts'];
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Premultiplied RGBA: zero RGB outside the mask. Grayscale veins are
 // modulated by the core's per-particle tint, without an additional alpha pass.
 function maskRGBA(shape){
  if(!Number.isInteger(shape)||shape<0||shape>3)throw RangeError('EARTH-04 invalid texture shape');
  const data=new Uint8Array(SIZE*SIZE*4);
  function shade(x,y){
   if(shape===3){
    const t=(x+.84)/1.68;
    if(t<=0||t>=1)return 0;
    const mid=.16*Math.sin(Math.PI*t),h=.12*Math.sin(Math.PI*t);
    return Math.abs(y-mid)>h?0:255;
   }
   const t=(y+.86)/1.72;if(t<=0||t>=1)return 0;
   const s=Math.sin(Math.PI*t);
   let half=[.68*s**.72,.77*s**.55,.53*s**.98][shape];
   if(shape===1)half*=.88+.12*Math.cos(t*12*Math.PI);
   const mid=(shape-1)*.11*Math.sin(Math.PI*t);
   if(Math.abs(x-mid)>half)return 0;
   if(Math.abs(x-mid)<.024)return 133;
   const vein=Math.abs((t*7+Math.abs(x-mid)*1.8)%1-.5);
   return vein<.045&&Math.abs(x-mid)<half*.85?184:242;
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   let coverage=0,sum=0;
   for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
    const v=shade((x+(sx+.5)/4)/SIZE*2-1,(y+(sy+.5)/4)/SIZE*2-1);
    if(v){coverage++;sum+=v;}
   }
   const i=(y*SIZE+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(sum/16);
   data[i+3]=Math.round(coverage*255/16);
  }
  return data;
 }
 function createLeaves({PIXI,app,host,model=null,settings,worldOffset={x:0,y:0}}){
  const stage=app?.stage;
  if(!Leaves||!stage||!host||host.parent!==stage||host.x!==0||host.y!==0||
   host.rotation!==0||host.scale.x!==1||host.scale.y!==1||!finite(worldOffset))
   throw TypeError('EARTH-04 requires identity stage-owned host and finite crop offset');
  for(const k of ['Container','Sprite','Texture','BufferImageSource'])
   if(typeof PIXI?.[k]!=='function')throw TypeError('EARTH-04 missing PixiJS '+k);
  const offset={...worldOffset},textures=[],pool=[],owned={};
  let cfg=Leaves.normalize(settings),dead=false,last=null,clock=0,totalCreated=0,totalActive=0,bounds=null;
  function guard(){if(dead)throw Error('EARTH-04 renderer destroyed');}
  function texture(i){
   const source=new PIXI.BufferImageSource({resource:maskRGBA(i),width:SIZE,height:SIZE,
    format:'rgba8unorm',alphaMode:'premultiplied-alpha',autoGenerateMipmaps:false});
   try{return new PIXI.Texture({source});}catch(e){source.destroy();throw e;}
  }
  function fromModel(m,x,y){
   if(!m||!Number.isFinite(x)||!Number.isFinite(y))return null;
   const p=stage.toLocal(m.toGlobal({x,y}));return finite(p)?p:null;
  }
  function attachmentOrigin(slot,a,bone){
   const at=slot.getAttachment?.();if(!at||at.name!==a.name)return null;
   if(typeof at.computeWorldPosition==='function'){
    const p=at.computeWorldPosition(bone,{x:0,y:0});return finite(p)?p:null;
   }
   if(typeof at.computeWorldVertices!=='function')return null;
   const count=at.worldVerticesLength??8;
   if(!Number.isInteger(count)||count<2||count%2||count>65536)return null;
   const v=new Float32Array(count);v.fill(NaN);
   try{
    if(at.worldVerticesLength!==undefined)at.computeWorldVertices(slot,0,count,v,0,2);
    else at.computeWorldVertices(slot,v,0,2);
   }catch{return null;}
   let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
   for(let i=0;i<count;i+=2){
    if(!Number.isFinite(v[i])||!Number.isFinite(v[i+1]))return null;
    l=Math.min(l,v[i]);r=Math.max(r,v[i]);t=Math.min(t,v[i+1]);b=Math.max(b,v[i+1]);
   }
   return {x:(l+r)/2,y:(t+b)/2};
  }
  function resolve(a,m=model){
   if(a.type==='world')return {x:a.x+offset.x,y:a.y+offset.y,rotation:a.rotation};
   const sk=m?.skeleton;if(!sk)return null;
   let origin={x:0,y:0},axis={x:1,y:0},vertical={x:0,y:1};
   if(a.type!=='skeleton'){
    let bone,slot;
    if(a.type==='bone')bone=sk.findBone(a.name);
    else{slot=sk.findSlot(a.type==='attachment'?a.slot:a.name);bone=slot?.bone;}
    if(!bone?.active)return null;
    origin=a.type==='attachment'?attachmentOrigin(slot,a,bone):{x:bone.worldX,y:bone.worldY};
    if(!finite(origin))return null;
    axis={x:bone.a,y:bone.c};vertical={x:bone.b,y:bone.d};
   }
   if(a.space==='world'){
    const p=fromModel(m,origin.x,origin.y);
    return p?{x:p.x+a.x,y:p.y+a.y,rotation:a.rotation}:null;
   }
   const x=origin.x+axis.x*a.x+vertical.x*a.y,y=origin.y+axis.y*a.x+vertical.y*a.y;
   const p=fromModel(m,x,y),q=fromModel(m,x+axis.x,y+axis.y);
   if(!p||!q||Math.hypot(q.x-p.x,q.y-p.y)<1e-10)return null;
   return {x:p.x,y:p.y,rotation:a.rotation+Math.atan2(q.y-p.y,q.x-p.x)/DEG};
  }
  function sample(next,seconds,m){
   const anchors=Object.create(null);
   for(const e of next.emitters)anchors[e.id]=resolve(e.anchor,m);
   return Leaves.sample(next,seconds,anchors);
  }
  function reserve(count){
   const staged=[];
   try{
    while(pool.length+staged.length<count){
     const s=new PIXI.Sprite(textures[0]);staged.push(s);s.anchor.set(.5,.5);s.visible=false;
    }
   }catch(e){for(const s of staged)s.destroy();throw e;}
   pool.push(...staged);totalCreated+=staged.length;
  }
  function draw(frame,quality){
   const count=frame.counters.particles;reserve(count);
   let n=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   // Sample positions are already stage-local; no second emitter transform.
   // Maintain painter order without reparenting unchanged sprites on every tick.
   for(const kind of ORDER){
    const surface=owned[kind];let index=0;
    for(const e of frame.emitters)for(const v of e.layers[kind]){
     const s=pool[n++],shape=v.kind==='gust'?3:clamp(Math.floor(v.shape*3),0,2);
     if(s.parent!==surface)surface.addChildAt(s,index);
     else if(surface.children[index]!==s)surface.setChildIndex(s,index);
     index++;
     if(s.texture!==textures[shape])s.texture=textures[shape];
     s.position.set(v.x,v.y);s.rotation=v.rotation*DEG;s.width=v.width;s.height=v.height;
     s.tint=Number.parseInt(v.tint.slice(1),16);s.alpha=v.alpha;s.blendMode=v.blend;s.visible=true;
     const co=Math.abs(Math.cos(s.rotation)),si=Math.abs(Math.sin(s.rotation)),
      w=(co*v.width+si*v.height)/2,h=(si*v.width+co*v.height)/2;
     left=Math.min(left,v.x-w);right=Math.max(right,v.x+w);top=Math.min(top,v.y-h);bottom=Math.max(bottom,v.y+h);
    }
   }
   for(let i=n;i<pool.length;i++){pool[i].visible=false;pool[i].removeFromParent();}
   const limit=Leaves.BUDGETS[quality];while(pool.length>limit)pool.pop().destroy();
   totalActive=n;bounds=n?{x:left,y:top,width:right-left,height:bottom-top}:null;
  }
  function apply(next,seconds,m){
   const frame=sample(next,seconds,m);draw(frame,next.quality);
   cfg=next;model=m;clock=seconds;last=frame;return frame;
  }
  function seek(seconds){guard();return apply(cfg,seconds,model);}
  function configure(next){guard();apply(Leaves.normalize(next),clock,model);return Leaves.normalize(cfg);}
  function setModel(m){guard();return apply(cfg,clock,m);}
  function destroy(){
   if(dead)return;dead=true;
   for(const s of pool)s.destroy();pool.length=0;
   for(const g of Object.values(owned))g.destroy({children:true});
   for(const t of textures)t.destroy(true);
   textures.length=0;totalActive=0;bounds=null;last=null;
  }
  try{
   for(let i=0;i<4;i++)textures.push(texture(i));
   for(const k of ORDER){const g=new PIXI.Container();g.label='EARTH-04 '+k;owned[k]=g;}
   stage.addChildAt(owned.background,stage.getChildIndex(host));
   stage.addChildAt(owned.foreground,stage.getChildIndex(host)+1);
   stage.addChildAt(owned.gusts,stage.getChildIndex(host)+2);seek(0);
  }catch(e){try{destroy();}catch(cleanup){throw new AggregateError([e,cleanup],'EARTH-04 initialization cleanup failed');}throw e;}
  return Object.freeze({seek,configure,setModel,destroy,resolveAnchor:a=>{guard();return resolve(a);},
   currentBounds:()=>bounds?{...bounds}:null,get settings(){return Leaves.normalize(cfg);},get sample(){return last;},
   get diagnostics(){return last?.diagnostics.slice()??[];},get owned(){return {...owned};},get sceneSource(){return host;},
   get totalActive(){return totalActive;},get totalCreated(){return totalCreated;},get totalAllocated(){return pool.length;}});
 }
 return {createLeaves,maskRGBA};
});
