'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('./feedback.cjs');
const input=()=>({action:'create',title:'FX preview freezes',summary:'Preview fails after reset.',expected:'Preview updates.',actual:'Preview remains static.',reproduction:['Open synthetic fixture','Reset preview'],environment:'Pixi 8.22.0',hypothesis:'Stale state',visibility:'unknown',dedup:'checked'});
const prepare=(overrides={})=>F.prepare({...input(),...overrides});
const gate=(d,send=async()=>({number:123,url:'https://github.com/maximsokal/pixi-spine-fx-lab/issues/123'}))=>F.createGate(d,send);
test('draft is exact, immutable, text only and unverified by default',()=>{
 const d=prepare();assert.equal(d.destination,'maximsokal/pixi-spine-fx-lab');assert.ok(d.warning.includes('public'));assert.match(d.body,/NOT REPRODUCED/);assert.match(d.body,/HYPOTHESIS/);assert.ok(Object.isFrozen(d));assert.equal(d.digest.length,64);
 assert.throws(()=>prepare({attachments:['private.png']}),/field/);assert.throws(()=>prepare({summary:'hello test@example.com'}),/sensitive/);
});
test('sensitive content held rather than silently transmitted',()=>{
 for(const summary of ['token=abc123','ghp_abcdefghijklmnopqrstuvwxyz1234567890','C:\\Users\\Alice\\secret.json','/home/alice/private','Authorization: Bearer secret','https://user:pass@example.com','-----BEGIN PRIVATE KEY-----'])assert.throws(()=>prepare({summary}),/sensitive/);
});
test('dedup not checked, ambiguous destination, invalid comment and transcript rejected',()=>{
 for(const bad of [{dedup:'unknown'},{destination:'other/repo'},{action:'comment'},{action:'create',issue:42},{transcript:'chat'}])assert.throws(()=>prepare(bad));
});
test('silence, wrong approval, decline and no connector never send',async()=>{
 let calls=0;const d=prepare(),g=gate(d,async()=>{calls++});await assert.rejects(g.publish(),/approval/);assert.throws(()=>g.approve('wrong'),/approval/);g.decline();assert.throws(()=>g.approve(d.digest),/approval/);await assert.rejects(g.publish(),/approval/);assert.equal(calls,0);
 const fresh=prepare(),offline=F.createGate(fresh);offline.approve(fresh.digest);await assert.rejects(offline.publish(),/connector/);assert.equal(offline.state,'unavailable');
});
test('one exact approved create even with overlapping attempts',async()=>{
 const d=prepare();let calls=0;let finish;const g=gate(d,async payload=>{calls++;assert.deepEqual(payload,{destination:d.destination,action:'create',title:d.title,body:d.body});return new Promise(r=>finish=r)});
 g.approve(d.digest);const p=g.publish();await assert.rejects(g.publish(),/approval/);finish({number:123,url:'https://github.com/maximsokal/pixi-spine-fx-lab/issues/123'});assert.equal((await p).number,123);assert.equal(g.state,'published');await assert.rejects(g.publish(),/approval/);assert.equal(calls,1);
});
test('edited draft and action have different digest and require new approval',()=>{
 const a=prepare(),b=prepare({actual:'Different output'}),c=prepare({action:'comment',issue:42});assert.notEqual(a.digest,b.digest);assert.notEqual(a.digest,c.digest);assert.throws(()=>gate(b).approve(a.digest),/approval/);assert.throws(()=>gate(c).approve(a.digest),/approval/);
});
test('comment only, exact issue receipt, no create fields',async()=>{
 const d=prepare({action:'comment',issue:42});const g=gate(d,async p=>{assert.deepEqual(p,{destination:d.destination,action:'comment',issue:42,body:d.body});return {number:42,url:'https://github.com/maximsokal/pixi-spine-fx-lab/issues/42#issuecomment-1'}});g.approve(d.digest);assert.equal((await g.publish()).number,42);
});
test('transport failure and malformed receipt block retry',async()=>{
 for(const send of [async()=>{throw Error('timeout')},async()=>({number:123,url:'https://example.com/issues/123'}),async()=>null]){let calls=0;const d=prepare(),g=gate(d,async p=>{calls++;return send(p)});g.approve(d.digest);await assert.rejects(g.publish());assert.equal(g.state,'uncertain');await assert.rejects(g.publish(),/approval/);assert.equal(calls,1)}
});
test('fabricated or mutated draft is rejected before approval',()=>{
 const d=prepare();assert.throws(()=>gate({...d,body:'modified'}),/draft/);assert.throws(()=>gate({...d}),/draft/);
});
test('a reviewed draft cannot acquire a second gate after decline or publication',async()=>{
 const d=prepare(),g=gate(d);g.decline();assert.throws(()=>gate(d),/draft/);
 const fresh=prepare(),approved=gate(fresh);approved.approve(fresh.digest);await approved.publish();assert.throws(()=>gate(fresh),/draft/);
});
