import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { afterEach, expect, test, describe, vi } from 'vitest';

import '../../app/app.css';

import Globals from '../../app/globals';
import Wiki from '../../app/routes/wiki';

/**
 * Renders the page into a full-height container, as root.tsx does with body.
 * Percentage heights resolve the same way as in production, so the scrolling
 * and overflow tests exercise the real layout.
 */
async function renderWiki() {
  const container = document.createElement('div');
  container.className = 'h-dvh overflow-hidden';
  document.body.appendChild(container);

  return render(<Wiki />, { container });
}

/**
 * Returns the wiki's scrolling content area.
 */
function content(baseElement: HTMLElement) {
  return baseElement.querySelector('#wiki-content') as HTMLElement;
}

describe('Test route: wiki', async () => {
  afterEach(() => {
    localStorage.removeItem('theme');
    document.body.classList.remove('dark');
    history.scrollRestoration = 'auto';
  });

  test('Check that AppFrame is rendered', async () => {
    const screen = await render(<Wiki />);

    await expect(screen.baseElement.querySelector('main')).toBeInTheDocument();
    await expect(screen.baseElement.querySelector('header')).toBeInTheDocument();
    await expect(screen.baseElement.querySelector('footer')).toBeInTheDocument();
  });

  test('Check that the placeholder is gone', async () => {
    const screen = await render(<Wiki />);

    await expect(screen.baseElement).not.toHaveTextContent('Under Construction');
  });

  test('Check that all three sections have headings', async () => {
    const screen = await render(<Wiki />);

    for (const name of [
      'System architecture',
      'Pseudocode syntax',
      'AI Tutor',
    ]) {
      await expect.element(
        screen.getByRole('heading', { level: 2, name, exact: true }),
      ).toBeInTheDocument();
    }
  });

  test('Check that every in-page link has a target', async () => {
    const screen = await render(<Wiki />);
    const links = [
      ...screen.baseElement.querySelectorAll('#wiki-content a[href^="#"]'),
    ];

    await expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      const id = link.getAttribute('href')!.slice(1);
      await expect(document.getElementById(id)).toBeInTheDocument();
    }
  });

  test('Check that a nav link scrolls to its section', async () => {
    await page.viewport(1024, 768);
    const screen = await renderWiki();
    const scroller = content(screen.baseElement);

    await expect(scroller.scrollTop).toBe(0);

    await screen.getByRole('navigation', { name: 'Wiki sections' })
      .getByRole('link', { name: 'AI Tutor' })
      .click();

    await vi.waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));

    const scrollerTop = scroller.getBoundingClientRect().top;
    const sectionTop = document.getElementById('ai-tutor')!
      .getBoundingClientRect().top;

    await expect(sectionTop).toBeGreaterThanOrEqual(scrollerTop);
    await expect(sectionTop).toBeLessThan(scrollerTop + scroller.clientHeight);
  });

  test('Check that Back returns to the previous section', async () => {
    await page.viewport(1024, 768);

    // root.tsx's ScrollRestoration makes this manual in production
    history.scrollRestoration = 'manual';

    const screen = await renderWiki();
    const scroller = content(screen.baseElement);
    const nav = screen.getByRole('navigation', { name: 'Wiki sections' });

    await nav.getByRole('link', { name: 'Pseudocode' }).click();
    await vi.waitFor(() => expect(location.hash).toBe('#pseudocode'));
    await nav.getByRole('link', { name: 'AI Tutor' }).click();
    await vi.waitFor(() => expect(location.hash).toBe('#ai-tutor'));

    history.back();

    await vi.waitFor(() => {
      expect(location.hash).toBe('#pseudocode');

      const top = document.getElementById('pseudocode')!
        .getBoundingClientRect().top;
      const scrollerTop = scroller.getBoundingClientRect().top;

      expect(top).toBeGreaterThanOrEqual(scrollerTop);
      expect(top).toBeLessThan(scrollerTop + scroller.clientHeight);
    });
  });

  test('Check that internal links use the base path', async () => {
    const screen = await render(<Wiki />);
    const links = [
      ...screen.baseElement.querySelectorAll('#wiki-content a[href^="/"]'),
    ];

    await expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      await expect(
        link.getAttribute('href')!.startsWith(Globals.RouteBaseName),
      ).toBe(true);
    }
  });

  test('Check that the AI section states availability and data use', async () => {
    const screen = await render(<Wiki />);
    const section = document.getElementById('ai-tutor')!;

    await expect.element(screen.getByRole('note'))
      .toHaveTextContent('temporarily unavailable');
    await expect(section).toHaveTextContent('third-party host');
    await expect(section).toHaveTextContent('all of the code in your editor');
  });

  test('Check that the AI section does not imply teaching or chat', async () => {
    await render(<Wiki />);

    await expect(document.getElementById('ai-tutor'))
      .toHaveTextContent('does not explain its answer');
  });

  test('Check that no LLM provider or GPU server is named', async () => {
    await render(<Wiki />);

    const text = document.getElementById('wiki-content')!.textContent;

    await expect(text).not.toMatch(
      /gpu|vllm|qwen|anthropic|claude|deepseek|gemini|glm/i,
    );
  });

  test.each([
    ['light', false],
    ['dark', true],
  ])('Check layout at phone width in the %s theme', async (_name, isDark) => {
    await page.viewport(390, 844);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    const screen = await renderWiki();
    const scroller = content(screen.baseElement);

    await vi.waitFor(
      () => expect(document.body.classList.contains('dark')).toBe(isDark),
    );
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    const overflowing = [
      ...scroller.querySelectorAll<HTMLElement>('h2, h3, p, ol, svg, nav'),
    ].filter(
      element => element.getBoundingClientRect().right >
        scroller.getBoundingClientRect().right + 1,
    );

    await expect(overflowing.map(element => element.tagName)).toEqual([]);
  });
});
