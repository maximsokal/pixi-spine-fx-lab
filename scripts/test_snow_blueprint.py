#!/usr/bin/env python3
"""Focused AIR-02 schema and routing tests; no GPU evidence implied."""
import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest

import blueprint_router as bp

ROOT = Path(__file__).resolve().parents[1]
ID = "fx.air.snowfall"
PHRASES = ("Snowfall", "falling snow", "snowflakes", "снегопад", "снігопад")


class SnowBlueprintTests(unittest.TestCase):
    def setUp(self):
        self.catalog = bp.load_catalog(ROOT)
        self.entry = next((e for e in self.catalog["entries"] if e["effectId"] == ID), None)
        self.assertIsNotNone(self.entry, "AIR-02 is not registered")

    def test_schema_and_independent_controls(self):
        doc = bp.validate_blueprint(bp.load_blueprint(ROOT / self.entry["path"]), ROOT)
        self.assertEqual(doc["effectId"], ID)
        self.assertEqual({l["id"] for l in doc["layers"]}, {"near", "far", "windSwirls"})
        self.assertEqual({c["key"] for c in doc["curves"]}, {"driftCurve", "flakeAlphaCurve", "rotationCurve", "emissionRateCurve", "horizontalSpacingCurve"})
        params = {p["key"]: p for p in doc["parameters"]}
        for key, values in {"flakesPerSecond": (22, 0, 120), "flakeSize": (7, 2, 20), "fallSpeed": (50, 5, 240), "windDrift": (24, -120, 120), "rotationSpeed": (45, -180, 180), "depthVariation": (.45, 0, 1), "horizontalGapPx": (24, 4, 100)}.items():
            self.assertEqual(tuple(params[key][v] for v in ("default", "min", "max")), values)
        self.assertEqual(doc["requiredContracts"], ["parameters", "curves", "spacing", "emitters", "colors", "timeline"])
        self.assertEqual(doc["implementation"]["status"], self.entry["status"])

    def test_isolated_catalog_route(self):
        # Scope validation to AIR-02 without requiring other labs' binary assets.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for rel in (self.entry["path"], "assets/template/template.json"):
                target = root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / rel, target)
            (root / "references/fx/index.json").write_text(json.dumps({"blueprintSchemaVersion": 1, "categories": ["air"], "entries": [self.entry]}), encoding="utf8")
            self.assertEqual(set(bp.validate_catalog(root, bp.load_catalog(root))), {ID})
            for phrase in PHRASES:
                with self.subTest(phrase=phrase):
                    self.assertEqual(bp.route(phrase, root)["effectId"], ID)

    def test_keywords_do_not_match_other_effects(self):
        # Test actual full-catalog keyword ownership, separately from fixture routing.
        normalize = lambda v: " " + re.sub(r"[\W_]+", " ", v.lower()).strip() + " "
        for phrase in PHRASES:
            matches = [e["effectId"] for e in self.catalog["entries"] if any(normalize(k) in normalize(phrase) for k in e["keywords"])]
            self.assertEqual(matches, [ID])


if __name__ == "__main__":
    unittest.main(verbosity=2)
