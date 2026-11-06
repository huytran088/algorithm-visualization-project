/**
 * Renders a titled wiki section that can be linked to by its id.
 *
 * @param {Object} props
 *        React props
 * @param {string} props.id
 *        The element id, used by in-page links
 * @param {string} props.title
 *        The section heading
 * @param {React.ReactNode} props.children
 *        Child elements
 */
export function WikiSection(
  {
    id,
    title,
    children,
  }:
  {
    id: string
    title: string
    children: React.ReactNode
  },
) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-16 flex flex-col gap-4"
    >
      <h2
        id={`${id}-heading`}
        className="text-3xl font-semibold text-primary"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Renders a heading for a topic within a wiki section.
 *
 * @param {Object} props
 *        React props
 * @param {React.ReactNode} props.children
 *        The heading text
 */
export function WikiSubheading(
  {
    children,
  }:
  {
    children: React.ReactNode
  },
) {
  return (
    <h3 className="mt-4 text-xl font-semibold text-primary">
      {children}
    </h3>
  );
}

/**
 * Renders a paragraph of wiki text.
 *
 * @param {Object} props
 *        React props
 * @param {React.ReactNode} props.children
 *        The paragraph content
 */
export function WikiText(
  {
    children,
  }:
  {
    children: React.ReactNode
  },
) {
  return (
    <p className="leading-7 text-primary/85">
      {children}
    </p>
  );
}

/**
 * Renders inline code.
 *
 * @param {Object} props
 *        React props
 * @param {React.ReactNode} props.children
 *        The code
 */
export function WikiCode(
  {
    children,
  }:
  {
    children: React.ReactNode
  },
) {
  return (
    <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-sm wrap-anywhere">
      {children}
    </code>
  );
}

/**
 * Renders a read-only block of code that scrolls on its own when too wide.
 *
 * @param {Object} props
 *        React props
 * @param {string} props.code
 *        The code to display
 */
export function CodeBlock(
  {
    code,
  }:
  {
    code: string
  },
) {
  return (
    <pre
      tabIndex={0}
      className="overflow-x-auto rounded-md border border-[#d8d8dc] dark:border-[#38383c] bg-primary/5 p-4 font-mono text-sm leading-6 text-primary"
    >
      <code>{code.trimEnd()}</code>
    </pre>
  );
}

/**
 * Renders a table that scrolls on its own when too wide.
 *
 * @param {Object} props
 *        React props
 * @param {string} props.label
 *        The accessible name of the table
 * @param {string[]} props.headers
 *        The column headings
 * @param {React.ReactNode[][]} props.rows
 *        The cell content of each row
 */
export function DataTable(
  {
    label,
    headers,
    rows,
  }:
  {
    label: string
    headers: readonly string[]
    rows: readonly (readonly React.ReactNode[])[]
  },
) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="overflow-x-auto rounded-md border border-[#d8d8dc] dark:border-[#38383c]"
    >
      <table className="w-full border-collapse text-left text-sm text-primary/85">
        <thead className="bg-primary/5 text-primary">
          <tr>
            {
              headers.map(header => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-2 font-semibold"
                >
                  {header}
                </th>
              ))
            }
          </tr>
        </thead>
        <tbody>
          {
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-t border-[#d8d8dc] dark:border-[#38383c]"
              >
                {
                  row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 py-2 align-top"
                    >
                      {cell}
                    </td>
                  ))
                }
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
