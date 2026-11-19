// FX-CORE-02: optional spacing authoring panel, independent of the pure math.
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},text='')=>{
  const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
  if(text)n.textContent=text;return n;
};
function curvePreset(key,unit,lo,hi,value,domain){
  return FxCurves.normalize({schemaVersion:1,parameterKey:key,domain,
    inputUnit:domain==='pathPosition'?'normalized-path':'normalized-duration',
    valueUnit:unit,inputRange:[0,1],valueRange:[lo,hi],defaultValue:value,
    clamp:'hold',monotonic:false,keys:[{id:'start',x:0,y:value,mode:'linear'},
    {id:'end',x:1,y:value,mode:'linear'}]});
}
function mount(container,{cfg,onChange,isLocked,getFrameCount}){
 const details=el('details',{id:'fxSpacingPanel'});
 details.append(el('summary',{},'Temporal & spatial spacing'));
 const body=el('div',{class:'section fx-spacing-body'});
 const help=el('p',{class:'mini'},'Optional path-based sparks. Temporal schedule and path spacing are independent; spark travel speed is unchanged. Guide lines are preview-only.');
 body.append(help);
 const status=el('output',{id:'fxSpacingStatus',role:'status','aria-live':'polite'});
 const inputs={};
 const controlId=key=>'fxSpacing'+(key.startsWith('spacing')?key.slice(7):key[0].toUpperCase()+key.slice(1));
 function select(key,label,values){
   const wrap=el('label',{class:'fx-spacing-field'},label);
   const input=el('select',{id:controlId(key)});
   for(const [value,name]of values)input.append(el('option',{value},name));
   wrap.append(input);body.append(wrap);inputs[key]=input;
   input.value=String(cfg[key]);
   input.addEventListener('change',()=>change(key,input.value));
   return input;
 }
 function numeric(key,label,min,max,step){
   const wrap=el('label',{class:'fx-spacing-field'},label);
   const input=el('input',{type:'number',id:controlId(key),min,max,step});
   input.value=String(cfg[key]);wrap.append(input);body.append(wrap);inputs[key]=input;
   input.addEventListener('change',()=>{
     const raw=input.value.trim(),value=Number(raw);
     if(!raw||!Number.isFinite(value)||value<min||value>max){
       input.value=String(cfg[key]);status.textContent='Invalid '+label+'; expected '+min+'–'+max;return;
     }
     change(key,value);
   });
   return input;
 }
 function toggle(key,label){
   const wrap=el('label',{class:'fx-spacing-check'});
   const input=el('input',{type:'checkbox',id:controlId(key)});
   input.checked=Boolean(cfg[key]);wrap.append(input,document.createTextNode(label));
   body.append(wrap);inputs[key]=input;
   input.addEventListener('change',()=>change(key,input.checked));
   return input;
 }
 function apply(){
   // Validate proposed settings before notifying the renderer.
   const t=FxSpacing.createTemporalSchedule({schemaVersion:1,mode:cfg.spacingTemporalMode,
     frequencySource:cfg.spacingFrequencySource,baseRate:cfg.spacingBaseRate,interval:cfg.spacingInterval,
     duration:getFrameCount()/60,minInterval:cfg.spacingMinInterval,jitter:cfg.spacingTimeJitter,
     burstCount:cfg.spacingBurstCount,burstDelay:cfg.spacingBurstDelay,seed:cfg.spacingSeed,
     maxEvents:512,rateCurve:cfg.spacingRateCurve,intervalCurve:cfg.spacingIntervalCurve});
   const p=FxSpacing.createSpatialPlacement({path:cfg.spacingPath,mode:cfg.spacingSpatialMode,
     baseSpacingPx:cfg.spacingBasePx,minSpacing:cfg.spacingMinPx,maxSpacing:cfg.spacingMaxPx,
     jitter:cfg.spacingSpatialJitter,seed:cfg.spacingSeed,maxPoints:512,
     spacingCurve:cfg.spacingDistanceCurve,alignToTangent:cfg.spacingAlignToTangent,
     pathFollow:cfg.spacingPathFollow});
   onChange();
   status.textContent='Time events: '+t.events.length+' · Path anchors: '+p.points.length+
     (t.capped||p.capped?' · capped to quality budget':'');
 }
 function change(key,value){
   if(isLocked?.()){refresh();status.textContent='Wait for baking/loading to finish.';return;}
   const original=cfg[key];
   cfg[key]=value;
   try{apply();}catch(e){cfg[key]=original;refresh();status.textContent=e.message;}
 }
 toggle('spacingEnabled','Enable path-based emission (legacy Spine surface stays the default)');
 select('spacingCombine','Schedule policy',[['time','Time events on path anchors'],['distance','Distance travelled'],['both','Time AND distance']]);
 select('spacingFrequencySource','Frequency source',[['rate','Events / second'],['interval','Seconds / event']]);
 numeric('spacingBaseRate','Base rate (events/s)',0,400,1);
 numeric('spacingInterval','Base interval (s)',.0001,60,.001);
 select('spacingTemporalMode','Temporal distribution',[
   ['uniform','Uniform'],['accelerating','Accelerating'],['decelerating','Decelerating'],
   ['burst','Burst'],['clustered','Clustered'],['custom','Custom rate / interval curve']]);
 numeric('spacingBurstCount','Burst count',1,24,1);
 numeric('spacingBurstDelay','Burst delay (s)',0,2,.005);
 numeric('spacingMinInterval','Minimum event interval (s)',0,2,.001);
 numeric('spacingTimeJitter','Seeded time jitter (0–0.45)',0,.45,.01);
 const sectionTitle=el('div',{class:'fx-spacing-subtitle'},'Path & spatial placement');
 body.append(sectionTitle);
 select('spacingSpatialMode','Spatial distribution',[['even','Even arc length'],['random','Random'],['stratified','Stratified'],['clustered','Clustered']]);
 numeric('spacingBasePx','Base spacing (px)',.25,500,1);
 numeric('spacingMinPx','Minimum spacing (px)',.25,500,1);
 numeric('spacingMaxPx','Maximum spacing (px)',.25,1000,1);
 numeric('spacingSpatialJitter','Seeded spacing jitter (0–0.45)',0,.45,.01);
 numeric('spacingTravelSpeedPx','Emitter path travel (px/s)',0,1000,1);
 numeric('spacingTeleportThresholdPx','Teleport threshold (px)',0,2048,1);
 numeric('spacingSeed','Independent spacing seed',0,2147483647,1);
 select('spacingPathFollow','Path follow',[['clamp','Stop at path end'],['wrap','Wrap'],['mirror','Reverse at ends']]);
 toggle('spacingAlignToTangent','Align particle launch to path tangent');
 toggle('spacingGuides','Show path and placement guides (preview only)');
 toggle('sparkTrails','Show spark trails (all modes)');
 const pathHeader=el('div',{class:'fx-spacing-subtitle'},'Cubic Bézier path · authoring pixels / 512 × 512');
 body.append(pathHeader);
 const pathGrid=el('div',{class:'fx-spacing-grid'});
 const pointNames=['Start','Handle 1','Handle 2','End'];
 for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++){
   const name=pointNames[i]+' '+(axis?'Y':'X'),label=el('label',{class:'fx-spacing-field'},name);
   const input=el('input',{type:'number',id:'fxSpacingPath'+i+(axis?'Y':'X'),
     min:-8192,max:8192,step:1});
   input.value=String(cfg.spacingPath.segments[0][['p0','p1','p2','p3'][i]][axis]);
   label.append(input);pathGrid.append(label);
   input.addEventListener('change',()=>{
     if(isLocked?.()){refresh();return;}
     const value=Number(input.value);
     if(!input.value.trim()||!Number.isFinite(value)||value< -8192||value>8192){
       status.textContent='Path coordinates must be within ±8192';refresh();return;
     }
     const previous=cfg.spacingPath;
     const segments=previous.segments.map(s=>({p0:[...s.p0],p1:[...s.p1],p2:[...s.p2],p3:[...s.p3]}));
     segments[0][['p0','p1','p2','p3'][i]][axis]=value;
     cfg.spacingPath={schemaVersion:1,closed:previous.closed,segments};
     try{apply();}catch(e){cfg.spacingPath=previous;refresh();status.textContent=e.message;}
   });
 }
 body.append(pathGrid);
 const closed=el('label',{class:'fx-spacing-check'}),closedInput=el('input',{type:'checkbox',id:'fxSpacingClosed'});
 closedInput.checked=cfg.spacingPath.closed;
 closed.append(closedInput,document.createTextNode('Close path (without duplicate seam events)'));
 body.append(closed);
 closedInput.addEventListener('change',()=>{
   const before=cfg.spacingPath;
   cfg.spacingPath={...before,closed:closedInput.checked};
   try{apply();}catch(e){cfg.spacingPath=before;refresh();status.textContent=e.message;}
 });
 const curvesTitle=el('div',{class:'fx-spacing-subtitle'},'Optional frequency / distance curve');
 body.append(curvesTitle);
 const curveType=el('select',{id:'fxSpacingCurveTarget','aria-label':'Curve to edit'});
 for(const [key,label]of [['rate','Rate multiplier'],['interval','Interval multiplier'],['spacing','Spacing in pixels']])
   curveType.append(el('option',{value:key},label));
 body.append(curveType);
 const host=el('div',{id:'fxSpacingCurveRoot'});
 body.append(host);
 let active='rate',editor=null;
 function keyFor(which){return which==='rate'?'spacingRateCurve':which==='interval'?'spacingIntervalCurve':'spacingDistanceCurve';}
 function modelFor(which){
   const key=keyFor(which);
   if(cfg[key])return FxCurves.normalize(cfg[key]);
   if(which==='rate')return curvePreset('emissionRate','normalized',.05,4,1,'emitterTime');
   if(which==='interval')return curvePreset('emissionInterval','normalized',.05,4,1,'emitterTime');
   return curvePreset('spacingPx','px',.25,1000,cfg.spacingBasePx,'pathPosition');
 }
 editor=FxCurveEditor.mount(host,{idPrefix:'fxSpacingCurve',curve:modelFor(active),
   getFrameCount:()=>getFrameCount(),isLocked,
   onChange(value) {
     const key=keyFor(active),old=cfg[key],oldMode=cfg.spacingTemporalMode;
     cfg[key]=FxCurves.normalize(value);
     if(active!=='spacing')cfg.spacingTemporalMode='custom';
     inputs.spacingTemporalMode.value=cfg.spacingTemporalMode;
     try{apply();}catch(e){cfg[key]=old;cfg.spacingTemporalMode=oldMode;inputs.spacingTemporalMode.value=oldMode;status.textContent=e.message;}
   },
   onScrub(){/* No preview time seek for a generic spacing-value curve. */}
 });
 curveType.addEventListener('change',()=>{
   active=curveType.value;
   editor.setCurve(modelFor(active));
   status.textContent='Editing '+active+' curve; changes are stored in the spacing preset.';
 });
 function refresh(){
   for(const [key,input]of Object.entries(inputs)){
     if(input.type==='checkbox')input.checked=Boolean(cfg[key]);
     else input.value=String(cfg[key]);
   }
   for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++){
     const input=details.querySelector('#fxSpacingPath'+i+(axis?'Y':'X'));
     input.value=String(cfg.spacingPath.segments[0][['p0','p1','p2','p3'][i]][axis]);
   }
   closedInput.checked=cfg.spacingPath.closed;
   editor.setCurve(modelFor(active));
 }
 const styles=el('style',{id:'fxSpacingStyles'});
 styles.textContent='.fx-spacing-body{display:grid;gap:8px}'+
 '.fx-spacing-field{display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:12px;color:#b8c3cd}'+
 '.fx-spacing-field>input,.fx-spacing-field>select{max-width:145px;min-width:80px;box-sizing:border-box}'+
 '.fx-spacing-check{display:flex;gap:6px;align-items:center;font-size:12px}'+
 '.fx-spacing-subtitle{font-size:12px;font-weight:600;color:#ffd09e;margin-top:8px}'+
 '.fx-spacing-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
 '.fx-spacing-grid label{display:flex;flex-direction:column;align-items:stretch}'+
 '.fx-spacing-grid input{max-width:100%;width:100%}'+
 '#fxSpacingCurveRoot .fx-curve-editor{margin-top:6px}'+
 '#fxSpacingStatus{font-size:11px;color:#ffbb72;overflow-wrap:anywhere}';
 document.head.append(styles);
 body.append(status);details.append(body);container.append(details);
 try{apply();}catch(e){status.textContent=e.message;}
 return {refresh,details};
}
root.FxSpacingUi=Object.freeze({mount});
})(globalThis);
