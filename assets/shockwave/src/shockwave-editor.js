// GAME-05 standalone authoring preview. All state is local to this editor.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),S=FxShockwave,DEG=Math.PI/180;
 const ranges={startRadius:[0,60,.5],finalRadius:[20,500,.5],ringWidth:[.5,60,.5],edgeSoftness:[0,1,.01],
  ringCount:[1,8,1],ringDelayFrames:[0,30,.5],radialGapPx:[2,100,.5],arcGapPx:[2,100,.5],
  minIntervalFrames:[0,30,.5],timeJitter:[0,.45,.01],spatialJitter:[0,.45,.01],seed:[-2147483648,2147483647,1]};
 const transforms={enabled:null,x:[-10000,10000,.1],y:[-10000,10000,.1],rotation:[-360,360,1],
  timeOffset:[-3600,3600,1],seed:[-2147483648,2147483647,1]};
 const labels={startRadius:'Start radius (px)',finalRadius:'Final radius (px)',ringWidth:'Width (px)',edgeSoftness:'Edge softness',
  ringCount:'Ring count',ringDelayFrames:'Ring delay (frames)',radialGapPx:'Radial gap (px)',arcGapPx:'Arc gap (px)',
  minIntervalFrames:'Min interval (frames)',timeJitter:'Time jitter',spatialJitter:'Spatial jitter',timeOffset:'Delay (frames)',rotation:'Rotation (deg)'};
 let cfg=S.normalize(S.defaults()),selectedId=cfg.emitters[0].id,app=null,fx=null,curveEditor=null,paletteEditor=null;
 let busy=false,playing=false,direction=1,time=0,previous=null,drag=null,backend='webgl2';
 const selected=()=>cfg.emitters.find(e=>e.id===selectedId);
 const kind=()=>$('layerSelect').value;
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').dataset.error=String(error);};
 function syncPreset(){$('preset').value=JSON.stringify(cfg,null,2);}
 function setPlaying(value){playing=value;previous=null;$('play').textContent=value?'Pause':'Play';}
 function seek(seconds){
  time=Math.max(0,Math.min(39/60,seconds));const frame=Math.round(time*60);
  $('frame').value=frame;$('frameLabel').textContent=frame+' / 39';
  fx?.seek(time);app?.render();updateHandle();
 }
 function tick(now){
  if(playing&&!busy){if(previous!==null){
   const target=time+(now-previous)/1000*direction;seek(target);
   if(target>=39/60||target<=0)setPlaying(false);
  }if(playing)previous=now;}
  requestAnimationFrame(tick);
 }
 function apply(next,refresh=false){
  if(busy)throw Error('Finish renderer initialization first.');
  const plan=S.createPlan(next);fx?.configure(plan.settings);cfg=structuredClone(plan.settings);
  if(!selected())selectedId=cfg.emitters[0]?.id??null;
  syncPreset();seek(time);if(refresh)refreshControls();
  status('Ready');
 }
 function edit(mutator,refresh=false){
  const next=structuredClone(cfg);mutator(next);apply(next,refresh);
 }
 function field(parent,prefix,key,range,value,change){
  const label=document.createElement('label');label.className='control';label.textContent=labels[key]||key;
  const input=document.createElement('input');input.id=prefix+key;input.type=range?'number':'checkbox';
  if(range){[input.min,input.max,input.step]=range;input.value=value;}else input.checked=value;
  input.onchange=()=>{
   try{if(range&&(!input.value.trim()||!input.validity.valid))throw Error('Invalid '+key);
    change(range?Number(input.value):input.checked);}
   catch(error){if(range)input.value=value;else input.checked=value;status(error.message,true);return;}
   value=range?Number(input.value):input.checked;
  };
  label.append(input);parent.append(label);
 }
 function choice(parent,key,options){
  const label=document.createElement('label');label.className='control';label.textContent=key;
  const input=document.createElement('select');input.id='p-'+key;
  for(const value of options)input.add(new Option(value,value));
  input.value=cfg[key];input.onchange=()=>{try{edit(c=>{c[key]=input.value;});}catch(e){input.value=cfg[key];status(e.message,true);}};
  label.append(input);parent.append(label);
 }
 function refreshGeometry(){
  const g=$('geometry');g.replaceChildren();
  for(const [key,range] of Object.entries(ranges))field(g,'p-',key,range,cfg[key],v=>edit(c=>{c[key]=v;}));
  choice(g,'distribution',['even','random','clustered']);choice(g,'quality',['low','balanced','high']);
 }
 function refreshEmitters(){
  const select=$('emitterSelect');select.replaceChildren();
  for(const e of cfg.emitters)select.add(new Option(e.id,e.id));
  select.value=selectedId??'';const e=selected();
  $('addEmitter').disabled=cfg.emitters.length>=4;$('duplicateEmitter').disabled=!e||cfg.emitters.length>=4;$('removeEmitter').disabled=!e;
  $('layerSelect').disabled=!e;
  const er=$('emitterControls'),lr=$('layerControls');er.replaceChildren();lr.replaceChildren();
  if(!e){updateHandle();return;}
  for(const [key,range] of Object.entries(transforms))field(er,'e-',key,range,e[key],v=>edit(c=>{c.emitters.find(x=>x.id===selectedId)[key]=v;}));
  const k=kind();if(k!=='emitter'){
   const l=e.layers[k];
   for(const [key,range] of Object.entries({...transforms,alpha:[0,1,.01]}))
    field(lr,'l-',key,range,l[key],v=>edit(c=>{c.emitters.find(x=>x.id===selectedId).layers[k][key]=v;}));
  }
  updateHandle();
 }
 function refreshCurves(){
  const key=$('curveSelect').value;
  curveEditor=FxCurveEditor.mount($('curve'),{curve:cfg[key],idPrefix:'shockCurve',
   getFrameCount:()=>39,isLocked:()=>busy,onScrub:t=>{setPlaying(false);seek(t*39/60);},
   onChange:curve=>edit(c=>{c[key]=curve;})});
 }
 function refreshControls(){
  refreshGeometry();refreshEmitters();refreshCurves();paletteEditor?.refresh(cfg.palette);
 }
 function updateHandle(){
  const e=selected(),h=$('originHandle');h.hidden=!e;
  if(!e)return;
  const k=kind(),l=e.layers[k],a=e.rotation*DEG;
  const x=e.x+(l?l.x*Math.cos(a)-l.y*Math.sin(a):0),y=e.y+(l?l.x*Math.sin(a)+l.y*Math.cos(a):0);
  h.style.left=x/512*100+'%';h.style.top=y/512*100+'%';
 }
 function add(copy){
  if(cfg.emitters.length>=4)return;
  let i=0;while(cfg.emitters.some(e=>e.id==='emitter'+(i+1)))i++;
  const e=copy?structuredClone(selected()):S.newEmitter(i);e.id='emitter'+(i+1);
  if(copy){e.x+=20;e.seed=(e.seed+997)|0;}
  const old=selectedId;selectedId=e.id;
  try{edit(c=>c.emitters.push(e),true);}catch(error){selectedId=old;status(error.message,true);}
 }
 async function initialize(requested){
  if(busy)return;busy=true;setPlaying(false);$('backend').disabled=true;
  let next=new PIXI.Application(),nextFx;
  try{
   await next.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,
    preference:requested==='webgpu'?'webgpu':'webgl',preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=next.renderer.gl?(next.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   if(actual!==requested)throw Error('Requested '+requested+', got '+actual);
   nextFx=FxShockwaveRuntime.createShockwave({PIXI,host:next.stage,settings:cfg});nextFx.seek(time);next.render();
   if(fx){fx.destroy();app.destroy(true,{children:true});}
   app=next;fx=nextFx;backend=actual;$('surface').prepend(app.canvas);$('backendActual').textContent=actual.toUpperCase();
   $('backend').value=backend;document.body.dataset.ready='true';status('Ready');
  }catch(error){nextFx?.destroy();if(next.renderer)next.destroy(true,{children:true});$('backend').value=backend;status(error.message,true);}
  finally{busy=false;$('backend').disabled=false;}
 }
 $('backend').onchange=()=>initialize($('backend').value);
 $('background').onchange=()=>{$('surface').className=$('background').value;};
 $('zoom').onchange=()=>{const size=512*Number($('zoom').value);$('surface').style.width=size+'px';};
 $('frame').oninput=$('frame').onchange=()=>{setPlaying(false);seek(Number($('frame').value)/60);};
 $('play').onclick=()=>{if(playing){setPlaying(false);return;}direction=1;if(time>=39/60)seek(0);setPlaying(true);};
 $('reverse').onclick=()=>{direction=-1;if(time<=0)seek(39/60);setPlaying(true);};
 $('resetFrame').onclick=()=>{setPlaying(false);seek(0);};
 $('emitterSelect').onchange=()=>{selectedId=$('emitterSelect').value;refreshEmitters();};
 $('layerSelect').onchange=refreshEmitters;$('curveSelect').onchange=refreshCurves;
 $('addEmitter').onclick=()=>add(false);$('duplicateEmitter').onclick=()=>add(true);
 $('removeEmitter').onclick=()=>{try{edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selectedId);},true);}catch(e){status(e.message,true);}};
 $('applyPreset').onclick=()=>{try{apply(JSON.parse($('preset').value),true);}catch(e){status(e.message,true);}};
 $('syncPreset').onclick=syncPreset;
 $('downloadPreset').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='shockwave-preset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('resetSettings').onclick=()=>{try{apply(S.defaults(),true);}catch(e){status(e.message,true);}};
 const handle=$('originHandle');
 handle.onpointerdown=e=>{
  const row=selected();if(!row||busy)return;e.preventDefault();setPlaying(false);
  const k=kind(),v=row.layers[k]||row,b=$('surface').getBoundingClientRect();
  drag={id:row.id,k,pointer:e.pointerId,x:e.clientX,y:e.clientY,sx:v.x,sy:v.y,w:b.width,h:b.height,a:k==='emitter'?0:row.rotation*DEG};
  handle.setPointerCapture(e.pointerId);
 };
 handle.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;
  const dx=(e.clientX-drag.x)*512/drag.w,dy=(e.clientY-drag.y)*512/drag.h,a=drag.a;
  try{edit(c=>{const row=c.emitters.find(x=>x.id===drag.id),v=row.layers[drag.k]||row;
   v.x=Math.max(-10000,Math.min(10000,Math.round((drag.sx+dx*Math.cos(a)+dy*Math.sin(a))*10)/10));
   v.y=Math.max(-10000,Math.min(10000,Math.round((drag.sy-dx*Math.sin(a)+dy*Math.cos(a))*10)/10));});}
  catch(error){status(error.message,true);}
 };
 handle.onlostpointercapture=()=>{drag=null;refreshEmitters();};
 paletteEditor=FxColorUi.mount($('palette'),{value:cfg.palette,defaultValue:S.defaults().palette,idPrefix:'shockPalette',
  isLocked:()=>busy,onChange:value=>edit(c=>{c.palette={...value,parameterKey:'shockColor'};})});
 refreshControls();syncPreset();requestAnimationFrame(tick);initialize(new URLSearchParams(location.search).get('backend')||backend);
})();
