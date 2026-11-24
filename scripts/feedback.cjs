'use strict';
// Local consent primitive. Only a trusted host may call approve or supply transport.
const {createHash}=require('node:crypto');
const DEST='maximsokal/pixi-spine-fx-lab';
const drafts=new WeakSet();
const fields=new Set(['action','issue','title','summary','expected','actual','reproduction','environment','hypothesis','visibility','dedup']);
const sensitive=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:token|api[_ -]?key|password|secret|cookie)\s*[:=]|\b(?:gh[pousr]_|github_pat_|sk-)[\w-]+|authorization\s*:|\bBearer\s+\S+|[a-z]:[\\/]|\/(?:home|Users|mnt|private)\/|https?:\/\/[^\s/]+:[^\s/]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
function requireOK(ok,message){if(!ok)throw Error('Feedback: '+message);}
function clean(value,name,max=1200){
 requireOK(typeof value==='string'&&value.trim()&&value.length<=max&&!/[\x00-\x08\x0b-\x1f\x7f]/.test(value),'invalid '+name);
 requireOK(!sensitive.test(value),'potentially sensitive '+name+'; remove and review');
 return value.trim();
}
function prepare(input){
 requireOK(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>fields.has(k)),'unexpected field');
 const {action,issue,visibility,dedup}=input;
 requireOK(action==='create'||action==='comment','invalid action');
 requireOK(action==='create'?issue===undefined:Number.isSafeInteger(issue)&&issue>0,'invalid issue');
 requireOK(['public','private','unknown'].includes(visibility),'invalid visibility');
 requireOK(dedup==='checked','dedup must be checked by host');
 const title=clean(input.title,'title',120);
 requireOK(!title.includes('\n'),'invalid title');
 requireOK(Array.isArray(input.reproduction)&&input.reproduction.length>=1&&input.reproduction.length<=10,'invalid reproduction');
 const body=['## Summary',clean(input.summary,'summary'),'## Environment',clean(input.environment,'environment'),'## Minimal reproduction',...input.reproduction.map((v,i)=>`${i+1}. ${clean(v,'reproduction',300)}`),'## Expected result',clean(input.expected,'expected'),'## Actual result',clean(input.actual,'actual'),'## Evidence','NOT REPRODUCED — independently verified evidence not provided.','## Likely cause','HYPOTHESIS — '+clean(input.hypothesis,'hypothesis'),'## Disclosure','Text-only draft; review all content and disclosure rights before approving.'].join('\n\n');
 const payload=Object.freeze({destination:DEST,action,...(action==='comment'?{issue}:{title}),body});
 const warning=visibility==='private'?'Content leaves this chat and may be copied or disclosed.':'Content leaves this chat and may become public, searchable and permanently copied.';
 const digest=createHash('sha256').update(JSON.stringify({payload,visibility,warning})).digest('hex');
 const draft=Object.freeze({...payload,title,visibility,warning,digest});drafts.add(draft);return draft;
}
function createGate(draft,send){
 requireOK(drafts.has(draft),'invalid draft');
 requireOK(send===undefined||typeof send==='function','invalid connector');
 drafts.delete(draft); // One gate per draft instance, even after cancellation or failure.
 let state='review';
 const payload=Object.freeze({destination:draft.destination,action:draft.action,...(draft.action==='comment'?{issue:draft.issue}:{title:draft.title}),body:draft.body});
 return Object.freeze({get state(){return state;},
  approve(digest){requireOK(state==='review'&&digest===draft.digest,'exact approval required');state='approved';},
  decline(){requireOK(state==='review'||state==='approved','cannot decline now');state='declined';},
  async publish(){
   requireOK(state==='approved','unused approval required');
   if(!send){state='unavailable';throw Error('Feedback: connector unavailable');}
   state='publishing';
   try{
    const r=await send(payload);
    requireOK(r&&Number.isSafeInteger(r.number)&&r.number>0,'invalid receipt');
    const url=`https://github.com/${DEST}/issues/${r.number}`;
    requireOK(draft.action==='create'?r.url===url:r.number===draft.issue&&typeof r.url==='string'&&r.url.startsWith(url+'#issuecomment-')&&/^\d+$/.test(r.url.slice((url+'#issuecomment-').length)),'invalid receipt destination');
    state='published';return Object.freeze({number:r.number,url:r.url});
   }catch(error){state='uncertain';throw new Error('Feedback: publication unconfirmed; reconcile before any new approval',{cause:error});}
  }
 });
}
module.exports=Object.freeze({prepare,createGate});
