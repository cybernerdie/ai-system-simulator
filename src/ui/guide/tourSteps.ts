import { SCENARIOS } from '../../engine/levels/scenarios';
import { LESSONS, TERMS } from '../../content/learn';
import type { TourStep } from './Tour';
import type { Tab } from '../panels/SidePanel';

/** The guided tour of the interface. Steps can switch tabs or start the run as they open. */
export function tourSteps({ setTab, run }: { setTab: (t: Tab) => void; run: () => void }): TourStep[] {
  return [
    {
      target: '.scenario-trigger',
      title: 'Pick a scenario',
      body: `Each scenario is a broken AI system with a real-world story behind it. Open this to browse all ${SCENARIOS.length}, search them, or jump into the sandbox to build anything.`,
    },
    {
      target: '.side',
      title: 'Your mission',
      body: "The brief tells the story. The goals are what you have to hit, like accuracy of at least 80% or cost under a set amount per 1,000 requests. Stuck? There's a hint at the bottom.",
      onEnter: () => setTab('mission'),
    },
    {
      target: '.react-flow__node-sim',
      title: "The system you're fixing",
      body: "Requests flow left to right, from your users to the model. Click a component to tune its settings, drag from a node's right dot to connect it to the next one, and press Delete to remove it.",
    },
    {
      target: '.palette',
      title: 'Components',
      body: 'Everything you can add: retrieval, memory, agents, self-hosted models, caches, guardrails, evals and more. Click one or drag it onto the canvas. Each one fixes some problems and causes others.',
    },
    {
      target: '.btn-run',
      title: 'Run it',
      body: "This sends traffic through your design. We've started it for you. Press Space any time to pause or resume.",
      onEnter: run,
    },
    {
      target: '.traffic',
      title: 'Traffic',
      body: 'How many requests per second hit your system. On a level it is set for you, because the load is part of the problem. In the sandbox you can change it and its shape (spikes, a daily wave, a slow ramp) to see what breaks first.',
    },
    {
      target: '.pressure-window',
      title: 'The binding pressure',
      body: 'The most important panel. It names the one limit hurting your system right now, explains why in plain words, and suggests what to try. Fix it, and the next pressure shows up.',
    },
    {
      target: '.telemetry',
      title: 'Live numbers',
      body: "Quality (accuracy, hallucination, recall, injection) and load (errors, latency, cost), updating as traffic flows. Red means a goal isn't met yet. Hold every goal for a few seconds to clear the scenario.",
    },
    {
      target: '.side',
      title: 'Follow single requests',
      body: 'The Requests tab shows individual requests: each step they went through, how long it took, and why some failed. Click one to light up its path on the canvas.',
      onEnter: () => setTab('requests'),
    },
    {
      target: '[data-tour="learn"]',
      title: 'Learn as you go',
      body: `${LESSONS.length} short lessons that start from zero and build up to agents and inference, plus a plain-English glossary of ${TERMS.length} terms. Every component links to its glossary entry.`,
      onEnter: () => setTab('mission'),
    },
    {
      target: '[data-tour="reset"], [data-tour="share"], [data-tour="more"]',
      title: 'Share, reset, replay',
      body: 'Share copies a link to your exact design. Reset puts the scenario back to how it started. Dark mode, sound and this tour are under More. Your progress is saved in this browser.',
    },
  ];
}
