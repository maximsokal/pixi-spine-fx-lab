// WATER-05 Bubbles editor. Independent of Burn, Torch and Explosion.
'use strict';
const BubblesEditor=(()=>{
 const $=id=>document.getElementById(id), core=FxBubbles, defaults=()=>core.defaults();
 let cfg=defaults(),app=null,host=null,fx=null,model=null,atlas=null,textures=[],asset=null;
 let time=0,playing=false,direction=1, busy=false,loading=false,selectedId=cfg.emitters[0].id;
 let colorEditor=null,curveEditors={};
 const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
 const inputRanges={
  rate:[0,90,1,'events/s'],radius:[2,22,.5,'px'],
  buoyancy:[0,450,5,'px/s?'],wobble:[0,45,1,'px'],
  lifetime:[.1,8,.1,'s'],highlightStrength:[0,1,.01,'fraction'],
  originGap:[4,100,1,'arc px'],originSpan:[10,480,1,'px'],nozzleBend:[-80,80,1,'px'],
  spatialJitter:[0,.45,.01,'fraction'],radiusVariation:[0,.8,.01,'fraction'],
  popLifetime:[.05,.6,.01,'s'],exportFrames:[1,3600,1,'frames'],
  seed:[-2147483648,2147483647,1,'int32']
 };
 const groups={
  geometry:['rate','radius','buoyancy','wobble','lifetime','highlightStrength'],
  particles:['originGap','originSpan','nozzleBend','spatialJitter','radiusVariation',
   'popLifetime','exportFrames','seed']
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
     const value=['exportFrames','seed']
       .includes(key)?Number.parseInt(inp.value,10):Number(inp.value);
     cfg[key]=value;output.textContent=value+' '+unit;
     if(['exportFrames'].includes(key))updateFrameMax();
     updateControlDependencies();
     redraw();
    });
    output.textContent=cfg[key]+' '+unit;
    label.append(inp);holder.append(label);
   }
  }
 }
 function updateControlDependencies(){
  const e=selected();
  if($('p-highlightStrength'))$('p-highlightStrength').disabled=
   !e?.layers.highlights.enabled;
  if($('p-popLifetime'))$('p-popLifetime').disabled=
   !e?.layers.popRings.enabled;
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
   throw Error('Bubbles maximum IDs exhausted');
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
   ])control(k,lo,hi,step);
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
   const a=e.layers[name].anchor,anchorBox=document.createElement('div');
   anchorBox.className='layer-coord';
   const anchorTitle=document.createElement('h4');anchorTitle.textContent='Independent anchor';
   anchorBox.append(anchorTitle);
   function anchorControl(key,values=null){
    const label=document.createElement('label');label.className='control';
    label.textContent=nice(key);
    const field=values?document.createElement('select'):document.createElement('input');
    field.id='layer-'+name+'-anchor-'+key;
    if(values){
     for(const val of values){
      const option=document.createElement('option');
      option.value=val;option.textContent=val;field.append(option);
     }
     field.value=a[key];
    }else{
     field.type=['x','y','rotation'].includes(key)?'number':'text';
     if(field.type==='number'){
      field.min=key==='rotation'?-360:-10000;
      field.max=key==='rotation'?360:10000;field.step=1;
     }
     field.value=a[key];
    }
    field.onchange=()=>{
     const v=field.type==='number'?Number(field.value):field.value;
     if(field.type==='number'&&
      (!Number.isFinite(v)||v<Number(field.min)||v>Number(field.max))){
      status('Invalid layer anchor '+key,true);return;
     }
     a[key]=v;redraw();
    };
    label.append(field);anchorBox.append(label);
   }
   anchorControl('type',['inherit','world','skeleton','bone','slot','attachment']);
   anchorControl('space',['world','local']);
   for(const key of ['name','slot','x','y','rotation'])anchorControl(key);
   box.append(anchorBox);
   const modes=document.createElement('div');modes.className='row';
   const blend=document.createElement('select');blend.id='layer-'+name+'-blend';
   for(const b of ['normal','add']){
    const option=document.createElement('option');option.value=b;option.textContent=b;blend.append(option)}
   blend.value=e.layers[name].blend;blend.onchange=()=>{e.layers[name].blend=blend.value;redraw()};
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
   idPrefix:'bubblesGradient',kind:'gradient',value:cfg.palette,
   defaultValue:defaults().palette,
   isLocked:()=>busy||loading,
   onChange(value){cfg.palette=value;redraw()}
  });
 }
 function buildCurves(){
  for(const e of Object.values(curveEditors))e?.destroy?.();
  curveEditors={};
  for(const [id,key] of [
   ['sizeCurveEditor','sizeCurve'],
   ['lateralDriftCurveEditor','lateralDriftCurve'],
   ['alphaCurveEditor','alphaCurve'],
   ['emissionRateCurveEditor','emissionRateCurve'],
   ['originGapCurveEditor','originGapCurve']
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
   if(el){el.value=cfg[key];out.textContent=cfg[key]+' '+inputRanges[key][3]}
  }
  $('quality').value=cfg.quality;$('style').value=cfg.style;
  $('spatialMode').value=cfg.spatialMode;
  $('temporalMode').value=cfg.temporalMode;
  $('mode').value=cfg.mode;

  selectedId=cfg.emitters.some(e=>e.id===selectedId)?selectedId:
   cfg.emitters[0]?.id||null;
  updateFrameMax();buildEmitters();buildLayers();buildAnchor();
  buildGradient();buildCurves();updateControlDependencies();
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
   throw Error('Bubbles requires Spine 4.2 export. Actual: '+version);
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
 function recreateFx(){fx?.destroy();fx=FxBubblesRuntime.createBubbles({PIXI,app,host,model,settings:cfg})}
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
   else status('Bubbles ready • '+backend.actual+' • 512×512 @ 60 FPS');
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
   const b=fx.diagnostics;
   if(b)status(b,true);
   else if(!fx.currentBounds().inside)
    status('Bubbles exceed 512px: reposition source or reduce nozzle span, radius or wobble. Top exits are allowed.',true);
   app.render();
   updateFrameMax();updateOriginHandle();updateNozzleHandles();updateControlDependencies();
  }catch(e){status(e.message,true)}
 }
 function updateOriginHandle(){
  const source=$('originHandle'),impact=$('highlightHandle'),e=selected(),a=e?.anchor;
  const isWorld=a?.type==='world';
  source.hidden=!isWorld;
  if(isWorld){source.style.left=a.x+'px';source.style.top=a.y+'px'}
  const base=fx?.anchors[e?.id]?.highlights?.origin;
  impact.hidden=!base||!e?.layers.highlights.enabled;
  if(base){impact.style.left=(base.x+28)+'px';impact.style.top=(base.y-30)+'px'}
 }
 function updateNozzleHandles(){
  const svg=$('trajectoryHandles'),e=selected(),a=e?.anchor;
  svg.hidden=a?.type!=='world'||!e?.enabled;
  if(svg.hidden)return;
  const half=cfg.originSpan/2;
  for(const [id,x,y] of [
   ['nozzle-left',a.x-half,a.y],
   ['nozzle-bend',a.x+40,a.y-.75*cfg.nozzleBend],
   ['nozzle-right',a.x+half,a.y]
  ]){
   const node=$(id);if(!node)continue;
   node.setAttribute('cx',x);node.setAttribute('cy',y);
  }
 }
 function initNozzleHandles(){
  const svg=$('trajectoryHandles'),ns='http://www.w3.org/2000/svg';
  for(const [id,color] of [
   ['nozzle-left','#59dbc9'],['nozzle-bend','#c69aff'],
   ['nozzle-right','#59dbc9']
  ]){
   const circle=document.createElementNS(ns,'circle');
   circle.id=id;circle.setAttribute('r','8');circle.setAttribute('fill',color);
   circle.setAttribute('role','button');circle.setAttribute('tabindex','0');
   circle.setAttribute('aria-label',id==='nozzle-bend'?'Drag nozzle curve bend':
    'Drag nozzle span endpoint');
   circle.addEventListener('pointerdown',event=>{
    if(!selected()||selected().anchor.type!=='world'||busy)return;
    circle.setPointerCapture(event.pointerId);event.preventDefault();
   });
   circle.addEventListener('pointermove',event=>{
    if(!circle.hasPointerCapture(event.pointerId)||!selected()||busy)return;
    const bounds=$('preview').getBoundingClientRect(),scale=bounds.width/512;
    const px=(event.clientX-bounds.left)/scale,
     py=(event.clientY-bounds.top)/scale,a=selected().anchor;
    if(id==='nozzle-bend'){
     cfg.nozzleBend=Math.max(-80,Math.min(80,Math.round((a.y-py)/.75)));
     $('p-nozzleBend').value=cfg.nozzleBend;
     $('o-nozzleBend').textContent=cfg.nozzleBend+' px';
    }else{
     cfg.originSpan=Math.max(2*cfg.originGap,Math.min(480,
      Math.round(2*Math.abs(px-a.x))));
     $('p-originSpan').value=cfg.originSpan;
     $('o-originSpan').textContent=cfg.originSpan+' px';
    }
    redraw();
   });
   svg.append(circle);
  }
 }
 function setTime(seconds){
  time=Math.max(0,Math.min((cfg.mode==='loop'?cfg.exportFrames:cfg.exportFrames-1)/60,seconds));redraw();
 }
 function fitCanvas(){
  const c=structuredClone(cfg);
  if(c.emitters.some(e=>e.anchor.type!=='world'||
   Object.values(e.layers).some(l=>!['inherit','world'].includes(l.anchor.type)))){
   status('Fit is available for world/inherit anchors only. Position Spine anchors manually',true);
   return false;
  }
  for(let attempt=0;attempt<50;attempt++){
   let safe=true;
   for(let f=0;f<c.durationFrames;f++)
    if(!core.bounds(core.sample(c,f/60),c).inside){safe=false;break}
   if(safe){cfg=c;refreshControls();redraw();
    status('Fit verified '+c.durationFrames+' authored frames');return true}
   for(const e of c.emitters)if(e.anchor.type==='world'){
    e.anchor.x=256+(e.anchor.x-256)*.86;
    e.anchor.y=440+(e.anchor.y-440)*.88;
    e.x*=.86;e.y*=.86;
   }
   c.originSpan=Math.max(16,c.originSpan*.95);
   c.originGap=Math.min(c.originGap,c.originSpan/2);
   c.radius=Math.max(2,c.radius*.97);
   c.wobble=Math.max(0,c.wobble*.94);
  }
  status('Cannot Fit with these emitter/layer positions. Edit anchors manually',true);
  return false;
 }
 function bindButtons(){
  initNozzleHandles();
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
  $('spatialMode').onchange=()=>{cfg.spatialMode=$('spatialMode').value;redraw()};
  $('temporalMode').onchange=()=>{cfg.temporalMode=$('temporalMode').value;redraw()};
  $('mode').onchange=()=>{cfg.mode=$('mode').value;
   cfg.durationFrames=cfg.mode==='loop'?60:40;
   cfg.exportFrames=cfg.durationFrames;
   time=0;playing=false;refreshControls();redraw()};
  $('quality').onchange=()=>{cfg.quality=$('quality').value;redraw()};
  $('style').onchange=()=>{cfg.style=$('style').value;redraw()};
  $('stylePalette').onclick=()=>{
   const palette=structuredClone(defaults().palette);
   if(cfg.style==='magical'){
    palette.stops[0].rgba=[222,172,255,.88];
    palette.stops[1].rgba=[114,144,249,.7];
   }else if(cfg.style==='stylized'){
    palette.stops[0].rgba=[240,255,255,.95];
    palette.stops[1].rgba=[87,216,251,.8];
   }
   cfg.palette=FxColors.normalize(palette);buildGradient();redraw();
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
   selectedId=cfg.emitters[0].id;refreshControls();redraw();status('Bubbles settings reset');
  };
  $('savePreset').onclick=()=>{
   const blob=new Blob([JSON.stringify({schemaVersion:1,effectId:'fx.water.rising-bubbles',
    settings:cfg},null,2)],{type:'application/json'});
   FxBubblesZip.download(blob,'Rising_Bubbles_Preset.json');
  };
  $('loadPreset').onclick=()=>$('presetFile').click();
  $('presetFile').onchange=async()=>{
   const file=$('presetFile').files?.[0];$('presetFile').value='';
   if(!file)return;
   try{
    const doc=JSON.parse(await file.text());
    if(doc.schemaVersion!==1||doc.effectId!=='fx.water.rising-bubbles')throw Error('Unsupported preset effect/version');
    cfg=core.normalize(doc.settings);refreshControls();redraw();
    status('Imported Bubbles preset '+file.name);
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
  const impact=$('highlightHandle');let draggingImpact=false;
  impact.onpointerdown=e=>{
   draggingImpact=true;impact.setPointerCapture(e.pointerId);e.preventDefault()
  };
  impact.onpointermove=e=>{
   if(!draggingImpact||!selected())return;
   const rect=$('preview').getBoundingClientRect(),scale=rect.width/512;
   const px=Math.max(0,Math.min(512,(e.clientX-rect.left)/scale)),
    py=Math.max(0,Math.min(512,(e.clientY-rect.top)/scale));
   const layer=selected().layers.highlights,
    origin=fx?.anchors[selected().id]?.highlights?.origin;
   if(!origin)return;
   const angle=fx.anchors[selected().id].highlights.angle,
    dx=px-28-origin.x,dy=py+30-origin.y,
    cs=Math.cos(angle),sn=Math.sin(angle);
   layer.x=Math.round(Math.max(-10000,Math.min(10000,layer.x+dx*cs+dy*sn)));
   layer.y=Math.round(Math.max(-10000,Math.min(10000,layer.y-dx*sn+dy*cs)));
   const x=$('layer-highlights-x'),y=$('layer-highlights-y');
   if(x)x.value=layer.x;if(y)y.value=layer.y;
   redraw();
  };
  impact.onpointerup=impact.onpointercancel=()=>{draggingImpact=false};
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
  const previous=host.renderable;
  host.renderable=false;
  let uri;
  try{
   app.render();
   uri=await app.renderer.extract.base64({target:app.stage,
    frame:new PIXI.Rectangle(0,0,512,512),format:'png'});
  }finally{host.renderable=previous}
  if(!uri.startsWith('data:image/png;base64,'))throw Error('PNG extraction unsupported');
  const raw=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),ch=>ch.charCodeAt(0));
  // Verified Pixi 8.22.0 backends differ: WebGL readback is premultiplied,
  // while WebGPU extraction is straight RGB. Dividing WebGPU by alpha again
  // clips cyan/magical colors to white. Always export straight RGBA8.
  const needsUnpremultiply=!!app.renderer.gl;
  const image=await createImageBitmap(new Blob([raw],{type:'image/png'}));
  try{
   const canvas=document.createElement('canvas');
   canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Straight-alpha extraction unsupported');
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0);
   const data=ctx.getImageData(0,0,canvas.width,canvas.height);
   if(needsUnpremultiply)for(let i=0;i<data.data.length;i+=4){
    const alpha=data.data[i+3];
    if(alpha===0||alpha===255)continue;
    for(let channel=0;channel<3;channel++)
     data.data[i+channel]=Math.min(255,
      Math.round(data.data[i+channel]*255/alpha));
   }
   ctx.putImageData(data,0,0);
   const blob=await new Promise((resolve,reject)=>
    canvas.toBlob(out=>out?resolve(out):reject(Error('PNG conversion failed')),'image/png'));
   return new Uint8Array(await blob.arrayBuffer());
  }finally{image.close?.()}
 }
 function setSettings(next){cfg=core.normalize(next);refreshControls();redraw()}
 bindButtons();buildControls();buildEmitters();buildLayers();buildAnchor();buildGradient();buildCurves();
 createRenderer().catch(()=>{});
 return Object.freeze({
  getSettings:()=>structuredClone(cfg),getSelectedEmitter:()=>selectedId,getTime:()=>time,getPlaying:()=>playing,getApp:()=>app,
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
