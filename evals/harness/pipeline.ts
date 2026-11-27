import autoFixDirectives from '../../app/hooks/interpreter/autofix';
import validateSource from '../../app/hooks/interpreter/validate';
import {
  buildRepairRequest,
  buildTutorRequest,
  stripFences,
  type TutorRequest,
} from '../../app/hooks/useAITutor';
import Globals from '../../app/globals';

/** The switches an eval run varies. Baseline = what the app does. */
export type PipelineConfig = {
  name: string
  autofix: boolean
  repairs: number
  instructions: boolean
  rag: boolean
  k: number
  /** Constrain decoding to evals/avp.gbnf (eval server with LLM_PROVIDER=vllm) */
  grammar: boolean
};

export const Configs: Record<string, PipelineConfig> = {
  baseline: { name: 'baseline', autofix: true, repairs: Globals.AIRepairAttempts, instructions: true, rag: true, k: 2, grammar: false },
  no_rag: { name: 'no_rag', autofix: true, repairs: Globals.AIRepairAttempts, instructions: true, rag: false, k: 2, grammar: false },
  no_instructions: { name: 'no_instructions', autofix: true, repairs: Globals.AIRepairAttempts, instructions: false, rag: true, k: 2, grammar: false },
  no_autofix: { name: 'no_autofix', autofix: false, repairs: Globals.AIRepairAttempts, instructions: true, rag: true, k: 2, grammar: false },
  no_repair: { name: 'no_repair', autofix: true, repairs: 0, instructions: true, rag: true, k: 2, grammar: false },
  // The constrained-decoding A/B, against a local vLLM server
  local: { name: 'local', autofix: true, repairs: Globals.AIRepairAttempts, instructions: true, rag: true, k: 2, grammar: false },
  local_grammar: { name: 'local_grammar', autofix: true, repairs: Globals.AIRepairAttempts, instructions: true, rag: true, k: 2, grammar: true },
  local_grammar_only: { name: 'local_grammar_only', autofix: false, repairs: 0, instructions: true, rag: true, k: 2, grammar: true },
};

/** What the eval server returns for one call. */
export type CallRecord = {
  generated_code: string
  retrieved_functions: string[]
  prompt_sha256: string
  latency_ms: number
  provider: string
  model: string
  temperature: number
};

export type Generate = (
  req: TutorRequest & { rag: boolean, k: number, grammar: boolean },
) => Promise<CallRecord>;

/** Calls the eval server (avp_rag_system: uvicorn evals.server:app). */
export function serverGenerate(baseUrl: string): Generate {
  return async (req) => {
    const res = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`eval server ${res.status}: ${await res.text()}`);
    return await res.json() as CallRecord;
  };
}

export type PipelineResult = {
  /** Model output exactly as returned */
  raw: string
  /** After stripFences, and autoFixDirectives when enabled */
  first: string
  firstProblems: string[]
  repairRaw: string | null
  repaired: string | null
  repairedProblems: string[] | null
  /** The code the app would put in the editor */
  final: string
  finalProblems: string[]
  repairAttempted: boolean
  repairAccepted: boolean
  calls: CallRecord[]
  error: string | null
};

/**
 * The AI Tutor flow of generateTutorCode (app/hooks/useAITutor.ts), from a
 * new page, with switches for the ablations and every intermediate output
 * kept. With the baseline config it makes the same requests and keeps the
 * same code; tests/evals/pipeline.node.test.ts checks that.
 */
export async function runPipeline(
  request: string,
  config: PipelineConfig,
  generate: Generate,
): Promise<PipelineResult> {
  const req = buildTutorRequest({ request, source: '', title: '<unnamed>' });
  if (!config.instructions) delete req.instructions;
  const clean = (text: string) => {
    const code = stripFences(text);
    return config.autofix ? autoFixDirectives(code) : code;
  };

  const calls: CallRecord[] = [];
  const first = await generate({ ...req, rag: config.rag, k: config.k, grammar: config.grammar });
  calls.push(first);
  const result: PipelineResult = {
    raw: first.generated_code,
    first: clean(first.generated_code),
    firstProblems: [],
    repairRaw: null,
    repaired: null,
    repairedProblems: null,
    final: '',
    finalProblems: [],
    repairAttempted: false,
    repairAccepted: false,
    calls,
    error: null,
  };
  result.firstProblems = validateSource(result.first);
  let code = result.first;
  let problems = result.firstProblems;

  for (let i = 0; i < config.repairs && problems.length > 0; i++) {
    result.repairAttempted = true;
    let fixed: string;
    try {
      const call = await generate({ ...buildRepairRequest(req, code, problems), rag: config.rag, k: config.k, grammar: config.grammar });
      calls.push(call);
      result.repairRaw = call.generated_code;
      fixed = clean(call.generated_code);
    } catch (err) {
      // The app keeps the first attempt when the repair request fails
      result.error = `repair: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }
    const fixedProblems = validateSource(fixed);
    result.repaired = fixed;
    result.repairedProblems = fixedProblems;
    if (fixedProblems.length <= problems.length) {
      code = fixed;
      problems = fixedProblems;
      result.repairAccepted = true;
    }
  }

  result.final = code;
  result.finalProblems = problems;
  return result;
}
