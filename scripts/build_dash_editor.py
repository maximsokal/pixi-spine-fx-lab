#!/usr/bin/env python3
"""Build GAME-07 offline standalone authoring preview using pinned Pixi."""
import argparse
import json
import re
from pathlib import Path
from build_editor import local, text, sample_data


def build(root):
    template = root / "assets/template"
    source = root / "assets/teleport-dash/src"
    manifest = json.loads(text(local(template, "template.json")))
    if manifest["runtime"] != {"pixi": "8.22.0", "spinePixiV8": "4.2.120", "spineExport": "4.2.x"}:
        raise ValueError("Runtime pins changed; review GAME-07")
    html = text(local(source, "ui.html"))
    def tag(base, name):
        return '<script id="' + Path(name).name + '">' + re.sub(r"</script", r"<\\/script", text(local(base, name)), flags=re.I) + "</script>"
    vendor = '<script type="text/plain" id="runtimeLicenses">' + text(local(template, "licenses/pixi.txt")) + "\n" + text(local(template, "licenses/spine.txt")) + "</script>\n" + "\n".join(tag(template, name) for name in manifest["browserScripts"])
    sample = json.dumps(sample_data(template, manifest), separators=(",", ":")).replace("</", "<\\/")
    cores = [tag(template, "src/" + name) for name in ("curve-core.js", "spacing-core.js", "path-core.js", "color-core.js", "curve-editor.js", "color-ui.js")]
    cores += [tag(source, name) for name in ("dash-core.js", "dash-spine.js", "dash-runtime.js", "dash-editor-state.js")]
    for marker, value in (("<!-- VENDOR -->", vendor), ("<!-- CORES -->", "\n".join(cores)), ("__SAMPLE_DATA__", sample), ("<!-- APP -->", tag(source, "dash-editor.js"))):
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
    try:
        result = build(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(result.encode("utf-8"))
        print(json.dumps({"output": str(output), "bytes": output.stat().st_size}))
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, "Teleport Dash preview build failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
