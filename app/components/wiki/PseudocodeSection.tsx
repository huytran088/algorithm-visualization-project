import Globals from '../../globals';

import {
  WikiDirectives,
  WikiExamples,
} from './examples';

import {
  CodeBlock,
  DataTable,
  WikiCode,
  WikiSection,
  WikiSubheading,
  WikiText,
} from './WikiParts';

const SyntaxRows = [
  ['Comment', '// text  or  # text'],
  ['Assignment', 'x = 5,  x += 1,  x -= 1'],
  ['Array literal', 'a = arr[3, 1, 2]'],
  ['Range array', 'a = arr[1 to 10]'],
  ['Sized array', 'a = arr(5)  or  a = arr(5, 0)'],
  ['Index', 'a[i],  a[i] = v'],
  ['Arithmetic', '+  -  *  /  %  **'],
  ['Comparison', '==  !=  <  >  <=  >='],
  ['Logic', 'and,  or'],
  ['Literals', '123,  1.5,  "text",  True,  False,  Null'],
] as const;

const BuiltinRows = [
  ['length(a) or size(a)', 'Array length'],
  ['floor(x)', 'Round down'],
  ['swap(a[i], a[j])', 'Swap two array elements, with animation'],
] as const;

const ControlFlow = `if (x < y):
    ...
else if (x > y):
    ...
else:
    ...
end if

while (i < n):
    ...
end while

for (i = 0; i < n; i += 1):
    ...
end for

for item in a:
    ...
end for
`;

/**
 * Renders the wiki section that documents the pseudocode language.
 */
export default function PseudocodeSection() {
  return (
    <WikiSection
      id="pseudocode"
      title="Pseudocode syntax"
    >
      <WikiText>
        Algorithms are written in a small pseudocode language and saved as
        {' '}
        <WikiCode>.avp</WikiCode>
        {' '}
        files. The first line is a title comment, followed by a blank line. The
        app uses that line as the page title. Every program also needs a
        top-level call so that it actually runs.
      </WikiText>
      <CodeBlock code={WikiExamples.fileFormat} />
      <WikiText>
        <a
          href={`${Globals.RouteBaseName}run?algorithm=linear_search`}
          className="underline"
        >
          Open Linear Search in the visualizer
        </a>
        {' '}
        to step through the bundled version.
      </WikiText>

      <WikiSubheading>Basics</WikiSubheading>
      <DataTable
        label="Basic syntax"
        headers={['Feature', 'Example']}
        rows={
          SyntaxRows.map(([feature, example]) => [
            feature,
            <WikiCode key={feature}>{example}</WikiCode>,
          ])
        }
      />
      <WikiText>
        <WikiCode>/</WikiCode>
        {' '}
        is real division, so use
        {' '}
        <WikiCode>floor(x)</WikiCode>
        {' '}
        when you need a whole number. Array indexes are rounded down. The word
        {' '}
        <WikiCode>arr</WikiCode>
        {' '}
        is reserved, so it cannot be a variable name.
      </WikiText>

      <WikiSubheading>Control flow</WikiSubheading>
      <WikiText>
        Every block ends with a matching
        {' '}
        <WikiCode>end</WikiCode>
        {' '}
        keyword. Parentheses around a condition are optional, except in
        {' '}
        <WikiCode>for (...)</WikiCode>
        {' '}
        and
        {' '}
        <WikiCode>do ... while (...)</WikiCode>
        . Use
        {' '}
        <WikiCode>break</WikiCode>
        {' '}
        to leave the innermost loop, and
        {' '}
        <WikiCode>continue</WikiCode>
        {' '}
        to skip to its next iteration.
      </WikiText>
      <CodeBlock code={ControlFlow} />
      <WikiText>
        A
        {' '}
        <WikiCode>do ... while</WikiCode>
        {' '}
        loop runs its body at least once. It ends with the
        {' '}
        <WikiCode>while</WikiCode>
        {' '}
        line and has no
        {' '}
        <WikiCode>end</WikiCode>
        {' '}
        keyword.
      </WikiText>
      <CodeBlock code={WikiExamples.doWhile} />

      <WikiSubheading>Functions and built-ins</WikiSubheading>
      <WikiText>
        Declare a function with
        {' '}
        <WikiCode>fun Name(a, b):</WikiCode>
        {' '}
        and close it with
        {' '}
        <WikiCode>end fun</WikiCode>
        . Function names should start with a capital letter. This is a
        convention, not a syntax rule.
      </WikiText>
      <DataTable
        label="Built-in functions"
        headers={['Function', 'Meaning']}
        rows={
          BuiltinRows.map(([name, meaning]) => [
            <WikiCode key={name}>{name}</WikiCode>,
            meaning,
          ])
        }
      />

      <WikiSubheading>Visual directives</WikiSubheading>
      <WikiText>
        Directives control what the visualization shows. Put one at the start
        of a line, before the statement it annotates, or before a function
        parameter. On a
        {' '}
        <WikiCode>for</WikiCode>
        {' '}
        loop, you can also put it right after the word
        {' '}
        <WikiCode>for</WikiCode>
        . You can chain several on one line, but a directive cannot sit on a
        line by itself. Directives change only the visualization, not your
        program&apos;s variables.
      </WikiText>
      <WikiText>
        Directives on an
        {' '}
        <WikiCode>if</WikiCode>
        {' '}
        statement are currently ignored, with no error. Put them on a statement
        inside the block instead.
      </WikiText>
      <DataTable
        label="Visual directives"
        headers={['Directive', 'Parameters', 'Effect']}
        rows={
          WikiDirectives.map(directive => [
            <WikiCode key={directive.name}>{directive.usage}</WikiCode>,
            directive.parameters,
            directive.effect,
          ])
        }
      />
      <CodeBlock code={WikiExamples.directives} />
      <WikiText>
        Use outlines for cursors and iterators, and use highlights sparingly,
        for found, swap, and warning states. The interpreter adds comparison
        text and array-access marks automatically. A hand-written
        {' '}
        <WikiCode>text</WikiCode>
        {' '}
        mark displays nothing, so you don&apos;t need one.
      </WikiText>

      <WikiText>
        See the
        {' '}
        <a
          href={`${Globals.AppSourceURL}/blob/main/docs/PSEUDOCODE.md`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          pseudocode reference
        </a>
        {' '}
        for the contributor version of this guide.
      </WikiText>
    </WikiSection>
  );
}
