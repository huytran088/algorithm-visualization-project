import {
  useState,
} from 'react';

import {
  Button,
  Textarea,
} from '@material-tailwind/react';

import useAITutor from '../../hooks/useAITutor';

import Globals from '../../globals';

/**
 * Renders the AI pane for the visualizer.
 *
 * @param {Object} props
 *        React props
 * @param {string} props.source
 *        The code currently in the editor
 * @param {boolean} props.editing
 *        Whether the code pane is in editing mode
 * @param {function} props.setSrc
 *        A function to update the source code
 * @param {function} props.setEditing
 *        A function to update the editing state
 */
export default function AIPane(
  {
    source,
    editing,
    setSrc,
    setEditing,
  }:
  {
    source: string
    editing: boolean
    setSrc: (src: string) => void
    setEditing: (editing: boolean) => void
  },
) {
  const [request, setRequest] = useState('');
  const [status, error, generate] = useAITutor({ setSrc, setEditing });

  let label: string = Globals.AIButtonStrings.Run;
  if (status === 'running') {
    label = Globals.AIButtonStrings.Wait.Running;
  } else if (status === 'repairing') {
    label = Globals.AIButtonStrings.Wait.Repairing;
  } else if (status === 'error') {
    label = error;
  } else if (editing) {
    label = Globals.AIButtonStrings.Wait.Editing;
  }

  return (
    <>
      <Textarea
        className="rounded-none border-none shadow-none text-md text-primary/75! focus:text-primary! h-[calc(100%-6.125rem)]"
        id="aiInput"
        placeholder="Enter your prompt..."
        maxLength={Globals.AIRequestMaxLength}
        value={request}
        onChange={e => setRequest(e.target.value)}
      >
      </Textarea>
      <Button
        className="w-full text-md h-13.5 rounded-none shadow-none! border-0 border-t border-[#d8d8dc] dark:border-[#38383c] hover:bg-primary/5! hover:text-primary! disabled:hover:bg-transparent!"
        id="aiButton"
        variant="outline"
        disabled={editing || status !== 'idle'}
        onClick={
          () => generate({
            request,
            source,
            // textContent, not innerHTML, so "<unnamed>" is not escaped
            title: document.getElementById('title')?.textContent ?? '',
          })
        }
      >
        {label}
      </Button>
    </>
  );
}
