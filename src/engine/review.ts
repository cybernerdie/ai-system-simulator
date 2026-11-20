/**
 * Design review: a graded, written critique of a design, computed entirely from the simulation.
 * No model is called. Every note points at something measured:
 *  - why requests failed (the engine records a cause for each one),
 *  - what each component is worth (re-run the design without it and see what moves),
 *  - settings that cost more than they help on this traffic,
 *  - how it compares with the level's reference design.
 */
import { CAUSE_TEXT, simulate } from './simulate';
import { PRESSURES, goalMet } from './pressures';
import { removeAndHeal } from './autowire';
import { COMPONENTS } from './components';
import { withDefaults, type Scenario } from './levels/scenarios';
import type { Cause, ComponentType, Goal, GoalMetric, Metrics, SimGraph, SimNode, TrafficProfile } from './types';
import { money, monthlyCost } from './cost';

export type NoteTone = 'good' | 'warn' | 'bad';

export interface ReviewNote {
  tone: NoteTone;
  title: string;
  text: string;
  /** the component the note is about, so the UI can point at it */
  nodeId?: string;
}

export type ScoreKey = 'quality' | 'cost' | 'speed' | 'safety' | 'simplicity';

export interface ReviewScore {
  key: ScoreKey;
  label: string;
  score: number;
  note: string;
}

export interface Review {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  summary: string;
  goalsMet: number;
  goalsTotal: number;
  scores: ReviewScore[];
  notes: ReviewNote[];
}

const SEED = 101;
const SAMPLES = 3000;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pts = (v: number) => `${Math.round(Math.abs(v) * 100)} pts`;
const usd = (v: number) => `$${v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v)}`;
const sec = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const nameOf = (n: SimNode) => COMPONENTS[n.type].name;

const MODELS: ComponentType[] = ['llm', 'gpu_llm'];

function run(g: SimGraph, t: TrafficProfile, samples = SAMPLES) {
  return simulate(g, t, { seed: SEED, samples });
}

/** What removing one component does, in the numbers that matter for this level. */
interface Ablation {
  node: SimNode;
  without: Metrics;
}

function ablate(graph: SimGraph, traffic: TrafficProfile, base: Metrics): Ablation[] {
  const active = new Set(base.activeNodeIds);
  const models = graph.nodes.filter((n) => MODELS.includes(n.type)).length;
  return graph.nodes
    .filter((n) => n.type !== 'users' && active.has(n.id) && !(MODELS.includes(n.type) && models === 1))
    .map((node) => ({
      node,
      without: run({ nodes: graph.nodes.filter((x) => x.id !== node.id), edges: removeAndHeal(graph.edges, node.id) }, traffic),
    }));
}

/** How much worse things get without a component (positive = it was helping). */
function harmWithout(base: Metrics, w: Metrics, goals: Goal[]) {
  const quality = base.accuracy - w.accuracy + (w.hallucination - base.hallucination) * 0.5;
  const safety = w.injection - base.injection + (w.harmfulActions - base.harmfulActions) * 20 + (w.piiLeak - base.piiLeak) * 2;
  const errors = w.errorRate - base.errorRate;
  const brokenGoals = goals.filter((g) => goalMet(base, g) && !goalMet(w, g));
  return { quality, safety, errors, brokenGoals, costSaved: base.costPer1k - w.costPer1k, timeSaved: base.p50 - w.p50 };
}

function describeLoss(base: Metrics, w: Metrics, broken: Goal[]): string {
  const g = broken[0];
  const show: Partial<Record<GoalMetric, (m: Metrics) => string>> = {
    accuracy: (m) => pct(m.accuracy),
    hallucination: (m) => pct(m.hallucination),
    injection: (m) => pct(m.injection),
    errorRate: (m) => pct(m.errorRate),
    costPer1k: (m) => usd(m.costPer1k),
    p50: (m) => sec(m.p50),
    ttftP50: (m) => sec(m.ttftP50),
    piiLeak: (m) => pct(m.piiLeak),
    harmfulActions: (m) => `${(m.harmfulActions * 100).toFixed(2)}%`,
    evalGap: (m) => pts(m.evalGap),
    diagnoseHours: (m) => `${m.diagnoseHours}h`,
    fairnessGap: (m) => (m.fairnessVisible ? pts(m.fairnessGap) : 'unmeasured'),
  };
  const label: Partial<Record<GoalMetric, string>> = {
    accuracy: 'accuracy',
    hallucination: 'made-up answers',
    injection: 'successful attacks',
    errorRate: 'errors',
    costPer1k: 'cost per 1k',
    p50: 'typical response time',
    ttftP50: 'time to first word',
    piiLeak: 'personal data leaked',
    harmfulActions: 'hijacked actions',
    evalGap: 'eval error',
    diagnoseHours: 'time to find a bug',
    fairnessGap: 'the gap between user groups',
  };
  const plural = new Set<GoalMetric>(['hallucination', 'injection', 'errorRate', 'harmfulActions']);
  if (g && show[g.metric]) return `without it, ${label[g.metric]} ${plural.has(g.metric) ? 'go' : 'goes'} from ${show[g.metric]!(base)} to ${show[g.metric]!(w)}`;
  if (base.accuracy - w.accuracy >= 0.02) return `without it, accuracy drops from ${pct(base.accuracy)} to ${pct(w.accuracy)}`;
  if (w.injection - base.injection >= 0.02) return `without it, successful attacks rise from ${pct(base.injection)} to ${pct(w.injection)}`;
  if (w.errorRate - base.errorRate >= 0.005) return `without it, errors rise from ${pct(base.errorRate)} to ${pct(w.errorRate)}`;
  if (w.costPer1k > base.costPer1k * 1.2) return `without it, cost rises from ${usd(base.costPer1k)} to ${usd(w.costPer1k)} per 1k requests`;
  return 'without it, the numbers get worse';
}

const has = (g: SimGraph, t: ComponentType) => g.nodes.some((n) => n.type === t);

/** Settings that are costing more than they help, given this traffic. */
function settingSmells(g: SimGraph, t: TrafficProfile, m: Metrics): ReviewNote[] {
  const out: ReviewNote[] = [];
  for (const n of g.nodes) {
    const c = n.config;
    if (n.type === 'llm') {
      if ((c.thinking === 'high' || c.thinking === 'low') && t.easyShare >= 0.6 && !has(g, 'router'))
        out.push({
          tone: 'warn',
          nodeId: n.id,
          title: 'Thinking on every request',
          text: `${pct(t.easyShare)} of requests are easy, but every one pays for reasoning tokens and waits for them. Turn thinking off, or put a Model Router in front so only hard questions get it.`,
        });
      if (typeof c.temperature === 'number' && c.temperature > 0.5 && (t.extractShare ?? 0) + (t.structuredShare ?? 0) >= 0.3)
        out.push({
          tone: 'warn',
          nodeId: n.id,
          title: 'High temperature on one-right-answer work',
          text: `Temperature is ${c.temperature} while ${pct((t.extractShare ?? 0) + (t.structuredShare ?? 0))} of requests extract values or need exact JSON. The same input can come back different. Run near 0 for this kind of work.`,
        });
      if (c.version === 'latest')
        out.push({
          tone: 'warn',
          nodeId: n.id,
          title: 'Unpinned model version',
          text: 'This model follows "latest", so the provider can change it under you without warning. Pin a dated version and upgrade on purpose, after your evals pass.',
        });
    }
    if (n.type === 'agent' && c.permissions === 'send' && (t.sendShare ?? 0) > 0 && !has(g, 'action_approval'))
      out.push({
        tone: (t.poisonShare ?? 0) > 0 ? 'bad' : 'warn',
        nodeId: n.id,
        title: 'Agent can send without a check',
        text: 'The agent can send things outside on its own. If anything it reads carries hidden instructions, nothing stops it. Add Action Approval, or narrow its permissions.',
      });
    if (n.type === 'agent' && typeof c.maxSteps === 'number' && c.maxSteps > 12 && (m.causes.agent_loop ?? 0) > 0)
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: 'Generous step cap',
        text: `The agent may take up to ${c.maxSteps} steps, so a stuck run burns that many paid calls. Cap it just above what real tasks need.`,
      });
    if (n.type === 'semantic_cache' && typeof c.threshold === 'number' && c.threshold < 0.86)
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: 'Loose cache threshold',
        text: `At ${c.threshold}, questions that only look alike count as the same. Raise it until wrong-answer hits stop.`,
      });
    if (n.type === 'input_guard' && typeof c.strictness === 'number' && c.strictness > 0.9)
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: 'Guard set to maximum',
        text: 'This strict, it rejects ordinary customers too. Pair a moderate setting with an Output Judge instead.',
      });
    if (n.type === 'reranker' && typeof c.keep === 'number' && c.keep <= 2 && t.kbShare > 0)
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: 'Reranker keeps very little',
        text: `Only ${c.keep} chunk${c.keep === 1 ? '' : 's'} reach the model, so a wrong first pick or a two-part question fails. Three to five is usually right.`,
      });
    if (n.type === 'memory' && c.strategy === 'full' && (t.chatTurns ?? 0) > 8)
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: 'Resending the whole conversation',
        text: `Conversations run about ${t.chatTurns} turns, and every message pays for all of them again. A summary or long-term memory keeps cost flat.`,
      });
    if (n.type === 'eval_harness' && (c.testSet === 'easy' || c.judge === 'llm'))
      out.push({
        tone: 'warn',
        nodeId: n.id,
        title: "Evals you can't fully trust",
        text: `${c.testSet === 'easy' ? 'The test set is a few hand-picked examples, not real traffic. ' : ''}${c.judge === 'llm' ? 'The judge is an unchecked LLM, which is easy to fool. ' : ''}Your dashboard will look better than reality.`,
      });
  }
  return out;
}

export function reviewDesign(s: Scenario, graph: SimGraph, traffic: TrafficProfile, goals: Goal[]): Review {
  const m = run(graph, traffic, 4000);
  const notes: ReviewNote[] = [];
  const met = goals.filter((g) => goalMet(m, g));
  const missed = goals.filter((g) => !goalMet(m, g));
  const ref = s.solution.nodes.length
    ? run(
        {
          nodes: s.solution.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })),
          edges: s.solution.edges,
        },
        traffic,
        4000,
      )
    : null;
  const refParts = s.solution.nodes.filter((n) => n.type !== 'users').length;
  const parts = graph.nodes.filter((n) => n.type !== 'users').length;

  if (m.noModel) {
    return {
      grade: 'F',
      score: 0,
      summary: 'Nothing reaches a model, so no request gets an answer. Connect Users to an LLM first.',
      goalsMet: 0,
      goalsTotal: goals.length,
      scores: [],
      notes: [{ tone: 'bad', title: 'No path to a model', text: 'Draw a connection from Users through your components to an LLM.' }],
    };
  }

  /* ---- why requests failed ---- */
  const N = 4000;
  // a passing design still has some failures; show those as room to improve, not as problems
  const passing = goals.length > 0 && missed.length === 0;
  const causes = (Object.entries(m.causes) as [Cause, number][]).filter(([, n]) => n / N >= (passing ? 0.06 : 0.04)).sort((a, b) => b[1] - a[1]);
  for (const [cause, n] of causes.slice(0, passing ? 2 : 3)) {
    const p = PRESSURES[cause];
    notes.push({
      tone: !passing && n / N >= 0.08 ? 'bad' : 'warn',
      title: passing ? `Still failing: ${pct(n / N)} of requests, ${p.title.toLowerCase()}` : `${pct(n / N)} of requests: ${p.title.toLowerCase()}`,
      text: `${CAUSE_TEXT[cause]} ${p.try}`,
    });
  }

  /* ---- every missed goal gets a note, even when its failures are a small share of all traffic ---- */
  const GOAL_PRESSURE: Partial<Record<GoalMetric, keyof typeof PRESSURES>> = {
    injection: 'injection',
    harmfulActions: 'indirect_injection',
    piiLeak: 'pii_leak',
    costPer1k: 'cost',
    p50: 'latency',
    ttftP50: 'ttft',
    evalGap: 'eval_blindspot',
    diagnoseHours: 'no_traces',
    fairnessGap: m.fairnessVisible ? 'language_gap' : 'blind_cohort',
  };
  const noted = new Set(notes.map((n) => n.title));
  for (const g of missed) {
    const key = GOAL_PRESSURE[g.metric];
    if (!key) continue;
    const p = PRESSURES[key];
    if ([...noted].some((t) => t.toLowerCase().includes(p.title.toLowerCase()))) continue;
    notes.push({ tone: 'bad', title: `Goal missed: ${p.title.toLowerCase()}`, text: `${p.why} ${p.try}` });
    noted.add(p.title);
  }

  /* ---- components that aren't connected ---- */
  const active = new Set(m.activeNodeIds);
  const idle = graph.nodes.filter((n) => n.type !== 'users' && !active.has(n.id));
  for (const n of idle)
    notes.push({
      tone: 'warn',
      nodeId: n.id,
      title: `${nameOf(n)} isn't connected`,
      text: "It isn't on any path from Users to a model, so it does nothing. Connect it or delete it.",
    });

  /* ---- what each component is worth ---- */
  const abl = ablate(graph, traffic, run(graph, traffic));
  const base = run(graph, traffic);
  const worth = abl.map((a) => ({ a, h: harmWithout(base, a.without, goals) }));
  // models and evals are judged elsewhere: a model's worth shows in cost notes, evals' worth is visibility, not numbers
  const KEEP: ComponentType[] = ['llm', 'gpu_llm', 'eval_harness', 'tracing', 'fairness_eval'];
  const useless = worth.filter(
    // removing it must not hurt anything, including the bill and the wait
    ({ a, h }) =>
      !KEEP.includes(a.node.type) &&
      h.brokenGoals.length === 0 &&
      h.quality < 0.015 &&
      h.safety < 0.01 &&
      h.errors < 0.003 &&
      h.costSaved > -base.costPer1k * 0.03 &&
      h.timeSaved > -base.p50 * 0.05,
  );
  for (const { a, h } of useless.slice(0, 3)) {
    const saving =
      h.costSaved > base.costPer1k * 0.03 ? `, and saves ${usd(h.costSaved)} per 1k requests` : h.timeSaved > base.p50 * 0.03 ? `, and saves ${sec(h.timeSaved)} per request` : '';
    notes.push({
      tone: 'warn',
      nodeId: a.node.id,
      title: `${nameOf(a.node)} isn't pulling its weight`,
      text: `Removing it changes nothing measurable on this traffic${saving}. Delete it, or check whether this traffic needs it at all.`,
    });
  }
  const loadBearing = worth
    .filter(({ h }) => h.brokenGoals.length > 0 || h.quality >= 0.03 || h.safety >= 0.03 || h.errors >= 0.01 || -h.costSaved >= base.costPer1k * 0.25)
    .sort((x, y) => y.h.brokenGoals.length - x.h.brokenGoals.length || y.h.quality + y.h.safety + y.h.errors - (x.h.quality + x.h.safety + x.h.errors));
  // parts that only work together (an embedding model and its vector DB) say the same thing: one note for both
  const byText = new Map<string, SimNode[]>();
  for (const { a, h } of loadBearing) {
    const text = `${describeLoss(base, a.without, h.brokenGoals).replace(/^w/, 'W')}.`;
    byText.set(text, [...(byText.get(text) ?? []), a.node]);
  }
  for (const [text, ns] of [...byText].slice(0, 2)) {
    const names = ns.map(nameOf);
    const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    notes.push({
      tone: 'good',
      nodeId: ns[0].id,
      title: `${who} ${ns.length === 1 ? 'is' : 'are'} earning ${ns.length === 1 ? 'its' : 'their'} place`,
      text: ns.length > 1 ? text.replace('Without it,', 'Without either,') : text,
    });
  }

  /* ---- settings that work against this traffic ---- */
  notes.push(...settingSmells(graph, traffic, m));

  /* ---- where the money goes ---- */
  const spend = Object.entries(m.costByNode).sort((a, b) => b[1] - a[1]);
  const costGoal = goals.find((g) => g.metric === 'costPer1k');
  const pricey = (costGoal && !goalMet(m, costGoal)) || (ref && m.costPer1k > ref.costPer1k * 1.5);
  if (pricey && spend[0] && m.costPer1k > 0) {
    const n = graph.nodes.find((x) => x.id === spend[0][0]);
    const share = spend[0][1] / m.costPer1k;
    if (n && share >= 0.5)
      notes.push({
        tone: 'warn',
        nodeId: n.id,
        title: `${nameOf(n)} is ${pct(Math.min(1, share))} of your bill`,
        text: 'Cheaper options: a smaller model for easy requests (Model Router), caching repeats, prompt caching for long fixed prompts, or batch prices for work nobody waits on.',
      });
  }

  /* ---- against the reference design ---- */
  if (ref) {
    const ratio = m.costPer1k / Math.max(0.01, ref.costPer1k);
    if (ratio >= 1.5)
      notes.push({
        tone: 'warn',
        title: `${ratio.toFixed(1)}× the reference cost`,
        text: `You spend ${usd(m.costPer1k)} per 1k requests (about ${money(monthlyCost(m))} a month at this traffic); the reference design spends ${usd(ref.costPer1k)} (${money(monthlyCost(ref))} a month) with ${refParts} component${refParts === 1 ? '' : 's'}.`,
      });
    else if (ratio <= 0.9 && missed.length === 0)
      notes.push({ tone: 'good', title: 'Cheaper than the reference', text: `${usd(m.costPer1k)} per 1k requests against the reference design's ${usd(ref.costPer1k)}.` });
    if (parts < refParts && missed.length === 0)
      notes.push({ tone: 'good', title: 'Leaner than the reference', text: `${parts} components where the reference uses ${refParts}.` });
  }
  if (goals.length && missed.length === 0) notes.unshift({ tone: 'good', title: 'Every goal holds', text: `All ${goals.length} goals are met on this traffic.` });

  /* ---- scores ---- */
  const scores: ReviewScore[] = [];
  const accGoal = goals.find((g) => g.metric === 'accuracy')?.value ?? (ref ? Math.max(0.5, ref.accuracy - 0.03) : 0.8);
  if (m.answered > 0) {
    let q = (100 * m.accuracy) / accGoal;
    const halGoal = goals.find((g) => g.metric === 'hallucination');
    if (halGoal && !goalMet(m, halGoal)) q -= 15;
    if (!m.qualityVisible) q -= 10;
    scores.push({
      key: 'quality',
      label: 'Quality',
      score: clamp(q),
      note: `${pct(m.accuracy)} right${goals.some((g) => g.metric === 'accuracy') ? ` (goal ${pct(accGoal)})` : ''}, ${pct(m.hallucination)} made up${m.qualityVisible ? '' : ", and you can't see it without evals"}`,
    });
  }
  const costTarget = ref ? ref.costPer1k * 1.15 : costGoal?.value;
  if (costTarget)
    scores.push({
      key: 'cost',
      label: 'Cost',
      score: clamp((100 * costTarget) / Math.max(0.01, m.costPer1k)),
      note: `${usd(m.costPer1k)} per 1k requests, about ${money(monthlyCost(m))} a month at this traffic${ref ? `; reference ${usd(ref.costPer1k)}` : ''}`,
    });
  const p50Target = goals.find((g) => g.metric === 'p50')?.value ?? (ref ? ref.p50 * 1.25 : 6000);
  const ttftTarget = goals.find((g) => g.metric === 'ttftP50')?.value ?? (ref ? ref.ttftP50 * 1.25 : p50Target);
  const speed = Math.min((100 * p50Target) / Math.max(1, m.p50), (100 * ttftTarget) / Math.max(1, m.ttftP50)) - Math.min(60, m.errorRate * 600);
  scores.push({
    key: 'speed',
    label: 'Speed and reliability',
    score: clamp(speed),
    note: `${sec(m.p50)} typical, first words after ${sec(m.ttftP50)}, ${pct(m.errorRate)} errors`,
  });
  const threats = traffic.adversarialShare > 0 || (traffic.poisonShare ?? 0) > 0 || (traffic.piiShare ?? 0) > 0 || (traffic.abuseShare ?? 0) > 0;
  if (threats) {
    const sfty = 100 - m.injection * 300 - m.harmfulActions * 3000 - m.piiLeak * 200 - (m.abuseUnchecked ? 25 : 0);
    const parts2 = [
      traffic.adversarialShare > 0 && `${pct(m.injection)} of attacks worked`,
      (traffic.poisonShare ?? 0) > 0 && `${(m.harmfulActions * 100).toFixed(2)}% hijacked actions`,
      (traffic.piiShare ?? 0) > 0 && `${pct(m.piiLeak)} personal data leaked`,
      m.abuseUnchecked && 'abusers unchecked',
    ].filter(Boolean);
    scores.push({ key: 'safety', label: 'Safety', score: clamp(sfty), note: parts2.join(', ') });
  }
  const simplicity = 100 - Math.max(0, parts - (refParts || parts)) * 12 - idle.length * 15 - useless.length * 10;
  scores.push({
    key: 'simplicity',
    label: 'Simplicity',
    score: clamp(simplicity),
    note: `${parts} component${parts === 1 ? '' : 's'}${refParts ? `, reference ${refParts}` : ''}${idle.length ? `, ${idle.length} unconnected` : ''}${useless.length ? `, ${useless.length} not needed` : ''}`,
  });
  // it's easy to be cheap and simple when the system isn't doing its job yet
  const doingItsJob = !goals.some((g) => !goalMet(m, g) && g.metric !== 'costPer1k' && g.metric !== 'p50' && g.metric !== 'ttftP50');
  if (!doingItsJob)
    for (const sc of scores)
      if ((sc.key === 'cost' || sc.key === 'simplicity') && sc.score > 60) {
        sc.score = 60;
        sc.note += ". Easy while it isn't doing its job yet";
      }

  let score = Math.round(scores.reduce((a, x) => a + x.score, 0) / Math.max(1, scores.length));
  // a design that misses goals can't grade above C
  if (missed.length) score = Math.min(score, 69 - Math.min(20, (missed.length - 1) * 10) - (met.length === 0 ? 10 : 0));
  const grade: Review['grade'] = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  const worst = notes.find((n) => n.tone === 'bad') ?? notes.find((n) => n.tone === 'warn');
  const summary = !goals.length
    ? worst
      ? `Biggest thing to look at: ${worst.title.toLowerCase()}.`
      : 'No obvious problems on this traffic.'
    : missed.length
      ? `${met.length} of ${goals.length} goals met.${worst ? ` Start with: ${worst.title.toLowerCase()}.` : ''}`
      : grade === 'A'
        ? 'Every goal holds, at a sensible cost, with nothing wasted.'
        : `Every goal holds.${worst ? ` Room to improve: ${worst.title.toLowerCase()}.` : ''}`;

  const order: Record<NoteTone, number> = { bad: 0, warn: 1, good: 2 };
  notes.sort((a, b) => order[a.tone] - order[b.tone]);
  return { grade, score, summary, goalsMet: met.length, goalsTotal: goals.length, scores, notes: notes.slice(0, 9) };
}
