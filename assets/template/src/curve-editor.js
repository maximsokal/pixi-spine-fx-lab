// FX-CORE-01: reusable SVG curve authoring UI; only the pure schema is exported.
(function (root) {
  'use strict';
  const C = root.FxCurves;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function node(tag,props={},label='') {
    const el=document.createElement(tag);
    for(const [k,v] of Object.entries(props)) el.setAttribute(k,String(v));
    if(label)el.textContent=label;
    return el;
  }
  function svgNode(tag,attrs={}) {
    const el=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
    return el;
  }
  function mount(element,{curve,onChange,onScrub,getFrameCount,isLocked}) {
    if (!document.getElementById('fxCurveStyles')) {
      const style = node('style',{id:'fxCurveStyles'});
      style.textContent = '.fx-curve-editor{display:grid;gap:9px}' +
        '.fx-curve-tools{display:flex;align-items:center;flex-wrap:wrap;gap:5px}' +
        '.fx-curve-tools button,.fx-curve-tools select{font-size:11px;padding:5px 7px}' +
        '.fx-curve-snap{display:flex;align-items:center;gap:4px;font-size:11px}' +
        '.fx-curve-editor svg{width:100%;height:auto;max-height:240px;min-height:125px;background:#111920;border:1px solid #3c4652;border-radius:7px;cursor:crosshair}' +
        '.fx-curve-editor svg circle[data-kind]{cursor:move}' +
        '.fx-curve-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}' +
        '.fx-curve-fields label{display:flex;flex-direction:column;font-size:11px;color:#b5bfcb;min-width:0}' +
        '.fx-curve-fields input,.fx-curve-fields select{width:100%;min-width:0;box-sizing:border-box;font-size:12px;color:#f1f2f5;background:#141b23;border:1px solid #555e6a;border-radius:4px;padding:4px}' +
        '#fxCurveStatus{font-size:11px;color:#ffbb72;min-height:16px;overflow-wrap:anywhere}';
      document.head.append(style);
    }
    let current=C.normalize(curve), selected=current.keys[0].id, drag=null, counter=0, presetName='easeInOut';
    let frameSnap=true;
    const rootEl=node('div',{class:'fx-curve-editor'});
    const toolbar=node('div',{class:'fx-curve-tools'});
    const presets=node('select',{id:'fxCurvePreset','aria-label':'Curve preset'});
    function populatePresets(){
      const names=[['Linear','linear'],['Ease In','easeIn'],['Ease Out','easeOut'],
        ['Ease In/Out','easeInOut'],['Fast Attack','fastAttack'],['Slow Decay','slowDecay'],
        ['Pulse','pulse'],['Burst','burst']];
      presets.replaceChildren();
      for(const [label,value] of names){
        if(current.monotonic && ['slowDecay','pulse','burst'].includes(value))continue;
        presets.append(node('option',{value},label));
      }
      if(![...presets.options].some(o=>o.value===presetName))presetName='linear';
      presets.value=presetName;
    }
    populatePresets();toolbar.append(presets);
    const buttons = {};
    for(const [key,label] of [['add','Add key'],['copy','Copy key'],['delete','Delete key'],['reset','Reset']]){
      buttons[key]=node('button',{type:'button',id:'fxCurve'+key[0].toUpperCase()+key.slice(1)},label);
      toolbar.append(buttons[key]);
    }
    const snapLabel=node('label',{class:'fx-curve-snap'}), snap=node('input',{type:'checkbox',id:'fxCurveSnap'});
    snap.checked=true;snapLabel.append(snap,document.createTextNode('Snap to frame'));toolbar.append(snapLabel);
    const svg=svgNode('svg',{id:'fxCurveGraph',viewBox:'0 0 320 200',
      role:'img','aria-label':'Editable FX curve. Drag keys and Bezier handles. Click empty space to scrub.'});
    svg.style.touchAction='none';
    const edit=node('div',{class:'fx-curve-fields'}), controls={};
    function field(key,label,step) {
      const wrapper=node('label',{},label), input=node('input',{type:'number',id:'fxCurve'+key,step,required:'true'});
      wrapper.append(input);edit.append(wrapper);controls[key]=input;
    }
    field('Frame',current.domain==='pathPosition'?'Position / distance':'Frame @ 60 FPS',1);field('Value','Value',.001);
    const modeLabel=node('label',{},'Outgoing segment');
    const mode=node('select',{id:'fxCurveMode','aria-label':'Outgoing segment interpolation'});
    for(const item of ['linear','stepped','bezier'])mode.append(node('option',{value:item},item));
    modeLabel.append(mode);edit.append(modeLabel);
    for(const key of ['InX','InY','OutX','OutY'])field(key,key, .001);
    const status=node('output',{id:'fxCurveStatus',role:'status','aria-live':'polite'},current.inputUnit+' · '+current.domain+' · '+current.valueUnit);
    rootEl.append(toolbar,svg,edit,status);element.replaceChildren(rootEl);
    const frames=()=>Math.max(1,Number(getFrameCount())||60);
    const xRange=()=>current.inputRange, yRange=()=>current.valueRange;
    const toFraction=x=>(x-xRange()[0])/(xRange()[1]-xRange()[0]);
    const fromFraction=t=>xRange()[0]+t*(xRange()[1]-xRange()[0]);
    const inFrames=x=>current.inputUnit==='seconds'?Math.round(x*60):
      current.inputUnit==='pixels'?x:Math.round(toFraction(x)*frames());
    const fromFrames=n=>current.inputUnit==='seconds'?n/60:
      current.inputUnit==='pixels'?n:fromFraction(n/frames());
    const snapX=x=>frameSnap?fromFrames(inFrames(x)):x;
    const gridStep=()=>current.inputUnit==='seconds'?1/60:
      current.inputUnit==='pixels'?1:(xRange()[1]-xRange()[0])/frames();
    const X=x=>18+284*toFraction(x);
    const Y=y=>184-168*(y-yRange()[0])/(yRange()[1]-yRange()[0]);
    const index=()=>current.keys.findIndex(k=>k.id===selected);
    const clone=()=>JSON.parse(JSON.stringify(current));
    const unique=()=>{let id;do{id='key'+(++counter)}while(current.keys.some(k=>k.id===id));return id;};
    function sanitize(data) {
      for(let i=0;i<data.keys.length-1;i++){
        const a=data.keys[i],b=data.keys[i+1];
        if(a.mode!=='bezier')continue;
        if(!a.out)a.out=[a.x+(b.x-a.x)/3,a.y+(b.y-a.y)/3];
        if(!b.in)b.in=[a.x+2*(b.x-a.x)/3,a.y+2*(b.y-a.y)/3];
        a.out[0]=clamp(a.out[0],a.x,b.x);
        b.in[0]=clamp(b.in[0],a.out[0],b.x);
        a.out[1]=clamp(a.out[1],data.valueRange[0],data.valueRange[1]);
        b.in[1]=clamp(b.in[1],data.valueRange[0],data.valueRange[1]);
        if(data.monotonic){
          a.out[1]=clamp(a.out[1],a.y,b.y);
          b.in[1]=clamp(b.in[1],a.out[1],b.y);
        }
      }
      return data;
    }
    function commit(data) {
      if(isLocked?.())return false;
      try {
        const next=C.normalize(sanitize(data));
        current=next;onChange(next);status.textContent='Curve updated · '+current.keys.length+' keys';draw();return true;
      } catch(e){status.textContent=e.message;return false;}
    }
    function draw() {
      svg.replaceChildren();
      for(let i=0;i<=4;i++){
        svg.append(svgNode('line',{x1:18,y1:Y(yRange()[0]+i/4*(yRange()[1]-yRange()[0])),x2:302,y2:Y(yRange()[0]+i/4*(yRange()[1]-yRange()[0])),stroke:'#40505b','stroke-width':.8}));
        svg.append(svgNode('line',{x1:X(fromFraction(i/4)),y1:16,x2:X(fromFraction(i/4)),y2:184,stroke:'#40505b','stroke-width':.8}));
      }
      let points='';
      for(let i=0;i<=192;i++){const x=fromFraction(i/192);points+=(i?' ':'')+X(x).toFixed(2)+','+Y(C.evaluate(current,x)).toFixed(2);}
      svg.append(svgNode('polyline',{points,stroke:'#ffa650','stroke-width':2.5,fill:'none'}));
      for(const k of current.keys){
        if(k.id===selected){
          for(const [kind,v] of [['in',k.in],['out',k.out]]){
            if(!v || (kind==='in'&&index()===0) || (kind==='out'&&index()===current.keys.length-1))continue;
            svg.append(svgNode('line',{x1:X(k.x),y1:Y(k.y),x2:X(v[0]),y2:Y(v[1]),stroke:'#8fa6b5','stroke-width':1.2}));
            svg.append(svgNode('circle',{cx:X(v[0]),cy:Y(v[1]),r:5,fill:'#aaddff',stroke:'#18232c',
              'data-id':k.id,'data-kind':kind,'aria-label':kind+' handle '+k.id}));
          }
        }
      }
      for(const k of current.keys)svg.append(svgNode('circle',{cx:X(k.x),cy:Y(k.y),r:k.id===selected?7:5,
        fill:k.id===selected?'#fff1b0':'#ff9c44',stroke:'#1a222a','stroke-width':1.8,
        'data-id':k.id,'data-kind':'key','aria-label':'curve key '+k.id}));
      const k=current.keys[index()]||current.keys[0];
      controls.Frame.value=String(inFrames(k.x));controls.Value.value=String(k.y);
      mode.value=k.mode;mode.disabled=index()===current.keys.length-1;
      for(const [name,pair] of [['In',k.in],['Out',k.out]]){
        controls[name+'X'].disabled=!pair;
        controls[name+'Y'].disabled=!pair;
        controls[name+'X'].value=pair?String(pair[0]):'';
        controls[name+'Y'].value=pair?String(pair[1]):'';
      }
      buttons.delete.disabled=current.keys.length<=2||index()===0||index()===current.keys.length-1;
      buttons.copy.disabled=current.keys.length>=64;
      buttons.add.disabled=current.keys.length>=64;
    }
    function move(id,kind,x,y){
      const data=clone(),at=data.keys.findIndex(k=>k.id===id);
      if(at<0)return;
      const k=data.keys[at];
      if(kind==='key'){
        const left=at?data.keys[at-1]:null,right=at+1<data.keys.length?data.keys[at+1]:null;
        const nx=(!left||!right)?k.x:clamp(snapX(x),left.x+1e-6,right.x-1e-6);
        const ny=(!left||!right)?k.y:clamp(y,data.monotonic?left.y:yRange()[0],data.monotonic?right.y:yRange()[1]);
        const dx=nx-k.x,dy=ny-k.y;
        k.x=nx;k.y=ny;
        for(const h of ['in','out'])if(k[h]){k[h][0]+=dx;k[h][1]+=dy;}
      }else if(k[kind]){
        k[kind]=[clamp(x,xRange()[0],xRange()[1]),clamp(y,yRange()[0],yRange()[1])];
      }
      commit(data);
    }
    function locate(event){
      const matrix=svg.getScreenCTM();
      if(!matrix)return null;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
      return [fromFraction(clamp((p.x-18)/284,0,1)),yRange()[0]+clamp((184-p.y)/168,0,1)*(yRange()[1]-yRange()[0])];
    }
    svg.addEventListener('pointerdown',e=>{
      if(isLocked?.())return;
      const pos=locate(e);if(!pos)return;
      const target=e.target.closest('[data-kind]');
      if(target){selected=target.getAttribute('data-id');
        drag={id:selected,kind:target.getAttribute('data-kind')};svg.setPointerCapture(e.pointerId);draw();
      }else{onScrub(snapX(pos[0]));status.textContent='Scrub frame '+Math.round(pos[0]*frames());}
    });
    svg.addEventListener('pointermove',e=>{if(drag&&!isLocked?.()){const pos=locate(e);if(pos)move(drag.id,drag.kind,pos[0],pos[1]);}});
    const finish=()=>{drag=null;};
    svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
    snap.addEventListener('change',()=>{frameSnap=snap.checked;});
    const presetConfig=()=>({parameterKey:current.parameterKey,domain:current.domain,
      inputUnit:current.inputUnit,valueUnit:current.valueUnit,monotonic:current.monotonic,
      inputRange:current.inputRange,valueRange:current.valueRange,
      defaultValue:current.defaultValue,clamp:current.clamp});
    presets.onchange=()=>{
      presetName=presets.value;
      const data=C.createPreset(presetName,presetConfig());
      selected='start';commit(data);
    };
    buttons.reset.onclick=()=>{selected='start';commit(C.createPreset(presetName,presetConfig()));};
    buttons.add.onclick=()=>{
      if(current.keys.length>=64)return;
      let at=current.keys.findIndex(k=>k.id===selected);
      if(at<0||at===current.keys.length-1)at=current.keys.length-2;
      const data=clone(),a=data.keys[at],b=data.keys[at+1],x=snapX((a.x+b.x)/2);
      if(!(x>a.x&&x<b.x))return void(status.textContent='No room to insert another frame key.');
      const y=C.evaluate(current,x),newKey={id:unique(),x,y,mode:a.mode};
      if(a.mode==='bezier'){
        const split=(p,q,t)=>p+(q-p)*t;
        let lo=0,hi=1;
        for(let i=0;i<36;i++){const t=(lo+hi)/2,
          xx=(1-t)**3*a.x+3*(1-t)**2*t*a.out[0]+3*(1-t)*t*t*b.in[0]+t**3*b.x;
          if(xx<x)lo=t;else hi=t;}
        const t=(lo+hi)/2,lerp=(p,q)=>[split(p[0],q[0],t),split(p[1],q[1],t)];
        const q0=lerp([a.x,a.y],a.out),q1=lerp(a.out,b.in),q2=lerp(b.in,[b.x,b.y]);
        const r0=lerp(q0,q1),r1=lerp(q1,q2);
        a.out=q0;newKey.in=r0;newKey.out=r1;b.in=q2;
      }
      data.keys.splice(at+1,0,newKey);selected=newKey.id;commit(data);
    };
    buttons.copy.onclick=()=>{
      const at=index(),a=current.keys[at],b=current.keys[at+1];
      if(!b)return void(status.textContent='Select a key before the final key to copy.');
      const x=snapX(a.x+gridStep());if(x<=a.x||x>=b.x)return void(status.textContent='No free frame after selected key.');
      const data=clone(),copy={id:unique(),x,y:a.y,mode:'linear'};
      data.keys.splice(at+1,0,copy);selected=copy.id;commit(data);
    };
    buttons.delete.onclick=()=>{
      const at=index();if(at<=0||at>=current.keys.length-1)return;
      const data=clone();data.keys.splice(at,1);selected=data.keys[at-1].id;
      // Adjacent Bezier segments receive safe, distinct handles.
      data.keys[at-1].mode='linear';commit(data);
    };
    function inputValue(){
      const at=index(),data=clone(),k=data.keys[at];
      const frame=Number(controls.Frame.value),y=Number(controls.Value.value);
      if(!controls.Frame.value.trim()||!controls.Value.value.trim()||!Number.isFinite(frame)||!Number.isFinite(y)||!Number.isInteger(frame)){
        status.textContent='Frame and value must be finite numbers.';return;
      }
      move(k.id,'key',fromFrames(frame),y);
    }
    controls.Frame.addEventListener('change',inputValue);
    controls.Value.addEventListener('change',inputValue);
    mode.onchange=()=>{
      const at=index(),data=clone();if(at>=data.keys.length-1)return;
      data.keys[at].mode=mode.value;commit(data);
    };
    for(const [name,kind,axis] of [['InX','in',0],['InY','in',1],['OutX','out',0],['OutY','out',1]]){
      controls[name].addEventListener('change',()=>{
        const value=Number(controls[name].value);
        if(!controls[name].value.trim()||!Number.isFinite(value)){status.textContent='Handle must be finite.';return;}
        const data=clone(),k=data.keys[index()];
        if(!k[kind])return;
        k[kind][axis]=axis===0?clamp(value,xRange()[0],xRange()[1]):clamp(value,yRange()[0],yRange()[1]);commit(data);
      });
    }
    draw();
    return {
      setCurve(curve) {current=C.normalize(curve);selected=current.keys[0].id;populatePresets();draw();},
      refresh() {draw();},
      getCurve() {return C.normalize(current);}
    };
  }
  root.FxCurveEditor=Object.freeze({mount});
})(globalThis);
