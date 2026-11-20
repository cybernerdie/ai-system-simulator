import {
  BookOpen,
  CircleQuestionMark,
  Code,
  Command as CommandIcon,
  ExternalLink,
  GitCompareArrows,
  Link2,
  Moon,
  Music2,
  Pause,
  PencilRuler,
  Play,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PATTERNS, type Pattern } from '../engine/patterns';
import type { Scenario } from '../engine/levels/scenarios';
import { BrandMark } from './BrandMark';
import { MoreMenu } from './MoreMenu';
import { ScenarioTrigger } from './dialogs/ScenarioPicker';

const REPO = 'https://github.com/cybernerdie/ai-system-simulator';

export interface TrafficControls {
  rps: number;
  setRps: (n: number) => void;
  pattern: Pattern;
  setPattern: (p: Pattern) => void;
  /** Requests per second actually offered this tick, when the pattern varies it. */
  offered: number | null;
  simTime: number;
  /** On a level the traffic is fixed: shown, not changed. */
  locked?: boolean;
}

export interface TopBarActions {
  openLevels: () => void;
  reset: () => void;
  share: () => void;
  compare: () => void;
  learn: () => void;
  toggleTheme: () => void;
  toggleSfx: () => void;
  toggleVoiceMenu: (anchor: DOMRect) => void;
  commands: () => void;
  tour: () => void;
  toggleRun: () => void;
  /** Present only in the sandbox. */
  makeLevel?: () => void;
}

interface Props {
  scenario: Scenario;
  tag: string;
  title: string;
  /** In an embed: a static title, no tools, and a link out to the full game. */
  embedLink?: string;
  traffic: TrafficControls;
  running: boolean;
  pinned: boolean;
  theme: 'light' | 'dark';
  sfx: boolean;
  voice: boolean;
  voiceMenuOpen: boolean;
  actions: TopBarActions;
}

export function TopBar({ scenario, tag, title, embedLink, traffic, running, pinned, theme, sfx, voice, voiceMenuOpen, actions }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <span>AISim</span>
      </div>
      <span className="topbar-divider" aria-hidden />
      {embedLink ? (
        <span className="scenario-trigger is-static">
          <span className="scenario-trigger-num">{tag}</span>
          <span className="scenario-trigger-title">{title}</span>
        </span>
      ) : (
        <ScenarioTrigger scenario={scenario} tag={tag} onOpen={actions.openLevels} />
      )}
      {!embedLink && <TrafficBar {...traffic} />}
      <div className="topbar-spacer" />
      <div className="topbar-tools">
        {embedLink ? (
          <a className="btn btn-ghost btn-icon" href={embedLink} target="_blank" rel="noreferrer" title="Open the full game in a new tab">
            <ExternalLink size={15} aria-hidden />
            <span>Open AISim</span>
          </a>
        ) : (
          <>
            {actions.makeLevel && (
              <button className="btn btn-ghost btn-icon" onClick={actions.makeLevel} title="Turn this sandbox into a level others can play">
                <PencilRuler size={15} aria-hidden />
                <span>Make a level</span>
              </button>
            )}
            <button className="btn btn-ghost btn-icon" data-tour="reset" onClick={actions.reset} title="Reset scenario">
              <RotateCcw size={15} aria-hidden />
              <span>Reset</span>
            </button>
            <button className="btn btn-ghost btn-icon" data-tour="share" onClick={actions.share} title="Copy a link to this design">
              <Link2 size={15} aria-hidden />
              <span>Share</span>
            </button>
            <button
              className={`btn btn-ghost btn-icon${pinned ? ' is-pinned' : ''}`}
              data-tour="compare"
              onClick={actions.compare}
              title={pinned ? 'Compare the pinned design with this one' : 'Pin this design, then change it and compare'}
            >
              <GitCompareArrows size={15} aria-hidden />
              <span>{pinned ? 'Compare' : 'Pin'}</span>
            </button>
            <button className="btn btn-ghost btn-icon" data-tour="learn" onClick={actions.learn} title="Lessons and glossary">
              <BookOpen size={15} aria-hidden />
              <span>Learn</span>
            </button>
            <button
              className={`btn btn-ghost theme-toggle${voice ? '' : ' is-off'}`}
              onClick={(e) => actions.toggleVoiceMenu(e.currentTarget.getBoundingClientRect())}
              title="Voice guide: on/off, choose a voice, speed"
              aria-label="Voice guide settings"
              aria-expanded={voiceMenuOpen}
            >
              {voice ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            </button>
            <MoreMenu
              items={[
                { label: theme === 'dark' ? 'Light mode' : 'Dark mode', icon: theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />, onSelect: actions.toggleTheme },
                { label: 'Sound effects', icon: <Music2 size={15} />, onSelect: actions.toggleSfx, checked: sfx },
                { label: 'Commands and shortcuts', icon: <CommandIcon size={15} />, onSelect: actions.commands, keys: '/', keysOnly: true },
                { label: 'Take the tour', icon: <CircleQuestionMark size={15} />, onSelect: actions.tour },
                { label: 'Source code on GitHub', icon: <Code size={15} />, href: REPO },
              ]}
            />
          </>
        )}
      </div>
      <span className="topbar-divider" aria-hidden />
      <button className={`btn btn-primary btn-run${running ? ' is-running' : ''}`} onClick={actions.toggleRun}>
        {running ? <Pause size={14} fill="currentColor" aria-hidden /> : <Play size={14} fill="currentColor" aria-hidden />}
        {running ? 'Pause' : 'Run'}
        <kbd className="only-keys">Space</kbd>
      </button>
    </header>
  );
}

function TrafficBar({ rps, setRps, pattern, setPattern, offered, simTime, locked }: TrafficControls) {
  if (locked)
    return (
      <div className="traffic is-locked" title="Set by this level: the traffic is part of the problem">
        <span className="traffic-rate">
          <span>Traffic</span>
          <output>{offered ?? rps} req/s</output>
        </span>
      </div>
    );
  return (
    <div className="traffic">
      <label className="traffic-rate">
        <span>Traffic</span>
        <input type="range" min={1} max={150} value={rps} onChange={(e) => setRps(Number(e.target.value))} aria-label="Base requests per second" />
        <output>{offered ?? rps} req/s</output>
      </label>
      <span className="traffic-sep" aria-hidden />
      <label className="traffic-pattern" title={PATTERNS[pattern].help}>
        <span className="sr-only">Traffic pattern</span>
        <select value={pattern} onChange={(e) => setPattern(e.target.value as Pattern)}>
          {(Object.keys(PATTERNS) as Pattern[]).map((p) => (
            <option key={p} value={p}>
              {PATTERNS[p].label}
            </option>
          ))}
        </select>
      </label>
      {pattern !== 'steady' && <span className="sim-clock">t={simTime}s</span>}
    </div>
  );
}
