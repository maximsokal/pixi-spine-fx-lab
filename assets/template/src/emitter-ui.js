// FX-CORE-03 — optional, specialized emitter/layer authoring UI.
(function(root){
'use strict';
const E=root.FxEmitters;
const node=(tag,attrs={},text='')=>{
  const n=document.createElement(tag);
  for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
  if(text)n.textContent=text;
  return n;
};
function mount(parent,{value,onChange,isLocked,onSelect,diagnostics}) {
  let doc=E.normalize(value),selected=doc.emitters[0]?.id||null,selectedLayer=null;
  let counter=0,internalError='';
  const panel=node('details',{id:'fxEmitterPanel'});
  const summary=node('summary',{},'Independent emitters & layers');
  const body=node('div',{class:'section fx-emitter-body'});
  const help=node('p',{class:'mini'},'Optional layered explosion. Every emitter/layer can move or hide independently. Drag colored viewport handles or enter precise numbers. Missing Spine anchors hide the layer with a warning.');
  const controls=node('div',{id:'fxEmitterControls'});
  const status=node('output',{id:'fxEmitterStatus',role:'status','aria-live':'polite'});
  body.append(help,controls,status);panel.append(summary,body);parent.append(panel);
  const styles=node('style',{id:'fxEmitterStyles'});
  styles.textContent='.fx-emitter-body{display:grid;gap:8px}.fx-emitter-body .fx-emitter-row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:4px 0;font-size:12px}' +
    '.fx-emitter-body input[type=number],.fx-emitter-body input[type=text],.fx-emitter-body select{min-width:0;max-width:160px;box-sizing:border-box}' +
    '.fx-emitter-body .fx-emitter-actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}' +
    '.fx-emitter-body .fx-emitter-actions button{font-size:11px;padding:5px 7px}' +
    '.fx-emitter-body .fx-emitter-layer{padding-top:8px;border-top:1px solid #434e60}' +
    '.fx-emitter-body .fx-emitter-tip{font-size:11px;color:#97a9b9}' +
    '#fxEmitterStatus{font-size:11px;color:#ffbd80;overflow-wrap:anywhere}';
  document.head.append(styles);
  const clone=()=>E.deserialize(E.serialize(doc));
  const unique=(prefix,ids)=>{let v;do{v=prefix+(++counter)}while(ids.has(v));return v;};
  const activeEmitter=()=>doc.emitters.find(e=>e.id===selected);
  const activeLayer=()=>activeEmitter()?.layers.find(l=>l.id===selectedLayer);
  function commit(changed,reason='Updated'){
    if(isLocked?.()){status.textContent='Finish baking/loading before changing emitters.';return false;}
    try{const next=E.normalize(changed);doc=next;onChange(next);
      internalError='';render();status.textContent=reason;return true;
    }catch(e){internalError=e.message;status.textContent=e.message;return false;}
  }
  function changeEmitter(field,value){
    const copy=clone(),target=copy.emitters.find(e=>e.id===selected);
    if(!target)return;
    target[field]=value;commit(copy,'Emitter updated: '+field);
  }
  function changeLayer(field,value){
    const copy=clone(),target=copy.emitters.find(e=>e.id===selected);
    const layer=target?.layers.find(l=>l.id===selectedLayer);
    if(!layer)return;
    layer[field]=value;commit(copy,'Layer updated: '+field);
  }
  function line(label,control){
    const wrap=node('label',{class:'fx-emitter-row'});
    const span=node('span',{},label);
    wrap.append(span,control);return wrap;
  }
  function select(id,options,value,onInput) {
    const input=node('select',{id});
    for(const [v,label]of options)input.append(node('option',{value:v},label));
    input.value=String(value);input.addEventListener('change',()=>onInput(input.value));
    return input;
  }
  function num(id,value,min,max,step,callback){
    const input=node('input',{type:'number',id,min,max,step});input.value=String(value);
    input.addEventListener('change',()=>{
      const v=Number(input.value);
      if(!input.value.trim()||!Number.isFinite(v)||v<min||v>max){
        status.textContent='Invalid '+id+'; expected '+min+'–'+max;input.value=String(value);return;
      }
      callback(v);
    });return input;
  }
  function txt(id,value,callback){
    const input=node('input',{type:'text',id,maxlength:96});input.value=value;
    input.addEventListener('change',()=>callback(input.value));return input;
  }
  function toggle(id,checked,callback){
    const input=node('input',{type:'checkbox',id});
    input.checked=checked;input.addEventListener('change',()=>callback(input.checked));return input;
  }
  function button(id,label,callback){
    const b=node('button',{type:'button',id},label);b.addEventListener('click',callback);return b;
  }
  function addEmitter(){
    const copy=clone();
    if(copy.emitters.length>=E.MAX_EMITTERS)return void(status.textContent='Maximum 16 emitters.');
    const instance=E.newEmitter(copy.emitters.length);
    instance.id=unique('emitter',new Set(copy.emitters.map(e=>e.id)));
    instance.name='Emitter '+(copy.emitters.length+1);
    for(const layer of instance.layers)layer.id=instance.id+'_'+layer.type;
    selected=instance.id;selectedLayer=instance.layers[0].id;
    copy.emitters.push(instance);commit(copy,'Emitter added');
  }
  function duplicateEmitter(){
    const copy=clone(),source=copy.emitters.find(e=>e.id===selected);
    if(!source||copy.emitters.length>=E.MAX_EMITTERS)return;
    const duplicated=JSON.parse(JSON.stringify(source));
    duplicated.id=unique('emitter',new Set(copy.emitters.map(e=>e.id)));
    duplicated.name=source.name+' copy';duplicated.x+=32;duplicated.seed++;
    duplicated.layers.forEach(l=>l.id=duplicated.id+'_'+l.type);
    selected=duplicated.id;selectedLayer=duplicated.layers[0]?.id||null;
    copy.emitters.push(duplicated);commit(copy,'Emitter duplicated with independent seed');
  }
  function deleteEmitter(){
    const copy=clone();copy.emitters=copy.emitters.filter(e=>e.id!==selected);
    selected=copy.emitters[0]?.id||null;selectedLayer=copy.emitters[0]?.layers[0]?.id||null;
    commit(copy,'Emitter deleted and owned layers disposed');
  }
  function addLayer(type){
    const copy=clone(),em=copy.emitters.find(e=>e.id===selected);
    if(!em||copy.emitters.reduce((n,e)=>n+e.layers.length,0)>=E.MAX_LAYERS)return;
    const layer=E.newLayer(type,em.id,em.layers.length);
    layer.id=unique('layer',new Set(copy.emitters.flatMap(e=>e.layers.map(l=>l.id))));
    selectedLayer=layer.id;em.layers.push(layer);commit(copy,'Layer added');
  }
  function deleteLayer(){
    const copy=clone(),em=copy.emitters.find(e=>e.id===selected);
    if(!em)return;
    em.layers=em.layers.filter(l=>l.id!==selectedLayer);
    selectedLayer=em.layers[0]?.id||null;commit(copy,'Layer removed');
  }
  function render() {
    controls.replaceChildren();
    const global=toggle('fxEmittersEnabled',doc.enabled,v=>commit({...clone(),enabled:v},'FX layers '+(v?'enabled':'disabled')));
    controls.append(line('Enable independent FX layers',global));
    controls.append(line('Whole-effect particle budget',
      num('fxEmittersGlobalBudget',doc.globalBudget,0,1400,1,v=>commit({...clone(),globalBudget:v}))));
    const actions=node('div',{class:'fx-emitter-actions'});
    actions.append(button('fxEmitterAdd','Add emitter',addEmitter),
      button('fxEmitterDuplicate','Duplicate',duplicateEmitter),
      button('fxEmitterDelete','Remove',deleteEmitter));
    controls.append(actions);
    if(!doc.emitters.length){status.textContent='No emitters. Add one to start.';return;}
    if(!activeEmitter())selected=doc.emitters[0].id;
    const emitter=activeEmitter();
    controls.append(line('Selected emitter',
      select('fxEmitterSelect',doc.emitters.map(e=>[e.id,e.name+' ('+e.id+')']),
        emitter.id,id=>{selected=id;selectedLayer=null;render();onSelect?.(selected,null);})));
    controls.append(line('Name',txt('fxEmitterName',emitter.name,v=>changeEmitter('name',v))));
    controls.append(line('Enabled',toggle('fxEmitterEnabled',emitter.enabled,v=>changeEmitter('enabled',v))));
    controls.append(line('Visible',toggle('fxEmitterVisible',emitter.visible,v=>changeEmitter('visible',v))));
    for(const [key,label,min,max,step]of [
      ['x','X (px)',-16384,16384,.01],['y','Y (px)',-16384,16384,.01],
      ['rotation','Rotation (°)',-3600,3600,.1],['scale','Scale',.01,20,.01],
      ['duration','Duration (s)',1/60,60,.01],['timeOffset','Time offset (s)',-60,60,.01],
      ['seed','Seed',-2147483648,2147483647,1],['order','Layer order',-1000,1000,1],
      ['budget','Emitter particle budget',0,1400,1]
    ])controls.append(line(label,num('fxEmitter'+key[0].toUpperCase()+key.slice(1),emitter[key],min,max,step,v=>changeEmitter(key,v))));
    controls.append(line('Coordinates',
      select('fxEmitterSpace',[['local','Spine/anchor local'],['world','Stage world']],emitter.space,v=>changeEmitter('space',v))));
    controls.append(line('Anchor type',
      select('fxEmitterAnchorType',[['world','World'],['skeleton','Skeleton origin'],
        ['bone','Spine bone'],['slot','Spine slot'],['attachment','Active attachment']],emitter.anchor.type,
        v=>changeAnchor({type:v,name: v==='bone'?'root':v==='slot'?'body':v==='attachment'?'body': '',
          ...(v==='attachment'?{slot:'body'}:{})}))));
    controls.append(line('Anchor name',
      txt('fxEmitterAnchorName',emitter.anchor.name,v=>changeAnchor({...emitter.anchor,name:v}))));
    if(emitter.anchor.type==='attachment')controls.append(line('Attachment slot',
      txt('fxEmitterAnchorSlot',emitter.anchor.slot||'',v=>changeAnchor({...emitter.anchor,slot:v}))));
    controls.append(line('Spine layering',
      select('fxEmitterPlacement',[['behind','Behind Spine'],['front','In front of Spine'],
        ['slot','Inside selected Spine slot']],emitter.placement,v=>changeEmitter('placement',v))));
    controls.append(line('Unsupported slot fallback',
      select('fxEmitterFallback',[['hide','Hide and report diagnostic'],['front','Explicit front fallback']],emitter.fallback,v=>changeEmitter('fallback',v))));
    controls.append(line('Blend',
      select('fxEmitterBlend',[['normal','Normal'],['add','Additive'],
        ['multiply','Multiply'],['screen','Screen']],emitter.blend,v=>changeEmitter('blend',v))));
    const layersTitle=node('div',{class:'fx-emitter-layer'});
    layersTitle.append(node('strong',{},'Independent effect layers'));
    const addLine=node('div',{class:'fx-emitter-actions'});
    const typeSelect=select('fxEmitterNewLayerType',E.LAYER_TYPES.map(type=>[type,type]),'sparks',()=>{});
    addLine.append(typeSelect,button('fxEmitterLayerAdd','Add layer',()=>addLayer(typeSelect.value)));
    layersTitle.append(addLine);
    const toggles=node('div',{class:'fx-emitter-toggles'});
    for(const layer of emitter.layers){
      const name=node('span',{},layer.name+' ('+layer.type+')');
      const chk=toggle('fxEmitterToggle_'+layer.id,layer.enabled,v=>{
        const copy=clone();copy.emitters.find(e=>e.id===selected).layers.find(l=>l.id===layer.id).enabled=v;
        commit(copy,layer.name+' '+(v?'on':'off'));
      });
      const wrap=node('label',{class:'fx-emitter-row'});wrap.append(name,chk);toggles.append(wrap);
    }
    layersTitle.append(toggles);controls.append(layersTitle);
    if(!emitter.layers.length){selectedLayer=null;status.textContent='No layers in this emitter.';return;}
    if(!activeLayer())selectedLayer=emitter.layers[0].id;
    const layer=activeLayer();
    controls.append(line('Edit layer',
      select('fxEmitterLayerSelect',emitter.layers.map(l=>[l.id,l.name+' ('+l.type+')']),
        layer.id,id=>{selectedLayer=id;render();onSelect?.(selected,id);})));
    controls.append(button('fxEmitterLayerDelete','Remove selected layer',deleteLayer));
    controls.append(line('Layer name',txt('fxEmitterLayerName',layer.name,v=>changeLayer('name',v))));
    controls.append(line('Layer visible',
      toggle('fxEmitterLayerVisible',layer.visible,v=>changeLayer('visible',v))));
    for(const [key,label,min,max,step]of [
      ['x','Layer X (px)',-16384,16384,.01],['y','Layer Y (px)',-16384,16384,.01],
      ['rotation','Layer rotation',-3600,3600,.1],['scale','Layer scale',.01,20,.01],
      ['order','Layer sort order',-1000,1000,1],['opacity','Opacity',0,1,.01],
      ['radius','Radius (px)',.5,1024,.1],['count','Particles / spokes',1,128,1],
      ['budget','Layer budget',0,1400,1]
    ])controls.append(line(label,num('fxEmitterLayer'+key[0].toUpperCase()+key.slice(1),
      layer[key],min,max,step,v=>changeLayer(key,v))));
    controls.append(line('Layer blend',
      select('fxEmitterLayerBlend',[['normal','Normal'],['add','Additive'],
        ['multiply','Multiply'],['screen','Screen']],layer.blend,v=>changeLayer('blend',v))));
    const color=node('input',{type:'color',id:'fxEmitterLayerColor'});
    color.value=layer.color;color.addEventListener('change',()=>changeLayer('color',color.value));
    controls.append(line('Layer color',color));
    const lifetimeHost=node('div',{class:'fx-emitter-lifetime'});
    controls.append(lifetimeHost);
    FxColorUi.mount(lifetimeHost,{idPrefix:'fxLayerLife',kind:'lifetime',
      value:layer.lifetime??FxColors.defaultLifetime(layer.color),
      color:layer.color,defaultValue:FxColors.defaultLifetime(layer.color),isLocked,
      onChange(value){changeLayer('lifetime',value);}});

    const issue=diagnostics?.()?.map(d=>d.emitterId+': '+d.message)||[];
    status.textContent=issue.length?issue.join(' · '):internalError;
  }
  function changeAnchor(anchor){
    const copy=clone(),em=copy.emitters.find(e=>e.id===selected);
    em.anchor=anchor;
    // An anchored slot layer is only meaningful on a slot/attachment anchor.
    if(em.placement==='slot'&&!['slot','attachment'].includes(anchor.type))em.placement='front';
    commit(copy,'Anchor updated');
  }
  function setFromScene(type,id,x,y){
    const copy=clone(),em=copy.emitters.find(e=>e.id===selected);
    if(!em)return false;
    if(type==='emitter'&&em.id===id){em.x=Number(x.toFixed(3));em.y=Number(y.toFixed(3));}
    else if(type==='layer'){
      const layer=em.layers.find(l=>l.id===id);if(!layer)return false;
      layer.x=Number(x.toFixed(3));layer.y=Number(y.toFixed(3));
    }else return false;
    return commit(copy,'Drag position updated');
  }
  function refresh(value){
    doc=E.normalize(value);
    if(!doc.emitters.some(e=>e.id===selected))selected=doc.emitters[0]?.id||null;
    render();
  }
  function getSelected(){return {emitterId:selected,layerId:selectedLayer};}
  render();
  return {refresh,getSelected,setFromScene,details:panel,
    get document(){return doc}};
}
root.FxEmitterUi=Object.freeze({mount});
})(globalThis);
