import {
  FloppyDisk,
  Folder,
  HelpCircle,
  Import,
  InfoCircle,
  PlusCircle,
  ShareIos,
} from 'iconoir-react';

/**
 * Global application constants.
 *
 * @property {string} AppName
 *           The name of the application.
 * @property {string} AppVersion
 *           The version of the application.
 * @property {string} AppLicense
 *           The license of the application.
 * @property {string} AppURL
 *           The URL of the application.
 * @property {string} AppIssuesURL
 *           The public URL of the project issues page.
 * @property {string} AppSourceURL
 *           The public URL of the project source code.
 * @property {string} RouteBaseName
 *           The base path the app is served from. Defaults to
 *           "/avp/" (GitHub Pages user site); override at
 *           build time with the VITE_BASE_PATH env variable.
 * @property {string} AIApiURL
 *           The endpoint used by the AI pane to generate pseudocode.
 *           Override at build time with the VITE_AI_API_URL env variable.
 */
const DefaultRouteBaseName = '/avp/';

/**
 * Resolves the base path the app is served from (e.g. "/" or "/avp/").
 *
 * Set VITE_BASE_PATH at build time to override the default. This module is
 * loaded both by the Vite/React Router configs (Node, `process.env`) and by the
 * client bundle (`import.meta.env`), so both are checked.
 */
function resolveRouteBaseName(): string {
  const fromEnv =
    import.meta.env?.VITE_BASE_PATH ??
      (typeof process !== 'undefined' ? process.env?.VITE_BASE_PATH : undefined);
  const raw = (fromEnv as string | undefined) || DefaultRouteBaseName;
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/');
}

const RouteBaseName = resolveRouteBaseName();
const Globals = {
  AppName: 'Algorithm Visualization Project',
  AppVersion: 'v0.0.1a',
  AppLicense: 'GPLv3',

  AppURL: 'https://huytran088.github.io/avp/',
  AppIssuesURL: 'https://github.com/huytran088/algorithm-visualization-project/issues',
  AppSourceURL: 'https://github.com/huytran088/algorithm-visualization-project',
  RouteBaseName: RouteBaseName,

  AIApiURL: (import.meta.env?.VITE_AI_API_URL as string | undefined) ??
    'https://beefstewbibi-avp-rag-system.hf.space/api/generate',

  AIButtonStrings: {
    Run: 'Generate',
    Wait: {
      Running: 'Generating...',
      Editing: 'Save or Discard Code to Continue...',
    },
    Error: 'Failed to Process Request!',
  },

  MenuLinksHome: [
    {
      icon: PlusCircle,
      text: 'Create...',
      href: `${RouteBaseName}run`,
      separateNext: false,
    },
    {
      icon: Folder,
      text: 'Open...',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: true,
    },
    {
      icon: Import,
      text: 'Import...',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: true,
    },
    {
      icon: HelpCircle,
      text: 'Wiki',
      href: `${RouteBaseName}wiki`,
      separateNext: false,
    },
    {
      icon: InfoCircle,
      text: 'About',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: false,
    },
  ],
  MenuLinksRun: [
    {
      icon: PlusCircle,
      text: 'Create...',
      href: `${RouteBaseName}run`,
      separateNext: false,
    },
    {
      icon: Folder,
      text: 'Open...',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: false,
    },
    {
      icon: FloppyDisk,
      text: 'Save...',
      onClick: () => {
        const sourceHTML = `// ${document.getElementById('title')!.innerHTML}

${document.getElementById('sourceCode')!.innerHTML}`;
        const txt = document.createElement('textarea');
        txt.innerHTML = sourceHTML;
        const source = txt.value;
        txt.remove();

        const downloadelem = document.createElement('a');
        const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));

        document.body.appendChild(downloadelem);

        downloadelem.target = '_blank';
        downloadelem.href = url;
        downloadelem.download = `${document.getElementById('title')!.innerHTML}.avp`;
        downloadelem.click();
        downloadelem.remove();

        window.URL.revokeObjectURL(url);
      },
      separateNext: true,
    },
    {
      icon: Import,
      text: 'Import...',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: false,
    },
    {
      icon: ShareIos,
      text: 'Export...',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: true,
    },
    {
      icon: HelpCircle,
      text: 'Wiki',
      href: `${RouteBaseName}wiki`,
      separateNext: false,
    },
    {
      icon: InfoCircle,
      text: 'About',
      onClick: () => alert('TODO'),
      disabled: true,
      separateNext: false,
    },
  ],

  AlgorithmCards: [
    {
      img: [
        `${RouteBaseName}img/binary-search_light.png`,
        `${RouteBaseName}img/binary-search_dark.png`,
      ],
      title: 'Binary Search',
      tags: [
        'Easy',
        'Array',
        'Divide and Conquer',
        'Search',
        'O(log n)',
      ],
      href: `${RouteBaseName}run?algorithm=binary_search`,
    },
    {
      img: [
        `${RouteBaseName}img/bubble-sort_light.png`,
        `${RouteBaseName}img/bubble-sort_dark.png`,
      ],
      title: 'Bubble Sort',
      tags: [
        'Easy',
        'Array',
        'Exchange',
        'Sort',
        'O(n\u00B2)',
      ],
      href: `${RouteBaseName}run?algorithm=bubble_sort`,
    },
    {
      img: [
        `${RouteBaseName}img/check-unique_light.png`,
        `${RouteBaseName}img/check-unique_dark.png`,
      ],
      title: 'Check Unique',
      tags: [
        'Easy',
        'Array',
        'Brute Force',
        'Search',
        'O(n\u00B2)',
      ],
      href: `${RouteBaseName}run?algorithm=check_unique`,
    },
    {
      img: [
        `${RouteBaseName}img/comparison-counting-sort_light.png`,
        `${RouteBaseName}img/comparison-counting-sort_dark.png`,
      ],
      title: 'Comparison Counting Sort',
      tags: [
        'Easy',
        'Array',
        'Count',
        'Sort',
        'O(n\u00B2)',
      ],
      href: `${RouteBaseName}run?algorithm=comparison_counting_sort`,
    },
    {
      img: [
        `${RouteBaseName}img/hoare-partition_light.png`,
        `${RouteBaseName}img/hoare-partition_dark.png`,
      ],
      title: 'Hoare Partition',
      tags: [
        'Intermediate',
        'Array',
        'Divide and Conquer',
        'Partition',
        'O(n)',
      ],
      href: `${RouteBaseName}run?algorithm=hoare_partition`,
    },
    {
      img: [
        `${RouteBaseName}img/insertion-sort_light.png`,
        `${RouteBaseName}img/insertion-sort_dark.png`,
      ],
      title: 'Insertion Sort',
      tags: [
        'Easy',
        'Array',
        'Insert',
        'Sort',
        'O(n\u00B2)',
      ],
      href: `${RouteBaseName}run?algorithm=insertion_sort`,
    },
    {
      img: [
        `${RouteBaseName}img/linear-search_light.png`,
        `${RouteBaseName}img/linear-search_dark.png`,
      ],
      title: 'Linear Search',
      tags: [
        'Easy',
        'Array',
        'Brute Force',
        'Search',
        'O(n)',
      ],
      href: `${RouteBaseName}run?algorithm=linear_search`,
    },
    {
      img: [
        `${RouteBaseName}img/lomuto-partition_light.png`,
        `${RouteBaseName}img/lomuto-partition_dark.png`,
      ],
      title: 'Lomuto Partition',
      tags: [
        'Intermediate',
        'Array',
        'Divide and Conquer',
        'Partition',
        'O(n)',
      ],
      href: `${RouteBaseName}run?algorithm=lomuto_partition`,
    },
    {
      img: [
        `${RouteBaseName}img/selection-sort_light.png`,
        `${RouteBaseName}img/selection-sort_dark.png`,
      ],
      title: 'Selection Sort',
      tags: [
        'Easy',
        'Array',
        'Selection',
        'Sort',
        'O(n\u00B2)',
      ],
      href: `${RouteBaseName}run?algorithm=selection_sort`,
    },
  ],
} as const;

export default Globals;
