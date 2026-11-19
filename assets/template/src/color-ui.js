// FX-CORE-04 — optional RGBA gradient and lifetime-curve editing.
(function(root){
'use strict';
const Colors=root.FxColors,Curves=root.FxCurves;
const make=(tag,attrs={},text='')=>{
 const n=document.createElement(tag);
 for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
 if(text)n.textContent=text;
 return n;
};
function mount(host,{value,kind='gradient',idPrefix='fxColors',onChange,isLocked,defaultValue,color='#ffd392'}){
 let data=kind==='gradient'?Colors.normalize(value):Colors.normalizeLifetime(value);
 const initialDefault=defaultValue|| (kind==='gradient'?
   Colors.createPreset('natural',data.domain):Colors.defaultLifetime(color));
 let selected=(kind==='gradient'?data:data.colorOverLife).stops[0].id,serial=0,curveEditor=null;
 const details=make('details',{id:idPrefix+'Panel',class:'fx-color-panel'});
 const title=make('summary',{},kind==='gradient'?'RGBA gradient palette':'Particle color & lifetime curves');
 const body=make('div',{class:'fx-color-body'});
 const message=make('output',{id:idPrefix+'Status',role:'status','aria-live':'polite'});
 details.append(title,body);host.append(details);
 const stylesId='fxColorStyles';
 if(!document.getElementById(stylesId)){
  const style=make('style',{id:stylesId});
  style.textContent='.fx-color-body{display:grid;gap:8px;padding:7px 0}' +
   '.fx-color-row{display:flex;align-items:center;justify-content:space-between;gap:7px;font-size:12px;flex-wrap:wrap}' +
   '.fx-color-row input,.fx-color-row select{max-width:160px;min-width:0}' +
   '.fx-color-actions{display:flex;align-items:center;flex-wrap:wrap;gap:5px}' +
   '.fx-color-actions button{font-size:11px;padding:5px 8px}' +
   '.fx-color-ramp{width:100%;height:25px;border:1px solid #546171;border-radius:4px}' +
   '.fx-color-preview{border:1px solid #546171;border-radius:4px;min-width:30px;height:22px}' +
   '.fx-color-body output{font-size:11px;color:#ffba79;overflow-wrap:anywhere}';
  document.head.append(style);
 }
 const clone=o=>JSON.parse(JSON.stringify(o));
 const gradient=()=>kind==='gradient'?data:data.colorOverLife;
 function commit(next,description='Updated gradient'){
  if(isLocked?.()){message.textContent='Finish baking/loading first.';return false;}
  try {
   const normalized=kind==='gradient'?Colors.normalize(next):Colors.normalizeLifetime(next);
   onChange(normalized);
   data=normalized;
   if(!gradient().stops.some(s=>s.id===selected))selected=gradient().stops[0].id;
   render();message.textContent=description;return true;
  }catch(e){message.textContent=e.message;return false;}
 }
 function updateGradient(fn,description){
  const next=clone(data),g=kind==='gradient'?next:next.colorOverLife;
  fn(g);
  return commit(next,description);
 }
 function current(){return gradient().stops.find(s=>s.id===selected)||gradient().stops[0];}
 function row(label,control){
  const wrapper=make('label',{class:'fx-color-row'});
  wrapper.append(make('span',{},label),control);return wrapper;
 }
 function button(id,label,onClick){
  const b=make('button',{type:'button',id},label);b.onclick=onClick;return b;
 }
 function select(id,options,value,onChangeValue){
  const sel=make('select',{id});
  for(const [v,label]of options)sel.append(make('option',{value:v},label));
  sel.value=value;sel.addEventListener('change',()=>onChangeValue(sel.value));
  return sel;
 }
 function render(){
  const wasOpen=details.open;
  body.replaceChildren();
  if(kind==='lifetime'){
   const enabled=make('input',{id:idPrefix+'Enabled',type:'checkbox'});
   enabled.checked=data.enabled;
   enabled.addEventListener('change',()=>{
    const next=clone(data);next.enabled=enabled.checked;commit(next,'Lifetime '+(enabled.checked?'enabled':'disabled'));
   });
   body.append(row('Enable authored lifetime modulation',enabled));
  }
  const grad=gradient();
  const palette=select(idPrefix+'Preset',[['natural','Natural'],['stylized','Stylized'],['magical','Magical']],
   'natural',name=>updateGradient(g=>{
      const preset=Colors.createPreset(name,g.domain);
      Object.assign(g,preset);selected=preset.stops[0].id;
   },'Palette: '+name));
  body.append(row('Palette starting point',palette));
  const space=select(idPrefix+'Space',[['srgb','sRGB'],['linear-rgb','Linear RGB']],grad.space,
   val=>updateGradient(g=>{g.space=val;},'Interpolation: '+val));
  body.append(row('Blend RGB in',space));
  const ramp=make('div',{class:'fx-color-ramp',id:idPrefix+'Ramp'});
  const sorted=grad.stops;
  const stops=sorted.map(s=>{const p=s.rgba;return 'rgba('+p.slice(0,3).map(n=>Math.round(n)).join(',')+','+p[3]+') '+(s.position*100)+'%';});
  // Preview is indicative only; the canonical sample evaluator may use linear-RGB.
  ramp.style.background='linear-gradient(to right, '+(stops.length===1?stops[0]+','+stops[0]:stops.join(','))+')';
  body.append(ramp);
  const stopList=select(idPrefix+'Stop',grad.stops.map(s=>[s.id,s.id+' @ '+Math.round(s.position*1000)/10+'%']),
    selected,val=>{selected=val;render();});
  body.append(row('Selected RGBA stop',stopList));
  const selectedStop=current();
  const position=make('input',{type:'number',id:idPrefix+'Position',min:0,max:1,step:.001});
  position.value=String(selectedStop.position);
  position.addEventListener('change',()=>{
   const number=Number(position.value);
   if(!position.value.trim()||!Number.isFinite(number)){message.textContent='Position must be finite.';return;}
   updateGradient(g=>{
    const key=g.stops.find(s=>s.id===selected);key.position=number;
    g.stops.sort((a,b)=>a.position-b.position);
   },'Stop position updated');
  });
  body.append(row('Position (normalized 0–1)',position));
  const col=make('input',{type:'color',id:idPrefix+'Color'});
  col.value=Colors.hex(selectedStop.rgba);
  col.addEventListener('change',()=>updateGradient(g=>{
   const s=g.stops.find(s=>s.id===selected);
   s.rgba.splice(0,3,...[1,3,5].map(i=>parseInt(col.value.slice(i,i+2),16)));
  },'Stop RGB updated'));
  body.append(row('RGB color',col));
  const alpha=make('input',{type:'number',id:idPrefix+'Alpha',min:0,max:1,step:.01});
  alpha.value=String(selectedStop.rgba[3]);
  alpha.addEventListener('change',()=>{
   const number=Number(alpha.value);
   if(!alpha.value.trim()||!Number.isFinite(number)){message.textContent='Alpha must be finite.';return;}
   updateGradient(g=>{g.stops.find(s=>s.id===selected).rgba[3]=number;},'Stop alpha updated');
  });
  body.append(row('Stop alpha (0–1)',alpha));
  const preview=make('div',{class:'fx-color-preview',id:idPrefix+'Preview'});
  const px=Colors.sample(grad,selectedStop.position);
  preview.style.background='rgba('+px.slice(0,3).map(n=>Math.round(n)).join(',')+','+px[3]+')';
  body.append(row('Selected color',preview));
  const actions=make('div',{class:'fx-color-actions'});
  actions.append(
   button(idPrefix+'Add','Add stop',()=>{
    if(grad.stops.length>=8){message.textContent='Maximum 8 stops.';return;}
    const i=grad.stops.findIndex(s=>s.id===selected);
    const a=grad.stops[i],b=grad.stops[i+1],prev=grad.stops[i-1];
    const x=b?(a.position+b.position)/2:prev?(prev.position+a.position)/2:a.position<.5?(a.position+1)/2:a.position/2;
    updateGradient(g=>{
     let id;do{id='stop'+(++serial)}while(g.stops.some(s=>s.id===id));
     g.stops.push({id,position:x,rgba:Colors.sample(g,x)});
     g.stops.sort((a,b)=>a.position-b.position);
     selected=id;
    },'RGBA stop added');
   }),
   button(idPrefix+'Copy','Copy stop',()=>{
    if(grad.stops.length>=8)return;
    const i=grad.stops.findIndex(s=>s.id===selected);
    const a=grad.stops[i],b=grad.stops[i+1],prev=grad.stops[i-1];
    const pos=b?(a.position+b.position)/2:prev?(prev.position+a.position)/2:a.position<.5?.5:0;
    updateGradient(g=>{
      let id;do{id='stop'+(++serial)}while(g.stops.some(s=>s.id===id));
      g.stops.push({id,position:pos,rgba:[...a.rgba]});
      g.stops.sort((a,b)=>a.position-b.position);selected=id;
    },'RGBA stop copied');
   }),
   button(idPrefix+'Delete','Delete stop',()=>{
    if(grad.stops.length===1)return;
    updateGradient(g=>{g.stops=g.stops.filter(s=>s.id!==selected);selected=g.stops[0].id;},'RGBA stop deleted');
   }),
   button(idPrefix+'Reset','Reset',()=>{
    const next=clone(initialDefault);
    selected=(kind==='gradient'?next:next.colorOverLife).stops[0].id;
    commit(next,'Declared defaults restored');
   })
  );
  body.append(actions);
  if(kind==='lifetime'){
   const keySelect=select(idPrefix+'CurveTarget',[
    ['alphaOverLife','Alpha over life'],['sizeOverLife','Size over life'],
    ['glowOverLife','Glow over life'],['opacityOverLife','Opacity / fade over life']],
    'alphaOverLife',()=>{});
   const curveHost=make('div',{id:idPrefix+'Curve'});
   body.append(row('Edit particle-age curve',keySelect),curveHost);
   function mountCurve(key){
    curveHost.replaceChildren();
    curveEditor=FxCurveEditor.mount(curveHost,{curve:data[key],idPrefix:idPrefix+'Curve',
     isLocked,getFrameCount:()=>60,onScrub(){},
     onChange(curve){
       const next=clone(data);next[key]=Curves.normalize(curve);
       next.enabled=true;
       // Do not replace the active curve editor during a drag.
       try{onChange(Colors.normalizeLifetime(next));data=Colors.normalizeLifetime(next);message.textContent=key+' updated';}
       catch(e){message.textContent=e.message;}
     }});
   }
   keySelect.onchange=()=>mountCurve(keySelect.value);
   mountCurve('alphaOverLife');
  }
  body.append(message);
  details.open=wasOpen;
 }
 function refresh(next){
  data=kind==='gradient'?Colors.normalize(next):Colors.normalizeLifetime(next);
  if(!gradient().stops.some(s=>s.id===selected))selected=gradient().stops[0].id;
  render();
 }
 render();
 return {refresh,getValue:()=>clone(data),details};
}
root.FxColorUi=Object.freeze({mount});
})(globalThis);
