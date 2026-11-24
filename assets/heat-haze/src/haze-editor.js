// FIRE-06 Heat Haze editor. Real captured-scene refraction, separate from FIRE-01..05.
'use strict';
const HazeEditor=(()=>{
 const $=id=>document.getElementById(id), core=FxHaze, defaults=()=>core.defaults();
 let cfg=defaults(),app=null,host=null,fx=null,model=null,atlas=null,textures=[],asset=null;
 let time=0,playing=false,direction=1, busy=false,loading=false,selectedId=cfg.emitters[0].id;
 let colorEditor=null,curveEditors={},backgroundGraphic=null;
 let backgroundTexture=null,backgroundSprite=null,backgroundImage=null,backgroundAsset=null;
 let backgroundSourceKind='checker';
 function updateBackground(){
  if(!host||!app)return;
  if(backgroundGraphic){backgroundGraphic.removeFromParent();backgroundGraphic.destroy();backgroundGraphic=null}
  if(backgroundSprite){backgroundSprite.removeFromParent();backgroundSprite.destroy();backgroundSprite=null}
  if(backgroundTexture){backgroundTexture.destroy(true);backgroundTexture=null}
  if(backgroundSourceKind==='local'&&backgroundImage){
   backgroundTexture=PIXI.Texture.from(backgroundImage);
   backgroundSprite=new PIXI.Sprite(backgroundTexture);
   backgroundSprite.width=backgroundSprite.height=512;
   host.addChildAt(backgroundSprite,0);
  }else if(backgroundSourceKind!=='none'){
   backgroundGraphic=new PIXI.Graphics();
   for(let y=0;y<512;y+=8)for(let x=0;x<512;x+=8){
    const check=(Math.floor(x/8)+Math.floor(y/8))%2===0;
    const base=backgroundSourceKind==='light'?
     (check?0xe6eaf1:0xfafcff):backgroundSourceKind==='dark'?
     (check?0x121925:0x364153):(check?0x1d2c42:0xd9e5fa);
    backgroundGraphic.rect(x,y,8,8).fill(base);
   }
   backgroundGraphic.label='explicit Pixi scene background '+backgroundSourceKind;
   host.addChildAt(backgroundGraphic,0);
  }
 }

 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
 const inputRanges={
 amplitude:[0,32,.25,'px'],
 noiseFrequency:[.005,.2,.001,'/px'],verticalFlow:[-100,150,1,'px/s'],
 regionWidth:[10,350,1,'px'],edgeFalloff:[0,100,1,'px'],
 density:[0,1,.01,''],
 pulseRate:[0,12,.1,'Hz'],pulseJitter:[0,.45,.01,''],
 gustRate:[0,5,.1,'Hz'],gustJitter:[0,.45,.01,''],
 nodeGap:[.25,100,.25,'px'],nodeJitter:[0,.45,.01,''],
 durationFrames:[1,1200,1,'frames'],stopFrame:[1,600,1,'frames'],
 fadeFrames:[1,600,1,'frames'],exportFrames:[1,3600,1,'frames'],
 seed:[-2147483648,2147483647,1,'int32']
 };
 const groups={
  geometry:['amplitude','noiseFrequency','verticalFlow','regionWidth',
   'edgeFalloff','density','durationFrames','stopFrame','fadeFrames',
   'exportFrames','seed'],
  particles:['pulseRate','pulseJitter','gustRate','gustJitter','nodeGap','nodeJitter']
 };
 const selected=()=>cfg.emitters.find(e=>e.id===selectedId)||cfg.emitters[0]||null;
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
     const value=['stopFrame','fadeFrames','durationFrames','exportFrames','seed']
       .includes(key)?Number.parseInt(inp.value,10):Number(inp.value);
     const previousDuration=cfg.durationFrames;
     cfg[key]=value;output.textContent=value+' '+unit;
     if(cfg.mode==='stop'&&['stopFrame','fadeFrames'].includes(key)){
      cfg.durationFrames=cfg.stopFrame+cfg.fadeFrames;
      if(cfg.exportFrames===previousDuration)cfg.exportFrames=cfg.durationFrames;
      $('p-durationFrames').value=cfg.durationFrames;
      $('o-durationFrames').textContent=cfg.durationFrames+' frames';
      $('p-exportFrames').value=cfg.exportFrames;
      $('o-exportFrames').textContent=cfg.exportFrames+' frames';
     }
     if(['exportFrames','durationFrames','stopFrame','fadeFrames'].includes(key))updateFrameMax();
     redraw();
    });
    output.textContent=cfg[key]+' '+unit;
    label.append(inp);holder.append(label);
   }
  }
 }
 function updateControlDependencies(){
  if($('p-durationFrames'))$('p-durationFrames').disabled=cfg.mode!=='loop';
  if($('p-stopFrame'))$('p-stopFrame').disabled=cfg.mode!=='stop';
  if($('p-fadeFrames'))$('p-fadeFrames').disabled=cfg.mode==='loop';
  if($('p-gustRate'))$('p-gustRate').disabled=!cfg.gustEnabled;
  if($('p-gustJitter'))$('p-gustJitter').disabled=!cfg.gustEnabled;
 }
 function buildEmitters(){
  const root=$('emitterControls');root.replaceChildren();
  const toolbar=document.createElement('div');toolbar.className='stack';
  const chooser=document.createElement('select');chooser.id='emitterSelect';
  for(const e of cfg.emitters){const op=document.createElement('option');
   op.value=e.id;op.textContent=e.name+' ('+e.id+')';chooser.append(op)}
  chooser.value=selectedId;
  chooser.onchange=()=>{selectedId=chooser.value;buildEmitters();buildLayers();buildAnchor();
   redraw()};
  toolbar.append(chooser);
  function addButton(text,id,callback){
   const b=document.createElement('button');b.id=id;b.textContent=text;
   b.disabled=cfg.emitters.length>=4&&id!=='removeEmitter';
   if(id==='removeEmitter')b.disabled=cfg.emitters.length===0;
   b.onclick=callback;toolbar.append(b);
  }
  const nextId=()=>{
   for(let i=1;i<=1000;i++)if(!cfg.emitters.some(e=>e.id==='emitter'+i))
    return {id:'emitter'+i,index:i-1};
   throw Error('Haze maximum IDs exhausted');
  };
  addButton('Add','addEmitter',()=>{
   if(cfg.emitters.length>=4)return;
   const n=nextId(),e=core.newEmitter(n.index);e.id=n.id;
   cfg.emitters.push(e);selectedId=e.id;refreshControls();redraw();
  });
  addButton('Duplicate','duplicateEmitter',()=>{
   if(cfg.emitters.length>=4||!selected())return;
   const n=nextId(),e=structuredClone(selected());e.id=n.id;
   e.name+=' copy';e.seed=(e.seed+997)|0;e.x+=25;e.y+=8;
   cfg.emitters.push(e);selectedId=e.id;refreshControls();redraw();
  });
  addButton('Delete','removeEmitter',()=>{
   cfg.emitters=cfg.emitters.filter(e=>e.id!==selectedId);
   selectedId=cfg.emitters[0]?.id||null;refreshControls();redraw();
  });
  root.append(toolbar);
  const e=selected();if(!e){root.append(document.createTextNode('No emitters; click Add.'));return}
  function control(key,min,max,step,kind='number'){
   const label=document.createElement('label');label.className='control';
   label.textContent=nice(key);
   const el=document.createElement('input');el.id='emitter-'+key;el.type=kind;
   if(kind==='checkbox')el.checked=e[key];
   else{el.value=e[key];el.min=min;el.max=max;el.step=step}
   el.onchange=()=>{
    const v=kind==='checkbox'?el.checked:kind==='number'?Number(el.value):el.value;
    if(typeof v==='number'&&(!Number.isFinite(v)||v<min||v>max)){
     status('Invalid emitter '+key,true);return}
    e[key]=v;redraw();
   };label.append(el);root.append(label);
  }
  for(const key of ['enabled','visible'])control(key,0,1,1,'checkbox');
  for(const [k,lo,hi,step] of [
   ['x',-10000,10000,1],['y',-10000,10000,1],['rotation',-360,360,1],
   ['timeOffset',-600,600,1],['seed',-2147483648,2147483647,1],
   ['amplitudeScale',0,3,.05]])control(k,lo,hi,step);
  const note=document.createElement('p');note.className='small';
  note.textContent='Drag the turquoise centerline Bezier handles on the preview; emitter XY and anchor are independent.';
  root.append(note);
 }
 function buildLayers(){
  const root=$('layerControls');root.replaceChildren();
  const e=selected();if(!e)return;
  for(const name of core.LAYERS){
   const box=document.createElement('div');box.className='layer-row';
   const header=document.createElement('div');header.className='row';
   const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=e.layers[name].enabled;
   enabled.id='layer-'+name;enabled.addEventListener('change',()=>{
    e.layers[name].enabled=enabled.checked;redraw();
   });
   const label=document.createElement('label');label.htmlFor=enabled.id;
   label.textContent=nice(name);header.append(label,enabled);box.append(header);
   const controls=document.createElement('div');controls.className='layer-coord';
   for(const coordinate of ['x','y']){
    const l=document.createElement('label');l.textContent=coordinate.toUpperCase();
    const value=document.createElement('input');value.type='number';value.step=1;
    value.id='layer-'+name+'-'+coordinate;value.value=e.layers[name][coordinate];
    value.onchange=()=>{
     const n=Number(value.value);
     if(!Number.isFinite(n)||Math.abs(n)>10000){status('Layer coordinate out of range',true);return}
     e.layers[name][coordinate]=n;redraw();
    };
    l.append(value);controls.append(l);
   }
   for(const key of ['rotation','timeOffset','alpha']){
    const label=document.createElement('label');label.className='control';
    label.textContent=key==='timeOffset'?'Time offset (frames)':nice(key);
    const value=document.createElement('input');value.type='number';
    value.step=key==='alpha'?.05:1;
    value.min=key==='alpha'?0:key==='rotation'?-360:-3600;
    value.max=key==='alpha'?1:key==='rotation'?360:3600;
    value.id='layer-'+name+'-'+key;value.value=e.layers[name][key];
    value.onchange=()=>{
     const n=Number(value.value);
     if(!Number.isFinite(n)||n<Number(value.min)||n>Number(value.max)){
      status('Layer '+key+' out of range',true);return}
     e.layers[name][key]=n;redraw();
    };label.append(value);controls.append(label);
   }
   box.append(controls);
   const modes=document.createElement('div');modes.className='row';
   const blend=document.createElement('select');blend.id='layer-'+name+'-blend';
   for(const b of ['normal','add']){
    const option=document.createElement('option');option.value=b;option.textContent=b;blend.append(option)}
   blend.value=e.layers[name].blend;blend.disabled=name==='refraction';blend.onchange=()=>{e.layers[name].blend=blend.value;redraw()};
   const vis=document.createElement('label');vis.textContent='Visible ';
   const visible=document.createElement('input');visible.type='checkbox';visible.id='visible-'+name;
   visible.checked=e.layers[name].visible;
   visible.onchange=()=>{e.layers[name].visible=visible.checked;redraw()};
   vis.append(visible);modes.append(blend,vis);box.append(modes);root.append(box);
  }
 }
 function buildAnchor(){
  const root=$('anchorControls');root.replaceChildren();if(!selected())return;
  const fields={type:['world','skeleton','bone','slot','attachment'],
    space:['world','local']};
  for(const [key,options] of Object.entries(fields)){
   const label=document.createElement('label');label.className='control';
   label.textContent=nice(key);
   const select=document.createElement('select');select.id='anchor-'+key;
   options.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.append(o)});
   select.value=selected()?.anchor[key];
   select.onchange=()=>{selected().anchor[key]=select.value;redraw()};
   label.append(select);root.append(label);
  }
  for(const key of ['name','slot','x','y','rotation']){
   const label=document.createElement('label');label.className='control';
   label.textContent=nice(key);
   const input=document.createElement('input');
   input.type=['x','y','rotation'].includes(key)?'number':'text';
   input.id='anchor-'+key;input.value=selected()?.anchor[key];
   input.onchange=()=>{
    const value=input.type==='number'?Number(input.value):input.value;
    selected().anchor[key]=value;redraw();
   };
   label.append(input);root.append(label);
  }
 }
 function buildGradient(){
  if(colorEditor&&typeof colorEditor.destroy==='function')colorEditor.destroy();
  const holder=$('gradientEditor');holder.replaceChildren();
  colorEditor=FxColorUi.mount(holder,{
   idPrefix:'hazeGradient',kind:'gradient',value:cfg.palette,
   defaultValue:defaults().palette,
   isLocked:()=>busy||loading,
   onChange(value){cfg.palette=value;redraw()}
  });
 }
 function buildCurves(){
  for(const e of Object.values(curveEditors))e?.destroy?.();
  curveEditors={};
  for(const [id,key] of [
   ['distortionCurveEditor','distortionCurve'],
   ['edgeCurveEditor','edgeCurve'],
   ['pulseCurveEditor','pulseCurve']
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
  $('spatialMode').value=cfg.spatialMode;
  $('mode').value=cfg.mode;
  $('gustEnabled').checked=cfg.gustEnabled;
  selectedId=cfg.emitters.some(e=>e.id===selectedId)?selectedId:cfg.emitters[0]?.id||null;
  updateFrameMax();buildEmitters();buildLayers();buildAnchor();buildGradient();buildCurves();
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
  const version=binary?binaryVersion(raw):data?.skeleton?.spine;
  if(typeof version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(version))
   throw Error('Haze requires Spine 4.2 export. Actual: '+version);
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
 function recreateFx(){fx?.destroy();fx=FxHazeRuntime.createHaze({PIXI,app,host,model,sceneSource:host,settings:cfg})}
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
   updateBackground();recreateFx();
   if(asset)await loadSkeleton(asset);
   const backend=actualBackend();
   $('backendActual').textContent=backend.actual.toUpperCase()+' • Pixi '+backend.pixi;
   if(backend.actual!==which)status('Requested '+which+' but got '+backend.actual+'; fallback not certified',true);
   else status('Haze ready • '+backend.actual+' • 512×512 @ 60 FPS');
   app.ticker.add(ticker=>{
    if(!playing||busy)return;
    const end=(cfg.exportFrames-1)/60;
    if(cfg.mode==='loop'){const duration=cfg.durationFrames/60;
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
   fx.setModel(model);fx.seek(time);
   const b=fx.diagnostic;
   if(b)status(b,true);
   else if(!fx.bounds().inside)status('Heat haze exceeds 512x512. Use Fit to canvas.',true);
   app.render();
   updateFrameMax();updateOriginHandle();updateTrajectoryHandles();updateControlDependencies();
  }catch(e){status(e.message,true)}
 }
 function updateOriginHandle(){
  const h=$('originHandle'),e=selected(),a=e?.anchor;
  const isWorld=a?.type==='world';
  h.hidden=!isWorld;if(!isWorld)return;
  h.style.left=a.x+'px';h.style.top=a.y+'px';
 }
 function setTime(seconds){
  time=Math.max(0,Math.min((cfg.exportFrames-1)/60,seconds));redraw();
 }
 function fitCanvas(){
  const c=structuredClone(cfg);
  if(c.emitters.some(e=>e.anchor.type!=='world')){
   status('Fit supports world anchors only; move Spine anchors manually',true);return false;
  }
  for(let attempt=0;attempt<30;attempt++){
   const state=core.prepare(c,time);
   const gs=state.geometries;
   const inside=gs.every(g=>g.fullBounds.minX>=0&&g.fullBounds.minY>=0&&
     g.fullBounds.maxX<=512&&g.fullBounds.maxY<=512);
   if(inside){cfg=c;refreshControls();redraw();status('Heat region fits 512x512');return true}
   for(const e of c.emitters){
    e.anchor.x=256+(e.anchor.x-256)*.88;
    e.anchor.y=256+(e.anchor.y-256)*.88;
    e.x*=.88;e.y*=.88;
    for(const segment of e.path.segments)
     for(const point of ['p0','p1','p2','p3'])
      segment[point]=segment[point].map(v=>v*.88);
   }
   c.regionWidth=Math.max(10,c.regionWidth*.92);
  }
  status('Could not fit haze region; manually adjust path/width',true);return false;
 }
 function updateTrajectoryHandles(){
  const svg=$('trajectoryHandles'),e=selected();
  if(!svg||!e)return;
  svg.hidden=e.anchor.type!=='world';
  if(svg.hidden)return;
  const angle=(e.anchor.rotation+e.rotation)*Math.PI/180;
  const world=(x,y)=>{
   const c=Math.cos(angle),s=Math.sin(angle);
   return [e.anchor.x+e.x+x*c-y*s,e.anchor.y+e.y+x*s+y*c]};
  const path=FxSpacing.normalizePath(e.path),
   table=FxSpacing.buildArcTable(path);
  svg.querySelector('[data-path]').setAttribute('points',
   Array.from({length:65},(_,i)=>{
    const p=FxSpacing.pointAtDistance(table,table.length*i/64);
    return world(p.x,p.y).join(',');
   }).join(' '));
  const s=path.segments[0];
  const points={start:s.p0,c1:s.p1,c2:s.p2,end:s.p3};
  for(const [k,pt] of Object.entries(points)){
   const el=svg.querySelector('[data-handle="'+k+'"]');
   if(el){const a=world(...pt);el.setAttribute('cx',a[0]);el.setAttribute('cy',a[1])}
  }
  const elapsed=Math.max(0,time-e.timeOffset/60),
   head=FxSpacing.pointAtDistance(table,table.length*Math.min(1,elapsed/(cfg.durationFrames/60))),
   h=world(head.x,head.y);
  svg.querySelector('[data-handle="head"]').setAttribute('cx',h[0]);
  svg.querySelector('[data-handle="head"]').setAttribute('cy',h[1]);
  $('pathLength').textContent='Editable heat centerline: '+table.length.toFixed(1)+' px; path indicator '+
   head.distance.toFixed(1)+' px';
 }
 function bindTrajectoryHandles(){
  const svg=$('trajectoryHandles');let dragging=null,last=null;
  const at=ev=>{const box=svg.getBoundingClientRect();
   return [(ev.clientX-box.left)*512/box.width,
    (ev.clientY-box.top)*512/box.height]};
  svg.addEventListener('pointerdown',ev=>{
   const e=selected();
   if(!e||!ev.target.dataset.handle||busy)return;
   dragging=ev.target.dataset.handle;last=at(ev);
   ev.target.setPointerCapture(ev.pointerId);ev.preventDefault();
  });
  svg.addEventListener('pointermove',ev=>{
   if(!dragging||busy)return;
   const e=selected(),p=at(ev),angle=-(e.anchor.rotation+e.rotation)*Math.PI/180,
    raw=[p[0]-last[0],p[1]-last[1]];
   const delta=[raw[0]*Math.cos(angle)-raw[1]*Math.sin(angle),
    raw[0]*Math.sin(angle)+raw[1]*Math.cos(angle)];
   last=p;
   if(dragging==='head'){e.x+=delta[0];e.y+=delta[1];}
   else{const key={start:'p0',c1:'p1',c2:'p2',end:'p3'}[dragging];
    e.path.segments[0][key][0]+=delta[0];
    e.path.segments[0][key][1]+=delta[1];}
   redraw();
  });
  svg.addEventListener('pointerup',()=>{dragging=null;last=null});
  svg.addEventListener('pointercancel',()=>{dragging=null;last=null});
  $('pathReset').onclick=()=>{const e=selected();if(!e)return;
   e.path=core.newEmitter(0).path;redraw()};
  $('pathStraight').onclick=()=>{const e=selected();if(!e)return;
   const seg=e.path.segments[0],a=seg.p0,b=seg.p3;
   seg.p1=[a[0]+(b[0]-a[0])/3,a[1]+(b[1]-a[1])/3];
   seg.p2=[a[0]+2*(b[0]-a[0])/3,a[1]+2*(b[1]-a[1])/3];
   redraw();
  };
 }
 function bindButtons(){
  $('fitCanvas').onclick=fitCanvas;bindTrajectoryHandles();
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play'};
  $('reverse').onclick=()=>{direction*=-1;$('reverse').textContent=direction===1?'Reverse':'Forward'};
  $('reset').onclick=()=>{playing=false;$('play').textContent='Play';setTime(0)};
  $('frame').oninput=()=>{playing=false;$('play').textContent='Play';setTime(Number($('frame').value)/60)};
  $('zoom').onchange=()=>{
   $('preview').style.transform='scale('+$('zoom').value+')';
  };
  $('background').onchange=()=>{
   backgroundSourceKind=$('background').value;
   updateBackground();redraw();
  };
  $('backgroundFile').onchange=async()=>{
   const file=$('backgroundFile').files?.[0];if(!file)return;
   const url=URL.createObjectURL(file);
   try{const image=new Image();image.src=url;await image.decode();
    backgroundImage=image;backgroundAsset={name:file.name,blob:file};
    backgroundSourceKind='local';
    $('background').value='local';updateBackground();redraw();
    status('Loaded local 512x512 scene source '+file.name);
   }catch(error){status('Background import: '+error.message,true)}
   finally{URL.revokeObjectURL(url)}
  };
  $('backend').onchange=()=>createRenderer().catch(()=>{});
  $('spatialMode').onchange=()=>{cfg.spatialMode=$('spatialMode').value;redraw()};
  $('mode').onchange=()=>{
   cfg.mode=$('mode').value;
   if(cfg.mode==='stop'){cfg.durationFrames=cfg.stopFrame+cfg.fadeFrames}
   else cfg.durationFrames=120;
   cfg.exportFrames=cfg.durationFrames;
   refreshControls();redraw();
  };
  $('gustEnabled').onchange=()=>{
   cfg.gustEnabled=$('gustEnabled').checked;redraw();
  };
  $('quality').onchange=()=>{cfg.quality=$('quality').value;redraw()};
  $('style').onchange=()=>{cfg.style=$('style').value;redraw()};
  $('stylePalette').onclick=()=>{
   const palette=structuredClone(defaults().palette);
   if(cfg.style==='magical'){palette.stops[0].rgba=[190,140,255,0];
    palette.stops[1].rgba=[166,134,254,.8];palette.stops[2].rgba=[240,233,255,0]}
   else if(cfg.style==='stylized'){palette.stops[0].rgba=[255,230,146,0];
    palette.stops[1].rgba=[255,205,112,.65];palette.stops[2].rgba=[255,234,162,0]}
   cfg.palette=FxColors.normalize(palette);
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
   selectedId=cfg.emitters[0].id;refreshControls();redraw();status('Haze settings reset');
  };
  $('savePreset').onclick=()=>{
   const blob=new Blob([JSON.stringify({schemaVersion:1,effectId:'fx.fire.heat-haze',
    settings:cfg},null,2)],{type:'application/json'});
   FxHazeZip.download(blob,'Heat_Haze_Preset.json');
  };
  $('loadPreset').onclick=()=>$('presetFile').click();
  $('presetFile').onchange=async()=>{
   const file=$('presetFile').files?.[0];$('presetFile').value='';
   if(!file)return;
   try{
    const doc=JSON.parse(await file.text());
    if(doc.schemaVersion!==1||doc.effectId!=='fx.fire.heat-haze')throw Error('Unsupported preset effect/version');
    cfg=core.normalize(doc.settings);refreshControls();redraw();
    status('Imported Haze preset '+file.name);
   }catch(e){status('Preset rejected: '+e.message,true)}
  };
  const handle=$('originHandle');let dragging=false;
  handle.onpointerdown=e=>{dragging=true;handle.setPointerCapture(e.pointerId);e.preventDefault()};
  handle.onpointermove=e=>{
   if(!dragging||selected()?.anchor.type!=='world')return;
   const rect=$('preview').getBoundingClientRect(),scale=rect.width/512;
   selected().anchor.x=Math.round(Math.max(0,Math.min(512,(e.clientX-rect.left)/scale)));
   selected().anchor.y=Math.round(Math.max(0,Math.min(512,(e.clientY-rect.top)/scale)));
   $('anchor-x').value=selected().anchor.x;$('anchor-y').value=selected().anchor.y;redraw();
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
 async function extractBytes(kind='composite'){
  if(kind==='displacement'||kind==='glow'){
   if(!fx)throw Error('Heat editor not ready');
   const canvas=kind==='glow'?fx.glowCanvas:fx.mapCanvas;
   const blob=await new Promise((resolve,reject)=>
    canvas.toBlob(b=>b?resolve(b):reject(Error('Haze PNG encoding failed')),'image/png'));
   return new Uint8Array(await blob.arrayBuffer());
  }
  if(kind!=='composite')throw Error('Unsupported heat export representation');

  if(!app)throw Error('Renderer not ready');
  app.render();
  const uri=await app.renderer.extract.base64({target:app.stage,
   frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
  if(!uri.startsWith('data:image/png;base64,'))throw Error('PNG extraction unsupported');
  // Some Pixi/Chromium paths encode premultiplied GPU RGB with a PNG alpha
  // channel. The PNG contract requires straight RGB, so unpremultiply exactly
  // once after renderer extraction, never when tinting Pixi Sprite objects.
  const raw=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([raw],{type:'image/png'}));
  try{
   const canvas=document.createElement('canvas');
   canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Straight RGBA8 PNG conversion unavailable');
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(bitmap,0,0);
   const result=ctx.getImageData(0,0,canvas.width,canvas.height);
   for(let i=0;i<result.data.length;i+=4){
    const alpha=result.data[i+3];
    if(alpha===0)continue;
    if(alpha===255)continue;
    for(let channel=0;channel<3;channel++)
     result.data[i+channel]=Math.min(255,
      Math.round(result.data[i+channel]*255/alpha));
   }
   ctx.putImageData(result,0,0);
   const blob=await new Promise((resolve,reject)=>
    canvas.toBlob(v=>v?resolve(v):reject(Error('PNG conversion failed')),'image/png'));
   return new Uint8Array(await blob.arrayBuffer());
  }finally{bitmap.close?.()}
 }
 function setSettings(next){cfg=core.normalize(next);refreshControls();redraw()}
 bindButtons();buildControls();buildEmitters();buildLayers();buildAnchor();buildGradient();buildCurves();
 createRenderer().catch(()=>{});
 return Object.freeze({
  getSettings:()=>structuredClone(cfg),getSelectedEmitter:()=>selectedId,getTime:()=>time,getPlaying:()=>playing,getApp:()=>app,
  getAsset:()=>asset,getModel:()=>model,getFx:()=>fx,getActualBackend:actualBackend,
  getStatus:()=>$('status').textContent,setSettings,seek:setTime,
  render:redraw,extractBytes,loadSample,
  getBackgroundKind:()=>backgroundSourceKind,getBackgroundAsset:()=>backgroundAsset,
  busy:value=>{busy=!!value},setStatus:status,
  restore:(t,wasPlaying)=>{busy=false;time=t;playing=!!wasPlaying;
   $('play').textContent=playing?'Pause':'Play';redraw()},
  stop:()=>{playing=false;$('play').textContent='Play'},
  get isBusy(){return busy}
 });
})();
