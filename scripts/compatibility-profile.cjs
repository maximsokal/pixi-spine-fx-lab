'use strict';
// Opt-in planning only: no runtime installs, asset mutation, or fallback.
const PIXI=[5,6,7,8],SPINE=['3.7','3.8','4.0','4.1','4.2','4.3'];
const BASE='references/compatibility/';
const renderers=['webgl','webgl1','webgl2','webgpu'];
function fail(message){throw Error('COMPAT: '+message);}
function route({pixi,spine,renderer}={}){
 if(!PIXI.includes(pixi)||!SPINE.includes(spine))fail('select one supported Pixi major and Spine major.minor');
 if(renderer!==undefined&&(!renderers.includes(renderer)||(pixi<8&&renderer==='webgpu')))fail('renderer unavailable for selected Pixi major');
 const legacy=SPINE.indexOf(spine)<4;
 const status=legacy?(pixi===8?'unsupported':'research'):
  pixi<7?'unsupported':pixi===8&&spine==='4.2'?'baseline':'unverified';
 return {pixi,spine,status,canResolve:status==='baseline',
  docs:{pixi:BASE+`pixi/${pixi}.md`,spine:BASE+`spine/${spine}.md`,contract:BASE+'contract.md',qa:BASE+'qa-matrix.md',...(status==='research'?{legacy:BASE+'legacy-policy.md'}:{})},
  packageFamily:status==='research'?'pixi-spine':status==='unsupported'?null:`@esotericsoftware/spine-pixi-v${pixi}`};
}
function inspectExport(input){
 let data=input;
 if(typeof data==='string'){try{data=JSON.parse(data);}catch{fail('invalid Spine JSON');}}
 const version=data?.skeleton?.spine;
 if(typeof version!=='string'||! /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))fail('missing or invalid Spine JSON export metadata; binary requires matching parser');
 const majorMinor=version.split('.').slice(0,2).join('.');
 if(!SPINE.includes(majorMinor))fail('export family outside catalog: '+majorMinor);
 return {version,majorMinor,format:'json'};
}
function assertExport(input,expected){
 if(!SPINE.includes(expected))fail('invalid expected export family');
 const info=inspectExport(input);
 if(info.majorMinor!==expected)fail('export '+info.majorMinor+' does not match '+expected+'; re-export original source');
 return info;
}
function resolveProfile(request,manifest){
 const selected=route(request);
 if(!selected.canResolve)fail('pair '+selected.status+'; audit and pin an adapter before use');
 const {pixiVersion,spineVersion,renderer}=request;
 if(pixiVersion!=='8.22.0'||spineVersion!=='4.2.120'||!renderers.includes(renderer))fail('explicit baseline pins and renderer required');
 const runtime=manifest?.runtime;
 if(runtime?.pixi!==pixiVersion||runtime.spinePixiV8!==spineVersion||runtime.spineExport!=='4.2.x')fail('manifest pin mismatch');
 const files={};
 for(const path of ['vendor/pixi-8.22.0.min.js','vendor/spine-pixi-v8-4.2.120.min.js','licenses/pixi.txt','licenses/spine.txt']){
  const hash=manifest.protectedFiles?.[path];
  if(typeof hash!=='string'||! /^[a-f0-9]{64}$/.test(hash))fail('missing or invalid declared SHA256: '+path);
  files[path]=hash;
 }
 return {schemaVersion:1,profileId:'spine4.2-pixi8-baseline',
  pixi:{major:8,exactVersion:pixiVersion,renderer},spine:{exportMajorMinor:'4.2',package:selected.packageFamily,exactVersion:spineVersion},
  integration:{offline:true,assetFormats:['json','skel'],selection:'explicit'},docs:selected.docs,
  integrity:{algorithm:'sha256',status:'declared-not-rehashed',files},
  validation:{status:'baseline-only',currentRun:'NOT_RUN',backendActual:null,evidence:null}};
}
module.exports=Object.freeze({route,inspectExport,assertExport,resolveProfile});
if(require.main===module){
 try{
  const [action,pixi,spine,renderer,pixiVersion,spineVersion]=process.argv.slice(2);
  const request={pixi:Number(pixi),spine,renderer,pixiVersion,spineVersion};
  if(action!=='route'&&action!=='resolve')fail('usage: route <pixi-major> <spine-major.minor> [renderer] OR resolve <major> <family> <renderer> <pixi-exact> <spine-exact>');
  const result=action==='route'?route(request):resolveProfile(request,require('../assets/template/template.json'));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
