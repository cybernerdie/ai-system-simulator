/**
 * One question per level, asked after you clear it. It checks the idea, not the clicks:
 * "why did that work?", not "which button did you press?".
 */
export interface QuizQuestion {
  q: string;
  options: [string, string, string];
  /** index of the right option */
  answer: 0 | 1 | 2;
  why: string;
}

export const QUIZ: Record<string, QuizQuestion> = {
  'docs-bot': {
    q: "Why did adding retrieval fix the made-up answers, when a bigger model wouldn't have?",
    options: ['Retrieval makes the model think harder', "The answers were in your store's own documents, which the model had never seen", 'Retrieval lowers the temperature'],
    answer: 1,
    why: 'A model can only use what it was trained on or what you give it. Your docs were in neither, so it guessed. Retrieval puts the right passage in the prompt.',
  },
  'wrong-chunks': {
    q: 'Why did keyword search help with questions about error codes and part numbers?',
    options: [
      'Vector search matches meaning, and exact strings like "E-4012" have little meaning to match',
      'Keyword search is always more accurate',
      'Keyword search is cheaper, so you can retrieve more',
    ],
    answer: 0,
    why: 'Embeddings capture meaning, so near-identical codes look alike. Keyword search matches the exact string. Hybrid search gets both, and a reranker picks the best of the combined results.',
  },
  'launch-day': {
    q: 'What did the router add on top of the cache?',
    options: ['It blocked repeat questions', 'It sent easy questions to a smaller, cheaper, faster model', 'It retried failed calls'],
    answer: 1,
    why: 'Most traffic is easy. Routing it to a small model cuts cost and rate-limit pressure, and saves the big model for questions that need it.',
  },
  'support-agent': {
    q: 'Why does an agent need a step limit?',
    options: ['Agents can loop, and every step is another paid model call', 'More steps always lower accuracy', 'The provider requires one'],
    answer: 0,
    why: 'An agent calls the model, uses a tool, then calls the model again. Without a cap a confused agent keeps going, and the bill grows with every step.',
  },
  jailbreak: {
    q: 'Why use both an input guard and an output check?',
    options: ['One is for cost, the other for speed', 'Each catches attacks the other misses, so layers beat any single filter', 'The output check makes the input guard faster'],
    answer: 1,
    why: 'No filter is perfect. Checking what comes in and what goes out catches more than tightening one layer until it blocks real users.',
  },
  'long-docs': {
    q: 'What went wrong with large chunks and a high top-K?',
    options: ['The prompt grew past the context window and filled up with noise', 'Large chunks are slower to embed', 'The model refused long inputs for safety'],
    answer: 0,
    why: 'Every retrieved chunk goes into the prompt. Big chunks times many results overflows the window, and even when it fits, the model has to dig the answer out of noise.',
  },
  'feels-slow': {
    q: 'Streaming didn\'t make the full answer arrive sooner. Why does it still fix "it feels slow"?',
    options: ['It does make answers shorter', 'People judge speed by when the first words appear', 'It skips the output check'],
    answer: 1,
    why: "Time to first token is what people feel. Streaming shows words as they're generated, so a five-second answer starts in under one.",
  },
  'endless-chat': {
    q: 'Why did cost keep climbing as conversations got longer?',
    options: ['Longer chats use a bigger model', 'Every message resent the whole conversation so far', 'The cache stops working'],
    answer: 1,
    why: "Models have no memory between calls. Sending the full history each turn means cost grows with every message. Memory strategies send only what's needed.",
  },
  'flying-blind': {
    q: "Why couldn't you fix quality before adding the Eval Harness?",
    options: ['Evals make the model more accurate', "You can't see quality in production without measuring it", 'The harness unlocks better settings'],
    answer: 1,
    why: "Wrong answers don't throw errors. Without evals on real traffic you're tuning blind, and you only hear about problems from angry users.",
  },
  'self-host': {
    q: 'What did bigger batches do for your own GPUs?',
    options: ['Each request got faster', 'The GPUs served many requests at once, so throughput went up and cost per request went down', 'Batching improved accuracy'],
    answer: 1,
    why: 'GPUs are paid for by the hour, busy or idle. Batching keeps them busy. Each request waits a little longer, but far more get served per dollar.',
  },
  'provider-down': {
    q: 'Why did retries alone make the outage worse?',
    options: ['Retries are billed double', "Retrying a provider that's down just piles more load and waiting onto it", 'Retries turn off streaming'],
    answer: 1,
    why: 'Retries help with blips, not outages. When a provider is down, you need failover to a different one.',
  },
  'research-team': {
    q: 'Why was the agent team faster than one agent?',
    options: ['Workers ran sub-questions in parallel instead of one after another', 'Teams use smaller models', 'Teams skip the reviewer'],
    answer: 0,
    why: 'Research splits into independent parts. Parallel workers finish them at the same time, and a reviewer catches mistakes. Too many workers adds coordination cost.',
  },
  'think-harder': {
    q: 'Why route instead of turning on thinking for everything?',
    options: ['Thinking only works on small models', "Reasoning tokens cost money and time, and most questions don't need them", 'Routers are more accurate than thinking'],
    answer: 1,
    why: 'Thinking helps hard problems and wastes money on easy ones. Sending only the hard ones to a thinking model gets the accuracy without the bill.',
  },
  'broke-parser': {
    q: 'What does JSON mode or structured output guarantee?',
    options: ['That the values are correct', 'That the output parses into the shape your code expects', 'That the model answers faster'],
    answer: 1,
    why: 'It constrains the format, not the facts. Your code stops crashing on malformed output, but you still check the content.',
  },
  'stale-index': {
    q: 'The model answered confidently from old docs. What was really wrong?',
    options: ['The model was out of date', "The index wasn't refreshed, and tables were flattened into unreadable text", 'Top-K was too low'],
    answer: 1,
    why: 'RAG is only as fresh and as readable as its index. Re-index on change, and parse tables and PDFs with their layout intact.',
  },
  'big-prompt': {
    q: 'What does prompt caching save?',
    options: ["The model's answer", 'Reprocessing the same long prefix on every call', "The user's question"],
    answer: 1,
    why: 'When every call starts with the same long system prompt, the provider can reuse its work on that prefix. You pay much less for it and wait less.',
  },
  'nightly-job': {
    q: 'Why move the background jobs to a batch queue?',
    options: ['Batch jobs are more accurate', 'Nobody is waiting on them, so they can run later at a discount and stop competing with live users', 'It encrypts them'],
    answer: 1,
    why: "Batch APIs trade speed for price. Jobs nobody waits on shouldn't eat the rate limit your live users need.",
  },
  'fine-tune': {
    q: 'When does fine-tuning beat retrieval?',
    options: ['When the answer is a fact in your docs', 'When the model needs to learn a task, format or style, not look up facts', "Always, it's cheaper"],
    answer: 1,
    why: 'Retrieval adds knowledge at question time. Fine-tuning teaches behaviour: your labels, your format, your voice. A small tuned model can beat a big general one on a narrow task.',
  },
  'model-drift': {
    q: 'Why pin a model version?',
    options: ['Pinned versions are cheaper', "So the model can't change underneath you without you testing it first", 'Latest versions are always worse'],
    answer: 1,
    why: 'A "latest" alias can be swapped by the provider at any time. Pin a dated version, run your evals on the new one, then switch deliberately.',
  },
  pii: {
    q: 'What does a PII redactor do?',
    options: [
      'Deletes messages that contain personal data',
      'Swaps personal details for placeholders before the prompt leaves, and restores them in the answer',
      "Encrypts the model's weights",
    ],
    answer: 1,
    why: 'The model rarely needs the real name or number to answer. Redacting keeps them inside your systems while the product still works.',
  },
  voice: {
    q: 'Why did streaming every stage fix the walkie-talkie feeling?',
    options: ['It made each stage more accurate', 'Stages overlapped instead of each waiting for the previous one to finish', 'It used a smaller model'],
    answer: 1,
    why: 'Voice latency is the sum of the pipeline. Streaming lets speech-to-text, the model and text-to-speech work at the same time, so the reply starts within a second.',
  },
  abuse: {
    q: 'Your provider already rate-limits you. Why add your own per-user limits?',
    options: ["The provider's limit protects them, not your other users or your budget", 'Per-user limits make answers better', "They're required by law"],
    answer: 0,
    why: 'One script can use up your whole quota. Limits per user keep a few accounts from taking capacity and money from everyone else.',
  },
  temperature: {
    q: 'What should temperature be for extracting an invoice total?',
    options: ['High, so the model considers more options', 'Near zero, so the same input gives the same answer', "It doesn't matter for extraction"],
    answer: 1,
    why: 'Temperature is randomness. Tasks with one right answer want it low. Keep it higher only where variety helps, like writing.',
  },
  'eval-trust': {
    q: 'The dashboard said 98%. What made it lie?',
    options: ['The model was overfitting', 'An easy hand-picked test set and an unchecked LLM judge', 'Too few requests'],
    answer: 1,
    why: 'Evals are only as honest as their test set and their judge. Sample real traffic, and check the judge against human ratings.',
  },
  'indirect-injection': {
    q: "Why wouldn't an input guard stop the hijacked email?",
    options: ['It was switched off', 'The attack was in content the agent read, not in what the user typed', 'Emails are encrypted'],
    answer: 1,
    why: 'Indirect injection hides in documents, emails and web pages. Defend in layers: treat external content as untrusted, limit permissions and require approval for risky actions.',
  },
  'bug-cache': {
    q: "What does lowering a semantic cache's similarity threshold do?",
    options: ['More hits, including answers to questions that only look similar', 'Fewer hits and more accuracy', 'Nothing, the threshold only affects speed'],
    answer: 0,
    why: 'A loose threshold treats "cancel" and "upgrade" as the same question. Tune it on real question pairs.',
  },
  'bug-memory': {
    q: 'Why did a two-turn window make the bot forget?',
    options: ['The model has a short memory', 'Anything older than two turns was never sent to the model', 'Windows corrupt the history'],
    answer: 1,
    why: "The model only sees what's in the prompt. Summaries or long-term memory keep what matters without resending everything.",
  },
  'bug-guard': {
    q: "What's the cost of turning a guardrail all the way up?",
    options: ['Nothing, stricter is always safer', 'It starts blocking real users, which is a failure too', 'It slows the model down'],
    answer: 1,
    why: 'Every filter has false positives. A blocked customer is a quiet failure. Measure both kinds of error and layer defences instead.',
  },
  'bug-reranker': {
    q: 'Recall was high but answers were wrong. Why?',
    options: ['The reranker kept only one chunk, often not the one, or not both, that the question needed', 'Keyword search returned too much', 'The model was too small'],
    answer: 0,
    why: 'Retrieval found it; the reranker threw it away. What reaches the model matters more than what retrieval found.',
  },
  'bug-thinking': {
    q: 'Thinking was set to high on every request. What did it buy?',
    options: ['Much better answers on easy questions', 'Little extra quality, and much more cost and waiting', 'Faster answers'],
    answer: 1,
    why: 'Reasoning tokens are billed and waited for. On simple questions they add almost nothing. Use them where the problem is hard.',
  },
  'leaked-key': {
    q: "Per-user limits were on. Why didn't they stop the leaked key?",
    options: ['They were set too high', 'The scripts spread calls over many accounts, and limits only cap each known account', 'Limits only work on paid plans'],
    answer: 1,
    why: 'Limits answer "how much may this user do?". Auth answers "may you call at all?". A leaked key needs auth, and provider keys belong on your server.',
  },
  'why-did-it-say': {
    q: 'Which traces should you keep to debug wrong answers without a huge bill?',
    options: ['A random 1% of requests', 'Every failure plus a small sample of the rest, with the prompt text', 'Only timings, never the text'],
    answer: 1,
    why: "The failures are what you debug, so keep them all. Random samples usually miss them, and without the text you can't see why an answer was wrong.",
  },
  'average-looks-fine': {
    q: 'Overall accuracy was good. How did one group still get much worse answers?',
    options: ['They asked harder questions', 'English-only embeddings matched their questions poorly, and the average hid it', 'The model refuses other languages'],
    answer: 1,
    why: 'Measure quality per group, not just overall. Here retrieval failed for questions in other languages, and a multilingual embedding model closed the gap.',
  },
  'boss-launch': {
    q: "With several problems at once, what's the best way to work?",
    options: ['Add every component, then tune', 'Fix the biggest problem, rerun, and see what the biggest problem is now', 'Start with the cheapest fix'],
    answer: 1,
    why: "Fixes interact. Working on whatever is the biggest problem right now, then rechecking, avoids paying for components that don't help.",
  },
  'boss-pilot': {
    q: "Why add evals first in a pilot whose quality you can't see?",
    options: ['Evals are the cheapest component', "Without measurement you can't tell whether any other change helped", 'The bank requires them'],
    answer: 1,
    why: 'Measure, then change. Otherwise every other fix is a guess.',
  },
  'boss-outage': {
    q: 'Which fix helps with stale figures?',
    options: ['Failover to a second provider', 'JSON mode', 'Refreshing the index on change'],
    answer: 2,
    why: 'Each layer answers a different problem: failover for outages, structured output for parsing, a fresh index for truth.',
  },
  'boss-scale': {
    q: 'Which change helped the most with cost for the overnight work?',
    options: ['A batch queue', 'A PII redactor', 'Raising temperature'],
    answer: 0,
    why: 'Work nobody is waiting on can run at batch prices and off the live rate limit.',
  },
  'boss-agent': {
    q: 'Which layer stops a hijacked agent from actually sending something?',
    options: ['Per-user limits', 'Approval before external actions', 'Low temperature'],
    answer: 1,
    why: 'You assume some injected instructions will get through. Requiring approval for send, pay and delete limits what they can do.',
  },
  'boss-ship': {
    q: "Your traces store prompts. What else must be true before that's safe?",
    options: ['Traces must be sampled at 1%', 'Personal data is redacted before it reaches the trace store', 'Traces are kept for under a day'],
    answer: 1,
    why: 'Your logs are a third-party system too. Redact personal data before anything leaves, including on its way to tracing.',
  },
  'boss-bugs': {
    q: "Wrong, slow and expensive at once. What's the fastest way to find the causes?",
    options: ['Reset everything to defaults', 'Read individual failed and slow requests: different symptoms usually have different causes', 'Swap in a bigger model'],
    answer: 1,
    why: 'Averages blur three bugs into one bad number. Single requests show which component each failure came from.',
  },
};
