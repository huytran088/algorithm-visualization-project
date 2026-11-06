import Globals from '../globals';

import AppFrame from '../components/frames/AppFrame';

import PageMeta from '../components/PageMeta';

import AiTutorSection from '../components/wiki/AiTutorSection';
import ArchitectureSection from '../components/wiki/ArchitectureSection';
import PseudocodeSection from '../components/wiki/PseudocodeSection';

const Sections = [
  { id: 'architecture', title: 'Architecture' },
  { id: 'pseudocode', title: 'Pseudocode' },
  { id: 'ai-tutor', title: 'AI Tutor' },
] as const;

/**
 * Renders the "Wiki" page.
 *
 * This should provide an overview of everything a user needs
 * to know in order to use the app to its fullest extent.
 */
export default function Wiki() {
  return (
    <>
      <PageMeta
        title="Wiki"
        description="Learn how the app works, how to write pseudocode, and how the AI Tutor generates code."
      />
      <AppFrame
        title={`${Globals.AppName} Wiki`}
        setTitle={undefined}
        mutable={false}
        sidebar={undefined}
        setSidebar={undefined}
        menuLinks={Globals.MenuLinksHome}
      >
        <div
          id="wiki-content"
          className="h-full overflow-x-hidden overflow-y-scroll"
        >
          <nav
            aria-label="Wiki sections"
            className="flex justify-center gap-4 py-3 px-4 sticky z-50 top-0 bg-[#ffffff] dark:bg-[#18181c] border-b border-[#d8d8dc] dark:border-[#38383c]"
          >
            {
              Sections.map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-primary/75 hover:text-primary focus-visible:text-primary"
                >
                  {section.title}
                </a>
              ))
            }
          </nav>
          <div className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-8 pb-24">
            <ArchitectureSection />
            <PseudocodeSection />
            <AiTutorSection />
          </div>
        </div>
      </AppFrame>
    </>
  );
}
