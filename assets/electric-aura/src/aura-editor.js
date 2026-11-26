// ELEC-03 A03: standalone editor; all rendering owned by the authoring session.
(function(root){
 'use strict';
 function mount(env=root){
 const doc=env.document,$=id=>doc.getElementById(id),H=env.FxElectricAura,U=env.FxAuraAuthoring,R=env.FxAuraRuntime,Sp=env.FxShockwaveSpine,P=env.PIXI,clone=v=>JSON.parse(JSON.stringify(v));
 const ranges={durationFrames:[6,3600,1],fadeFrames:[1,120,1],auraRadius:[10,260],ellipseRatio:[.25,4],arcCount:[0,60,1],pulseRate:[0,15],arcLength:[2,140],arcWidth:[.5,14],glowStrength:[0,2],haloWidth:[.5,20],arcLifeFrames:[1,120,1],jaggedness:[0,1],branchChance:[0,1],branchLengthRatio:[.1,1],intervalFrames:[.25,600],minIntervalFrames:[0,120],timeJitter:[0,.45],perimeterGap:[2,80],minGap:[2,80],maxGap:[2,80],spatialJitter:[0,.45],sparkRate:[0,120],sparkTimeJitter:[0,.45],sparkMinIntervalFrames:[0,120],sparkGap:[2,80],sparkLifeFrames:[1,120,1],sparkSpeed:[0,500],sparkSize:[.25,15]};
 const labels={durationFrames:'Duration (frames)',auraRadius:'Aura radius (px)',ellipseRatio:'Ellipse Y/X ratio',arcCount:'Nominal arcs per pulse',pulseRate:'Pulse rate (Hz)',arcLength:'Arc length (px)',arcWidth:'Arc width (px)',glowStrength:'Glow strength',perimeterGap:'Perimeter gap (px)',sparkRate:'Spark rate (/s)',sparkGap:'Spark gap (px)',sparkSpeed:'Spark speed (px/s)',intervalFrames:'Arc interval (frames)'};
 let scene=null,busy=false,closed=false,playing=false,last=null,raf=0,drag=null;
 const cfg=()=>scene.session.settings,session=()=>scene.session,id=()=>$('emitter').value,layer=()=>$('layer').value,locked=()=>busy||closed||!scene;
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').dataset.error=String(error);};
 function play(v){playing=v;last=null;$('play').textContent=v?'Pause':'Play';}
 function attempt(fn){try{return fn();}catch(e){play(false);status(e.message,true);return false;}}
 function lock(v){drag=null;busy=v;play(false);for(const k of ['controls','assets','transport'])$(k).disabled=locked();$('backend').disabled=v||closed;handles();}
 function selectOptions(el,values,preferred){el.replaceChildren(...values.map(x=>new env.Option(x.label??x.value??x,x.value??x)));el.value=values.some(x=>(x.value??x)===preferred)?preferred:String(values[0]?.value??values[0]??'');}
 function selection(){const c=cfg(),old=id();selectOptions($('emitter'),c.emitters.map(e=>e.id),old);$('addEmitter').disabled=c.emitters.length>=4;$('removeEmitter').disabled=c.emitters.length<=1;}
 const eFor=c=>c.emitters.find(e=>e.id===id()),lFor=c=>eFor(c).layers[layer()],aFor=c=>$('anchorScope').value==='layer'?lFor(c).anchor:eFor(c).anchor;
 function marker(k,p){const h=$(k);h.hidden=locked()||!p;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function handles(){if(locked()){marker('handle',null);return;}marker('handle',session().bases(id(),layer())?.layer);}
 function paint(t){const s=session(),q=s.seek(t);scene.app.render();$('frame').max=s.meta.frames-1;$('frame').value=U.frame(s.seconds,s.meta);$('frameLabel').textContent=$('frame').value+' / '+$('frame').max+' · '+s.seconds.toFixed(3)+' s';$('timingInfo').textContent=H.LAYERS.map(k=>k+': '+q[k].length+' primitives').join(' · ');$('missing').textContent=s.missing.map(x=>'Missing anchor: '+x).join(' · ');handles();return q;}
 function sync(){const s=session(),m=s.meta;$('preset').value=JSON.stringify(cfg(),null,2);$('motionInfo').textContent=m.frames+' frames · '+m.duration.toFixed(3)+' s · perimeter '+m.perimeterLength.toFixed(2)+' px · '+m.eventCount+' scheduled events · '+m.primitiveBound+' primitive / '+m.vertexBound+' vertex bound';}
 function edit(fn,refresh=true){if(locked())throw Error('Preview unavailable');const n=clone(cfg()),result=fn(n);session().configure(result??n);sync();if(refresh){selection();controls();}paint(session().seconds);status('Settings applied');}
 function field(parent,key,value,range,change,choices,label=key,disabled=false){
  const l=doc.createElement('label'),el=doc.createElement(choices?'select':'input');l.textContent=label;el.setAttribute('aria-label',label);el.dataset.field=key;el.disabled=disabled;
  if(choices)selectOptions(el,choices,value);else if(range){el.type='number';el.min=range[0];el.max=range[1];el.step=range[2]??'any';el.value=String(value);}else if(typeof value==='boolean'){el.type='checkbox';el.checked=value;}else{el.type='text';el.value=value;}
  el.onchange=()=>{try{if(range&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+label);change(range?Number(el.value):el.type==='checkbox'?el.checked:el.value);}catch(e){if(el.type==='checkbox')el.checked=value;else el.value=String(value);status(e.message,true);}};l.append(el);parent.append(l);
 }
 function controls(){
  const c=cfg(),e=eFor(c),l=lFor(c),a=aFor(c),g=$('general'),f=$('layerFields'),p=$('anchorFields');for(const x of [g,f,p])x.replaceChildren();
  const set=(k,v)=>edit(n=>{n[k]=v;});
  for(const [k,r] of Object.entries(ranges))field(g,k,c[k],r,v=>set(k,v),null,labels[k]??k,c.mode==='loop'&&k==='fadeFrames'||k==='intervalFrames'&&c.frequencySource!=='interval'||k==='perimeterGap'&&c.spacingCurveEnabled);
  field(g,'durationSeconds',c.durationFrames/60,[.1,60],v=>set('durationFrames',Math.round(v*60)),null,'Authored duration (s)');
  field(g,'mode',c.mode,null,v=>edit(n=>U.mode(n,v)),['loop','oneShot'],'Timeline mode');
  for(const [k,values] of Object.entries({quality:Object.keys(H.BUDGETS),frequencySource:['rate','interval'],distribution:['even','random','stratified','clustered']}))field(g,k,c[k],null,v=>set(k,v),values);
  field(g,'spacingCurveEnabled',c.spacingCurveEnabled,null,v=>set('spacingCurveEnabled',v));
  field(f,'emitterEnabled',e.enabled,null,v=>edit(n=>{eFor(n).enabled=v;}),null,'Emitter enabled');
  for(const [k,r] of Object.entries({enabled:null,visible:null,x:[-10000,10000],y:[-10000,10000],rotation:[-360,360],delayFrames:[0,120,1],seed:[-2147483648,2147483647,1],opacity:[0,1]}))field(f,k,l[k],r,v=>edit(n=>{lFor(n)[k]=v;}));
  for(const [k,values] of Object.entries({blend:['normal','add'],order:['behind','front']}))field(f,k,l[k],null,v=>edit(n=>{lFor(n)[k]=v;}),values);
  field(p,'type',a.type,null,v=>edit(n=>{const q=aFor(n),sk=session().asset?.model.skeleton,slot=sk?.slots.find(s=>s.getAttachment())??sk?.slots[0];Object.assign(q,{type:v,space:['world','inherit'].includes(v)?'world':'local',name:v==='bone'?(sk?.bones[0]?.data.name??'root'):v==='slot'?(slot?.data.name??'slot'):v==='attachment'?(slot?.getAttachment()?.name??'attachment'):'',slot:v==='attachment'?(slot?.data.name??'slot'):'',x:v==='world'?256:0,y:v==='world'?256:0});}),[...($('anchorScope').value==='layer'?['inherit']:[]),'world','skeleton','bone','slot','attachment'],'Anchor type');
  if(!['world','inherit'].includes(a.type))field(p,'space',a.space,null,v=>edit(n=>{aFor(n).space=v;}),['local','world']);
  for(const k of ['name','slot'])if(k==='slot'?a.type==='attachment':['bone','slot','attachment'].includes(a.type))field(p,k,a[k],null,v=>edit(n=>{aFor(n)[k]=v;}));
  if(a.type!=='inherit')for(const k of ['x','y','rotation'])field(p,k,a[k],k==='rotation'?[-360,360]:[-10000,10000],v=>edit(n=>{aFor(n)[k]=v;}),null,'Anchor '+k);
 }
 function curve(){const k=$('curveKey').value,h=$('curve');h.replaceChildren();const count=()=>k==='alpha'?(layer()==='sparks'?cfg().sparkLifeFrames:cfg().arcLifeFrames):Math.max(1,session().meta.frames-1);env.FxCurveEditor.mount(h,{curve:cfg().curves[k],idPrefix:'auraCurve',getFrameCount:count,isLocked:locked,onScrub:u=>{if(['frequency','glow','rate','interval'].includes(k)){play(false);attempt(()=>paint(u*count()/60));}},onChange:v=>{try{edit(n=>{n.curves[k]=v;},false);}catch(e){curve();status(e.message,true);throw e;}}});}
 function palette(){const k=layer(),h=$('palette');h.replaceChildren();env.FxColorUi.mount(h,{value:cfg().palettes[k],defaultValue:H.defaults().palettes[k],idPrefix:'auraPalette',isLocked:locked,onChange:v=>edit(n=>{n.palettes[k]=v;},false)});}
 function refresh(){selection();controls();curve();palette();sync();handles();}
 function populate(){const s=session(),a=s.asset;selectOptions($('animation'),[{label:'Setup pose',value:''},...(a?.animations??[])],s.options.animation);selectOptions($('skin'),[{label:'Default skin',value:''},...(a?.skins??[])],s.options.skin);$('speed').value=String(s.options.speed);$('showSpine').checked=s.options.visible;$('assetName').textContent=s.source?.name??'No Spine asset';}
 function dispose(s){if(!s)return;try{s.session?.destroy();}finally{s.app?.destroy(true,{children:true});}}
 async function rebuild(backend){if(busy||closed)return false;lock(true);let next=null;
  try{const info=await R.initApplication({PIXI:P,backend});next={app:info.app,actual:info.actual};if(closed)return false;const world=next.app.stage,behindHost=new P.Container(),models=new P.Container(),host=new P.Container();world.addChild(behindHost,models,host);
   next.session=U.createSession({PIXI:P,Spine:env.spine,world,host,behindHost,models,loader:Sp,runtime:R,pose:env.FxAuraPose,initial:scene?cfg():H.defaults()});
   if(scene){const old=session();if(old.source)await next.session.replaceSource(old.source);if(closed)return false;next.session.setOptions(old.options);next.session.seek(old.seconds);}
   next.app.render();$('surface').prepend(next.app.canvas);const prior=scene;scene=next;next=null;dispose(prior);$('actual').textContent=info.actual+(info.fallback?' (fallback from '+backend+')':'');$('backend').value=info.actual;populate();refresh();status('Offline preview ready');return true;
  }catch(e){if(!closed){if(scene)$('backend').value=scene.actual;status(e.message,true);}return false;}finally{dispose(next);if(!closed){lock(false);if(scene)handles();}}
 }
 function collect(files){const list=Array.from(files),s=list.filter(f=>/\.(json|skel)$/i.test(f.name)),a=list.filter(f=>/\.atlas$/i.test(f.name)),images=list.filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name));if(s.length!==1||a.length!==1||!images.length)throw Error('Select one skeleton, one atlas and all texture pages');if(new Set(images.map(f=>f.name)).size!==images.length)throw Error('Duplicate texture names');return {name:s[0].name,skeleton:s[0],atlas:a[0],atlasName:a[0].name,images:new Map(images.map(f=>[f.name,f]))};}
 async function load(source){if(locked())return false;lock(true);try{await session().replaceSource(source);if(closed)return false;populate();refresh();paint(session().seconds);status('Spine source updated');return true;}catch(e){if(!closed)status(e.message,true);return false;}finally{if(!closed)lock(false);}}
 $('backend').onchange=()=>rebuild($('backend').value);$('background').onchange=()=>{$('surface').className=$('background').value;};$('zoom').oninput=()=>{$('surface').style.width=512*Number($('zoom').value)/100+'px';};
 $('play').onclick=()=>{if(!locked())play(!playing);};$('reset').onclick=()=>{play(false);attempt(()=>paint(0));};$('frame').oninput=()=>{play(false);attempt(()=>paint(Number($('frame').value)/60));};
 $('load').onclick=()=>attempt(()=>load(collect($('files').files)));$('sample').onclick=()=>attempt(()=>load(Sp.sample(JSON.parse($('sampleData').textContent))));$('remove').onclick=()=>load(null);
 for(const k of ['animation','skin','speed','showSpine'])$(k).onchange=()=>attempt(()=>{try{if(!$('speed').value||!$('speed').validity.valid)throw Error('Invalid Spine speed');session().setOptions({animation:$('animation').value,skin:$('skin').value,speed:Number($('speed').value),visible:$('showSpine').checked});paint(session().seconds);}finally{populate();}});
 for(const k of ['emitter','layer','anchorScope'])$(k).onchange=()=>attempt(()=>{controls();if(k==='layer'){palette();curve();}handles();});$('curveKey').onchange=curve;
 $('addEmitter').onclick=()=>attempt(()=>{let n=1;while(cfg().emitters.some(e=>e.id==='emitter-'+n))n++;edit(c=>{c.emitters.push(H.newEmitter('emitter-'+n,4109+n*3));});$('emitter').value='emitter-'+n;controls();palette();handles();});
 $('removeEmitter').onclick=()=>attempt(()=>edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==id());}));
 $('apply').onclick=()=>attempt(()=>{if($('preset').value.length>524288)throw Error('Preset too large');session().configure(JSON.parse($('preset').value));refresh();paint(session().seconds);status('Preset restored');});$('defaults').onclick=()=>attempt(()=>{session().configure(H.defaults());refresh();paint(session().seconds);status('Defaults restored');});
 function position(){return session().bases(id(),layer())?.layer??null;}
 function move(x,y){const b=session().bases(id(),layer());if(!b)return;const q=U.inverse(b.base,x,y);edit(n=>{lFor(n).x=Math.max(-10000,Math.min(10000,q.x));lFor(n).y=Math.max(-10000,Math.min(10000,q.y));},false);}
 const handle=$('handle');handle.onpointerdown=e=>{if(locked()||e.button!==0)return;const p=position();if(!p)return;play(false);const q=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());handle.setPointerCapture(e.pointerId);drag={id:e.pointerId,emitter:id(),layer:layer(),dx:p.x-q.x,dy:p.y-q.y};};
 handle.onpointermove=e=>{if(locked()||!drag||drag.id!==e.pointerId||drag.emitter!==id()||drag.layer!==layer())return;attempt(()=>{const q=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect());move(q.x+drag.dx,q.y+drag.dy);});};
 handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=()=>{drag=null;if(!locked())controls();};
 handle.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d||locked())return;e.preventDefault();play(false);attempt(()=>{const p=position();if(p){move(p.x+d[0]*(e.shiftKey?10:1),p.y+d[1]*(e.shiftKey?10:1));controls();}});};
 function tick(now){if(closed)return;if(playing&&!locked()){if(last!==null)attempt(()=>{const s=session(),dt=Math.max(0,(now-last)/1000),loop=cfg().mode==='loop',reverse=$('reverse').checked;let t=reverse?(loop?((s.seconds-dt)%s.meta.duration+s.meta.duration)%s.meta.duration:Math.max(0,s.seconds-dt)):U.advance(s.seconds,dt,s.meta,loop);paint(t);if(!loop&&(reverse?t<=0:t>=(s.meta.frames-1)/60))play(false);});if(playing)last=now;}raf=env.requestAnimationFrame(tick);}
 function destroy(){if(closed)return;closed=true;play(false);env.cancelAnimationFrame(raf);dispose(scene);scene=null;}
 env.addEventListener('pagehide',destroy,{once:true});raf=env.requestAnimationFrame(tick);const ready=rebuild('webgl2');return Object.freeze({ready,destroy,get session(){return scene?.session??null;}});
 }
 if(typeof module==='object'&&module.exports)module.exports={mount};else mount();
})(globalThis);
