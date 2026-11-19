/**
 * "Why you need it" for every component: the decision it makes, what breaks without it,
 * and how you'd notice in production. Shown in the component panel.
 */
import type { ComponentType } from '../engine/types';

export interface Why {
  /** the decision this component makes for every request */
  decides: string;
  /** what goes wrong without it */
  without: string;
  /** the number or signal that tells you it's missing or mis-set */
  notice: string;
}

export const WHY: Partial<Record<ComponentType, Why>> = {
  input_guard: {
    decides: 'Whether a message looks like an attack before the model reads it.',
    without: 'Jailbreaks and injected instructions reach the model, which often follows them.',
    notice: 'Injection success climbs. If you turn it up too far, real customers start getting "can\'t process that".',
  },
  semantic_cache: {
    decides: 'Whether a question is close enough to one already answered to reuse that answer.',
    without: 'Every repeat question pays for a full model call and waits for one.',
    notice: 'Cost and rate-limit pressure on busy, repetitive traffic. Set too loose, wrong answers to look-alike questions.',
  },
  router: {
    decides: 'Which model each request goes to: a small cheap one for easy questions, a strong one for hard ones.',
    without: 'Every request pays for your strongest model, or every request gets your weakest.',
    notice: 'Cost per request far above what easy questions need, or hard questions failing on a small model.',
  },
  memory: {
    decides: 'How much of the conversation the model is sent with each new message.',
    without: 'Either every message resends the whole chat (cost grows with every turn) or the model forgets.',
    notice: 'Tokens per call climbing over a conversation, or users repeating themselves.',
  },
  embedding: {
    decides: 'How a question is turned into a vector, so similar meaning lands close together.',
    without: 'Nothing can search your documents by meaning.',
    notice: 'Low recall on paraphrased questions; questions in other languages finding nothing when the model is English-only.',
  },
  vector_db: {
    decides: 'Which chunks of your documents are closest in meaning to the question, and how many to return.',
    without: "The model answers from memory, and invents what it doesn't know.",
    notice: 'Confident wrong answers about your own product. Recall is the number to watch.',
  },
  keyword_search: {
    decides: 'Which chunks contain the exact words: codes, part numbers, names.',
    without: 'Exact identifiers get lost, because embeddings match meaning, not strings.',
    notice: 'Recall drops on questions that hinge on a code or a name.',
  },
  reranker: {
    decides: 'Which few of the retrieved chunks actually reach the model.',
    without: 'The model gets every candidate: more tokens, more noise, answers buried in the middle.',
    notice: 'High recall but wrong answers, or prompts overflowing small models. Keep too few and the right chunk gets dropped.',
  },
  agent: {
    decides: 'Which tools to call, in what order, and when the task is done.',
    without: 'Anything that needs an action (look up an order, issue a refund) gets an invented answer.',
    notice: 'Tool requests failing. With a high step cap, stuck runs burning dozens of calls.',
  },
  agent_team: {
    decides: 'How a big task is split between workers, run in parallel and checked by a reviewer.',
    without: 'One agent does everything in sequence: slow, and it loses track of long tasks.',
    notice: 'Multi-part research slow and incomplete. Too many workers, and hand-offs drop details.',
  },
  llm: {
    decides: 'The answer: which model, how much it thinks, how random it is, what format it returns.',
    without: 'Nothing answers.',
    notice: 'Every quality, latency and cost number moves with its settings.',
  },
  gpu_llm: {
    decides: 'How your own GPUs serve the model: how many, how big a batch, what precision.',
    without: 'You pay per token to a provider, and your data leaves your systems.',
    notice: "GPUs idle and expensive at low traffic, or queues and timeouts when they're full.",
  },
  fallback: {
    decides: 'What happens when a call fails: retry, and whether to switch to another provider.',
    without: 'Every provider hiccup becomes an error for your user.',
    notice: "Error rate tracks your provider's status page. Retries alone make outages worse.",
  },
  output_guard: {
    decides: 'Whether an answer is supported by its sources and safe to show, before it ships.',
    without: 'Hallucinations and harmful output go straight to the user.',
    notice: 'Made-up answers reaching customers. It waits for the full answer, so streaming stops helping.',
  },
  validator: {
    decides: 'Whether the output matches the shape your code expects, and retries if not.',
    without: 'Malformed JSON crashes the code that reads it.',
    notice: 'Parse errors and 500s downstream of the model.',
  },
  eval_harness: {
    decides: 'How good the answers are, measured on a test set and a sample of live traffic.',
    without: "You can't see quality at all; changes ship on gut feel.",
    notice: 'You only hear about wrong answers from support tickets. A weak test set or judge makes the dashboard lie.',
  },
  tracing: {
    decides: 'Which requests are recorded step by step, and whether the text is kept.',
    without: "A complaint about a wrong answer can't be explained; debugging is guesswork.",
    notice: 'Bugs take days to diagnose. Storing prompts unredacted puts personal data in your logs.',
  },
  fairness_eval: {
    decides: 'How good the answers are for each group of users, not just on average.',
    without: 'A group served much worse stays hidden inside a good average.',
    notice: 'Escalations or churn concentrated in one language, region or plan while the overall score looks fine.',
  },
  batch_queue: {
    decides: 'Which work can wait, so it runs later at batch prices and off your live rate limit.',
    without: 'Background jobs compete with live users for the same capacity, at full price.',
    notice: 'Rate-limit errors during big jobs, and a bill full of work nobody was waiting for.',
  },
  pii_redactor: {
    decides: 'Which personal details are replaced with placeholders before anything leaves your systems.',
    without: 'Names, numbers and health details go to third parties: the model provider, and your logs.',
    notice: 'Personal data leaked is above zero. Compliance asks where customer data goes.',
  },
  content_sanitizer: {
    decides: 'That anything the system reads (emails, pages, tool results) is treated as data, not instructions.',
    without: 'Hidden instructions inside content can steer the agent.',
    notice: 'Agents doing things nobody asked for after reading external content.',
  },
  action_approval: {
    decides: 'Which actions need a person to confirm before they happen: send, pay, delete.',
    without: 'A single hijacked request can send, pay or delete on its own.',
    notice: 'Hijacked actions above zero. The cost is a little friction on legitimate sends.',
  },
  user_limits: {
    decides: 'How much each known account may use per minute.',
    without: 'One script can take the capacity and budget everyone else needs.',
    notice: 'A few accounts dominating traffic and cost; real users getting rate-limited.',
  },
  auth: {
    decides: 'Whether a caller has valid credentials at all, before anything costs money.',
    without: 'Anyone with your endpoint (or a key shipped in your app) uses your models on your bill.',
    notice: "Traffic and cost rising with no matching growth in real users. Per-user limits don't catch callers rotating accounts.",
  },
  stt: {
    decides: 'How speech becomes text, and whether it starts while the user is still talking.',
    without: "Voice input can't be understood.",
    notice: 'Seconds of silence before a voice reply when it waits for the whole clip.',
  },
  tts: {
    decides: 'How the answer becomes speech, and whether it starts speaking before the answer is finished.',
    without: 'Voice users get nothing back.',
    notice: 'Long gaps before the first word of a spoken reply.',
  },
};
