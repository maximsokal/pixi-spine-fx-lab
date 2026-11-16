# Installation and portability

## Claude chat/settings

Upload a ZIP whose top-level entry is the `pixi-spine-fx-lab/` folder containing `SKILL.md` and its assets/references/scripts. In Claude, use Customize > Skills > Add/Create skill > Upload a skill, then enable it. UI wording can vary; see the official pages below. Code execution/file capabilities must be enabled for scripts and generated artifacts.

Attaching the ZIP to a conversation is a one-conversation handoff: ask Claude to unpack/read SKILL.md and use the bundled editor. Attaching alone does not install a persistent skill or enable settings automatically. Do not paste only SKILL.md when you need the actual runtime/template assets.

## Claude Code

Extract the folder into `~/.claude/skills/pixi-spine-fx-lab/` for personal use, or `.claude/skills/pixi-spine-fx-lab/` inside a project. Invoke `/pixi-spine-fx-lab` or describe a matching task. Avoid nesting the skill folder twice.

## ChatGPT Work / other Agent Skills hosts

Use the standard SKILL.md, scripts, references and assets layout. The `agents/openai.yaml` file is UI metadata for compatible OpenAI hosts and can be ignored by Claude. Saving through the Work skill workspace makes the skill reusable here; other installations have their own discovery/reload rules. Do not assume uploading a Claude ZIP installs it in every other application.

## GitHub

A GitHub repository is optional for source history, reviews and sharing. It is not required for the ZIP or local skill installation. When the repository root is this skill folder (as in the published layout, with `SKILL.md` at the root), install it with `git clone <repository-url> ~/.claude/skills/pixi-spine-fx-lab`; `.gitattributes` keeps hashed vendor, license and sample files byte-identical on every platform. Do not create/publish a repository or redistribute customer Spine files without authorization. Preserve the bundled Pixi/Spine notices and review their actual terms before redistribution; the entire package is not automatically MIT-licensed.

Official sources checked 2026-10-26:
- https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- https://support.claude.com/en/articles/12512180-use-skills-in-claude
- https://code.claude.com/docs/en/skills
- https://agentskills.io/specification
