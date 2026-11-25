// GAME-06 M02b: standalone artist controls; no mutable global state.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),P=FxPortal,DEG=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const geom={portalRadius:[15,300,.5],rimWidth:[1,70,.5],swirlSpeed:[-720,720,1],glow:[0,2,.01],warp:[0,1,.01],seed:[-2147483648,2147483647,1],quality:['low','balanced','high']};
 const timing={mode:['loop','oneShot'],durationFrames:[2,3600,1],particleLifetimeFrames:[1,3600,1],particleRate:[0,240,.1],frequencySource:['rate','interval'],intervalFrames:[.25,3600,.01],minIntervalFrames:[0,3600,.01],timeJitter:[0,.45,.01],groupCount:[1,8,1],groupDelayFrames:[0,3600,.01],spacing:[2,80,.1],minGapPx:[2,80,.1],maxGapPx:[2,80,.1],spatialJitter:[0,.45,.01],distribution:['even','random','stratified','clustered']};
 const transforms={enabled:null,visible:null,x:[-16384,16384,.01],y:[-16384,16384,.01],rotation:[-3600,3600,.01],scale:[.01,20,.01],timeOffset:[-3600,3600,.01],seed:[-2147483648,2147483647,1]};
 const labels={portalRadius:'Portal radius (px)',rimWidth:'Rim width (px)',swirlSpeed:'Requested swirl (deg/s)',durationFrames:'Duration (frames)',particleLifetimeFrames:'Particle life (frames)',particleRate:'Particles / second',intervalFrames:'Interval (frames)',minIntervalFrames:'Min interval (frames)',timeJitter:'Temporal jitter',groupCount:'Burst count',groupDelayFrames:'Burst delay (frames)',spacing:'Arc spacing (px)',minGapPx:'Min gap (px)',maxGapPx:'Max gap (px)',spatialJitter:'Spatial jitter',timeOffset:'Delay (frames)',rotation:'Rotation (deg)',frequencySource:'Emission clock',x:'X (px)',y:'Y (px)'};
 let cfg=P.normalize(P.defaults()),plan=P.compile(cfg),selectedId=cfg.emitters[0].id,app=null,fx=null,palette=null,busy=false,playing=false,direction=1,time=0,previous=null,backend='webgl2',zoom=1,fitMode=true,drag=null;
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').dataset.error=String(error);};
 const selected=()=>cfg.emitters.find(e=>e.id===selectedId),kind=()=>$('layerSelect').value,end=()=> (cfg.durationFrames-1)/60,period=()=>cfg.durationFrames/60;
 function setPlaying(v){playing=v;previous=null;$('play').textContent=v?'Pause':'Play';}
 function lock(v){busy=v;for(const id of ['backend','frame','play','reverse','resetFrame','addEmitter','duplicateEmitter','removeEmitter','applyPreset','resetSettings'])$(id).disabled=v;if(!v)refreshEmitterButtons();}
 function syncPreset(){$('preset').value=JSON.stringify(cfg,null,2);}
 function parentFor(e,k){
  const t=k==='emitter'?e:e.layers[k];
  if(t.anchor.type==='world')return {x:0,y:0,rotation:0,scale:1};
  if(t.anchor.type==='inherit'&&e.anchor.type==='world')return e;
  return null;
 }
 function origin(e,k){if(!e)return null;const p=parentFor(e,k),t=k==='emitter'?e:e.layers[k];if(!p)return null;const a=p.rotation*DEG,x=t.x*p.scale,y=t.y*p.scale;return {x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a)};}
 function updateHandle(){const p=origin(selected(),kind()),h=$('originHandle');h.hidden=!p||p.x<0||p.y<0||p.x>512||p.y>512;if(!h.hidden){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function seek(t){
  time=cfg.mode==='loop'?((t%period())+period())%period():clamp(t,0,end());
  const frame=clamp(Math.floor(time*60+1e-7),0,cfg.durationFrames-1);
  $('frame').max=cfg.durationFrames-1;$('frame').value=frame;$('frameLabel').textContent=frame+' / '+(cfg.durationFrames-1);
  const s=fx?.seek(time);app?.render();updateHandle();
  $('effectiveSpeed').textContent='Effective swirl: '+plan.effectiveSpeed.toFixed(2)+'°/s · '+(cfg.durationFrames/60).toFixed(2)+' s · '+plan.reserved+' reserved primitives';
  $('anchorDiagnostics').textContent=(s?.diagnostics||[]).map(d=>d.emitterId+' / '+d.layer+': '+d.reason).join('; ');
 }
 function tick(now){if(playing&&!busy){if(previous!==null){const t=time+(now-previous)/1000*direction;seek(t);if(cfg.mode==='oneShot'&&(t>=end()||t<=0))setPlaying(false);}if(playing)previous=now;}requestAnimationFrame(tick);}
 function apply(input,refresh=false){
  if(busy)throw Error('Finish renderer initialization first');
  const candidate=P.compile(input);fx?.configure(candidate.settings);cfg=structuredClone(candidate.settings);plan=candidate;
  if(!selected())selectedId=cfg.emitters[0].id;
  if(time>=period())time=end();syncPreset();seek(time);if(refresh)refreshAll();status('Ready');
 }
 function edit(fn,refresh=false){const next=structuredClone(cfg);fn(next);apply(next,refresh);}
 function field(parent,prefix,key,range,value,change){
  const label=document.createElement('label');label.className='control';label.textContent=labels[key]||key;
  let el;
  if(Array.isArray(range)&&typeof range[0]==='string'){el=document.createElement('select');for(const opt of range)el.add(new Option(opt,opt));el.value=value;}
  else{el=document.createElement('input');el.type=range?'number':key==='anchorName'?'text':'checkbox';if(range){[el.min,el.max,el.step]=range;el.value=value;}else if(el.type==='text'){el.maxLength=128;el.value=value;}else el.checked=value;}
  el.id=prefix+key;label.append(el);parent.append(label);
  el.onchange=()=>{try{
   if(el.type==='number'&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+key);
   const v=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
   change(v);value=v;
  }catch(e){if(el.type==='checkbox')el.checked=value;else el.value=value;status(e.message,true);}};
 }
 function group(id,fields){const node=$(id);node.replaceChildren();for(const [k,r] of Object.entries(fields))field(node,'p-',k,k==='particleLifetimeFrames'?[1,cfg.durationFrames,1]:r,cfg[k],v=>edit(c=>{c[k]=v;if(k==='durationFrames')c.particleLifetimeFrames=Math.min(c.particleLifetimeFrames,v);},k==='durationFrames'||k==='mode'));}
 function refreshEmitterButtons(){$('addEmitter').disabled=busy||cfg.emitters.length>=4;$('duplicateEmitter').disabled=busy||cfg.emitters.length>=4;$('removeEmitter').disabled=busy||cfg.emitters.length===1;}
 function transformPanel(id,k){const node=$(id),e=selected(),t=k==='emitter'?e:e.layers[k];node.replaceChildren();
  const update=(fn,refresh=false)=>edit(c=>{const row=c.emitters.find(v=>v.id===selectedId);fn(k==='emitter'?row:row.layers[k]);},refresh);
  const fields=k==='emitter'?transforms:{...transforms,alpha:[0,1,.01],blend:['normal','add','screen','multiply']};
  for(const [key,r]of Object.entries(fields))field(node,k+'-',key,r,t[key],v=>update(o=>o[key]=v));
  field(node,k+'-','anchorType',k==='emitter'?['world','local','bone']:['inherit','world','local','bone'],t.anchor.type,v=>update(o=>o.anchor={type:v,name:v==='bone'?(o.anchor.name||'bone'):''},true));
  if(t.anchor.type==='bone')field(node,k+'-','anchorName',null,t.anchor.name,v=>update(o=>o.anchor.name=v));
 }
 function refreshEmitters(){const s=$('emitterSelect');s.replaceChildren();for(const e of cfg.emitters)s.add(new Option(e.id,e.id));s.value=selectedId;refreshEmitterButtons();transformPanel('emitterControls','emitter');$('layerControls').replaceChildren();if(kind()!=='emitter')transformPanel('layerControls',kind());updateHandle();}
 function refreshCurves(){const key=$('curveSelect').value;FxCurveEditor.mount($('curve'),{curve:cfg[key],idPrefix:'portalCurve',getFrameCount:()=>cfg.durationFrames-1,isLocked:()=>busy,onScrub:t=>{setPlaying(false);seek(t*end());},onChange:curve=>edit(c=>{c[key]=curve;})});}
 function refreshAll(){group('geometry',geom);group('timing',timing);refreshEmitters();refreshCurves();palette?.refresh(cfg.palette);}
 function add(copy){if(cfg.emitters.length>=4||busy)return;let i=0;while(cfg.emitters.some(e=>e.id==='portal'+(i+1)))i++;const e=copy?structuredClone(selected()):P.newEmitter(i);e.id='portal'+(i+1);if(copy){e.x=clamp(e.x+20,-16384,16384);e.seed=(e.seed+997)|0;}const old=selectedId;selectedId=e.id;try{edit(c=>c.emitters.push(e),true);}catch(err){selectedId=old;status(err.message,true);}}
 function setZoom(z,fit=false){fitMode=fit;zoom=clamp(z,.1,4);$('surface').style.width=512*zoom+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';}
 function fit(){const v=$('viewport');setZoom(Math.min(1,(v.clientWidth-16)/512,(v.clientHeight-16)/512),true);}
 async function initialize(requested){
  if(busy)return;lock(true);setPlaying(false);let next=new PIXI.Application(),nextFx;
  try{await next.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:requested==='webgpu'?'webgpu':'webgl',preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=next.renderer.gl?(next.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   if(actual!==requested)throw Error('Requested '+requested+', got '+actual);
   nextFx=FxPortalRuntime.createPortal({PIXI,host:next.stage,settings:cfg});nextFx.seek(time);next.render();
   if(fx){fx.destroy();app.destroy(true,{children:true});}app=next;fx=nextFx;backend=actual;$('surface').prepend(app.canvas);$('backendActual').textContent=actual.toUpperCase();$('backend').value=backend;document.body.dataset.ready='true';seek(time);if(fitMode)fit();status('Ready');
  }catch(e){nextFx?.destroy();if(next.renderer)next.destroy(true,{children:true});$('backend').value=backend;status(e.message,true);}finally{lock(false);}
 }
 $('play').onclick=()=>{if(playing){setPlaying(false);return;}direction=1;if(cfg.mode==='oneShot'&&time>=end())seek(0);setPlaying(true);};
 $('reverse').onclick=()=>{direction=-1;if(cfg.mode==='oneShot'&&time<=0)seek(end());setPlaying(true);};
 $('resetFrame').onclick=()=>{setPlaying(false);seek(0);};
 $('frame').oninput=$('frame').onchange=()=>{setPlaying(false);seek(Number($('frame').value)/60);};
 $('background').onchange=()=>{$('surface').className=$('background').value;};
 $('backend').onchange=()=>initialize($('backend').value);
 $('fit').onclick=fit;$('actualSize').onclick=()=>setZoom(1);$('zoomIn').onclick=()=>setZoom(zoom*1.25);$('zoomOut').onclick=()=>setZoom(zoom/1.25);
 new ResizeObserver(()=>{if(fitMode)fit();}).observe($('viewport'));
 $('viewport').addEventListener('wheel',e=>{if(busy)return;e.preventDefault();const v=$('viewport'),r=$('surface').getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;setZoom(zoom*Math.exp(-e.deltaY*.001));const n=$('surface').getBoundingClientRect();v.scrollLeft+=n.left+x*n.width-e.clientX;v.scrollTop+=n.top+y*n.height-e.clientY;},{passive:false});
 $('emitterSelect').onchange=()=>{selectedId=$('emitterSelect').value;refreshEmitters();};$('layerSelect').onchange=refreshEmitters;$('curveSelect').onchange=refreshCurves;
 $('addEmitter').onclick=()=>add(false);$('duplicateEmitter').onclick=()=>add(true);$('removeEmitter').onclick=()=>{try{edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selectedId);},true);}catch(e){status(e.message,true);}};
 $('applyPreset').onclick=()=>{try{apply(JSON.parse($('preset').value),true);}catch(e){status(e.message,true);}};
 $('syncPreset').onclick=syncPreset;$('resetSettings').onclick=()=>{try{apply(P.defaults(),true);}catch(e){status(e.message,true);}};
 $('downloadPreset').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='magic-portal-preset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const h=$('originHandle');h.onpointerdown=e=>{if(busy)return;const row=selected(),k=kind(),p=parentFor(row,k);if(!p)return;e.preventDefault();setPlaying(false);const v=k==='emitter'?row:row.layers[k],r=$('surface').getBoundingClientRect();drag={id:row.id,k,pointer:e.pointerId,x:e.clientX,y:e.clientY,sx:v.x,sy:v.y,ratio:512/r.width/p.scale,a:p.rotation*DEG};h.setPointerCapture(e.pointerId);};
 h.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId||busy)return;const dx=(e.clientX-drag.x)*drag.ratio,dy=(e.clientY-drag.y)*drag.ratio,a=drag.a;try{edit(c=>{const row=c.emitters.find(v=>v.id===drag.id),t=drag.k==='emitter'?row:row.layers[drag.k];t.x=clamp(Math.round((drag.sx+dx*Math.cos(a)+dy*Math.sin(a))*100)/100,-16384,16384);t.y=clamp(Math.round((drag.sy-dx*Math.sin(a)+dy*Math.cos(a))*100)/100,-16384,16384);});}catch(e){status(e.message,true);}};
 h.onlostpointercapture=()=>{drag=null;refreshEmitters();};
 palette=FxColorUi.mount($('palette'),{value:cfg.palette,defaultValue:P.defaults().palette,idPrefix:'portalPalette',isLocked:()=>busy,onChange:value=>edit(c=>{c.palette={...value,parameterKey:'portalColor'};})});
 refreshAll();syncPreset();requestAnimationFrame(tick);initialize(new URLSearchParams(location.search).get('backend')||backend);
})();
