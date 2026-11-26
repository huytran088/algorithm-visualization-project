import { afterEach, expect, test, describe, vi } from 'vitest';

import {
  buildTutorRequest,
  requestTutorCode,
  stripFences,
  TutorError,
} from '../../app/hooks/useAITutor';
import Globals from '../../app/globals';

const Source = 'a1 = arr[3, 1, 2]';

describe('Test hook helpers: useAITutor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Check that the request, code and rules are sent separately', () => {
    const req = buildTutorRequest({
      request: '  Sort it descending  ',
      source: Source,
      title: 'Bubble Sort',
    });

    expect(Object.keys(req).sort()).toEqual(['code', 'instructions', 'query']);
    expect(req.query).toBe('Sort it descending');
    expect(req.code).toBe(Source);
    expect(req.instructions).toContain('"do:"');
    expect(req.instructions).toContain('"while (condition)"');
    expect(req.query).not.toContain('"do:"');
    expect(req.instructions).not.toContain(Source);
  });

  test('Check that an empty request falls back to the page title', () => {
    const req = buildTutorRequest({
      request: '   ',
      source: Source,
      title: 'Linear Search',
    });

    expect(req.query).toContain('Linear Search');
  });

  test('Check that an empty request on an unnamed page is refused', () => {
    expect(() => buildTutorRequest({
      request: '',
      source: '',
      title: '<unnamed>',
    })).toThrow(new TutorError(Globals.AIErrorStrings.NoRequest));
  });

  test('Check that empty code is omitted', () => {
    const req = buildTutorRequest({
      request: 'Write binary search',
      source: '  \n',
      title: 'Binary Search',
    });

    expect(req.code).toBeUndefined();
  });

  test('Check that code fences are stripped', () => {
    expect(stripFences('```avp\nx = 2\n```')).toBe('x = 2\n');
    expect(stripFences('x = 2')).toBe('x = 2');
  });

  test('Check that a successful response returns the code', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      generated_code: '```avp\nx = 2\n```',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const req = { query: 'q', instructions: 'r' };
    await expect(requestTutorCode(req)).resolves.toBe('x = 2\n');

    const [url, init] = fetchMock.mock.calls[0] as unknown as
      [string, RequestInit];
    expect(url).toBe(Globals.AIApiURL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  test.each([
    [429, 'RateLimited'],
    [503, 'Unavailable'],
    [422, 'TooLong'],
    [500, 'Failed'],
  ] as const)('Check that HTTP %i maps to %s', async (status, key) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(
      { detail: 'x' },
      { status },
    )));

    await expect(requestTutorCode({ query: 'q' }))
      .rejects.toThrow(new TutorError(Globals.AIErrorStrings[key]));
  });

  test('Check that a network failure maps to Network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    await expect(requestTutorCode({ query: 'q' }))
      .rejects.toThrow(new TutorError(Globals.AIErrorStrings.Network));
  });

  test('Check that an empty result maps to Failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      generated_code: null,
    })));

    await expect(requestTutorCode({ query: 'q' }))
      .rejects.toThrow(new TutorError(Globals.AIErrorStrings.Failed));
  });
});
