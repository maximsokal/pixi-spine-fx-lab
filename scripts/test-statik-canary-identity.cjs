'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const os=require('node:os'),path=require('node:path');
const {runHealth}=require('./run-statik-health.cjs');
// Synthetic responses of the pinned CLI, not a real analyzer run.
const fixture=String.raw`
const mode=process.env.FIXTURE_MODE,cmd=process.argv[2];
const wind='assets/wind-gust/src/wind-core.js',curve='assets/template/src/curve-core.js';
const row=(file_id,path)=>({file_id,path,confidence:'Certain'});
const emit=v=>console.log(JSON.stringify(v));
if(cmd==='index')emit({files_indexed:6});
else if(cmd==='dead-code'){
 let dead_files=[];
 if(mode==='dead-wind')dead_files=[row(1,wind)];
 if(mode==='dead-curve')dead_files=[row(2,curve)];
 if(mode==='dead-curve-alias')dead_files=[row(2,'./'+curve)];
 if(mode==='dead-unrelated')dead_files=[row(3,'other.js')];
 if(mode==='dead-duplicate-id')dead_files=[row(3,'other.js'),row(3,'third.js')];
 if(mode==='dead-duplicate-path')dead_files=[row(3,'other.js'),row(4,'./other.js')];
 if(mode==='dead-invalid-row')dead_files=[null];
 if(mode==='dead-id-mismatch')dead_files=[row(2,'other.js')];
 emit({dead_files,summary:{total_files:6,dead_files:dead_files.length,entry_points:2}});
}else if(cmd==='deps'){
 let imports=[{file_id:2,path:curve,depth:1,imported_names:['*']}];
 if(mode==='duplicate-path')imports.push({...imports[0],file_id:3,path:'./'+curve});
 if(mode==='self-id')imports[0].file_id=1;
 emit({target_file:mode==='invalid-target-id'?'1':1,target_path:wind,imports,summary:{direct_imports:imports.length,transitive_imports:imports.length}});
}else if(cmd==='lint')console.log('fixture lint ran');
else process.exit(9);
`;
if(process.argv[2]==='--fixture')process.exitCode=runHealth(process.execPath,[process.argv[3]]);
else for(const [mode,status,label] of [
 ['healthy',0,'PASS'],['dead-unrelated',0,'PASS'],
 ['dead-wind',2,'DEGRADED'],['dead-curve',2,'DEGRADED'],['dead-curve-alias',2,'DEGRADED'],
 ['dead-duplicate-id',1,'ERROR'],['dead-duplicate-path',1,'ERROR'],['dead-invalid-row',1,'ERROR'],
 ['dead-id-mismatch',1,'ERROR'],['duplicate-path',1,'ERROR'],['self-id',1,'ERROR'],['invalid-target-id',1,'ERROR']
])test('canary identity: '+mode,()=>{
 const cwd=mkdtempSync(path.join(os.tmpdir(),'statik-identity-'));
 try{
  const file=path.join(cwd,'fixture.cjs');writeFileSync(file,fixture);
  const r=spawnSync(process.execPath,[__filename,'--fixture',file],{cwd,encoding:'utf8',timeout:10000,env:{...process.env,FIXTURE_MODE:mode}});
  A.ifError(r.error);const out=r.stdout+r.stderr;A.equal(r.status,status,out);A.match(out,new RegExp('Statik health: '+label));
  if(status===0)A.match(out,/fixture lint ran/);else {A.doesNotMatch(out,/fixture lint ran/);A.doesNotMatch(out,/Statik health: PASS/);}
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
