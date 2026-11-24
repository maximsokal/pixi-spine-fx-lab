// FX-CORE-02 — deterministic, renderer-independent emission and spatial spacing.
(function (root, make) {
  'use strict';
  const API = Object.freeze(make(root.FxCurves || (typeof require === 'function' ? require('./curve-core.js') : null)));
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.FxSpacing = API;
})(globalThis, function (Curves) {
  'use strict';
  if (!Curves) throw new Error('FxSpacing requires FxCurves (versioned curve engine).');
  const MAX_EVENTS=4096, MAX_POINTS=8192, MAX_SEGMENTS=256, INTEGRATION_STEPS=4096;
  const tModes=['uniform','accelerating','decelerating','burst','clustered','custom'];
  const sModes=['even','random','stratified','clustered'];
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi));
  function fail(message){throw new TypeError('Invalid FX spacing: '+message);}
  function number(v,name,lo,hi){if(!finite(v)||v<lo||v>hi)fail(name+' must be finite in ['+lo+','+hi+']');return v;}
  function vec(v,name){if(!Array.isArray(v)||v.length!==2||!v.every(x=>finite(x)&&Math.abs(x)<=1000000))fail(name+' must be finite [x,y]');return [v[0],v[1]];}
  function rng(seed){
    let state=(seed|0)>>>0;
    return ()=>{state=(state+0x6d2b79f5)>>>0;let x=Math.imul(state^state>>>15,1|state);x^=x+Math.imul(x^x>>>7,61|x);return ((x^x>>>14)>>>0)/4294967296;};
  }
  function validateCurve(curve,parameter,domain){
    if(curve===null||curve===undefined)return null;
    const c=Curves.normalize(curve);
    if(c.parameterKey!==parameter||c.domain!==domain)fail('curve must bind to '+parameter+' / '+domain);
    if(!['normalized-duration','normalized-path'].includes(c.inputUnit))fail('curve input must be normalized');
    return c;
  }
  function normalizeTemporal(input) {
    if(!input||typeof input!=='object')fail('temporal config required');
    const mode=input.mode??'uniform',frequencySource=input.frequencySource??'rate';
    if(!tModes.includes(mode))fail('unknown temporal mode');
    if(!['rate','interval'].includes(frequencySource))fail('frequencySource must be rate or interval');
    const out={
      schemaVersion:input.schemaVersion??1,mode,frequencySource,
      baseRate:number(input.baseRate??0,'baseRate',0,10000),
      interval:number(input.interval??.1,'interval',.0001,3600),
      duration:number(input.duration??0,'duration',0,3600),
      minInterval:number(input.minInterval??0,'minInterval',0,3600),
      jitter:number(input.jitter??0,'jitter',0,.45),
      burstCount:number(input.burstCount??1,'burstCount',1,128),
      burstDelay:number(input.burstDelay??0,'burstDelay',0,60),
      seed:number(input.seed??0,'seed',-2147483648,2147483647),
      maxEvents:number(input.maxEvents??2048,'maxEvents',1,MAX_EVENTS),
      rateCurve:validateCurve(input.rateCurve,'emissionRate','emitterTime'),
      intervalCurve:validateCurve(input.intervalCurve,'emissionInterval','emitterTime')
    };
    if(out.schemaVersion!==1)fail('unsupported temporal schemaVersion');
    if(!Number.isInteger(out.burstCount)||!Number.isInteger(out.seed)||!Number.isInteger(out.maxEvents))fail('count/seed/maxEvents must be integers');
    return out;
  }
  // The timetable is integrated once, not once per render tick. All call sites
  // (preview, 60 FPS bake, exported modules) consume precisely the same timestamps.
  function createTemporalSchedule(config) {
    const c=normalizeTemporal(config);
    if(c.duration===0||(!c.baseRate&&c.frequencySource==='rate'))return {config:c,events:[],capped:false};
    const random=rng(c.seed^0x791b371d),events=[];
    let capped=false;
    function emit(at,burstIndex=0){
      if(at>c.duration+1e-9||at<0)return;
      if(events.length>=c.maxEvents){capped=true;return;}
      const prev=events.at(-1)?.time??-Infinity;
      if(at+1e-9<prev+c.minInterval)return;
      const time=clamp(at,0,c.duration);
      if(time<=prev+1e-12)return;
      events.push({time,index:events.length,burstIndex});
    }
    const base=c.frequencySource==='rate'?c.baseRate:1/c.interval;
    if(c.mode==='burst'){
      for(let i=1;i<=Math.ceil(c.duration*base+1e-9);i++){
        const at=i/base;
        if(at>c.duration+1e-9)break;
        for(let j=0;j<c.burstCount;j++){
          emit(at+j*c.burstDelay,j);
          if(capped)break;
        }
        if(capped)break;
      }
      return {config:c,events,capped};
    }
    const normalized=t=>clamp(t/c.duration,0,1);
    function rateAt(time){
      const u=normalized(time);
      let factor=1;
      if(c.mode==='accelerating')factor=.5+u;
      if(c.mode==='decelerating')factor=1.5-u;
      if(c.mode==='clustered')factor=.2+3*Math.pow(Math.max(0,Math.sin(3*Math.PI*u)),8);
      if(c.mode==='custom'){
        const curve=c.frequencySource==='rate'?c.rateCurve:c.intervalCurve;
        if(curve){
          const evaluated=Curves.evaluate(curve,u);
          factor=c.frequencySource==='rate'?Math.max(0,evaluated):1/Math.max(.05,evaluated);
        }
      }
      return Math.min(10000,base*factor);
    }
    const integral=new Float64Array(INTEGRATION_STEPS+1);
    const step=c.duration/INTEGRATION_STEPS;
    for(let i=1;i<=INTEGRATION_STEPS;i++){
      integral[i]=integral[i-1]+rateAt((i-.5)*step)*step;
    }
    const expected=Math.floor(integral[INTEGRATION_STEPS]+1e-9);
    // Use the crossing of cumulative emission intensity N(t) = 1,2,3,...
    // Each event has its own seeded time jitter, bounded by neighboring slots.
    for(let k=1;k<=expected;k++){
      if(events.length>=c.maxEvents){capped=true;break;}
      let lo=0,hi=INTEGRATION_STEPS;
      while(lo+1<hi){const mid=(lo+hi)>>1;if(integral[mid]<k)lo=mid;else hi=mid;}
      const a=integral[lo],b=integral[hi],fraction=b>a?(k-a)/(b-a):0;
      let time=(lo+fraction)*step;
      if(c.jitter){
        const jitterSpan=c.jitter/(Math.max(base,.000001)*Math.max(.2,rateAt(time)/base));
        time+=((random()*2)-1)*jitterSpan;
        time=clamp(time,0,c.duration);
      }
      emit(time);
    }
    return {config:c,events,capped};
  }
  function createCursor(schedule){
    if(!schedule||!Array.isArray(schedule.events))fail('invalid timetable');
    let cursor=0,clock=-Infinity;
    return {
      consume(time){
        number(time,'cursor time',0,Infinity);
        if(time+1e-10<clock)fail('cursor cannot rewind; create a new cursor');
        clock=time;const result=[];
        while(cursor<schedule.events.length&&schedule.events[cursor].time<=time+1e-9)result.push(schedule.events[cursor++]);
        return result;
      },
      reset(){cursor=0;clock=-Infinity;},
      get index(){return cursor;}
    };
  }
  function normalizePath(input){
    if(!input||input.schemaVersion!==1||typeof input.closed!=='boolean'||!Array.isArray(input.segments)||
       input.segments.length<1||input.segments.length>MAX_SEGMENTS)fail('path needs schemaVersion=1, closed, and 1–256 cubic segments');
    const segments=input.segments.map((s,i)=>{
      if(!s||typeof s!=='object')fail('segment '+i);
      return {p0:vec(s.p0,'p0'),p1:vec(s.p1,'p1'),p2:vec(s.p2,'p2'),p3:vec(s.p3,'p3')};
    });
    for(let i=1;i<segments.length;i++)if(Math.hypot(
      segments[i-1].p3[0]-segments[i].p0[0],segments[i-1].p3[1]-segments[i].p0[1])>1e-6)
      fail('path segments must connect without jumps');
    return {schemaVersion:1,closed:input.closed,segments};
  }
  function evaluateCubic(s,t){
    const q=1-t,a=q*q*q,b=3*q*q*t,c=3*q*t*t,d=t*t*t;
    return {x:a*s.p0[0]+b*s.p1[0]+c*s.p2[0]+d*s.p3[0],
      y:a*s.p0[1]+b*s.p1[1]+c*s.p2[1]+d*s.p3[1]};
  }
  function derivative(s,t){
    const q=1-t;
    const x=3*(q*q*(s.p1[0]-s.p0[0])+2*q*t*(s.p2[0]-s.p1[0])+t*t*(s.p3[0]-s.p2[0]));
    const y=3*(q*q*(s.p1[1]-s.p0[1])+2*q*t*(s.p2[1]-s.p1[1])+t*t*(s.p3[1]-s.p2[1]));
    const len=Math.hypot(x,y);
    if(len>1e-12)return {x:x/len,y:y/len};
    const vx=s.p3[0]-s.p0[0],vy=s.p3[1]-s.p0[1],d=Math.hypot(vx,vy);
    return d>0?{x:vx/d,y:vy/d}:{x:1,y:0};
  }
  const mix=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  function split(s){
    const a=mix(s.p0,s.p1),b=mix(s.p1,s.p2),c=mix(s.p2,s.p3),
      d=mix(a,b),e=mix(b,c),m=mix(d,e);
    return [{p0:s.p0,p1:a,p2:d,p3:m},{p0:m,p1:e,p2:c,p3:s.p3}];
  }
  function buildArcTable(input,options={}){
    const path=normalizePath(input),tolerancePx=number(options.tolerancePx??.25,'tolerancePx',.000001,5);
    const maxDepth=number(options.maxDepth??16,'maxDepth',1,24);
    const maxPoints=number(options.maxPoints??MAX_POINTS,'maxPoints',2,MAX_POINTS);
    if(!Number.isInteger(maxDepth)||!Number.isInteger(maxPoints))fail('maxDepth/maxPoints must be integers');
    let segments=path.segments;
    if(path.closed){
      const last=segments.at(-1).p3,first=segments[0].p0;
      if(Math.hypot(last[0]-first[0],last[1]-first[1])>1e-9){
        const a=[last[0]+(first[0]-last[0])/3,last[1]+(first[1]-last[1])/3];
        const b=[last[0]+2*(first[0]-last[0])/3,last[1]+2*(first[1]-last[1])/3];
        segments=[...segments,{p0:last,p1:a,p2:b,p3:first}];
      }
    }
    const nodes=[{s:0,x:segments[0].p0[0],y:segments[0].p0[1],segment:0,t:0}],n=segments.length;
    let length=0,errorBound=0;
    function visit(s,index,t0,t1,depth,tolerance) {
      const chord=Math.hypot(s.p3[0]-s.p0[0],s.p3[1]-s.p0[1]);
      const control=Math.hypot(s.p1[0]-s.p0[0],s.p1[1]-s.p0[1])+
        Math.hypot(s.p2[0]-s.p1[0],s.p2[1]-s.p1[1])+Math.hypot(s.p3[0]-s.p2[0],s.p3[1]-s.p2[1]);
      const gap=control-chord;
      if(gap<=tolerance){
        if(nodes.length>=maxPoints)fail('arc-length vertex cap exceeded');
        length+=chord;errorBound+=Math.max(0,gap);
        nodes.push({s:length,x:s.p3[0],y:s.p3[1],segment:index,t:t1});
        return;
      }
      if(depth>=maxDepth)fail('arc-length tolerance cannot be reached within maxDepth');
      const [left,right]=split(s),half=(t0+t1)/2;
      visit(left,index,t0,half,depth+1,tolerance/2);
      visit(right,index,half,t1,depth+1,tolerance/2);
    }
    for(let i=0;i<n;i++)visit(segments[i],i,0,1,0,tolerancePx/n);
    return {path:{...path,segments},nodes,length,errorBound,tolerancePx};
  }
  function pointAtDistance(table,distance,pathFollow='clamp',reverse=false){
    number(distance,'path distance',-Infinity,Infinity);
    if(!['clamp','wrap','mirror'].includes(pathFollow))fail('pathFollow must be clamp, wrap or mirror');
    const length=table.length,first=table.nodes[0];
    if(!(length>0))return {x:first.x,y:first.y,distance:0,tangent:{x:1,y:0},angle:0,segment:0,t:0};
    let d=distance;
    if(pathFollow==='wrap')d=((d%length)+length)%length;
    else if(pathFollow==='mirror'){let q=((d%(2*length))+(2*length))%(2*length);d=q>length?2*length-q:q;}
    else d=clamp(d,0,length);
    if(reverse)d=length-d;
    let lo=0,hi=table.nodes.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1;if(table.nodes[m].s<=d)lo=m;else hi=m;}
    const a=table.nodes[lo],b=table.nodes[hi],f=b.s>a.s?(d-a.s)/(b.s-a.s):0;
    const segment=table.path.segments[b.segment]||table.path.segments.at(-1);
    const startT=a.segment===b.segment?a.t:0,endT=b.t;
    let t=startT+(endT-startT)*f;
    // A flat cubic can still have highly nonlinear parameter speed.
    // Invert the projection onto this arc-table leaf's chord, rather
    // than interpolating t. The distance error is bounded by the leaf's
    // control-polygon excess plus the preceding table length error.
    if(f>0&&f<1){
      const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy);
      if(chord>0){
        const ux=dx/chord,uy=dy/chord,target=f*chord;
        let lower=startT,upper=endT;
        for(let i=0;i<48;i++){
          const p=evaluateCubic(segment,t);
          const residual=(p.x-a.x)*ux+(p.y-a.y)*uy-target;
          if(Math.abs(residual)<=1e-9)break;
          if(residual<0)lower=t;else upper=t;
          t=(lower+upper)/2;
        }
      }
    }
    const point=evaluateCubic(segment,t),tangent=derivative(segment,t);
    if(reverse){tangent.x=-tangent.x;tangent.y=-tangent.y;}
    return {x:point.x,y:point.y,distance:d,tangent,angle:Math.atan2(tangent.y,tangent.x),segment:b.segment,t};
  }
  function normalizeSpatial(input){
    if(!input)fail('spatial settings required');
    const path=normalizePath(input.path),mode=input.mode??'even';
    if(!sModes.includes(mode))fail('unknown spatial mode');
    const minSpacing=number(input.minSpacing??1,'minSpacing',.25,100000),
      maxSpacing=number(input.maxSpacing??500,'maxSpacing',minSpacing,100000),
      baseSpacingPx=number(input.baseSpacingPx??10,'baseSpacingPx',.25,100000),
      jitter=number(input.jitter??0,'jitter',0,.45),
      seed=number(input.seed??0,'seed',-2147483648,2147483647),
      maxPoints=number(input.maxPoints??1024,'maxPoints',1,MAX_POINTS);
    if(!Number.isInteger(seed)||!Number.isInteger(maxPoints))fail('seed/maxPoints must be integers');
    const pathFollow=input.pathFollow??'clamp';
    if(!['clamp','wrap','mirror'].includes(pathFollow))fail('pathFollow invalid');
    const spacingCurve=validateCurve(input.spacingCurve,'spacingPx','pathPosition');
    if(spacingCurve&&spacingCurve.valueUnit!=='px')fail('spacingCurve must output px');
    return {schemaVersion:1,path,mode,baseSpacingPx,minSpacing,maxSpacing,jitter,seed,maxPoints,
      spacingCurve,pathFollow,alignToTangent:input.alignToTangent!==false,
      reverse:input.reverse===true,tolerancePx:input.tolerancePx??.25};
  }
  function createSpatialPlacement(input){
    const c=normalizeSpatial(input),table=buildArcTable(c.path,{tolerancePx:c.tolerancePx}),
      points=[],random=rng(c.seed^0x32d8823a);
    if(table.length<=0)return {config:c,table,points,capped:false};
    let distance=0,capped=false,index=0;
    while(distance<table.length-1e-9){
      const u=distance/table.length;
      let spacing=c.spacingCurve?Curves.evaluate(c.spacingCurve,u):c.baseSpacingPx;
      if(c.mode==='random')spacing*=.5+random();
      if(c.mode==='stratified')spacing*=.8+.4*random();
      if(c.mode==='clustered')spacing*=index%5<3?.55:1.675;
      if(c.jitter)spacing*=1+(2*random()-1)*c.jitter;
      const step=clamp(spacing,c.minSpacing,c.maxSpacing);
      distance+=step;
      if(c.path.closed && distance>=table.length-1e-9)break; // seam is never duplicated
      if(distance>table.length+1e-9)break;
      if(points.length>=c.maxPoints){capped=true;break;}
      const position=pointAtDistance(table,distance,c.pathFollow,c.reverse);
      points.push({index:points.length,distance,x:position.x,y:position.y,
        angle:c.alignToTangent?position.angle:0,tangent:c.alignToTangent?position.tangent:null,
        normalizedDistance:distance/table.length});
      index++;
    }
    return {config:c,table,points,capped};
  }
  function combineSchedule({schedule,placement,motion=[],mode='time',teleportThresholdPx=512,maxEvents=2048}){
    if(!['time','distance','both'].includes(mode))fail('combined mode must be time/distance/both');
    number(teleportThresholdPx,'teleportThresholdPx',0,1e7);
    number(maxEvents,'maxEvents',1,MAX_EVENTS);
    if(!Number.isInteger(maxEvents))fail('maxEvents must be an integer');
    if(!schedule||!Array.isArray(schedule.events)||!placement||!Array.isArray(placement.points))fail('schedule/placement required');
    const anchors=placement.points;
    if(!anchors.length)return {events:[],capped:false};
    const follow=placement.config?.pathFollow??'clamp';
    const closed=placement.table?.path?.closed===true;
    function chooseAnchor(i){
      if(follow==='wrap'||closed)return anchors[i%anchors.length];
      if(follow==='mirror'){
        const period=Math.max(1,2*(anchors.length-1)),j=i%period;
        return anchors[j>=anchors.length?period-j:j];
      }
      return anchors[Math.min(i,anchors.length-1)];
    }
    const stops=motion.map(m=>({time:number(m.time,'motion time',0,1e9),
      x:number(m.x,'motion x',-1e6,1e6),y:number(m.y,'motion y',-1e6,1e6),teleport:m.teleport===true}));
    for(let i=1;i<stops.length;i++)if(stops[i].time<=stops[i-1].time)fail('motion timestamps must increase');
    const result=[];let capped=false;
    function append(time,point){
      if(result.length>=maxEvents){capped=true;return false;}
      result.push({time,index:result.length,anchorIndex:point.index,
        x:point.x,y:point.y,angle:point.angle,distance:point.distance});return true;
    }
    if(mode==='time'){
      for(const e of schedule.events){
        if(!append(e.time,chooseAnchor(result.length)))break;
      }
      return {events:result,capped};
    }
    const pathLength=placement.table.length;
    const threshold=i=>anchors[i%anchors.length].distance+Math.floor(i/anchors.length)*pathLength;
    let cumulative=0,next=0,prev=stops[0],heading=0;
    const traversed=[{time:stops[0]?.time??0,distance:0,teleport:false,angle:0}];
    for(let i=1;i<stops.length;i++){
      const now=stops[i],distance=Math.hypot(now.x-prev.x,now.y-prev.y);
      const teleport=now.teleport||distance>teleportThresholdPx;
      const angle=teleport?heading:Math.atan2(now.y-prev.y,now.x-prev.x);
      if(!teleport) {
        if(distance>0)heading=angle;
        const before=cumulative;
        cumulative+=distance;
        if(mode==='distance'){
          while(next<MAX_EVENTS && threshold(next)<=cumulative+1e-9){
            const fraction=clamp((threshold(next)-before)/Math.max(distance,1e-12),0,1);
            const point={...chooseAnchor(next),
              x:prev.x+(now.x-prev.x)*fraction,y:prev.y+(now.y-prev.y)*fraction,
              angle:Math.atan2(now.y-prev.y,now.x-prev.x)};
            if(!append(prev.time+(now.time-prev.time)*fraction,point))break;
            next++;
          }
        }
      }
      traversed.push({time:now.time,distance:cumulative,teleport,angle});
      prev=now;
      if(capped)break;
    }
    if(mode==='both'){
      next=0;
      for(const e of schedule.events){
        let d=0,motionPoint=null;
        if(stops.length){
          if(e.time>=traversed.at(-1).time){
            d=cumulative;
            motionPoint={...stops.at(-1),angle:traversed.at(-1).angle};
          }else if(e.time>=traversed[0].time){
            let left=0,right=traversed.length-1;
            while(left+1<right){
              const mid=(left+right)>>1;
              if(traversed[mid].time<e.time)left=mid;else right=mid;
            }
            const a=traversed[left],b=traversed[right],fraction=clamp((e.time-a.time)/(b.time-a.time),0,1);
            d=a.distance+(b.distance-a.distance)*fraction;
            const lo=stops[left],hi=stops[right];
            // A discontinuity is a jump at the destination timestamp, not motion.
            const f=b.teleport?(e.time>=b.time?1:0):fraction;
            motionPoint={x:lo.x+(hi.x-lo.x)*f,y:lo.y+(hi.y-lo.y)*f,
              angle:b.angle};
          }else motionPoint={...stops[0],angle:0};
        }
        if(d+1e-9>=threshold(next)){
          const anchor=chooseAnchor(next);
          const position=motionPoint?{...anchor,x:motionPoint.x,y:motionPoint.y,angle:motionPoint.angle}:anchor;
          if(!append(e.time,position))break;
          next++;
        }
      }
    }
    return {events:result,capped};
  }
  return {VERSION:1,normalizeTemporal,createTemporalSchedule,createCursor,normalizePath,
    evaluateCubic,buildArcTable,pointAtDistance,normalizeSpatial,createSpatialPlacement,combineSchedule};
});
