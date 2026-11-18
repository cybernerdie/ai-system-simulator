# AISim: AI System Design Simulator

**Live demo: [ai-system-simulator.vercel.app](https://ai-system-simulator.vercel.app/)**

Build an AI system from parts, push real-shaped traffic through it, and watch which part breaks first. Then fix it and push harder.

The point isn't memorising components. It's learning to name the **binding pressure**: the one limit hurting your system right now.

AI systems fail in two ways at once:

- **Load**: rate limits (tokens per minute), latency, cost, context windows
- **Quality**: hallucinations, retrieval misses, prompt injection, runaway agents

AISim models both, so you can feel the trade-offs that make AI engineering different from classic system design.

## Scenarios

| # | Scenario | First wall | What you learn |
|---|----------|------------|----------------|
| 1 | The docs chatbot | Missing knowledge | RAG: grounding beats a bigger model |
| 2 | Confidently wrong RAG | Retrieval recall | Hybrid search, chunk size, reranking |
| 3 | Launch day | Tokens-per-minute limit | Semantic caching, model routing, cost per request |
| 4 | The support agent | No way to act | Agents, step budgets, runaway-loop cost |
| 5 | Someone pasted a jailbreak | Prompt injection | Layered guardrails and their false positives |
| 6 | The contract reviewer | Context window overflow | Context as a budget, reranking to fit small models |
| 7 | "It feels slow" | Time to first token | Streaming, and what silently breaks it |
| 8 | The chat that never ends | History bloat | Stateless models, conversation memory strategies |
| — | Sandbox | Whatever you hit | Free build with a mixed workload |

## Features

- **Binding pressure**: a live diagnosis of the one limit hurting your design most, with what to try next.
- **Telemetry dock**: accuracy, hallucination, recall, injection, errors, latency, time to first token and cost, with goal targets and trend lines.
- **Request inspector**: open the Requests tab, click any sampled request and follow it hop by hop (what each component did, how long it took, and why it failed). Its path lights up on the canvas.
- **Scenario picker**: cards with difficulty, the concepts each scenario teaches, and your progress (saved in your browser).
- **Learn**: a learning journey of 7 modules (Beginner → Advanced) and 13 short lessons in plain language, each linked to the scenario that practises it, with your reading progress saved. Plus a searchable glossary of 53 AI terms, each with a simple definition, an everyday analogy and why it matters. Every component's settings panel links to its glossary entry.
- **Share**: copies a link that encodes your whole design, so anyone can open and run it.

## Components

Users · Input Guardrail · Semantic Cache · Model Router · Conversation Memory (full / sliding window / rolling summary / long-term retrieval) · Embedding Model · Vector DB · Keyword Search (BM25) · Reranker · Agent Loop + Tools · LLM (small / medium / large, streaming) · Output Judge

## How to play

1. Pick a scenario and read the brief and goals.
2. Press **Run** (or Space). The metrics bar and the **Binding pressure** panel update live.
3. Add components from the left, then drag from a node's right dot to the next node to connect them. Click a node to tune it.
4. Hold every goal for a few seconds to clear the scenario.

## How it works

No real models are called. The engine (`src/engine/simulate.ts`) is a deterministic Monte-Carlo model:

- Each tick samples ~1,500 requests from the scenario's **traffic profile**: how many need private knowledge, hinge on exact identifiers, need a tool, are adversarial, are easy, or are repeats.
- Only nodes on a path **Users → … → LLM** (plus anything after a live LLM, such as an output judge) take part.
- Each component changes a request's latency, cost and outcome. Examples:
  - Recall depends on top-K, chunk size and vector vs. keyword search.
  - Too many unranked chunks cause "lost in the middle" errors.
  - Agents multiply LLM calls, and ~10% of runs get stuck.
  - Tokens per minute are checked against each model's rate limit, producing 429s.
- Outcomes (correct, hallucinated, declined, blocked, injected, rate-limited, overflow) roll up into metrics, and `src/engine/pressures.ts` names the dominant failure cause against the scenario's goals.

The numbers are calibrated to be *directionally* right (relative prices, latencies, failure modes) so the lessons hold up in real systems. They're not benchmarks.

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # engine tests: every scenario starts broken and its reference solution wins
npm run tune    # prints metrics for each scenario's start vs. solution (handy when tuning)
npm run build   # static build in dist/
```

The build is a static site. It's deployed on Vercel (every push to `main` redeploys), and it works as-is on Cloudflare Pages, Netlify or GitHub Pages too (build command `npm run build`, output `dist`).

### Adding a scenario

Add an entry to `SCENARIOS` in `src/engine/scenarios.ts` with:

- a traffic profile
- goals
- a broken starting graph
- a hint and a lesson
- a `solution` graph

The test suite checks that the start fails and the solution clears every goal, so scenarios can't silently become unwinnable when the engine changes.

## Roadmap ideas

- More scenarios: long documents (context overflow), latency SLOs and streaming, multi-tenant rate limits, eval-driven prompt changes
- Request inspector: click a failed request to see its path and why it failed
- Charts over time and traffic spikes
- "Real mode": swap one node for a real embedding model or vector search over a sample corpus
- Shareable designs via URL

## Credits

Inspired by the [System Design Simulator](https://system-design-simulator.ishukpong418.workers.dev/) and its idea of naming the binding pressure.

Built by [Joshua Paul (cybernerdie)](https://joshuapaul.me).
