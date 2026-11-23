# Maintainer: Publish the Staged Wiki

These Markdown pages are authored and reviewed in the main repository at `docs/wiki/` to provide versioned source history. **They are not automatically synchronized with the GitHub Wiki.** The native Wiki has a different Git repository, `pixi-spine-fx-lab.wiki.git`. Publishing these pages requires a separate authenticated Wiki Git push or an explicitly configured sync workflow.

## Safe publication procedure

1. Confirm GitHub Wiki editing is enabled and check the existing [Wiki](https://github.com/maximsokal/pixi-spine-fx-lab/wiki) and page index before replacing any content.
2. Check the **current branch and working tree** of each repository. Clone `https://github.com/maximsokal/pixi-spine-fx-lab.wiki.git` into a **separate** local directory using an authorized Git credential.
3. Back up existing Wiki pages and resolve any conflicting page titles manually. Do not force-push, delete unrelated pages, or overwrite human edits.
4. Copy the authored Markdown files from `docs/wiki/` into the Wiki clone's top level. Place `_Sidebar.md` at the Wiki root. Skip this maintainer-only file if it would clutter the public navigation.
5. Review Git diff and verify links/media. Commit in the Wiki repository on its intended branch and perform a **normal fast-forward push**.
6. Reopen native Wiki pages and check Home/sidebar/page links, effect catalog entries and Markdown formatting. Verify that the Wiki shows the new commit after push.

**Source of truth:** docs and Blueprints in `main`; Wiki is a curated user-facing summary, not a second technical specification. Update the Wiki only after source docs and implementation status are verified.

Maintainers should not report “published to GitHub Wiki” merely because the `docs/wiki` files exist in the main repository.
