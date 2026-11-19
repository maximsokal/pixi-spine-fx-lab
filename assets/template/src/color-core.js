// FX-CORE-04: strict, renderer-free RGBA gradients and lifetime envelopes.
(function(root,factory){
  const result=Object.freeze(factory(root.FxCurves||(typeof require==='function'?require('./curve-core.js'):null)));
  if(typeof module==='object'&&module.exports)module.exports=result;else root.FxColors=result;
})(globalThis,function(Curves){
  'use strict';
  const VERSION=1,MAX_STOPS=8,DOMAINS=['particleAge','flameIntensity','effectTime'];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function fail(s){throw new TypeError('Invalid FX color: '+s);}
  function shape(o,keys,label){
    if(!o||typeof o!=='object'||Array.isArray(o))fail(label+' must be an object');
    for(const key of Object.keys(o))if(!keys.includes(key))fail('unknown '+label+' property '+key);
  }
  function normalize(input){
    shape(input,['schemaVersion','parameterKey','domain','inputUnit','space','clamp','stops'],'gradient');
    if(input.schemaVersion!==VERSION)fail('unsupported schemaVersion');
    if(typeof input.parameterKey!=='string'||!/^[a-zA-Z][\w.-]{0,79}$/.test(input.parameterKey))fail('invalid parameterKey');
    if(!DOMAINS.includes(input.domain))fail('invalid domain');
    const unit=input.domain==='particleAge'?'normalized-lifetime':input.domain==='effectTime'?'normalized-duration':'normalized-intensity';
    if(input.inputUnit!==unit)fail('inputUnit does not match domain');
    if(!['srgb','linear-rgb'].includes(input.space))fail('interpolation space must be srgb or linear-rgb');
    if(input.clamp!=='hold')fail('only hold clamp supported');
    if(!Array.isArray(input.stops)||input.stops.length<1||input.stops.length>MAX_STOPS)fail('gradient must have 1 to 8 stops');
    const ids=new Set();
    const stops=input.stops.map((stop,i)=>{
      shape(stop,['id','position','rgba'],'stop');
      if(typeof stop.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(stop.id)||ids.has(stop.id))fail('stop IDs must be unique stable identifiers');
      ids.add(stop.id);
      if(!finite(stop.position)||stop.position<0||stop.position>1)fail('stop position must be finite 0–1');
      if(i&&stop.position<=input.stops[i-1].position)fail('stop positions must be strictly increasing');
      if(!Array.isArray(stop.rgba)||stop.rgba.length!==4||stop.rgba.some((v,j)=>!finite(v)||v<0||v>(j===3?1:255)))fail('stop rgba must be finite RGB 0–255 and alpha 0–1');
      return {id:stop.id,position:stop.position,rgba:stop.rgba.slice()};
    });
    return {schemaVersion:VERSION,parameterKey:input.parameterKey,domain:input.domain,
      inputUnit:input.inputUnit,space:input.space,clamp:'hold',stops};
  }
  const toLinear=v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
  const toSrgb=v=>{const c=clamp(v,0,1);return 255*(c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055);};
  function sample(input,t){
    const grad=normalize(input);
    if(!finite(t))fail('sample position must be finite');
    const stops=grad.stops;
    if(stops.length===1||t<=stops[0].position)return stops[0].rgba.slice();
    if(t>=stops.at(-1).position)return stops.at(-1).rgba.slice();
    for(let i=1;i<stops.length;i++){
      const a=stops[i-1],b=stops[i];
      if(t>b.position)continue;
      const f=(t-a.position)/(b.position-a.position);
      const rgb=[0,1,2].map(n=>grad.space==='linear-rgb'?
        toSrgb(toLinear(a.rgba[n])+(toLinear(b.rgba[n])-toLinear(a.rgba[n]))*f):
        a.rgba[n]+(b.rgba[n]-a.rgba[n])*f);
      return [...rgb,a.rgba[3]+(b.rgba[3]-a.rgba[3])*f];
    }
    return stops.at(-1).rgba.slice();
  }
  const hex=rgba=>'#'+rgba.slice(0,3).map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('');
  const srgbByte=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  function defaultGradient(domain='particleAge',color='#ffd392'){
    const inputUnit=domain==='particleAge'?'normalized-lifetime':domain==='effectTime'?'normalized-duration':'normalized-intensity';
    const [r,g,b]=srgbByte(color);
    return normalize({schemaVersion:1,parameterKey:domain==='flameIntensity'?'flamePalette':'colorOverLife',
      domain,inputUnit,space:'srgb',clamp:'hold',
      stops:[{id:'start',position:0,rgba:[r,g,b,1]},{id:'end',position:1,rgba:[r,g,b,1]}]});
  }
  const presets=Object.freeze({
    natural:[[1,.2,.03,0],[1,.43,.08,.8],[1,.82,.32,1],[1,.98,.77,1]],
    stylized:[[.25,.06,.9,.12],[.98,.09,.43,1],[1,.53,.2,.95],[.95,.94,.5,.5]],
    magical:[[.08,.8,1,.1],[.25,.28,1,1],[.85,.2,1,.95],[1,.85,1,.6]]
  });
  function createPreset(name,domain='particleAge'){
    if(!Object.prototype.hasOwnProperty.call(presets,name))fail('unknown preset '+name);
    const colors=presets[name],inputUnit=domain==='particleAge'?'normalized-lifetime':
      domain==='flameIntensity'?'normalized-intensity':'normalized-duration';
    return normalize({schemaVersion:1,parameterKey:domain==='flameIntensity'?'flamePalette':'colorOverLife',
      domain,inputUnit,space:'srgb',clamp:'hold',
      stops:colors.map((c,i)=>({id:'stop'+i,position:i/(colors.length-1),
        rgba:[Math.round(c[0]*255),Math.round(c[1]*255),Math.round(c[2]*255),c[3]]}))});
  }
  function multiplierCurve(key,options={}){
    const a=options.start??1,b=options.end??1,domain=options.domain||'particleAge';
    return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
      inputUnit:domain==='particleAge'?'normalized-lifetime':'normalized-duration',
      valueUnit:'multiplier',inputRange:[0,1],valueRange:[0,4],
      defaultValue:1,clamp:'hold',monotonic:false,
      keys:[{id:'start',x:0,y:a,mode:'linear'},{id:'end',x:1,y:b,mode:'linear'}]});
  }
  const MULTIPLIERS=['alphaOverLife','sizeOverLife','glowOverLife','opacityOverLife'];
  function defaultLifetime(color='#ffd392'){
    return {schemaVersion:1,enabled:false,
      colorOverLife:defaultGradient('particleAge',color),
      alphaOverLife:multiplierCurve('alphaOverLife',{end:0}),
      sizeOverLife:multiplierCurve('sizeOverLife',{start:1,end:.2}),
      glowOverLife:multiplierCurve('glowOverLife',{end:0}),
      opacityOverLife:multiplierCurve('opacityOverLife',{end:1})};
  }
  function normalizeLifetime(input){
    shape(input,['schemaVersion','enabled','colorOverLife',...MULTIPLIERS],'lifetime');
    if(input.schemaVersion!==VERSION||typeof input.enabled!=='boolean')fail('invalid lifetime schemaVersion/enabled');
    const gradient=normalize(input.colorOverLife);
    if(gradient.domain!=='particleAge'||gradient.parameterKey!=='colorOverLife')fail('colorOverLife must use particleAge');
    const out={schemaVersion:VERSION,enabled:input.enabled,colorOverLife:gradient};
    for(const key of MULTIPLIERS){
      const c=Curves.normalize(input[key]);
      if(c.parameterKey!==key||c.domain!=='particleAge'||c.inputUnit!=='normalized-lifetime'||c.valueUnit!=='multiplier')fail(key+' curve must be particleAge multiplier');
      out[key]=c;
    }
    return out;
  }
  function sampleLifetime(input,age,opacity=1){
    if(!finite(age)||!finite(opacity)||opacity<0||opacity>1)fail('age/opacity must be finite');
    const life=normalizeLifetime(input),t=clamp(age,0,1);
    const rgba=sample(life.colorOverLife,t);
    const factors=Object.fromEntries(MULTIPLIERS.map(key=>[key,Curves.evaluate(life[key],t)]));
    return {rgba:[...rgba.slice(0,3),clamp(rgba[3]*factors.alphaOverLife*factors.opacityOverLife*opacity,0,1)],
      size:factors.sizeOverLife,glow:factors.glowOverLife,age:t};
  }
  function serialize(input){return JSON.stringify(normalize(input));}
  function deserialize(text){
    if(typeof text!=='string')fail('JSON text required');
    let value;try{value=JSON.parse(text);}catch{fail('invalid JSON');}
    return normalize(value);
  }
  function composite(rgba,background){
    if(!Array.isArray(background)||background.length!==3)fail('background must be RGB');
    return rgba.slice(0,3).map((v,i)=>v*rgba[3]+background[i]*(1-rgba[3]));
  }
  return {VERSION,MAX_STOPS,normalize,sample,serialize,deserialize,createPreset,defaultGradient,
    defaultLifetime,normalizeLifetime,sampleLifetime,multiplierCurve,hex,composite,toLinear,toSrgb};
});
