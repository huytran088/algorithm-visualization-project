import { render } from 'vitest-browser-react';
import { afterEach, expect, test, describe, vi } from 'vitest';

import AIPane from '../../../app/components/panes/AIPane';

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
    const { message } = JSON.parse(calls[0][1].body as string);

    await expect(message).toContain('"do:"');
    await expect(message).toContain('"while (condition)"');
    await expect(message).not.toContain('not currently implemented');
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
