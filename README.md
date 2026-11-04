# CSE Algorithm Visualization Project

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

The deployment base path (`/MiamiOH-AVP-Demo/`) is set by `RouteBaseName` in `app/globals.ts`.

### Development
Start the live development server:
```bash
npm run dev
```
Your application will be available at `http://localhost:5173/MiamiOH-AVP-Demo/`.

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
`npm run build` prerenders every route to static files under `build/client/`.
Deploy that directory to any static host, served at the base path configured in `app/globals.ts`:
```
build/
└── client/
    ├── MiamiOH-AVP-Demo/   # prerendered HTML for /, /run, /wiki, /interp
    ├── assets/             # JS/CSS bundles
    ├── code/, img/         # copied from public/
    └── __spa-fallback.html
```

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
