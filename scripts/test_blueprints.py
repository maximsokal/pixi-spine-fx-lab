#!/usr/bin/env python3
"""FX-CORE-06 RED->GREEN: registry, schema, migration, progressive disclosure."""
import copy
import importlib.util
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import blueprint_router as bp


class BlueprintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = bp.load_catalog(ROOT)
        cls.blueprints = bp.validate_catalog(ROOT, cls.catalog)

    def test_registry_is_small_and_complete(self):
        self.assertEqual(self.catalog["blueprintSchemaVersion"], 1)
        self.assertEqual(set(self.catalog["categories"]), {"fire", "ice", "game"})
        self.assertEqual(len(self.blueprints), 6)
        self.assertEqual(set(self.blueprints), {
            "fx.fire.burn-transition", "fx.fire.torch-flame",
            "fx.fire.fire-explosion", "fx.fire.fireball-projectile",
            "fx.ice.frost-dissolve", "fx.game.hit-flash"})
        self.assertEqual(len({row["path"] for row in self.catalog["entries"]}), 6)
        self.assertEqual(len({row["effectId"] for row in self.catalog["entries"]}), 6)
        expected = {"fire":[3,4,5,6,7], "ice":[3,6,7], "game":[3,7]}
        for row in self.catalog["entries"]:
            if row["effectId"]=="fx.fire.fireball-projectile":
                self.assertEqual(row["dependsOnCoreIssues"],[3,4,10,5,6,7])
            else:
                self.assertEqual(row["dependsOnCoreIssues"],expected[row["category"]])

    def test_routing_and_exact_contracts(self):
        cases = [
            ("Build an organic fire burn transition with sparks", "fx.fire.burn-transition",
             {"parameters", "curves", "spacing", "emitters", "colors", "timeline"}),
            ("Make a radial fire explosion with debris, sparks and smoke", "fx.fire.fire-explosion",
             {"parameters", "curves", "spacing", "emitters", "colors", "timeline"}),
            ("Make a fireball projectile with a moving curved trail", "fx.fire.fireball-projectile",
             {"parameters", "curves", "spacing", "pathGeometry", "emitters", "colors", "timeline"}),
            ("Create an animated torch flame following a Spine bone", "fx.fire.torch-flame",
             {"parameters", "curves", "spacing", "emitters", "colors", "timeline"}),
            ("An icy crystal frost dissolve around the Spine model", "fx.ice.frost-dissolve",
             {"parameters", "curves", "colors", "timeline"}),
            ("A short hit flash on taking damage", "fx.game.hit-flash",
             {"parameters", "curves", "timeline"}),
            ("Заморозка льдом с кристаллами", "fx.ice.frost-dissolve",
             {"parameters", "curves", "colors", "timeline"}),
        ]
        for phrase, expected, contracts in cases:
            with self.subTest(phrase=phrase):
                result = bp.route(phrase, ROOT)
                self.assertEqual(result["status"], "matched")
                self.assertEqual(result["effectId"], expected)
                self.assertEqual(set(result["contracts"]), contracts)
                self.assertEqual(result["contracts"][0], "parameters")
                self.assertEqual(result["documents"][0], "references/contracts/blueprint.md")
                self.assertEqual(result["documents"][1], result["blueprintPath"])
                self.assertEqual(len(result["documents"]), len(result["contracts"]) + 2)
                self.assertEqual(len(result["documents"]), len(set(result["documents"])))
                for file in result["documents"]:
                    self.assertTrue((ROOT / file).is_file(), file)

    def test_no_fake_implementation(self):
        for effect in ["fx.ice.frost-dissolve", "fx.game.hit-flash"]:
            data = self.blueprints[effect]
            self.assertEqual(data["implementation"]["status"], "specification-only")
            self.assertFalse(data["tests"]["verified"])
            self.assertEqual(data["implementation"]["sourceFiles"], [])
            self.assertNotIn("BurnTransition.mjs", json.dumps(data))
            self.assertNotIn("settings.desaturation", json.dumps(data))
            self.assertNotIn("settings.fireColor", json.dumps(data))
        explosion = self.blueprints["fx.fire.fire-explosion"]
        self.assertEqual(explosion["implementation"]["status"], "reference-implementation")
        self.assertTrue(explosion["tests"]["verified"])
        self.assertEqual(len(explosion["layers"]), 6)
        self.assertIn("assets/Fire_Explosion_Lab.html", explosion["implementation"]["sourceFiles"])
        self.assertNotIn("settings.desaturation", json.dumps(explosion))
        projectile=self.blueprints["fx.fire.fireball-projectile"]
        self.assertEqual(projectile["implementation"]["status"],"reference-implementation")
        self.assertTrue(projectile["tests"]["verified"])
        self.assertEqual(len(projectile["layers"]),5)
        self.assertIn("assets/Fireball_Projectile_Lab.html",projectile["implementation"]["sourceFiles"])
        self.assertNotIn("settings.desaturation",json.dumps(projectile))
        torch = self.blueprints["fx.fire.torch-flame"]
        self.assertEqual(torch["implementation"]["status"], "reference-implementation")
        self.assertTrue(torch["tests"]["verified"])
        self.assertIn("assets/Torch_Flame_Lab.html", torch["implementation"]["sourceFiles"])
        self.assertNotIn("settings.desaturation", json.dumps(torch))
        burn = self.blueprints["fx.fire.burn-transition"]
        self.assertEqual(burn["implementation"]["status"], "reference-implementation")
        self.assertTrue(burn["tests"]["verified"])
        self.assertIn("BurnTransition.mjs", json.dumps(burn))
        self.assertEqual(burn["rendering"]["runtimePins"]["pixi"], "8.22.0")
        self.assertEqual(burn["rendering"]["runtimePins"]["spine"], "4.2.120")

    def test_schema_keys_defaults_migrations(self):
        for name, blueprint in self.blueprints.items():
            with self.subTest(name=name):
                self.assertEqual(blueprint["blueprintSchemaVersion"], 1)
                self.assertRegex(blueprint["effectVersion"], r"^\d+\.\d+\.\d+$")
                self.assertEqual(blueprint["migration"]["unknownVersion"], "reject")
                self.assertEqual(len({p["key"] for p in blueprint["parameters"]}),
                                 len(blueprint["parameters"]))
                for item in blueprint["parameters"]:
                    self.assertEqual(item["exportPath"],
                                     blueprint["exportMapping"]["parameterMap"][item["key"]])
                    self.assertIn("unit", item)
                    self.assertIn("default", item)
                self.assertTrue(blueprint["outOfScope"])
                self.assertTrue(blueprint["phases"])
                self.assertTrue(blueprint["layers"])
                self.assertTrue(blueprint["qualityBudgets"])
                self.assertTrue(blueprint["tests"]["required"])
                for kind in blueprint["requiredContracts"]:
                    self.assertIn(kind, bp.CONTRACT_FILES)

    def test_invalid_schema_and_duplicate_ids_rejected(self):
        sample = self.blueprints["fx.fire.burn-transition"]
        changes = [
            (lambda b: b.update(blueprintSchemaVersion=999), "version"),
            (lambda b: b.update(effectId="fx.ice.frost-dissolve"), "category"),
            (lambda b: b["parameters"].append(copy.deepcopy(b["parameters"][0])), "duplicate"),
            (lambda b: b["parameters"][0].update(default=99999), "range"),
            (lambda b: b["parameters"][0].update(exportPath="../escape"), "mapping"),
            (lambda b: b["parameters"][0].update(unit=None), "unit"),
            (lambda b: b["migration"].update(unknownVersion="guess"), "migration"),
            (lambda b: b["requiredContracts"].append("unknown"), "contract"),
            (lambda b: b["phases"][0].update(at=.3), "phase endpoints"),
            (lambda b: b["phases"][1].update(at=1), "phase ordering"),
            (lambda b: b["layers"][0].update(kind="imaginary"), "layer kind"),
            (lambda b: b["qualityBudgets"]["low"].update(maxSparks=-1), "quality budget"),
            (lambda b: b["rendering"].update(backends=["webgl1"]), "backend coverage"),
            (lambda b: b["tests"].update(verified=False), "fake verified status"),
        ]
        for mutate, reason in changes:
            d = copy.deepcopy(sample)
            mutate(d)
            with self.subTest(reason=reason):
                with self.assertRaises(bp.BlueprintError):
                    bp.validate_blueprint(d, ROOT)

    def test_catalog_path_and_ambiguity(self):
        self.assertEqual(bp.route("fire and ice simultaneously", ROOT)["status"], "ambiguous")
        self.assertEqual(bp.route("an unknown effect without clues", ROOT)["status"], "unmatched")
        copycat = copy.deepcopy(self.catalog)
        copycat["entries"][1]["path"] = "../../unsafe/secret.md"
        with self.assertRaises(bp.BlueprintError):
            bp.validate_catalog(ROOT, copycat)

    def test_new_categories_need_no_router_code_change(self):
        data=copy.deepcopy(self.blueprints["fx.game.hit-flash"])
        data["category"]="magic"
        data["effectId"]="fx.magic.aura"
        self.assertEqual(bp.validate_blueprint(data,ROOT)["effectId"],"fx.magic.aura")

    def test_path_geometry_requires_curves_and_spacing_in_routing(self):
        fire = copy.deepcopy(self.blueprints["fx.fire.burn-transition"])
        fire["requiredContracts"].insert(3, "pathGeometry")
        self.assertEqual(bp.validate_blueprint(fire,ROOT)["effectId"],
                         "fx.fire.burn-transition")
        self.assertIn("pathGeometry", bp.CONTRACT_FILES)
        self.assertTrue((ROOT / bp.CONTRACT_FILES["pathGeometry"]).is_file())
        # Existing effects remain independent; do NOT force path into non-path Blueprints.
        for name in ("fx.ice.frost-dissolve", "fx.game.hit-flash"):
            self.assertNotIn("pathGeometry",self.blueprints[name]["requiredContracts"])
        for key in ("spacing", "curves"):
            invalid = copy.deepcopy(fire)
            invalid["requiredContracts"].remove(key)
            with self.assertRaises(bp.BlueprintError):
                bp.validate_blueprint(invalid,ROOT)

    def test_only_existing_source_is_claimed(self):
        for effect in self.blueprints.values():
            for path in effect["implementation"]["sourceFiles"]:
                self.assertTrue((ROOT / path).is_file(), path)
            for path in effect["tests"]["evidence"]:
                self.assertTrue((ROOT / path).is_file(), path)

    def test_skill_router_no_catalog_copy(self):
        skill = (ROOT / "SKILL.md").read_text(encoding="utf8")
        self.assertLess(len(skill.splitlines()), 85)
        self.assertIn("references/fx/index.md", skill)
        self.assertIn("references/contracts/blueprint.md", skill)
        self.assertIn("progressive", skill.lower())
        self.assertNotIn("frost-dissolve.md", skill)
        self.assertNotIn("hit-flash.md", skill)

    def test_preserved_product_untouched(self):
        import subprocess
        p = subprocess.run([sys.executable, str(ROOT / "scripts/verify_project.py"),
                            str(ROOT / "assets/template"), "--html",
                            str(ROOT / "assets/Spine_Burn_Lab.html")],
                           capture_output=True, text=True, check=True)
        report = json.loads(p.stdout)
        self.assertEqual(report["protectedFiles"], 8)
        self.assertEqual(report["preservedControls"], 30)


if __name__ == "__main__":
    unittest.main(verbosity=2)
