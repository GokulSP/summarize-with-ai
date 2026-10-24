# summarize-with-ai

A userscript that summarizes articles with Claude or Gemini in one click, with an image gallery, follow-up Q&A, and a Dieter Rams–inspired UI — for readers of Harvard Business Review, The Economist, and McKinsey & Company who want the gist without the full article. Personal fork of [Summarize with AI](https://github.com/insign/userscripts) by Hélio.

## Setup

Prerequisites, each with a verify command:

| Tool | Install | Verify |
| --- | --- | --- |
| A userscript manager | [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) (Greasemonkey 4 lacks `GM_addElement`, which the UI's stylesheet needs) | Extension icon/menu appears in the browser toolbar |
| An API key | [Anthropic](https://console.anthropic.com/) or [Google AI](https://aistudio.google.com/apikey) | Entered when prompted on your first visit to a supported site; summarizing with Alt+S succeeds with no 401 in the browser console |
| Microsoft Edge (only for `task test:e2e`) | Built into Windows; elsewhere `pnpm exec playwright install msedge` | `task test:e2e` passes |

Then the one install command:

```bash
task setup   # pnpm install + lefthook install
```

`task setup` is for working on the userscript's code. To use the userscript itself (no coding required):

1. Install a userscript manager (above)
2. Click to install: **[Summarize with AI](https://gokulsp.github.io/summarize-with-ai/summarize-with-ai.user.js)**
3. Visit a supported site and enter your API key when prompted
4. Verify: open your userscript manager's dashboard and confirm "Summarize with AI" is listed and enabled

## Application commands

This is a browser userscript, not a CLI — there's no terminal command to run. Its one entry point is triggered from the page itself, on a supported site (Harvard Business Review, The Economist, McKinsey & Company):

- **Alt+S**, or click the floating button — summarizes the current article with the latest Claude or Gemini model (auto-discovered at runtime)
- **Long-press the button** (or press Arrow Up while it has focus) — switch models; each model keeps its own summary cache
- Once a summary appears — browse the image gallery or ask follow-up questions; see [Features](#features) for the full list

There's no terminal output to show: success looks like the summary panel rendering in place over the article.

## Configuration

None — no `process.env` usage anywhere in the script; the API key is stored via `GM.setValue`/`GM.getValue` (the userscript manager's own storage), entered through the in-page prompt rather than an environment variable or config file.

## Development commands

| Command | What it runs |
| --- | --- |
| `task lint` | biome check (JS/JSON) and rumdl (Markdown), fixing in place |
| `task typecheck` | tsc --checkJs |
| `task test` | vitest, failing under the coverage floors; scope to one test with `task test -- summarize-with-ai.ui.test.js -t "long press"` |
| `task test:e2e` | Playwright in Edge, outside the git hooks and `task ci`; scope to one test with `task test:e2e -- -g "long press"` |
| `task audit` | pnpm audit + semgrep |
| `task ci` | every gate on every file plus a full-history secret scan |

`summarize-with-ai.ui.test.js` runs the real userscript in a happy-dom page with only the userscript manager (`GM.*`) and the `@require`d Readability stood in, then drives it like a user: clicks, long presses, keys, touches. `summarize-with-ai.e2e.js` runs it the same way in Edge, on a page whose CSS is written to break injected UI (a 10px root font, `!important` fonts on every tag, a z-index on every body child under a fixed banner), and checks what happy-dom can't compute: the UI's styles and the events that cross its shadow root.

## Features

- One-click summarization (Alt+S) using Claude or Gemini — latest Sonnet/Flash model auto-discovered at runtime
- Long-press the button (or press Arrow Up while it has focus) to switch models; each model keeps its own summary cache
- Image gallery with full-screen lightbox (keyboard + swipe navigation)
- Follow-up Q&A about the article, answered by the same model
- Dark mode, mobile-optimized, custom modals instead of browser dialogs
- Supported sites: Harvard Business Review, The Economist, McKinsey & Company

## Notes

All code lives in `summarize-with-ai.user.js`; bump `@version` in its header on every change (lefthook syncs `.meta.js` and `package.json` automatically on commit).

## License

WTFPL — see [LICENSE](LICENSE). Original work by Hélio ([@insign](https://github.com/insign)); fork maintained by Gokul SP ([@gokulsp](https://github.com/gokulsp)).

## Project structure

```text
summarize-with-ai/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml         # On push to main: biome check, typecheck:js and test:js, then publishes every tracked file to GitHub Pages, the URL userscript managers poll for updates
├── scripts/
│   └── sync-metadata.js             # + sync-metadata.test.js — derives .meta.js/package.json's version from .user.js's @version header; run by lefthook's pre-commit metadata stage
├── .editorconfig
├── .gitattributes                   # Line endings pinned per file type, so a checkout matches what the linters write
├── .gitignore
├── .rumdl.toml                      # rumdl config for task lint:md
├── CLAUDE.md                        # Agent notes: module boundaries and invariants
├── LICENSE                          # WTFPL — original work by Hélio (@insign), fork maintained by Gokul SP
├── README.md                        # This file
├── summarize-with-ai.user.js        # The entire userscript — UI, summarization logic, API calls, image gallery, Q&A — + summarize-with-ai.test.js (pure-logic unit tests), summarize-with-ai.ui.test.js (happy-dom UI/interaction tests: clicks, long-press, keys, touches), summarize-with-ai.e2e.js (Edge tests: styles and shadow-root events on a hostile page)
├── summarize-with-ai.meta.js        # Userscript-manager metadata, auto-derived from .user.js's @version header
├── Taskfile.yml                     # Single source of truth for every command
├── biome.json                       # Biome lint/format configuration
├── conformance-waivers.toml         # Reasoned exceptions to dev-env's task check:conformance (the local test:js)
├── global.d.ts                      # Ambient globals for the @require'd Readability.js CDN scripts (tsc --checkJs)
├── jsconfig.json                    # JS type-checking configuration (tsc --checkJs)
├── knip.jsonc                       # knip (unused files/exports/packages) configuration
├── lefthook.yml                     # Git hooks configuration
├── package.json                     # pnpm package manifest
├── playwright.config.js             # Playwright config for task test:e2e — Edge, one worker
├── pnpm-lock.yaml                   # pnpm lockfile
└── pnpm-workspace.yaml              # pnpm workspace config — supply-chain cooldown (minimumReleaseAge), build allowlist, nanoid and source-map-js overrides
```
