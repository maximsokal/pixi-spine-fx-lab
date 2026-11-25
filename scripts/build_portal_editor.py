#!/usr/bin/env python3
"""Build GAME-06 offline standalone authoring preview using pinned Pixi."""
import argparse
import json
import re
from pathlib import Path
from build_editor import local, text


def build(root):
    template = root / "assets/template"
    source = root / "assets/magic-portal/src"
    manifest = json.loads(text(local(template, "template.json")))
    if manifest["runtime"] != {"pixi": "8.22.0", "spinePixiV8": "4.2.120", "spineExport": "4.2.x"}:
        raise ValueError("Runtime pins changed; review GAME-06")
    html = text(local(source, "ui.html"))
    def tag(base, name):
        return '<script id="' + Path(name).name + '">' + re.sub(r"</script", r"<\\/script", text(local(base, name)), flags=re.I) + "</script>"
    vendor = '<script type="text/plain" id="runtimeLicenses">' + text(local(template, "licenses/pixi.txt")) + "</script>\n" + tag(template, "vendor/pixi-8.22.0.min.js")
    cores = [tag(template, "src/" + name) for name in ("curve-core.js", "spacing-core.js", "color-core.js", "curve-editor.js", "color-ui.js")]
    cores += [tag(source, name) for name in ("portal-core.js", "portal-runtime.js")]
    for marker, value in (("<!-- VENDOR -->", vendor), ("<!-- CORES -->", "\n".join(cores)), ("<!-- APP -->", tag(source, "portal-editor.js"))):
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
        parser.exit(1, "Magic Portal preview build failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
