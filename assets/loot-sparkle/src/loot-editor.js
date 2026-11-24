// GAME-12 offline authoring; camera never enters the simulation.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),L=FxLoot,clone=structuredClone,deg=Math.PI/180;
 const range={durationFrames:[2,3600,1],sparkleCount:[1,80,1],sparkleSize:[1,30,.1],spawnIntervalFrames:[1,40,.1],lifetimeFrames:[1,3600,.1],haloRadius:[0,160,.1],twinkleHz:[0,15,.1],spreadRadius:[5,230,.1],baseGapPx:[3,90,.1],minGapPx:[3,90,.1],maxGapPx:[3,90,.1],spatialJitter:[0,.45,.01],timeJitter:[0,.45,.01],minIntervalFrames:[0,40,.1],groupCount:[1,8,1],groupDelayFrames:[0,40,.1],shineDelayFrames:[0,40,.1],seed:[-2147483648,2147483647,1]};
 const transform={enabled:null,visible:null,x:[-16384,16384,'any'],y:[-16384,16384,'any'],rotation:[-3600,3600,.1],scale:[.01,20,.01],timeOffset:[-3600,3600,.1],seed:range.seed};
 const choices={mode:['pickup','idle'],quality:['low','balanced','high'],distribution:['even','random','stratified','clustered'],frequencySource:['interval','rate']};
 let cfg=L.defaults(),selected=cfg.emitters[0].id,app=null,fx=null,busy=false,backend=null,zoom=1,drag=null,lastTime=null;
 const transport=FxTimeline.createTransport({duration:39/60});
 let curveEditor=null,paletteEditor=null;
 const emitter=()=>cfg.emitters.find(e=>e.id===selected),layer=()=>$('layerSelect').value;
 const status=(m,err=false)=>{$('status').textContent=m;$('status').dataset.error=String(err)};
 const end=()=>((cfg.mode==='idle'?cfg.durationFrames:cfg.durationFrames-1)/60);
 function lock(v){busy=v;for(const id of ['backend','originHandle','play','reverse'])$(id).disabled=v;}
 function seek(t){
  transport.seek(Math.max(0,Math.min(end(),t)));
  const seconds=transport.state.time,frame=Math.floor(seconds*60+1e-8);
  $('frame').value=frame;$('frameLabel').textContent=frame+' / '+Math.round(end()*60);
  if(fx){const s=fx.seek(seconds);app.render();status(s.diagnostics.length?s.diagnostics.map(d=>d.emitterId+'/'+d.layer+': '+d.reason).join('; '):s.cost+' visible primitives'+(s.emitters.some(e=>e.capped)?' | capacity limited':''));}
  updateHandle();return fx?.sample;
 }
 function apply(next,refresh=false){
  if(busy||!fx)throw Error('Renderer is busy');
  cfg=clone(fx.configure(next));if(!emitter())selected=cfg.emitters[0].id;
  transport.setDuration(end());transport.setLoop(cfg.mode==='idle');
  $('frame').max=Math.round(end()*60);$('preset').value=JSON.stringify(cfg,null,2);
  seek(transport.state.time);if(refresh)refreshAll();
 }
 function edit(fn,refresh=false){const next=clone(cfg);fn(next);apply(next,refresh)}
 function tryEdit(fn,refresh=false){try{edit(fn,refresh)}catch(e){status(e.message,true);return false}return true}
 function field(parent,id,key,value,spec,change){
  const label=document.createElement('label');label.className='control';label.textContent=key.replace(/([A-Z])/g,' $1');
  const input=document.createElement(Array.isArray(spec)&&typeof spec[0]==='string'?'select':'input');input.id=id;
  if(input.tagName==='SELECT'){for(const v of spec)input.add(new Option(v,v));input.value=value}
  else if(spec===null){input.type='checkbox';input.checked=value}
  else{input.type='number';[input.min,input.max,input.step]=spec;input.value=value}
  input.onchange=()=>{
   const v=spec===null?input.checked:input.tagName==='SELECT'?input.value:Number(input.value);
   if((input.type==='number'&&(!input.value.trim()||!input.validity.valid))||!change(v)){
    if(spec===null)input.checked=value;else input.value=value;return;
   }value=v;
  };label.append(input);parent.append(label);
 }
 function refreshParams(){
  const h=$('parameters');h.replaceChildren();
  for(const [k,r] of Object.entries(choices))field(h,'p-'+k,k,cfg[k],r,v=>tryEdit(c=>{c[k]=v;if(k==='mode'){c.durationFrames=v==='idle'?60:40;c.lifetimeFrames=Math.min(c.lifetimeFrames,c.durationFrames)}},k==='mode'));
  for(const [k,r] of Object.entries(range))field(h,'p-'+k,k,cfg[k],r,v=>tryEdit(c=>{c[k]=v},k==='durationFrames'));
 }
 function refreshLayers(){
  const l=emitter().layers[layer()],h=$('layerControls');h.replaceChildren();
  for(const [k,r] of Object.entries({...transform,alpha:[0,1,.01],blend:['normal','add','screen','multiply']}))field(h,'l-'+k,k,l[k],r,v=>tryEdit(c=>{c.emitters.find(x=>x.id===selected).layers[layer()][k]=v}));
  updateHandle();
 }
 function refreshEmitters(){
  const sel=$('emitterSelect');sel.replaceChildren();for(const e of cfg.emitters)sel.add(new Option(e.id,e.id));sel.value=selected;
  $('addEmitter').disabled=$('copyEmitter').disabled=cfg.emitters.length>=4;$('deleteEmitter').disabled=cfg.emitters.length<=1;
  const h=$('emitterControls');h.replaceChildren();
  for(const [k,r] of Object.entries(transform))field(h,'e-'+k,k,emitter()[k],r,v=>tryEdit(c=>{c.emitters.find(x=>x.id===selected)[k]=v}));
  refreshLayers();
 }
 function mountCurve(){
  const key=$('curveSelect').value,h=$('curveHost');h.replaceChildren();
  curveEditor=FxCurveEditor.mount(h,{curve:cfg[key],idPrefix:'lootCurve',getFrameCount:()=>cfg[key].domain==='particleAge'?Math.max(1,Math.round(cfg.lifetimeFrames)):cfg[key].domain==='pathPosition'?100:cfg.durationFrames,isLocked:()=>busy,onScrub(x){if(cfg[key].domain==='effectTime'||cfg[key].domain==='emitterTime'){pause();seek(x*end())}},onChange(c){edit(s=>{s[key]=c})}});
 }
 function refreshAll(){refreshParams();refreshEmitters();if(curveEditor)curveEditor.setCurve(cfg[$('curveSelect').value]);else mountCurve();paletteEditor?.refresh(cfg.palette)}
 function target(){
  const e=emitter(),l=e.layers[layer()],isLayer=$('moveTarget').value==='layer';
  if(!isLayer)return e.anchor.type==='world'?{x:e.x,y:e.y,angle:0,scale:1}:null;
  if(l.anchor.type==='world')return {x:l.x,y:l.y,angle:0,scale:1};
  if(l.anchor.type!=='inherit'||e.anchor.type!=='world')return null;
  const a=e.rotation*deg,x=l.x*e.scale,y=l.y*e.scale;
  return {x:e.x+x*Math.cos(a)-y*Math.sin(a),y:e.y+x*Math.sin(a)+y*Math.cos(a),angle:a,scale:e.scale};
 }
 function updateHandle(){if(drag)return;const h=$('originHandle'),p=target();h.hidden=!p;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%'}}
 $('originHandle').onpointerdown=e=>{
  const p=target();if(busy||!p)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  drag={p,startX:e.clientX,startY:e.clientY,scale:$('surface').getBoundingClientRect().width/512,dx:0,dy:0};
 };
 $('originHandle').onpointermove=e=>{if(!drag)return;drag.dx=(e.clientX-drag.startX)/drag.scale;drag.dy=(e.clientY-drag.startY)/drag.scale;e.currentTarget.style.left=(drag.p.x+drag.dx)/512*100+'%';e.currentTarget.style.top=(drag.p.y+drag.dy)/512*100+'%'};
 $('originHandle').onpointerup=()=>{
  if(!drag)return;const {p,dx,dy}=drag;drag=null;
  const x=(dx*Math.cos(p.angle)+dy*Math.sin(p.angle))/p.scale,y=(-dx*Math.sin(p.angle)+dy*Math.cos(p.angle))/p.scale;
  tryEdit(c=>{const e=c.emitters.find(x=>x.id===selected),v=$('moveTarget').value==='layer'?e.layers[layer()]:e;v.x+=x;v.y+=y},true);updateHandle();
 };
 $('originHandle').onpointercancel=()=>{drag=null;updateHandle()};
 function setZoom(v){zoom=Math.max(.25,Math.min(4,v));$('surface').style.width=$('surface').style.height=512*zoom+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';return zoom}
 $('zoomOut').onclick=()=>setZoom(zoom/1.25);$('zoomIn').onclick=()=>setZoom(zoom*1.25);$('zoomReset').onclick=()=>setZoom(1);
 $('fit').onclick=()=>setZoom(Math.min(($('view').clientWidth-24)/512,($('view').clientHeight-24)/512,1));
 $('view').addEventListener('wheel',e=>{e.preventDefault();const view=$('view'),before=$('surface').getBoundingClientRect(),x=(e.clientX-before.left)/before.width,y=(e.clientY-before.top)/before.height;setZoom(zoom*Math.exp(-e.deltaY*.0015));const after=$('surface').getBoundingClientRect();view.scrollLeft+=after.left+x*after.width-e.clientX;view.scrollTop+=after.top+y*after.height-e.clientY},{passive:false});
 $('background').onchange=()=>$('surface').className=$('background').value;
 $('emitterSelect').onchange=()=>{selected=$('emitterSelect').value;refreshEmitters()};$('layerSelect').onchange=refreshLayers;$('moveTarget').onchange=updateHandle;
 function add(copy){const i=Array.from({length:100},(_,i)=>i).find(i=>!cfg.emitters.some(e=>e.id==='emitter'+(i+1)));const next=L.newEmitter(i),e=copy?{...clone(emitter()),id:next.id,seed:next.seed,x:emitter().x+20}:next;if(tryEdit(c=>c.emitters.push(e))){selected=e.id;refreshEmitters()}}
 $('addEmitter').onclick=()=>add(false);$('copyEmitter').onclick=()=>add(true);$('deleteEmitter').onclick=()=>tryEdit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selected)},true);
 $('curveSelect').onchange=mountCurve;
 $('applyPreset').onclick=()=>{try{apply(JSON.parse($('preset').value),true)}catch(e){status(e.message,true)}};
 $('resetPreset').onclick=()=>{try{apply(L.defaults(),true)}catch(e){status(e.message,true)}};
 $('savePreset').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='loot-sparkle.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),0)};
 $('presetFile').onchange=async()=>{try{const f=$('presetFile').files[0];if(f){if(f.size>2*1024*1024)throw Error('Preset too large');apply(JSON.parse(await f.text()),true)}}catch(e){status(e.message,true)}finally{$('presetFile').value=''}};
 for(const [id,colors] of Object.entries({natural:[[255,255,255],[255,229,162],[255,201,77]],stylized:[[255,255,235],[255,184,68],[255,99,42]],magical:[[255,255,255],[166,232,255],[189,125,255]]}))$(id).onclick=()=>{if(tryEdit(c=>{c.palette=L.defaults().palette;c.palette.stops.forEach((s,i)=>s.rgba=[...colors[i],1])}))paletteEditor.refresh(cfg.palette)};
 function pause(){transport.pause();lastTime=null;$('play').textContent='Play'}
 $('play').onclick=()=>{if(transport.state.playing){pause();return}if(transport.state.time>=end())seek(0);transport.play(1);$('play').textContent='Pause'};
 $('reverse').onclick=()=>{if(transport.state.time===0)seek(end());transport.play(-1);$('play').textContent='Pause'};
 $('resetFrame').onclick=()=>{pause();seek(0)};$('frame').oninput=()=>{pause();seek(Number($('frame').value)/60)};
 function tick(t){if(transport.state.playing&&!busy){if(lastTime!==null){const s=transport.tick(Math.min(.25,(t-lastTime)/1000));seek(s.time);if(!s.playing)pause()}lastTime=transport.state.playing?t:null}requestAnimationFrame(tick)}
 async function init(request){
  if(busy)return;pause();lock(true);let candidate=null,renderer=null;
  try{
   candidate=new PIXI.Application();await candidate.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:request==='webgpu'?'webgpu':'webgl',preferWebGLVersion:request==='webgl1'?1:2});
   const actual=candidate.renderer.gl?(candidate.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';if(actual!==request)throw Error('Requested '+request+' but got '+actual);
   renderer=FxLootRuntime.createLoot({PIXI,host:candidate.stage,settings:cfg});renderer.seek(transport.state.time);candidate.render();
   const old=app,oldFx=fx;app=candidate;fx=renderer;backend=actual;candidate=null;renderer=null;
   $('surface').prepend(app.canvas);oldFx?.destroy();old?.destroy(true,{children:true});
   $('backendActual').textContent=backend;$('backend').value=backend;seek(transport.state.time);
  }catch(e){renderer?.destroy();if(candidate?.renderer)candidate.destroy(true,{children:true});$('backend').value=backend||request;status(e.message,true)}
  finally{lock(false)}
 }
 $('backend').onchange=()=>init($('backend').value);
 paletteEditor=FxColorUi.mount($('paletteHost'),{value:cfg.palette,defaultValue:L.defaults().palette,idPrefix:'lootPalette',isLocked:()=>busy,onChange(p){edit(c=>{c.palette={...p,parameterKey:'lootColor'}})}});
 $('preset').value=JSON.stringify(cfg,null,2);refreshAll();setZoom(1);
 globalThis.lootEditor=Object.freeze({get ready(){return !!fx&&!busy},get backend(){return backend},get settings(){return clone(cfg)},get sample(){return fx?.sample},seek,zoom:setZoom});
 init('webgl2');requestAnimationFrame(tick);
})();
