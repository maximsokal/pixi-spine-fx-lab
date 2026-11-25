// GAME-02 H03: offline authoring controller. No mutable window state.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),U=FxHitSparksAuthoring,H=FxHitSparks,A=FxHitSparksAnchors,Sp=FxShockwaveSpine;
 const clone=v=>JSON.parse(JSON.stringify(v)),initial=()=>({schemaVersion:1,effect:H.defaults(),anchors:A.defaults()});
 const ranges={burstCount:[0,140,1],spread:[0,360,1],initialSpeed:[0,900,1],sparkLength:[2,80,.1],width:[.5,12,.1],durationFrames:[1,120,1],dustCount:[0,70,1],dustDelayFrames:[2,6,1],flashFrames:[1,120,1],flashRadius:[1,80,.1],staggerFrames:[0,120,1],minInterval:[0,2,.001],timeJitter:[0,.45,.01],gap:[1,35,.1],minGap:[1,35,.1],maxGap:[1,35,.1],spatialJitter:[0,.45,.01],collisionNormal:[-360,360,1],exportFrames:[1,3600,1]};
 const titles={burstCount:'Burst count',spread:'Spread (°)',initialSpeed:'Initial speed (px/s)',sparkLength:'Spark length (px)',width:'Width (px)',durationFrames:'Lifetime (frames)',dustCount:'Dust count',dustDelayFrames:'Dust delay (frames)',flashFrames:'Flash lifetime (frames)',flashRadius:'Flash radius (px)',staggerFrames:'Stagger (frames)',minInterval:'Min interval (s)',timeJitter:'Time jitter',gap:'Origin gap (px)',minGap:'Min gap (px)',maxGap:'Max gap (px)',spatialJitter:'Space jitter',collisionNormal:'Collision normal (°)',exportFrames:'Timeline frames'};
 const transforms={enabled:null,x:[-10000,10000,'any'],y:[-10000,10000,'any'],rotation:[-360,360,'any'],delayFrames:[0,120,1],opacity:[0,1,'any'],seed:[-2147483648,2147483647,1]};
 let cfg=initial(),scene=null,source=null,seconds=0,playing=false,previous=null,busy=false,closed=false,drag=null,animation='',skin='',raf=0;
 const status=(s,error=false)=>{$('status').textContent=s;$('status').dataset.error=String(error);};
 function play(v){playing=v;previous=null;$('play').textContent=v?'Pause':'Play';}
 function lock(v){busy=v;play(false);for(const id of ['controls','transport','assets'])$(id).disabled=v||!scene;$('backend').disabled=v;handle();}
 function attempt(fn){try{return fn();}catch(e){play(false);status(e.message,true);}}
 function context(s=scene){return {host:s.host,world:s.app.stage,model:s.asset?.model||null,Spine:spine};}
 function options(){const el=$('speed');if(!el.value||!el.validity.valid)throw Error('Invalid Spine speed');return {animation,skin,speed:Number(el.value),visible:$('showSpine').checked};}
 function selected(){return $('layer').value;}
 function currentPose(){return A.resolve(U.anchor(cfg,selected()),context());}
 function handle(){const p=scene&&U.origin(currentPose(),U.layer(cfg,selected())),h=$('handle');h.hidden=!p||busy||closed;if(p){h.style.left=p.x/512*100+'%';h.style.top=p.y/512*100+'%';}}
 function paint(s,t,opts=options()){FxHitSparksPose.pose(s.asset,t,opts,Sp);const q=s.fx.seek(t);s.app.render();return q;}
 function seek(t){if(!scene)return;const next=U.seek(t,cfg);const q=paint(scene,next);seconds=next;$('frame').max=U.frameCount(cfg)-1;$('frame').value=U.frame(seconds,cfg);$('frameLabel').textContent=$('frame').value+' / '+$('frame').max+' · '+seconds.toFixed(3)+' s';
  const missing=H.LAYERS.filter(k=>cfg.effect.layers[k].enabled&&!A.resolve(cfg.anchors[k],context()));$('missing').textContent=missing.length?'Missing anchors: '+missing.join(', '):'';
  $('timingInfo').textContent='Visible: '+H.LAYERS.map(k=>k+' '+q[k].length).join(' · ');handle();}
 function sync(){$('preset').value=JSON.stringify(cfg,null,2);}
 function change(next,refresh=true){if(busy||!scene||closed)throw Error('Preview unavailable');const old=cfg,oldTime=seconds;
  cfg=scene.fx.configure(next);try{seek(seconds);}catch(e){cfg=scene.fx.configure(old);seek(oldTime);throw e;}sync();if(refresh)controls();status('Settings applied');}
 function edit(fn,refresh=true){const next=clone(cfg);fn(next);change(next,refresh);}
 function field(host,key,value,range,fn,choices,label=key){
  const l=document.createElement('label'),el=document.createElement(choices?'select':'input');l.textContent=label;el.setAttribute('aria-label',label);el.dataset.field=key;
  if(choices){for(const v of choices)el.add(new Option(v,v));el.value=value;}else if(range){el.type='number';[el.min,el.max,el.step]=range;el.value=value;}else if(typeof value==='boolean'){el.type='checkbox';el.checked=value;}else{el.type='text';el.value=value;}
  el.onchange=()=>{try{if(range&&(!el.value.trim()||!el.validity.valid))throw Error('Invalid '+label);fn(range?Number(el.value):el.type==='checkbox'?el.checked:el.value);}catch(e){if(el.type==='checkbox')el.checked=value;else el.value=value;status(e.message,true);}};l.append(el);host.append(l);}
 function controls(){
  const g=$('general'),l=$('layerFields'),a=$('anchorFields'),k=selected(),layer=U.layer(cfg,k),anchor=U.anchor(cfg,k);g.replaceChildren();l.replaceChildren();a.replaceChildren();
  for(const [key,r] of Object.entries(ranges))field(g,key,cfg.effect[key],r,v=>edit(c=>{c.effect[key]=v;}),null,titles[key]);
  field(g,'durationSeconds',cfg.effect.durationFrames/60,[1/60,2,'any'],v=>edit(c=>{c.effect.durationFrames=Math.max(1,Math.min(120,Math.round(v*60)));}),null,'Lifetime (seconds, snapped to frames)');
  field(g,'frequencySource',cfg.effect.frequencySource,null,v=>edit(c=>{c.effect.frequencySource=v;}),['rate','interval'],'Stagger frequency source');
  field(g,'spatialMode',cfg.effect.spatialMode,null,v=>edit(c=>{c.effect.spatialMode=v;}),['even','random','stratified','clustered'],'Spatial distribution');
  field(g,'spacingCurveEnabled',cfg.effect.spacingCurveEnabled,null,v=>edit(c=>{c.effect.spacingCurveEnabled=v;}));
  for(const [key,r] of Object.entries(transforms))field(l,key,layer[key],r,v=>edit(c=>{U.layer(c,k)[key]=v;}));
  field(l,'blend',layer.blend,null,v=>edit(c=>{U.layer(c,k).blend=v;}),['normal','add']);
  field(a,'type',anchor.type,null,v=>edit(c=>{const p=U.anchor(c,k),sk=scene.asset?.model.skeleton,slot=sk?.slots.find(s=>s.getAttachment())||sk?.slots[0];p.type=v;p.space=v==='world'?'world':'local';p.name=v==='bone'?(sk?.bones[0]?.data.name||'root'):v==='slot'?(slot?.data.name||'slot'):v==='attachment'?(slot?.getAttachment()?.name||'attachment'):'';p.slot=v==='attachment'?(slot?.data.name||'slot'):'';p.x=v==='world'?256:0;p.y=v==='world'?256:0;}),['world','skeleton','bone','slot','attachment'],'Anchor type');
  if(anchor.type!=='world')field(a,'space',anchor.space,null,v=>edit(c=>{U.anchor(c,k).space=v;}),['world','local'],'Anchor space');
  if(['bone','slot','attachment'].includes(anchor.type))field(a,'name',anchor.name,null,v=>edit(c=>{U.anchor(c,k).name=v;}),null,'Anchor name');
  if(anchor.type==='attachment')field(a,'slot',anchor.slot,null,v=>edit(c=>{U.anchor(c,k).slot=v;}),null,'Attachment slot');
  for(const key of ['x','y','rotation'])field(a,key,anchor[key],key==='rotation'?[-360,360,'any']:[-10000,10000,'any'],v=>edit(c=>{U.anchor(c,k)[key]=v;}),null,'Anchor '+key);
 }
 function curve(){const key=$('curveKey').value,h=$('curve');h.replaceChildren();const count=()=>['burstRate','burstInterval'].includes(key)?Math.max(1,cfg.effect.staggerFrames):['sparkSpeed','alpha'].includes(key)?cfg.effect.durationFrames:100;
  FxCurveEditor.mount(h,{curve:cfg.effect.curves[key],idPrefix:'hitSparksCurve',getFrameCount:count,isLocked:()=>busy||closed,onScrub:u=>{if(['burstRate','burstInterval','sparkSpeed','alpha'].includes(key)){play(false);attempt(()=>seek(u*count()/60));}},onChange:v=>edit(n=>{n.effect.curves[key]=v;},false)});}
 function palette(){const k=selected(),h=$('palette');h.replaceChildren();FxColorUi.mount(h,{value:cfg.effect.palettes[k],defaultValue:initial().effect.palettes[k],idPrefix:'hitSparksPalette',isLocked:()=>busy||closed,onChange:v=>edit(c=>{c.effect.palettes[k]={...v,parameterKey:c.effect.palettes[k].parameterKey};},false)});}
 function refresh(){controls();curve();palette();sync();handle();}
 function populate(){const a=$('animation'),s=$('skin');a.replaceChildren(new Option('Setup pose',''));s.replaceChildren(new Option('Default skin',''));if(scene?.asset){for(const v of scene.asset.animations)a.add(new Option(v,v));for(const v of scene.asset.skins)s.add(new Option(v,v));}a.value=animation;s.value=skin;$('assetName').textContent=source?.name||'No Spine asset';}
 function destroy(s){if(!s)return;s.fx?.destroy();s.asset?.destroy();if(s.app.renderer)s.app.destroy(true,{children:true});}
 async function rebuild(backend,nextSource=source,resetPose=false){
  if(busy||closed)return;lock(true);const next={app:new PIXI.Application(),asset:null,fx:null};
  try{await next.app.init({width:512,height:512,resolution:1,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   if(closed)return;const r=next.app.renderer,actual=r.gl?(typeof WebGL2RenderingContext!=='undefined'&&r.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):r.gpu?.device&&r.type===PIXI.RendererType.WEBGPU?'webgpu':'unsupported';
   if(actual!==backend)throw Error('Requested '+backend+', got '+actual);next.actual=actual;
   const models=new PIXI.Container();next.host=new PIXI.Container();next.app.stage.addChild(models,next.host);
   if(nextSource){next.asset=await Sp.create(nextSource);if(closed)return;models.addChild(next.asset.model);}
   const opt=options();if(resetPose){opt.animation=next.asset?.defaultAnimation||'';opt.skin=next.asset?.defaultSkin||'';}
   const compile=A.createCompiler({compile:H.compile,...context(next)});next.fx=FxHitSparksRuntime.createRenderer({PIXI,host:next.host,compile,settings:cfg});
   paint(next,seconds,opt);$('surface').prepend(next.app.canvas);const old=scene;scene=next;source=nextSource;animation=opt.animation;skin=opt.skin;cfg=next.fx.settings;destroy(old);
   $('actual').textContent=actual.toUpperCase();$('backend').value=actual;document.body.dataset.ready='true';populate();status('Ready');
  }catch(e){if(!closed){$('backend').value=scene?.actual||backend;status(e.message,true);}}
  finally{if(scene!==next)destroy(next);if(!closed){lock(false);if(scene)attempt(()=>{refresh();seek(seconds);});}}
 }
 $('backend').onchange=()=>rebuild($('backend').value);$('background').onchange=()=>{$('surface').className=$('background').value;};$('zoom').oninput=()=>{$('surface').style.width=512*Number($('zoom').value)/100+'px';};
 $('load').onclick=()=>attempt(()=>rebuild(scene.actual,U.collect($('files').files),true));$('sample').onclick=()=>attempt(()=>rebuild(scene.actual,Sp.sample(JSON.parse($('sampleData').textContent)),true));$('remove').onclick=()=>rebuild(scene.actual,null,true);
 for(const id of ['animation','skin','speed','showSpine'])$(id).onchange=()=>attempt(()=>{options();animation=$('animation').value;skin=$('skin').value||scene.asset?.defaultSkin||'';seek(seconds);});
 $('play').onclick=()=>attempt(()=>{if(!playing&&seconds>=(U.frameCount(cfg)-1)/60)seek(0);play(!playing);});$('reset').onclick=()=>{play(false);attempt(()=>seek(0));};$('frame').oninput=()=>{play(false);attempt(()=>seek(Number($('frame').value)/60));};
 $('layer').onchange=()=>{controls();palette();handle();};$('curveKey').onchange=curve;$('apply').onclick=()=>attempt(()=>{change(JSON.parse($('preset').value));refresh();});$('defaults').onclick=()=>attempt(()=>{change(initial());refresh();});
 const h=$('handle');
 h.onpointerdown=e=>{if(busy||!scene||e.button!==0)return;play(false);const p=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect()),o=U.origin(currentPose(),U.layer(cfg,selected()));if(!o)return;h.setPointerCapture(e.pointerId);drag={id:e.pointerId,layer:selected(),dx:o.x-p.x,dy:o.y-p.y};};
 h.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||busy||drag.layer!==selected())return;attempt(()=>{const p=U.pointer(e.clientX,e.clientY,$('surface').getBoundingClientRect()),o=U.offset(currentPose(),p.x+drag.dx,p.y+drag.dy);if(o)edit(c=>Object.assign(U.layer(c,selected()),o),false);});};
 h.onpointerup=h.onpointercancel=h.onlostpointercapture=()=>{drag=null;if(scene&&!closed)controls();};
 h.onkeydown=e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!keys[e.key]||busy||!scene)return;e.preventDefault();play(false);attempt(()=>{const p=currentPose(),o=U.origin(p,U.layer(cfg,selected())),[x,y]=keys[e.key],step=e.shiftKey?10:1;if(o)edit(c=>Object.assign(U.layer(c,selected()),U.offset(p,o.x+x*step,o.y+y*step)));});};
 function tick(now){if(closed)return;if(playing&&!busy&&scene){if(previous!==null)attempt(()=>{seek(U.advance(seconds,(now-previous)/1000,cfg));if(seconds>=(U.frameCount(cfg)-1)/60)play(false);});if(playing)previous=now;}raf=requestAnimationFrame(tick);}
 window.addEventListener('pagehide',()=>{closed=true;play(false);cancelAnimationFrame(raf);destroy(scene);scene=null;},{once:true});raf=requestAnimationFrame(tick);rebuild('webgl2');
})();
