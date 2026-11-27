#!/usr/bin/env python3
"""FX-CORE-07: declared seed paths, not an unrelated top-level seed."""
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import effect_validation as fxv

# All nested seed paths in the existing registered catalog.
PATHS = {
    "fx.game.muzzle-flash": "effect.layers.sparks.seed",
    "fx.game.hit-sparks": "effect.layers.primary.seed",
    "fx.game.sword-slash": "effect.layers.main.seed",
    "fx.game.energy-projectile": "emitters.0.layers.core.seed",
    "fx.ice.chain-lightning": "targets.0.seed",
    "fx.ice.electric-aura": "emitters.0.layers.arcs.seed",
}


def settings_at(path, value):
    for part in reversed(path.split(".")):
        value = [value] if part == "0" else {part: value}
    return value


class SeedPaths(unittest.TestCase):
    def test_declared_paths_and_int32_limits(self):
        for path in [*PATHS.values(), "seed"]:
            rng = {"policy": "seeded-per-instance", "seedParameter": path}
            for seed in (-2147483648, 0, 4109, 2147483647):
                with self.subTest(path=path, seed=seed):
                    fxv.validate_fixture_seed({"seed": seed, "settings": settings_at(path, seed)}, rng)
            for bad in (True, 4109.0, "4109", 4110, None, [], {}):
                with self.subTest(path=path, bad=bad), self.assertRaises(fxv.ValidationError):
                    fxv.validate_fixture_seed({"seed": 4109, "settings": settings_at(path, bad)}, rng)

    def test_flat_alias_and_unrelated_seed_cannot_override(self):
        for path in PATHS.values():
            rng = {"policy": "seeded-per-instance", "seedParameter": path}
            for invalid in ({"seed": 4109}, {"seed": 4109, path: 4109},
                            {**settings_at(path, 4110), "seed": 4109}):
                with self.subTest(path=path, invalid=invalid), self.assertRaises(fxv.ValidationError):
                    fxv.validate_fixture_seed({"seed": 4109, "settings": invalid}, rng)
            fxv.validate_fixture_seed({"seed": 4109, "settings": {**settings_at(path, 4109), "seed": 1}}, rng)

    def test_invalid_array_path_and_nonseeded_policy(self):
        settings = {"seed": 4109, "targets": [{"seed": 4109}]}
        for path in ("targets.00.seed", "targets.-1.seed", "targets.1.seed",
                     "targets." + "9" * 5000 + ".seed", "targets..seed", "", None):
            with self.subTest(path=str(path)[:40]), self.assertRaises(fxv.ValidationError):
                fxv.validate_fixture_seed({"seed": 4109, "settings": settings},
                    {"policy": "seeded-per-instance", "seedParameter": path})
        for seed in (True, 4109.0, 2147483648, -2147483649):
            with self.subTest(seed=seed), self.assertRaises(fxv.ValidationError):
                fxv.validate_fixture_seed({"seed": seed, "settings": settings}, {"policy": "none"})
        fxv.validate_fixture_seed({"seed": 0, "settings": {"duration": 1}}, {"policy": "none"})

    def test_actual_catalog_declares_nested_seed_paths(self):
        catalog = fxv.catalog_requirements(ROOT)
        for effect, path in PATHS.items():
            with self.subTest(effect=effect):
                doc = catalog[effect]["blueprint"]
                self.assertEqual(doc["rng"]["seedParameter"], path)
                seed = next(p["default"] for p in doc["parameters"] if p["key"] == path)
                fxv.validate_fixture_seed({"seed": seed, "settings": settings_at(path, seed)}, doc["rng"])

    def test_report_uses_declared_path_and_preserves_unverified_status(self):
        # Structural integration test only: no renderer or screenshots claimed.
        for effect, path in PATHS.items():
            doc = {"effectVersion": "0.1.0", "rng": {"policy": "seeded-per-instance", "seedParameter": path}}
            catalog = {effect: {"blueprint": doc, "phases": ["start", "peak", "end"],
                                "parameters": [path], "status": "specification-only"}}
            checks = [{"id": key, "kind": kind, "status": "NOT RUN", "expected": "test",
                       "actual": None, "tolerance": {}, "evidence": [], "reason": "schema fixture"}
                      for key, kind in [("phase.start", "visual"), ("phase.peak", "visual"),
                                        ("phase.end", "visual"), ("parameter." + path, "numeric"),
                                        ("backend.actual", "backend")]]
            report = {"schemaVersion": 1, "effectId": effect, "effectVersion": "0.1.0",
                      "sourceCommit": "a" * 40, "status": "NOT RUN",
                      "environment": dict.fromkeys(("browser", "device", "requestedBackend",
                          "actualBackend", "glVersion", "gpu", "offline", "networkRequests")),
                      "fixture": {"seed": 4109, "settings": settings_at(path, 4109),
                                  "width": 1, "height": 1, "fps": 60, "asset": "none",
                                  "frameTimesSeconds": [0, .5, 1]},
                      "checks": checks, "warnings": []}
            with self.subTest(effect=effect), patch.object(fxv, "catalog_requirements", return_value=catalog):
                self.assertEqual(fxv.validate_report(report, ROOT, ROOT)["status"], "NOT RUN")
                wrong = copy.deepcopy(report)
                wrong["fixture"]["settings"] = {"seed": 4109, path: 4109}
                with self.assertRaises(fxv.ValidationError):
                    fxv.validate_report(wrong, ROOT, ROOT)
                wrong = copy.deepcopy(report)
                wrong["status"] = "PASS"
                with self.assertRaises(fxv.ValidationError):
                    fxv.validate_report(wrong, ROOT, ROOT)


if __name__ == "__main__":
    unittest.main(verbosity=2)
