import Globals from '../../globals';

import {
  WikiCode,
  WikiSection,
  WikiSubheading,
  WikiText,
} from './WikiParts';

const PipelineStages = [
  { title: '.avp file', detail: 'Your pseudocode' },
  { title: 'ANTLR parser', detail: 'Checks syntax, builds a parse tree' },
  { title: 'Trace interpreter', detail: 'Runs the program once' },
  { title: 'Step trace', detail: 'Lines and actions for every step' },
] as const;

const BoxWidth = 320;
const BoxHeight = 56;
const Gap = 28;
const StageTop = (index: number) => index * (BoxHeight + Gap);
const OutputTop = StageTop(PipelineStages.length);

/**
 * Renders a diagram of how source code becomes a visualization.
 */
function PipelineDiagram() {
  return (
    <svg
      role="img"
      aria-label="A pipeline. A .avp file goes to the ANTLR parser, then the trace interpreter, which produces a step trace. The trace drives the Variables pane and the visualization."
      viewBox={`0 0 ${BoxWidth + 2} ${OutputTop + BoxHeight + 2}`}
      className="w-full max-w-md self-center text-primary"
    >
      <defs>
        <marker
          id="wiki-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path
            d="M0,0 L8,4 L0,8 Z"
            fill="currentColor"
          />
        </marker>
      </defs>
      {
        PipelineStages.map((stage, index) => (
          <g key={stage.title}>
            <rect
              x="1"
              y={StageTop(index) + 1}
              width={BoxWidth}
              height={BoxHeight}
              rx="6"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.5"
            />
            <text
              x={BoxWidth / 2}
              y={StageTop(index) + 24}
              textAnchor="middle"
              fontSize="15"
              fontWeight="600"
              fill="currentColor"
            >
              {stage.title}
            </text>
            <text
              x={BoxWidth / 2}
              y={StageTop(index) + 44}
              textAnchor="middle"
              fontSize="13"
              fill="currentColor"
              fillOpacity="0.8"
            >
              {stage.detail}
            </text>
            {
              (index < PipelineStages.length - 1) ?
                (
                  <line
                    x1={BoxWidth / 2}
                    x2={BoxWidth / 2}
                    y1={StageTop(index) + BoxHeight + 2}
                    y2={StageTop(index + 1) - 2}
                    stroke="currentColor"
                    markerEnd="url(#wiki-arrow)"
                  />
                ) :
                <></>
            }
          </g>
        ))
      }
      {
        [
          { x: 1, title: 'Variables pane' },
          { x: 171, title: 'Visualization' },
        ].map(output => (
          <g key={output.title}>
            <line
              x1={BoxWidth / 2}
              x2={output.x + 75}
              y1={OutputTop - Gap + 2}
              y2={OutputTop - 2}
              stroke="currentColor"
              markerEnd="url(#wiki-arrow)"
            />
            <rect
              x={output.x}
              y={OutputTop + 1}
              width="150"
              height={BoxHeight}
              rx="6"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.5"
            />
            <text
              x={output.x + 75}
              y={OutputTop + 33}
              textAnchor="middle"
              fontSize="15"
              fontWeight="600"
              fill="currentColor"
            >
              {output.title}
            </text>
          </g>
        ))
      }
    </svg>
  );
}

/**
 * Renders the wiki section that explains how the app works.
 */
export default function ArchitectureSection() {
  return (
    <WikiSection
      id="architecture"
      title="System architecture"
    >
      <WikiText>
        {Globals.AppName}
        {' '}
        runs entirely in your browser. There is no application server: every
        page is built ahead of time, and your code is parsed and run on your own
        device.
      </WikiText>

      <WikiSubheading>From code to visualization</WikiSubheading>
      <PipelineDiagram />
      <WikiText>
        The interpreter does not animate anything. It runs your program once
        from start to finish and records a list of steps. Each step holds the
        source lines to highlight and the actions to apply, such as adding a
        variable or marking an array cell. The Variables pane and the
        visualization then replay those steps.
      </WikiText>

      <WikiSubheading>Stepping and editing</WikiSubheading>
      <WikiText>
        Because the steps are recorded ahead of time, moving backward is as fast
        as moving forward, and nothing runs again. Changes in the Code pane take
        effect only when you click
        {' '}
        <strong>Save</strong>
        , which runs the program again and records new steps.
      </WikiText>
      <WikiText>
        <WikiCode>for</WikiCode>
        ,
        {' '}
        <WikiCode>while</WikiCode>
        , and
        {' '}
        <WikiCode>do ... while</WikiCode>
        {' '}
        loops each stop after about 1000 iterations, with no warning. This
        protects the page from a simple infinite loop, but it has limits. It
        applies to each loop separately, so nested loops can still produce
        millions of steps, and
        {' '}
        <WikiCode>for ... in</WikiCode>
        {' '}
        loops are not limited at all. Either can slow down or freeze the page.
      </WikiText>

      <WikiSubheading>What stays in your browser</WikiSubheading>
      <WikiText>
        Your preferences, such as theme, layout, speed, and favorites, are kept
        in your browser&apos;s
        {' '}
        <WikiCode>localStorage</WikiCode>
        . Your code leaves your browser only when you use the
        {' '}
        <a
          href="#ai-tutor"
          className="underline"
        >
          AI Tutor
        </a>
        . As with most websites, the site&apos;s host and Google Fonts receive
        standard request details, such as your IP address, when a page loads.
      </WikiText>

      <WikiText>
        Contributors can find more detail in the
        {' '}
        <a
          href={`${Globals.AppSourceURL}/blob/main/docs/ARCHITECTURE.md`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          architecture documentation
        </a>
        .
      </WikiText>
    </WikiSection>
  );
}
