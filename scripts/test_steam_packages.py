from pathlib import Path
import os,shutil,subprocess,sys,tempfile,zipfile
root=Path(__file__).resolve().parents[1]
base=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(tempfile.gettempdir())/'steam-qa'
dir=base/'extracted'
dir.mkdir(exist_ok=True,parents=True)
for name,target in [('steam-baked.zip','baked'),('steam-webgl.zip','webgl'),('steam-webgpu.zip','webgpu')]:
 path=base/name
 if not path.exists(): raise RuntimeError('Missing actual browser ZIP '+str(path))
 with zipfile.ZipFile(path) as z:
  bad=z.testzip()
  if bad:raise RuntimeError('ZIP CRC failed '+name+'/'+bad)
  if any(n.startswith('/') or '..' in Path(n).parts for n in z.namelist()):
   raise RuntimeError('Unsafe ZIP member '+name)
  dest=dir/target
  dest.mkdir(exist_ok=True)
  z.extractall(dest)
  print(name,'CRC PASS',len(z.namelist()),'entries, bytes',path.stat().st_size,flush=True)
for target in ['webgl','webgpu']:
 dest=dir/target
 core=(root/'assets/steam-jet/src/steam-core.js').read_text(encoding='utf8')
 runtime=(root/'assets/steam-jet/src/steam-runtime.js').read_text(encoding='utf8')
 norm=lambda s:'\n'.join(x.rstrip() for x in s.splitlines()).strip()
 if norm(core) not in norm((dest/'FxSteam.mjs').read_text(encoding='utf8')):raise RuntimeError('ESM core changed '+target)
 if norm(runtime) not in norm((dest/'SteamJet.mjs').read_text(encoding='utf8')):raise RuntimeError('ESM runtime changed '+target)
 print('Source parity PASS',target,flush=True)
npm=shutil.which('npm.cmd') or shutil.which('npm')
if not npm: raise RuntimeError('npm not installed')
for target in ['webgl','webgpu']:
 dest=dir/target
 for args in ([npm,'install','--offline','--no-audit','--no-fund'],
              [npm,'run','build']):
  result=subprocess.run(args,cwd=dest,text=True,stdout=subprocess.PIPE,
   stderr=subprocess.STDOUT,timeout=140)
  print(target,' '.join(args[1:]),'exit',result.returncode,flush=True)
  print(result.stdout[-2300:],flush=True)
  if result.returncode:sys.exit(result.returncode)
print('PASS WATER-06 actual ZIP extraction, CRC, exact ESM parity, both offline Vite builds',flush=True)
