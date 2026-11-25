// GAME-07 T03b: offline authoring shell. State is private to this editor.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),D=FxDash,E=FxDashEditorState,copy=x=>JSON.parse(JSON.stringify(x)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),NS='http://www.w3.org/2000/svg';
 const state=E.create(),cfg=()=>state.settings,end=()=> (cfg().durationFrames-1)/60;
 const movement={mode:['dash','teleport'],durationFrames:[2,3600,1],teleportFrame:[1,3599,1],dashLength:[10,600,'any'],trailWidth:[.5,110,'any'],quality:['low','balanced','high'],seed:[-2147483648,2147483647,1]};
 const spacing={echoMode:['time','distance'],afterimageCount:[0,24,1],temporalEchoGap:[1,20,'any'],spatialEchoGap:[1,100,'any'],afterimageAlpha:[0,1,'any'],echoLifetimeFrames:[1,3600,1],frequencySource:['interval','rate'],echoRate:[0,60,'any'],burstCount:[1,8,1],burstDelayFrames:[0,3600,'any'],minIntervalFrames:[0,3600,'any'],timeJitter:[0,.45,'any'],minGapPx:[1,100,'any'],maxGapPx:[1,100,'any'],spatialJitter:[0,.45,'any'],distribution:['even','random','stratified','clustered']};
 const accents={particleCount:[0,128,1],particleLifetimeFrames:[1,3600,1],particleSize:[.1,20,'any'],flashLifetimeFrames:[1,3600,1],flashRadius:[1,300,'any']};
 const transforms={enabled:null,visible:null,x:[-16384,16384,'any'],y:[-16384,16384,'any'],rotation:[-3600,3600,'any'],scale:[.01,20,'any'],timeOffset:[-3600,3600,'any'],seed:[-2147483648,2147483647,1]};
 const labels={mode:'Movement mode',durationFrames:'Duration (frames)',teleportFrame:'Jump frame',dashLength:'Arc length (px)',trailWidth:'Trail width (px)',afterimageCount:'Max echo births',echoMode:'Spacing domain',temporalEchoGap:'Time gap (frames)',spatialEchoGap:'Distance gap (px)',echoLifetimeFrames:'Echo lifetime (frames)',afterimageAlpha:'Echo alpha',frequencySource:'Temporal clock',echoRate:'Echoes / second',burstCount:'Burst count',burstDelayFrames:'Burst delay (frames)',minIntervalFrames:'Min interval (frames)',minGapPx:'Min gap (px)',maxGapPx:'Max gap (px)',timeJitter:'Time jitter',spatialJitter:'Spatial jitter',particleLifetimeFrames:'Particle life (frames)',particleSize:'Particle radius (px)',flashLifetimeFrames:'Flash life (frames)',flashRadius:'Flash radius (px)',rotation:'Rotation (degrees)',timeOffset:'Delay (frames)',x:'X (px)',y:'Y (px)',anchorType:'Anchor',anchorName:'Bone name'};
 let scene=null,backend='webgl2',busy=false,playing=false,direction=1,previous=null,poses={},zoom=1,fitMode=true,drag=null,palette=null,curveWidget=null;
 const pending={skeleton:null,atlas:null,images:new Map()};
 const status=(m,error=false)=>{$('status').textContent=m;$('status').dataset.error=String(error);};
 const guard=fn=>{if(busy||!scene||drag)return;try{fn();}catch(e){status(e.message,true);}};
 function setPlaying(v){playing=v;previous=null;$('play').textContent=v?'Pause':'Play';}
 function lock(v){busy=v;$('settingsPanel').disabled=v;for(const id of ['play','reverse','resetFrame','frame','backend'])$(id).disabled=v;if(!v)refreshButtons();}
 function dispose(s){if(!s)return;try{s.fx?.destroy();}finally{try{s.asset?.destroy();}finally{s.host?.destroy({children:true,texture:false,textureSource:false});}}}
 function optionsFor(asset,requested={}){return {animation:requested.animation??asset.defaultAnimation,skin:requested.skin??asset.defaultSkin,speed:requested.speed??1,loop:requested.loop??true,visible:requested.visible??true};}
 async function candidate(app,input,requested={}){
  const host=new PIXI.Container();let asset=null,fx=null;
  try{if(input){asset=await FxDashSpine.create(input,globalThis,requested.skin===undefined?{}:{skin:requested.skin});host.addChild(asset.model);}
   const options=asset?optionsFor(asset,requested):{},source=asset?.source??null;
   if(asset){asset.checkReplay([end()],options);asset.poseAt(state.time,options);}
   fx=FxDashRuntime.createDash({PIXI,host,settings:cfg(),asset,poseOptions:options});fx.seek(state.time);return {app,host,asset,fx,source,options};
  }catch(e){dispose({host,asset,fx});throw e;}
 }
 function render(){if(!scene)return;const t=state.time;
  poses=scene.asset?scene.asset.poseAt(t,scene.options):{};
  const sample=scene.fx.seek(t);scene.app.render();$('frame').max=cfg().durationFrames-1;$('frame').value=state.frame;$('frameLabel').textContent=state.frame+' / '+(cfg().durationFrames-1);
  $('anchorDiagnostics').textContent=sample.diagnostics.map(d=>d.emitterId+' / '+d.layer+': '+d.reason).join('; ');drawGuide();
 }
 function seek(t){state.seek(t);render();}
 function tick(now){if(playing&&!busy&&!drag){try{if(previous!==null){const t=state.time+direction*(now-previous)/1000;seek(t);if(t>=end()||t<=0)setPlaying(false);}if(playing)previous=now;}catch(e){setPlaying(false);status(e.message,true);}}requestAnimationFrame(tick);}
 function syncPreset(){$('preset').value=JSON.stringify(cfg(),null,2);}
 function apply(next,{refresh=false}={}){
  if(busy||!scene)throw Error('Renderer busy');setPlaying(false);
  state.commit(next,(settings)=>{scene.asset?.checkReplay([(settings.durationFrames-1)/60],scene.options);scene.fx.configure(settings);});
  syncPreset();render();refreshMarkers();if(refresh)refreshAll();else{$('p-dashLength').value=cfg().dashLength;refreshPoint();}status('Ready');
 }
 function edit(fn,refresh=false){const next=copy(cfg());fn(next);apply(next,{refresh});}
 function field(parent,prefix,key,range,value,change){
  const label=document.createElement('label');label.className='control';label.textContent=labels[key]||key;let el;
  if(range&&typeof range[0]==='string'){el=document.createElement('select');for(const v of range)el.add(new Option(v,v));el.value=value;}
  else{el=document.createElement('input');el.type=range?'number':key==='anchorName'?'text':'checkbox';if(range){[el.min,el.max,el.step]=range;el.value=value;}else if(el.type==='text'){el.maxLength=128;el.setAttribute('list','boneNames');el.value=value;}else el.checked=value;}
  el.id=prefix+key;label.append(el);parent.append(label);
  el.onchange=()=>{try{if(busy||drag)throw Error('Finish current edit first');if(el.type==='number'&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+key);const v=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;change(v);value=v;}catch(e){if(el.type==='checkbox')el.checked=value;else el.value=value;status(e.message,true);}};
 }
 function group(id,defs){const p=$(id);p.replaceChildren();for(const [key,range] of Object.entries(defs))field(p,'p-',key,range,cfg()[key],v=>{if(key==='dashLength')apply(E.scalePath(cfg(),v),{refresh:true});else edit(c=>{c[key]=v;},['durationFrames','mode','echoMode','frequencySource'].includes(key));});
  if(id==='movement')$('p-teleportFrame').disabled=cfg().mode!=='teleport';
  if(id==='spacing'){const distance=cfg().echoMode==='distance';for(const k of ['temporalEchoGap','frequencySource','echoRate','burstCount','burstDelayFrames','minIntervalFrames','timeJitter'])$('p-'+k).disabled=distance||(k==='echoRate'&&cfg().frequencySource!=='rate')||(k==='temporalEchoGap'&&cfg().frequencySource!=='interval');for(const k of ['spatialEchoGap','minGapPx','maxGapPx','spatialJitter','distribution'])$('p-'+k).disabled=!distance;}
 }
 function selected(){return cfg().emitters.find(e=>e.id===state.selectedId);}
 function refreshButtons(){$('addEmitter').disabled=busy||cfg().emitters.length>=4;$('duplicateEmitter').disabled=busy||cfg().emitters.length>=4;$('removeEmitter').disabled=busy||cfg().emitters.length===1;}
 function refreshTransform(){
  const p=$('transformControls'),k=state.layer,e=selected(),t=k==='emitter'?e:e.layers[k];p.replaceChildren();
  const update=(fn,refresh=false)=>edit(c=>{const row=c.emitters.find(r=>r.id===state.selectedId);fn(k==='emitter'?row:row.layers[k]);},refresh);
  for(const [key,range] of Object.entries(k==='emitter'?transforms:{...transforms,alpha:[0,1,'any'],blend:['normal','add','screen','multiply']}))field(p,k+'-',key,range,t[key],v=>update(o=>{o[key]=v;}));
  field(p,k+'-','anchorType',k==='emitter'?['world','local','bone']:['inherit','world','local','bone'],t.anchor.type,v=>update(o=>{o.anchor={type:v,name:v==='bone'?(scene?.asset?.bones[0]||'bone'):''};},true));
  if(t.anchor.type==='bone')field(p,k+'-','anchorName',null,t.anchor.name,v=>update(o=>{o.anchor.name=v;}));
 }
 function refreshEmitters(){const s=$('emitterSelect');s.replaceChildren();for(const e of cfg().emitters)s.add(new Option(e.id,e.id));s.value=state.selectedId;$('layerSelect').value=state.layer;refreshButtons();refreshTransform();refreshMarkers();drawGuide();}
 function refreshPoint(){const s=$('segmentSelect'),idx=clamp(Number(s.value)||0,0,cfg().path.segments.length-1);s.replaceChildren();for(let i=0;i<cfg().path.segments.length;i++)s.add(new Option(String(i+1),String(i)));s.value=idx;
  const k=$('pointSelect').value,p=cfg().path.segments[idx][k];$('pointX').value=p[0];$('pointY').value=p[1];for(const id of ['pointX','pointY','applyPoint'])$(id).disabled=idx===0&&k==='p0';}
 function refreshMarkers(){const list=state.markers,bar=$('birthMarkers');bar.replaceChildren();for(const m of list){const b=document.createElement('button');b.type='button';b.style.left=100*m.birthSeconds/end()+'%';b.title='Frame '+m.frame.toFixed(2)+' · '+m.travelDistance.toFixed(2)+' px';b.setAttribute('aria-label',b.title);b.onclick=()=>guard(()=>{setPlaying(false);seek(m.birthSeconds);});bar.append(b);}
  $('birthList').textContent=list.map((m,i)=>(i+1)+': f '+m.frame.toFixed(3)+' · '+m.travelDistance.toFixed(3)+' px').join('\n')||'No scheduled echoes';
  $('scheduleSummary').textContent=list.length+' echo births · '+state.plan.travelLength.toFixed(2)+' px traveled / '+state.plan.pathLength.toFixed(2)+' px path';
 }
 function refreshCurve(){const key=$('curveSelect').value;curveWidget=FxCurveEditor.mount($('curve'),{curve:cfg()[key],idPrefix:'dashCurve',getFrameCount:()=>cfg().durationFrames-1,isLocked:()=>busy||!!drag,onScrub:u=>guard(()=>{setPlaying(false);seek(u*end());}),onChange:value=>{try{edit(c=>{c[key]=value;});}catch(e){queueMicrotask(()=>{if($('curveSelect').value===key)curveWidget.setCurve(cfg()[key]);});throw e;}}});}
 function refreshAll(){group('movement',movement);group('spacing',spacing);group('accents',accents);refreshEmitters();refreshPoint();refreshCurve();palette?.refresh(cfg().palette);}
 function svg(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
 function drawGuide(settings=cfg()){
  const g=$('guides');g.replaceChildren();if(!$('showGuides').checked)return;const id=state.selectedId,k=state.layer,p=E.originTransform(settings,id,k,poses);if(!p)return;
  const radius=6/zoom;
  g.append(svg('circle',{id:'originHandle',cx:p.x,cy:p.y,r:radius,fill:'#172a40',stroke:'#73e4ff','stroke-width':2/zoom,'data-kind':'origin','aria-label':'Drag selected origin'}));
  if(!['emitter','trail'].includes(k))return;
  const segments=settings.path.segments.map(s=>Object.fromEntries(Object.entries(s).map(([key,v])=>[key,E.toWorld(p,v)])));
  const d=segments.map((s,i)=>(i?'':'M '+s.p0.join(' '))+' C '+s.p1.join(' ')+' '+s.p2.join(' ')+' '+s.p3.join(' ')).join(' ');
  g.prepend(svg('path',{d,stroke:'#b4e1ff','stroke-width':1.5,'stroke-dasharray':'5 4',fill:'none'}));
  segments.forEach((s,i)=>{for(const [a,b] of [['p0','p1'],['p2','p3']])g.append(svg('line',{x1:s[a][0],y1:s[a][1],x2:s[b][0],y2:s[b][1],stroke:'#799bb6','stroke-width':1}));
   for(const key of ['p1','p2','p3'])g.append(svg('circle',{cx:s[key][0],cy:s[key][1],r:radius,fill:key==='p3'?'#f8c46c':'#8bd3e9',stroke:'#162234','stroke-width':1.5/zoom,'data-kind':'path','data-index':i,'data-key':key,'aria-label':'Segment '+(i+1)+' '+key}));});
 }
 function setZoom(z,fit=false){if(drag)return;fitMode=fit;zoom=clamp(z,.1,4);$('surface').style.width=512*zoom+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';drawGuide();}
 function fit(){const v=$('viewport');setZoom(Math.min(1,(v.clientWidth-16)/512,(v.clientHeight-16)/512),true);}
 function populateSpine(){const a=$('animation'),s=$('skin'),b=$('boneNames');a.replaceChildren();s.replaceChildren();b.replaceChildren();const asset=scene?.asset,o=scene?.options||{};if(asset){a.add(new Option('Setup pose',''));for(const n of asset.animations)a.add(new Option(n,n));for(const n of new Set([asset.defaultSkin,...asset.skins]))s.add(new Option(n||'Default',n));for(const n of asset.bones){const x=document.createElement('option');x.value=n;b.append(x);}
   a.value=o.animation;s.value=o.skin;$('assetLabel').textContent=scene.source.name+' · Spine '+asset.version+' · '+asset.pages+' atlas pages';}
  else $('assetLabel').textContent='No Spine asset loaded';for(const id of ['animation','skin','animationSpeed','loopAnimation','showSpine','removeSpine'])$(id).disabled=!asset;
  $('animationSpeed').value=o.speed??1;$('loopAnimation').checked=o.loop??true;$('showSpine').checked=o.visible??true;
 }
 async function replace(requestedBackend,input,options={}){
  if(busy||drag)return;setPlaying(false);lock(true);let nextApp=null,next=null,old=scene,swapped=false,ownApp=!old||requestedBackend!==backend;
  try{
   nextApp=ownApp?new PIXI.Application():old.app;if(ownApp)await nextApp.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:requestedBackend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:requestedBackend==='webgl1'?1:2});
   const actual=nextApp.renderer.gl?(nextApp.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';if(actual!==requestedBackend)throw Error('Requested '+requestedBackend+', got '+actual);
   next=await candidate(nextApp,input,options);nextApp.stage.addChild(next.host);if(old&&!ownApp)old.host.visible=false;nextApp.render();
   scene=next;swapped=true;backend=actual;if(ownApp)$('surface').prepend(nextApp.canvas);
   if(old){dispose(old);if(ownApp)old.app.destroy(true,{children:true});}
   $('backendActual').textContent=actual.toUpperCase();$('backend').value=backend;document.body.dataset.ready='true';populateSpine();render();if(fitMode)fit();status('Ready');
  }catch(e){if(!swapped){dispose(next);if(ownApp&&nextApp?.renderer)nextApp.destroy(true,{children:true});if(old){old.host.visible=true;old.app.render();}}$('backend').value=backend;populateSpine();status(e.message,true);}
  finally{lock(false);}
 }
 function collect(files){const sk=files.filter(f=>/\.(json|skel)$/i.test(f.name)),at=files.filter(f=>/\.atlas$/i.test(f.name)),images=files.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name)),keys=images.map(f=>f.webkitRelativePath||f.name);
  if(sk.length>1||at.length>1||new Set(keys).size!==keys.length)throw Error('Ambiguous asset files');if(sk.length)pending.skeleton=sk[0];if(at.length)pending.atlas=at[0];images.forEach((f,i)=>pending.images.set(keys[i],f));renderPending();}
 function renderPending(){$('pendingFiles').textContent=[pending.skeleton?.name,pending.atlas?.name,...pending.images.keys()].filter(Boolean).join(', ')||'No files selected';}
 function sampleInput(){const s=JSON.parse($('sampleData').textContent);return {name:s.skeletonName,skeleton:new Blob([JSON.stringify(s.skeleton)]),atlas:new Blob([s.atlas]),images:new Map(Object.entries(s.images).map(([n,b])=>[n,new Blob([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],{type:'image/png'})]))};}
 function changeOptions(patch){if(scene?.asset)replace(backend,scene.source,{...scene.options,...patch});}
 $('sample').onclick=()=>{if(!busy)replace(backend,sampleInput());};$('removeSpine').onclick=()=>replace(backend,null);
 for(const id of ['skeletonFile','atlasFile','textureFiles','allFiles'])$(id).onchange=()=>{try{if(!busy)collect([...$(id).files]);}catch(e){status(e.message,true);}finally{$(id).value='';}};
 $('clearTextures').onclick=()=>{pending.images.clear();renderPending();};
 $('loadSpine').onclick=()=>replace(backend,{name:pending.skeleton?.name,skeleton:pending.skeleton,atlas:pending.atlas,images:new Map(pending.images)});
 $('animation').onchange=()=>changeOptions({animation:$('animation').value});$('skin').onchange=()=>changeOptions({skin:$('skin').value});$('loopAnimation').onchange=()=>changeOptions({loop:$('loopAnimation').checked});
 $('animationSpeed').onchange=()=>{const el=$('animationSpeed');if(!el.value.trim()||!el.validity.valid){populateSpine();status('Invalid animation speed',true);return;}changeOptions({speed:Number(el.value)});};
 $('showSpine').onchange=()=>guard(()=>{scene.options={...scene.options,visible:$('showSpine').checked};render();});
 $('surface').ondragover=e=>e.preventDefault();$('surface').ondrop=e=>{e.preventDefault();guard(()=>collect([...e.dataTransfer.files]));};
 $('play').onclick=()=>guard(()=>{if(playing){setPlaying(false);return;}direction=1;if(state.time>=end())seek(0);setPlaying(true);});$('reverse').onclick=()=>guard(()=>{direction=-1;if(state.time<=0)seek(end());setPlaying(true);});$('resetFrame').onclick=()=>guard(()=>{setPlaying(false);seek(0);});
 $('frame').oninput=()=>guard(()=>{setPlaying(false);seek(Number($('frame').value)/60);});$('background').onchange=()=>{$('surface').className=$('background').value;};$('showGuides').onchange=()=>drawGuide();
 $('backend').onchange=()=>replace($('backend').value,scene?.source,scene?.options);$('actualSize').onclick=()=>setZoom(1);$('fit').onclick=fit;$('zoomIn').onclick=()=>setZoom(zoom*2);$('zoomOut').onclick=()=>setZoom(zoom/2);new ResizeObserver(()=>{if(fitMode)fit();}).observe($('viewport'));
 $('viewport').addEventListener('wheel',e=>{if(busy||drag)return;e.preventDefault();const v=$('viewport'),r=$('surface').getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;setZoom(zoom*Math.exp(-e.deltaY*.001));const n=$('surface').getBoundingClientRect();v.scrollLeft+=n.left+x*n.width-e.clientX;v.scrollTop+=n.top+y*n.height-e.clientY;},{passive:false});
 $('emitterSelect').onchange=()=>guard(()=>{state.select($('emitterSelect').value);refreshEmitters();});$('layerSelect').onchange=()=>guard(()=>{state.select(state.selectedId,$('layerSelect').value);refreshEmitters();});$('curveSelect').onchange=refreshCurve;
 function add(duplicate){const a=E.addEmitter(cfg(),duplicate?state.selectedId:null);apply(a.settings,{refresh:true});state.select(a.id);refreshEmitters();}
 $('addEmitter').onclick=()=>guard(()=>add(false));$('duplicateEmitter').onclick=()=>guard(()=>add(true));$('removeEmitter').onclick=()=>guard(()=>apply(E.removeEmitter(cfg(),state.selectedId),{refresh:true}));
 $('segmentSelect').onchange=$('pointSelect').onchange=refreshPoint;
 $('applyPoint').onclick=()=>guard(()=>{const inputs=[$('pointX'),$('pointY')];if(inputs.some(e=>!e.value.trim()||!e.validity.valid))throw Error('Invalid control point');apply(E.movePathPoint(cfg(),Number($('segmentSelect').value),$('pointSelect').value,inputs.map(e=>Number(e.value))),{refresh:true});});
 $('splitPath').onclick=()=>guard(()=>apply(E.splitPath(cfg(),Number($('segmentSelect').value)),{refresh:true}));$('resetPath').onclick=()=>guard(()=>edit(c=>{const l=c.dashLength;c.path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[l/3,0],p2:[l*2/3,0],p3:[l,0]}]};},true));
 $('applyPreset').onclick=()=>guard(()=>apply(JSON.parse($('preset').value),{refresh:true}));$('syncPreset').onclick=syncPreset;$('resetSettings').onclick=()=>guard(()=>apply(D.defaults(),{refresh:true}));
 $('downloadPreset').onclick=()=>guard(()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(cfg(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='teleport-dash-preset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const g=$('guides');g.onpointerdown=e=>{const d=e.target.dataset;if(busy||!scene||!d.kind)return;e.preventDefault();setPlaying(false);try{drag={pointer:e.pointerId,session:E.startDrag(cfg(),{id:state.selectedId,layer:state.layer,kind:d.kind,index:Number(d.index),key:d.key,poses,rect:$('surface').getBoundingClientRect(),point:[e.clientX,e.clientY]})};g.setPointerCapture(e.pointerId);}catch(err){drag=null;status(err.message,true);}};
 g.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;try{drawGuide(drag.session.move([e.clientX,e.clientY]));}catch(err){status(err.message,true);}};
 g.onpointerup=e=>{if(!drag||e.pointerId!==drag.pointer)return;const session=drag.session;drag=null;try{apply(session.move([e.clientX,e.clientY]),{refresh:true});}catch(err){drawGuide();status(err.message,true);}};
 g.onpointercancel=g.onlostpointercapture=()=>{if(drag){drag=null;drawGuide();}};
 palette=FxColorUi.mount($('palette'),{value:cfg().palette,defaultValue:D.defaults().palette,idPrefix:'dashPalette',isLocked:()=>busy||!!drag,onChange:value=>edit(c=>{c.palette={...value,parameterKey:'dashColor'};})});
 refreshAll();syncPreset();populateSpine();requestAnimationFrame(tick);replace(new URLSearchParams(location.search).get('backend')||backend,null);
})();
