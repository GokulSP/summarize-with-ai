# summarize-with-ai

Project-specific notes for summarize-with-ai. See README.md for setup, usage, and dev commands.

## Map

- `biome.json` runs Biome's recommended preset with one change: `noUnusedVariables` is raised from warning to error, because `biome check` exits 0 on warnings and an unused variable would otherwise never block a commit. No other rule is turned off.
- `UiRoot` in `summarize-with-ai.user.js` owns the one open shadow root (host element `<sai-root>`) that every UI element and the stylesheet live in. Page listeners see events from inside it retargeted to the host, so code on `document` checks `UiRoot.contains`, `event.composedPath()` or `isInputFocused()`, never `event.target` or `document.activeElement` alone.
- A test that depends on computed styles or on an event crossing the shadow root goes in `summarize-with-ai.e2e.js` (Edge), not `summarize-with-ai.ui.test.js` (happy-dom). happy-dom lets a parent's `!important` override a child's own declarations through inheritance, and it doesn't retarget events that leave a shadow root, so such a test passes or fails there for the wrong reason.

## Invariants

- **Don't hand-edit `.meta.js` or `package.json`'s version.** `scripts/sync-metadata.js` (run by lefthook's `metadata` pre-commit stage) derives both from the userscript's `@version` header on every commit — a manual edit to either gets overwritten.
- **Don't push to the default branch as a routine commit.** There's no npm package or build step — `.github/workflows/deploy-pages.yml` publishes straight to GitHub Pages, which is the URL Tampermonkey/Violentmonkey poll for updates, so every push ships to every installed user immediately. Treat a push here like a release, and run `task test:e2e` before one: neither git hook nor `task ci` runs it.
- **Don't add UI elements or styles to the page's own DOM; go through `UiRoot.append`.** The ids and class names carry no prefix (`overlay`, `modal-overlay`, `answer`), so outside the shadow root they collide with the host page's in both directions, and page rules (`!important` ones included) restyle the UI. `summarize-with-ai.e2e.js` fails if the stylesheet leaks.
- **Don't size anything in rem.** rem measures the page's `<html>` font size even inside the shadow root, so a site with a 62.5% root font shrinks the UI; px (and em, relative to the UI's own px sizes) is unaffected.
- **Don't add `!important` beyond the `:host` reset.** Nothing outside the shadow root can match the UI's elements, so it can only settle a fight between the stylesheet's own rules, which specificity already settles; `:host { all: initial !important }` is the exception because the host element is the one node page rules still match, and only an `!important` from inside the shadow root beats theirs.
