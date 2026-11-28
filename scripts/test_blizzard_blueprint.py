import unittest
from pathlib import Path
import blueprint_router as bp

ROOT = Path(__file__).resolve().parents[1]
ID = "fx.air.blizzard"

class BlizzardBlueprintTests(unittest.TestCase):
    def test_registered_and_routed(self):
        catalog = bp.load_catalog(ROOT)
        doc = bp.validate_catalog(ROOT, catalog)[ID]
        self.assertEqual(doc["implementation"]["status"], "specification-only")
        self.assertFalse(doc["tests"]["verified"])
        self.assertEqual(doc["implementation"]["sourceFiles"], [])
        for phrase in ("Blizzard", "snowstorm", "snow storm", "снежная буря", "метель", "снігова буря", "хуртовина", "Schneesturm", "tempête de neige"):
            with self.subTest(phrase=phrase):
                result = bp.route(phrase, ROOT)
                self.assertEqual(result["effectId"], ID)
                self.assertEqual(result["implementationStatus"], "specification-only")
                self.assertEqual(result["contracts"], ["parameters", "curves", "spacing", "emitters", "colors", "timeline"])
        self.assertEqual(bp.route("snowfall", ROOT)["effectId"], "fx.air.snowfall")
        self.assertEqual(bp.route("blizzard and snowfall", ROOT)["status"], "ambiguous")

    def test_contract(self):
        doc = bp.validate_blueprint(bp.load_blueprint(ROOT / "references/fx/air/blizzard.md"), ROOT)
        self.assertEqual({l["id"] for l in doc["layers"]}, {"streaks", "foreground", "whiteout"})
        self.assertEqual({c["key"] for c in doc["curves"]}, {"stormIntensityCurve", "driftSpeedCurve", "whiteoutAlphaCurve", "emissionRateCurve", "spacingCurve", "particleAlphaCurve"})
        params = {p["key"]: p for p in doc["parameters"]}
        for key, values in {"particleRate": (75,0,400), "windSpeed": (200,0,900), "windVariance": (.6,0,1), "streakLength": (20,2,90), "density": (.75,0,1), "angle": (35,-90,90), "nearGapPx": (8,1,75), "spatialJitter": (.25,0,.65)}.items():
            self.assertEqual(tuple(params[key][v] for v in ("default","min","max")), values)
        self.assertEqual(params["spatialJitter"]["unit"], "fraction-of-nearest-half-gap")
        self.assertEqual([doc["qualityBudgets"][k]["particlesAndQuads"] for k in ("low","balanced","high")], [512,2048,4096])
        self.assertTrue(all(doc["exportMapping"][key] == "not-implemented" for key in ("preview","pngBake","developerZip")))

if __name__ == "__main__":
    unittest.main(verbosity=2)
