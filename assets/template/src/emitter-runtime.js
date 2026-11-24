// FX-CORE-03 — PixiJS 8.22 / Spine 4.2 multi-layer renderer.
// Owns ONLY its containers/graphics/filters/slot bindings, never the caller's Spine assets.
(function(root){
'use strict';
const E=root.FxEmitters;
function createEmitterLayers({PIXI,app,host,model,settings,bounds,worldOffset={x:0,y:0}}) {
  if(!E||!PIXI||!app?.stage||!host||!model)throw Error('Emitter runtime requires FxEmitters, PIXI, app, host and Spine model');
  const stage=app.stage;
  if(host.parent!==stage||host.x||host.y||host.rotation||host.scale.x!==1||host.scale.y!==1)
    throw Error('Emitter FX requires an identity-transform host directly under stage');
  let doc=E.normalize(settings),rect={...bounds},clock=0,dead=false,diagnostics=[];
  const groups={behind:new PIXI.Container(),front:new PIXI.Container()};
  groups.behind.label='FX emitters behind Spine';groups.front.label='FX emitters in front of Spine';
  groups.behind.sortableChildren=groups.front.sortableChildren=true;
  stage.addChildAt(groups.behind,stage.getChildIndex(host));
  stage.addChild(groups.front);
  const owned=new Map(),slotGroups=new Map();
  let last={time:0,layers:[],cost:0};
  function diagnose(code,emitter,message){diagnostics.push({code,emitterId:emitter.id,message});}
  function destroyLayer(layer){
    if(!layer)return;
    if(layer.filter){layer.container.filters=[];layer.filter.destroy();layer.filter=null;}
    layer.container.destroy({children:true});
  }
  function dropSlot(slot){
    const s=slotGroups.get(slot);if(!s)return;
    // Spine may own a slot wrapper while emitter children survive a placement change.
    // Move those still-owned children away BEFORE destroying the wrapper.
    for(const child of [...s.wrapper.children])groups.front.addChild(child);
    if(typeof model.removeSlotObject==='function'&&model.getSlotObject?.(slot)===s.wrapper)
      model.removeSlotObject(slot,s.wrapper);
    s.wrapper.destroy({children:true});
    slotGroups.delete(slot);
  }
  function slotParent(slot,e){
    let existing=slotGroups.get(slot);
    if(existing)return existing.wrapper;
    if(typeof model.addSlotObject!=='function'||typeof model.removeSlotObject!=='function'){
      diagnose('slot-unsupported',e,'Pinned Spine runtime has no slot-object insertion');return null;
    }
    if(model.getSlotObject?.(slot)){
      diagnose('slot-occupied',e,'Slot already has a caller-owned Pixi object; cannot replace it');return null;
    }
    const wrapper=new PIXI.Container();
    wrapper.label='FX slot '+slot;
    wrapper.sortableChildren=true;
    try{model.addSlotObject(slot,wrapper,{followAttachmentTimeline:false})}
    catch(error){wrapper.destroy();diagnose('slot-error',e,String(error.message||error));return null;}
    slotGroups.set(slot,{wrapper});return wrapper;
  }
  function anchorWorld(e){
    const anchor=e.anchor,transform=model.worldTransform;
    const apply=p=>transform.apply(p,{x:0,y:0});
    const skeleton=model.skeleton;
    if(anchor.type==='world')return {x:e.x+worldOffset.x,y:e.y+worldOffset.y};
    if(!skeleton){diagnose('missing-skeleton',e,'No Spine skeleton');return null;}
    let px=0,py=0,bone=null;
    if(anchor.type==='skeleton'){
      // (0,0) is the Spine container origin, not the camera/crop center.
    }else if(anchor.type==='bone'){
      bone=skeleton.findBone(anchor.name);
      if(!bone||!bone.active){diagnose('missing-bone',e,'Bone not found/active: '+anchor.name);return null;}
      px=bone.worldX;py=bone.worldY;
    }else if(anchor.type==='slot'||anchor.type==='attachment'){
      const slot=skeleton.findSlot(anchor.type==='attachment'?anchor.slot:anchor.name);
      if(!slot||!slot.bone?.active){
        diagnose('missing-slot',e,'Slot not found/active: '+(anchor.slot||anchor.name));return null;
      }
      bone=slot.bone;px=bone.worldX;py=bone.worldY;
      if(anchor.type==='attachment'){
        const att=slot.getAttachment?.();
        if(!att||att.name!==anchor.name){
          diagnose('missing-attachment',e,'Active attachment not found: '+anchor.name);return null;
        }
        // The actual mesh/region world vertices are in skeleton coordinates.
        let verts=null;
        try{
          if(typeof att.worldVerticesLength==='number'&&att.worldVerticesLength>=2&&
             typeof att.computeWorldVertices==='function') {
            verts=new Float32Array(Math.min(att.worldVerticesLength,512));
            att.computeWorldVertices(slot,0,verts.length,verts,0,2);
          }else if(typeof att.computeWorldVertices==='function'){
            verts=new Float32Array(8);att.computeWorldVertices(slot,verts,0,2);
          }
        }catch(err){diagnose('attachment-vertices',e,'Cannot obtain attachment world vertices');return null;}
        if(verts?.length){
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          for(let i=0;i<verts.length;i+=2) {
            minX=Math.min(minX,verts[i]);minY=Math.min(minY,verts[i+1]);
            maxX=Math.max(maxX,verts[i]);maxY=Math.max(maxY,verts[i+1]);
          }
          px=(minX+maxX)/2;py=(minY+maxY)/2;
        }else{diagnose('attachment-unsupported',e,'Attachment has no supported world vertices');return null;}
      }
    }
    if(e.space==='world'){const anchorAt=apply({x:px,y:py});return {x:anchorAt.x+e.x,y:anchorAt.y+e.y};}
    if(bone){
      return apply({x:px+bone.a*e.x+bone.b*e.y,
        y:py+bone.c*e.x+bone.d*e.y});
    }
    return apply({x:px+e.x,y:py+e.y});
  }
  function parentFor(e){
    if(e.placement==='behind')return groups.behind;
    if(e.placement==='front')return groups.front;
    const slot=e.anchor.type==='attachment'?e.anchor.slot:e.anchor.name;
    if(!model.skeleton?.findSlot(slot)) {
      diagnose('missing-slot',e,'Slot for interleaving does not exist: '+slot);
      return e.fallback==='front'?groups.front:null;
    }
    return slotParent(slot,e)||(e.fallback==='front'?groups.front:null);
  }
  function setup(){
    if(dead)return;
    diagnostics=[];
    const targetIds=new Set();
    for(const e of doc.emitters){
      targetIds.add(e.id);
      let state=owned.get(e.id);
      if(!state){
        state={container:new PIXI.Container(),layers:new Map()};
        state.container.label='FX '+e.id;
        state.container.sortableChildren=true;
        owned.set(e.id,state);
      }
      state.container.zIndex=e.order;
      state.container.blendMode=e.blend;
      for(const layer of e.layers){
        let record=state.layers.get(layer.id);
        if(!record){
          const container=new PIXI.Container(),graphics=new PIXI.Graphics();
          container.label='FX layer '+layer.id;
          container.addChild(graphics);
          record={container,graphics,filter:null};
          state.layers.set(layer.id,record);
          state.container.addChild(container);
        }
        // Imported settings can change a layer's type without changing its ID.
        if(layer.type==='postprocess'&&!record.filter){
          if(!PIXI.BlurFilter)throw Error('PixiJS BlurFilter unavailable for postprocess layer');
          record.filter=new PIXI.BlurFilter({strength:2.5,quality:2});
          record.container.filters=[record.filter];
        }else if(layer.type!=='postprocess'&&record.filter){
          record.container.filters=[];record.filter.destroy();record.filter=null;
        }
        record.container.zIndex=layer.order;
        record.graphics.blendMode=layer.blend;
        record.container.position.set(layer.x,layer.y);
        record.container.rotation=layer.rotation*Math.PI/180;
        record.container.scale.set(layer.scale);
      }
      for(const [lid,record] of [...state.layers]){
        if(!e.layers.some(l=>l.id===lid)){destroyLayer(record);state.layers.delete(lid);}
      }
    }
    for(const [eid,state]of [...owned]){
      if(!targetIds.has(eid)){
        for(const record of state.layers.values())destroyLayer(record);
        state.layers.clear();state.container.destroy();owned.delete(eid);
      }
    }
    // Detach stale slot containers only AFTER releasing all hosted emitters.
    for(const slot of [...slotGroups.keys()]){
      if(!doc.emitters.some(e=>e.placement==='slot'&&
        (e.anchor.type==='attachment'?e.anchor.slot:e.anchor.name)===slot))dropSlot(slot);
    }
  }
  function drawPrimitive(g,p,hex){
    if(p.alpha<=0)return;
    if(p.shape==='circle')g.circle(p.x,p.y,Math.max(.1,p.radius)).fill({color:hex,alpha:p.alpha});
    else if(p.shape==='ring')g.circle(p.x,p.y,p.radius)
      .stroke({color:hex,alpha:p.alpha,width:p.width});
    else if(p.shape==='line')g.moveTo(p.x1,p.y1).lineTo(p.x2,p.y2)
      .stroke({color:hex,alpha:p.alpha,width:p.width});
    else if(p.shape==='rect'){
      const c=Math.cos(p.rotation),s=Math.sin(p.rotation),w=p.w/2,h=p.h/2;
      const corners=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>
        [p.x+x*c-y*s,p.y+x*s+y*c]);
      g.poly(corners.flat()).fill({color:hex,alpha:p.alpha});
    }
  }
  function seek(time){
    if(dead)return;
    clock=time;
    const snapshot=E.sample(doc,Math.max(0,time));
    last=snapshot;
    diagnostics=[];
    const byId=new Map(snapshot.layers.map(l=>[l.id,l]));
    for(const e of doc.emitters){
      const state=owned.get(e.id);if(!state)continue;
      const parent=parentFor(e);
      const world=e.placement==='slot'&&parent!==groups.front?{x:e.x,y:e.y}:anchorWorld(e);
      const ready=Boolean(parent&&world);
      if(parent&&state.container.parent!==parent)parent.addChild(state.container);
      state.container.visible=ready&&doc.enabled&&e.enabled&&e.visible;
      if(ready){
        state.container.position.set(world.x,world.y);
        state.container.rotation=e.rotation*Math.PI/180;
        state.container.scale.set(e.scale);
      }
      for(const l of e.layers){
        const item=byId.get(l.id),record=state.layers.get(l.id);
        if(!record)continue;
        record.container.visible=state.container.visible&&Boolean(item);
        record.graphics.clear();
        if(!item||!ready)continue;
        const color=parseInt(l.color.slice(1),16);
        for(const shape of item.primitives)drawPrimitive(record.graphics,shape,shape.color?parseInt(shape.color.slice(1),16):color);
      }
    }
    return {time,visibleLayers:[...byId.keys()],cost:snapshot.cost,diagnostics:diagnostics.slice()};
  }
  function scenePositionForEmitter(id){
    const e=doc.emitters.find(v=>v.id===id),state=owned.get(id);
    if(!e||!state||!state.container.visible)return null;
    if(e.placement==='slot')return stage.toLocal(state.container.getGlobalPosition());
    return anchorWorld(e);
  }
  function scenePositionForLayer(eid,lid){
    const state=owned.get(eid),record=state?.layers.get(lid);
    if(!state?.container.visible||!record)return null;
    return stage.toLocal(record.container.getGlobalPosition());
  }
  function emitterOffsetFromScene(id,x,y){
    const e=doc.emitters.find(v=>v.id===id),state=owned.get(id);
    if(!e||!state)throw Error('Emitter not found');
    if(e.placement==='slot'){
      const parent=state.container.parent;
      if(!parent)throw Error('Unresolved slot parent');
      return parent.toLocal(stage.toGlobal({x,y}));
    }
    const project=(dx,dy)=>anchorWorld({...e,x:dx,y:dy});
    const p=project(0,0),a=project(1,0),b=project(0,1);
    if(!p||!a||!b)throw Error('Anchor is unresolved');
    const ax=a.x-p.x,ay=a.y-p.y,bx=b.x-p.x,by=b.y-p.y;
    const det=ax*by-ay*bx;
    if(Math.abs(det)<1e-12)throw Error('Anchor transform is singular');
    const vx=x-p.x,vy=y-p.y;
    return {x:(vx*by-vy*bx)/det,y:(ax*vy-ay*vx)/det};
  }
  function layerOffsetFromScene(eid,lid,x,y){
    const state=owned.get(eid),layer=state?.layers.get(lid);
    if(!layer)throw Error('Layer not found');
    return state.container.toLocal(stage.toGlobal({x,y}));
  }
  function configure(value){
    if(dead)throw Error('Emitter runtime destroyed');
    const next=E.normalize(value);
    doc=next;setup();seek(clock);
  }
  function setBounds(value){rect={...value};seek(clock);}
  function destroy(){
    if(dead)return;
    dead=true;
    for(const e of owned.values()){
      for(const record of e.layers.values())destroyLayer(record);
      e.layers.clear();e.container.destroy();
    }
    owned.clear();
    for(const slot of [...slotGroups.keys()])dropSlot(slot);
    groups.behind.destroy({children:true});groups.front.destroy({children:true});
  }
  setup();seek(0);
  return {seek,configure,setBounds,destroy,
    get document(){return doc},get clock(){return clock},
    get diagnostics(){return diagnostics.slice()},
    get snapshot(){return last},
    get nodes(){return owned},
    get ownedCount(){return owned.size},
    get slotBindings(){return slotGroups.size},
    scenePositionForEmitter,scenePositionForLayer,emitterOffsetFromScene,layerOffsetFromScene};
}
root.FxEmitterRuntime=Object.freeze({createEmitterLayers});
})(globalThis);
