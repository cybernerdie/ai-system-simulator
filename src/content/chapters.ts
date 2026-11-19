/** The level map: the 25 levels in five chapters, easiest first. */
export interface Chapter {
  title: string;
  blurb: string;
  ids: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    title: 'Getting it working',
    blurb: 'Make a chatbot that knows your docs, survives a launch, uses tools and shrugs off a jailbreak.',
    ids: ['docs-bot', 'wrong-chunks', 'launch-day', 'support-agent', 'jailbreak'],
  },
  {
    title: 'Making it good',
    blurb: 'Long documents, slow answers, chats that never end, quality you can measure, your own GPUs.',
    ids: ['long-docs', 'feels-slow', 'endless-chat', 'flying-blind', 'self-host'],
  },
  {
    title: 'Keeping it running',
    blurb: 'Outages, agent teams, thinking budgets, output your code can trust, and knowledge that goes stale.',
    ids: ['provider-down', 'research-team', 'think-harder', 'broke-parser', 'stale-index'],
  },
  {
    title: 'Running it for real',
    blurb: 'Big prompts, background jobs, fine-tuning, models that change under you, and personal data.',
    ids: ['big-prompt', 'nightly-job', 'fine-tune', 'model-drift', 'pii'],
  },
  {
    title: 'Advanced',
    blurb: 'Voice, abuse, temperature, evals you can trust, and attacks hidden in what your agent reads.',
    ids: ['voice', 'abuse', 'temperature', 'eval-trust', 'indirect-injection'],
  },
];
