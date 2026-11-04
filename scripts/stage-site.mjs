/**
 * Stages the React Router static build into a single directory that can be
 * served as-is from the configured base path (GitHub Pages, nginx, ...).
 *
 * With a non-root basename, React Router writes prerendered HTML to
 * `build/client/<base>/` while assets stay at `build/client/`. Hosting serves
 * the site *at* `<base>`, so both need to be merged into one root:
 *
 *   build/client/assets, code, img, ...     ─┐
 *   build/client/<base>/index.html, run/... ─┴─► build/site/
 *
 * The SPA fallback is also copied to `404.html` so unknown paths still boot
 * the client router on GitHub Pages.
 *
 * Usage: node scripts/stage-site.mjs   (respects VITE_BASE_PATH)
 */
import { cpSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const client = join(root, 'build', 'client');
const site = join(root, 'build', 'site');

const raw = process.env.VITE_BASE_PATH || '/avp/';
const base = raw.replace(/^\/+|\/+$/g, '');

if (!existsSync(client)) {
  console.error(`Missing ${client}; run "npm run build" first.`);
  process.exit(1);
}

rmSync(site, { recursive: true, force: true });

// Copy everything except the nested prerender directory...
cpSync(client, site, {
  recursive: true,
  filter: src => !base || resolve(src) !== join(client, base),
});

// ...then lift the prerendered HTML to the root.
if (base) {
  const nested = join(client, base);
  if (!existsSync(nested)) {
    console.error(`Expected prerendered pages in ${nested}. Was the build made with VITE_BASE_PATH=${raw}?`);
    process.exit(1);
  }
  cpSync(nested, site, { recursive: true });
}

const fallback = join(site, '__spa-fallback.html');
if (existsSync(fallback)) copyFileSync(fallback, join(site, '404.html'));

console.log(`Staged site for base "/${base}${base ? '/' : ''}" at ${site}`);
