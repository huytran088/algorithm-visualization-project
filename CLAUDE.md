# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node version is pinned in `.nvmrc`. After `npm install`, generate the parser:

```bash
npm run build-g4    # generates app/hooks/interpreter/.antlr (git-ignored)
```

`typecheck`, `test`, `dev` and `build` all fail without the generated parser. Re-run `build-g4` whenever `Pseudocode.g4` changes.

```bash
npm run dev         # http://localhost:5173/avp/
npm run lint
npm run typecheck   # react-router typegen && tsc
npm run build:site  # production build, merged into a servable build/site/

# Tests (`npm test` starts watch mode; use `vitest run` for a single pass)
npx vitest run --project node                       # *.node.test.ts
npx vitest run --project browser                    # *.render.test.tsx in all 3 browsers
npx vitest run --project browser --browser=chromium # one browser
npx vitest run --project node tests/globals.node.test.ts  # one file
npx vitest run --project node -t "test name"              # by test name
```

Browser tests need `npx playwright install`. CI runs lint, typecheck, node tests, and browser tests on each browser.

## Architecture

Fully client-side React Router v7 app (framework mode, `ssr: false`). Every route is prerendered to static HTML. The only network calls are for static `public/code/*.avp` files and the optional AI endpoint. See `docs/ARCHITECTURE.md` for diagrams and `docs/PSEUDOCODE.md` for the `.avp` language.

### Pipeline

Algorithms are `.avp` pseudocode files, and the interpreter produces a trace rather than an animation:

1. `useAlgo` fetches `/code/<name>.avp` (from `/run?algorithm=<name>`), takes the first-line `// Title` as the page title, and strips it.
2. `useInterpreter` runs the ANTLR lexer/parser, then `TraceInterpreterVisitor` executes the program once and records a flat `Step[]`. Each step has source line(s) and a list of actions.
3. `useSteps` holds the step cursor and consumes `var_*` actions for `VarsPane`. `VisBuilder` consumes `vis_*` actions and renders through `VisRenderer`.

Stepping backward is cheap because the trace is precomputed; nothing re-executes. Editing in the Code pane (`useEditSrc`) only re-runs the interpreter on **Save**.

### Interpreter changes

- `Pseudocode.g4` is the source of truth for the language.
- Two visitors walk the parse tree: `TraceInterpreterVisitor` (the real execution) and `TsInterpreterVisitor` (transpiles to JS for the `/interp` debug page). `useInterpreter` runs both inside one `try`, so a throw in the debug visitor also stops the trace. Language changes must be handled in both.
- New trace actions touch `TraceType.ts`, the emitting visitor, and the consumer (`useSteps` or `VisBuilder`).
- Loops are capped at 1000 iterations so a user's infinite loop cannot freeze the tab.

### Base path

`Globals.RouteBaseName` in `app/globals.ts` resolves `VITE_BASE_PATH` (default `/avp/`; Docker uses `/`). Vite `base`, React Router `basename`, prerendered paths and every asset/link URL derive from it, so don't hardcode root-relative URLs. `globals.ts` is imported by both Node configs and the client bundle, so it reads both `import.meta.env` and `process.env`.

With a non-root base path, `npm run build` nests HTML under `build/client/<base>/` while assets stay at the root. `scripts/stage-site.mjs` (run by `build:site`) merges them into `build/site/` and adds a `404.html` SPA fallback. Use `build:site` for anything meant to be served.

### Deployment

`main` deploys by committing the build into `avp/` of the separate `huytran088.github.io` repo (not this repo's Pages), so the URL is `/avp/` regardless of this repo's name. `SITE_REPO` and `SITE_DIR` are at the top of `.github/workflows/ci-cd.yml`. Docker images go to GHCR.

## Conventions

- Tests live in `tests/`, mirroring `app/`. The filename suffix selects the Vitest project: `*.node.test.ts` or `*.render.test.tsx`.
- To add a bundled algorithm: add `public/code/<name>.avp`, a card in `Globals.AlgorithmCards` (`app/globals.ts`), and light/dark thumbnails in `public/img/`. `interpreter.node.test.ts` automatically checks that every bundled file parses and runs.
- UI preferences persist in `localStorage`; the full key list is in `docs/ARCHITECTURE.md`.
- ESLint enforces style: semicolons, 2-space indent, 1tbs braces, trailing operators on line breaks, and an 80-column warning. `_` marks intentionally unused variables.
- Known stubs and gaps (`/wiki`, `/interp`, disabled menu items, `vis_sort`) are listed under "Known gaps" in `docs/ARCHITECTURE.md`.

## Git and github

- Base branch: main. Branch names: feat/<issue>-<slug>, fix/<issue>-<slug>, docs/<slug>.
- Commits: Conventional Commits (feat:, fix:, test:, docs:, refactor:), one logical change each, tests passing.
- Never push, force-push, open, merge, or close PRs; I do those. Never rewrite history on main.
- Use `gh` for reading issues, PRs, checks and review comments.
- Wiki repo: ../<repo>.wiki (link pages with [[Page Name]], keep \_Sidebar.md as the table of contents, commit but never push)
