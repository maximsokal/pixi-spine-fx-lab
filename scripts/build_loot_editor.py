#!/usr/bin/env python3
"""Build the GAME-12 offline authoring preview outside the source tree."""
import argparse
import json
import re
from pathlib import Path
from build_editor import local, text, sample_data


def build(root):
    template = root / "assets/template"
    source = root / "assets/loot-sparkle/src"
    manifest = json.loads(text(local(template, "template.json")))
    if manifest["runtime"] != {"pixi": "8.22.0", "spinePixiV8": "4.2.120", "spineExport": "4.2.x"}:
        raise ValueError("Runtime pins changed; review GAME-12")
    html = text(local(source, "ui.html"))

    def tag(base, name):
        return "<script id=\"" + Path(name).name + "\">" + re.sub(r"</script", r"<\\/script", text(local(base, name)), flags=re.I) + "</script>"

    notices = text(local(template, "licenses/pixi.txt")) + "\n" + text(local(template, "licenses/spine.txt"))
    vendor = "<script type=\"text/plain\" id=\"runtimeLicenses\">" + notices + "</script>\n" + "\n".join(tag(template, name) for name in manifest["browserScripts"])
    cores = [tag(template, "src/" + name) for name in (
        "curve-core.js", "spacing-core.js", "color-core.js", "timeline-core.js", "curve-editor.js", "color-ui.js")]
    cores += [tag(source, name) for name in ("loot-core.js", "loot-runtime.js", "loot-spine.js", "loot-export.js", "loot-bake.js", "loot-export-browser.js")]
    sample = json.dumps(sample_data(template, manifest), separators=(",", ":")).replace("</", "<\\/")
    for marker, value in (("__SAMPLE_DATA__", sample), ("<!-- VENDOR -->", vendor), ("<!-- CORES -->", "\n".join(cores)),
                          ("<!-- APP -->", tag(source, "loot-editor.js"))):
        if html.count(marker) != 1:
            raise ValueError("Expected exactly one marker: " + marker)
        html = html.replace(marker, value)
    return html


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.expanduser().resolve()
    if output.is_relative_to(root):
        parser.error("Write generated preview outside the source repository")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(build(root).encode("utf-8"))
    print(json.dumps({"output": str(output), "bytes": output.stat().st_size}))


if __name__ == "__main__":
    main()
