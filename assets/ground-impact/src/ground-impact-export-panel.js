// EARTH-01 G04d: one cancellable export job and logical crop guide.
(function(root,make){'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactExportPanel=api;})(globalThis,function(){
 'use strict';
 function mount({env,host,surface,cancelHost,getSession,getBackend,isLocked,begin,end,report,getDeveloperData,download}){
  const doc=env.document,X=env.FxShieldExport,U=env.FxGroundImpactAuthoring;let job=null,dead=false,drag=null;
  const el=(tag,id,parent,text)=>{const n=doc.createElement(tag);n.id=id;if(text)n.textContent=text;parent.append(n);return n;};
  const group=el('details','exportDetails',host);group.open=true;el('summary','exportSummary',group,'Export');
  function input(id,label,value,min,max){const l=el('label',id+'Label',group,label),n=el('input',id,l);n.type='number';n.min=min;n.max=max;n.step=1;n.value=value;return n;}
  const w=input('exportWidth','Width (px)',512,1,4096),h=input('exportHeight','Height (px)',512,1,4096),x=input('exportX','Center X offset',0,-16384,16384),y=input('exportY','Center Y offset',0,-16384,16384),frames=input('exportFrames','Frames (60 FPS)',40,1,3600);
  const show=el('input','exportGuide',el('label','exportGuideLabel',group,'Show crop guide'));show.type='checkbox';show.checked=true;
  const buttons=[['exportPng','PNG sequence','png'],['exportWebGL','Developer ZIP · WebGL','webgl'],['exportWebGPU','Developer ZIP · WebGPU','webgpu']].map(([id,label,target])=>{const n=el('button',id,group,label);n.type='button';n.onclick=()=>run(target);return n;});
  const progress=el('output','exportProgress',cancelHost),cancel=el('button','exportCancel',cancelHost,'Cancel export');cancel.type='button';cancel.disabled=true;cancel.onclick=()=>job?.abort();progress.setAttribute('aria-live','polite');
  const guide=el('div','cropGuide',surface),label=el('button','cropLabel',surface);label.type='button';label.setAttribute('aria-label','Drag crop center; arrow keys move');Object.assign(guide.style,{position:'absolute',border:'1px solid #7ceaff',boxShadow:'0 0 0 20000px #0005',pointerEvents:'none',zIndex:'1'});Object.assign(label.style,{position:'absolute',zIndex:'2',touchAction:'none',cursor:'move',maxWidth:'100%'});
  function integer(n){if(!/^-?\d+$/.test(n.value)||!n.validity.valid)throw Error('Invalid '+n.id);return Number(n.value);}
  function spec(){const width=integer(w),height=integer(h);return {crop:X.cropSpec({x:256+integer(x)-Math.floor(width/2),y:256+integer(y)-Math.floor(height/2),width,height}),frameCount:integer(frames)};}
  function refresh(){const locked=dead||isLocked()||!!job;for(const b of buttons)b.disabled=locked;cancel.disabled=!job||dead;label.disabled=locked;if(locked)drag=null;let c;try{c=spec().crop;}catch(e){guide.hidden=label.hidden=true;return;}guide.hidden=label.hidden=!show.checked||dead;Object.assign(guide.style,{left:c.x/512*100+'%',top:c.y/512*100+'%',width:c.width/512*100+'%',height:c.height/512*100+'%'});label.style.left=Math.max(0,Math.min(65,c.x/512*100))+'%';label.style.top=Math.max(0,Math.min(90,c.y/512*100))+'%';label.textContent=c.width+' × '+c.height+' px';}
  for(const n of [w,h,x,y,frames,show])n.addEventListener('input',refresh);
  function move(a,b){const old=[x.value,y.value];x.value=Math.round(a);y.value=Math.round(b);try{spec();}catch(e){[x.value,y.value]=old;}refresh();}
  label.onpointerdown=e=>{if(isLocked()||job||dead||e.button!==0)return;const p=U.pointer(e.clientX,e.clientY,surface.getBoundingClientRect());drag={id:e.pointerId,p,x:integer(x),y:integer(y)};label.setPointerCapture(e.pointerId);};
  label.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||isLocked()||job||dead)return;const p=U.pointer(e.clientX,e.clientY,surface.getBoundingClientRect());move(drag.x+p.x-drag.p.x,drag.y+p.y-drag.p.y);};
  label.onpointerup=label.onpointercancel=label.onlostpointercapture=()=>{drag=null;};
  label.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d&&!isLocked()&&!job&&!dead){e.preventDefault();const m=e.shiftKey?10:1;move(integer(x)+m*d[0],integer(y)+m*d[1]);}};
  function save(bytes,name){if(download)return download(bytes,name);const url=env.URL.createObjectURL(new env.Blob([bytes],{type:'application/zip'})),a=doc.createElement('a');a.href=url;a.download=name;try{doc.body.append(a);a.click();}finally{a.remove();env.setTimeout(()=>env.URL.revokeObjectURL(url),1000);}}
  async function run(target){if(dead||job||isLocked())return false;let params;try{params=spec();}catch(e){report(e.message,true);return false;}
   const s=getSession(),source=s.source,settings=JSON.parse(JSON.stringify(s.settings)),options={...s.options},assetInfo=source?{name:source.name,atlasName:source.atlasName,version:s.asset?.version,images:[...source.images.keys()],options,loop:!!options.animation}:null;
   const controller=new env.AbortController();job=controller;let began=false;try{began=true;begin();refresh();progress.textContent='Preparing export…';const common={...params,settings,codec:X,compile:env.FxGroundImpact.compile,assetInfo,signal:controller.signal};let result;
    if(target==='png'){result=await env.FxGroundImpactExport.bakeSequence({...common,backend:getBackend(),createScene:env.FxGroundImpactBake.sceneFactory({source,poseOptions:options,env}),progress:(n,total)=>{progress.textContent=n+' / '+total+' frames';},yieldFrame:()=>new Promise(resolve=>env.setTimeout(resolve,0))});}
    else{result=await env.FxGroundImpactDeveloper.developer({...common,...getDeveloperData(),target,source,options,previewSeconds:s.seconds});}
    if(dead||controller.signal.aborted){if(!dead)report('Export cancelled',false);return false;}save(result.zip,'ground-impact-'+target+'.zip');report('Export completed',false);return true;
   }catch(e){if(!dead)report(controller.signal.aborted?'Export cancelled':e.message,!controller.signal.aborted);return false;}finally{job=null;progress.textContent='';if(began)end();refresh();}
  }
  function destroy(){if(dead)return;dead=true;job?.abort();drag=null;guide.remove();label.remove();cancel.disabled=true;}
  refresh();return Object.freeze({refresh,destroy,get active(){return !!job;}});
 }
 return {mount};
});
