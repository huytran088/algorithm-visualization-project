import { render } from 'vitest-browser-react';
import { afterEach, expect, test, describe, vi } from 'vitest';

import { useState } from 'react';

import useAlgo from '../../app/hooks/useAlgo';

function Test() {
  const [title, setTitle] = useState('Test');
  const [loaderHidden, setLoaderHidden] = useState(true);

  const [
    src,
    setSrc,
    comp,
  ] = useAlgo({ setTitle, setLoaderHidden });

  return (
    <>
      <h1>{title}</h1>

      <p id="src">{src}</p>
      <p id="comp">{JSON.stringify(comp, null, 2)}</p>
      <p id="hidden">{loaderHidden ? 'true' : 'false'}</p>

      <button onClick={() => setSrc('new source')}>Set Src</button>
      <button onClick={() => setSrc('x = 1\n')}>Set Valid</button>
      <button onClick={() => setSrc('fun F(n):\n    return F(n + 1)\nend fun\nr = F(0)\n')}>Set Crash</button>
    </>
  );
};

describe('Test hook: useAlgo()', async () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Ensure title is set as expected', async () => {
    const screen = await render(<Test />);

    await expect(screen.baseElement.querySelector('h1')).toHaveTextContent('<unnamed>');
  });

  test('Ensure state is set as expected', async () => {
    const screen = await render(<Test />);

    await expect(screen.baseElement.querySelector('#src')).toHaveTextContent('');
    await expect(screen.baseElement.querySelector('#comp')).toHaveTextContent('[]');
    await expect(screen.baseElement.querySelector('#hidden')).toHaveTextContent('true');
  });

  test('Ensure state is updated as expected', async () => {
    const screen = await render(<Test />);

    await screen.getByText('Set Src').click();
    await expect(screen.baseElement.querySelector('#src')).toHaveTextContent('new source');
    await expect(screen.baseElement.querySelector('#comp')).toHaveTextContent('[]'); // TODO: Update comp
    await expect(screen.baseElement.querySelector('#hidden')).toHaveTextContent('true');
  });

  test('Ensure a runtime crash clears the previous trace', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const screen = await render(<Test />);
    const comp = () => screen.baseElement.querySelector('#comp')!.textContent;

    await screen.getByText('Set Valid').click();
    await expect.poll(comp).toContain('"line": 1');

    // Infinite recursion throws; the old trace must not stay on screen. The
    // code pane reports the error, so there is no alert.
    await screen.getByText('Set Crash').click();
    await expect.poll(() => JSON.parse(comp()!))
      .toEqual([{ line: -1, actions: [] }]);
    await expect(alertMock).not.toHaveBeenCalled();
  });
});
