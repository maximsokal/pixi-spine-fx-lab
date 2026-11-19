// FX-CORE-03: pure bounded emitter/layer data and absolute-time particle generation.
(function (root, factory) {
  'use strict';
  const api=Object.freeze(factory(root.FxCurves||
    (typeof require==='function'?require('./curve-core.js'):null)));
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FxEmitters=api;
})(globalThis, function (Curves) {
  'use strict';
  const VERSION=1, MAX_EMITTERS=16, MAX_LAYERS=64, MAX_BUDGET=1400;
  const LAYER_TYPES=Object.freeze(['glow','rays','smoke','debris','sparks','trails','postprocess']);
  const BLENDS=['normal','add','multiply','screen'];
  const PLACEMENTS=['behind','front','slot'];
  const ANCHORS=['world','local','skeleton','bone','slot','attachment'];
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const fail=s=>{throw new TypeError('Invalid FX emitters: '+s);};
  function num(n,label,lo,hi){if(!finite(n)||n<lo||n>hi)fail(label+' must be finite in '+lo+'..'+hi);return n;}
  function integer(n,label,lo,hi){num(n,label,lo,hi);if(!Number.isInteger(n))fail(label+' must be integer');return n;}
  function str(v,label,max=64){if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+' must be nonempty text');return v;}
  function id(v,label){if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v))fail(label+' requires stable ID');return v;}
  function keys(obj,names,label){
    if(!obj||typeof obj!=='object'||Array.isArray(obj))fail(label+' must be object');
    for(const key of Object.keys(obj))if(!names.includes(key))fail('unknown '+label+' key: '+key);
  }
  const hash=text=>{let h=2166136261>>>0;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
  function random(seed,index,channel){
    let s=((seed|0)^Math.imul(index+1,0x9e3779b1)^hash(channel))>>>0;
    s=(s+0x6d2b79f5)>>>0;
    let n=Math.imul(s^s>>>15,1|s);
    n^=n+Math.imul(n^n>>>7,61|n);
    return ((n^n>>>14)>>>0)/4294967296;
  }
  const DEFAULTS={glow:['#ff7925',1,44,3],rays:['#ffda76',.85,85,12],
    smoke:['#777684',.65,28,12],debris:['#ff8c36',.9,16,20],
    sparks:['#ffd392',1,60,30],trails:['#ffbb60',.9,65,20],
    postprocess:['#ffa253',.65,75,1]};
  function newLayer(type,emitterId,order=0){
    if(!LAYER_TYPES.includes(type))fail('unknown layer type '+type);
    const [color,opacity,radius,count]=DEFAULTS[type];
    return {id:emitterId+'_'+type,name:type[0].toUpperCase()+type.slice(1),
      type,enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,
      order,blend:type==='smoke'||type==='debris'?'normal':'add',
      color,opacity,radius,count,budget:count};
  }
  function newEmitter(i=0) {
    const eid='emitter'+(i+1);
    return {id:eid,name:'Emitter '+(i+1),enabled:true,visible:true,
      x:i*110-55,y:0,space:'local',anchor:{type:'skeleton',name:''},
      rotation:0,scale:1,duration:3,timeOffset:0,seed:419+i*997,
      order:i,placement:'front',fallback:'hide',blend:'normal',budget:160,
      layers:LAYER_TYPES.map((type,index)=>newLayer(type,eid,index))};
  }
  function makeExplosionPreset(){
    return normalize({schemaVersion:1,enabled:false,globalBudget:600,
      emitters:[newEmitter(0),newEmitter(1)]});
  }
  function normalize(input){
    keys(input,['schemaVersion','enabled','globalBudget','emitters'],'document');
    if(input.schemaVersion!==VERSION)fail('unsupported schemaVersion');
    if(typeof input.enabled!=='boolean')fail('document enabled must be boolean');
    const globalBudget=integer(input.globalBudget,'globalBudget',0,MAX_BUDGET);
    if(!Array.isArray(input.emitters)||input.emitters.length>MAX_EMITTERS)
      fail('maximum 16 emitters');
    const allIds=new Set(),layerIds=new Set();let layerCount=0;
    const emitters=input.emitters.map(e=>{
      keys(e,['id','name','enabled','visible','x','y','space','anchor',
        'rotation','scale','duration','timeOffset','seed','order',
        'placement','fallback','blend','budget','layers','timeCurve'],'emitter');
      const eid=id(e.id,'emitter id');
      if(allIds.has(eid))fail('duplicate emitter ID '+eid);allIds.add(eid);
      if(typeof e.enabled!=='boolean'||typeof e.visible!=='boolean')fail('emitter enabled/visible must be boolean');
      if(!['world','local'].includes(e.space))fail('space must be world or local');
      keys(e.anchor,['type','name','slot'],'anchor');
      if(!ANCHORS.includes(e.anchor.type))fail('invalid anchor type');
      const anchor={type:e.anchor.type,name:e.anchor.name??''};
      if(e.anchor.type==='bone'||e.anchor.type==='slot'||e.anchor.type==='attachment'){
        str(anchor.name,'anchor name',128);
      }
      if(e.anchor.type==='attachment')anchor.slot=str(e.anchor.slot,'attachment slot',128);
      if(e.placement==='slot'&&e.anchor.type!=='slot'&&e.anchor.type!=='attachment')
        fail('slot placement requires a slot/attachment anchor');
      if(!PLACEMENTS.includes(e.placement))fail('invalid placement');
      if(!['hide','front'].includes(e.fallback))fail('fallback must be hide or front');
      if(!BLENDS.includes(e.blend))fail('invalid emitter blend');
      if(!Array.isArray(e.layers))fail('emitter layers required');
      const data={id:eid,name:str(e.name,'emitter name',96),enabled:e.enabled,visible:e.visible,
        x:num(e.x,'x',-16384,16384),y:num(e.y,'y',-16384,16384),space:e.space,
        anchor,rotation:num(e.rotation,'rotation',-3600,3600),
        scale:num(e.scale,'scale',.01,20),
        duration:num(e.duration,'duration',1/60,60),timeOffset:num(e.timeOffset,'timeOffset',-60,60),
        seed:integer(e.seed,'seed',-2147483648,2147483647),
        order:integer(e.order,'order',-1000,1000),
        placement:e.placement,fallback:e.fallback,blend:e.blend,budget:integer(e.budget,'emitter budget',0,MAX_BUDGET),layers:[]};
      if(e.timeCurve!=null){
        if(!Curves)fail('FxCurves is required for timeCurve');
        const curve=Curves.normalize(e.timeCurve);
        if(curve.parameterKey!=='emitterProgress'||curve.domain!=='emitterTime'||
           curve.inputUnit!=='normalized-duration')fail('emitter timeCurve must use emitterProgress/emitterTime');
        data.timeCurve=curve;
      }
      data.layers=e.layers.map(l=>{
        layerCount++;if(layerCount>MAX_LAYERS)fail('maximum 64 layers');
        keys(l,['id','name','type','enabled','visible','x','y','rotation','scale',
          'order','blend','color','opacity','radius','count','budget'],'layer');
        const lid=id(l.id,'layer id');
        if(layerIds.has(lid))fail('duplicate layer ID '+lid);layerIds.add(lid);
        if(!LAYER_TYPES.includes(l.type))fail('unknown layer type');
        if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean')fail('layer toggle must be boolean');
        if(!BLENDS.includes(l.blend))fail('invalid layer blend');
        if(typeof l.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(l.color))fail('color must be #RRGGBB');
        return {id:lid,name:str(l.name,'layer name',96),type:l.type,
          enabled:l.enabled,visible:l.visible,
          x:num(l.x,'layer x',-16384,16384),y:num(l.y,'layer y',-16384,16384),
          rotation:num(l.rotation,'layer rotation',-3600,3600),
          scale:num(l.scale,'layer scale',.01,20),
          order:integer(l.order,'layer order',-1000,1000),
          blend:l.blend,color:l.color,opacity:num(l.opacity,'layer opacity',0,1),
          radius:num(l.radius,'radius',.5,1024),count:integer(l.count,'count',1,128),
          budget:integer(l.budget,'layer budget',0,MAX_BUDGET)};
      });
      return data;
    });
    return {schemaVersion:VERSION,enabled:input.enabled,globalBudget,emitters};
  }
  function serialize(document){return JSON.stringify(normalize(document));}
  function deserialize(text){let doc;try{doc=JSON.parse(text)}catch{fail('invalid JSON')}return normalize(doc);}
  function sample(input,absoluteTime) {
    const doc=normalize(input);num(absoluteTime,'absoluteTime',0,1000000);
    const layers=[];let totalCost=0;
    if(!doc.enabled)return {time:absoluteTime,layers,cost:0,diagnostics:[]};
    const emitterOrder=[...doc.emitters].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
    for(const e of emitterOrder){
      if(!e.enabled||!e.visible||e.budget<=0)continue;
      const elapsed=absoluteTime-e.timeOffset;
      if(elapsed<0||elapsed>=e.duration)continue;
      let u=elapsed/e.duration;
      if(e.timeCurve)u=clamp(Curves.evaluate(e.timeCurve,u),0,1);
      let emitterCost=0;
      for(const l of [...e.layers].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))){
        if(!l.enabled||!l.visible||l.opacity===0||l.budget===0)continue;
        const available=Math.min(doc.globalBudget-totalCost,e.budget-emitterCost,l.budget);
        if(available<=0)continue;
        const primitives=primitivesFor(e,l,u,available);
        if(!primitives.length)continue;
        const item={id:l.id,emitterId:e.id,emitter:e,layer:l,type:l.type,
          placement:e.placement,blend:l.blend,primitives,cost:primitives.length,
          order:e.order*100+l.order};
        layers.push(item);
        emitterCost+=primitives.length;totalCost+=primitives.length;
      }
    }
    return {time:absoluteTime,layers,cost:totalCost,diagnostics:[]};
  }
  function primitivesFor(e,l,u,max) {
    const result=[],put=v=>{if(result.length<max)result.push(v)};
    const seed=(e.seed^hash(l.id))|0;
    const rad=Math.PI/180,fade=Math.pow(1-u,1.3),R=l.radius;
    const opacity=l.opacity;
    const origin=(n,axis)=>random(seed,n,axis);
    // Values are in each layer's local coordinate system; the renderer owns transforms.
    if(l.type==='glow'){put({shape:'circle',x:0,y:0,radius:R*(.35+1.15*u),alpha:fade*opacity});}
    if(l.type==='postprocess'){
      put({shape:'ring',x:0,y:0,radius:R*(.2+1.4*u),width:Math.max(1,6*(1-u)),
        alpha:fade*opacity});
    }
    if(l.type==='rays')for(let i=0;i<l.count&&result.length<max;i++){
      const a=2*Math.PI*(i+origin(i,'a')*.3)/l.count;
      const r=R*(.35+u*(.55+.4*origin(i,'r')));
      put({shape:'line',x1:Math.cos(a)*r*.08,y1:Math.sin(a)*r*.08,
        x2:Math.cos(a)*r,y2:Math.sin(a)*r,
        width:Math.max(.5,2.8*(1-u)),alpha:fade*opacity});
    }
    if(l.type==='smoke')for(let i=0;i<l.count&&result.length<max;i++){
      const born=origin(i,'time')*.6,age=clamp((u-born)/.8,0,1);
      if(u<born)continue;
      const angle=2*Math.PI*origin(i,'a');
      const r=R*(.3+.6*origin(i,'r'));
      put({shape:'circle',x:Math.cos(angle)*r*age+age*7,
        y:Math.sin(angle)*r*age-age*R*.6,
        radius:(4+R*.16*(.25+age))*(.7+origin(i,'size')),alpha:opacity*(1-age)*.65});
    }
    if(l.type==='debris')for(let i=0;i<l.count&&result.length<max;i++){
      const angle=2*Math.PI*origin(i,'angle'),speed=R*(.4+origin(i,'speed'));
      const age=u;
      const radius=speed*age;
      const size=(1+origin(i,'size')*3.7)*(1-.5*age);
      put({shape:'rect',x:Math.cos(angle)*radius,y:Math.sin(angle)*radius+18*age*age,
        w:size,h:size*(.7+origin(i,'ar')),rotation:angle+age*8,
        alpha:fade*opacity});
    }
    if(l.type==='sparks'||l.type==='trails'){
      for(let i=0;i<l.count&&result.length<max;i++){
        const born=origin(i,'born')*.55,age=clamp((u-born)/.7,0,1);
        if(u<born)continue;
        const angle=2*Math.PI*origin(i,'a'),speed=R*(.35+origin(i,'speed')*.8);
        const x=Math.cos(angle)*speed*age,y=Math.sin(angle)*speed*age+R*.2*age*age;
        const alpha=opacity*(1-age);
        if(l.type==='sparks')put({shape:'circle',x,y,radius:1.2+2.2*origin(i,'size'),alpha});
        else put({shape:'line',x1:x,y1:y,x2:x-Math.cos(angle)*Math.max(2,7*age),
          y2:y-Math.sin(angle)*Math.max(2,7*age),width:1+origin(i,'width'),alpha});
      }
    }
    return result;
  }
  return {VERSION,MAX_EMITTERS,MAX_LAYERS,LAYER_TYPES,normalize,serialize,deserialize,
    makeExplosionPreset,newEmitter,newLayer,sample};
});
