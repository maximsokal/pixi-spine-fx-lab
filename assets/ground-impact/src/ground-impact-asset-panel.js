// EARTH-01 G03c: DOM binding for pending offline Spine files.
(function(root,make){
 'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactAssetPanel=api;
})(globalThis,function(){
 'use strict';
 function mount(host,{selection,getAccepted,sample,onAccepted=()=>{},onError=()=>{},onBusy=()=>{},isLocked=()=>false}){
  const doc=host.ownerDocument,group=doc.createElement('fieldset'),inputs=[],buttons=[];let dead=false,running=false;
  const make=(tag,value)=>{const el=doc.createElement(tag);el.textContent=value??'';return el;};
  const disabled=()=>dead||running||selection.busy||isLocked();
  const pending=make('ul'),active=make('output'),message=make('p');active.setAttribute('aria-live','polite');message.setAttribute('role','alert');
  function error(e){message.textContent=String(e?.message??e);onError(e);}
  function action(fn){if(disabled())return;try{fn();message.textContent='';}catch(e){error(e);}finally{refresh();}}
  function button(name,fn){const b=make('button',name);b.type='button';b.onclick=fn;buttons.push(b);return b;}
  function picker(label,accept,multiple,fn){const row=make('label',label),input=make('input');input.type='file';input.accept=accept;input.multiple=multiple;input.setAttribute('aria-label',label);input.onchange=()=>{try{action(()=>fn(input.files));}finally{input.value='';}};inputs.push(input);row.append(input);group.append(row);}
  picker('Skeleton JSON / SKEL','.json,.skel',false,selection.selectSkeleton);picker('Atlas','.atlas',false,selection.selectAtlas);picker('Textures','image/*,.png,.jpg,.jpeg,.webp',true,selection.addTextures);
  const drop=make('div','Drop skeleton, atlas or texture files here');drop.dataset.dropZone='';drop.ondragover=e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect=disabled()?'none':'copy';};drop.ondrop=e=>{e.preventDefault();if(e.dataTransfer)action(()=>selection.drop(e.dataTransfer.files));};
  async function run(fn){if(disabled())return false;running=true;message.textContent='';refresh();try{onBusy(true);await fn();if(dead)return false;try{onAccepted();}catch(e){error(new Error('Source accepted; preview refresh failed: '+String(e?.message??e)));}return true;}catch(e){if(!dead)error(e);return false;}finally{running=false;if(!dead){try{onBusy(false);}finally{refresh();}}}}
  const load=button('Load selected',()=>run(()=>selection.load())),loadSample=button('Load sample',()=>run(()=>selection.loadSource(sample()))),remove=button('Remove preview',()=>run(()=>selection.removePreview())),clear=button('Clear selected',()=>action(()=>selection.clear()));
  group.append(drop,pending,load,loadSample,remove,clear,active,message);host.replaceChildren(group);
  function refresh(){if(dead)return;const locked=disabled(),files=selection.files;group.disabled=locked;inputs.forEach(el=>{el.disabled=locked;});buttons.forEach(el=>{el.disabled=locked;});load.disabled=locked||!selection.complete;loadSample.disabled=locked||typeof sample!=='function';active.textContent='Active: '+(getAccepted()||'none');pending.replaceChildren();
   for(const name of [files.skeleton,files.atlas].filter(Boolean))pending.append(make('li',name));
   for(const name of files.textures){const row=make('li'),label=make('span',name),b=make('button','Remove '+name);b.type='button';b.disabled=locked;b.onclick=()=>action(()=>selection.removeTexture(name));row.append(label,b);pending.append(row);}
  }
  function destroy(){if(dead)return;dead=true;host.replaceChildren();}
  refresh();return Object.freeze({refresh,destroy});
 }
 return {mount};
});
