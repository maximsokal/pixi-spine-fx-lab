#!/usr/bin/env node
'use strict';
// FX-CORE-08 RED->GREEN: path geometry, taper, branching, quality limits.
const assert=require('node:assert/strict');
const S=require('../assets/template/src/spacing-core.js');
const P=require('../assets/template/src/path-core.js');
const close=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e, String(a)+' != '+String(b));
const path=(x=100,y=0)=>({schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[x/3,y/2],p2:[2*x/3,y/2],p3:[x,y]}]});
const width={start:8,middle:24,end:4,startTaper:0,endTaper:0,minVisiblePx:.25};
const opts={path:path(),width,sampleSpacingPx:4,seed:11,quality:'balanced'};
const a=P.buildRibbon(opts);
assert.equal(a.schemaVersion,1);
assert.ok(a.table.length>=100&&a.errorBound<=.25);
assert.equal(a.positions.length,a.samples.length*4);
assert.equal(a.uvs.length,a.samples.length*4);
assert.equal(a.indices.length,(a.samples.length-1)*6);
assert.ok(a.positions instanceof Float32Array&&a.indices instanceof Uint16Array);
close(P.widthAt(width,0),8);close(P.widthAt(width,.5),24);close(P.widthAt(width,1),4);
const t=P.buildRibbon({...opts,width:{...width,startTaper:1,endTaper:1}});
close(t.samples[0].width,0);close(t.samples.at(-1).width,0);
close(t.samples[Math.floor(t.samples.length/2)].width,24,1e-4);
const l=P.buildRibbon({...opts,width:{...width,startTaper:1}});
const r=P.buildRibbon({...opts,width:{...width,endTaper:1}});
close(l.samples[0].width,0);close(l.samples.at(-1).width,4);
close(r.samples[0].width,8);close(r.samples.at(-1).width,0);
const c={schemaVersion:1,parameterKey:'widthMultiplier',domain:'pathPosition',inputUnit:'normalized-path',
 valueUnit:'normalized',inputRange:[0,1],valueRange:[0,2],defaultValue:1,clamp:'hold',monotonic:false,
 keys:[{id:'first',x:0,y:.5,mode:'linear'},{id:'last',x:1,y:1.5,mode:'linear'}]};
close(P.widthAt({...width,curve:c},0),4);close(P.widthAt({...width,curve:c},1),6);
const curved=path(120,90),arc=S.buildArcTable(curved),cr=P.buildRibbon({...opts,path:curved,sampleSpacingPx:8});
close(cr.table.length,arc.length,.25);
for(const s of cr.samples){
 const at=S.pointAtDistance(arc,s.distance);
 close(s.x,at.x,.25);close(s.y,at.y,.25);
 assert.ok(Number.isFinite(s.normal.x)&&Number.isFinite(s.normal.y)&&Math.hypot(s.normal.x,s.normal.y)<4);
}
const straightSplit={schemaVersion:1,closed:false,segments:[
 {p0:[0,0],p1:[50/3,0],p2:[100/3,0],p3:[50,0]},
 {p0:[50,0],p1:[50+50/3,0],p2:[50+100/3,0],p3:[100,0]}]};
const one=P.placeElements({path:path(),spacingPx:10,seed:9,mode:'even'});
const two=P.placeElements({path:straightSplit,spacingPx:10,seed:9,mode:'even'});
assert.deepEqual(one.points.map(p=>p.distance),two.points.map(p=>p.distance),
 'control segment count must never change arc-distance placements');
const place=P.placeElements({path:curved,spacingPx:15,seed:3,mode:'even',maxPoints:80});
const expected=S.createSpatialPlacement({path:curved,baseSpacingPx:15,minSpacing:.25,maxSpacing:100000,
 jitter:0,seed:3,mode:'even',maxPoints:80,alignToTangent:true,pathFollow:'clamp'});
assert.deepEqual(place.points.map(q=>q.distance),expected.points.map(q=>q.distance));
assert.ok(place.points.length>P.placeElements({path:curved,spacingPx:30,seed:3,mode:'even',maxPoints:80}).points.length);
const seeded=P.buildRibbon({...opts,edgeIrregularity:.22});
assert.deepEqual(seeded.positions,P.buildRibbon({...opts,edgeIrregularity:.22}).positions);
assert.notDeepEqual(seeded.positions,P.buildRibbon({...opts,edgeIrregularity:.22,seed:12}).positions);
assert.deepEqual(a.positions,P.buildRibbon({...opts,edgeIrregularity:0,seed:200}).positions);
const zeroWidth=P.buildRibbon({...opts,width:{...width,start:0,middle:0,end:0}});
assert.equal(zeroWidth.indices.length,0,'all-width-zero ribbon must have no hidden triangles');
const zero=P.buildRibbon({...opts,path:path(0,0)});
assert.equal(zero.positions.length,0);assert.equal(zero.indices.length,0);
const crossing={schemaVersion:1,closed:false,segments:[
 {p0:[0,0],p1:[80,80],p2:[-80,80],p3:[0,0]},
 {p0:[0,0],p1:[80,-80],p2:[-80,-80],p3:[0,0]}]};
const intersection=P.buildRibbon({...opts,path:crossing});
assert.ok(intersection.indices.length>0);
assert.ok([...intersection.positions].every(Number.isFinite));
const closed={schemaVersion:1,closed:true,segments:[
 {p0:[0,0],p1:[45,0],p2:[65,60],p3:[100,50]},
 {p0:[100,50],p1:[80,100],p2:[10,100],p3:[0,0]}]};
const loop=P.buildRibbon({...opts,path:closed,width:{...width,end:width.start}});
close(loop.samples[0].x,loop.samples.at(-1).x);
close(loop.samples[0].y,loop.samples.at(-1).y);
close(loop.samples[0].normal.x,loop.samples.at(-1).normal.x,1e-6);
assert.throws(()=>P.buildRibbon({...opts,path:closed}),/closed|seam|width/i);
const sharp={schemaVersion:1,closed:false,segments:[
 {p0:[0,0],p1:[20,0],p2:[40,0],p3:[50,0]},
 {p0:[50,0],p1:[50,50],p2:[50,60],p3:[50,70]}]};
const originalSharp=P.smoothPath(sharp,0),roundedSharp=P.smoothPath(sharp,1);
assert.deepEqual(originalSharp,sharp);
const seamIn=roundedSharp.segments[0],seamOut=roundedSharp.segments[1];
const vin=[seamIn.p3[0]-seamIn.p2[0],seamIn.p3[1]-seamIn.p2[1]];
const vout=[seamOut.p1[0]-seamOut.p0[0],seamOut.p1[1]-seamOut.p0[1]];
close(vin[0]*vout[1]-vin[1]*vout[0],0,1e-6);
assert.notDeepEqual(P.buildRibbon({...opts,path:sharp,curvatureSmoothing:0}).positions,
 P.buildRibbon({...opts,path:sharp,curvatureSmoothing:1}).positions);
const kink=P.buildRibbon({...opts,path:sharp,miterLimit:2});
assert.ok(kink.samples.every(s=>Number.isFinite(s.normal.x)&&Math.hypot(s.normal.x,s.normal.y)<=2+1e-6));
const root={id:'stem',path:curved,width};
const childPath={schemaVersion:1,closed:false,segments:[{
 p0:[0,0],p1:[10,12],p2:[20,24],p3:[30,36]}]};
const child={id:'left',parentId:'stem',attachDistancePx:45,path:childPath,widthRatio:.5};
const grand={id:'tip',parentId:'left',attachDistancePx:12,path:childPath,widthRatio:.6};
const graph=P.buildGraph({schemaVersion:1,seed:11,quality:'balanced',sampleSpacingPx:4,
 root,branches:[grand,child]});
assert.deepEqual(graph.branches.map(b=>b.id),['stem','left','tip']);
const origin=S.pointAtDistance(arc,45);
close(graph.branches[1].samples[0].x,origin.x,.25);
close(graph.branches[1].samples[0].y,origin.y,.25);
close(graph.branches[1].samples[0].width,P.widthAt(width,45/arc.length)*.5,.25);
assert.ok(graph.totalTriangles>0&&graph.totalTriangles<=graph.budget.maxTriangles);
assert.deepEqual(graph,P.buildGraph({schemaVersion:1,seed:11,quality:'balanced',sampleSpacingPx:4,root,branches:[grand,child]}));
assert.throws(()=>P.buildGraph({schemaVersion:1,root,branches:[{...child,parentId:'left'}]}),/cycle/i);
assert.throws(()=>P.buildGraph({schemaVersion:1,root,branches:[{...child,parentId:'missing'}]}),/parent/i);
assert.throws(()=>P.buildGraph({schemaVersion:1,root,branches:[{...child,attachDistancePx:1e7}]}),/attach|distance/i);
assert.throws(()=>P.buildGraph({schemaVersion:1,root,branches:[child,{...child}]}),/duplicate/i);
const gopts={parentId:'stem',parentPath:curved,seed:18,branchCount:8,
 branchSpacingPx:15,branchLengthPx:35,spreadDeg:40,
 countRandomness:.2,curvatureRandomness:.3,thicknessRandomness:.25,intervalRandomness:.1};
const generated=P.generateBranches(gopts);
assert.ok(generated.length>0);
assert.deepEqual(generated,P.generateBranches(gopts));
const differentCurve=P.generateBranches({...gopts,curvatureRandomness:.8});
assert.deepEqual(generated.map(b=>b.attachDistancePx),differentCurve.map(b=>b.attachDistancePx));
assert.deepEqual(generated.map(b=>b.widthRatio),differentCurve.map(b=>b.widthRatio));
assert.notDeepEqual(generated.map(b=>b.path),differentCurve.map(b=>b.path));
const differentThickness=P.generateBranches({...gopts,thicknessRandomness:.7});
assert.deepEqual(generated.map(b=>b.attachDistancePx),differentThickness.map(b=>b.attachDistancePx));
assert.notDeepEqual(generated.map(b=>b.widthRatio),differentThickness.map(b=>b.widthRatio));
assert.notDeepEqual(generated.map(b=>b.attachDistancePx),
 P.generateBranches({...gopts,branchSpacingPx:27}).map(b=>b.attachDistancePx));
assert.ok(P.buildGraph({schemaVersion:1,seed:18,quality:'high',sampleSpacingPx:3,
 root,branches:generated.slice(0,4)}).totalTriangles>0);
for(const invalid of [
 {...opts,sampleSpacingPx:0},{...opts,sampleSpacingPx:.0001},
 {...opts,width:{...width,start:-1}}, {...opts,path:{schemaVersion:2,closed:false,segments:[]}},
 {...opts,quality:'ultra'},{...opts,edgeIrregularity:2},{...opts,seed:Infinity},
 {...opts,sampleSpacingPx:.25,quality:'low',path:path(10000)}
])assert.throws(()=>P.buildRibbon(invalid),/invalid|limit|budget|path|width|spacing|quality|seed/i);
assert.throws(()=>P.generateBranches({...gopts,branchCount:900}),/budget|count|limit/i);
assert.ok(a.indices.length/3<=P.BUDGETS.balanced.maxTriangles);
// Nonuniform collinear handles must not bunch leaves, ribbon vertices or branch anchors.
const slowLine={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,0],p2:[0,0],p3:[100,0]}]};
const slowRibbon=P.buildRibbon({...opts,path:slowLine,sampleSpacingPx:10});
for(const v of slowRibbon.samples)close(v.x,v.distance,.00001);
const leaves=P.placeElements({path:slowLine,spacingPx:10,mode:'even'});
for(const v of leaves.points)close(v.x,v.distance,.00001);
const slowGraph=P.buildGraph({schemaVersion:1,root:{id:'stem',path:slowLine,width},branches:[
 {id:'child',parentId:'stem',attachDistancePx:50,path:childPath,widthRatio:.5}
]});
close(slowGraph.branches[1].samples[0].x,50,.00001);
close(slowGraph.branches[1].samples[0].y,0,.00001);
console.log('PASS FX-CORE-08 arc-length ribbons, independent end taper, normal joins, closed curves, branching and caps');
