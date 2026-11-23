# Getting Started

Pixi Spine FX Lab consists of a **ready-to-open editor** and an **Agent Skill** used to adapt that editor for a particular effect. You can use the existing editor without installing the skill.

## Open a working editor

1. Download or clone [the repository](https://github.com/maximsokal/pixi-spine-fx-lab).
2. Open `assets/Spine_Burn_Lab.html` in a current Chromium-based browser. It contains all required runtime code and an embedded sample; no server, account or network access is needed.
3. Select the sample animation and skin, adjust the visible effect controls, and try the preview, PNG bake or developer ZIP export.
4. For a different effect, open the corresponding `assets/*_Lab.html` file in [[Effect-Editors]] rather than assuming the Burn UI changes effect types.

## Install as an Agent Skill

**Claude Code — user scope**

~~~sh
git clone https://github.com/maximsokal/pixi-spine-fx-lab ~/.claude/skills/pixi-spine-fx-lab
~~~

For a single project, put the skill in `.claude/skills/pixi-spine-fx-lab/`. The destination must contain `SKILL.md` at its top level. Other compatible Agent Skills hosts use the same `SKILL.md` / `assets/` / `references/` / `scripts/` structure; see [installation instructions](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/installation.md).

## Create an editable copy of the Burn baseline

Prerequisites: Python **3.10+**. Run from the repository root. Choose a new/empty output directory *outside the installed skill*.

~~~sh
python scripts/bootstrap_editor.py --output /path/to/my-fx-lab
python scripts/verify_project.py /path/to/my-fx-lab
python scripts/build_editor.py /path/to/my-fx-lab --output /path/to/My_FX_Lab.html
python scripts/verify_project.py /path/to/my-fx-lab --html /path/to/My_FX_Lab.html
~~~

The output is a standalone HTML editor. Do **not** overwrite protected template/vendor files while creating a different FX design.

## Build an existing specialized editor

Specialized effects have their own source folders and builders. For example:

~~~sh
python scripts/build_torch_editor.py --output /path/to/Torch_Flame_Lab.html
python scripts/build_bubbles_editor.py --output /path/to/Rising_Bubbles_Lab.html
~~~

For all available effect-specific builders, see [[Effect-Editors]]. A builder creates a file; it is not a substitute for browser/visual tests. The shipped `assets/*_Lab.html` files can be opened directly.

## Browser regression prerequisites

Browser checks need Node.js, Playwright and Chromium. If they are not on the default paths, set `PLAYWRIGHT_MODULE` and/or `BROWSER_EXECUTABLE`. Generated Vite developer examples require Node.js **20.19+ or 22.12+**. See [[Validation-and-Tests]].

## Licensing

The project's original code is MIT. The embedded **Spine Runtimes** carry the separate [Spine Runtimes License](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/template/licenses/spine.txt); users of products using the runtime need their own Spine Editor license, and redistribution must retain notices. Bundled demo artwork is **all rights reserved**. Read [NOTICE.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/NOTICE.md) before redistribution.
