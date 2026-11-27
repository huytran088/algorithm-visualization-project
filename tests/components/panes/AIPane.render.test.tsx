import { render } from 'vitest-browser-react';
import { afterEach, expect, test, describe, vi } from 'vitest';

import AIPane from '../../../app/components/panes/AIPane';
import Globals from '../../../app/globals';

const Source = 'x = 1';

/**
 * Renders the pane with the page title it reads when generating.
 */
async function renderPane(
  {
    setSrc = () => {},
    setEditing = () => {},
    editing = false,
    title = 'Linear Search',
  }: {
    setSrc?: (src: string) => void
    setEditing?: (editing: boolean) => void
    editing?: boolean
    title?: string
  } = {},
) {
  const ui = (isEditing: boolean) => (
    <>
      <div id="title">{title}</div>
      <AIPane
        source={Source}
        editing={isEditing}
        setSrc={setSrc}
        setEditing={setEditing}
      />
    </>
  );

  const screen = await render(ui(editing));
  return {
    screen,
    setEditingProp: (isEditing: boolean) => screen.rerender(ui(isEditing)),
  };
}

function stubFetch(response: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof stubFetch>) {
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return JSON.parse(calls[0][1].body as string);
}

describe('Test component: <AIPane />', async () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Check that the request matches the RAG API schema', async () => {
    const fetchMock = stubFetch(() => Response.json({ generated_code: 'x = 1' }));

    const { screen } = await renderPane();
    await screen.getByRole('textbox').fill('Sort it descending');
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    await expect(calls[0][0]).toBe(Globals.AIApiURL);
    await expect(calls[0][1].method).toBe('POST');

    const body = requestBody(fetchMock);
    await expect(Object.keys(body).sort())
      .toEqual(['code', 'instructions', 'query']);
    await expect(body.query).toBe('Sort it descending');
    await expect(body.code).toBe(Source);
    await expect(body.instructions).toContain('"do:"');
    await expect(body.instructions).toContain('"while (condition)"');
  });

  test('Check that an empty request uses the page title', async () => {
    const fetchMock = stubFetch(() => Response.json({ generated_code: 'x = 1' }));

    const { screen } = await renderPane();
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await expect(requestBody(fetchMock).query).toContain('Linear Search');
  });

  test('Check that an unnamed page with no request is not sent', async () => {
    const fetchMock = stubFetch(() => Response.json({ generated_code: 'x = 1' }));

    const { screen } = await renderPane({ title: '<unnamed>' });
    await screen.getByRole('button', { name: 'Generate' }).click();

    await expect.element(screen.getByRole('button'))
      .toHaveTextContent(Globals.AIErrorStrings.NoRequest);
    await expect(fetchMock).not.toHaveBeenCalled();
  });

  test('Check that returned code opens in edit mode', async () => {
    stubFetch(() => Response.json({ generated_code: '```avp\nx = 2\n```' }));

    const setSrc = vi.fn();
    const setEditing = vi.fn();

    const { screen } = await renderPane({ setSrc, setEditing });
    await screen.getByRole('button', { name: 'Generate' }).click();

    await vi.waitFor(() => expect(setEditing).toHaveBeenCalledWith(true));
    await expect(setSrc).toHaveBeenCalledWith('x = 2\n');
  });

  test('Check that invalid code is repaired before it is loaded', async () => {
    const replies = [
      'pi = @call<Part, a1>\n',
      'x = 2\n',
    ];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fetchMock = stubFetch(async () => {
      const reply = replies.shift()!;
      if (replies.length === 0) await gate;
      return Response.json({ generated_code: reply });
    });

    const setSrc = vi.fn();

    const { screen } = await renderPane({ setSrc });
    await screen.getByRole('button', { name: 'Generate' }).click();

    await expect.element(screen.getByRole('button'))
      .toHaveTextContent(Globals.AIButtonStrings.Wait.Repairing);
    release();

    await vi.waitFor(() => expect(setSrc).toHaveBeenCalledWith('x = 2\n'));
    await expect(setSrc).toHaveBeenCalledOnce();
    await expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('Check that code still invalid after repair is loaded with a warning', async () => {
    stubFetch(() => Response.json({
      generated_code: 'pi = @call<Part, a1>\n',
    }));

    const setSrc = vi.fn();
    const setEditing = vi.fn();

    const { screen } = await renderPane({ setSrc, setEditing });
    await screen.getByRole('button', { name: 'Generate' }).click();

    await expect.element(screen.getByRole('button'))
      .toHaveTextContent(Globals.AIErrorStrings.Invalid);
    await expect(setSrc).toHaveBeenCalledWith('pi = @call<Part, a1>\n');
    await expect(setEditing).toHaveBeenCalledWith(true);
  });

  test('Check that the button waits while generating', async () => {
    let resolve: (res: Response) => void = () => {};
    stubFetch(() => new Promise<Response>((r) => {
      resolve = r;
    }));

    const { screen } = await renderPane();
    await screen.getByRole('button', { name: 'Generate' }).click();

    const button = screen.getByRole('button');
    await expect.element(button)
      .toHaveTextContent(Globals.AIButtonStrings.Wait.Running);
    await expect.element(button).toBeDisabled();

    resolve(Response.json({ generated_code: 'x = 1' }));
  });

  test('Check that the button is locked while editing', async () => {
    const { screen, setEditingProp } = await renderPane({ editing: true });

    const button = screen.getByRole('button');
    await expect.element(button)
      .toHaveTextContent(Globals.AIButtonStrings.Wait.Editing);
    await expect.element(button).toBeDisabled();

    await setEditingProp(false);
    await expect.element(button)
      .toHaveTextContent(Globals.AIButtonStrings.Run);
    await expect.element(button).toBeEnabled();
  });

  test.each([
    [429, 'RateLimited'],
    [503, 'Unavailable'],
    [422, 'TooLong'],
  ] as const)('Check that HTTP %i shows the %s message', async (status, key) => {
    stubFetch(() => Response.json({ detail: 'x' }, { status }));

    const setSrc = vi.fn();

    const { screen } = await renderPane({ setSrc });
    await screen.getByRole('button', { name: 'Generate' }).click();

    await expect.element(screen.getByRole('button'))
      .toHaveTextContent(Globals.AIErrorStrings[key]);
    await expect(setSrc).not.toHaveBeenCalled();
  });

  test('Check that the button recovers after an error', async () => {
    stubFetch(() => Response.json({ detail: 'x' }, { status: 503 }));

    const { screen } = await renderPane();
    await screen.getByRole('button', { name: 'Generate' }).click();

    const button = screen.getByRole('button');
    await expect.element(button)
      .toHaveTextContent(Globals.AIErrorStrings.Unavailable);

    await expect.element(button, { timeout: Globals.AIErrorDisplayMs + 2000 })
      .toHaveTextContent(Globals.AIButtonStrings.Run);
    await expect.element(button).toBeEnabled();
  });
});
