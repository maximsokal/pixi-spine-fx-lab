// FIRE-02 Fire Explosion editor. Independent of the Burn and Torch editors.
'use strict';
const ExplosionEditor=(()=>{
 const $=id=>document.getElementById(id), core=FxExplosion, defaults=()=>core.defaults();
 let cfg=defaults(),app=null,host=null,fx=null,model=null,atlas=null,textures=[],asset=null;
 let time=0,playing=false,direction=1, busy=false,loading=false;
 let colorEditor=null,curveEditors={};
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
 const inputRanges={
  blastRadius:[10,350,1,'px'],burstSparks:[0,500,1,'items'],initialSpeed:[0,800,1,'px/s'],
  expansion:[.2,6,.1,'x'],shockwaveWidth:[0,60,1,'px'],smokePersistence:[0,180,1,'frames'],
  turbulence:[0,1,.01,''],sparkOriginGap:[.25,100,.25,'px'],
  debrisSpacing:[8,32,.5,'px'],burstJitter:[0,.45,.01,''],
  secondaryCount:[0,500,1,'items'],smokeCount:[0,64,1,'clouds'],
  durationFrames:[6,600,1,'frames'],exportFrames:[1,3600,1,'frames'],
  heading:[-360,360,1,'deg'],spread:[1,360,1,'deg'],
  seed:[-2147483648,2147483647,1,'int32']
 };
 const groups={geometry:['blastRadius','expansion','shockwaveWidth','initialSpeed',
  'turbulence','durationFrames','exportFrames','heading','spread','seed'],
  particles:['burstSparks','secondaryCount','sparkOriginGap','debrisSpacing',
   'burstJitter','smokePersistence','smokeCount']};
 const nice=name=>name.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
 function buildControls(){
  for(const [group,keys] of Object.entries(groups)){
   const holder=$(group==='geometry'?'geometryControls':'particleControls');
   holder.replaceChildren();
   for(const key of keys){
    const [min,max,step,unit]=inputRanges[key],label=document.createElement('label');
    label.className='control';label.htmlFor='p-'+key;label.append(document.createTextNode(nice(key)));
    const output=document.createElement('output');output.id='o-'+key;label.append(output);
    const inp=document.createElement('input');inp.type='range';inp.id='p-'+key;
    Object.assign(inp,{min,max,step});inp.value=cfg[key];
    inp.setAttribute('aria-label',nice(key));
    inp.addEventListener('input',()=>{
     if(busy)return;
     const value=['burstSparks','secondaryCount','smokeCount','seed','smokePersistence','durationFrames','exportFrames']
       .includes(key)?Number.parseInt(inp.value,10):Number(inp.value);
     cfg[key]=value;output.textContent=value+' '+unit;
     if(key==='exportFrames')updateFrameMax();
     redraw();
    });
    output.textContent=cfg[key]+' '+unit;
    label.append(inp);holder.append(label);
   }
  }
 }
 function buildLayers(){
  const root=$('layerControls');root.replaceChildren();
  for(const name of core.LAYERS){
   const box=document.createElement('div');box.className='layer-row';
   const header=document.createElement('div');header.className='row';
   const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=cfg.layers[name].enabled;
   enabled.id='layer-'+name;enabled.addEventListener('change',()=>{
    cfg.layers[name].enabled=enabled.checked;redraw();
   });
   const label=document.createElement('label');label.htmlFor=enabled.id;
   label.textContent=nice(name);header.append(label,enabled);box.append(header);
   const controls=document.createElement('div');controls.className='layer-coord';
   for(const coordinate of ['x','y']){
    const l=document.createElement('label');l.textContent=coordinate.toUpperCase();
    const value=document.createElement('input');value.type='number';value.step=1;
    value.id='layer-'+name+'-'+coordinate;value.value=cfg.layers[name][coordinate];
    value.addEventListener('change',()=>{
     const num=Number(value.value);
     if(!Number.isFinite(num)||Math.abs(num)>10000){status('Layer coordinate out of range',true);return;}
     cfg.layers[name][coordinate]=num;redraw();
    });
    l.append(value);controls.append(l);
   }
   for(const key of ['rotation','timeOffset']){
    const label=document.createElement('label');label.textContent=key==='rotation'?'Angle °':'Start offset (frames)';
    label.className='control';
    const value=document.createElement('input');value.type='number';value.step=1;
    value.min=key==='rotation'?-360:-3600;value.max=key==='rotation'?360:3600;
    value.id='layer-'+name+'-'+key;value.value=cfg.layers[name][key];
    value.addEventListener('change',()=>{
     if(!Number.isFinite(Number(value.value))||Number(value.value)<Number(value.min)||
        Number(value.value)>Number(value.max)){status('Layer parameter out of range',true);return}
     cfg.layers[name][key]=Number(value.value);redraw();
    });
    label.append(value);controls.append(label);
   }
   box.append(controls);
   const modes=document.createElement('div');modes.className='row';
   const blend=document.createElement('select');
   blend.id='layer-'+name+'-blend';
   for(const b of ['normal','add','screen','multiply']){
    const option=document.createElement('option');option.value=b;option.textContent=b;
    blend.append(option);
   }
   blend.value=cfg.layers[name].blend;
   blend.addEventListener('change',()=>{cfg.layers[name].blend=blend.value;redraw()});
   const vis=document.createElement('label');vis.textContent='Visible ';
   const visible=document.createElement('input');visible.type='checkbox';
   visible.checked=cfg.layers[name].visible;visible.id='visible-'+name;
   visible.addEventListener('change',()=>{cfg.layers[name].visible=visible.checked;redraw()});
   vis.append(visible);modes.append(blend,vis);box.append(modes);
   root.append(box);
  }
 }
 function buildAnchor(){
  const root=$('anchorControls');root.replaceChildren();
  const fields={type:['world','skeleton','bone','slot','attachment'],
    space:['world','local']};
  for(const [key,options] of Object.entries(fields)){
   const label=document.createElement('label');label.className='control';
   label.textContent=nice(key);
   const select=document.createElement('select');select.id='anchor-'+key;
   options.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.append(o)});
   select.value=cfg.anchor[key];
   select.onchange=()=>{cfg.anchor[key]=select.value;redraw()};
   label.append(select);root.append(label);
  }
  for(const key of ['name','slot','x','y','rotation']){
   const label=document.createElement('label');label.className='control';
   label.textContent=nice(key);
   const input=document.createElement('input');
   input.type=['x','y','rotation'].includes(key)?'number':'text';
   input.id='anchor-'+key;input.value=cfg.anchor[key];
   input.onchange=()=>{
    const value=input.type==='number'?Number(input.value):input.value;
    cfg.anchor[key]=value;redraw();
   };
   label.append(input);root.append(label);
  }
 }
 function buildGradient(){
  if(colorEditor&&typeof colorEditor.destroy==='function')colorEditor.destroy();
  const holder=$('gradientEditor');holder.replaceChildren();
  colorEditor=FxColorUi.mount(holder,{
   idPrefix:'explosionGradient',kind:'gradient',value:cfg.explosionGradient,
   defaultValue:defaults().explosionGradient,
   isLocked:()=>busy||loading,
   onChange(value){cfg.explosionGradient=value;redraw()}
  });
 }
 function buildCurves(){
  for(const e of Object.values(curveEditors))e?.destroy?.();
  curveEditors={};
  for(const [id,key] of [
   ['radiusCurveEditor','radiusCurve'],['fireCurveEditor','fireAlphaCurve'],
   ['sparkCurveEditor','sparkSpeedCurve'],['smokeCurveEditor','smokeSizeCurve'],
   ['emissionCurveEditor','emissionGapCurve'],['spacingCurveEditor','debrisSpacingCurve']
  ]){
   const container=$(id);container.replaceChildren();
   const title=document.createElement('h4');title.textContent=nice(key);
   container.append(title);
   const root=document.createElement('div');container.append(root);
   curveEditors[key]=FxCurveEditor.mount(root,{
    curve:cfg[key],getFrameCount:()=>cfg.durationFrames,
    isLocked:()=>busy||loading,
    onChange(value){cfg[key]=FxCurves.normalize(value);redraw()},
    onScrub(value){setTime(Math.max(0,Math.min(1,value))*cfg.durationFrames/60)}
   });
  }
 }
 function refreshControls(){
  for(const key of Object.keys(inputRanges)){
   const el=$('p-'+key),out=$('o-'+key);
   if(el){el.value=cfg[key];out.textContent=cfg[key]+' '+inputRanges[key][3];}
  }
  $('quality').value=cfg.quality;$('style').value=cfg.style;
  $('directionMode').value=cfg.directionMode;$('spatialMode').value=cfg.spatialMode;
  for(const key of ['secondaryBursts','debrisSpacingCurveEnabled','loop'])
   $(key).checked=cfg[key];
  updateFrameMax();buildLayers();buildAnchor();buildGradient();buildCurves();
 }
 function updateFrameMax(){
  $('frame').max=cfg.exportFrames-1;
  const frame=Math.min(cfg.exportFrames-1,Math.round(time*60));
  $('frame').value=frame;$('frameLabel').textContent=frame+' / '+(cfg.exportFrames-1);
 }
 async function loadImage(blob){
  const url=URL.createObjectURL(blob);
  try{const img=new Image();img.src=url;await img.decode();return img}
  finally{URL.revokeObjectURL(url)}
 }
 function binaryVersion(buf){const input=new spine.BinaryInput(buf);input.readInt32();input.readInt32();return input.readString()}
 function destroyModel(){
  if(model){host.removeChild(model);model.destroy();model=null}
  if(atlas){atlas.dispose();atlas=null}
  textures.forEach(t=>t.destroy());textures=[];
 }
 async function loadSkeleton(source){
  if(!source)return;
  const bytes=await source.skeleton.arrayBuffer();
  const binary=/\.skel$/i.test(source.skeletonName);
  const raw=binary?new Uint8Array(bytes):new TextDecoder().decode(bytes);
  const data=binary?raw:JSON.parse(raw);
  const version=binary?binaryVersion(raw):data.skeleton?.spine;
  if(typeof version!=='string'||!version.startsWith('4.2.'))
   throw Error('Explosion requires Spine 4.2 export. Actual: '+version);
  const newAtlas=new spine.TextureAtlas(await source.atlas.text()),newTextures=[];
  let newModel=null;
  try{
   for(const page of newAtlas.pages){
    const name=page.name.replace(/\\/g,'/');
    let blob=source.images.get(name);
    if(!blob){
     const matches=[...source.images].filter(([key])=>key.split('/').at(-1)===name.split('/').at(-1));
     if(matches.length===1)blob=matches[0][1];
    }
    if(!blob)throw Error('Missing atlas page '+page.name);
    const image=await loadImage(blob);
    const texture=new PIXI.ImageSource({resource:image,
     alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',
     autoGenerateMipmaps:false});
    newTextures.push(texture);
    page.setTexture(spine.SpineTexture.from(texture));
   }
   const loader=new spine.AtlasAttachmentLoader(newAtlas);
   const parser=binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
   const dataOut=parser.readSkeletonData(data);
   newModel=new spine.Spine({skeletonData:dataOut,autoUpdate:false});
   newModel.update(0);
   const bounds=newModel.getLocalBounds();
   if(!(bounds.width>0&&bounds.height>0))throw Error('Spine skeleton has no visible attachments');
   const scale=Math.min(260/Math.max(1,bounds.width),330/Math.max(1,bounds.height),2);
   newModel.scale.set(scale);
   newModel.position.set(256-(bounds.x+bounds.width/2)*scale,
                         260-(bounds.y+bounds.height/2)*scale);
   destroyModel();
   model=newModel;atlas=newAtlas;textures=newTextures;host.addChild(model);
   model.visible=$('showSpine').checked;
   const anim=$('animation'),skin=$('skin');
   anim.replaceChildren();skin.replaceChildren();
   const setup=document.createElement('option');setup.value='';setup.textContent='Setup pose';anim.append(setup);
   dataOut.animations.forEach(a=>{const op=document.createElement('option');op.value=a.name;op.textContent=a.name;anim.append(op)});
   dataOut.skins.forEach(a=>{const op=document.createElement('option');op.value=a.name;op.textContent=a.name;skin.append(op)});
   if(dataOut.skins.length){skin.value=dataOut.defaultSkin?.name||dataOut.skins[0].name;
    model.skeleton.setSkinByName(skin.value);model.skeleton.setSlotsToSetupPose();}
   if(dataOut.animations.length){anim.value=dataOut.animations.some(a=>a.name==='idle')?'idle':dataOut.animations[0].name;
    model.state.setAnimation(0,anim.value,true)}
   $('assetLabel').textContent=source.skeletonName+' • Spine '+version+
     ' • '+newAtlas.pages.length+' atlas pages';
   asset=source;recreateFx();redraw();
  }catch(e){
   newModel?.destroy();newAtlas.dispose();newTextures.forEach(t=>t.destroy());throw e;
  }
 }
 function recreateFx(){fx?.destroy();fx=FxExplosionRuntime.createExplosion({PIXI,app,host,model,settings:cfg})}
 function actualBackend(){
  if(!app)return {actual:'unavailable',requested:$('backend').value};
  const gl=app.renderer.gl;
  const actual=gl?(gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):
               app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown';
  return {actual,requested:$('backend').value,version:gl?gl.getParameter(gl.VERSION):null,
          pixi:PIXI.VERSION};
 }
 async function createRenderer(){
  if(busy||loading)return;
  loading=true;
  try{
   fx?.destroy();fx=null;destroyModel();
   if(app){app.destroy(true);app=null;host=null}
   const which=$('backend').value,preference=which==='webgpu'?'webgpu':'webgl';
   const next=new PIXI.Application();
   await next.init({width:512,height:512,resolution:1,backgroundAlpha:0,
    preference,preferWebGLVersion:which==='webgl1'?1:2,antialias:which==='webgl2'});
   app=next;const stage=$('preview');
   stage.querySelector('canvas')?.remove();stage.prepend(app.canvas);
   host=new PIXI.Container();app.stage.addChild(host);
   recreateFx();
   if(asset)await loadSkeleton(asset);
   const backend=actualBackend();
   $('backendActual').textContent=backend.actual.toUpperCase()+' • Pixi '+backend.pixi;
   if(backend.actual!==which)status('Requested '+which+' but got '+backend.actual+'; fallback not certified',true);
   else status('Explosion ready • '+backend.actual+' • 512×512 @ 60 FPS');
   app.ticker.add(ticker=>{
    if(!playing||busy)return;
    const end=(cfg.exportFrames-1)/60;
    if(cfg.loop){const duration=cfg.durationFrames/60;
      time=((time+(ticker.elapsedMS/1000)*direction)%duration+duration)%duration;
    }else{
      time=Math.max(0,Math.min(end,time+(ticker.elapsedMS/1000)*direction));
      if(time===0||time>=end){playing=false;$('play').textContent='Play'}
    }
    redraw();
   });
   redraw();
  }catch(e){status('Renderer error: '+e.message,true);throw e}
  finally{loading=false}
 }
 function seekSpine(seconds){
  if(!model)return;
  try{
   if($('animation').value)FxTimeline.seekSpine(model,seconds);
   else{model.skeleton.setToSetupPose();model.update(0)}
   model.visible=$('showSpine').checked;
  }catch(e){status('Spine pose: '+e.message,true)}
 }
 function redraw(){
  if(!app||!fx)return;
  try{
   cfg=core.normalize(cfg);
   seekSpine(time);
   app.render(); // update model matrices before evaluating world-space bone attachment
   fx.configure(cfg);
   fx.seek(time);
   const b=fx.diagnostics;
   if(b)status(b,true);
   else if(!fx.currentBounds().inside)status('Effect extends beyond 512x512. Use Fit to canvas before baking.',true);
   app.render();
   updateFrameMax();updateOriginHandle();
  }catch(e){status(e.message,true)}
 }
 function updateOriginHandle(){
  const h=$('originHandle'),isWorld=cfg.anchor.type==='world';
  h.hidden=!isWorld;h.style.left=cfg.anchor.x+'px';h.style.top=cfg.anchor.y+'px';
 }
 function setTime(seconds){
  time=Math.max(0,Math.min((cfg.exportFrames-1)/60,seconds));redraw();
 }
 function fitCanvas(){
  if(cfg.anchor.type!=='world'){status('Fit to canvas requires a world anchor. Switch anchor type first.',true);return false}
  const next=structuredClone(cfg);
  next.anchor.x=256;next.anchor.y=256;
  const boundFrames=Math.min(next.exportFrames,next.loop?next.durationFrames:
   next.durationFrames+next.smokePersistence+1);
  for(let attempt=0;attempt<65;attempt++){
   let safe=true;
   for(let frame=0;frame<boundFrames;frame++){
    const snapshot=core.sample(next,frame/60);
    if(!core.bounds(snapshot,{x:256,y:256},next.anchor.rotation*Math.PI/180).inside){
     safe=false;break;
    }
   }
   if(safe){cfg=next;refreshControls();redraw();status('Explicitly fitted explosion to 512x512');return true}
   // Shrink artist values deterministically; never modify hidden layer offsets.
   if(next.expansion>.2)next.expansion=Math.max(.2,Math.round(next.expansion*.88*1000)/1000);
   else if(next.blastRadius>10)next.blastRadius=Math.max(10,Math.round(next.blastRadius*.88*1000)/1000);
   else if(next.initialSpeed>0)next.initialSpeed=Math.max(0,Math.round(next.initialSpeed*.8));
   else break;
  }
  status('Cannot fit with existing layer positions. Adjust layer XY/angle or reduce size.',true);
  return false;
 }
 function bindButtons(){
  $('fitCanvas').onclick=fitCanvas;
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play'};
  $('reverse').onclick=()=>{direction*=-1;$('reverse').textContent=direction===1?'Reverse':'Forward'};
  $('reset').onclick=()=>{playing=false;$('play').textContent='Play';setTime(0)};
  $('frame').oninput=()=>{playing=false;$('play').textContent='Play';setTime(Number($('frame').value)/60)};
  $('zoom').onchange=()=>{
   $('preview').style.transform='scale('+$('zoom').value+')';
  };
  $('background').onchange=()=>{$('preview').className=$('background').value};
  $('backend').onchange=()=>createRenderer().catch(()=>{});
  $('directionMode').onchange=()=>{cfg.directionMode=$('directionMode').value;redraw()};
  $('spatialMode').onchange=()=>{cfg.spatialMode=$('spatialMode').value;redraw()};
  for(const key of ['secondaryBursts','debrisSpacingCurveEnabled','loop']){
   $(key).onchange=()=>{cfg[key]=$(key).checked;redraw()};
  }
  $('quality').onchange=()=>{cfg.quality=$('quality').value;redraw()};
  $('style').onchange=()=>{cfg.style=$('style').value;redraw()};
  $('stylePalette').onclick=()=>{
   const palette=structuredClone(defaults().explosionGradient);
   if(cfg.style==='magical'){palette.stops[0].rgba=[108,49,204,.9];
    palette.stops[1].rgba=[91,169,253,1];palette.stops[2].rgba=[232,255,255,1]}
   else if(cfg.style==='stylized'){palette.stops[0].rgba=[236,57,26,1];
    palette.stops[1].rgba=[255,171,34,1];palette.stops[2].rgba=[255,253,175,1]}
   cfg.explosionGradient=FxColors.normalize(palette);
   buildGradient();redraw();
  };
  $('animation').onchange=()=>{
   if(!model)return;
   const name=$('animation').value;
   if(name)model.state.setAnimation(0,name,true);else model.state.clearTracks();
   redraw();
  };
  $('skin').onchange=()=>{
   if(!model||!$('skin').value)return;
   model.skeleton.setSkinByName($('skin').value);model.skeleton.setSlotsToSetupPose();
   redraw();
  };
  $('showSpine').onchange=redraw;
  $('chooseFiles').onclick=()=>$('files').click();
  $('files').onchange=async()=>{
   const files=[...$('files').files];$('files').value='';
   const skeletons=files.filter(f=>/\.(json|skel)$/i.test(f.name)),
     atlases=files.filter(f=>/\.atlas$/i.test(f.name));
   if(skeletons.length!==1||atlases.length!==1){status('Select one .json/.skel, one .atlas and all images',true);return;}
   const images=new Map(files.filter(f=>/\.(png|jpg|jpeg|webp)$/i.test(f.name)).map(f=>[f.name,f]));
   loading=true;
   try{await loadSkeleton({skeletonName:skeletons[0].name,skeleton:skeletons[0],
    atlasName:atlases[0].name,atlas:atlases[0],images});
    status('Loaded Spine export '+skeletons[0].name);
   }catch(e){status('Load failed: '+e.message,true)}
   finally{loading=false}
  };
  $('sample').onclick=()=>loadSample().catch(e=>status(e.message,true));
  $('defaults').onclick=()=>{
   cfg=defaults();time=0;playing=false;direction=1;
   refreshControls();redraw();status('Explosion settings reset');
  };
  $('savePreset').onclick=()=>{
   const blob=new Blob([JSON.stringify({schemaVersion:1,effectId:'fx.fire.fire-explosion',
    settings:cfg},null,2)],{type:'application/json'});
   FxExplosionZip.download(blob,'Fire_Explosion_Preset.json');
  };
  $('loadPreset').onclick=()=>$('presetFile').click();
  $('presetFile').onchange=async()=>{
   const file=$('presetFile').files?.[0];$('presetFile').value='';
   if(!file)return;
   try{
    const doc=JSON.parse(await file.text());
    if(doc.schemaVersion!==1||doc.effectId!=='fx.fire.fire-explosion')throw Error('Unsupported preset effect/version');
    cfg=core.normalize(doc.settings);refreshControls();redraw();
    status('Imported Explosion preset '+file.name);
   }catch(e){status('Preset rejected: '+e.message,true)}
  };
  const handle=$('originHandle');let dragging=false;
  handle.onpointerdown=e=>{dragging=true;handle.setPointerCapture(e.pointerId);e.preventDefault()};
  handle.onpointermove=e=>{
   if(!dragging||cfg.anchor.type!=='world')return;
   const rect=$('preview').getBoundingClientRect(),scale=rect.width/512;
   cfg.anchor.x=Math.round(Math.max(0,Math.min(512,(e.clientX-rect.left)/scale)));
   cfg.anchor.y=Math.round(Math.max(0,Math.min(512,(e.clientY-rect.top)/scale)));
   $('anchor-x').value=cfg.anchor.x;$('anchor-y').value=cfg.anchor.y;redraw();
  };
  handle.onpointerup=handle.onpointercancel=()=>{dragging=false};
 }
 async function loadSample(){
  const spec=JSON.parse($('sampleData').textContent);
  const bytes=Object.entries(spec.images).map(([name,b64])=>[name,
   new Blob([Uint8Array.from(atob(b64),ch=>ch.charCodeAt(0))],{type:'image/png'})]);
  const value={skeletonName:spec.skeletonName,
   skeleton:new Blob([JSON.stringify(spec.skeleton)],{type:'application/json'}),
   atlasName:spec.atlasName,atlas:new Blob([spec.atlas],{type:'text/plain'}),
   images:new Map(bytes)};
  await loadSkeleton(value);status('Loaded '+spec.label+' sample');
 }
 async function extractBytes(){
  if(!app)throw Error('Renderer not ready');
  app.render();
  const uri=await app.renderer.extract.base64({target:app.stage,
   frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
  if(!uri.startsWith('data:image/png;base64,'))throw Error('PNG extraction unsupported');
  return Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0));
 }
 function setSettings(next){cfg=core.normalize(next);refreshControls();redraw()}
 bindButtons();buildControls();buildLayers();buildAnchor();buildGradient();buildCurves();
 createRenderer().catch(()=>{});
 return Object.freeze({
  getSettings:()=>structuredClone(cfg),getTime:()=>time,getPlaying:()=>playing,getApp:()=>app,
  getAsset:()=>asset,getModel:()=>model,getFx:()=>fx,getActualBackend:actualBackend,
  getStatus:()=>$('status').textContent,setSettings,seek:setTime,
  render:redraw,extractBytes,loadSample,
  busy:value=>{busy=!!value},setStatus:status,
  restore:(t,wasPlaying)=>{busy=false;time=t;playing=!!wasPlaying;
   $('play').textContent=playing?'Pause':'Play';redraw()},
  stop:()=>{playing=false;$('play').textContent='Play'},
  get isBusy(){return busy}
 });
})();
