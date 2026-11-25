#!/usr/bin/env python3
"""FX-CORE-07: validate a source-backed per-effect QA evidence report.

This validates report completeness, provenance and claimed status; it does not
replace real independent rendering, image comparison or agent evaluation.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import sys
import struct
import zlib
import blueprint_router as router

STATUS = {"PASS", "FAIL", "NOT RUN"}
BACKENDS = {"webgl1", "webgl2", "webgpu"}
KINDS = {"visual", "numeric", "backend", "asset", "export", "lifecycle"}
SHA = re.compile(r"^[a-fA-F0-9]{64}$")
COMMIT = re.compile(r"^[a-fA-F0-9]{40}$")

class ValidationError(ValueError):
    pass

def require(condition, message):
    if not condition:
        raise ValidationError(message)

def catalog_requirements(root):
    root=Path(root).resolve()
    blueprint_map = router.validate_catalog(root, router.load_catalog(root))
    for doc in blueprint_map.values():
        phases=doc["phases"]
        require(len(phases)>=3 and phases[0]["at"]==0 and phases[-1]["at"]==1
                and any(0<p["at"]<1 for p in phases),
                "visual acceptance needs start/peak/end: "+doc["effectId"])
        require(bool(doc["visualGoal"]) and bool(doc["styles"]) and bool(doc["curves"])
                and (bool(doc["palettes"]) or any(p["type"]=="color" for p in doc["parameters"]))
                and bool(doc["tests"]["required"]),
                "missing visual goal/palette/curves/individual acceptance: "+doc["effectId"])
    return {
        key: {
            "effectId": key,
            "blueprint": doc,
            "phases": [p["id"] for p in doc["phases"]],
            "parameters": [p["key"] for p in doc["parameters"]],
            "tests": doc["tests"]["required"],
            "qualityBudgets": doc["qualityBudgets"],
            "status": doc["implementation"]["status"],
        } for key, doc in blueprint_map.items()
    }

def _check_png_structure(data, label):
    """Require a completely decoded RGB/RGBA8 PNG, not a signature-only fixture.

    The browser harness independently decodes pixel values in fx_visual_png.cjs.
    This stdlib gate only certifies the referenced evidence file is a real PNG.
    """
    require(data.startswith(b"\x89PNG\r\n\x1a\n"), "not a PNG file: " + label)
    require(len(data) <= 32 * 1024 * 1024, "PNG evidence exceeds 32 MiB: " + label)
    offset=8
    width=height=channels=None
    found_idat=found_end=found_plte=found_trns=idat_closed=False
    idat=[]
    while offset + 12 <= len(data):
        size=struct.unpack_from(">I", data, offset)[0]
        require(size<=32*1024*1024 and offset+size+12<=len(data),
                "truncated or oversized PNG chunk: " + label)
        kind=data[offset+4:offset+8]
        require(re.fullmatch(rb"[A-Za-z]{2}[A-Z][A-Za-z]", kind) is not None,
                "invalid PNG chunk type: " + label)
        payload=data[offset+8:offset+8+size]
        crc=struct.unpack_from(">I", data, offset+8+size)[0]
        require(zlib.crc32(kind+payload)&0xffffffff==crc,
                "PNG CRC mismatch: " + label)
        require(width is not None or kind==b"IHDR", "PNG IHDR must be first: " + label)
        if found_idat and kind!=b"IDAT":
            idat_closed=True
        if kind==b"IHDR":
            require(width is None and size==13 and offset==8,
                    "missing or duplicate PNG IHDR: " + label)
            width,height,depth,color,compression,filter_mode,interlace=struct.unpack(
                ">IIBBBBB",payload)
            require(width>0 and height>0 and width*height<=16000000 and
                    depth==8 and color in (2,6) and
                    compression==0 and filter_mode==0 and interlace==0,
                    "unsupported PNG dimensions/pixel format: " + label)
            channels=3 if color==2 else 4
        elif kind==b"PLTE":
            require(not found_plte and not found_trns and not found_idat and
                    3<=size<=768 and size%3==0, "invalid or misplaced PNG PLTE: " + label)
            found_plte=True
        elif kind==b"tRNS":
            require(channels==3 and not found_trns and not found_idat and size==6,
                    "invalid or misplaced RGB8 PNG tRNS: " + label)
            found_trns=True
        elif kind==b"IDAT":
            require(not idat_closed, "PNG IDAT chunks must be consecutive: " + label)
            idat.append(payload)
            found_idat=True
        elif kind==b"IEND":
            require(found_idat and size==0, "invalid PNG IEND")
            found_end=True
            offset+=size+12
            break
        else:
            require(not (65 <= kind[0] <= 90), "unrecognized critical PNG chunk")
        offset+=size+12
    require(found_end and offset==len(data), "PNG missing IEND or has trailing data")
    needed=(width*channels+1)*height
    try:
        decompressor=zlib.decompressobj()
        scan=decompressor.decompress(b"".join(idat), needed+1)
        require(not decompressor.unconsumed_tail,
                "PNG expands beyond declared dimensions: "+label)
        scan+=decompressor.flush()
        require(not decompressor.unused_data,
                "unexpected data after PNG zlib stream: "+label)
    except zlib.error as exc:
        raise ValidationError("corrupt compressed PNG: " + label) from exc
    require(decompressor.eof and len(scan)==needed,
            "invalid PNG decompressed size: "+label)
    stride=width*channels+1
    require(all(scan[i*stride] in (0,1,2,3,4) for i in range(height)),
            "PNG unsupported scanline filter: "+label)


def secure_evidence(e, evidence_dir):
    require(isinstance(e,dict) and set(e)=={"path","sha256"}, "evidence path/hash required")
    f=e["path"]
    require(isinstance(f,str) and f and "\\" not in f and not f.startswith("/"),
            "evidence relative POSIX path required")
    relative=PurePosixPath(f)
    require(".." not in relative.parts and "." not in relative.parts and
            relative.suffix.lower()==".png",
            "unsafe evidence path; only PNG screenshots accepted")
    require(isinstance(e["sha256"],str) and SHA.fullmatch(e["sha256"]),
            "invalid evidence SHA256")
    root=Path(evidence_dir).resolve()
    target=(root/Path(*relative.parts)).resolve()
    require(target.is_relative_to(root) and target.is_file(),
            "missing/unsafe evidence file: "+f)
    data=target.read_bytes()
    _check_png_structure(data, f)
    require(hashlib.sha256(data).hexdigest()==e["sha256"].lower(),
            "evidence SHA256 mismatch: "+f)

def validate_report(report, root, evidence_dir):
    require(isinstance(report,dict), "report must be JSON object")
    required={"schemaVersion","effectId","effectVersion","sourceCommit","status",
              "environment","fixture","checks","warnings"}
    require(set(report)==required, "invalid/missing report fields")
    require(report["schemaVersion"]==1, "unsupported report schema version")
    refs=catalog_requirements(root)
    require(report["effectId"] in refs, "unknown effect ID")
    doc=refs[report["effectId"]]["blueprint"]
    require(report["effectVersion"]==doc["effectVersion"],"effect version mismatch")
    require(isinstance(report["sourceCommit"],str) and
            COMMIT.fullmatch(report["sourceCommit"]),"commit SHA40 required")
    require(report["status"] in STATUS, "invalid report status")
    require(isinstance(report["warnings"],list) and
            all(isinstance(w,str) and w for w in report["warnings"]),
            "warnings must be string list")
    env=report["environment"]
    require(isinstance(env,dict) and
            {"browser","device","requestedBackend","actualBackend",
             "glVersion","gpu","offline","networkRequests"} <= set(env),
            "missing environment evidence")
    if env["actualBackend"] is None:
        require(report["status"]=="NOT RUN" and
                all(c.get("status")=="NOT RUN" for c in report["checks"]),
                "absent backend cannot claim completed tests")
        require(env["requestedBackend"] is None and env["glVersion"] is None
                and env["offline"] is None and env["networkRequests"] is None,
                "unrun report must not invent backend/network measurements")
        require(all(v is None or v=="NOT RUN" for v in
                    (env["browser"],env["device"],env["gpu"])),
                "unrun report must not claim real browser/device")
    else:
        for key in ("browser","device","gpu"):
            require(isinstance(env[key],str) and env[key].strip(), "missing "+key)
        require(env["requestedBackend"] in {"webgl","webgpu"},
                "requested backend must be explicit")
        require(env["actualBackend"] in BACKENDS,
                "actual backend must be webgl1, webgl2 or webgpu")
        require((env["requestedBackend"]=="webgpu") == (env["actualBackend"]=="webgpu"),
                "backend fallback cannot be PASS")
        if env["actualBackend"].startswith("webgl"):
            version="WebGL 1.0" if env["actualBackend"]=="webgl1" else "WebGL 2.0"
            require(isinstance(env["glVersion"],str) and
                    version.lower() in env["glVersion"].lower(),
                    "actual GL version must match "+env["actualBackend"])
        else:
            require(env["glVersion"] is None, "WebGPU must not claim WebGL context")
        require(env["offline"] is True and type(env["networkRequests"]) is int and
                env["networkRequests"]==0,"only verified offline runs accepted")
    fx=report["fixture"]
    require(isinstance(fx,dict) and
            {"seed","settings","width","height","fps","asset","frameTimesSeconds"} <= set(fx),
            "fixture fields required")
    require(type(fx["seed"]) is int and -2147483648<=fx["seed"]<=2147483647,
            "seed must be int32")
    require(isinstance(fx["settings"],dict) and fx["settings"],
            "exact parameter JSON required")
    if doc["rng"]["policy"]=="seeded-per-instance":
        require(fx["settings"].get("seed")==fx["seed"],
                "seed differs from settings")
    require(type(fx["width"]) is int and 1<=fx["width"]<=4096 and
            type(fx["height"]) is int and 1<=fx["height"]<=4096,
            "output dimensions invalid")
    require(fx["fps"]==60,"authoring FPS must be 60")
    require(isinstance(fx["asset"],str) and fx["asset"].strip(),
            "source asset identifier required")
    times=fx["frameTimesSeconds"]
    require(isinstance(times,list) and len(times)==3 and
            all(type(v) in (float,int) and math.isfinite(v) and v>=0 for v in times) and
            times[0]==0 and times[0]<times[1]<times[2] and
            abs(times[1]-times[2]/2)<1e-5,
            "0 / midpoint / endpoint sampling must be recorded in seconds")
    checks=report["checks"]
    require(isinstance(checks,list) and checks,
            "checks required")
    require(all(isinstance(c,dict) and
                {"id","kind","status","expected","actual","tolerance","evidence"} <= set(c)
                for c in checks),
            "check fields missing")
    ids=[c["id"] for c in checks]
    require(all(isinstance(x,str) and re.fullmatch(r"[a-z][A-Za-z0-9._-]+",x) for x in ids)
            and len(ids)==len(set(ids)), "invalid or duplicate check ID")
    # Bind required IDs to their semantic roles, not a caller-selected kind.
    phase_checks={f"phase.{x}" for x in refs[report["effectId"]]["phases"]}
    parameter_checks={f"parameter.{x}" for x in refs[report["effectId"]]["parameters"]}
    required_checks=phase_checks | parameter_checks | {"backend.actual"}
    require(required_checks<=set(ids),
            "missing per-effect phase/parameter/backend coverage: "+
            ", ".join(sorted(required_checks-set(ids))))
    statuses=[]
    for c in checks:
        statuses.append(c["status"])
        require(c["status"] in STATUS, "invalid check status")
        require(c["kind"] in KINDS, "invalid check kind")
        if c["id"] in phase_checks:
            require(c["kind"]=="visual", "required phase must be visual: "+c["id"])
        elif c["id"] in parameter_checks:
            require(c["kind"] in ("visual","numeric"), "required parameter must be visual or numeric: "+c["id"])
        elif c["id"]=="backend.actual":
            require(c["kind"]=="backend", "backend.actual must have backend kind")
        require(isinstance(c["expected"],str) and c["expected"].strip(),
                "missing expected measurement")
        require(isinstance(c["tolerance"],dict), "missing numeric/color tolerance")
        require(all(type(v) in (int,float) and math.isfinite(v) and v>=0
                    for v in c["tolerance"].values()), "tolerances must be finite nonnegative")
        require(isinstance(c["evidence"],list), "evidence list required")
        for file in c["evidence"]:
            secure_evidence(file,evidence_dir)
        if c["status"]=="NOT RUN":
            require(c["actual"] is None and not c["evidence"] and
                    isinstance(c.get("reason"),str) and c["reason"].strip(),
                    "NOT RUN requires reason and no fabricated result")
        else:
            require(c["actual"] is not None and c["actual"]!={},
                    "PASS/FAIL must include actual measurements")
        if c["status"] in ("PASS","FAIL") and c["kind"]=="visual":
            require(c["evidence"], "visual PASS/FAIL requires screenshot")
        if c["status"]=="PASS" and c["kind"]=="visual":
            measured=c["actual"]
            if c["id"] in phase_checks:
                require(isinstance(measured,dict) and
                        any(k in measured for k in ("changedPixels","visiblePixels")),
                        "phase PASS requires measured pixels: "+c["id"])
                for key in ("changedPixels","visiblePixels"):
                    if key in measured:
                        require(type(measured[key]) is int and measured[key]>=0,
                                "invalid phase pixel count: "+c["id"])
            if "changedPixelsMin" in c["tolerance"]:
                require(isinstance(measured,dict) and "changedPixels" in measured,
                        "missing changedPixels for declared threshold: "+c["id"])
            if isinstance(measured,dict) and "changedPixels" in measured:
                limit=c["tolerance"].get("changedPixelsMin",0)
                require(type(measured["changedPixels"]) is int and
                        measured["changedPixels"]>limit,"visual PASS has no measurable effect")
        if c["id"]=="backend.actual" and c["status"]=="PASS":
            require(c["actual"]==env["actualBackend"] and
                    c["expected"]==env["actualBackend"],
                    "backend check mismatch")
    computed="FAIL" if "FAIL" in statuses else "NOT RUN" if "NOT RUN" in statuses else "PASS"
    require(report["status"]==computed,
            "report status must be computed from every check, not asserted")
    if refs[report["effectId"]]["status"]!="reference-implementation":
        require(report["status"]=="NOT RUN" and all(s=="NOT RUN" for s in statuses),
                "specification-only effect cannot claim run/passed tests")
    return {"effectId":report["effectId"],"status":computed,
            "phaseChecks":len(refs[report["effectId"]]["phases"]),
            "parameterChecks":len(refs[report["effectId"]]["parameters"]),
            "checks":len(checks),"backend":env["actualBackend"]}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("report",type=Path)
    ap.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument("--evidence-dir",type=Path,default=None)
    ap.add_argument("--require-pass",action="store_true",
                    help="Release gate: exit 2 unless all required checks PASS")
    args=ap.parse_args()
    try:
        data=json.loads(args.report.read_text(encoding="utf-8"))
        result=validate_report(data,args.repo,args.evidence_dir or args.report.parent)
        print(json.dumps(result))
        return 2 if args.require_pass and result["status"]!="PASS" else 0
    except (ValidationError,ValueError,OSError) as exc:
        print("FX evidence validation FAILED: "+str(exc),file=sys.stderr)
        return 1

if __name__=="__main__":
    sys.exit(main())
