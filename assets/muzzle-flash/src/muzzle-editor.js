// GAME-01 interactive offline preview. No mutable globals or export claims.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),U=FxMuzzleAuthoring,M=FxMuzzle,A=FxMuzzleAnchors,S=FxMuzzleSmoke,Sp=FxShockwaveSpine;
 const clone=v=>JSON.parse(JSON.stringify(v)),initial=()=>({schemaVersion:1,effect:M.defaults(),anchors:A.defaults(),smoke:S.defaults(),smokeAnchor:A.defaults().core,blends:S.blendDefaults()});
 const general={flashLength:[8,260,1],coneAngle:[5,150,1],flashWidth:[2,100,1],flashDuration:[1,24,1],tongueCount:[1,20,1],sparkCount:[0,50,1],sparkLifeFrames:[1,60,1],sparkSpeed:[0,10000,1],burstFrames:[1,24,1],minInterval:[0,1,.001],timeJitter:[0,.45,.01],tongueGap:[1,30,.1],minGap:[1,30,.1],maxGap:[1,30,.1],spatialJitter:[0,.45,.01],exportFrames:[1,3600,1]};
 const transforms={enabled:null,x:[-10000,10000,.1],y:[-10000,10000,.1],rotation:[-360,360,.1],delayFrames:[0,60,1],opacity:[0,1,.01]};
 const smokeFields={count:[0,16,1],spreadFrames:[0,24,1],lifeFrames:[1,120,1],speed:[0,1000,1],radius:[1,100,.1],growth:[1,4,.1]};
 let cfg=initial(),scene=null,source=null,seconds=0,playing=false,previous=null,busy=false,drag=null,animation='',skin='';
 const status=(s,error=false)=>{$('status').textContent=s;$('status').dataset.error=String(error);};
 function play(v){playing=v;previous=null;$('play').textContent=v?'Pause':'Play';}
 function lock(v){busy=v;play(false);$('controls').disabled=v;$('transport').disabled=v;$('assets').disabled=v;$('backend').disabled=v;}
 function attempt(fn){try{fn();}catch(e){status(e.message,true);}}
 function context(s=scene){return {host:s.host,world:s.app.stage,model:s.asset?.model||null};}
 function options(){return {animation,skin,speed:Number($('speed').value),visible:$('showSpine').checked};}
 function selected(){return $('layer').value;}
 function currentPose(){return A.resolve(U.anchor(cfg,selected()),context());}
 function handle(){const p=scene&&U.origin(currentPose(),U.layer(cfg,selected())),h=$('handle');h.hidden=!p||busy;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function paint(s,t,opts=options()){Sp.pose(s.asset,t,opts);s.fx.seek(t);s.app.render();}
 function seek(t){if(!scene)return;const next=U.seek(t,cfg);paint(scene,next);seconds=next;$('frame').max=U.frameCount(cfg)-1;$('frame').value=U.frame(seconds,cfg);$('frameLabel').textContent=$('frame').value+' / '+$('frame').max;handle();}
 function sync(){$('preset').value=JSON.stringify(cfg,null,2);}
 function change(next,refresh=true){if(busy||!scene)throw Error('Preview unavailable');const old=cfg,oldTime=seconds;
  cfg=scene.fx.configure(next);try{seek(seconds);}catch(e){cfg=scene.fx.configure(old);seek(oldTime);throw e;}
  sync();if(refresh)controls();handle();status('Settings applied');}
 function edit(fn,refresh=true){const next=clone(cfg);fn(next);change(next,refresh);}
 function field(host,key,value,range,fn,choices){const l=document.createElement('label'),el=document.createElement(choices?'select':'input');l.textContent=key;el.setAttribute('aria-label',key);
  if(choices){for(const v of choices)el.add(new Option(v,v));el.value=value;}else if(range){el.type='number';[el.min,el.max,el.step]=range;el.value=value;}else if(typeof value==='boolean'){el.type='checkbox';el.checked=value;}else{el.type='text';el.value=value;}
  el.onchange=()=>attempt(()=>{if(range&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+key);fn(range?Number(el.value):el.type==='checkbox'?el.checked:el.value);});l.append(el);host.append(l);}
 function controls(){const g=$('general'),l=$('layerFields'),a=$('anchorFields'),k=selected(),layer=U.layer(cfg,k),anchor=U.anchor(cfg,k);g.replaceChildren();l.replaceChildren();a.replaceChildren();
  for(const [key,r] of Object.entries(general))field(g,key,cfg.effect[key],r,v=>edit(c=>{c.effect[key]=v;}));
  for(const key of ['rateCurveEnabled','spacingCurveEnabled'])field(g,key,cfg.effect[key],null,v=>edit(c=>{c.effect[key]=v;}));
  field(g,'spatialMode',cfg.effect.spatialMode,null,v=>edit(c=>{c.effect.spatialMode=v;}),['even','random','stratified','clustered']);
  const fields={...transforms,...(k==='core'?{}:{seed:[-2147483648,2147483647,1]}),...(k==='smoke'?smokeFields:{})};
  for(const [key,r] of Object.entries(fields))field(l,key,layer[key],r,v=>edit(c=>{U.layer(c,k)[key]=v;}));
  field(l,'blend',cfg.blends[k],null,v=>edit(c=>{c.blends[k]=v;}),['normal','add']);
  field(a,'anchor type',anchor.type,null,v=>edit(c=>{const p=U.anchor(c,k);p.type=v;p.space=v==='world'?'world':'local';p.name=v==='bone'?(scene.asset?.model.skeleton.bones[0]?.data.name||'root'):v==='slot'||v==='attachment'?'slot':'';p.slot=v==='attachment'?'slot':'';}),['world','skeleton','bone','slot','attachment']);
  if(anchor.type!=='world')field(a,'anchor space',anchor.space,null,v=>edit(c=>{U.anchor(c,k).space=v;}),['world','local']);
  if(['bone','slot','attachment'].includes(anchor.type))field(a,'anchor name',anchor.name,null,v=>edit(c=>{U.anchor(c,k).name=v;}));
  if(anchor.type==='attachment')field(a,'anchor slot',anchor.slot,null,v=>edit(c=>{U.anchor(c,k).slot=v;}));
  for(const key of ['x','y','rotation'])field(a,'anchor '+key,anchor[key],key==='rotation'?[-360,360,.1]:[-10000,10000,.1],v=>edit(c=>{U.anchor(c,k)[key]=v;}));
 }
 function curve(){const key=$('curveKey').value,h=$('curve');h.replaceChildren();const c=cfg.effect.curves[key];FxCurveEditor.mount(h,{curve:c,idPrefix:'muzzleCurve',getFrameCount:()=>key==='sparkSpeed'?cfg.effect.sparkLifeFrames:key==='flashAlpha'?cfg.effect.flashDuration:100,isLocked:()=>busy,onScrub:u=>{if(key==='flashAlpha'){play(false);attempt(()=>seek(u*cfg.effect.flashDuration/60));}},onChange:v=>edit(n=>{n.effect.curves[key]=v;},false)});}
 function palette(){const k=selected(),h=$('palette');h.replaceChildren();const get=c=>k==='smoke'?c.smoke.palette:k==='sparks'?c.effect.sparkPalette:c.effect.palette;
  FxColorUi.mount(h,{value:get(cfg),defaultValue:get(initial()),idPrefix:'muzzlePalette',isLocked:()=>busy,onChange:v=>edit(c=>{Object.assign(get(c),v,{parameterKey:get(cfg).parameterKey});},false)});}
 function refresh(){controls();curve();palette();sync();handle();}
 function populate(){const a=$('animation'),s=$('skin');a.replaceChildren(new Option('Setup pose',''));s.replaceChildren(new Option('Default skin',''));if(scene?.asset){for(const v of scene.asset.animations)a.add(new Option(v,v));for(const v of scene.asset.skins)s.add(new Option(v,v));}a.value=animation;s.value=skin;$('assetName').textContent=source?.name||'No Spine asset';}
 function destroy(s){if(!s)return;s.fx?.destroy();s.asset?.destroy();if(s.app.renderer)s.app.destroy(true,{children:true});}
 async function rebuild(backend,nextSource=source,resetPose=false){if(busy)return;lock(true);const next={app:new PIXI.Application(),asset:null,fx:null};
  try{await next.app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const r=next.app.renderer,actual=r.gl?(r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):r.name==='webgpu'||(PIXI.RendererType?.WEBGPU!==undefined&&r.type===PIXI.RendererType.WEBGPU)?'webgpu':'unsupported';
   if(actual!==backend)throw Error('Requested '+backend+', got '+actual);next.actual=actual;
   const models=new PIXI.Container();next.host=new PIXI.Container();next.app.stage.addChild(models,next.host);
   if(nextSource){next.asset=await Sp.create(nextSource);models.addChild(next.asset.model);}
   const opt=options();if(resetPose){opt.animation=next.asset?.defaultAnimation||'';opt.skin=next.asset?.defaultSkin||'';}
   const compile=S.createCompiler({compileEffect:M.compile,anchors:A,colors:FxColors,...context(next)});next.fx=FxMuzzleRuntime.createRenderer({PIXI,host:next.host,compile,settings:cfg});
   paint(next,seconds,opt);$('surface').prepend(next.app.canvas);const old=scene;scene=next;source=nextSource;animation=opt.animation;skin=opt.skin;cfg=next.fx.settings;destroy(old);
   $('actual').textContent=actual.toUpperCase();$('backend').value=actual;document.body.dataset.ready='true';populate();status('Ready');
  }catch(e){if(scene!==next)destroy(next);$('backend').value=scene?.actual||backend;status(e.message,true);}
  finally{lock(false);if(scene){attempt(()=>{refresh();seek(seconds);});}else{$('controls').disabled=$('transport').disabled=$('assets').disabled=true;}}
 }
 $('backend').onchange=()=>rebuild($('backend').value);$('background').onchange=()=>{$('surface').className=$('background').value;};$('zoom').oninput=()=>{$('surface').style.width=512*Number($('zoom').value)/100+'px';};
 $('load').onclick=()=>attempt(()=>rebuild(scene.actual,U.collect($('files').files),true));$('sample').onclick=()=>attempt(()=>rebuild(scene.actual,Sp.sample(JSON.parse($('sampleData').textContent)),true));$('remove').onclick=()=>rebuild(scene.actual,null,true);
 for(const id of ['animation','skin','speed','showSpine'])$(id).onchange=()=>attempt(()=>{if(!$('speed').value||!$('speed').validity.valid)throw Error('Invalid speed');animation=$('animation').value;skin=$('skin').value||scene.asset?.defaultSkin||'';seek(seconds);});
 $('play').onclick=()=>{if(!playing&&seconds>=(U.frameCount(cfg)-1)/60)seek(0);play(!playing);};$('reset').onclick=()=>{play(false);attempt(()=>seek(0));};$('frame').oninput=()=>{play(false);attempt(()=>seek(Number($('frame').value)/60));};
 $('layer').onchange=()=>{controls();palette();handle();};$('curveKey').onchange=curve;$('apply').onclick=()=>attempt(()=>{change(JSON.parse($('preset').value));refresh();});$('defaults').onclick=()=>attempt(()=>{change(initial());refresh();});
 const h=$('handle');h.onpointerdown=e=>{if(busy||!scene)return;play(false);h.setPointerCapture(e.pointerId);drag=e.pointerId;};h.onpointermove=e=>{if(drag!==e.pointerId||busy)return;attempt(()=>{const p=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect()),o=U.offset(currentPose(),p.x,p.y);if(o)edit(c=>Object.assign(U.layer(c,selected()),o),false);});};h.onpointerup=h.onpointercancel=h.onlostpointercapture=()=>{drag=null;if(scene)controls();};
 function tick(now){if(playing&&!busy&&scene){if(previous!==null)attempt(()=>{seek(U.advance(seconds,(now-previous)/1000,cfg));if(seconds>=(U.frameCount(cfg)-1)/60)play(false);});if(playing)previous=now;}requestAnimationFrame(tick);}
 window.addEventListener('pagehide',()=>{play(false);destroy(scene);scene=null;},{once:true});requestAnimationFrame(tick);rebuild('webgl2');
})();
