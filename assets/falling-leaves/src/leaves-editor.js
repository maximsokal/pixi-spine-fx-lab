// EARTH-04 L03: offline authoring; mutable state is scoped to the mounted instance.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(root,root.FxLeaves||(typeof require==='function'?require('./leaves-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxLeavesEditor=api;
})(globalThis,function(root,Core){
 'use strict';
 const ID='fx.earth.falling-leaves',clone=v=>JSON.parse(JSON.stringify(v)),mod=(v,n)=>((v%n)+n)%n;
 const clamp=v=>Math.max(-10000,Math.min(10000,v));
 function pointerDelta(dx,dy,rect){
  if(![dx,dy,rect?.width,rect?.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)
   throw TypeError('EARTH-04 invalid viewport');
  return {x:dx*512/rect.width,y:dy*512/rect.height};
 }
 function origin(anchor,e,kind){
  if(!anchor)return null;
  const l=kind==='origin'?{x:0,y:0}:e.layers[kind],a=(anchor.rotation+e.rotation)*Math.PI/180;
  return {x:anchor.x+(e.x+l.x)*Math.cos(a)-(e.y+l.y)*Math.sin(a),
   y:anchor.y+(e.x+l.x)*Math.sin(a)+(e.y+l.y)*Math.cos(a)};
 }
 function shift(e,kind,delta,anchor){
  if(!anchor||!Number.isFinite(delta.x)||!Number.isFinite(delta.y))throw TypeError('EARTH-04 invalid drag');
  const a=(anchor.rotation+e.rotation)*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  const target=kind==='origin'?e:e.layers[kind];
  target.x=clamp(target.x+delta.x*co+delta.y*si);
  target.y=clamp(target.y-delta.x*si+delta.y*co);
 }
 function createSession(initial,adapter={}){
  let cfg=Core.normalize(initial),time=0,playing=false,direction=1,selectedId=cfg.emitters[0]?.id??null;
  const end=()=>Core.PERIOD;
  function replace(next){
   const validated=Core.normalize(next);
   // The adapter must accept the candidate before the committed preset changes.
   adapter.configure?.(clone(validated));cfg=validated;
   if(!cfg.emitters.some(e=>e.id===selectedId))selectedId=cfg.emitters[0]?.id??null;
   return clone(cfg);
  }
  function edit(fn){const next=clone(cfg);fn(next);return replace(next);}
  function seek(t){
   if(!Number.isFinite(t)||t<0)throw RangeError('EARTH-04 invalid seek');
   const next=Math.min(t,end());adapter.seek?.(next);time=next;return next;
  }
  function tick(delta){
   if(!Number.isFinite(delta)||delta<0)throw RangeError('EARTH-04 invalid delta');
   if(!playing)return time;
   return seek(mod(time+delta*direction,end()));
  }
  function add(copy=false){
   if(cfg.emitters.length>=4)throw RangeError('EARTH-04 maximum 4 emitters');
   const index=Array.from({length:5},(_,i)=>i).find(i=>!cfg.emitters.some(e=>e.id==='emitter'+(i+1)));
   const source=cfg.emitters.find(e=>e.id===selectedId);
   const e=copy&&source?{...clone(source),id:'emitter'+(index+1),name:source.name.slice(0,123)+' copy',
    seed:(source.seed+997)|0,x:Math.min(10000,source.x+20)}:Core.newEmitter(index);
   edit(c=>c.emitters.push(e));selectedId=e.id;return e.id;
  }
  return Object.freeze({replace,edit,seek,tick,add:()=>add(),duplicate:()=>add(true),
   select(id){if(!cfg.emitters.some(e=>e.id===id))throw Error('EARTH-04 emitter missing');selectedId=id;},
   remove(){edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selectedId)});},
   play(){playing=true;},pause(){playing=false;},reverse(){direction*=-1;},reset(){seek(0);playing=false;return 0;},
   serialize:()=>JSON.stringify({schemaVersion:1,effectId:ID,settings:cfg},null,2),
   importPreset(raw){const p=JSON.parse(raw);if(!p||Object.keys(p).length!==3||p.schemaVersion!==1||p.effectId!==ID)throw Error('Invalid Falling Leaves preset');return replace(p.settings);},
   get settings(){return clone(cfg)},get selectedId(){return selectedId},get time(){return time},
   get playing(){return playing},get direction(){return direction},get end(){return end()}});
 }
 function mount(){
  const {PIXI,spine,FxLeavesRuntime,FxTimeline,FxCurveEditor,FxColorUi}=root,$=id=>document.getElementById(id);
  let scene=null,asset=null,busy=false,editors=[],lockedControls=[];
  const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
  function setBusy(v){
   if(busy===!!v)return;
   busy=!!v;
   if(busy){lockedControls=[...document.querySelectorAll('main input,main button,main select,main textarea')].filter(e=>e.id!=='cancel'&&!e.disabled);for(const e of lockedControls)e.disabled=true;}
   else{for(const e of lockedControls)e.disabled=false;lockedControls=[];}
  }
  function backend(app,requested){const gl=app.renderer.gl;return {requested,actual:gl?(typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown',pixi:PIXI.VERSION};}
  function pose(s,t){if(s.model){
   const poseTime=$('followFx').checked?t:Number($('spineTime').value);
   FxTimeline.seekSpine(s.model,poseTime);s.model.visible=$('showSpine').checked;}
   s.fx.seek(t);s.app.render();
  }
  const session=createSession(Core.defaults(),{
   configure(c){if(scene){scene.fx.configure(c);scene.app.render();}},
   seek(t){if(scene)pose(scene,t);}
  });
  function selection(c){return c.emitters.find(e=>e.id===session.selectedId);}
  function refreshTime(){
   $('frame').max=Math.max(0,session.settings.durationFrames-1);
   $('frame').value=Math.min(Number($('frame').max),Math.round(session.time*60));
   $('frameLabel').textContent=$('frame').value+' / '+$('frame').max;
   $('play').textContent=session.playing?'Pause':'Play';
   $('reverse').textContent=session.direction===1?'Reverse':'Forward';
   const fx=scene?.fx;
   updateHandles();
   if(fx){$('metrics').textContent=fx.totalActive+' active / '+fx.totalAllocated+' pooled';
    if(fx.diagnostics.length)status(fx.diagnostics.map(d=>d.emitter+': '+d.code).join('; '),true);}
  }
  function updateHandles(){
   const e=selection(session.settings),a=e&&scene?.fx.resolveAnchor(e.anchor);
   for(const kind of ['origin',...Core.LAYERS]){
    const h=$('handle-'+kind),p=e&&e.enabled&&e.visible&&(kind==='origin'||e.layers[kind].enabled&&e.layers[kind].visible)?origin(a,e,kind):null;
    const d={origin:[0,0],foreground:[24,0],background:[-24,0],gusts:[0,24]}[kind];
    h.hidden=!p||!$('guides').checked;if(p){h.style.left=(p.x+d[0])+'px';h.style.top=(p.y+d[1])+'px';}
   }
  }
  function attempt(fn,rebuild=false){if(busy)return false;
   try{fn();status('Falling Leaves • settings accepted');if(rebuild)refresh();else refreshTime();return true;}
   catch(e){status(e.message,true);return false;}
  }
  function addControl(holder,label,value,apply,options={}){
   const row=document.createElement('label');row.className='control';row.textContent=label;
   const input=document.createElement(options.choices?'select':'input');
   if(options.id)input.id=options.id;
   if(options.choices){for(const item of options.choices){const o=document.createElement('option');o.value=String(item);o.textContent=String(item);input.append(o)}}
   else{input.type=options.type||'number';for(const k of ['min','max','step'])if(options[k]!==undefined)input[k]=options[k];}
   const set=v=>{if(input.type==='checkbox')input.checked=v;else input.value=String(v);};
   set(value);input.onchange=()=>{const v=input.type==='checkbox'?input.checked:options.numeric||input.type==='number'?Number(input.value):input.value;
    if((input.type==='number'&&!input.value.trim())||!attempt(()=>apply(v),!!options.rebuild))set(value);else value=v;};
   row.append(input);holder.append(row);return input;
  }
  const ranges={leafRate:[0,80,1],leafSize:[6,40,.5],fallSpeed:[5,230,1],windSpeed:[-140,140,1],
   tumble:[0,360,1],shapeVariance:[0,1,.01],lifetime:[.25,8,.05],flutterAmplitude:[0,100,1],
   flutterFrequency:[0,8,.05],fieldWidth:[120,512,1],gustRate:[0,20,1],spatialGap:[5,120,1],
   minGap:[5,120,1],spatialJitter:[0,.45,.01],timeJitter:[0,.45,.01],spawnDelay:[0,2,.01],
   burstCount:[1,16,1],burstDelay:[0,.5,.01],seed:[-2147483648,2147483647,1]};
  const pretty=k=>k.replace(/([A-Z])/g,' $1').replace(/^./,v=>v.toUpperCase());
  function anchorControls(holder,a,get){
   addControl(holder,'Anchor type',a.type,v=>session.edit(c=>{const x=get(c);x.type=v;
    if(['bone','slot','attachment'].includes(v)&&!x.name)x.name='root';if(v==='attachment'&&!x.slot)x.slot='root';}),
    {choices:['world','skeleton','bone','slot','attachment'],rebuild:true});
   addControl(holder,'Space',a.space,v=>session.edit(c=>get(c).space=v),{choices:['world','local']});
   for(const k of ['name','slot','x','y','rotation'])addControl(holder,'Anchor '+pretty(k),a[k],v=>session.edit(c=>get(c)[k]=v),
    ['name','slot'].includes(k)?{type:'text'}:{min:k==='rotation'?-360:-10000,max:k==='rotation'?360:10000,step:1});
  }
  function transformControls(holder,obj,get,layer=false){
   for(const k of ['enabled','visible'])addControl(holder,pretty(k),obj[k],v=>session.edit(c=>get(c)[k]=v),{type:'checkbox'});
   for(const [k,min,max,step] of [['x',-10000,10000,1],['y',-10000,10000,1],['rotation',-360,360,1],
    ['timeOffset',-3600,3600,1],['seed',-2147483648,2147483647,1],...(layer?[['alpha',0,1,.05],
    ['rateScale',0,2,.05],['speedScale',.1,3,.05],['sizeScale',.1,3,.05],['parallax',0,3,.05]]:[])])
    addControl(holder,k==='timeOffset'?'Time offset (frames)':pretty(k),obj[k],v=>session.edit(c=>get(c)[k]=v),{min,max,step});
   if(layer)addControl(holder,'Blend',obj.blend,v=>session.edit(c=>get(c).blend=v),{choices:['normal','add','screen','multiply']});
   else{addControl(holder,'Name',obj.name,v=>session.edit(c=>get(c).name=v),{type:'text'});anchorControls(holder,obj.anchor,c=>get(c).anchor);}
  }
  function refresh(){
   const cfg=session.settings,controls=$('controls');controls.replaceChildren();
   for(const [k,[min,max,step]] of Object.entries(ranges))addControl(controls,pretty(k),cfg[k],v=>session.edit(c=>c[k]=v),{min,max,step,id:'p-'+k});
   addControl(controls,'Spatial mode',cfg.spatialMode,v=>session.edit(c=>c.spatialMode=v),{choices:['even','random','clustered','stratified']});
   addControl(controls,'Quality',cfg.quality,v=>session.edit(c=>c.quality=v),{choices:['low','balanced','high']});
   addControl(controls,'Timing mode',cfg.timingMode,v=>session.edit(c=>c.timingMode=v),{choices:['uniform','custom','clustered','burst']});
   addControl(controls,'Use spacing curve',cfg.spacingCurveEnabled,v=>session.edit(c=>c.spacingCurveEnabled=v),{type:'checkbox'});
   addControl(controls,'Style palette',cfg.style,v=>session.edit(c=>{c.style=v;c.palette=Core.palette(v)}),{choices:['natural','stylized','magical'],rebuild:true});
   const em=$('emitterControls');em.replaceChildren();
   if(cfg.emitters.length)addControl(em,'Selected',session.selectedId,v=>session.select(v),{choices:cfg.emitters.map(e=>e.id),rebuild:true});
   for(const [label,fn,disabled] of [['Add',()=>session.add(),cfg.emitters.length>=4],['Duplicate',()=>session.duplicate(),!selection(cfg)||cfg.emitters.length>=4],['Delete',()=>session.remove(),!selection(cfg)]]){
    const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>attempt(fn,true);em.append(b);
   }
   const e=selection(cfg);if(e){transformControls(em,e,selection);
    for(const kind of Core.LAYERS){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=pretty(kind);details.append(summary);
     const inside=document.createElement('div');inside.className='inside';transformControls(inside,e.layers[kind],c=>selection(c).layers[kind],true);details.append(inside);em.append(details);}
   }
   for(const x of editors)x?.destroy?.();editors=[];
   $('curves').replaceChildren();$('gradient').replaceChildren();
   for(const key of ['driftCurve','alphaCurve','spinCurve','rateCurve','spacingCurve']){
    const title=document.createElement('h4');title.textContent=pretty(key);$('curves').append(title);
    const el=document.createElement('div');$('curves').append(el);
    editors.push(FxCurveEditor.mount(el,{curve:cfg[key],idPrefix:'leaves-'+key,getFrameCount:()=>session.settings.durationFrames,isLocked:()=>busy,
     onChange:v=>{if(busy)throw Error('Editor busy');session.edit(c=>c[key]=v);refreshTime();},
     onScrub:v=>attempt(()=>session.seek(v*session.end))}));
   }
   editors.push(FxColorUi.mount($('gradient'),{idPrefix:'leavesGradient',kind:'gradient',value:cfg.palette,defaultValue:Core.defaults().palette,
    isLocked:()=>busy,onChange:v=>{if(busy)throw Error('Editor busy');session.edit(c=>c.palette=v);refreshTime();}}));
   refreshTime();
  }
  async function makeScene(which,source,settings,skin='',animation=''){
   const app=new PIXI.Application();let host,fx,sp=null,initialized=false;
   try{
    await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:which==='webgpu'?'webgpu':'webgl',
     preferWebGLVersion:which==='webgl1'?1:2,antialias:which!=='webgl1',autoStart:false,sharedTicker:false});
    initialized=true;host=new PIXI.Container();app.stage.addChild(host);
    if(source){sp=await root.FxLeavesSpine.readSpine(source,{PIXI,spine});host.addChild(sp.model);
     if(skin&&sp.data.skins.some(s=>s.name===skin)){sp.model.skeleton.setSkinByName(skin);sp.model.skeleton.setSlotsToSetupPose();}
     if(animation&&sp.data.animations.some(a=>a.name===animation))sp.model.state.setAnimation(0,animation,true);sp.model.update(0);}
    fx=FxLeavesRuntime.createLeaves({PIXI,app,host,model:sp?.model??null,settings});
    return {app,host,fx,model:sp?.model??null,data:sp?.data,actual:backend(app,which),
     dispose(){fx.destroy();if(sp){sp.model.destroy();sp.atlas.dispose();}app.destroy(true);}};
   }catch(e){fx?.destroy();if(sp){sp.model.destroy();sp.atlas.dispose();}if(initialized)app.destroy(true);throw e;}
  }
  function populateSpine(s,skin,animation){
   for(const [id,rows,selected] of [['skin',s.data?.skins||[],skin],['animation',s.data?.animations||[],animation]]){
    const el=$(id);el.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=id==='animation'?'Setup pose':'Default skin';el.append(empty);
    for(const item of rows){const opt=document.createElement('option');opt.value=item.name;opt.textContent=item.name;el.append(opt);}el.value=selected||'';
   }
  }
  async function switchScene(source=asset,which=$('backend').value){
   if(busy)return false;session.pause();setBusy(true);
   const skin=$('skin').value,animation=$('animation').value;let next=null;
   try{
    next=await makeScene(which,source,session.settings,skin,animation);
    // Draw before swapping the visible scene; a failed initialization does not
    // destroy the previous scene or change its asset/backend selection.
    pose(next,session.time);const old=scene;
    $('preview').prepend(next.app.canvas);scene=next;asset=source;next=null;
    old?.dispose();
    populateSpine(scene,skin,animation);$('backendActual').textContent=scene.actual.actual.toUpperCase()+' • Pixi '+scene.actual.pixi;
    $('assetLabel').textContent=asset?asset.skeletonName:'No Spine model';
    scene.app.ticker.add(t=>{if(!busy&&session.playing){try{session.tick(t.elapsedMS/1000);refreshTime();}catch(e){session.pause();status(e.message,true);}}});
    scene.app.start();refreshTime();status(scene.actual.actual===which?'Falling Leaves ready':'Requested '+which+'; actual '+scene.actual.actual,scene.actual.actual!==which);
    return true;
   }catch(e){next?.dispose();status('Scene rejected: '+e.message,true);if(scene)$('backend').value=scene.actual.requested;return false;}
   finally{setBusy(false);refreshTime();}
  }
  $('backend').onchange=()=>switchScene();$('background').onchange=()=>{$('preview').className=$('background').value};
  $('zoom').onchange=()=>{$('preview').style.transform='scale('+$('zoom').value+')'};
  $('play').onclick=()=>attempt(()=>session.playing?session.pause():session.play());
  $('reverse').onclick=()=>attempt(()=>session.reverse());$('reset').onclick=()=>attempt(()=>session.reset());
  $('frame').oninput=()=>attempt(()=>{session.pause();session.seek(Number($('frame').value)/60);});
  for(const id of ['showSpine','followFx','spineTime'])$(id).onchange=()=>attempt(()=>session.seek(session.time));
  $('guides').onchange=updateHandles;$('animation').onchange=()=>attempt(()=>{
   if(scene?.model){scene.model.state.clearTracks();if($('animation').value)scene.model.state.setAnimation(0,$('animation').value,true);session.seek(session.time);}
  });
  $('skin').onchange=()=>attempt(()=>{if(scene?.model){if($('skin').value)scene.model.skeleton.setSkinByName($('skin').value);else scene.model.skeleton.setSkin(null);scene.model.skeleton.setSlotsToSetupPose();session.seek(session.time);}});
  $('sample').onclick=()=>{if(busy)return;try{const spec=JSON.parse($('sampleData').textContent);switchScene({
   skeletonName:spec.skeletonName,skeleton:new Blob([JSON.stringify(spec.skeleton)]),atlasName:spec.atlasName,atlas:new Blob([spec.atlas]),
   images:new Map(Object.entries(spec.images).map(([n,v])=>[n,new Blob([Uint8Array.from(atob(v),ch=>ch.charCodeAt(0))])]))});}catch(e){status(e.message,true);}};
  $('chooseFiles').onclick=()=>{if(!busy)$('files').click()};
  $('files').onchange=()=>{if(busy)return;const files=[...$('files').files];$('files').value='';
   const sk=files.filter(f=>/\.(json|skel)$/i.test(f.name)),at=files.filter(f=>/\.atlas$/i.test(f.name));
   if(sk.length!==1||at.length!==1){status('Choose one skeleton, atlas and all texture pages',true);return;}
   switchScene({skeletonName:sk[0].name,skeleton:sk[0],atlasName:at[0].name,atlas:at[0],
    images:new Map(files.filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name)).map(f=>[f.name,f]))});
  };
  $('defaults').onclick=()=>attempt(()=>{session.replace(Core.defaults());session.reset();},true);
  function downloadPreset(raw){
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');
   a.href=url;a.download='Falling_Leaves_Preset.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('savePreset').onclick=()=>{if(!busy)downloadPreset(session.serialize());};
  $('loadPreset').onclick=()=>{if(!busy)$('presetFile').click()};
  $('presetFile').onchange=async()=>{const file=$('presetFile').files?.[0];$('presetFile').value='';if(!file||busy)return;
   try{const raw=await file.text();attempt(()=>session.importPreset(raw),true);}catch(e){status(e.message,true);}};
  for(const kind of ['origin',...Core.LAYERS]){
   const h=$('handle-'+kind);let drag=null;
   h.onpointerdown=event=>{if(busy||h.hidden)return;drag={x:event.clientX,y:event.clientY};h.setPointerCapture(event.pointerId);event.preventDefault();};
   h.onpointermove=event=>{
    if(!drag||busy)return;const e=selection(session.settings),anchor=e&&scene?.fx.resolveAnchor(e.anchor);
    if(!anchor)return;
    const delta=pointerDelta(event.clientX-drag.x,event.clientY-drag.y,$('preview').getBoundingClientRect());
    drag={x:event.clientX,y:event.clientY};attempt(()=>session.edit(c=>shift(selection(c),kind,delta,anchor)));
   };
   h.onpointerup=h.onpointercancel=h.onlostpointercapture=()=>{if(drag){drag=null;refresh();}};
  }
  refresh();switchScene(null);
  return Object.freeze({session,makeScene,status,setBusy,get busy(){return busy},get scene(){return scene},
   get asset(){return asset?{...asset,skin:$('skin').value,animation:$('animation').value}:null},
   getSettings:()=>session.settings,getPoseOptions:()=>({followFx:$('followFx').checked,spineTime:Number($('spineTime').value),visible:$('showSpine').checked}),getActualBackend:()=>scene?.actual??{actual:'unavailable',requested:$('backend').value},
   setSettings:c=>attempt(()=>session.replace(c),true),seek:t=>attempt(()=>session.seek(t)),
   stop:()=>session.pause(),refreshTime});
 }
 return {createSession,mount,pointerDelta,origin,shift};
});
