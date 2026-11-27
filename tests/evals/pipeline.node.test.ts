import { afterEach, describe, expect, it, vi } from 'vitest';

import { Configs, runPipeline, type CallRecord } from '../../evals/harness/pipeline';
import { generateTutorCode, buildTutorRequest } from '../../app/hooks/useAITutor';

const Broken = 'fun F(a):\n    return a\nresult = F(1)';
const Fixed = '```\nfun F(@init<table> a):\n    return a\nend fun\n\nx = arr[1, 2]\nresult = F(x)\n```';

function record(code: string): CallRecord {
  return {
    generated_code: code,
    retrieved_functions: [],
    prompt_sha256: '',
    latency_ms: 1,
    provider: 'test',
    model: 'test',
    temperature: 0,
  };
}

/** A model that answers with `answers` in order and records the requests. */
function scripted(answers: string[]) {
  const requests: any[] = [];
  return {
    requests,
    generate: async (req: any) => {
      requests.push(req);
      return record(answers[requests.length - 1]);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runPipeline', () => {
  it.each([
    ['valid first try', [Fixed]],
    ['repaired', [Broken, Fixed]],
    ['repair rejected', [Fixed.replace('end fun', ''), Broken]],
  ])('matches generateTutorCode with the baseline config (%s)', async (_name, answers) => {
    // The app, against a stubbed backend
    const appRequests: any[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: any) => {
      appRequests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ generated_code: answers[appRequests.length - 1] }));
    });
    const request = 'Write a sort.';
    const app = await generateTutorCode(buildTutorRequest({ request, source: '', title: '<unnamed>' }));

    const model = scripted(answers);
    const ours = await runPipeline(request, Configs.baseline, model.generate);

    expect(ours.final).toBe(app.code);
    expect(ours.finalProblems).toEqual(app.problems);
    // Same requests, plus the eval-only switches
    expect(model.requests.map(({ rag: _, k: __, ...r }) => r)).toEqual(appRequests);
  });

  it('keeps every intermediate output', async () => {
    const model = scripted([Broken, Fixed]);
    const r = await runPipeline('q', Configs.baseline, model.generate);
    expect(r.raw).toBe(Broken);
    expect(r.firstProblems.length).toBeGreaterThan(0);
    expect(r.repairRaw).toBe(Fixed);
    expect(r.repairAccepted).toBe(true);
    expect(r.final).not.toContain('```');
    expect(r.calls).toHaveLength(2);
  });

  it('applies the ablation switches', async () => {
    const model = scripted([Broken, Fixed]);
    const r = await runPipeline('q', Configs.no_repair, model.generate);
    expect(r.repairAttempted).toBe(false);
    expect(model.requests).toHaveLength(1);

    const bare = scripted([Fixed]);
    await runPipeline('q', Configs.no_instructions, bare.generate);
    expect(bare.requests[0].instructions).toBeUndefined();

    const noRag = scripted([Fixed]);
    await runPipeline('q', Configs.no_rag, noRag.generate);
    expect(noRag.requests[0].rag).toBe(false);
  });

  it('keeps the first attempt when the repair call fails', async () => {
    let n = 0;
    const r = await runPipeline('q', Configs.baseline, async () => {
      if (n++ === 0) return record(Broken);
      throw new Error('down');
    });
    expect(r.final).toBe(Broken);
    expect(r.error).toMatch(/down/);
  });
});
