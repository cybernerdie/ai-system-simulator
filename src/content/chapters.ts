/** The level map: the numbered levels in six chapters, easiest first. Each chapter ends in a boss. */
export interface Chapter {
  title: string;
  blurb: string;
  ids: string[];
  /** The boss level that closes the chapter; unlocks once every level in it is cleared. */
  boss: string;
}

export const CHAPTERS: Chapter[] = [
  {
    title: 'Getting it working',
    blurb: 'Make a chatbot that knows your docs, survives a launch, uses tools and shrugs off a jailbreak.',
    ids: ['docs-bot', 'wrong-chunks', 'launch-day', 'support-agent', 'jailbreak'],
    boss: 'boss-launch',
  },
  {
    title: 'Making it good',
    blurb: 'Long documents, slow answers, chats that never end, quality you can measure, your own GPUs.',
    ids: ['long-docs', 'feels-slow', 'endless-chat', 'flying-blind', 'self-host'],
    boss: 'boss-pilot',
  },
  {
    title: 'Keeping it running',
    blurb: 'Outages, agent teams, thinking budgets, output your code can trust, and knowledge that goes stale.',
    ids: ['provider-down', 'research-team', 'think-harder', 'broke-parser', 'stale-index'],
    boss: 'boss-outage',
  },
  {
    title: 'Running it for real',
    blurb: 'Big prompts, background jobs, fine-tuning, models that change under you, and personal data.',
    ids: ['big-prompt', 'nightly-job', 'fine-tune', 'model-drift', 'pii'],
    boss: 'boss-scale',
  },
  {
    title: 'Advanced',
    blurb: 'Voice, abuse, temperature, evals you can trust, and attacks hidden in what your agent reads.',
    ids: ['voice', 'abuse', 'temperature', 'eval-trust', 'indirect-injection'],
    boss: 'boss-agent',
  },
  {
    title: 'Find the bug',
    blurb: 'Complete systems with one wrong setting each. Nothing to add: read the symptoms and find it.',
    ids: ['bug-cache', 'bug-memory', 'bug-guard', 'bug-reranker', 'bug-thinking'],
    boss: 'boss-bugs',
  },
  {
    title: 'Production readiness',
    blurb: 'What a demo never needs: who may call you, seeing why an answer went wrong, and serving every group of users well.',
    ids: ['leaked-key', 'why-did-it-say', 'average-looks-fine'],
    boss: 'boss-ship',
  },
];
