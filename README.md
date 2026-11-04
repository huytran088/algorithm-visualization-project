# CSE Algorithm Visualization Project

[![CI/CD](https://github.com/huytran088/algorithm-visualization-project/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/huytran088/algorithm-visualization-project/actions/workflows/ci-cd.yml)

**Live demo:** https://huytran088.github.io/avp/

The Algorithms Visualization Project is a web-based educational tool that helps users understand the logic and behavior of classic algorithms through step-by-step visualizations, pseudocode synchronization, and a “Test Yourself” interactive mode. The platform is designed to promote active learning, reinforce key algorithmic concepts, and allow for user interaction at each stage.


## Technical Details
  - **Base:** Node.js
  - **Framework:** React Router
  - **Frontend:** Tailwind CSS + Material Tailwind
  - **Tooling:** Vite
  - **Testing:** Vitest + Playwright
  - **Interpreter:** ANTLR grammar (`antlr-ng` → TypeScript, `antlr4ng` runtime)

The app is fully client-side: routes are prerendered to static HTML, algorithms are
`.avp` pseudocode files interpreted in the browser into a step-by-step trace.

## Documentation
  - [Architecture](docs/ARCHITECTURE.md) — components, data flow, directory layout
  - [Pseudocode reference](docs/PSEUDOCODE.md) — `.avp` language, directives, adding algorithms


## Getting Started

### Installation
Download and install the Node version listed in `.nvmrc`.
- Get it directly from [the Node website](https://nodejs.org/en/download)
- Or download it with [Node Version Manager](https://www.nvmnode.com/guide/download.html): `nvm install`

Install the dependencies:
```bash
npm install
npx playwright install
npm run build-g4   # generates the parser into app/hooks/interpreter/.antlr (git-ignored)
```

> `npm run build-g4` must be re-run whenever `Pseudocode.g4` changes. `typecheck`,
> `test`, `dev` and `build` all fail without the generated parser.

### Configuration
Copy `.env.example` to `.env` to override defaults:

| Variable | Purpose |
| --- | --- |
| `VITE_AI_API_URL` | Endpoint used by the AI pane (`POST {message}` → `{generated_code}`) |
| `VITE_BASE_PATH` | Base path the app is served from. Default `/avp/` (GitHub Pages); Docker uses `/` |

### Development
Start the live development server:
```bash
npm run dev
```
Your application will be available at `http://localhost:5173/avp/`.

### Testing
Check types and fix code errors using eslint and tsc:
```bash
npm run lint
npm run typecheck
```

Run the live testing suite:
```bash
npm run test
```

Tests come in two kinds:
- `*.node.test.ts` run in Node (logic, interpreter): `npx vitest run --project node`
- `*.render.test.tsx` run in headless Chromium, Firefox and WebKit through Playwright: `npx vitest run --project browser`
  (to run a single browser, add `--browser=chromium`)

### Building
Create a production build:
```bash
npm run build
```

### Deployment

#### Static build
`npm run build` prerenders every route into `build/client/`. With a non-root base
path, React Router nests the HTML under `build/client/<base>/` while assets stay at
the root, so use **`npm run build:site`**, which merges both into a directly
servable `build/site/` (and adds a `404.html` SPA fallback):
```bash
VITE_BASE_PATH=/my/path/ npm run build:site   # serve build/site at /my/path/
```

#### GitHub Pages (CI/CD)
`.github/workflows/ci-cd.yml` runs on every push and pull request:

| Job | When | What |
| --- | --- | --- |
| `checks` | always | `npm ci`, `build-g4`, lint, typecheck, node tests |
| `browser-tests` | always | Vitest browser tests on Chromium, Firefox and WebKit |
| `build-site` | after `checks` | `build:site` with base path `/avp/`, uploaded as an artifact |
| `deploy-site` | `main` only, after all tests | Commits the build into `avp/` of [`huytran088.github.io`](https://github.com/huytran088/huytran088.github.io), served at https://huytran088.github.io/avp/ |
| `docker` | after `checks` | Builds the image (amd64 + arm64); pushes to GHCR on `main` and `v*` tags |

The site is published through the GitHub Pages **user site** rather than this
repo's own project Pages, so the URL is `/avp/` while the repo keeps its name.
`deploy-site` pushes with an SSH deploy key that has write access to
`huytran088.github.io` only. The private key is stored in this repo as the
`USER_SITE_DEPLOY_KEY` Actions secret. To change the target, edit `SITE_REPO` /
`SITE_DIR` at the top of the workflow.

#### Docker
The multi-stage `Dockerfile` builds the site with Node and serves it with nginx.
```bash
docker compose up --build            # http://localhost:8080
# or
docker build -t avp .
docker run -p 8080:80 avp

# serve under a sub-path instead of /
docker build -t avp --build-arg VITE_BASE_PATH=/avp/ .
docker run -p 8080:80 avp            # http://localhost:8080/avp/
```
Prebuilt images are published by CI:
```bash
docker run -p 8080:80 ghcr.io/huytran088/algorithm-visualization-project:latest
```
The container exposes a `/healthz` endpoint and a Docker `HEALTHCHECK`. nginx
config lives in `docker/nginx.conf.template`.

## Credits

### Algorithm Logic & Pseudocode Designers
  - Matthew Valachek
  - Charlie Szczepanski
  - Xavier Rankin

### Pseudocode Developers
  - Nat Wagner
  - Stefan Wenzske

### UI/UX Designers
  - Benjamin Pryor
  - Cole Lingo
  - Nate Richmond

### AI Integration Developers
  - Huy Tran
