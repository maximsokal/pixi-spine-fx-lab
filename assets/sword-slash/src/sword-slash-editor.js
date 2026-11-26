// GAME-03 S03: standalone authoring UI; the session owns live and replay assets.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),U=FxSwordSlashAuthoring,H=FxSwordSlash,A=FxSwordSlashAnchors,Sp=FxShockwaveSpine,History=FxSwordSlashHistory;
 const clone=v=>JSON.parse(JSON.stringify(v)),initial=()=>History.defaults();
 const ranges={arcAngle:[10,330,1],trailLength:[20,450,'any'],startWidth:[.5,70,'any'],middleWidth:[.5,120,'any'],endWidth:[.5,70,'any'],lifetimeFrames:[2,90,1],edgeGlow:[0,2,'any'],sweepFrames:[2,120,1],exportFrames:[1,3600,1],intervalFrames:[1,60,1],rate:[0,120,'any'],minIntervalFrames:[0,120,'any'],timeJitter:[0,.45,'any'],gap:[1,80,'any'],minGap:[1,80,'any'],maxGap:[1,80,'any'],spatialJitter:[0,.45,'any'],contactFrame:[0,119,1],sparkCount:[0,64,1],sparkLifetimeFrames:[1,90,1],sparkSpeed:[0,900,'any']};
 const labels={arcAngle:'Arc angle (deg)',trailLength:'Trail length (px)',startWidth:'Base start width (px)',middleWidth:'Base middle width (px)',endWidth:'Base end width (px)',lifetimeFrames:'Trail lifetime (frames)',exportFrames:'Timeline frames',gap:'Spatial gap (px)',rate:'Temporal rate (/s)',intervalFrames:'Temporal interval (frames)'};
 let scene=null,busy=false,closed=false,playing=false,last=null,raf=0,drag=null,exportJob=null,developerJob=null,resume=false;
 const cfg=()=>scene.session.settings,selected=()=>$('layer').value,locked=()=>busy||closed||!scene;
 const status=(s,error=false)=>{$('status').textContent=s;$('status').dataset.error=String(error);};
 function play(v){playing=v;last=null;$('play').textContent=v?'Pause':'Play';}
 function attempt(fn){try{return fn();}catch(e){play(false);status(e.message,true);}}
 function lock(v){busy=v;play(false);for(const id of ['controls','transport','assets','exportFields'])$(id).disabled=locked();$('backend').disabled=v||closed;handles();}
 function pose(){return scene&&A.resolve(cfg().anchors[selected()],{host:scene.host,world:scene.app.stage,model:scene.session.asset?.model,Spine:spine});}
 function basis(){const p=pose(),l=cfg().effect.layers[selected()],o=U.origin(p,l);return o&&{...o,rotation:p.rotation+l.rotation};}
 function localToWorld(p,b){const a=b.rotation*Math.PI/180;return {x:b.x+p[0]*Math.cos(a)-p[1]*Math.sin(a),y:b.y+p[0]*Math.sin(a)+p[1]*Math.cos(a)};}
 function endpoint(which){const p=scene.session.meta.path.segments;return which==='start'?p[0].p0:p.at(-1).p3;}
 function authoredCustom(){return cfg().trajectory[selected()]==='authored'&&cfg().effect.pathMode==='custom';}
 function marker(id,p){const h=$(id);h.hidden=locked()||!p;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function handles(){if(locked()){for(const id of ['handle','startHandle','endHandle'])$(id).hidden=true;return;}const b=basis();marker('handle',b);for(const k of ['start','end'])marker(k+'Handle',b&&authoredCustom()?localToWorld(endpoint(k),b):null);}
 function paint(t){const s=scene.session,q=s.seek(t);scene.app.render();$('frame').max=U.frameCount(cfg())-1;$('frame').value=U.frame(s.seconds,cfg());$('frameLabel').textContent=$('frame').value+' / '+$('frame').max+' · '+s.seconds.toFixed(3)+' s';$('timingInfo').textContent=H.LAYERS.map(k=>k+': '+q[k].length+' primitives').join(' · ');$('missing').textContent=H.LAYERS.filter(k=>cfg().effect.layers[k].enabled&&(cfg().trajectory[k]==='recorded'?!s.meta.recorded[k]?.runs.length:!A.resolve(cfg().anchors[k],{host:scene.host,world:scene.app.stage,model:s.asset?.model,Spine:spine}))).map(k=>'Missing anchor/history: '+k).join(' · ');handles();}
 function sync(){$('preset').value=JSON.stringify(cfg(),null,2);$('widthInfo').textContent='Effective full widths (px): '+scene.session.meta.widths.map(v=>v.toFixed(2)).join(' / ');}
 function edit(fn,refresh=true){if(locked())throw Error('Preview unavailable');const n=clone(cfg());fn(n);scene.session.configure(n);paint(scene.session.seconds);sync();if(refresh)controls();status('Settings applied');}
 function field(host,key,value,range,fn,choices,label=key,disabled=false){
  const l=document.createElement('label'),el=document.createElement(choices?'select':'input');l.textContent=label;el.setAttribute('aria-label',label);el.dataset.field=key;el.disabled=disabled;
  if(choices){for(const v of choices)el.add(new Option(v,v));el.value=value;}else if(range){el.type='number';[el.min,el.max,el.step]=range;el.value=value;}else if(typeof value==='boolean'){el.type='checkbox';el.checked=value;}else{el.type='text';el.value=value;}
  el.onchange=()=>{try{if(range&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+label);fn(range?Number(el.value):el.type==='checkbox'?el.checked:el.value);}catch(e){if(el.type==='checkbox')el.checked=value;else el.value=value;status(e.message,true);}};l.append(el);host.append(l);
 }
 function controls(){
  const c=cfg(),k=selected(),l=c.effect.layers[k],a=c.anchors[k],g=$('general'),f=$('layerFields'),p=$('anchorFields'),e=$('endpoints');for(const h of [g,f,p,e])h.replaceChildren();
  const recorded=c.trajectory[k]==='recorded',effect=(key,v)=>edit(n=>{n.effect[key]=v;});
  for(const [key,r] of Object.entries(ranges))field(g,key,c.effect[key],r,v=>effect(key,v),null,labels[key]||key,recorded&&['arcAngle','trailLength'].includes(key)||key==='arcAngle'&&c.effect.pathMode==='custom');
  field(g,'lifetimeSeconds',c.effect.lifetimeFrames/60,[2/60,1.5,'any'],v=>effect('lifetimeFrames',Math.round(v*60)),null,'Lifetime (seconds, snapped to frames)');
  for(const [key,choices] of Object.entries({pathMode:['arc','custom'],triggerMode:['time','distance'],frequencySource:['rate','interval'],distribution:['even','random','stratified','clustered']}))field(g,key,c.effect[key],null,v=>effect(key,v),choices,key,recorded&&key==='pathMode');
  for(const key of ['spacingCurveEnabled','sparksEnabled','glowEnabled'])field(g,key,c.effect[key],null,v=>effect(key,v));
  field(f,'trajectory',c.trajectory[k],null,v=>edit(n=>{n.trajectory[k]=v;}),['authored','recorded'],'Trajectory');
  field(f,'teleportThreshold',c.teleportThreshold,[1,10000,'any'],v=>edit(n=>{n.teleportThreshold=v;}),null,'Teleport threshold (px)');
  $('modeInfo').textContent=recorded?'Recorded: requires a Spine source and moving anchor; authored angle, length and reveal do not control recorded geometry. Layer rotation affects sparks only.':'Authored: arc or custom path. All layers share the authored path and width curves; transforms are independent.';
  for(const [key,r] of Object.entries({enabled:null,x:[-10000,10000,'any'],y:[-10000,10000,'any'],rotation:[-360,360,'any'],delayFrames:[0,120,1],seed:[-2147483648,2147483647,1],opacity:[0,1,'any']}))field(f,key,l[key],r,v=>edit(n=>{n.effect.layers[k][key]=v;}));
  field(f,'blend',l.blend,null,v=>edit(n=>{n.effect.layers[k].blend=v;}),['normal','add']);
  field(p,'type',a.type,null,v=>edit(n=>{const q=n.anchors[k],sk=scene.session.asset?.model.skeleton,slot=sk?.slots.find(s=>s.getAttachment())||sk?.slots[0];Object.assign(q,{type:v,space:v==='world'?'world':'local',name:v==='bone'?(sk?.bones[0]?.data.name||'root'):v==='slot'?(slot?.data.name||'slot'):v==='attachment'?(slot?.getAttachment()?.name||'attachment'):'',slot:v==='attachment'?(slot?.data.name||'slot'):'',x:v==='world'?256:0,y:v==='world'?256:0});}),['world','skeleton','bone','slot','attachment'],'Anchor type');
  if(a.type!=='world')field(p,'space',a.space,null,v=>edit(n=>{n.anchors[k].space=v;}),['world','local']);
  for(const key of ['name','slot'])if(key==='slot'?a.type==='attachment':['bone','slot','attachment'].includes(a.type))field(p,key,a[key],null,v=>edit(n=>{n.anchors[k][key]=v;}));
  for(const key of ['x','y','rotation'])field(p,key,a[key],key==='rotation'?[-360,360,'any']:[-10000,10000,'any'],v=>edit(n=>{n.anchors[k][key]=v;}),null,'Anchor '+key);
  if(authoredCustom())for(const which of ['start','end'])for(const [i,axis] of ['X','Y'].entries())field(e,which+axis,endpoint(which)[i],[-10000,10000,'any'],v=>{const point=endpoint(which).slice();point[i]=v;edit(n=>{n.effect=H.moveEndpoint(n.effect,which,point);});},null,which+' '+axis+' (path px)');
 }
 function curve(){const key=$('curveKey').value,h=$('curve');h.replaceChildren();const count=()=>key==='alpha'?cfg().effect.lifetimeFrames:Math.max(1,cfg().effect.sweepFrames-1);FxCurveEditor.mount(h,{curve:cfg().effect.curves[key],idPrefix:'swordCurve',getFrameCount:count,isLocked:locked,onScrub:u=>{if(['reveal','rate','interval','alpha'].includes(key)){play(false);attempt(()=>paint(u*count()/60));}},onChange:v=>edit(n=>{n.effect.curves[key]=v;},false)});}
 function palette(){const k=selected(),h=$('palette');h.replaceChildren();FxColorUi.mount(h,{value:cfg().effect.palettes[k],defaultValue:initial().effect.palettes[k],idPrefix:'swordPalette',isLocked:locked,onChange:v=>edit(n=>{n.effect.palettes[k]=v;},false)});}
 function refresh(){controls();curve();palette();sync();handles();}
 function populate(){const s=scene.session,a=$('animation'),b=$('skin');a.replaceChildren(new Option('Setup pose',''));b.replaceChildren(new Option('Default skin',''));for(const v of s.asset?.animations||[])a.add(new Option(v,v));for(const v of s.asset?.skins||[])b.add(new Option(v,v));a.value=s.options.animation;b.value=s.options.skin;$('speed').value=s.options.speed;$('showSpine').checked=s.options.visible;$('assetName').textContent=s.source?.name||'No Spine asset';}
 function dispose(s){if(!s)return;try{s.session?.destroy();}finally{if(s.app.renderer)s.app.destroy(true,{children:true});}}
 async function rebuild(backend){
  if(busy||closed)return;lock(true);const next={app:new PIXI.Application()};
  try{await next.app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});if(closed)return;
   const r=next.app.renderer,actual=r.gl?(typeof WebGL2RenderingContext!=='undefined'&&r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):r.gpu?.device&&r.type===PIXI.RendererType.WEBGPU?'webgpu':'unsupported';if(actual!==backend)throw Error('Requested '+backend+', got '+actual);next.actual=actual;
   const models=new PIXI.Container();next.host=new PIXI.Container();next.app.stage.addChild(models,next.host);
   next.session=U.createSession({PIXI,Spine:spine,host:next.host,world:next.app.stage,models,loader:Sp,history:History,runtime:FxSwordSlashRuntime,pose:FxSwordSlashPose,initial:initial()});
   if(scene){const s=scene.session;if(s.source)await next.session.replaceSource(s.source);if(closed)return;next.session.setOptions(s.options);next.session.configure(s.settings);next.session.seek(s.seconds);}
   next.app.render();$('surface').prepend(next.app.canvas);const old=scene;scene=next;dispose(old);$('actual').textContent=actual.toUpperCase();$('backend').value=actual;document.body.dataset.ready='true';populate();status('Ready');
  }catch(e){if(!closed){$('backend').value=scene?.actual||backend;status(e.message,true);}}
  finally{if(scene!==next)dispose(next);if(!closed){lock(false);if(scene)attempt(()=>{refresh();paint(scene.session.seconds);});}}
 }
 function collect(files){const all=Array.from(files),sk=all.filter(f=>/\.(json|skel)$/i.test(f.name)),atlas=all.filter(f=>/\.atlas$/i.test(f.name)),images=new Map();if(sk.length!==1||atlas.length!==1)throw Error('Select one skeleton and atlas');for(const f of all.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name))){const key=f.webkitRelativePath||f.name;if(images.has(key))throw Error('Duplicate texture '+key);images.set(key,f);}if(!images.size)throw Error('Select all texture pages');return {name:sk[0].name,skeleton:sk[0],atlas:atlas[0],images};}
 async function load(source){if(locked())return;lock(true);try{await scene.session.replaceSource(source);if(!closed){populate();status('Source updated');}}catch(e){if(!closed)status(e.message,true);}finally{if(!closed){lock(false);attempt(()=>{refresh();paint(scene.session.seconds);});}}}
 $('backend').onchange=()=>rebuild($('backend').value);$('background').onchange=()=>{$('surface').className=$('background').value;};$('zoom').oninput=()=>{$('surface').style.width=512*Number($('zoom').value)/100+'px';};
 $('load').onclick=()=>attempt(()=>load(collect($('files').files)));$('sample').onclick=()=>attempt(()=>load(Sp.sample(JSON.parse($('sampleData').textContent))));$('remove').onclick=()=>load(null);
 for(const id of ['animation','skin','speed','showSpine'])$(id).onchange=()=>attempt(()=>{if(locked())return;try{if(!$('speed').value||!$('speed').validity.valid)throw Error('Invalid Spine speed');scene.session.setOptions({animation:$('animation').value,skin:$('skin').value,speed:Number($('speed').value),visible:$('showSpine').checked});paint(scene.session.seconds);}finally{populate();}});
 $('play').onclick=()=>attempt(()=>{if(locked())return;if(!playing&&scene.session.seconds>=U.seek(3600,cfg()))paint(0);play(!playing);});$('reset').onclick=()=>{play(false);attempt(()=>paint(0));};$('frame').oninput=()=>{play(false);attempt(()=>paint(Number($('frame').value)/60));};
 $('layer').onchange=()=>{controls();palette();handles();};$('curveKey').onchange=curve;$('apply').onclick=()=>attempt(()=>{const raw=$('preset').value;if(raw.length>262144)throw Error('Preset too large');scene.session.configure(JSON.parse(raw));paint(scene.session.seconds);refresh();});$('defaults').onclick=()=>attempt(()=>{scene.session.configure(initial());paint(scene.session.seconds);refresh();});
 function move(which,x,y){if(which==='origin'){const o=U.offset(pose(),x,y);if(o)edit(n=>Object.assign(n.effect.layers[selected()],o),false);}else{const b=basis();if(!b||!authoredCustom())return;const a=-b.rotation*Math.PI/180,dx=x-b.x,dy=y-b.y;edit(n=>{n.effect=H.moveEndpoint(n.effect,which,[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)]);},false);}}
 for(const [id,which] of [['handle','origin'],['startHandle','start'],['endHandle','end']]){
  const h=$(id),position=()=>which==='origin'?basis():basis()&&authoredCustom()?localToWorld(endpoint(which),basis()):null;
  h.onpointerdown=e=>{if(locked()||e.button!==0)return;const o=position();if(!o)return;play(false);const p=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());h.setPointerCapture(e.pointerId);drag={id:e.pointerId,which,k:selected(),dx:o.x-p.x,dy:o.y-p.y};};
  h.onpointermove=e=>{if(locked()||!drag||drag.id!==e.pointerId||drag.which!==which||drag.k!==selected())return;attempt(()=>{const p=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());move(which,p.x+drag.dx,p.y+drag.dy);});};
  h.onpointerup=h.onpointercancel=h.onlostpointercapture=()=>{if(drag?.which===which){drag=null;if(!locked())controls();}};
  h.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d||locked())return;e.preventDefault();play(false);attempt(()=>{const p=position();if(p){move(which,p.x+d[0]*(e.shiftKey?10:1),p.y+d[1]*(e.shiftKey?10:1));controls();}});};
 }
 function downloadZip(bytes,name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=name;try{document.body.append(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}}
 function pngJob(){
  if(!exportJob)exportJob=FxShieldExportUi.createController({
   request(){if(locked())throw Error('Preview unavailable');const s=scene.session,spec=FxShieldExportUi.readSpec(Object.fromEntries(['x','y','width','height','frames'].map(k=>[k,$('export-'+k).value])),U.frameCount(cfg()));return {...spec,codec:FxShieldExport,settings:cfg(),backend:scene.actual,assetInfo:s.asset?{name:s.source.name,version:s.asset.version,options:s.options}:null,createScene:FxSwordSlashBake.sceneFactory({source:s.source,poseOptions:s.options}),yieldFrame:()=>new Promise(resolve=>setTimeout(resolve,0))};},
   bake:FxSwordSlashExport.bakeSequence,begin(){resume=playing;lock(true);$('cancelExport').disabled=false;status('Baking PNG sequence');},
   end(){if(!closed){$('cancelExport').disabled=true;lock(false);play(resume);}},
   progress(n,total){if(!closed){$('exportProgress').max=total;$('exportProgress').value=n;$('exportCount').textContent=n+' / '+total;}},
   report:(message,error)=>{if(!closed)status(message,error);},download:bytes=>{if(!closed)downloadZip(bytes,'sword-slash-png.zip');}
  });return exportJob;
 }
 $('exportPng').onclick=()=>attempt(()=>pngJob().run());$('cancelExport').onclick=()=>{if(developerJob){developerJob.abort();status('Cancelling developer export');}else exportJob?.cancel();};
 async function developerExport(target){
  if(locked())return false;
  const wasPlaying=playing,controller=new AbortController();developerJob=controller;
  try{
   const s=scene.session,D=FxSwordSlashDeveloper,spec=FxShieldExportUi.readSpec(Object.fromEntries(['x','y','width','height','frames'].map(k=>[k,$('export-'+k).value])),U.frameCount(cfg()));
   const texts=names=>Object.fromEntries(names.map(name=>[name,$(name)?.textContent]));
   const params={...spec,target,settings:cfg(),previewSeconds:s.seconds,source:s.source,options:s.options,assetInfo:s.asset?{version:s.asset.version}:null,sources:texts(D.FILES),vendors:texts(D.VENDORS),licenses:$('runtimeLicenses')?.textContent,normalizeSettings:History.normalizeSettings,cropSpec:FxShieldExport.cropSpec,makeZip:FxShieldExport.makeZip,signal:controller.signal};
   lock(true);$('cancelExport').disabled=false;$('exportCount').textContent='Packaging developer archive';$('exportProgress').removeAttribute('value');status('Preparing '+target+' archive');
   const result=await D.developer(params);
   if(controller.signal.aborted||closed)return false;
   downloadZip(result.zip,'sword-slash-developer-'+target+'.zip');$('exportCount').textContent='Developer archive ready';status('Developer archive exported');return true;
  }catch(e){if(!closed&&!controller.signal.aborted)status(e.message,true);return false;}
  finally{developerJob=null;if(!closed){$('cancelExport').disabled=true;$('exportProgress').value=0;if(controller.signal.aborted){$('exportCount').textContent='Cancelled';status('Developer export cancelled');}lock(false);play(wasPlaying);}}
 }
 $('exportWebgl').onclick=()=>developerExport('webgl');$('exportWebgpu').onclick=()=>developerExport('webgpu');
 function tick(now){if(closed)return;if(playing&&!locked()){if(last!==null)attempt(()=>{paint(U.advance(scene.session.seconds,(now-last)/1000,cfg()));if(scene.session.seconds>=U.seek(3600,cfg()))play(false);});if(playing)last=now;}raf=requestAnimationFrame(tick);}
 window.addEventListener('pagehide',()=>{closed=true;exportJob?.cancel();developerJob?.abort();play(false);cancelAnimationFrame(raf);dispose(scene);scene=null;},{once:true});raf=requestAnimationFrame(tick);rebuild('webgl2');
})();
