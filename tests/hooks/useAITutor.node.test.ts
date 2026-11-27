import { afterEach, expect, test, describe, vi } from 'vitest';

import {
  buildRepairRequest,
  buildTutorRequest,
  generateTutorCode,
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

  test('Check that the rules forbid the syntax the model invents', () => {
    const req = buildTutorRequest({
      request: 'QuickSort',
      source: '',
      title: '<unnamed>',
    });

    // Each of these produced a syntax error in real generations
    expect(req.instructions).toContain('a[i:j]');
    expect(req.instructions).toContain('@call');
    expect(req.instructions).toContain('k = i + 1');
    expect(req.instructions).toContain('result = ');
    expect(req.instructions).toContain('define every function');
    expect(req.instructions!.length).toBeLessThanOrEqual(8000);
  });

  test('Check that a repair request carries the problems and code', () => {
    const req = buildRepairRequest(
      { query: 'QuickSort', instructions: 'rules' },
      'bad code',
      ['Line 4:41: extraneous input \'@\''],
    );

    expect(req.code).toBe('bad code');
    expect(req.instructions).toBe('rules');
    expect(req.query).toContain('QuickSort');
    expect(req.query).toContain('Line 4:41: extraneous input \'@\'');
  });

  test('Check that a repair request fits the request limit', () => {
    const problems = Array.from({ length: 50 }, (_, i) => `Line ${i}: ${'x'.repeat(300)}`);
    const req = buildRepairRequest({ query: 'q'.repeat(1500) }, 'code', problems);

    expect(req.query.length).toBeLessThanOrEqual(Globals.AIRequestMaxLength);
  });
});

const Valid = `a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    return array
end fun

result = Run(a1)
`;
// Not mechanically fixable: an invented directive inside an expression
const Invalid = 'pi = @call<Part, a1>\n';

/**
 * Stubs fetch to answer each call with the next generated code (or status).
 */
function stubReplies(...replies: (string | number)[]) {
  const fetchMock = vi.fn(async () => {
    const reply = replies.shift();
    return typeof reply === 'number' ?
      Response.json({ detail: 'x' }, { status: reply }) :
      Response.json({ generated_code: reply });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof stubReplies>, call: number) {
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return JSON.parse(calls[call][1].body as string);
}

describe('Test hook helpers: generateTutorCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Check that valid code is returned without a repair', async () => {
    const fetchMock = stubReplies(Valid);
    const onRepair = vi.fn();

    const res = await generateTutorCode({ query: 'q' }, onRepair);

    expect(res).toEqual({ code: Valid, problems: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(onRepair).not.toHaveBeenCalled();
  });

  test('Check that mechanical directive mistakes are fixed without a repair', async () => {
    const standalone = `a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    i = 0
    @mark<i, outline, yellow>
    swap(array[0], array[1])
    return array
end fun

result = Run(a1)
`;
    const fetchMock = stubReplies(standalone);

    const res = await generateTutorCode({ query: 'q' });

    expect(res.problems).toEqual([]);
    expect(res.code).toContain('    @mark<i, outline, yellow> swap(array[0], array[1])');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('Check that invalid code is sent back once for repair', async () => {
    const fetchMock = stubReplies(Invalid, Valid);
    const onRepair = vi.fn();

    const res = await generateTutorCode({ query: 'q', instructions: 'r' }, onRepair);

    expect(res).toEqual({ code: Valid, problems: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRepair).toHaveBeenCalledOnce();
    const repair = bodyOf(fetchMock, 1);
    expect(repair.code).toBe(Invalid);
    expect(repair.instructions).toBe('r');
    expect(repair.query).toMatch(/Line 1:/);
  });

  test('Check that problems are reported when the repair fails too', async () => {
    const fetchMock = stubReplies(Invalid, Invalid);

    const res = await generateTutorCode({ query: 'q' });

    expect(res.code).toBe(Invalid);
    expect(res.problems.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('Check that a failed repair request keeps the first code', async () => {
    stubReplies(Invalid, 429);

    const res = await generateTutorCode({ query: 'q' });

    expect(res.code).toBe(Invalid);
    expect(res.problems.length).toBeGreaterThan(0);
  });

  test('Check that a failed first request still throws', async () => {
    stubReplies(503);

    await expect(generateTutorCode({ query: 'q' }))
      .rejects.toThrow(new TutorError(Globals.AIErrorStrings.Unavailable));
  });
});
