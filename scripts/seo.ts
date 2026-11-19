/**
 * Build-time SEO / GEO / AEO.
 *
 * The app is a client-rendered SPA, and most AI crawlers (and some search
 * crawlers) don't run JavaScript. So at build time we:
 *  - put the real content (scenarios, lessons, glossary, FAQ) into index.html
 *    as plain semantic HTML inside #root. React replaces it on mount, and a
 *    tiny inline script hides it for JS users so there's no flash.
 *  - add meta, Open Graph, Twitter and JSON-LD structured data
 *    (WebApplication, Course, FAQPage, DefinedTermSet).
 *  - emit robots.txt, sitemap.xml, llms.txt and llms-full.txt.
 */
import type { Plugin } from 'vite';
import { LESSONS, MODULES, TERMS, type Lesson } from '../src/content/learn';
import { SCENARIOS } from '../src/engine/scenarios';

export const SITE = 'https://ai-system-simulator.vercel.app';
const REPO = 'https://github.com/cybernerdie/ai-system-simulator';
const NAME = 'AISim';
const TITLE = 'AISim: AI System Design Simulator. Learn AI engineering by breaking things';
const SCENARIO_COUNT = SCENARIOS.filter((s) => s.difficulty > 0).length;
const DESCRIPTION = `A free, interactive simulator for learning AI system design. Build RAG pipelines, agents and LLM apps from parts, push realistic traffic through them, and learn to fix rate limits, hallucinations, latency, cost and more. ${SCENARIO_COUNT} scenarios, ${LESSONS.length} lessons and a ${TERMS.length}-term glossary in plain English.`;
const OG_IMAGE = `${SITE}/og.png`;
const AUTHOR = {
  '@type': 'Person',
  '@id': 'https://joshuapaul.me/#person',
  name: 'Joshua Paul',
  alternateName: 'cybernerdie',
  url: 'https://joshuapaul.me',
  jobTitle: 'Senior Fullstack and Applied AI Engineer',
  sameAs: ['https://github.com/cybernerdie', 'https://medium.com/@cybernerdie'],
};
const AUTHOR_HTML = `Built by <a href="https://joshuapaul.me" rel="author">Joshua Paul</a> (<a href="https://github.com/cybernerdie">cybernerdie</a>).`;
const AUTHOR_MD = 'Built by [Joshua Paul](https://joshuapaul.me) ([cybernerdie](https://github.com/cybernerdie) on GitHub).';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is AISim?',
    a: 'AISim is a free, browser-based simulator for learning how to design AI systems. You build an AI app from parts (models, vector databases, rerankers, guardrails, caches, agents), send realistic traffic through it, and see which part breaks first. No real models are called, and nothing to install.',
  },
  {
    q: 'What is binding pressure in AI system design?',
    a: 'Binding pressure is the single limit hurting your system right now: a rate limit, retrieval misses, prompt injection, latency, cost, a full context window, or GPU capacity. Fixing anything else doesn\'t help until that limit is relieved. AISim shows the binding pressure live and explains it in plain language.',
  },
  {
    q: 'Who is AISim for?',
    a: 'Software engineers moving into AI engineering, product managers and founders who want to understand how LLM apps behave in production, and anyone preparing for AI system design interviews. The lessons start from zero and build up to inference, agents and production reliability.',
  },
  {
    q: 'What topics does AISim cover?',
    a: 'Retrieval-augmented generation (RAG), chunking and hybrid search, reranking, conversation memory, rate limits and scaling, streaming and latency, caching, model routing, prompt injection (direct and indirect) and guardrails, agent permissions, temperature and sampling, evals and LLM-as-judge, self-hosted inference on GPUs, provider outages and failover, multi-agent systems, reasoning budgets, structured outputs, fine-tuning versus RAG, model version drift, privacy and PII, voice pipelines and per-user abuse limits.',
  },
  {
    q: 'When should I fine-tune a model instead of using RAG?',
    a: 'Use RAG for knowledge: facts and documents that change. Use fine-tuning for behaviour: your labels, output format, tone, or a narrow task repeated many times. A fine-tuned small model often beats a large general model on a narrow task at a fraction of the cost, but it should still get its facts from retrieval.',
  },
  {
    q: 'Why does my RAG chatbot give confidently wrong answers?',
    a: 'Usually retrieval is returning the wrong chunks: chunks that are too large or small, too few results (top-K), or pure vector search missing exact identifiers like product codes. Hybrid search (vector plus keyword/BM25), a reranker and better chunking fix most of it. AISim scenario 2, "Confidently wrong RAG", lets you try each fix.',
  },
  {
    q: 'Is AISim free and open source?',
    a: 'Yes. AISim is free to use in the browser and open source on GitHub. It was built by Joshua Paul (cybernerdie), a Senior Fullstack and Applied AI Engineer. Your progress is saved in your browser, and you can share any design you build as a link.',
  },
];

/* ---------------- helpers ---------------- */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const playable = SCENARIOS.filter((s) => s.difficulty > 0);
const lessonById = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<string, Lesson>;
const LEVEL = ['', 'Intro', 'Core', 'Advanced'];

function lessonHtml(l: Lesson): string {
  const body = l.blocks
    .map((b) => {
      if (b.kind === 'p') return `<p>${esc(b.text)}</p>`;
      if (b.kind === 'list') return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      if (b.kind === 'analogy') return `<p><strong>Think of it like this:</strong> ${esc(b.text)}</p>`;
      return `<p><strong>Takeaway:</strong> ${esc(b.text)}</p>`;
    })
    .join('');
  return `<article id="lesson-${l.id}"><h4>${esc(l.title)}</h4><p><em>${esc(l.summary)}</em></p>${body}</article>`;
}

function lessonMd(l: Lesson): string {
  const body = l.blocks
    .map((b) => {
      if (b.kind === 'p') return b.text;
      if (b.kind === 'list') return b.items.map((i) => `- ${i}`).join('\n');
      if (b.kind === 'analogy') return `**Think of it like this:** ${b.text}`;
      return `**Takeaway:** ${b.text}`;
    })
    .join('\n\n');
  return `### ${l.title}\n\n_${l.summary}_\n\n${body}`;
}

/* ---------------- static HTML for crawlers ---------------- */

function staticBody(): string {
  const scenarios = playable
    .map(
      (s) => `<li id="scenario-${s.id}"><h3>${esc(s.title)}</h3><p><strong>${esc(s.tagline)}</strong> ${esc(s.brief)}</p><p>Level: ${LEVEL[s.difficulty]}. Concepts: ${esc(s.skills.join(', '))}.</p><p>What you learn: ${esc(s.lesson)}</p></li>`,
    )
    .join('');
  const modules = MODULES.map(
    (m, i) =>
      `<section><h3>Module ${i + 1}: ${esc(m.title)} (${m.level})</h3><p>${esc(m.blurb)}</p>${m.lessons
        .map((id) => lessonById[id])
        .filter(Boolean)
        .map(lessonHtml)
        .join('')}</section>`,
  ).join('');
  const glossary = TERMS.map(
    (t) =>
      `<dt id="term-${t.id}">${esc(t.term)}${t.aka ? ` (${esc(t.aka)})` : ''}</dt><dd>${esc(t.simple)}${t.analogy ? ` Analogy: ${esc(t.analogy)}` : ''}${t.why ? ` Why it matters: ${esc(t.why)}` : ''}</dd>`,
  ).join('');
  const faq = FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('');

  return `<main class="seo-static">
<header><h1>AISim: AI System Design Simulator</h1>
<p>${esc(DESCRIPTION)}</p>
<p>The point isn't memorising components. It's learning to name the <strong>binding pressure</strong>: the one limit hurting your system right now. AI systems fail in two ways at once: load (rate limits, latency, cost, context windows) and quality (hallucinations, retrieval misses, prompt injection, runaway agents). AISim models both.</p>
<p>This interactive simulator needs JavaScript. <a href="${REPO}">Source code on GitHub</a>.</p><p>${AUTHOR_HTML}</p></header>
<section><h2>Frequently asked questions</h2>${faq}</section>
<section><h2>Scenarios (${playable.length})</h2><ol>${scenarios}</ol></section>
<section><h2>Learn AI system design: ${MODULES.length} modules, ${LESSONS.length} lessons</h2>${modules}</section>
<section><h2>AI glossary in plain English (${TERMS.length} terms)</h2><dl>${glossary}</dl></section>
</main>`;
}

/* ---------------- head tags + JSON-LD ---------------- */

function jsonLd(): string {
  const graph = [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: NAME, description: DESCRIPTION, inLanguage: 'en', author: AUTHOR, publisher: AUTHOR },
    {
      '@type': 'WebApplication',
      '@id': `${SITE}/#app`,
      name: 'AISim: AI System Design Simulator',
      url: `${SITE}/`,
      description: DESCRIPTION,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      image: OG_IMAGE,
      screenshot: OG_IMAGE,
      author: AUTHOR,
      codeRepository: REPO,
      featureList: [
        `${playable.length} hands-on AI system design scenarios`,
        `${LESSONS.length} plain-English lessons in ${MODULES.length} modules`,
        `${TERMS.length}-term AI glossary`,
        'Live binding-pressure analysis',
        'Request inspector and shareable designs',
      ],
    },
    {
      '@type': 'Course',
      '@id': `${SITE}/#course`,
      name: 'AI system design, from simple to complex',
      description:
        'A free, self-paced learning journey through AI engineering: foundations, RAG, memory, reliability, production, inference, agents, safety and evals, each lesson paired with a hands-on simulator scenario.',
      provider: AUTHOR,
      author: AUTHOR,
      isAccessibleForFree: true,
      inLanguage: 'en',
      educationalLevel: 'Beginner to Advanced',
      teaches: [...new Set(playable.flatMap((s) => s.skills))],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', category: 'Free' },
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: 'PT3H' },
      syllabusSections: MODULES.map((m) => ({ '@type': 'Syllabus', name: m.title, description: m.blurb })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE}/#faq`,
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@type': 'DefinedTermSet',
      '@id': `${SITE}/#glossary`,
      name: 'AI engineering glossary in plain English',
      hasDefinedTerm: TERMS.map((t) => ({
        '@type': 'DefinedTerm',
        '@id': `${SITE}/#term-${t.id}`,
        name: t.term,
        ...(t.aka ? { alternateName: t.aka } : {}),
        description: t.simple,
        inDefinedTermSet: `${SITE}/#glossary`,
      })),
    },
  ];
  // Escape "<" so no string can close the script tag.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function headTags(): string {
  return `
    <link rel="canonical" href="${SITE}/" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="author" content="Joshua Paul (cybernerdie)" />
    <link rel="author" href="https://joshuapaul.me" />
    <meta name="theme-color" content="#0b0b0f" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${NAME}" />
    <meta property="og:title" content="${esc(TITLE)}" />
    <meta property="og:description" content="${esc(DESCRIPTION)}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="AISim simulator in dark and light mode, showing a RAG pipeline hitting its GPU capacity limit" />
    <meta property="og:locale" content="en_GB" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(TITLE)}" />
    <meta name="twitter:description" content="${esc(DESCRIPTION)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <link rel="alternate" type="text/markdown" title="LLM-friendly summary" href="/llms.txt" />
    <script type="application/ld+json">${jsonLd()}</script>`;
}

/* ---------------- text files ---------------- */

function llmsTxt(): string {
  return `# ${NAME}: AI System Design Simulator

> ${DESCRIPTION}

AISim teaches AI engineering through hands-on scenarios. Each scenario starts with a broken AI system and a goal (accuracy, latency, cost, error rate...). The simulator shows the "binding pressure", the one limit hurting the system right now, and the learner adds or tunes components until every goal holds. It's free, runs in the browser, calls no real models, and is open source.

## Key pages

- [Simulator](${SITE}/): the interactive app (scenarios, Learn section, glossary)
- [Full content for LLMs](${SITE}/llms-full.txt): every scenario, lesson and glossary term as Markdown
- [Source code](${REPO})
- [Author: Joshua Paul](https://joshuapaul.me)

${AUTHOR_MD}

## Frequently asked questions

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Scenarios

${playable.map((s) => `- **${s.title}** (${LEVEL[s.difficulty]}): ${s.tagline} Teaches ${s.skills.join(', ')}.`).join('\n')}

## Learning modules

${MODULES.map((m, i) => `- **Module ${i + 1}: ${m.title}** (${m.level}): ${m.blurb} Lessons: ${m.lessons.map((id) => lessonById[id]?.title).filter(Boolean).join('; ')}.`).join('\n')}
`;
}

function llmsFullTxt(): string {
  return `# ${NAME}: AI System Design Simulator (full content)

> ${DESCRIPTION}

Source: ${SITE}/ · Code: ${REPO}

${AUTHOR_MD}

## Frequently asked questions

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Scenarios

${playable
  .map(
    (s) =>
      `### ${s.title}\n\n_${s.tagline}_\n\n${s.brief}\n\n- Level: ${LEVEL[s.difficulty]}\n- Concepts: ${s.skills.join(', ')}\n- Hint: ${s.hint}\n- What you learn: ${s.lesson}`,
  )
  .join('\n\n')}

## Lessons

${MODULES.map(
  (m, i) =>
    `## Module ${i + 1}: ${m.title} (${m.level})\n\n${m.blurb}\n\n${m.lessons
      .map((id) => lessonById[id])
      .filter(Boolean)
      .map(lessonMd)
      .join('\n\n')}`,
).join('\n\n')}

## Glossary

${TERMS.map(
  (t) =>
    `### ${t.term}${t.aka ? ` (${t.aka})` : ''}\n\n${t.simple}${t.analogy ? `\n\nAnalogy: ${t.analogy}` : ''}${t.why ? `\n\nWhy it matters: ${t.why}` : ''}`,
).join('\n\n')}
`;
}

const ROBOTS = `User-agent: *
Allow: /

# AI crawlers are welcome: this is free educational content.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

function sitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', '/llms.txt', '/llms-full.txt'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/* ---------------- plugin ---------------- */

export function seo(): Plugin {
  return {
    name: 'aisim-seo',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*<\/title>/, `<title>${esc(TITLE)}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(DESCRIPTION)}" />`)
        .replace('</head>', `${headTags()}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root">${staticBody()}</div>`);
    },
    generateBundle() {
      const files: Record<string, string> = {
        'robots.txt': ROBOTS,
        'sitemap.xml': sitemap(),
        'llms.txt': llmsTxt(),
        'llms-full.txt': llmsFullTxt(),
      };
      for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
