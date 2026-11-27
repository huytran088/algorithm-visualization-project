import {
  useMemo,
} from 'react';

import Monaco from '../Monaco';

import { IconButton } from '@material-tailwind/react';

import {
  Check,
  EditPencil,
  Xmark,
} from 'iconoir-react';

import usePortrait from '../../hooks/usePortrait';
import useSourceProblems, {
  problemMarkers,
} from '../../hooks/useSourceProblems';

/**
 * Renders the code pane for the visualizer.
 *
 * @param {Object} props
 *        React props
 * @param {string | null} props.src
 *        The source code to display
 * @param {function} props.setSrc
 *        A function to update the source code
 * @param {number | [number, number] | null} props.highlight
 *        The line range to highlight
 * @param {boolean} props.editing
 *        Whether the code pane is in editing mode
 * @param {function} props.setEditing
 *        A function to update the editing state
 * @param {function} props.save
 *        A function to save the changes
 * @param {function} props.discard
 *        A function to discard the changes
 */
export default function CodePane(
  {
    src,
    setSrc,
    highlight,
    editing,
    setEditing,
    save,
    discard,
  }:
  {
    src: string
    setSrc: (src: string) => void
    highlight: number | [number, number] | null
    editing: boolean
    setEditing: (editing: boolean) => void
    save: () => void
    discard: () => void
  },
) {
  const [portrait] = usePortrait();

  // Checked live (also while editing, before Save) with the real grammar and
  // interpreter. Errors are listed below the code; hints are only underlined.
  const problems = useSourceProblems(src);
  const markers = useMemo(() => problemMarkers(problems), [problems]);
  const errors = problems.filter(p => p.kind !== 'hint');

  return (
    <>
      {
        portrait ?
          (
            editing ?
              (
                <>
                  <IconButton
                    variant="solid"
                    aria-label="Save changes to Code Pane"
                    title="Save changes to Code Pane"
                    size="lg"
                    onClick={save}
                    className="cursor-pointer rounded-xl bg-[green] dark:bg-[limegreen] border-none drop-shadow-lg fixed! bottom-20 right-18 z-50"
                  >
                    <Check className="stroke-2 w-5 h-5" role="presentation" />
                  </IconButton>
                  <IconButton
                    variant="solid"
                    aria-label="Discard changes to Code Pane"
                    title="Discard changes to Code Pane"
                    size="lg"
                    onClick={discard}
                    className="cursor-pointer rounded-xl bg-[crimson] border-none drop-shadow-lg fixed! bottom-20 right-4 z-50"
                  >
                    <Xmark className="stroke-2 w-5 h-5" role="presentation" />
                  </IconButton>
                </>
              ) :
              (
                <IconButton
                  variant="solid"
                  aria-label="Edit Code Pane"
                  title="Edit Code Pane"
                  size="lg"
                  onClick={() => setEditing(true)}
                  className="cursor-pointer rounded-xl bg-[dodgerblue] border-none drop-shadow-lg fixed! bottom-20 right-4 z-50"
                >
                  <EditPencil className="stroke-2 w-5 h-5" role="presentation" />
                </IconButton>
              )
          ) :
          (<></>)
      }
      <div
        className="relative w-full h-full"
        onDoubleClick={() => {
          if (!editing) setEditing(true);
        }}
      >
        <Monaco
          name="code"
          src={src}
          setSrc={setSrc}
          highlights={editing ? [] : [highlight]}
          greyouts={[]}
          editing={editing}
          bindSrc={false}
          markers={markers}
        />
        {
          errors.length > 0 ?
            (
              <div
                id="codeProblems"
                role="alert"
                className="absolute bottom-0 left-0 right-0 z-10 px-3 py-1.5 text-sm truncate border-t border-[crimson]/40 bg-[crimson]/10 text-[crimson] dark:text-[#ff6b81]"
                title={errors.map(problemText).join('\n')}
              >
                {problemText(errors[0])}
                {errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}
              </div>
            ) :
            (<></>)
        }
      </div>
      <pre id="sourceCode" className="hidden">{src}</pre>
    </>
  );
}

/**
 * One-line text for a problem: "Line 4: message", or the message alone.
 */
function problemText(problem: { line: number | undefined, message: string }) {
  return problem.line === undefined ?
    problem.message :
    `Line ${problem.line}: ${problem.message}`;
}
