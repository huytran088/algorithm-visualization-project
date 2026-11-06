import {
  DataTable,
  WikiSection,
  WikiSubheading,
  WikiText,
} from './WikiParts';

const PipelineSteps = [
  {
    title: 'Prompt',
    text: 'The app combines the language rules, the code in your editor, and ' +
      'your request. If you leave the request empty, it uses the page title.',
  },
  {
    title: 'Retrieve',
    text: 'The AI service searches its knowledge base for the 6 most similar ' +
      'functions, using BAAI/bge-base-en-v1.5 embeddings and a FAISS index. ' +
      'BAAI/bge-reranker-base then reranks them and keeps the best 2.',
  },
  {
    title: 'Generate',
    text: 'Those 2 functions are added to the prompt as reference code, and ' +
      'a language model writes the result.',
  },
  {
    title: 'Review',
    text: 'The code opens in the editor in edit mode. Nothing runs until you ' +
      'click Save.',
  },
] as const;

const FactRows = [
  ['Knowledge base', '12 .avp files, split into one entry per function'],
  ['Rate limit', '10 requests per minute'],
  ['Caching', 'Repeated requests may be answered from a 1-hour cache'],
  ['Memory', 'None. Each request stands alone, with no conversation history'],
] as const;

/**
 * Renders the wiki section that explains how the AI Tutor works.
 */
export default function AiTutorSection() {
  return (
    <WikiSection
      id="ai-tutor"
      title="AI Tutor"
    >
      <p
        role="note"
        className="rounded-md border-l-4 border-primary bg-primary/5 p-4 leading-7 text-primary"
      >
        <strong>The AI Tutor is temporarily unavailable.</strong>
        {' '}
        Clicking Generate will show an error until the AI service is back. The
        rest of the app is not affected.
      </p>

      <WikiText>
        The AI Tutor writes
        {' '}
        pseudocode for you. Describe an algorithm, or ask for a change to the
        code in your editor, and click
        {' '}
        <strong>Generate</strong>
        . It produces code in one shot: it does not explain its answer or hold
        a conversation.
      </WikiText>

      <WikiSubheading>How it works</WikiSubheading>
      <WikiText>
        The AI Tutor uses retrieval-augmented generation (RAG). Before writing
        anything, it looks up real
        {' '}
        pseudocode examples so that the language model can follow the syntax of
        this language.
      </WikiText>
      <ol className="flex flex-col gap-2 list-decimal pl-6 leading-7 text-primary/85">
        {
          PipelineSteps.map(step => (
            <li key={step.title}>
              <strong className="text-primary">
                {`${step.title}:`}
              </strong>
              {' '}
              {step.text}
            </li>
          ))
        }
      </ol>

      <WikiSubheading>Limits</WikiSubheading>
      <DataTable
        label="AI Tutor limits"
        headers={['Topic', 'Details']}
        rows={FactRows}
      />

      <WikiSubheading>Privacy</WikiSubheading>
      <WikiText>
        When you click Generate, your request and all of the code in your editor
        are sent to a third-party host and a language model provider. Keep
        private information out of both. Nothing is sent until you click
        Generate.
      </WikiText>

      <WikiSubheading>Check the results</WikiSubheading>
      <WikiText>
        AI output can be wrong, even when it runs. Read the code and step
        through it before you rely on it.
      </WikiText>
    </WikiSection>
  );
}
