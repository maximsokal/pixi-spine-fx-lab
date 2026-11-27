// ELEC-02 L03c: standalone Chain Lightning authoring preview.
(function(root){
 'use strict';
 function mount(env=root){
 const doc=env.document,$=id=>doc.getElementById(id),H=env.FxChainLightning,U=env.FxChainAuthoring,S=env.FxChainSession,R=env.FxChainRuntime,A=env.FxChainAnchors,Sp=env.FxShockwaveSpine,P=env.PIXI,clone=v=>JSON.parse(JSON.stringify(v));
 const ranges={durationFrames:[6,3600,1],fadeFrames:[1,120,1],arcWidth:[1,24],jumpDelay:[0,40],arcGap:[2,90],branchSpread:[0,160],jitter:[0,1],smoothness:[0,1],arcLifeFrames:[1,120,1],branchLifeFrames:[1,120,1],glowLifeFrames:[1,120,1],branchCount:[0,4,1],branchLength:[2,80],branchWidthRatio:[.1,1],sparkGap:[15,100],sparkSize:[.25,15],sparkSpeed:[0,500],glowRadius:[2,100],glowStrength:[0,2],restrikeRate:[0,120],intervalFrames:[.25,600],minIntervalFrames:[0,120],timeJitter:[0,.45],minGap:[2,90],maxGap:[2,90],spatialJitter:[0,.45]};
 const offsets={x:[-10000,10000],y:[-10000,10000],delayFrames:[0,120,1],seed:[-2147483648,2147483647,1]};
 let scene=null,busy=false,closed=false,playing=false,last=null,raf=0,drag=null,exportJob=null;
 const session=()=>scene.session,cfg=()=>session().settings,id=()=>$('target').value,layer=()=>$('layer').value,locked=()=>busy||closed||!scene;
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').dataset.error=String(error);};
 function play(v){playing=v;last=null;$('play').textContent=v?'Pause':'Play';}
 function attempt(fn){try{return fn();}catch(e){play(false);status(e.message,true);return false;}}
 function lock(v){drag=null;busy=v;play(false);for(const k of ['controls','assets','transport','exportFields'])$(k).disabled=locked();$('backend').disabled=v||closed;handles();}
 function selectOptions(el,values,preferred){el.replaceChildren(...values.map(x=>new env.Option(x.label??x.value??x,x.value??x)));el.value=values.some(x=>(x.value??x)===preferred)?preferred:String(values[0]?.value??values[0]??'');}
 const target=c=>c.targets.find(t=>t.id===id()),row=c=>target(c).layers[layer()],anchor=c=>$('anchorScope').value==='source'?c.source:target(c).anchor;
 const context=()=>({world:scene.app.stage,model:session().asset?.model??null,Spine:env.spine});
 function position(){if(locked())return null;const t=target(cfg());if(!t?.enabled)return null;const b=U.bases(cfg(),id(),context());if(!b)return null;return $('dragScope').value==='layer'?U.transform(b.target,row(cfg()).x,row(cfg()).y):b.target;}
 function handles(){const p=position(),h=$('handle');h.hidden=!p;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function selection(preferred=id()){const c=cfg();selectOptions($('target'),c.targets.map(t=>t.id),preferred);const i=c.targets.findIndex(t=>t.id===id());$('addTarget').disabled=c.targets.length>=8;$('removeTarget').disabled=c.targets.length<=2;$('upTarget').disabled=i<=0;$('downTarget').disabled=i>=c.targets.length-1;}
 function paint(t){const s=session(),q=s.seek(t);scene.app.render();$('frame').max=s.meta.frames-1;$('frame').value=U.frame(s.seconds,s.meta);$('frameLabel').textContent=$('frame').value+' / '+$('frame').max+' · '+s.seconds.toFixed(3)+' s';$('timingInfo').textContent=H.LAYERS.map(k=>k+': '+q[k].length).join(' · ');$('missing').textContent=[...s.missing.map(x=>'Missing anchor: '+x),...s.meta.overflow.map(x=>'Contact outside timeline: '+x),...s.capacityExceeded.map(x=>'Link exceeds capacity: '+x)].join(' · ');handles();return q;}
 function sync(){const m=session().meta;$('preset').value=JSON.stringify(cfg(),null,2);$('motionInfo').textContent=m.plans.map(p=>p.id+': '+p.contactFrame.toFixed(2)+'f').join(' · ')+' | '+m.eventCount+' events · '+m.primitiveBound+' primitives · '+m.vertexBound+' vertices';}
 function edit(fn,refresh=true,preferred){if(locked())throw Error('Preview unavailable');const n=clone(cfg());session().configure(fn(n)??n);sync();if(refresh){selection(preferred);controls();}paint(session().seconds);status('Settings applied');}
 function field(parent,key,value,range,change,choices,label=key){
  const l=doc.createElement('label'),el=doc.createElement(choices?'select':'input');l.textContent=label;el.setAttribute('aria-label',label);el.dataset.field=key;
  if(choices)selectOptions(el,choices,value);else if(range){el.type='number';el.min=range[0];el.max=range[1];el.step=range[2]??'any';el.value=String(value);}else if(typeof value==='boolean'){el.type='checkbox';el.checked=value;}else{el.type='text';el.value=value;}
  el.onchange=()=>{try{if(range&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+label);change(range?Number(el.value):el.type==='checkbox'?el.checked:el.value);}catch(e){if(el.type==='checkbox')el.checked=value;else el.value=String(value);status(e.message,true);}};l.append(el);parent.append(l);
 }
 function controls(){const c=cfg(),t=target(c),l=row(c),a=anchor(c),g=$('general'),tf=$('targetFields'),lf=$('layerFields'),af=$('anchorFields');for(const h of [g,tf,lf,af])h.replaceChildren();
  for(const [k,r] of Object.entries(ranges))field(g,k,c[k],r,v=>edit(n=>{n[k]=v;}));
  for(const k of ['restrikes','spacingCurveEnabled'])field(g,k,c[k],null,v=>edit(n=>{n[k]=v;}));
  for(const [k,values] of Object.entries({quality:Object.keys(H.BUDGETS),frequencySource:['rate','interval']}))field(g,k,c[k],null,v=>edit(n=>{n[k]=v;}),values);
  for(const [k,r] of Object.entries({enabled:null,...offsets}))field(tf,k,t[k],r,v=>edit(n=>{target(n)[k]=v;}),null,'Target '+k);
  for(const [k,r] of Object.entries({enabled:null,visible:null,...offsets,opacity:[0,1]}))field(lf,k,l[k],r,v=>edit(n=>{row(n)[k]=v;}),null,'Layer '+k);
  for(const [k,values] of Object.entries({blend:['normal','add'],order:['behind','front']}))field(lf,k,l[k],null,v=>edit(n=>{row(n)[k]=v;}),values);
  field(af,'type',a.type,null,v=>edit(n=>{const q=anchor(n),sk=session().asset?.model.skeleton,slot=sk?.slots.find(s=>s.getAttachment())??sk?.slots[0];Object.assign(q,{type:v,space:v==='world'?'world':'local',name:v==='bone'?(sk?.bones[0]?.data.name??'root'):v==='slot'?(slot?.data.name??'slot'):v==='attachment'?(slot?.getAttachment()?.name??'attachment'):'',slot:v==='attachment'?(slot?.data.name??'slot'):'',x:v==='world'?256:0,y:v==='world'?256:0});}),['world','skeleton','bone','slot','attachment'],'Anchor type');
  if(a.type!=='world')field(af,'space',a.space,null,v=>edit(n=>{anchor(n).space=v;}),['local','world']);
  for(const k of ['name','slot'])if(k==='slot'?a.type==='attachment':['bone','slot','attachment'].includes(a.type))field(af,k,a[k],null,v=>edit(n=>{anchor(n)[k]=v;}));
  for(const k of ['x','y','rotation'])field(af,k,a[k],k==='rotation'?[-360,360]:[-10000,10000],v=>edit(n=>{anchor(n)[k]=v;}),null,'Anchor '+k);
 }
 function curve(){const k=$('curveKey').value,h=$('curve');h.replaceChildren();env.FxCurveEditor.mount(h,{curve:cfg().curves[k],idPrefix:'chainCurve',getFrameCount:()=>Math.max(1,session().meta.frames-1),isLocked:locked,onScrub:u=>{if(k==='jump'){play(false);attempt(()=>paint(u*(session().meta.frames-1)/60));}},onChange:v=>{try{edit(n=>{n.curves[k]=v;},false);}catch(e){curve();status(e.message,true);throw e;}}});}
 function palette(){const k=layer(),h=$('palette');h.replaceChildren();env.FxColorUi.mount(h,{value:cfg().palettes[k],defaultValue:H.defaults().palettes[k],idPrefix:'chainPalette',isLocked:locked,onChange:v=>edit(n=>{n.palettes[k]=v;},false)});}
 function refresh(){selection();controls();curve();palette();sync();paint(session().seconds);}
 function populate(){const s=session(),a=s.asset;selectOptions($('animation'),[{label:'Setup pose',value:''},...(a?.animations??[])],s.options.animation);selectOptions($('skin'),[{label:'Default skin',value:''},...(a?.skins??[])],s.options.skin);$('speed').value=String(s.options.speed);$('showSpine').checked=s.options.visible;$('assetName').textContent=s.source?.name??'No Spine asset';}
 function dispose(s){if(!s)return;try{s.session?.destroy();}finally{s.app?.destroy(true,{children:true});}}
 async function rebuild(backend){if(busy||closed)return false;lock(true);let next=null;
  try{const info=await R.initApplication({PIXI:P,backend});next={app:info.app,actual:info.actual};if(closed)return false;const world=next.app.stage,behindHost=new P.Container(),models=new P.Container(),host=new P.Container();world.addChild(behindHost,models,host);
   next.session=S.createSession({PIXI:P,Spine:env.spine,world,host,behindHost,models,loader:Sp,runtime:R,initial:scene?cfg():H.defaults()});
   if(scene){const old=session();if(old.source)await next.session.replaceSource(old.source);if(closed)return false;next.session.setOptions(old.options);next.session.seek(old.seconds);}
   next.app.render();$('surface').prepend(next.app.canvas);const prior=scene;scene=next;next=null;dispose(prior);$('actual').textContent=info.actual+(info.fallback?' (fallback from '+backend+')':'');$('backend').value=info.actual;populate();refresh();status('Offline preview ready');return true;
  }catch(e){if(!closed){if(scene)$('backend').value=scene.actual;status(e.message,true);}return false;}finally{dispose(next);if(!closed)lock(false);}
 }
 function collect(files){const list=Array.from(files),s=list.filter(f=>/\.(json|skel)$/i.test(f.name)),a=list.filter(f=>/\.atlas$/i.test(f.name)),images=list.filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name));if(s.length!==1||a.length!==1||!images.length)throw Error('Select one skeleton, one atlas and all texture pages');if(new Set(images.map(f=>f.name)).size!==images.length)throw Error('Duplicate texture names');return {name:s[0].name,skeleton:s[0],atlas:a[0],atlasName:a[0].name,images:new Map(images.map(f=>[f.name,f]))};}
 async function load(source){if(locked())return false;lock(true);try{await session().replaceSource(source);if(closed)return false;populate();refresh();status('Spine source updated');return true;}catch(e){if(!closed)status(e.message,true);return false;}finally{if(!closed)lock(false);}}
 $('backend').onchange=()=>rebuild($('backend').value);$('background').onchange=()=>{$('surface').className=$('background').value;};$('zoom').oninput=()=>{$('surface').style.width=512*Number($('zoom').value)/100+'px';};
 $('play').onclick=()=>{if(!locked())play(!playing);};$('reset').onclick=()=>{play(false);attempt(()=>paint(0));};$('frame').oninput=()=>{play(false);attempt(()=>paint(Number($('frame').value)/60));};
 $('load').onclick=()=>attempt(()=>load(collect($('files').files)));$('sample').onclick=()=>attempt(()=>load(Sp.sample(JSON.parse($('sampleData').textContent))));$('remove').onclick=()=>load(null);
 for(const k of ['animation','skin','speed','showSpine'])$(k).onchange=()=>attempt(()=>{try{if(!$('speed').value||!$('speed').validity.valid)throw Error('Invalid Spine speed');session().setOptions({animation:$('animation').value,skin:$('skin').value,speed:Number($('speed').value),visible:$('showSpine').checked});paint(session().seconds);}finally{populate();}});
 for(const k of ['target','layer','anchorScope','dragScope'])$(k).onchange=()=>attempt(()=>{selection();controls();if(k==='layer')palette();handles();});$('curveKey').onchange=curve;
 $('addTarget').onclick=()=>attempt(()=>{let n=1;while(cfg().targets.some(t=>t.id==='target-'+n))n++;const key='target-'+n;edit(c=>U.addTarget(c,key,256,256,4109+n*3),true,key);});
 $('removeTarget').onclick=()=>attempt(()=>edit(c=>U.removeTarget(c,id())));
 for(const [key,step] of [['upTarget',-1],['downTarget',1]])$(key).onclick=()=>attempt(()=>edit(c=>U.reorderTarget(c,id(),c.targets.findIndex(t=>t.id===id())+step)));
 $('apply').onclick=()=>attempt(()=>{if($('preset').value.length>524288)throw Error('Preset too large');session().configure(JSON.parse($('preset').value));refresh();status('Preset restored');});$('defaults').onclick=()=>attempt(()=>{session().configure(H.defaults());refresh();status('Defaults restored');});
 function move(x,y){edit(n=>$('dragScope').value==='layer'?U.moveLayer(n,id(),layer(),x,y,context()):U.moveTarget(n,id(),x,y,context()),false);}
 const handle=$('handle');handle.onpointerdown=e=>{if(locked()||e.button!==0)return;const p=position();if(!p)return;play(false);const q=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());handle.setPointerCapture(e.pointerId);drag={id:e.pointerId,target:id(),layer:layer(),scope:$('dragScope').value,dx:p.x-q.x,dy:p.y-q.y};};
 handle.onpointermove=e=>{if(locked()||!drag||drag.id!==e.pointerId||drag.target!==id()||drag.layer!==layer()||drag.scope!==$('dragScope').value)return;attempt(()=>{const q=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());move(q.x+drag.dx,q.y+drag.dy);});};
 handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=()=>{drag=null;if(!locked())controls();};
 handle.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d||locked())return;e.preventDefault();play(false);attempt(()=>{const p=position();if(p){move(p.x+d[0]*(e.shiftKey?10:1),p.y+d[1]*(e.shiftKey?10:1));controls();}});};
 function download(bytes,name){const url=env.URL.createObjectURL(new env.Blob([bytes],{type:'application/zip'})),a=doc.createElement('a');a.href=url;a.download=name;try{doc.body.append(a);a.click();}finally{a.remove();env.setTimeout(()=>env.URL.revokeObjectURL(url),1000);}}
 async function runExport(target){
  if(locked()||exportJob)return false;
  const X=env.FxShieldExport,D=env.FxChainDeveloper,s=session(),wasPlaying=playing,controller=new env.AbortController();exportJob=controller;
  try{
   const spec=env.FxShieldExportUi.readSpec(Object.fromEntries(['x','y','width','height','frames'].map(k=>[k,$('export-'+k).value])),s.meta.frames),assetInfo=s.asset?{name:s.source.name,version:s.asset.version,options:s.options}:null;
   const params={...spec,settings:s.settings,compile:H.compile,signal:controller.signal,assetInfo};
   lock(true);$('cancelExport').disabled=false;$('exportProgress').max=spec.frameCount;$('exportProgress').value=0;$('exportCount').textContent='0 / '+spec.frameCount;
   let result;
   if(target==='png'){
    status('Baking PNG sequence');result=await env.FxChainExport.bakeSequence({...params,codec:X,backend:scene.actual,createScene:env.FxChainBake.sceneFactory({source:s.source,poseOptions:s.options,env}),progress:(n,total)=>{if(!closed){$('exportProgress').value=n;$('exportCount').textContent=n+' / '+total;}},yieldFrame:()=>new Promise(resolve=>env.setTimeout(resolve,0))});
   }else{
    status('Packaging '+target+' developer ZIP');const texts=names=>Object.fromEntries(names.map(k=>[k,$(k)?.textContent]));result=await D.developer({...params,target,previewSeconds:s.seconds,source:s.source,options:s.options,sources:texts(D.FILES),vendors:texts(D.VENDORS),licenses:$('runtimeLicenses')?.textContent,cropSpec:X.cropSpec,makeZip:X.makeZip});
   }
   if(closed||controller.signal.aborted)return false;download(result.zip,'chain-lightning-'+(target==='png'?'png':'developer-'+target)+'.zip');$('exportProgress').value=spec.frameCount;$('exportCount').textContent='Archive ready';status('Export complete');return true;
  }catch(e){if(!closed&&!controller.signal.aborted)status(e.message,true);return false;}
  finally{exportJob=null;if(!closed){$('cancelExport').disabled=true;if(controller.signal.aborted){$('exportProgress').value=0;$('exportCount').textContent='Cancelled';status('Export cancelled');}lock(false);play(wasPlaying);}}
 }
 $('exportPng').onclick=()=>runExport('png');$('exportWebgl').onclick=()=>runExport('webgl');$('exportWebgpu').onclick=()=>runExport('webgpu');$('cancelExport').onclick=()=>{if(exportJob){exportJob.abort();status('Cancelling export');}};
 function tick(now){if(closed)return;if(playing&&!locked()){if(last!==null)attempt(()=>{const s=session(),dt=Math.max(0,(now-last)/1000),reverse=$('reverse').checked,t=reverse?Math.max(0,s.seconds-dt):U.advance(s.seconds,dt,s.meta);paint(t);if(reverse?t<=0:t>=(s.meta.frames-1)/60)play(false);});if(playing)last=now;}raf=env.requestAnimationFrame(tick);}
 function destroy(){if(closed)return;closed=true;exportJob?.abort();play(false);env.cancelAnimationFrame(raf);dispose(scene);scene=null;}
 env.addEventListener('pagehide',destroy,{once:true});raf=env.requestAnimationFrame(tick);const ready=rebuild('webgl2');return Object.freeze({ready,destroy,get session(){return scene?.session??null;}});
 }
 if(typeof module==='object'&&module.exports)module.exports={mount};else mount();
})(globalThis);
