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
 let spineAsset=null,source=null,animation='',skin='',spineVisible=true,animationSpeed=1,poses={};
 const pending={skeleton:null,atlas:null,images:new Map()};
 function lock(value){
  busy=value;
  for(const id of ['backend','sample','loadSpine','removeSpine','skeletonFile','atlasFile','textureFiles','clearTextures','animation','skin','showSpine','animationSpeed','allFiles','frame','play','reverse','resetFrame','bakePng','bakeFrames','bakeX','bakeY','bakeWidth','bakeHeight','cropHandle','webglZip','webgpuZip'])
   $(id).disabled=value;
 }
 function pose(asset,seconds,name=animation,skinName=skin){
  return FxShockwaveSpine.pose(asset,seconds,{animation:name,skin:skinName,speed:animationSpeed,visible:spineVisible});
 }
 function populateSpine(){
  const a=$('animation'),s=$('skin');a.replaceChildren();s.replaceChildren();
  if(spineAsset){
   a.add(new Option('Setup pose',''));for(const name of spineAsset.animations)a.add(new Option(name,name));
   for(const name of spineAsset.skins)s.add(new Option(name,name));
   a.value=animation;s.value=skin;
   $('assetLabel').textContent=spineAsset.source.name+' · Spine '+spineAsset.version+' · '+spineAsset.pages+' atlas pages';
  }else $('assetLabel').textContent='No Spine asset loaded';
 }
 function renderPending(){
  $('pendingFiles').textContent=[pending.skeleton?.name,pending.atlas?.name,...pending.images.keys()].filter(Boolean).join(', ')||'No files selected';
 }
 function collect(files){
  const skeletons=files.filter(f=>/\.(json|skel)$/i.test(f.name)),atlases=files.filter(f=>/\.atlas$/i.test(f.name));
  if(skeletons.length>1||atlases.length>1)throw Error('Select exactly one skeleton and atlas');
  const images=files.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name));
  const keys=images.map(f=>f.webkitRelativePath||f.name);
  if(new Set(keys).size!==keys.length)throw Error('Ambiguous duplicate texture names');
  if(skeletons.length)pending.skeleton=skeletons[0];
  if(atlases.length)pending.atlas=atlases[0];
  for(let i=0;i<images.length;i++)pending.images.set(keys[i],images[i]);
  renderPending();
 }
 async function loadSpine(nextSource){
  if(busy||!app)return;
  lock(true);setPlaying(false);let candidate=null;
  try{
   candidate=await FxShockwaveSpine.create(nextSource);
   const nextAnimation=candidate.defaultAnimation,nextSkin=candidate.defaultSkin;
   const candidatePoses=pose(candidate,time,nextAnimation,nextSkin);
   app.stage.addChildAt(candidate.model,0);
   // Validate actual render while the previous asset is still owned.
   const previousVisible=spineAsset?.model.visible;
   if(spineAsset)spineAsset.model.visible=false;
   try{fx.seek(time,candidatePoses);app.render();}catch(error){if(spineAsset)spineAsset.model.visible=previousVisible;fx.seek(time,poses);throw error;}
   spineAsset?.destroy();spineAsset=candidate;candidate=null;source=nextSource;
   animation=nextAnimation;skin=nextSkin;populateSpine();seek(time);refreshEmitters();status('Loaded '+source.name);
  }catch(error){candidate?.destroy();app.render();status('Load failed: '+error.message,true);}
  finally{lock(false);}
 }
 $('sample').onclick=()=>loadSpine(FxShockwaveSpine.sample(JSON.parse($('sampleData').textContent)));
 for(const id of ['skeletonFile','atlasFile','textureFiles','allFiles'])$(id).onchange=()=>{
  try{if(!busy)collect([...$(id).files]);}catch(e){status(e.message,true);}finally{$(id).value='';}
 };
 $('clearTextures').onclick=()=>{if(!busy){pending.images.clear();renderPending();}};
 $('loadSpine').onclick=()=>loadSpine({name:pending.skeleton?.name,skeleton:pending.skeleton,atlas:pending.atlas,images:new Map(pending.images)});
 $('removeSpine').onclick=()=>{if(busy)return;spineAsset?.destroy();spineAsset=null;source=null;animation=skin='';populateSpine();seek(time);refreshEmitters();status('Ready');};
 $('animation').onchange=()=>{animation=$('animation').value;seek(time);};
 $('skin').onchange=()=>{skin=$('skin').value;seek(time);};
 $('showSpine').onchange=()=>{spineVisible=$('showSpine').checked;seek(time);};
 $('animationSpeed').onchange=()=>{
  const value=Number($('animationSpeed').value);
  if(!Number.isFinite(value)||value<.1||value>4){$('animationSpeed').value=animationSpeed;status('Invalid animation speed',true);return;}
  animationSpeed=value;seek(time);
 };
 $('surface').ondragover=e=>e.preventDefault();
 $('surface').ondrop=e=>{e.preventDefault();if(!busy)try{collect([...e.dataTransfer.files]);status('Files selected; click Load preview');}catch(error){status(error.message,true);}};

 const selected=()=>cfg.emitters.find(e=>e.id===selectedId);
 const kind=()=>$('layerSelect').value;
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').dataset.error=String(error);};
 function syncPreset(){$('preset').value=JSON.stringify(cfg,null,2);}
 function setPlaying(value){playing=value;previous=null;$('play').textContent=value?'Pause':'Play';}
 function seek(seconds){
  time=Math.max(0,Math.min(39/60,seconds));const frame=Math.floor(time*60+1e-9);
  $('frame').value=frame;$('frameLabel').textContent=frame+' / 39';
  poses=pose(spineAsset,time);const result=fx?.seek(time,poses);app?.render();updateHandle();
  $('anchorDiagnostics').textContent=(result?.diagnostics||[]).map(d=>d.emitterId+' / '+d.layer+': '+d.reason).join('; ');
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
 function anchorFields(parent,prefix,o,mutator,isLayer){
  const names=spineAsset?.model.skeleton.bones.map(b=>b.data.name).filter(n=>n!=='$local')||[];
  function select(key,label,options,value,change){
   const l=document.createElement('label');l.className='control';l.textContent=label;
   const input=document.createElement('select');input.id=prefix+key;
   for(const n of options)input.add(new Option(n,n));input.value=value;
   input.onchange=()=>{try{change(input.value)}catch(e){input.value=value;status(e.message,true)}};
   l.append(input);parent.append(l);
  }
  select('anchor','Anchor',isLayer?['inherit','world','local','bone']:['world','local','bone'],o.anchor.type,v=>{
   if(v==='bone'&&!names.length)throw Error('Load a Spine asset first');
   edit(c=>{mutator(c).anchor={type:v,name:v==='bone'?names[0]:''}},true);
  });
  if(o.anchor.type==='bone')select('bone','Bone',[...new Set([o.anchor.name,...names])],o.anchor.name,v=>edit(c=>{mutator(c).anchor.name=v},true));
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
  anchorFields(er,'e-',e,c=>c.emitters.find(x=>x.id===selectedId),false);
  const k=kind();if(k!=='emitter'){
   const l=e.layers[k];
   for(const [key,range] of Object.entries({...transforms,alpha:[0,1,.01]}))
    field(lr,'l-',key,range,l[key],v=>edit(c=>{c.emitters.find(x=>x.id===selectedId).layers[k][key]=v;}));
   anchorFields(lr,'l-',l,c=>c.emitters.find(x=>x.id===selectedId).layers[k],true);
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
  const e=selected(),h=$('originHandle'),p=e?S.resolveOrigin(e,kind(),poses).pose:null;h.hidden=!p;
  if(!p)return;
  h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';
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
  if(busy)return;lock(true);setPlaying(false);
  let next=new PIXI.Application(),nextFx,nextAsset=null;
  try{
   await next.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,
    preference:requested==='webgpu'?'webgpu':'webgl',preferWebGLVersion:requested==='webgl1'?1:2});
   const actual=next.renderer.gl?(next.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu';
   if(actual!==requested)throw Error('Requested '+requested+', got '+actual);
   let nextPoses={};if(source){nextAsset=await FxShockwaveSpine.create(source);next.stage.addChild(nextAsset.model);nextPoses=pose(nextAsset,time);}
   nextFx=FxShockwaveRuntime.createShockwave({PIXI,host:next.stage,settings:cfg});nextFx.seek(time,nextPoses);next.render();
   spineAsset?.destroy();if(fx){fx.destroy();app.destroy(true,{children:true});}
   spineAsset=nextAsset;app=next;fx=nextFx;poses=nextPoses;backend=actual;$('surface').prepend(app.canvas);$('backendActual').textContent=actual.toUpperCase();
   $('backend').value=backend;document.body.dataset.ready='true';seek(time);status('Ready');
  }catch(error){nextAsset?.destroy();nextFx?.destroy();if(next.renderer)next.destroy(true,{children:true});$('backend').value=backend;status(error.message,true);}
  finally{lock(false);}
 }
 let bakeAbort=null,cropDrag=null;
 function integer(id){const el=$(id);if(!el.value.trim()||!el.validity.valid||!Number.isInteger(Number(el.value)))throw Error('Invalid '+id);return Number(el.value)}
 function readCrop(){return {x:integer('bakeX'),y:integer('bakeY'),width:integer('bakeWidth'),height:integer('bakeHeight')}}
 function guide(){
  try{const c=readCrop(),g=$('cropGuide');g.hidden=!$('showCrop').checked;
   g.style.left=c.x/512*100+'%';g.style.top=c.y/512*100+'%';g.style.width=c.width/512*100+'%';g.style.height=c.height/512*100+'%';
   $('cropHandle').textContent=c.width+' x '+c.height;
  }catch(e){status(e.message,true)}
 }
 for(const id of ['bakeX','bakeY','bakeWidth','bakeHeight','showCrop'])$(id).onchange=guide;
 $('cropHandle').onpointerdown=e=>{if(busy)return;e.preventDefault();try{cropDrag={...readCrop(),px:e.clientX,py:e.clientY,scale:$('surface').getBoundingClientRect().width/512};e.currentTarget.setPointerCapture(e.pointerId)}catch(err){status(err.message,true)}};
 $('cropHandle').onpointermove=e=>{if(!cropDrag||busy)return;$('bakeX').value=Math.max(-16384,Math.min(16384,Math.round(cropDrag.x+(e.clientX-cropDrag.px)/cropDrag.scale)));$('bakeY').value=Math.max(-16384,Math.min(16384,Math.round(cropDrag.y+(e.clientY-cropDrag.py)/cropDrag.scale)));guide()};
 $('cropHandle').onpointerup=$('cropHandle').onpointercancel=$('cropHandle').onlostpointercapture=()=>{cropDrag=null};
 async function bake(){
  if(busy||!fx)return;
  let crop,frameCount;try{crop=readCrop();frameCount=integer('bakeFrames')}catch(e){status(e.message,true);return}
  const settings=structuredClone(cfg),actual=backend,wasPlaying=playing,wasDirection=direction;
  const options={animation,skin,speed:animationSpeed,visible:spineVisible,loop:true};
  const assetInfo=source?{name:source.name,version:spineAsset.version,pages:spineAsset.pages,options}:null;
  const factory=FxShockwaveBake.sceneFactory({source,poseOptions:options});
  setPlaying(false);lock(true);bakeAbort=new AbortController();$('cancelBake').disabled=false;$('bakeProgress').max=frameCount;$('bakeProgress').value=0;
  try{
   const r=await FxShockwaveExport.bakeSequence({settings,backend:actual,crop,frameCount,assetInfo,createScene:factory,signal:bakeAbort.signal,
    progress:(n,total)=>{$('bakeProgress').value=n;status('Baking '+n+'/'+total)},yieldFrame:()=>new Promise(resolve=>setTimeout(resolve,0))});
   const url=URL.createObjectURL(new Blob([r.zip],{type:'application/zip'})),a=document.createElement('a');
   a.href=url;a.download='Shockwave_'+frameCount+'_PNG.zip';try{a.click()}finally{setTimeout(()=>URL.revokeObjectURL(url),30000)}
   status('Exported '+frameCount+' PNG frames');
  }catch(e){status(e.message,true)}finally{bakeAbort=null;$('cancelBake').disabled=true;lock(false);direction=wasDirection;if(wasPlaying)setPlaying(true)}
 }
 async function exportDeveloper(target){
  if(busy||!fx)return;
  let crop,frameCount;try{crop=readCrop();frameCount=integer('bakeFrames')}catch(e){status(e.message,true);return}
  const settings=structuredClone(cfg),retained=source?{...source,images:new Map(source.images)}:null;
  const options={animation,skin,speed:animationSpeed,visible:spineVisible},assetInfo=spineAsset?{version:spineAsset.version}:null;
  const previewSeconds=time,wasPlaying=playing,wasDirection=direction;
  setPlaying(false);lock(true);
  try{
   const names=['curve-core.js','color-core.js','timeline-core.js','shockwave-core.js','shockwave-runtime.js','shockwave-spine.js'];
   const r=await FxShockwaveExportBrowser.developer({settings,target,source:retained,options,assetInfo,previewSeconds,crop,frameCount,sources:Object.fromEntries(names.map(n=>[n,$(n).textContent])),licenses:$('runtimeLicenses').textContent});
   const url=URL.createObjectURL(new Blob([r.zip],{type:'application/zip'})),a=document.createElement('a');
   a.href=url;a.download='Shockwave_'+target+'.zip';try{a.click()}finally{setTimeout(()=>URL.revokeObjectURL(url),30000)}
   status('Exported '+target+' developer ZIP');
  }catch(e){status(e.message,true)}finally{lock(false);direction=wasDirection;if(wasPlaying)setPlaying(true)}
 }
 $('webglZip').onclick=()=>exportDeveloper('webgl');$('webgpuZip').onclick=()=>exportDeveloper('webgpu');
 $('bakePng').onclick=bake;$('cancelBake').onclick=()=>bakeAbort?.abort();guide();
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
  const parent=S.resolveOrigin(row,k,poses).parent;if(!parent)return;
  drag={id:row.id,k,pointer:e.pointerId,x:e.clientX,y:e.clientY,sx:v.x,sy:v.y,w:b.width,h:b.height,a:parent.rotation*DEG,scale:parent.scale};
  handle.setPointerCapture(e.pointerId);
 };
 handle.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;
  const dx=(e.clientX-drag.x)*512/drag.w/drag.scale,dy=(e.clientY-drag.y)*512/drag.h/drag.scale,a=drag.a;
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
