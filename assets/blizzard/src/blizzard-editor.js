// AIR-03 standalone authoring session and offline editor.
(function(root,factory){
 const api=Object.freeze(factory(root,root.FxBlizzard||(typeof require==='function'?require('./blizzard-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.FxBlizzardEditor=api;root.BlizzardEditor=api.mount();}
})(globalThis,function(root,Core){
 'use strict';
 const ID='fx.air.blizzard',clone=v=>JSON.parse(JSON.stringify(v)),mod=(v,n)=>((v%n)+n)%n;
 function createSession(initial,adapter={}){
  let cfg=Core.createPlan(initial).settings,time=0,playing=false,direction=1,selectedId=cfg.emitters[0]?.id??null;
  const endFor=c=>c.mode==='loop'?c.durationFrames/60:(c.durationFrames-1)/60,end=()=>endFor(cfg);
  function replace(next,requestedTime=time){
   const validated=Core.createPlan(next).settings;
   if(!Number.isFinite(requestedTime)||requestedTime<0)throw RangeError('AIR-03 invalid seek');
   const nextTime=Math.min(requestedTime,endFor(validated));
   adapter.configure?.(validated,nextTime);cfg=validated;time=nextTime;
   if(!cfg.emitters.some(e=>e.id===selectedId))selectedId=cfg.emitters[0]?.id??null;
   return cfg;
  }
  function edit(fn){const next=clone(cfg);fn(next);return replace(next);}
  function seek(t){
   if(!Number.isFinite(t)||t<0)throw RangeError('AIR-03 invalid seek');
   const next=Math.min(t,end());adapter.seek?.(next);time=next;return next;
  }
  function tick(delta){
   if(!playing)return time;
   if(!Number.isFinite(delta)||delta<0)throw RangeError('AIR-03 invalid delta');
   let t=time+delta*direction;
   if(cfg.mode==='loop')t=mod(t,end());
   const stopping=cfg.mode==='oneShot'&&(t<=0||t>=end());
   if(stopping)t=Math.max(0,Math.min(end(),t));
   const result=seek(t);if(stopping)playing=false;return result;
  }
  function add(copy=false){
   if(cfg.emitters.length>=4)throw RangeError('AIR-03 maximum 4 emitters');
   const index=Array.from({length:5},(_,i)=>i).find(i=>!cfg.emitters.some(e=>e.id==='emitter'+(i+1)));
   const source=cfg.emitters.find(e=>e.id===selectedId);
   const e=copy&&source?{...clone(source),id:'emitter'+(index+1),name:source.name.slice(0,123)+' copy',
    seed:(source.seed+997)|0,x:Math.min(10000,source.x+20)}:Core.newEmitter(index);
   edit(c=>c.emitters.push(e));selectedId=e.id;return e.id;
  }
  return Object.freeze({replace,edit,seek,tick,add:()=>add(),duplicate:()=>add(true),
   select(id){if(!cfg.emitters.some(e=>e.id===id))throw Error('AIR-03 emitter missing');selectedId=id;},
   remove(){edit(c=>{c.emitters=c.emitters.filter(e=>e.id!==selectedId)});},
   play(){if(cfg.mode==='oneShot'&&direction===1&&time===end())seek(0);
    else if(cfg.mode==='oneShot'&&direction===-1&&time===0)seek(end());playing=true;},
   pause(){playing=false;},reverse(){direction*=-1;},reset(){playing=false;return seek(0);},
   setMode(mode,frames){const next=clone(cfg);next.mode=mode;next.durationFrames=frames;next.exportFrames=frames;replace(next,0);playing=false;},
   serialize:()=>JSON.stringify({schemaVersion:1,effectId:ID,settings:cfg},null,2),
   importPreset(raw){const p=JSON.parse(raw);if(!p||Object.keys(p).length!==3||p.schemaVersion!==1||p.effectId!==ID)throw Error('Invalid Blizzard preset');return replace(p.settings);},
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
 function pageBindings(pages,images){
  if(!Array.isArray(pages)||!pages.length||!(images instanceof Map))throw Error('Empty Blizzard atlas or invalid textures');
  const canonical=name=>{if(typeof name!=='string')throw Error('Invalid image name');const n=name.replaceAll('\\','/');if(!n||n.startsWith('/')||/^[A-Za-z]:/.test(n)||/[\x00-\x1f\x7f]/.test(n)||n.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe image path '+name);return n;};
  const inputs=new Map(),used=new Set(),seen=new Set();
  for(const [key,blob] of images){const n=canonical(key);if(inputs.has(n)||!blob)throw Error('Ambiguous Blizzard texture '+key);inputs.set(n,key);}
  return pages.map(page=>{
   const name=page.name,n=canonical(name);if(seen.has(n))throw Error('Duplicate atlas page '+name);seen.add(n);
   let key=inputs.get(n);
   if(key===undefined){const matches=[...inputs].filter(([p])=>p.split('/').at(-1)===n.split('/').at(-1));if(matches.length!==1)throw Error('Missing or ambiguous atlas page '+name);key=matches[0][1];}
   if(used.has(key))throw Error('Reused atlas texture '+key);used.add(key);
   return {name,key};
  });
 }
 function spineVersion(raw,binary,Spine){
  let version=raw?.skeleton?.spine;
  if(binary){if(!(raw instanceof Uint8Array)||raw.length<10)throw Error('Invalid Spine binary header');const input=new Spine.BinaryInput(raw.subarray(0,64));input.readInt32();input.readInt32();version=input.readString();}
  if(typeof version!=='string'||!/^4\.2\.\d+$/.test(version))throw Error('Blizzard requires Spine 4.2.x; received '+String(version));
  return version;
 }
 function selectFiles(files){
  const sk=files.filter(f=>/\.(json|skel)$/i.test(f.name)),at=files.filter(f=>/\.atlas$/i.test(f.name)),images=new Map();
  if(sk.length!==1||at.length!==1)throw Error('Choose one skeleton, atlas and all texture pages');
  for(const f of files.filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name))){if(images.has(f.name))throw Error('Duplicate selected texture '+f.name);images.set(f.name,f);}
  if(!images.size)throw Error('Choose all texture pages');
  const bytes=[sk[0],at[0],...images.values()].reduce((n,f)=>n+f.size,0);
  if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>192*1024*1024)throw Error('Blizzard asset input budget exceeded');
  return {skeletonName:sk[0].name,skeleton:sk[0],atlasName:at[0].name,atlas:at[0],images};
 }
 function downloadPreset(raw){
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='Blizzard_Preset.json';try{link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 function mount(){
  const {PIXI,spine,FxBlizzardRuntime,FxBlizzardPose,FxCurveEditor,FxColorUi}=root,$=id=>document.getElementById(id);
  let scene=null,asset=null,busy=false,editors=[],lockedControls=[];
  const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
  function setBusy(v){
   busy=!!v;
   if(busy){lockedControls=[...document.querySelectorAll('main input,main button,main select,main textarea')].filter(e=>!e.disabled);for(const e of lockedControls)e.disabled=true;}
   else{for(const e of lockedControls)e.disabled=false;lockedControls=[];}
  }
  function backend(app,requested){const gl=app.renderer.gl;return {requested,actual:gl?(typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):app.renderer.type===PIXI.RendererType.WEBGPU?'webgpu':'unknown',pixi:PIXI.VERSION};}
  function pose(s,t,c=session.settings,skin=$('skin').value,animation=$('animation').value){if(s.model){FxBlizzardPose.seek(s.model,c,t,{skin,animation});s.model.visible=$('showSpine').checked;}s.fx.seek(t);s.app.render();}
  const session=createSession(Core.defaults(),{
   configure(c,t){if(!scene)return;const old=session.settings,oldTime=session.time;try{if(scene.model)FxBlizzardPose.seek(scene.model,c,t,{skin:$('skin').value,animation:$('animation').value});scene.fx.configure(c);scene.fx.seek(t);}catch(error){try{scene.fx.configure(old);pose(scene,oldTime,old);}catch(rollback){throw new AggregateError([error,rollback],'Blizzard configure rollback failed');}throw error;}},
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
    h.hidden=!p||!Number.isFinite(p.x)||!Number.isFinite(p.y);if(!h.hidden){h.style.left=(p.x+({origin:0,streaks:-24,foreground:24,whiteout:0}[kind]))+'px';h.style.top=(p.y+(kind==='whiteout'?24:0))+'px';}
   }
  }
  function attempt(fn,rebuild=false){if(busy)return false;
   try{fn();if(scene)scene.app.render();status('Blizzard • settings accepted');if(rebuild)refresh();else refreshTime();return true;}
   catch(e){status(e.message,true);return false;}
  }
  function addControl(holder,label,value,apply,options={}){
   const row=document.createElement('label');row.className='control';row.textContent=label;
   const input=document.createElement(options.choices?'select':'input');
   if(options.id)input.id=options.id;
   if(options.choices){for(const item of options.choices){const o=document.createElement('option');o.value=String(item);o.textContent=String(item);input.append(o)}}
   else{input.type=options.type||'number';for(const k of ['min','max','step'])if(options[k]!==undefined)input[k]=options[k];}
   const set=v=>{if(input.type==='checkbox')input.checked=v;else input.value=String(v);};
   set(value);input.onchange=()=>{const v=input.type==='checkbox'?input.checked:options.numeric||input.type==='number'?(input.value.trim()===''?NaN:Number(input.value)):input.value;
    if(!attempt(()=>apply(v),!!options.rebuild))set(value);else value=v;};
   row.append(input);holder.append(row);return input;
  }
  const ranges={particleRate:[0,400,1],windSpeed:[0,900,1],windVariance:[0,1,.01],streakLength:[2,90,1],density:[0,1,.01],angle:[-90,90,1],nearGapPx:[1,75,1],spatialJitter:[0,.65,.01],seed:[-2147483648,2147483647,1],exportFrames:[1,3600,1]};
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
   const e=selection(cfg);if(e){addControl(em,'Name',e.name,v=>session.edit(c=>selection(c).name=v),{type:'text'});transformControls(em,e,selection);
    for(const kind of Core.LAYERS){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=pretty(kind);details.append(summary);
     const inside=document.createElement('div');inside.className='inside';transformControls(inside,e.layers[kind],c=>selection(c).layers[kind],true);details.append(inside);em.append(details);}
   }
   for(const x of editors)x?.destroy?.();editors=[];
   $('curves').replaceChildren();$('gradient').replaceChildren();
   for(const key of ['stormIntensityCurve','driftSpeedCurve','whiteoutAlphaCurve','emissionRateCurve','spacingCurve','particleAlphaCurve']){
    const title=document.createElement('h4');title.textContent=pretty(key);$('curves').append(title);
    const el=document.createElement('div');$('curves').append(el);
    editors.push(FxCurveEditor.mount(el,{curve:cfg[key],idPrefix:'blizzard-'+key,getFrameCount:()=>session.settings.durationFrames,isLocked:()=>busy,
     onChange:v=>{if(!attempt(()=>session.edit(c=>c[key]=v)))refresh();},
     onScrub:v=>attempt(()=>session.seek(v*session.end))}));
   }
   editors.push(FxColorUi.mount($('gradient'),{idPrefix:'blizzardGradient',kind:'gradient',value:cfg.palette,defaultValue:Core.defaults().palette,
    isLocked:()=>busy,onChange:v=>{if(!attempt(()=>session.edit(c=>c.palette=v)))refresh();}}));
   refreshTime();
  }
  async function readSpine(source){
   const bytes=await source.skeleton.arrayBuffer(),binary=/\.skel$/i.test(source.skeletonName);
   const raw=binary?new Uint8Array(bytes):JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   const version=spineVersion(raw,binary,spine);
   const atlas=new spine.TextureAtlas(new TextDecoder('utf-8',{fatal:true}).decode(await source.atlas.arrayBuffer()));let model=null;const imageSources=[];
   function dispose(){try{model?.destroy();}finally{try{atlas.dispose();}finally{for(const source of imageSources)if(!source.destroyed)source.destroy();}}}
   try{
    const bindings=pageBindings(atlas.pages,source.images);
    let decodedPixels=0;
    for(const [i,page] of atlas.pages.entries()){const blob=source.images.get(bindings[i].key);
     const url=URL.createObjectURL(blob);let image;
     try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
     const pixels=image.naturalWidth*image.naturalHeight;decodedPixels+=pixels;if(!Number.isSafeInteger(pixels)||pixels<=0||image.naturalWidth>8192||image.naturalHeight>8192||decodedPixels>48*1024*1024)throw Error('Blizzard decoded texture budget exceeded');
     const imageSource=new PIXI.ImageSource({resource:image,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
     imageSources.push(imageSource);
     let texture;try{texture=spine.SpineTexture.from(imageSource);page.setTexture(texture);}catch(error){if(page.texture!==texture){if(texture)texture.dispose();}throw error;}
    }
    const loader=new spine.AtlasAttachmentLoader(atlas),parser=binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
    const data=parser.readSkeletonData(raw);model=new spine.Spine({skeletonData:data,autoUpdate:false});model.update(0);
    const b=model.getLocalBounds();if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||!(b.width>0&&b.height>0))throw Error('Empty Spine skeleton');
    const scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);
    return {model,atlas,data,version,pageBindings:bindings,dispose};
   }catch(e){dispose();throw e;}
  }
  async function makeScene(which,source,settings,skin='',animation=''){
   const app=new PIXI.Application();let host,fx,sp=null,initialized=false;
   try{
    await app.init({width:512,height:512,resolution:1,backgroundAlpha:0,preference:which==='webgpu'?'webgpu':'webgl',
     preferWebGLVersion:which==='webgl1'?1:2,antialias:which!=='webgl1',autoStart:false,sharedTicker:false});
    initialized=true;host=new PIXI.Container();app.stage.addChild(host);
    if(source){sp=await readSpine(source);host.addChild(sp.model);
     FxBlizzardPose.seek(sp.model,settings,0,{skin:sp.data.skins.some(s=>s.name===skin)?skin:'',animation:sp.data.animations.some(a=>a.name===animation)?animation:''});}
    fx=FxBlizzardRuntime.createBlizzard({PIXI,app,host,model:sp?.model??null,settings});
    return {app,host,fx,model:sp?.model??null,data:sp?.data,pageBindings:sp?.pageBindings??[],actual:backend(app,which),
     dispose(){try{fx.destroy();}finally{try{sp?.dispose();}finally{app.destroy(true);}}}};
   }catch(e){try{fx?.destroy();}finally{try{sp?.dispose();}finally{if(initialized)app.destroy(true);}}throw e;}
  }
  function populateSpine(s,skin,animation){
   for(const [id,rows,selected] of [['skin',s.data?.skins||[],skin],['animation',s.data?.animations||[],animation]]){
    const el=$(id);el.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=id==='animation'?'Setup pose':'Default skin';el.append(empty);
    for(const item of rows){const opt=document.createElement('option');opt.value=item.name;opt.textContent=item.name;el.append(opt);}el.value=selected||'';
   }
  }
  async function switchScene(source=asset,which=$('backend').value){
   if(busy)return;session.pause();setBusy(true);const skin=$('skin').value,animation=$('animation').value;
   let next=null;
   try{next=await makeScene(which,source,session.settings,skin,animation);const old=scene;
    const validSkin=next.data?.skins.some(s=>s.name===skin)?skin:'',validAnimation=next.data?.animations.some(a=>a.name===animation)?animation:'';
    pose(next,session.time,session.settings,validSkin,validAnimation);next.skin=validSkin;next.animation=validAnimation;
    scene=next;next=null;asset=source;old?.dispose();$('preview').querySelector('canvas')?.remove();$('preview').prepend(scene.app.canvas);
    populateSpine(scene,validSkin,validAnimation);$('backendActual').textContent=scene.actual.actual.toUpperCase()+' • Pixi '+scene.actual.pixi;
    $('assetLabel').textContent=asset?asset.skeletonName:'No Spine model';
    scene.app.ticker.add(t=>{if(!busy&&session.playing){try{session.tick(t.elapsedMS/1000);refreshTime();}catch(e){session.pause();status(e.message,true);}}});
    scene.app.start();refreshTime();status(scene.actual.actual===which?'Blizzard ready':'Requested '+which+'; actual '+scene.actual.actual,true&&scene.actual.actual!==which);
   }catch(e){next?.dispose();status('Scene rejected: '+e.message,true);if(scene)$('backend').value=scene.actual.requested;}
   finally{setBusy(false);}
  }
  $('backend').onchange=()=>switchScene();$('background').onchange=()=>{$('preview').className=$('background').value};
  $('zoom').onchange=()=>{$('preview').style.transform='scale('+$('zoom').value+')'};
  $('play').onclick=()=>attempt(()=>session.playing?session.pause():session.play());
  $('reverse').onclick=()=>attempt(()=>session.reverse());$('reset').onclick=()=>attempt(()=>session.reset());
  $('frame').oninput=()=>attempt(()=>{session.pause();session.seek(Number($('frame').value)/60);});
  $('showSpine').onchange=()=>attempt(()=>session.seek(session.time));
  function changePose(){if(busy||!scene)return;const skin=$('skin').value,animation=$('animation').value;
   if(attempt(()=>session.seek(session.time))){scene.skin=skin;scene.animation=animation;}
   else{$('skin').value=scene.skin;$('animation').value=scene.animation;attempt(()=>session.seek(session.time));status('Spine pose rejected',true);}
  }
  $('animation').onchange=changePose;$('skin').onchange=changePose;
  $('sample').onclick=()=>{if(busy)return;try{const spec=JSON.parse($('sampleData').textContent);switchScene({
   skeletonName:spec.skeletonName,skeleton:new Blob([JSON.stringify(spec.skeleton)]),atlasName:spec.atlasName,atlas:new Blob([spec.atlas]),
   images:new Map(Object.entries(spec.images).map(([n,v])=>[n,new Blob([Uint8Array.from(atob(v),ch=>ch.charCodeAt(0))])]))});}catch(e){status(e.message,true);}};
  $('chooseFiles').onclick=()=>{if(!busy)$('files').click()};
  $('files').onchange=()=>{if(busy)return;const files=[...$('files').files];$('files').value='';
   try{switchScene(selectFiles(files));}catch(error){status(error.message,true);}
  };
  $('defaults').onclick=()=>attempt(()=>{session.replace(Core.defaults());session.reset();},true);
  $('savePreset').onclick=()=>{if(!busy)downloadPreset(session.serialize());};
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
      if(!delta)throw Error('AIR-03 unresolved or singular anchor transform');
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
   get asset(){return asset?{...asset,pageBindings:scene.pageBindings.map(p=>({...p})),skin:$('skin').value,animation:$('animation').value}:null},
   getSettings:()=>session.settings,getActualBackend:()=>scene?.actual??{actual:'unavailable',requested:$('backend').value},
   setSettings:c=>attempt(()=>session.replace(c),true),seek:t=>attempt(()=>session.seek(t)),
   stop:()=>session.pause(),refreshTime});
 }
 return {createSession,pageBindings,spineVersion,selectFiles,originDelta,mount};
});
