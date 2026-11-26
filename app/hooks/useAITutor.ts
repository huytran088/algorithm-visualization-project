import {
  useEffect,
  useRef,
  useState,
} from 'react';

import Globals from '../globals';

/**
 * Language rules sent with every AI Tutor request. The backend adds them to
 * the prompt but does not use them to search its knowledge base.
 */
export const TutorInstructions = `
Arrays are initialized as var = arr[...], not var = [...].
"arr" is thus a keyword and cannot be a variable name.
Do-while loops are written as "do:", then the body, then "while (condition)", with no "end" keyword.

All function names must start with a capital letter.
Do not assume implicit functions are available unless found in example code.
Provide a sample call to the function at the end so it can be run without modification.
Succinctly comment any potentially confusing sections. Do not comment obvious sections.
Avoid using the words "demo", "sample", "test", etc. in function names.

Make sure to use @-directives appropriately. Do not use the text mark except for on if/while statements.
Prefer outlines for cursor-type/iterator marks and highlights for found/missing/swap/warning/etc type marks.
Outlines can be more frequently utilized, while highlights should be more sparing.
@-directives can be placed sequentially on one line but cannot be on a line by themselves.
E.g. "@<...> @<...> var = ..." is valid, but "@<...>" by itself is not.
@mark directives must be placed at the beginning of a line, not halfway through.

If the user requests a change or a fix, edit the current code and comment any changes you make.
If they want something unrelated, ignore the current code and make new code.
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

export type TutorStatus = 'idle' | 'running' | 'error';

/**
 * Provides a hook that runs AI Tutor requests and tracks their status.
 * On success the code is loaded into the editor in editing mode. On failure
 * the error message is kept for Globals.AIErrorDisplayMs.
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
      const code = await requestTutorCode(req);
      setSrc(code);
      setEditing(true);
      setStatus('idle');
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
