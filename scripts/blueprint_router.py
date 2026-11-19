#!/usr/bin/env python3
"""FX-CORE-06: validate draft FX blueprints and route requests (never edit/render)."""
import argparse
import json
import math
import pathlib
import re
import sys

SCHEMA_VERSION = 1
CONTRACT_FILES = {
    "parameters": "references/contracts/parameters.md",
    "curves": "references/contracts/curves.md",
    "spacing": "references/contracts/spacing.md",
    "emitters": "references/contracts/emitters.md",
    "colors": "references/contracts/colors.md",
    "timeline": "references/contracts/timeline.md",
}
ORDER = list(CONTRACT_FILES)
TOP_KEYS = {
    "blueprintSchemaVersion", "effectId", "effectVersion", "presetSchemaVersion",
    "category", "styles", "visualGoal", "phases", "layers", "emitterAnchors",
    "parameters", "curves", "spacing", "palettes", "rng", "rendering",
    "qualityBudgets", "tests", "outOfScope", "requiredContracts",
    "exportMapping", "migration", "implementation", "controlGroups",
}
LIFECYCLES = {"reference-implementation", "specification-only"}
KINDS = {"number", "integer", "boolean", "color", "enum"}
FX_ID = re.compile(r"^fx\.([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)$")
KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,79}$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
FENCE = re.compile(r"(?m)^" + chr(96)*3 + r"json\s*\n(.*?)\n" + chr(96)*3 + r"[ \t]*$", re.S)

class BlueprintError(ValueError):
    """Invalid registry, Blueprint, route or dependency."""

def require(cond, reason):
    if not cond:
        raise BlueprintError(reason)

def safe_relative(root, value, suffix=None):
    require(isinstance(value, str) and value and "\\" not in value,
            "path must be POSIX relative")
    path = pathlib.PurePosixPath(value)
    require(not path.is_absolute() and ".." not in path.parts and "." not in path.parts,
            "invalid or escaping path: " + value)
    require(str(path).startswith(("references/", "scripts/", "assets/")),
            "path escapes allowed workspace: " + value)
    if suffix:
        require(path.suffix == suffix, "path must have " + suffix)
    full = root / pathlib.Path(*path.parts)
    require(full.is_file() and full.resolve().is_relative_to(root.resolve()),
            "missing or escaped local file: " + value)
    return full

def load_catalog(root):
    try:
        return json.loads((root / "references/fx/index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BlueprintError("invalid catalog JSON: " + str(exc)) from exc

def load_blueprint(file):
    matches = list(FENCE.finditer(file.read_text(encoding="utf-8")))
    require(len(matches) == 1, "exactly one fenced JSON Blueprint required: " + str(file))
    try:
        return json.loads(matches[0].group(1))
    except json.JSONDecodeError as exc:
        raise BlueprintError("invalid Blueprint JSON: " + str(file)) from exc

def validate_parameter(p):
    require(isinstance(p, dict), "parameter must be an object")
    require({"key", "type", "default", "unit", "controlGroup", "exportPath"} <= p.keys(),
            "parameter required metadata missing")
    require(set(p) <= {"key", "type", "default", "unit", "controlGroup",
                       "exportPath", "min", "max", "step", "choices", "help"},
            "unknown parameter metadata")
    require(isinstance(p["key"], str) and KEY.fullmatch(p["key"]), "parameter key invalid")
    require(p["type"] in KINDS, "parameter type unsupported")
    require(isinstance(p["unit"], str) and p["unit"], "parameter unit required")
    require(isinstance(p["controlGroup"], str) and p["controlGroup"], "controlGroup required")
    require(isinstance(p["exportPath"], str) and
            p["exportPath"] == "settings." + p["key"],
            "parameter export mapping invalid")
    kind = p["type"]
    if kind in ("number", "integer"):
        require({"min", "max", "step"} <= p.keys(), "number needs range and step")
        mn, mx, step, default = (p[k] for k in ("min", "max", "step", "default"))
        require(all(type(x) in (int, float) and math.isfinite(x)
                    for x in (mn, mx, step, default)), "parameter range must be finite")
        require(mn <= default <= mx and mn < mx and step > 0, "parameter default outside range")
        if kind == "integer":
            require(all(isinstance(x, int) for x in (mn, mx, step, default)),
                    "integer parameter requires integer bounds")
    elif kind == "boolean":
        require(type(p["default"]) is bool, "boolean default must be boolean")
    elif kind == "color":
        require(isinstance(p["default"], str) and
                re.fullmatch(r"#[0-9a-fA-F]{6}", p["default"]), "invalid default RGB")
    elif kind == "enum":
        require(isinstance(p.get("choices"), list) and p["choices"] and
                len(set(p["choices"])) == len(p["choices"]) and
                p["default"] in p["choices"], "enum default not in unique choices")

def validate_blueprint(doc, root):
    require(isinstance(doc, dict), "blueprint must be an object")
    require(set(doc) == TOP_KEYS,
            "blueprint missing/unknown fields: " +
            str(sorted(TOP_KEYS.symmetric_difference(doc.keys()))))
    require(doc["blueprintSchemaVersion"] == SCHEMA_VERSION, "unsupported blueprint version")
    require(isinstance(doc["effectId"], str) and FX_ID.fullmatch(doc["effectId"]),
            "invalid stable effectId")
    require(doc["effectId"].split(".")[1] == doc["category"], "effectId category mismatch")
    require(isinstance(doc["effectVersion"], str) and SEMVER.fullmatch(doc["effectVersion"]),
            "invalid effect version")
    require(doc["presetSchemaVersion"] == 1, "unsupported preset version")
    require(isinstance(doc["styles"], list) and doc["styles"] and
            all(isinstance(s, str) and s for s in doc["styles"]), "styles required")
    require(isinstance(doc["visualGoal"], str) and doc["visualGoal"].strip(),
            "visual goal missing")
    for name in ("phases", "layers", "parameters", "qualityBudgets",
                 "outOfScope", "controlGroups"):
        require(bool(doc[name]), name + " cannot be empty")
    for group in ("phases", "layers", "emitterAnchors"):
        require(isinstance(doc[group], list), group + " must be an array")
        ids = [x.get("id") for x in doc[group] if isinstance(x, dict)]
        require(len(ids) == len(doc[group]) and len(set(ids)) == len(ids) and
                all(isinstance(x, str) and KEY.fullmatch(x) for x in ids),
                group + " duplicate/invalid IDs")
    phases = doc["phases"]
    require(len(phases) >= 2 and phases[0].get("at") == 0 and
            phases[-1].get("at") == 1, "effect phase endpoints must be at 0 and 1")
    require(all(type(item.get("at")) in (int, float) and
                math.isfinite(item["at"]) and 0 <= item["at"] <= 1 and
                isinstance(item.get("look"), str) and item["look"] for item in phases),
            "invalid phase value or visual intent")
    require(all(phases[i]["at"] < phases[i+1]["at"] for i in range(len(phases)-1)),
            "effect phases must be ordered and nonduplicate")
    require(all(item.get("kind") in {"filter", "shader", "particles", "geometry"} and
                isinstance(item.get("position"), str) and item.get("purpose")
                for item in doc["layers"]), "layer kind/ownership missing")
    require(all(item.get("space") and item.get("onMissing") for item in doc["emitterAnchors"]),
            "anchor coordinate/missing-anchor semantics required")
    keys = [p.get("key") for p in doc["parameters"]]
    require(len(keys) == len(set(keys)), "duplicate parameter ID")
    for param in doc["parameters"]:
        validate_parameter(param)
        require(param["controlGroup"] in doc["controlGroups"], "unknown control group")
    contracts = doc["requiredContracts"]
    require(isinstance(contracts, list) and contracts and contracts[0] == "parameters" and
            len(set(contracts)) == len(contracts) and set(contracts) <= set(CONTRACT_FILES),
            "invalid required contracts")
    require(contracts == [c for c in ORDER if c in contracts],
            "contract dependency order invalid")
    require(not set(contracts) & {"spacing", "colors", "timeline"} or "curves" in contracts,
            "spacing/colors/timeline require curves")
    m = doc["exportMapping"]
    require(isinstance(m, dict) and m.get("settingsRoot") == "settings" and
            m.get("parameterMap") == {p["key"]: p["exportPath"] for p in doc["parameters"]},
            "parameter export mapping mismatch")
    require(m.get("preview") and m.get("pngBake") and m.get("developerZip") and
            m.get("presetSchemaVersion") == 1, "incomplete export mapping")
    mig = doc["migration"]
    require(isinstance(mig, dict) and mig.get("unknownVersion") == "reject" and
            mig.get("from") == [], "unsafe migration policy")
    rendering = doc["rendering"]
    require(rendering.get("approach") in {"filter", "shader", "particles", "composition"},
            "invalid renderer approach")
    require(set(rendering.get("backends", [])) == {"webgl1", "webgl2", "webgpu"},
            "backend policy must be explicit")
    pins = rendering.get("runtimePins", {})
    baseline = json.loads((root / "assets/template/template.json").read_text(encoding="utf-8"))
    require(pins.get("pixi") == baseline["runtime"]["pixi"] and
            pins.get("spine") == baseline["runtime"]["spinePixiV8"],
            "unsupported runtime pins")
    for label in ("low", "balanced", "high"):
        budget = doc["qualityBudgets"].get(label)
        require(isinstance(budget, dict) and
                bool(budget) and all(type(v) in (int, float) and math.isfinite(v) and
                                     0 <= v <= 100000 for v in budget.values()),
                "quality budget missing/unbounded")
    require(doc["rng"].get("policy") in {"seeded-per-instance", "none"},
            "rng policy invalid")
    impl = doc["implementation"]
    require(impl.get("status") in LIFECYCLES, "implementation status invalid")
    require(isinstance(impl.get("sourceFiles"), list), "sourceFiles required")
    evidence = doc["tests"]
    require(isinstance(evidence.get("verified"), bool) and
            isinstance(evidence.get("evidence"), list) and
            isinstance(evidence.get("required"), list) and evidence["required"],
            "test status/evidence required")
    if impl["status"] == "specification-only":
        require(not impl["sourceFiles"] and not evidence["verified"] and not evidence["evidence"],
                "unimplemented effect must not claim tested runtime")
        require(all(m[k] == "not-implemented"
                    for k in ("preview", "pngBake", "developerZip")),
                "specification-only effect must not claim exports")
    else:
        require(evidence["verified"] and impl["sourceFiles"] and evidence["evidence"],
                "reference implementation needs real source and tests")
    for f in [*impl["sourceFiles"], *evidence["evidence"]]:
        safe_relative(root, f)
    require(isinstance(doc["curves"], list) and isinstance(doc["palettes"], list) and
            isinstance(doc["spacing"], dict) and isinstance(doc["emitterAnchors"], list),
            "effect metadata categories missing")
    require(isinstance(doc["outOfScope"], list) and
            all(isinstance(v, str) and v for v in doc["outOfScope"]),
            "outOfScope invalid")
    return doc

def validate_catalog(root, catalog):
    require(isinstance(catalog, dict) and set(catalog) ==
            {"blueprintSchemaVersion", "categories", "entries"}, "invalid registry keys")
    require(catalog["blueprintSchemaVersion"] == SCHEMA_VERSION, "catalog version unsupported")
    cats = catalog["categories"]
    require(isinstance(cats, list) and cats and len(set(cats)) == len(cats) and
            all(isinstance(c, str) and re.fullmatch(r"[a-z][a-z0-9-]*", c)
                for c in cats), "invalid category registry")
    require(set(cats) == {e.get("category") for e in catalog["entries"]},
            "category registry differs from entries")
    entries = catalog["entries"]
    require(isinstance(entries, list) and entries, "empty registry")
    ids = [e.get("effectId") for e in entries]
    paths = [e.get("path") for e in entries]
    require(len(set(ids)) == len(ids) and len(set(paths)) == len(paths),
            "duplicate catalog ID/path")
    out = {}
    for entry in entries:
        require(set(entry) == {"effectId", "category", "path", "keywords", "status", "dependsOnCoreIssues"},
                "invalid catalog entry keys")
        require(isinstance(entry["path"], str) and
                entry["path"].startswith("references/fx/") and
                entry["path"].endswith(".md"), "invalid blueprint path")
        source = safe_relative(root, entry["path"], ".md")
        doc = validate_blueprint(load_blueprint(source), root)
        require(doc["effectId"] == entry["effectId"] and
                doc["category"] == entry["category"] and
                doc["implementation"]["status"] == entry["status"],
                "catalog metadata differs from Blueprint")
        expected_issues = [{"curves":3, "spacing":4, "emitters":5, "colors":6,
                            "timeline":7}[c] for c in doc["requiredContracts"] if c != "parameters"]
        require(entry["dependsOnCoreIssues"] == expected_issues,
                "core issue dependencies differ from Blueprint")
        require(isinstance(entry["keywords"], list) and entry["keywords"] and
                len(set(entry["keywords"])) == len(entry["keywords"]) and
                all(isinstance(k, str) and k for k in entry["keywords"]),
                "keywords missing/duplicated")
        out[entry["effectId"]] = doc
    return out

def route(request, root):
    require(isinstance(request, str) and request.strip(), "request blank")
    catalog = load_catalog(root)
    validate_catalog(root, catalog)
    content = " " + re.sub(r"[\W_]+", " ", request.lower(), flags=re.UNICODE).strip() + " "
    matches = []
    for entry in catalog["entries"]:
        matched = []
        for word in entry["keywords"]:
            normalized = " " + re.sub(r"[\W_]+", " ", word.lower(), flags=re.UNICODE).strip() + " "
            if normalized in content:
                matched.append(word)
        if matched:
            matches.append((entry, matched))
    if not matches:
        return {"status": "unmatched",
                "reason": "no matching effect; request clarified visual goal"}
    if len(matches) > 1:
        return {"status": "ambiguous", "candidates": [e["effectId"] for e, _ in matches],
                "reason": "multiple effects; request selection or multiple blueprints"}
    entry, matched = matches[0]
    doc = load_blueprint(safe_relative(root, entry["path"], ".md"))
    contracts = doc["requiredContracts"]
    return {"status": "matched", "effectId": entry["effectId"],
            "category": entry["category"], "implementationStatus": entry["status"],
            "blueprintPath": entry["path"], "contracts": contracts,
            "matchedKeywords": matched,
            "documents": ["references/contracts/blueprint.md", entry["path"],
                          *(CONTRACT_FILES[c] for c in contracts)]}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[1])
    parser.add_argument("--route", help="Natural-language FX request")
    args = parser.parse_args()
    root = args.repo.resolve()
    try:
        if args.route:
            result = route(args.route, root)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["status"] == "matched" else 2
        items = validate_catalog(root, load_catalog(root))
        print(json.dumps({"schemaVersion": SCHEMA_VERSION,
                          "validBlueprints": len(items),
                          "effects": sorted(items)}, ensure_ascii=False))
        return 0
    except BlueprintError as exc:
        print("FX Blueprint validation failed: " + str(exc), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
