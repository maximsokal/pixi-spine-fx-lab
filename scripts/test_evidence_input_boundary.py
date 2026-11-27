#!/usr/bin/env python3
"""Reject ambiguous on-disk reports and bound evidence reads before PNG parsing."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib
import effect_validation as V


def png():
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data)&0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))+
            chunk(b'IDAT',zlib.compress(bytes([0,255,240,230,128])))+chunk(b'IEND',b''))


class InputBoundaryTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup);self.root=Path(tmp.name)
        self.file=self.root/'phase.png';data=png();self.file.write_bytes(data)
        self.evidence={'path':'phase.png','sha256':hashlib.sha256(data).hexdigest()}
        self.ref={'blueprint':{'effectVersion':'0.1.0','rng':{'policy':'seeded-per-instance','seedParameter':'seed'}},
                  'phases':['start'],'parameters':['seed'],'status':'reference-implementation'}
        mock=patch.object(V,'catalog_requirements',return_value={'fx.fire.fixture':self.ref});mock.start();self.addCleanup(mock.stop)
        self.report={'schemaVersion':1,'effectId':'fx.fire.fixture','effectVersion':'0.1.0','sourceCommit':'a'*40,'status':'PASS',
                     'environment':{'browser':'synthetic','device':'unit test','gpu':'synthetic','requestedBackend':'webgl','actualBackend':'webgl2','glVersion':'WebGL 2.0 test','offline':True,'networkRequests':0},
                     'fixture':{'seed':1,'settings':{'seed':1},'width':1,'height':1,'fps':60,'asset':'synthetic','frameTimesSeconds':[0,.5,1]},
                     'checks':[{'id':'phase.start','kind':'visual','status':'PASS','expected':'visible','actual':{'visiblePixels':1},'tolerance':{},'evidence':[dict(self.evidence)]},
                               {'id':'parameter.seed','kind':'numeric','status':'PASS','expected':'measured','actual':{'before':1,'after':2},'tolerance':{},'evidence':[]},
                               {'id':'backend.actual','kind':'backend','status':'PASS','expected':'webgl2','actual':'webgl2','tolerance':{},'evidence':[]}],
                     'warnings':['Synthetic fixture; no actual GPU evidence']}

    def cli(self, raw, *flags):
        path=self.root/'report.json';path.write_text(raw,encoding='utf-8')
        out,err=io.StringIO(),io.StringIO()
        with patch.object(sys,'argv',['effect_validation.py',str(path),*flags]),contextlib.redirect_stdout(out),contextlib.redirect_stderr(err):
            code=V.main()
        return code,out.getvalue(),err.getvalue()

    def test_unique_keys_keep_release_and_candidate_status(self):
        raw=json.dumps(self.report)
        code,out,_=self.cli(raw,'--require-pass');self.assertEqual(code,0);self.assertEqual(json.loads(out)['status'],'PASS')
        self.ref['status']='specification-only'
        code,out,_=self.cli(raw,'--candidate');self.assertEqual(code,2);self.assertEqual(json.loads(out)['candidateStatus'],'PASS')

    def test_duplicate_keys_at_any_depth_reject_before_report_acceptance(self):
        raw=json.dumps(self.report)
        cases=[raw.replace('"status": "PASS"','"status": "FAIL", "status": "PASS"',1),
               raw.replace('"id": "phase.start"','"id": "other", "id": "phase.start"',1),
               raw.replace('"settings": {"seed": 1}','"settings": {"seed": 99, "seed": 1}',1),
               raw.replace('"visiblePixels": 1','"visiblePixels": 0, "visiblePixels": 1',1),
               raw.replace('"status": "PASS"','"st\\u0061tus": "PASS", "status": "PASS"',1)]
        for candidate in (False,True):
            self.ref['status']='specification-only' if candidate else 'reference-implementation'
            for ambiguous in cases:
                with self.subTest(candidate=candidate,raw=ambiguous[:110]):
                    self.assertNotEqual(raw,ambiguous)
                    code,out,err=self.cli(ambiguous,'--candidate' if candidate else '--require-pass')
                    self.assertEqual(code,1);self.assertEqual(out,'');self.assertIn('duplicate JSON key',err)

    def test_read_is_bounded_even_for_valid_png(self):
        original=Path.open;reads=[]
        class Stream:
            def __init__(self,stream):self.stream=stream
            def __enter__(self):return self
            def __exit__(self,*args):self.stream.close()
            def read(self,size=-1):reads.append(size);return self.stream.read(size)
        def opened(path,*args,**kwargs):return Stream(original(path,*args,**kwargs))
        with patch.object(Path,'open',opened):V.secure_evidence(self.evidence,self.root)
        self.assertEqual(reads,[32*1024*1024+1])

    def test_oversize_png_rejected_before_structure_decode(self):
        with self.file.open('r+b') as stream:stream.truncate(32*1024*1024+1)
        with patch.object(V,'_check_png_structure',side_effect=AssertionError('decode must not run')):
            with self.assertRaisesRegex(V.ValidationError,'exceeds 32 MiB'):
                V.secure_evidence(self.evidence,self.root)

    def test_valid_png_still_requires_matching_hash_and_containment(self):
        V.secure_evidence(self.evidence,self.root)
        for item in [dict(self.evidence,sha256='0'*64),dict(self.evidence,path='../phase.png')]:
            with self.assertRaises(V.ValidationError):V.secure_evidence(item,self.root)


if __name__=='__main__':unittest.main(verbosity=2)
