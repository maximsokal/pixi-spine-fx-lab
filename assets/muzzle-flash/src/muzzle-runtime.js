// GAME-01 M02a: bounded Pixi 8 graphics adapter, no clock or Spine ownership.
(function(root,make){
 'use strict';
 const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzleRuntime=api;
})(globalThis,function(){
 'use strict';
 const ORDER=['smoke','tongues','core','sparks'],CAPS={core:1,tongues:20,sparks:50,smoke:16};
 function fail(s){throw Error('Muzzle renderer: '+s);}
 function number(n,min,max){if(!Number.isFinite(n)||n<min||n>max)fail('invalid numeric primitive');return n;}
 function point(p){if(!p)fail('missing point');return [number(p.x,-2e6,2e6),number(p.y,-2e6,2e6)];}
 function poseOf(p){if(p===null)return null;const [x,y]=point(p);return {x,y,rotation:number(p.rotation,-359640,359640)};}
 function color(v){
  if(!Array.isArray(v)||v.length!==4)fail('invalid RGBA');
  const [r,g,b,a]=Array.from(v,(n,i)=>number(n,0,i===3?1:255));
  return {tint:(Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b),alpha:a};
 }
 function polygon(points){
  const out=[];
  for(const p of points){const [x,y]=point(p);if(out.length&&x===out.at(-2)&&y===out.at(-1))continue;out.push(x,y);}
  if(out.length>=4&&out[0]===out.at(-2)&&out[1]===out.at(-1))out.splice(-2);
  if(out.length<6)return null;
  let area=0;const x0=out[0],y0=out[1];
  for(let i=2;i+3<out.length;i+=2)area+=(out[i]-x0)*(out[i+3]-y0)-(out[i+1]-y0)*(out[i+2]-x0);
  return Math.abs(area)>1e-9?out:null;
 }
 function primitive(k,p){
  if(!p)fail('missing primitive');const c=color(p.rgba),blend=p.blend===undefined?'normal':p.blend;
  if(!['normal','add'].includes(blend))fail('blend');c.blend=blend;
  if(k==='smoke'){const [x,y]=point(p);return {...c,shape:'smoke',x,y,size:number(p.radius,0,500)};}
  if(k==='sparks'){
   const [x,y]=point(p),age=number(p.age,0,1);return {...c,shape:'dot',x,y,size:2.5*(1-.6*age)};
  }
  let outline;
  if(k==='core'){
   const v=p.vertices;if(!Array.isArray(v)||v.length<4||v.length>256||v.length%2)fail('invalid ribbon');
   const left=[],right=[];
   for(let i=0;i<v.length;i+=2){left.push(v[i]);right.push(v[i+1]);}
   outline=polygon(left.concat(right.reverse()));
  }else{
   const [x,y]=point(p.origin),[tx,ty]=point(p.tip),w=number(p.width,0,100),len=Math.hypot(tx-x,ty-y);
   if(len<=1e-9)return null;
   const nx=-(ty-y)/len*w/2,ny=(tx-x)/len*w/2,mx=x+(tx-x)*.35,my=y+(ty-y)*.35;
   outline=polygon([{x,y},{x:mx+nx,y:my+ny},{x:tx,y:ty},{x:mx-nx,y:my-ny}]);
  }
  return outline?{...c,shape:'polygon',outline}:null;
 }
 function jobsFor(result){
  if(!result||typeof result!=='object')fail('invalid sample');
  const jobs={};for(const k of ORDER){
   const list=k==='smoke'&&result[k]===undefined?[]:result[k];if(!Array.isArray(list)||list.length>CAPS[k])fail('layer budget '+k);
   jobs[k]=Array.from(list,p=>primitive(k,p)).filter(p=>p&&p.alpha>0);
  }return jobs;
 }
 function createRenderer({PIXI,host,compile,settings}){
  if(!PIXI||typeof PIXI.Container!=='function'||typeof PIXI.Graphics!=='function'||
   !host||host.destroyed||typeof host.addChild!=='function'||typeof compile!=='function')fail('dependencies');
  let current=null,dead=false,seconds=0,pose={x:256,y:256,rotation:0},last=null;
  function live(){if(dead||host.destroyed)fail('destroyed');}
  function release(g){g.removeFromParent();g.destroy();}
  function dispose(g){if(!g)return;g.group.removeFromParent();g.group.destroy({children:true});}
  function prepare(config){
   const plan=compile(config);if(!plan||typeof plan.sample!=='function')fail('invalid plan');
   const group=new PIXI.Container(),layers={};group.label='GAME-01 muzzle flash';
   try{for(const k of ORDER){const layer=new PIXI.Container();layer.label=k;group.addChild(layer);layers[k]={layer,pool:[]};}}
   catch(e){group.destroy({children:true});throw e;}
   return {plan,group,layers};
  }
  function paint(g,t,p){
   const result=p===null?null:g.plan.sample(t,p),jobs=result===null?{core:[],tongues:[],sparks:[],smoke:[]}:jobsFor(result);
   const added=[];
   try{for(const k of ORDER){const {pool,layer}=g.layers[k];for(let i=pool.length;i<jobs[k].length;i++){
    const view=new PIXI.Graphics();view.visible=false;view.blendMode='normal';
    pool.push({view,key:null});added.push({pool,view});layer.addChild(view);
   }}}catch(e){for(const {pool,view} of added.reverse()){pool.pop();release(view);}throw e;}
   for(const k of ORDER){const {pool}=g.layers[k];for(let i=0;i<pool.length;i++){
    const entry=pool[i],v=entry.view,j=jobs[k][i];v.visible=!!j;if(!j)continue;
    const key=j.shape==='polygon'?j.outline.join(','):j.shape;
    if(entry.key!==key){v.clear();
     if(j.shape==='smoke'){
      // Four reusable translucent concentric bands; no per-frame filter allocation.
      for(const [radius,alpha] of [[1,.08],[.78,.14],[.55,.22],[.3,.4]])v.circle(0,0,radius).fill({color:0xffffff,alpha});
     }else{if(j.shape==='dot')v.circle(0,0,1);else v.poly(j.outline,true);v.fill(0xffffff);}
     entry.key=key;
    }
    if(j.shape!=='polygon'){v.position.set(j.x,j.y);v.scale.set(j.size);}
    v.tint=j.tint;v.alpha=j.alpha;v.blendMode=j.blend;
   }}
   g.group.visible=p!==null;return result;
  }
  function configure(next){
   live();const staged=prepare(next);let result;
   try{result=paint(staged,seconds,pose);host.addChild(staged.group);}
   catch(e){dispose(staged);throw e;}
   const old=current;current=staged;last=result;dispose(old);return staged.plan.settings;
  }
  function seek(t,nextPose=pose){
   live();number(t,0,3600);const p=poseOf(nextPose),result=paint(current,t,p);
   seconds=t;pose=p;last=result;return last;
  }
  function destroy(){if(dead)return;dead=true;dispose(current);current=null;last=null;}
  configure(settings);
  return Object.freeze({configure,seek,destroy,get owned(){return current?.group??null;},
   get settings(){return current?.plan.settings??null;},get sample(){return last;},
   get allocated(){return current?ORDER.reduce((n,k)=>n+current.layers[k].pool.length,0):0;}});
 }
 return {VERSION:1,createRenderer};
});
