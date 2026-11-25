// GAME-07 T03a: pure authoring transactions and inverse camera/anchor mapping.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxDash||(typeof require==='function'?require('./dash-core.js'):null),root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDashEditorState=api;
})(globalThis,function(D,S){
 'use strict';
 const fail=m=>{throw RangeError('GAME-07 editor: '+m);},DEG=Math.PI/180,finite=Number.isFinite;
 const copy=v=>JSON.parse(JSON.stringify(v)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const identity=Object.freeze({x:0,y:0,rotation:0,scale:1});
 const valid=p=>p&&[p.x,p.y,p.rotation,p.scale].every(finite)&&p.scale>1e-10;
 const xy=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
 function row(c,id){const e=c.emitters.find(e=>e.id===id);if(!e)fail('unknown emitter');return e;}
 function target(e,k){if(k==='emitter')return e;if(!D.LAYERS.includes(k))fail('unknown layer');return e.layers[k];}
 function compose(p,t){if(!valid(p)||!valid(t))return null;const a=p.rotation*DEG,x=t.x*p.scale,y=t.y*p.scale,q={x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),rotation:p.rotation+t.rotation,scale:p.scale*t.scale};return valid(q)?q:null;}
 function basis(t,poses){const a=t.anchor;if(a.type==='world')return identity;const key=a.type==='local'?'$local':a.type==='bone'?a.name:null;return key&&poses&&Object.hasOwn(poses,key)&&valid(poses[key])?poses[key]:null;}
 function parentTransform(c,id,k,poses={}){const e=row(c,id),t=target(e,k);return t.anchor.type==='inherit'?compose(basis(e,poses),e):basis(t,poses);}
 function originTransform(c,id,k,poses={}){const e=row(c,id);return compose(parentTransform(c,id,k,poses),target(e,k));}
 function toLocal(p,world){if(!valid(p)||!xy(world))fail('missing or invalid anchor');const a=p.rotation*DEG,x=(world[0]-p.x)/p.scale,y=(world[1]-p.y)/p.scale;const q=[x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)];if(!xy(q))fail('invalid inverse transform');return q;}
 function toWorld(p,local){if(!valid(p)||!xy(local))fail('missing or invalid anchor');const a=p.rotation*DEG,x=local[0]*p.scale,y=local[1]*p.scale,q=[p.x+x*Math.cos(a)-y*Math.sin(a),p.y+x*Math.sin(a)+y*Math.cos(a)];if(!xy(q))fail('invalid forward transform');return q;}
 function screenToWorld(rect,point){if(!rect||![rect.left,rect.top,rect.width,rect.height].every(finite)||rect.width<=0||rect.height<=0||!xy(point))fail('invalid camera');const q=[(point[0]-rect.left)*512/rect.width,(point[1]-rect.top)*512/rect.height];if(!xy(q))fail('invalid camera projection');return q;}
 function prepared(c){return D.compile(c).settings;}
 function withPath(c,path){const next=copy(c);next.path=path;next.dashLength=S.buildArcTable(path).length;return prepared(next);}
 function scalePath(c,length){if(!finite(length)||length<10||length>600)fail('invalid dash length');const source=prepared(c),base=S.buildArcTable(source.path).length;if(!(base>0))fail('invalid path length');let factor=length/base;
  for(let i=0;i<6;i++){const path=copy(source.path);for(const s of path.segments)for(const k of ['p0','p1','p2','p3'])s[k]=s[k].map(v=>v*factor);const actual=S.buildArcTable(path).length;if(!(actual>0))fail('invalid scaled path');if(Math.abs(actual-length)<=.01){const next=copy(source);next.path=path;next.dashLength=length;return prepared(next);}factor*=length/actual;}
  fail('could not match requested arc length');
 }
 function movePathPoint(c,index,key,point){const path=copy(c.path),s=path.segments;if(!Number.isInteger(index)||index<0||index>=s.length||!['p0','p1','p2','p3'].includes(key)||!xy(point))fail('invalid path point');if(index===0&&key==='p0')fail('path origin is fixed; move emitter instead');s[index][key]=[...point];if(key==='p3'&&index+1<s.length)s[index+1].p0=[...point];if(key==='p0'&&index>0)s[index-1].p3=[...point];return withPath(c,path);}
 function splitPath(c,index,t=.5){const path=copy(c.path),s=path.segments;if(!Number.isInteger(index)||index<0||index>=s.length||!finite(t)||t<=0||t>=1)fail('invalid split');const p=s[index],mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*t),a=mix(p.p0,p.p1),b=mix(p.p1,p.p2),d=mix(p.p2,p.p3),e=mix(a,b),f=mix(b,d),g=mix(e,f);s.splice(index,1,{p0:p.p0,p1:a,p2:e,p3:g},{p0:g,p1:f,p2:d,p3:p.p3});return withPath(c,path);}
 function moveOrigin(c,id,k,poses,world){const p=parentTransform(c,id,k,poses),q=toLocal(p,world),next=copy(c),t=target(row(next,id),k);t.x=clamp(q[0],-16384,16384);t.y=clamp(q[1],-16384,16384);return prepared(next);}
 function movePathAtWorld(c,id,k,poses,index,key,world){if(k!=='trail'&&k!=='emitter')fail('path belongs to the emitter or trail guide');const p=originTransform(c,id,k,poses);return movePathPoint(c,index,key,toLocal(p,world));}
 // Each drag freezes the source preset, pointer, camera and anchor basis.
 // A pointer event produces a detached candidate; only the caller may publish it.
 function startDrag(c,{id,layer='emitter',kind='origin',index,key,poses={},rect,point}){
  const source=prepared(c),start=screenToWorld(rect,point),camera={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
  if(kind==='origin'){const origin=originTransform(source,id,layer,poses),parent=parentTransform(source,id,layer,poses);if(!origin||!parent)fail('missing anchor');const base={...parent};return Object.freeze({move(pointer){const now=screenToWorld(camera,pointer),world=[origin.x+now[0]-start[0],origin.y+now[1]-start[1]],local=toLocal(base,world),next=copy(source),t=target(row(next,id),layer);t.x=clamp(local[0],-16384,16384);t.y=clamp(local[1],-16384,16384);return prepared(next);}});}
  if(kind!=='path'||!['emitter','trail'].includes(layer))fail('invalid drag kind');const origin=originTransform(source,id,layer,poses),p=source.path.segments[index]?.[key];if(!origin||!xy(p)||index===0&&key==='p0')fail('invalid path handle');const base={...origin},old=toWorld(base,p);
  return Object.freeze({move(pointer){const now=screenToWorld(camera,pointer),world=[old[0]+now[0]-start[0],old[1]+now[1]-start[1]];return movePathPoint(source,index,key,toLocal(base,world));}});
 }
 function addEmitter(c,duplicateId=null){const next=copy(c);if(next.emitters.length>=4)fail('emitter limit');let i=0;while(next.emitters.some(e=>e.id==='dash'+(i+1)))i++;const e=duplicateId===null?D.newEmitter(i):copy(row(next,duplicateId));e.id='dash'+(i+1);if(duplicateId!==null){e.x=clamp(e.x+20,-16384,16384);e.seed=(e.seed+997)|0;}next.emitters.push(e);return {settings:prepared(next),id:e.id};}
 function removeEmitter(c,id){row(c,id);if(c.emitters.length===1)fail('at least one emitter required');const next=copy(c);next.emitters=next.emitters.filter(e=>e.id!==id);return prepared(next);}
 function markers(plan,id){const e=plan.emitters.find(x=>x.id===id);if(!e)fail('unknown emitter');return e.echoes.map(b=>Object.freeze({birthSeconds:b.birthSeconds,sourceSeconds:b.sourceSeconds,frame:b.birthSeconds*60,pathDistance:b.pathDistance,travelDistance:b.travelDistance}));}
 function create(settings=D.defaults()){
  let plan=D.compile(settings),selectedId=plan.settings.emitters[0].id,layer='emitter',time=0,committing=false;
  function commit(next,prepare=()=>{}){if(committing)fail('nested authoring transaction');if(typeof prepare!=='function')fail('invalid prepare callback');const candidate=D.compile(next),nextTime=Math.min(time,(candidate.settings.durationFrames-1)/60),nextId=candidate.settings.emitters.some(e=>e.id===selectedId)?selectedId:candidate.settings.emitters[0].id;committing=true;try{const result=prepare(candidate.settings,nextTime);if(result&&typeof result.then==='function')fail('prepare must be synchronous');plan=candidate;time=nextTime;selectedId=nextId;return plan.settings;}finally{committing=false;}}
  function select(id,k=layer){if(committing)fail('transaction in progress');target(row(plan.settings,id),k);selectedId=id;layer=k;}
  function seek(seconds){if(committing)fail('transaction in progress');if(!finite(seconds))fail('invalid time');time=clamp(seconds,0,(plan.settings.durationFrames-1)/60);return time;}
  return Object.freeze({commit,select,seek,get settings(){return plan.settings;},get plan(){return plan;},get selectedId(){return selectedId;},get layer(){return layer;},get time(){return time;},get frame(){return clamp(Math.floor(time*60+1e-7),0,plan.settings.durationFrames-1);},get markers(){return markers(plan,selectedId);}});
 }
 return {VERSION:1,create,scalePath,movePathPoint,splitPath,parentTransform,originTransform,toLocal,toWorld,screenToWorld,moveOrigin,movePathAtWorld,startDrag,addEmitter,removeEmitter,markers};
});
