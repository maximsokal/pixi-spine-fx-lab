// AIR-02 standalone authoring session and offline editor.
(function(root,factory){
 const api=Object.freeze(factory(root,root.FxSnow||(typeof require==='function'?require('./snow-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.FxSnowEditor=api;root.SnowEditor=api.mount();}
})(globalThis,function(root,Core){
 'use strict';
 const ID='fx.air.snowfall',clone=v=>JSON.parse(JSON.stringify(v)),mod=(v,n)=>((v%n)+n)%n;
 function createSession(initial,adapter={}){
  let cfg=Core.createPlan(initial).settings,time=0,playing=false,direction=1,selectedId=cfg.emitters[0]?.id??null;
  const end=()=>cfg.mode==='loop'?cfg.durationFrames/60:(cfg.durationFrames-1)/60;
  function replace(next){
   const validated=Core.createPlan(next).settings;
   adapter.configure?.(validated);cfg=validated;
   time=Math.min(time,end());
   if(!cfg.emitters.some(e=>e.id===selectedId))selectedId=cfg.emitters[0]?.id??null;
   return cfg;
  }
  function edit(fn){const next=clone(cfg);fn(next);return replace(next);}
  function seek(t){
   if(!Number.isFinite(t)||t<0)throw RangeError('AIR-02 invalid seek');
   const next=Math.min(t,end());adapter.seek?.(next);time=next;return next;
  }
  function tick(delta){
   if(!playing)return time;
   if(!Number.isFinite(delta)||delta<0)throw RangeError('AIR-02 invalid delta');
   let t=time+delta*direction;
   if(cfg.mode==='loop')t=mod(t,end());
   else if(t<=0||t>=end()){t=Math.max(0,Math.min(end(),t));playing=false;}
   return seek(t);
  }
  function add(copy=false){
   if(cfg.emitters.length>=4)throw RangeError('AIR-02 maximum 4 emitters');
   const index=Array.from({length:5},(_,i)=>i).find(i=>!cfg.emitters.some(e=>e.id==='emitter'+(i+1)));
   const source=cfg.emitters.find(e=>e.id===selectedId);
   const e=copy&&source?{...clone(source),id:'emitter'+(index+1),name:source.name.slice(0,123)+' copy',
    seed:(source.seed+997)|0,x:Math.min(10000,source.x+20)}:Core.newEmitter(index);
   edit(c=>c.emitters.push(e));selectedId=e.id;return e.id;
  }
  return Object.freeze({replace,edit,seek,tick,add:()=>add(),duplicate:()=>add(true),
   select(id){if(!cfg.emitters.some(e=>e.id===id))throw Error('AIR-02 emitter missing');selectedId=id;},
   remove(){edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selectedId)});},
   play(){if(cfg.mode==='oneShot'&&direction===1&&time===end())seek(0);
    else if(cfg.mode==='oneShot'&&direction===-1&&time===0)seek(end());playing=true;},
   pause(){playing=false;},reverse(){direction*=-1;},reset(){playing=false;return seek(0);},
   setMode(mode,frames){edit(c=>{c.mode=mode;c.durationFrames=frames;c.exportFrames=frames;});playing=false;seek(0);},
   serialize:()=>JSON.stringify({schemaVersion:1,effectId:ID,settings:cfg},null,2),
   importPreset(raw){const p=JSON.parse(raw);if(p.schemaVersion!==1||p.effectId!==ID)throw Error('Invalid Snowfall preset');return replace(p.settings);},
   get settings(){return cfg},get selectedId(){return selectedId},get time(){return time},
   get playing(){return playing},get direction(){return direction},get end(){return end()}});
 }
 // Resolve the same affine anchor mapping as the renderer; never apply a
 // stage-space pointer delta directly to bone-local coordinates.
 function originDelta(resolve,anchor,dx,dy){
  const p=resolve({...anchor,x:0,y:0}),u=resolve({...anchor,x:1,y:0}),v=resolve({...anchor,x:0,y:1});
  if(![p,u,v].every(q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y)))return null;
  const a=u.x-p.x,b=v.x-p.x,c=u.y-p.y,d=v.y-p.y,det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<=1e-10*Math.hypot(a,c)*Math.hypot(b,d))return null;
  const x=(d*dx-b*dy)/det,y=(a*dy-c*dx)/det;
  return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
 }
 function mount(){
  const {PIXI,spine,FxSnowRuntime,FxSnowPose,FxCurveEditor,FxColorUi}=root,$=id=>document.getElementById(id);
  let scene=null,asset=null,busy=false,editors=[],lockedControls=[];
  const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
  function setBusy(v){
   busy=!!v;
   if(busy){lockedControls=[...document.querySelectorAll('main input,main button,main select,main textarea')].filter(e=>e.id!=='cancel'&&!e.disabled);for(const e of lockedControls)e.disabled=true;}
   else{for(const e of lockedControls)e.disabled=false;lockedControls=[];}
  }
  function backend(app,requested){const gl=app.renderer.gl;return {requested,actual:gl?(typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown',pixi:PIXI.VERSION};}
  function pose(s,t){if(s.model){FxSnowPose.seek(s.model,session.settings,t,{skin:$('skin').value,animation:$('animation').value});s.model.visible=$('showSpine').checked;}s.fx.seek(t);s.app.render();}
  const session=createSession(Core.defaults(),{
   configure(c){scene?.fx.configure(c);},
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
    if(fx.diagnostics.length)status(fx.diagnostics.map(d=>d.emitter+'/'+d.layer+': '+d.code).join('; '),true);}
  }
  function updateHandles(){
   const e=selection(session.settings);
   for(const kind of ['origin',...Core.LAYERS]){
    const h=$('handle-'+kind),surface=scene?.fx.emitters.get(e?.id)?.layers[kind]?.surface;
    const p=kind==='origin'?(e&&scene?scene.fx.resolveAnchor(e.anchor):null):surface?.visible?surface:null;
    h.hidden=!p||!Number.isFinite(p.x)||!Number.isFinite(p.y);if(!h.hidden){h.style.left=(p.x+({origin:0,near:24,far:-24,windSwirls:0}[kind]))+'px';h.style.top=(p.y+(kind==='windSwirls'?24:0))+'px';}
   }
  }
  function attempt(fn,rebuild=false){if(busy)return false;
   try{fn();session.seek(session.time);status('Snowfall • settings accepted');if(rebuild)refresh();else refreshTime();return true;}
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
    if(!attempt(()=>apply(v),!!options.rebuild))set(value);else value=v;};
   row.append(input);holder.append(row);return input;
  }
  const ranges={flakesPerSecond:[0,120,1],flakeSize:[2,20,.5],fallSpeed:[5,240,1],windDrift:[-120,120,1],
   rotationSpeed:[-180,180,1],depthVariation:[0,1,.01],horizontalGapPx:[4,100,1],spatialJitter:[0,.45,.01],
   fieldWidth:[64,2048,1],seed:[-2147483648,2147483647,1],exportFrames:[1,3600,1]};
  const pretty=k=>k.replace(/([A-Z])/g,' $1').replace(/^./,v=>v.toUpperCase());
  function anchorControls(holder,a,get,inherit){
   addControl(holder,'Anchor type',a.type,v=>session.edit(c=>{const x=get(c);x.type=v;
    if(['bone','slot','attachment'].includes(v)&&!x.name)x.name='root';if(v==='attachment'&&!x.slot)x.slot='root';}),
    {choices:[...(inherit?['inherit']:[]),'world','skeleton','bone','slot','attachment'],rebuild:true});
   addControl(holder,'Space',a.space,v=>session.edit(c=>get(c).space=v),{choices:['world','local']});
   for(const k of ['name','slot','x','y','rotation'])addControl(holder,pretty(k),a[k],v=>session.edit(c=>get(c)[k]=v),
    ['name','slot'].includes(k)?{type:'text'}:{min:k==='rotation'?-360:-10000,max:k==='rotation'?360:10000,step:1});
  }
  function transformControls(holder,obj,get,layer=false){
   for(const k of ['enabled','visible'])addControl(holder,pretty(k),obj[k],v=>session.edit(c=>get(c)[k]=v),{type:'checkbox'});
   for(const [k,min,max,step] of [['x',-10000,10000,1],['y',-10000,10000,1],['rotation',-360,360,1],
    ['timeOffset',-3600,3600,1],['seed',-2147483648,2147483647,1],...(layer?[['alpha',0,1,.05]]:[])])
    addControl(holder,pretty(k),obj[k],v=>session.edit(c=>get(c)[k]=v),{min,max,step});
   if(layer)addControl(holder,'Blend',obj.blend,v=>session.edit(c=>get(c).blend=v),{choices:['normal','add','screen','multiply']});
   anchorControls(holder,obj.anchor,c=>get(c).anchor,layer);
  }
  function refresh(){
   const cfg=session.settings,controls=$('controls');controls.replaceChildren();
   for(const [k,[min,max,step]] of Object.entries(ranges))addControl(controls,pretty(k),cfg[k],v=>session.edit(c=>c[k]=v),{min,max,step,id:'p-'+k});
   addControl(controls,'Spatial mode',cfg.spatialMode,v=>session.edit(c=>c.spatialMode=v),{choices:['even','random','clustered','stratified']});
   addControl(controls,'Quality',cfg.quality,v=>session.edit(c=>c.quality=v),{choices:['low','balanced','high']});
   addControl(controls,'Timing',cfg.mode==='oneShot'?'oneShot':cfg.durationFrames===60?'loop':'scenic',v=>session.setMode(v==='oneShot'?'oneShot':'loop',v==='oneShot'?40:v==='scenic'?600:60),
    {choices:['loop','scenic','oneShot'],rebuild:true});
   if(cfg.mode==='loop'&&cfg.durationFrames>=600)addControl(controls,'Scenic frames',cfg.durationFrames,v=>session.setMode('loop',v),{min:600,max:960,step:1,rebuild:true});
   addControl(controls,'Style palette',cfg.style,v=>session.edit(c=>{c.style=v;c.palette=Core.stylePalette(v)}),{choices:['natural','stylized','magical'],rebuild:true});
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
   for(const key of ['driftCurve','flakeAlphaCurve','rotationCurve','emissionRateCurve','horizontalSpacingCurve']){
    const title=document.createElement('h4');title.textContent=pretty(key);$('curves').append(title);
    const el=document.createElement('div');$('curves').append(el);
    editors.push(FxCurveEditor.mount(el,{curve:cfg[key],getFrameCount:()=>session.settings.durationFrames,isLocked:()=>busy,
     onChange:v=>{if(!attempt(()=>session.edit(c=>c[key]=v)))refresh();},
     onScrub:v=>attempt(()=>session.seek(v*session.end))}));
   }
   editors.push(FxColorUi.mount($('gradient'),{idPrefix:'snowGradient',kind:'gradient',value:cfg.palette,defaultValue:Core.defaults().palette,
    isLocked:()=>busy,onChange:v=>{if(!attempt(()=>session.edit(c=>c.palette=v)))refresh();}}));
   refreshTime();
  }
  async function readSpine(source){
   const bytes=await source.skeleton.arrayBuffer(),binary=/\.skel$/i.test(source.skeletonName);
   const raw=binary?new Uint8Array(bytes):JSON.parse(new TextDecoder().decode(bytes));
   let version=raw.skeleton?.spine;
   if(binary){const input=new spine.BinaryInput(raw);input.readInt32();input.readInt32();version=input.readString();}
   if(!version?.startsWith('4.2.'))throw Error('Snowfall requires Spine 4.2; received '+version);
   const atlas=new spine.TextureAtlas(await source.atlas.text());let model=null;
   try{
    for(const page of atlas.pages){const name=page.name.replaceAll('\\','/');let blob=source.images.get(name);
     if(!blob){const matches=[...source.images].filter(([k])=>k.split('/').at(-1)===name.split('/').at(-1));if(matches.length===1)blob=matches[0][1];}
     if(!blob)throw Error('Missing atlas page '+name);
     const url=URL.createObjectURL(blob);let image;
     try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
     page.setTexture(spine.SpineTexture.from(new PIXI.ImageSource({resource:image,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false})));
    }
    const loader=new spine.AtlasAttachmentLoader(atlas),parser=binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
    const data=parser.readSkeletonData(raw);model=new spine.Spine({skeletonData:data,autoUpdate:false});model.update(0);
    const b=model.getLocalBounds();if(!(b.width>0&&b.height>0))throw Error('Empty Spine skeleton');
    const scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);
    return {model,atlas,data,version};
   }catch(e){model?.destroy();atlas.dispose();throw e;}
  }
  async function makeScene(which,source,settings,skin='',animation=''){
   const app=new PIXI.Application();let host,fx,sp=null,initialized=false;
   try{
    await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:which==='webgpu'?'webgpu':'webgl',
     preferWebGLVersion:which==='webgl1'?1:2,antialias:which!=='webgl1',autoStart:false,sharedTicker:false});
    initialized=true;host=new PIXI.Container();app.stage.addChild(host);
    if(source){sp=await readSpine(source);host.addChild(sp.model);
     FxSnowPose.seek(sp.model,settings,0,{skin:sp.data.skins.some(s=>s.name===skin)?skin:'',animation:sp.data.animations.some(a=>a.name===animation)?animation:''});}
    fx=FxSnowRuntime.createSnow({PIXI,app,host,model:sp?.model??null,settings});
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
   if(busy)return;session.pause();setBusy(true);const skin=$('skin').value,animation=$('animation').value;
   try{const next=await makeScene(which,source,session.settings,skin,animation),old=scene;
    scene=next;asset=source;old?.dispose();$('preview').querySelector('canvas')?.remove();$('preview').prepend(scene.app.canvas);
    populateSpine(scene,skin,animation);$('backendActual').textContent=scene.actual.actual.toUpperCase()+' • Pixi '+scene.actual.pixi;
    $('assetLabel').textContent=asset?asset.skeletonName:'No Spine model';session.seek(session.time);
    scene.app.ticker.add(t=>{if(!busy&&session.playing){try{session.tick(t.elapsedMS/1000);refreshTime();}catch(e){session.pause();status(e.message,true);}}});
    scene.app.start();refreshTime();status(scene.actual.actual===which?'Snowfall ready':'Requested '+which+'; actual '+scene.actual.actual,true&&scene.actual.actual!==which);
   }catch(e){status('Scene rejected: '+e.message,true);if(scene)$('backend').value=scene.actual.requested;}
   finally{setBusy(false);}
  }
  $('backend').onchange=()=>switchScene();$('background').onchange=()=>{$('preview').className=$('background').value};
  $('zoom').onchange=()=>{$('preview').style.transform='scale('+$('zoom').value+')'};
  $('play').onclick=()=>attempt(()=>session.playing?session.pause():session.play());
  $('reverse').onclick=()=>attempt(()=>session.reverse());$('reset').onclick=()=>attempt(()=>session.reset());
  $('frame').oninput=()=>attempt(()=>{session.pause();session.seek(Number($('frame').value)/60);});
  $('showSpine').onchange=()=>attempt(()=>{});$('animation').onchange=()=>attempt(()=>{});
  $('skin').onchange=()=>attempt(()=>{});
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
  $('savePreset').onclick=()=>{if(!busy)root.FxSnowZip.download(new Blob([session.serialize()],{type:'application/json'}),'Snowfall_Preset.json');};
  $('loadPreset').onclick=()=>{if(!busy)$('presetFile').click()};
  $('presetFile').onchange=async()=>{const file=$('presetFile').files?.[0];$('presetFile').value='';if(!file||busy)return;
   try{const raw=await file.text();attempt(()=>session.importPreset(raw),true);}catch(e){status(e.message,true);}};
  for(const kind of ['origin',...Core.LAYERS]){
   const h=$('handle-'+kind);let drag=null;
   h.onpointerdown=event=>{if(busy||h.hidden)return;drag={x:event.clientX,y:event.clientY};h.setPointerCapture(event.pointerId);event.preventDefault();};
   h.onpointermove=event=>{
    if(!drag||busy)return;const rect=scene?.app.canvas.getBoundingClientRect(),e=selection(session.settings);
    if(!e||!rect||!(rect.width>0&&rect.height>0))return;
    const dx=(event.clientX-drag.x)*512/rect.width,dy=(event.clientY-drag.y)*512/rect.height;
    drag={x:event.clientX,y:event.clientY};
    attempt(()=>session.edit(c=>{
     const next=selection(c);
     if(kind==='origin'){
      const delta=originDelta(scene.fx.resolveAnchor,next.anchor,dx,dy);
      if(!delta)throw Error('AIR-02 unresolved or singular anchor transform');
      next.anchor.x=Math.max(-10000,Math.min(10000,next.anchor.x+delta.x));next.anchor.y=Math.max(-10000,Math.min(10000,next.anchor.y+delta.y));
     }
     else{
      const l=next.layers[kind],a=l.anchor.type==='inherit'?next.anchor:l.anchor,
       angle=(next.rotation+a.rotation)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
      l.x=Math.max(-10000,Math.min(10000,l.x+dx*co+dy*si));
      l.y=Math.max(-10000,Math.min(10000,l.y-dx*si+dy*co));
     }
    }));
   };
   h.onpointerup=h.onpointercancel=()=>{if(drag){drag=null;refresh();}};
  }
  refresh();switchScene(null);
  return Object.freeze({session,makeScene,status,setBusy,get busy(){return busy},get scene(){return scene},
   get asset(){return asset?{...asset,skin:$('skin').value,animation:$('animation').value}:null},
   getSettings:()=>session.settings,getActualBackend:()=>scene?.actual??{actual:'unavailable',requested:$('backend').value},
   setSettings:c=>attempt(()=>session.replace(c),true),seek:t=>attempt(()=>session.seek(t)),
   stop:()=>session.pause(),refreshTime});
 }
 return {createSession,mount};
});
