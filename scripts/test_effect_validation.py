#!/usr/bin/env python3
"""RED->GREEN for FX-CORE-07: validation-report contracts and honest coverage."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import struct
import zlib
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import effect_validation as fxv


def make_valid_png():
    def chunk(label, data):
        return (struct.pack(">I",len(data)) + label + data
                + struct.pack(">I",zlib.crc32(label+data)&0xffffffff))
    ihdr=struct.pack(">IIBBBBB",1,1,8,6,0,0,0)
    return (b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",ihdr)
            +chunk(b"IDAT",zlib.compress(bytes([0,255,128,0,64])))
            +chunk(b"IEND",b""))


class ReportContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        payload = make_valid_png()
        (self.dir / "phase.png").write_bytes(payload)
        sha = hashlib.sha256(payload).hexdigest()
        self.sha = sha
        self.report = {
            "schemaVersion": 1, "effectId": "fx.fire.burn-transition",
            "effectVersion": "0.1.0", "sourceCommit": "a" * 40, "status": "PASS",
            "environment": {
                "browser": "Chromium 157", "device": "headless software GPU",
                "requestedBackend": "webgl", "actualBackend": "webgl2",
                "glVersion": "WebGL 2.0 Chromium", "gpu": "SwiftShader",
                "offline": True, "networkRequests": 0
            },
            "fixture": {"seed": 8, "settings": {"duration": 3, "seed": 8},
                        "width": 160, "height": 128, "fps": 60, "asset": "Doctor head",
                        "frameTimesSeconds": [0, 1.5, 3]},
            "checks": [
                {"id": "phase." + key, "status": "PASS", "kind": "visual",
                 "expected": "visible change", "actual": {"changedPixels": 11},
                 "tolerance": {"rgba8Channel": 2},
                 "evidence": [{"path": "phase.png", "sha256": sha}]}
                for key in ["original", "active", "burned"]
            ] + [
                {"id": "parameter." + key, "status": "PASS", "kind": "visual",
                 "expected": "individually observable", "actual": {"changedPixels": 15},
                 "tolerance": {"changedPixelsMin": 1},
                 "evidence": [{"path": "phase.png", "sha256": sha}]}
                for key in ["duration", "flameHeight", "glow", "fireColor", "hotColor",
                            "sparks", "sparkSize", "sparkLife", "seed"]
            ] + [
                {"id": "backend.actual", "status": "PASS", "kind": "backend",
                 "expected": "webgl2", "actual": "webgl2", "tolerance": {},
                 "evidence": []}
            ],
            "warnings": [],
        }

    def check_bad(self, mutate):
        payload = copy.deepcopy(self.report)
        mutate(payload)
        with self.assertRaises(fxv.ValidationError):
            fxv.validate_report(payload, ROOT, self.dir)

    def test_accepted_report(self):
        record = fxv.validate_report(self.report, ROOT, self.dir)
        self.assertEqual(record["status"], "PASS")
        self.assertEqual(record["parameterChecks"], 9)
        self.assertEqual(record["phaseChecks"], 3)

    def test_missing_or_fabricated_proof_rejected(self):
        invalid = [
            lambda p: p.update(schemaVersion=42),
            lambda p: p.update(effectId="fx.game.hit-flash"),
            lambda p: p["environment"].update(actualBackend="webgpu"),
            lambda p: p["environment"].update(requestedBackend="webgpu", actualBackend="webgl2"),
            lambda p: p["environment"].update(glVersion=None),
            lambda p: p["environment"].update(networkRequests=3),
            lambda p: p["fixture"].update(seed=None),
            lambda p: p["fixture"].update(width=0),
            lambda p: p["fixture"].update(frameTimesSeconds=[1.5,0,3]),
            lambda p: p["checks"].pop(0),
            lambda p: p["checks"].append(copy.deepcopy(p["checks"][0])),
            lambda p: p["checks"][0].update(evidence=[]),
            lambda p: p["checks"][0]["evidence"][0].update(path="../stolen.png"),
            lambda p: p["checks"][0]["evidence"][0].update(sha256="0"*64),
            lambda p: p["checks"][0].update(actual={}),
            lambda p: p["checks"][0].update(tolerance=None),
            lambda p: p["checks"][0].update(status="NOT RUN"),
            lambda p: p["checks"][0].update(status="FAIL"),
        ]
        for i, bad in enumerate(invalid):
            with self.subTest(index=i):
                self.check_bad(bad)

    def test_partial_or_failed_report_not_laundered(self):
        partial=copy.deepcopy(self.report)
        partial["status"]="NOT RUN"
        partial["checks"][0]["status"]="NOT RUN"
        partial["checks"][0]["actual"]=None
        partial["checks"][0]["evidence"]=[]
        partial["checks"][0]["reason"]="Intentionally skipped in schema unit fixture"
        self.assertEqual(fxv.validate_report(partial,ROOT,self.dir)["status"],"NOT RUN")
        partial["status"]="PASS"
        with self.assertRaises(fxv.ValidationError):
            fxv.validate_report(partial,ROOT,self.dir)
        failure=copy.deepcopy(self.report)
        failure["status"]="FAIL"
        failure["checks"][0].update(status="FAIL",actual={"changedPixels":0})
        self.assertEqual(fxv.validate_report(failure,ROOT,self.dir)["status"],"FAIL")
        failure["status"]="PASS"
        with self.assertRaises(fxv.ValidationError):
            fxv.validate_report(failure,ROOT,self.dir)

    def test_all_catalog_effects_have_visual_acceptance(self):
        for item in fxv.catalog_requirements(ROOT).values():
            doc=item['blueprint']
            phases=doc['phases']
            self.assertGreaterEqual(len(phases),3,doc['effectId'])
            self.assertEqual(phases[0]['at'],0)
            self.assertEqual(phases[-1]['at'],1)
            self.assertTrue(any(0<p['at']<1 for p in phases))
            self.assertTrue(all(p.get('look') for p in phases))
            self.assertTrue(doc['visualGoal'])
            self.assertTrue(doc['styles'])
            self.assertTrue(doc['curves'])
            self.assertTrue(doc['palettes'] or any(p['type']=='color' for p in doc['parameters']))
            self.assertTrue(all('default' in p for p in doc['parameters']))
            self.assertTrue(doc['tests']['required'])
            self.assertIn(doc['implementation']['status'],{'specification-only','reference-implementation'})

    def test_specs_cannot_report_implemented_pass(self):
        self.check_bad(lambda p: p.update(effectId="fx.ice.frost-dissolve"))
        self.check_bad(lambda p: p.update(effectId="fx.game.hit-flash"))

    def test_true_not_run_for_spec_only_effect(self):
        """Unimplemented ICE/GAME must not invent a renderer or screenshots."""
        for effect in ("fx.ice.frost-dissolve", "fx.game.hit-flash"):
            with self.subTest(effect=effect):
                doc=fxv.catalog_requirements(ROOT)[effect]["blueprint"]
                report=copy.deepcopy(self.report)
                report["effectId"]=effect
                report["effectVersion"]=doc["effectVersion"]
                report["status"]="NOT RUN"
                report["environment"]={
                    "browser":None,"device":None,"requestedBackend":None,
                    "actualBackend":None,"glVersion":None,"gpu":None,
                    "offline":None,"networkRequests":None
                }
                report["fixture"]["settings"]={
                    p["key"]:p["default"] for p in doc["parameters"]
                }
                report["fixture"]["seed"]=report["fixture"]["settings"].get("seed",8)
                report["checks"]=[{
                    "id":"phase."+p["id"],"status":"NOT RUN","kind":"visual",
                    "expected":p["look"],"actual":None,"tolerance":{},
                    "evidence":[],"reason":"Concept only: editor not implemented"
                } for p in doc["phases"]]
                report["checks"] += [{
                    "id":"parameter."+p["key"],"status":"NOT RUN","kind":"visual",
                    "expected":"Individually observable "+p["key"],"actual":None,
                    "tolerance":{},"evidence":[],
                    "reason":"No renderer for this effect"
                } for p in doc["parameters"]]
                report["checks"].append({
                    "id":"backend.actual","status":"NOT RUN","kind":"backend",
                    "expected":"Backend compatibility unverified",
                    "actual":None,"tolerance":{},"evidence":[],
                    "reason":"No implementation"
                })
                validated=fxv.validate_report(report,ROOT,self.dir)
                self.assertEqual(validated["status"],"NOT RUN")
                self.assertIsNone(validated["backend"])
                false_claim=copy.deepcopy(report)
                false_claim["checks"][0]["status"]="PASS"
                false_claim["checks"][0]["actual"]={"changedPixels":25}
                false_claim["checks"][0]["evidence"]=[{"path":"phase.png","sha256":self.sha}]
                with self.assertRaises(fxv.ValidationError):
                    fxv.validate_report(false_claim,ROOT,self.dir)

    def test_reject_signature_only_crc_and_incomplete_png(self):
        file=self.dir/"phase.png"
        for broken in (
            b"\x89PNG\r\n\x1a\nNOT_A_REAL_IMAGE",
            make_valid_png()[:-3],
            make_valid_png()[:32]+b"\\x00"+make_valid_png()[33:]
        ):
            file.write_bytes(broken)
            report=copy.deepcopy(self.report)
            newhash=hashlib.sha256(broken).hexdigest()
            for check in report["checks"]:
                for evidence in check["evidence"]:
                    evidence["sha256"]=newhash
            with self.assertRaises(fxv.ValidationError):
                fxv.validate_report(report,ROOT,self.dir)
        file.write_bytes(make_valid_png())

    def test_json_schema_file_is_versioned(self):
        file=ROOT/"references/validation/evidence-schema-v1.json"
        schema=json.loads(file.read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schemaVersion"]["const"],1)
        self.assertEqual(schema["$schema"],"https://json-schema.org/draft/2020-12/schema")
        self.assertEqual(set(schema["required"]),set(self.report))
        self.assertEqual(set(schema["properties"]["status"]["enum"]),
                         {"PASS","FAIL","NOT RUN"})

    def test_scope_locks_and_catalog_acceptance(self):
        refs = fxv.catalog_requirements(ROOT)
        self.assertEqual(set(refs), {"fx.fire.burn-transition", "fx.fire.torch-flame",
                                     "fx.fire.fire-explosion", "fx.fire.fireball-projectile", "fx.fire.embers-sparks",
                                     "fx.ice.frost-dissolve", "fx.game.hit-flash"})
        for item in refs.values():
            self.assertEqual(set(item["phases"]), {"original","active","burned"}
                             if item["effectId"] == "fx.fire.burn-transition"
                             else {phase["id"] for phase in item["blueprint"]["phases"]})
            self.assertTrue(item["parameters"])
            self.assertTrue(item["tests"])
            self.assertTrue(item["qualityBudgets"])
        skill=(ROOT/"SKILL.md").read_text(encoding="utf8")
        self.assertLess(len(skill.splitlines()),90)
        self.assertIn("references/contracts/effect-validation.md",skill)

if __name__=="__main__":
    unittest.main(verbosity=2)
