import {
  useEffect,
  useRef,
  useState,
} from 'react';

import autoFixDirectives from './interpreter/autofix';
import validateSource from './interpreter/validate';

import Globals from '../globals';

/**
 * Language rules sent with every AI Tutor request. The backend adds them to
 * the prompt but does not use them to search its knowledge base.
 */
export const TutorInstructions = `
Write a complete program for the AVP visualizer, laid out exactly like this:

// Bubble Sort

a1 = arr[5, 1, 4, 2, 8]

fun Bubble_Sort(@init<table> array):
    n = length(array)
    for (i = 0; i < n; i += 1):
        for (j = 0; j < n - i - 1; j += 1):
            @mark<j, outline, yellow> if (array[j] > array[j + 1]):
                @mark<j, highlight, green> swap(array[j], array[j + 1])
            end if
        end for
    end for
    return array
end fun

result = Bubble_Sort(a1)

Syntax rules. Anything else is a syntax error:
- Create arrays only on the right side of an assignment: a = arr[3, 1, 2], a = arr[1 to 10], a = arr(n, 0) or the empty a = arr[]. "arr" is a keyword and cannot be a variable name. Never write a bare [3, 1, 2] list, never pass or return an array literal (assign it first: pair = arr[i, j], then return pair), and never slice: a[i:j] does not exist.
- Blocks: "if (c):" / "else if (c):" / "else:" / "end if"; "while (c):" ... "end while"; "for (i = 0; i < n; i += 1):" ... "end for"; "for x in a:" ... "end for"; "fun Name(params):" ... "end fun". Do-while loops are written as "do:", then the body, then "while (condition)", with no "end" keyword.
- Operators: + - * / % ** == != < > <= >= and or. There is no "not", "++", "*=" or "/=": only =, += and -=. "/" is real division, so use floor(a / b) for an index.
- The only built-in functions are length(a), size(a), floor(x) and swap(a[i], a[j]). There is no print, len, min, max, append or range: write your own fun if you need one.
- Function names start with a capital letter. Every function returns a value (return the array from a sort). The program ends with one top-level call, like result = Bubble_Sort(a1).
- The reference code is only an example and is not part of the program: define every function your program calls with fun, even one shown in the reference.

Visualization rules:
- The visualizer draws one array as a table. Put @init<table> on the array parameter of the first function called. Work in place on that one array: pass the array plus low/high indices to helpers and recursive calls. Do not copy into new arrays, because other arrays are not drawn.
- Exchange cells with swap(array[i], array[j]) so the swap is animated.
- Directives are written as @name<args> at the start of a statement line, before the statement, as in the example. Several can be chained on one line, but a directive can never be on a line by itself or inside an expression.
- Each directive argument is a single variable name, number or "string", never an expression: write k = i + 1 on its own line, then @mark<k, highlight, green> before the next statement.
- The only directives are @init<table>, @mark<index, kind, color> (kind: outline, highlight or text; color: yellow, green or red), @log<info|warn|error, "text">, @insert<index, value>, @delete<index>, @update<index, value>, @swap<i, j> and @sort<name>. Never invent others: there is no @call.
- Prefer outlines for cursor/iterator marks and highlights for found/missing/swap/warning marks. Outlines can be used often, highlights sparingly. Use the text mark only on if/while statements.

Style:
- Succinctly comment any potentially confusing sections. Do not comment obvious sections.
- Avoid the words "demo", "sample", "test", etc. in function names.
- If the user requests a change or a fix, edit the current code and comment any changes you make. If they want something unrelated, ignore the current code and write new code.
`.trim();

/** The body of POST /api/generate. */
export type TutorRequest = {
  query: string
  code?: string
  instructions?: string
};

/** An error whose message is ready to show to the user. */
export class TutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TutorError';
  }
}

/**
 * Builds the API request from what the user typed, the editor code, and the
 * page title (used when the request is empty).
 *
 * @throws {TutorError} When there is no request and the page is unnamed.
 */
export function buildTutorRequest({
  request,
  source,
  title,
}: {
  request: string
  source: string
  title: string
}): TutorRequest {
  let query = request.trim();
  const name = title.trim();

  if (!query) {
    if (!name || name === '<unnamed>') {
      throw new TutorError(Globals.AIErrorStrings.NoRequest);
    }
    query = `Write the "${name}" algorithm.`;
  }

  const req: TutorRequest = {
    query,
    instructions: TutorInstructions,
  };
  if (source.trim()) {
    req.code = source;
  }
  return req;
}

/**
 * Removes Markdown code fences from model output.
 */
export function stripFences(text: string) {
  return text.replaceAll(/```.*\n?/g, '');
}

/**
 * Maps an HTTP status from the backend to a user-facing message.
 */
function statusMessage(status: number) {
  switch (status) {
    case 429: return Globals.AIErrorStrings.RateLimited;
    case 503: return Globals.AIErrorStrings.Unavailable;
    case 413:
    case 422: return Globals.AIErrorStrings.TooLong;
    default: return Globals.AIErrorStrings.Failed;
  }
}

/**
 * Sends a request to the AI Tutor backend and returns the generated code.
 *
 * @throws {TutorError} With a user-facing message on any failure.
 */
export async function requestTutorCode(req: TutorRequest) {
  let res: Response;
  try {
    res = await fetch(Globals.AIApiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });
  } catch {
    throw new TutorError(Globals.AIErrorStrings.Network);
  }

  if (!res.ok) {
    throw new TutorError(statusMessage(res.status));
  }

  let code: unknown;
  try {
    code = (await res.json()).generated_code;
  } catch {
    throw new TutorError(Globals.AIErrorStrings.Failed);
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw new TutorError(Globals.AIErrorStrings.Failed);
  }
  return stripFences(code);
}

/**
 * Builds a follow-up request asking the model to fix code that failed
 * validation. The query stays within the backend's length limit.
 */
export function buildRepairRequest(
  original: TutorRequest,
  code: string,
  problems: string[],
): TutorRequest {
  const head = 'Your code for this request fails in the AVP visualizer:\n' +
    `${original.query.slice(0, 600)}\n\nThe interpreter reported:\n`;
  const tail = '\nFix these problems and return the whole corrected program.';

  let list = '';
  for (const problem of problems.slice(0, 8)) {
    const line = `- ${problem.slice(0, 200)}\n`;
    if (head.length + list.length + line.length + tail.length >
      Globals.AIRequestMaxLength) break;
    list += line;
  }

  const req: TutorRequest = { query: head + list + tail, code };
  if (original.instructions) req.instructions = original.instructions;
  return req;
}

/**
 * Requests code, fixes mechanical directive mistakes (autoFixDirectives),
 * checks it with the visualizer's own parser and interpreter,
 * and asks the model to repair it (up to Globals.AIRepairAttempts times) when
 * it fails. Returns the best code and the problems still left in it.
 *
 * @throws {TutorError} When the first request fails.
 */
export async function generateTutorCode(
  req: TutorRequest,
  onRepair?: () => void,
) {
  let code = autoFixDirectives(await requestTutorCode(req));
  let problems = validateSource(code);

  for (let i = 0; i < Globals.AIRepairAttempts && problems.length > 0; i++) {
    onRepair?.();
    let fixed: string;
    try {
      fixed = autoFixDirectives(
        await requestTutorCode(buildRepairRequest(req, code, problems)),
      );
    } catch {
      // Keep the first attempt; the user can still edit it
      break;
    }
    const fixedProblems = validateSource(fixed);
    if (fixedProblems.length <= problems.length) {
      code = fixed;
      problems = fixedProblems;
    }
  }

  return { code, problems };
}

export type TutorStatus = 'idle' | 'running' | 'repairing' | 'error';

/**
 * Provides a hook that runs AI Tutor requests and tracks their status.
 * Generated code is checked and, if needed, repaired once, then loaded into
 * the editor in editing mode. On failure, or when the code still has errors,
 * the message is kept for Globals.AIErrorDisplayMs.
 *
 * @param {Object} props
 *        React props
 * @param {function} props.setSrc
 *        A function to update the editor source
 * @param {function} props.setEditing
 *        A function to update the editing state
 */
export default function useAITutor({
  setSrc,
  setEditing,
}:
{
  setSrc: (src: string) => void
  setEditing: (editing: boolean) => void
}) {
  const [status, setStatus] = useState<TutorStatus>('idle');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function fail(err: unknown) {
    setError(
      err instanceof TutorError ? err.message : Globals.AIErrorStrings.Failed,
    );
    setStatus('error');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus('idle');
      setError('');
    }, Globals.AIErrorDisplayMs);
  }

  async function generate(args: Parameters<typeof buildTutorRequest>[0]) {
    let req: TutorRequest;
    try {
      req = buildTutorRequest(args);
    } catch (err) {
      fail(err);
      return;
    }

    setStatus('running');
    try {
      const { code, problems } = await generateTutorCode(
        req,
        () => setStatus('repairing'),
      );
      setSrc(code);
      setEditing(true);
      if (problems.length > 0) {
        // Load it anyway so the user can fix it, but say it has errors
        fail(new TutorError(Globals.AIErrorStrings.Invalid));
      } else {
        setStatus('idle');
      }
    } catch (err) {
      fail(err);
    }
  }

  return [
    status,
    error,
    generate,
  ] as const;
}
