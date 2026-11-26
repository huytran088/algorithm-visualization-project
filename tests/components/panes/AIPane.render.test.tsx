import { render } from 'vitest-browser-react';
import { afterEach, expect, test, describe, vi } from 'vitest';

import AIPane from '../../../app/components/panes/AIPane';
import Globals from '../../../app/globals';

/**
 * Renders the pane with the page elements it reads when generating.
 */
async function renderPane(
  setSrc: (src: string) => void,
  setEditing: (editing: boolean) => void,
) {
  return render(
    <>
      <div id="title">Linear Search</div>
      <div id="sourceCode">x = 1</div>
      <AIPane
        setSrc={setSrc}
        setEditing={setEditing}
      />
    </>,
  );
}

describe('Test component: <AIPane />', async () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Check that the prompt describes do-while syntax', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      generated_code: 'x = 2',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const screen = await renderPane(() => {}, () => {});
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const { query } = JSON.parse(calls[0][1].body as string);

    await expect(query).toContain('"do:"');
    await expect(query).toContain('"while (condition)"');
    await expect(query).not.toContain('not currently implemented');
  });

  test('Check that the request matches the RAG API schema', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      generated_code: 'x = 2',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const screen = await renderPane(() => {}, () => {});
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls[0];
    const body = JSON.parse(init.body as string);

    // POST /api/generate only accepts { query } and rejects { message } (422)
    await expect(url).toBe(Globals.AIApiURL);
    await expect(init.method).toBe('POST');
    await expect(Object.keys(body)).toEqual(['query']);
    await expect(body.query).toContain('Linear Search');
  });

  test('Check that an API error shows the error state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(
      { detail: 'hf provider is not configured' },
      { status: 503 },
    )));

    const setSrc = vi.fn();

    const screen = await renderPane(setSrc, () => {});
    await screen.getByRole('button', { name: 'Generate' }).click();

    await expect.element(screen.getByRole('button'))
      .toHaveTextContent(Globals.AIButtonStrings.Error);
    await expect(setSrc).not.toHaveBeenCalled();
  });

  test('Check that returned code opens in edit mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      generated_code: '```avp\nx = 2\n```',
    })));

    const setSrc = vi.fn();
    const setEditing = vi.fn();

    const screen = await renderPane(setSrc, setEditing);
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(setEditing).toHaveBeenCalledWith(true));
    await expect(setSrc).toHaveBeenCalledWith('x = 2\n');
  });
});
