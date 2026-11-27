#!/usr/bin/env python3
"""Candidate collection is not release certification, including with all checks PASS."""
import copy
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
import effect_validation as fxv


def png():
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data)&0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))+
            chunk(b'IDAT',zlib.compress(bytes([0,255,240,230,128])))+chunk(b'IEND',b''))


class CandidateEvidenceTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup);self.root=Path(tmp.name)
        data=png();(self.root/'phase.png').write_bytes(data)
        self.evidence={'path':'phase.png','sha256':hashlib.sha256(data).hexdigest()}
        self.ref={'blueprint':{'effectVersion':'0.1.0','rng':{'policy':'seeded-per-instance','seedParameter':'seed'}},
                  'phases':['start','middle','seam'],'parameters':['seed'],'status':'specification-only'}
        self.catalog={'fx.air.snowfall':self.ref}
        mock=patch.object(fxv,'catalog_requirements',return_value=self.catalog);mock.start();self.addCleanup(mock.stop)
        self.report={'schemaVersion':1,'effectId':'fx.air.snowfall','effectVersion':'0.1.0','sourceCommit':'a'*40,'status':'PASS',
                     'environment':{'browser':'synthetic fixture','device':'unit test','gpu':'synthetic fixture','requestedBackend':'webgl','actualBackend':'webgl2','glVersion':'WebGL 2.0 test','offline':True,'networkRequests':0},
                     'fixture':{'seed':7321,'settings':{'seed':7321},'width':1,'height':1,'fps':60,'asset':'synthetic','frameTimesSeconds':[0,.5,1]},
                     'checks':[{'id':'phase.'+key,'kind':'visual','status':'PASS','expected':'measured fixture','actual':{'visiblePixels':1},'tolerance':{},'evidence':[dict(self.evidence)]} for key in self.ref['phases']]+[
                         {'id':'parameter.seed','kind':'numeric','status':'PASS','expected':'sample changed','actual':{'before':1,'after':2},'tolerance':{},'evidence':[]},
                         {'id':'backend.actual','kind':'backend','status':'PASS','expected':'webgl2','actual':'webgl2','tolerance':{},'evidence':[]}],
                     'warnings':['Synthetic unit test, no real renderer evidence']}

    def validate(self, report=None, **kwargs):
        return fxv.validate_report(self.report if report is None else report,self.root,self.root,**kwargs)

    def cli(self,*args,report=None):
        path=self.root/'report.json';path.write_text(json.dumps(self.report if report is None else report),encoding='utf-8')
        out,err=io.StringIO(),io.StringIO()
        with patch.object(sys,'argv',['effect_validation.py',str(path),*args]), contextlib.redirect_stdout(out),contextlib.redirect_stderr(err):
            try:code=fxv.main()
            except SystemExit as exc:code=exc.code
        return code,out.getvalue(),err.getvalue()

    def test_default_release_boundary_is_unchanged(self):
        with self.assertRaises(fxv.ValidationError):self.validate()
        self.assertEqual(self.cli('--require-pass')[0],1)
        self.ref['status']='reference-implementation'
        result=self.validate()
        self.assertEqual(result['status'],'PASS');self.assertNotIn('candidateStatus',result)
        self.assertEqual(self.cli('--require-pass')[0],0)

    def test_all_pass_candidate_cannot_produce_release_pass(self):
        result=self.validate(candidate=True)
        self.assertEqual(result['status'],'NOT RUN');self.assertEqual(result['candidateStatus'],'PASS')
        self.assertIs(result['releaseEligible'],False);self.assertEqual(result['validationMode'],'candidate')
        code,out,_=self.cli('--candidate');self.assertEqual(code,2);self.assertEqual(json.loads(out),result)
        self.assertEqual(self.ref['status'],'specification-only');self.assertEqual(self.report['status'],'PASS')
        self.assertEqual(self.cli('--candidate','--require-pass')[0],2)

    def test_candidate_preserves_failure_and_incomplete_measurements(self):
        for status in ('FAIL','NOT RUN'):
            with self.subTest(status=status):
                r=copy.deepcopy(self.report);r['status']=status
                c=r['checks'][0];c['status']=status
                if status=='NOT RUN':c.update(actual=None,evidence=[],reason='skipped')
                else:c['actual']={'visiblePixels':0}
                result=self.validate(r,candidate=True)
                self.assertEqual(result['candidateStatus'],status);self.assertEqual(result['status'],status)
                self.assertFalse(result['releaseEligible']);self.assertEqual(self.cli('--candidate',report=r)[0],2)
                with self.assertRaises(fxv.ValidationError):self.validate(r)

    def test_candidate_cannot_bypass_evidence_or_coverage(self):
        cases=[lambda r:r['checks'].pop(0), lambda r:r['checks'][0].update(kind='numeric'),
               lambda r:r['checks'][0].update(evidence=[]),lambda r:r['checks'][0]['evidence'][0].update(sha256='0'*64),
               lambda r:r['checks'][0]['evidence'][0].update(path='../phase.png'),
               lambda r:r['environment'].update(actualBackend='webgpu'),lambda r:r['environment'].update(actualBackend=None),
               lambda r:r['environment'].update(networkRequests=1),lambda r:r['fixture'].update(seed=7322),
               lambda r:r['checks'][0].update(status='FAIL'),lambda r:r.update(schemaVersion=2),
               lambda r:r['checks'][0].update(actual={'visiblePixels':True}),lambda r:r['checks'].append(copy.deepcopy(r['checks'][0]))]
        for i,mutate in enumerate(cases):
            with self.subTest(case=i):
                r=copy.deepcopy(self.report);mutate(r)
                with self.assertRaises(fxv.ValidationError):self.validate(r,candidate=True)
        (self.root/'phase.png').write_bytes(b'not a PNG')
        r=copy.deepcopy(self.report)
        for c in r['checks']:
            for e in c['evidence']:e['sha256']=hashlib.sha256(b'not a PNG').hexdigest()
        with self.assertRaises(fxv.ValidationError):self.validate(r,candidate=True)

    def test_candidate_is_explicit_and_not_for_promoted_reference(self):
        self.ref['status']='reference-implementation'
        with self.assertRaises(fxv.ValidationError):self.validate(candidate=True)
        self.assertEqual(self.cli('--candidate')[0],1)
        self.assertEqual(self.validate()['status'],'PASS')


if __name__=='__main__':unittest.main(verbosity=2)
