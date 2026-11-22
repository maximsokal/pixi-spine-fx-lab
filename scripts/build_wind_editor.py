#!/usr/bin/env python3
"""Build the independent AIR-01 Wind editor as a self-contained offline HTML.

No changes to the reference Burn Lab, its HTML or protected hashes.
"""
import argparse
import json
import re
from pathlib import Path
from build_editor import sample_data, text, local


def escape_script(source):
    return re.sub(r"</script", r"<\/script", source, flags=re.I)


def build(root):
    template = root / "assets" / "template"
    wind = root / "assets" / "wind-gust" / "src"
    manifest = json.loads(text(local(template, "template.json")))
    assert manifest["runtime"] == {
        "pixi": "8.22.0", "spinePixiV8": "4.2.120", "spineExport": "4.2.x"
    }, "Runtime pins changed; audit before generating Wind"
    html = text(wind / "ui.html")
    markers = ("<!-- VENDOR -->", "<!-- CORES -->", "<!-- APP -->",
               "<!-- EXPORT -->", "__SAMPLE_DATA__")
    for marker in markers:
        if html.count(marker) != 1:
            raise ValueError("Expected exactly one marker: " + marker)
    scripts = [
        ("vendor/pixi-8.22.0.min.js", None),
        ("vendor/spine-pixi-v8-4.2.120.min.js", None),
        ("src/curve-core.js", "fxCurveCore"),
        ("src/spacing-core.js", "fxSpacingCore"),
        ("src/path-core.js", "fxPathCore"),
                ("src/color-core.js", "fxColorCore"),
        ("src/timeline-core.js", "fxTimelineCore"),
        ("src/curve-editor.js", "fxCurveEditor"),
        ("src/color-ui.js", "fxColorUi"),
    ]
    vendor = []
    common = []
    for name, sid in scripts:
        src = escape_script(text(local(template, name)))
        tag = "<script" + (f' id="{sid}"' if sid else "") + ">" + src + "</script>"
        (common if sid else vendor).append(tag)
    for name, sid in [
        ("wind-core.js", "fxWindCore"),
        ("wind-runtime.js", "fxWindRuntime"),
        ("zip-core.js", "fxWindZip")
    ]:
        src = escape_script(text(wind / name))
        common.append(f'<script id="{sid}">{src}</script>')
    # Runtime license text remains visible in the exported developer ZIP.
    notices = text(local(template, "licenses/spine.txt")) + "\n" + text(local(template, "licenses/pixi.txt"))
    common.append('<script id="runtimeLicenses" type="text/plain">' +
                  escape_script(notices) + "</script>")
    sample = json.dumps(sample_data(template, manifest),
                        separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    html = (html.replace("<!-- VENDOR -->", "\n".join(vendor))
            .replace("<!-- CORES -->", "\n".join(common))
            .replace("<!-- APP -->", "<script>" + escape_script(text(wind / "wind-editor.js")) + "</script>")
            .replace("<!-- EXPORT -->", "<script>" + escape_script(text(wind / "wind-export.js")) + "</script>")
            .replace("__SAMPLE_DATA__", sample))
    # Strip historical vendor shader trailing spaces in generated HTML only;
    # keep the protected runtime source files byte-for-byte unchanged.
    return re.sub(r"[ \t]+(?=\r?\n)", "", html)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path,
                        help="Destination Wind_Gust_Lab.html")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.expanduser().resolve()
    if output == (root / "assets/Spine_Burn_Lab.html").resolve():
        parser.error("Cannot replace protected Burn reference HTML")
    try:
        html = build(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(html.encode("utf8"))
    except (OSError, ValueError, AssertionError, KeyError) as exc:
        parser.exit(1, "Wind build failed: " + str(exc) + "\n")
    print(json.dumps({"output": str(output), "bytes": output.stat().st_size}))


if __name__ == "__main__":
    main()
