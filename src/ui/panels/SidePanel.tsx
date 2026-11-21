import type { Scenario } from '../../engine/levels/scenarios';
import type { ComponentType, ConfigValue, Metrics, NodeConfig, TrafficProfile } from '../../engine/types';
import { RequestsPanel, type Shown } from './Requests';
import { Inspector } from './Inspector';
import { Mission } from './Mission';

/* ---------- side panel ---------- */

export type Tab = 'mission' | 'requests' | 'component';

export function SidePanel({
  sheet,
  scenario,
  m,
  streak,
  needed,
  warnings,
  selected,
  onChange,
  onDelete,
  tab,
  setTab,
  running,
  picked,
  onPick,
  onLearn,
  traffic,
  onMix,
  onResetMix,
  onReview,
  onShowCase,
  onHint,
}: {
  onReview?: () => void;
  onShowCase?: () => void;
  onHint?: () => void;
  traffic: TrafficProfile;
  onMix: (patch: Partial<TrafficProfile>) => void;
  onResetMix: () => void;
  onLearn: (termId: string) => void;
  running: boolean;
  picked: Shown | null;
  onPick: (r: Shown | null) => void;
  scenario: Scenario;
  m: Metrics | null;
  streak: number;
  needed: number;
  warnings: string[];
  selected?: { id: string; kind: ComponentType; config: NodeConfig; hidden?: Set<string> | null };
  onChange: (id: string, key: string, v: ConfigValue) => void;
  onDelete: (id: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Phones: show the panel as a bottom sheet over the canvas (component settings) */
  sheet?: { open: boolean; onClose: () => void };
}) {
  return (
    <aside className={`side${sheet?.open ? ' is-sheet' : ''}`} aria-modal={sheet?.open || undefined} role={sheet?.open ? 'dialog' : undefined}>
      {sheet?.open && (
        <div className="sheet-bar">
          <span className="sheet-grip" aria-hidden />
          <button className="btn btn-ghost sheet-done" onClick={sheet.onClose}>
            Done
          </button>
        </div>
      )}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'mission'} onClick={() => setTab('mission')}>
          Mission
        </button>
        <button role="tab" aria-selected={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests
          {m && m.qualityVisible && m.samples.some((r) => r.outcome !== 'correct' && r.outcome !== 'blocked') && <span className="tab-dot" aria-hidden />}
        </button>
        <button role="tab" aria-selected={tab === 'component'} onClick={() => setTab('component')}>
          Component
        </button>
      </div>
      {tab === 'mission' ? (
        <Mission
          scenario={scenario}
          m={m}
          streak={streak}
          needed={needed}
          warnings={warnings}
          traffic={traffic}
          onMix={onMix}
          onResetMix={onResetMix}
          onReview={onReview}
          onShowCase={onShowCase}
          onHint={onHint}
        />
      ) : tab === 'requests' ? (
        <RequestsPanel samples={m?.samples ?? []} running={running} picked={picked} onPick={onPick} qualityVisible={m?.qualityVisible ?? true} />
      ) : selected ? (
        <Inspector {...selected} onChange={onChange} onDelete={onDelete} onLearn={onLearn} />
      ) : (
        <p className="side-empty">Select a component on the canvas to tune it.</p>
      )}
    </aside>
  );
}
