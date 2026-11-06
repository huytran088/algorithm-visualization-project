import {
  createRef,
} from 'react';

import {
  Button,
  Textarea,
} from '@material-tailwind/react';

import Globals from '../../globals';

/**
 * Renders the AI pane for the visualizer.
 *
 * @param {Object} props
 *        React props
 * @param {function} props.setSrc
 *        A function to update the source code
 * @param {boolean} props.setEditing
 *        A function to update the editing state
 */
export default function AIPane(
  {
    setSrc,
    setEditing,
  }:
  {
    setSrc: (src: string) => void
    setEditing: (editing: boolean) => void
  },
) {
  const buttonRef = createRef<HTMLButtonElement>();

  return (
    <>
      <Textarea
        className="rounded-none border-none shadow-none text-md text-primary/75! focus:text-primary! h-[calc(100%-6.125rem)]"
        id="aiInput"
        placeholder="Enter your prompt..."
      >
      </Textarea>
      <Button
        className="w-full text-md h-13.5 rounded-none shadow-none! border-0 border-t border-[#d8d8dc] dark:border-[#38383c] hover:bg-primary/5! hover:text-primary! disabled:hover:bg-transparent!"
        id="aiButton"
        ref={buttonRef}
        variant="outline"
        onClick={
          () => {
            const txt = document.createElement('textarea');
            txt.innerHTML = document.getElementById('sourceCode')!.innerHTML;
            const source = txt.value;
            txt.remove();

            const message = `
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

If the user requests a change or a fix, here is your starter code:

\`\`\`avp
${source}
\`\`\`

Comment any changes you make.
If they want something unrelated, ignore the above starter code and make new code.
If no prompt is given, use this title as your prompt: ${document.getElementById('title')!.innerHTML}
If the title is "<unnamed>", just output a short error message.

User request:
${(document.getElementById('aiInput') as HTMLTextAreaElement)!.value}
`
              .trim();

            buttonRef.current!.innerHTML = Globals.AIButtonStrings.Wait.Running;
            buttonRef.current!.disabled = true;

            fetch(Globals.AIApiURL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: message,
              }),
            })
              .then(res => res.json())
              .then((res) => {
                const code = res.generated_code
                  .replaceAll(/```.*\n?/g, '');

                setSrc(code);
                setEditing(true);
              })
              .catch(() => {
                buttonRef.current!.innerHTML = Globals.AIButtonStrings.Error;
                setTimeout(() => {
                  buttonRef.current!.innerHTML = Globals.AIButtonStrings.Run;
                  buttonRef.current!.disabled = false;
                }, 1000);
              });
          }
        }
      >
        {Globals.AIButtonStrings.Run}
      </Button>
    </>
  );
}
