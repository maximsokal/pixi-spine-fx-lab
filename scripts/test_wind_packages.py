#!/usr/bin/env python3
"""Validate actual browser-generated Wind Gust PNG and developer ZIP contents."""
from pathlib import Path
import json,shutil,subprocess,sys,tempfile,zipfile
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(tempfile.gettempdir())/'wind-qa'
out=source/'extracted'
out.mkdir(exist_ok=True,parents=True)
archives=[
 ('wind-burst.zip','burst',40),
 ('wind-loop.zip','loop',60),
 ('wind-webgl.zip','webgl',None),
 ('wind-webgpu.zip','webgpu',None)]
for archive,folder,frames in archives:
 path=source/archive
 if not path.exists():raise RuntimeError('Missing actual browser archive '+str(path))
 with zipfile.ZipFile(path) as z:
  corrupt=z.testzip()
  if corrupt:raise RuntimeError('ZIP CRC invalid: '+corrupt)
  names=z.namelist()
  if any(n.startswith('/') or '\\' in n or '..' in Path(n).parts for n in names):
   raise RuntimeError('ZIP contains path traversal')
  dest=out/folder
  dest.mkdir(exist_ok=True)
  z.extractall(dest)
  if frames:
   m=json.loads((dest/'sequence.json').read_text(encoding='utf8'))
   if (m.get('effectId')!='fx.air.wind-gust' or
    m.get('frameCount')!=frames or len(m.get('frames',[]))!=frames):
    raise RuntimeError('Wrong source frame count or metadata')
  print(archive,'CRC PASS, entries=',len(names),'bytes=',path.stat().st_size,flush=True)
for backend in ('webgl','webgpu'):
 folder=out/backend
 norm=lambda s:'\n'.join(line.rstrip() for line in s.splitlines()).strip()
 for source_name,package in [('wind-core.js','FxWind.mjs'),
                             ('wind-runtime.js','Wind.mjs')]:
  original=(root/'assets/wind-gust/src'/source_name).read_text(encoding='utf8')
  exported=(folder/package).read_text(encoding='utf8')
  if norm(original) not in norm(exported):
   raise RuntimeError(backend+' developer source drift: '+source_name)
 print('Exact core/runtime ESM source parity',backend,'PASS',flush=True)
npm=shutil.which('npm.cmd') or shutil.which('npm')
if not npm:raise RuntimeError('npm missing')
for backend in ('webgl','webgpu'):
 folder=out/backend
 for argv in ([npm,'install','--offline','--no-audit','--no-fund'],
              [npm,'run','build']):
  run=subprocess.run(argv,cwd=folder,text=True,
   stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=160)
  print(backend,' '.join(argv[1:]),'exit',run.returncode,flush=True)
  print(run.stdout[-1550:],flush=True)
  if run.returncode:sys.exit(run.returncode)
print('PASS AIR-01 40/60 PNG CRC, exact WebGL/WebGPU ESM, both offline Vite builds',flush=True)
