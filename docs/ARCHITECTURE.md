# Architecture

AISim is a static single-page app. There is no backend and no model is called: every number on screen comes from a deterministic simulation that runs in the browser.

## Layers

The source is split into six layers. Each may import only from the layers before it, and `src/architecture.test.ts` fails the build if that ever changes.

```
engine → content → lib → share → ui → app
```

| Layer | What lives there | Rules |
| --- | --- | --- |
| `engine/` | The simulation, components, pressures, levels, game modes (daily, incident, achievements), stars, unlocks, the design review | Pure TypeScript. No React, no DOM, no storage, so it runs the same in tests, scripts and the browser. |
| `content/` | Words: lessons and glossary, guide lines, quiz, "why you need it" cards | Data plus small pure helpers. |
| `lib/` | Persistence (`storage`, `progress`), the design link codec, formatting, analytics, clipboard | `storage.ts` is the only file that touches `localStorage`; everything saved goes through `progress.ts`, which validates what it reads. |
| `share/` | Player-made levels, share cards and the certificate | Encoding and verification are pure; drawing uses canvas. |
| `ui/` | React components: canvas, panels, dialogs, the guide, audio | Presentational. Components get data and callbacks through props and don't know about app state. |
| `app/` | `App.tsx` and its hooks: wiring state, the tick loop, routing | The only layer that holds application state. |

## The simulation

`engine/simulate.ts` samples about 1,500 requests per tick from the level's traffic profile and walks each one through the design: retrieval recall, context limits, guardrails, rate limits, agents, caches and so on. Each request ends with an outcome and, if it failed, a cause. Those roll up into metrics, and `engine/pressures.ts` names the one problem doing the most damage against the level's goals.

Randomness is seeded (mulberry32), so a design on given traffic always produces the same numbers. That is what makes the tests, the design review and the compare view meaningful: the review reruns the design without each component, and compare runs two designs on identical draws.

## The live loop

`app/hooks/useSimulation.ts` owns the run. Every 700 ms it simulates a tick, smooths the numbers so they settle instead of flickering, tracks how long the goals have held, and in incident mode advances the incident run. It doesn't reach into the rest of the app; it reports through events (`onGoalsHeld`, `onIncidentStarted`, `onIncidentOver`) and `App.tsx` decides what a win means: stars, saved progress, achievements.

The rest of the behaviour lives in focused hooks next to it:

- `useGuide`: the coached first level, the hint ladder when you're stuck, the voice, sound cues, the win celebration
- `useAchievements`: awards achievements as progress changes and queues their toasts
- `useCanvasFit`: keeps the diagram framed as the overlays around it resize, until the player pans or zooms
- `useShortcuts`, `useTheme`, `useToast`, `useStoredFlag`, `useMediaQuery`, `useAutoClear`

## Levels and URLs

Built-in levels are data in `engine/levels/`. `engine/catalog.ts` finds any level by id, including the daily (built from the date) and incident mode. `app/levels.ts` adds player-made levels, which arrive in a link (`/#l=<code>`), are verified (the author's design must win and the starting design must fail) and are remembered in the browser.

Numbered levels and bosses have their own URL, `/play/<id>`. At build time `scripts/seo.ts` writes a page per level with its own title, description and structured data, plus oEmbed files, so a shared link previews properly. `?embed=1` gives a stripped-down layout for iframes.

## Tests

- `engine/engine.test.ts`: every level's starting design fails and its reference solution clears every goal, so a change to the engine can't silently make a level unwinnable or trivial
- `engine/modes/modes.test.ts`: dailies are deterministic and winnable, every incident breaks the starting system but not a well-defended one, the catalog and level order, quiz, achievements and the design review
- `lib/progress.test.ts`: saved data from older versions still loads, and junk is rejected
- `share/customLevel.test.ts`: level links round-trip, unfair levels are refused and hostile values are clamped
- `content/learn.test.ts`: ids are unique and every cross-reference resolves
- `architecture.test.ts`: the layer rules above

## Performance

- The tick loop reads the latest design through refs, so editing doesn't restart it.
- Dialogs, the design review and the share-card drawing are split out (`ui/lazy.ts`) and load the first time they're opened. React, React Flow and the icons are separate chunks so they stay cached across deploys.
- Today's daily is built while the browser is idle, so opening it is instant.
