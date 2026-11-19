import {  Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { COMPONENTS, PALETTE_ORDER } from '../../engine/components';
import type { ComponentType } from '../../engine/types';
import { KindIcon } from '../canvas/icons';

/* ---------- palette ---------- */

const GROUPS = ['Retrieval', 'Memory', 'Generation', 'Inference', 'Voice', 'Efficiency', 'Safety', 'Quality'] as const;

export function Palette({
  onAdd,
  locks,
  fresh,
  onLocked,
  collapsed,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onAdd: (t: ComponentType) => void;
  /** components not reached yet → the level that unlocks them */
  locks?: Map<ComponentType, number>;
  /** components that are new on this level */
  fresh?: Set<ComponentType>;
  onLocked?: (t: ComponentType, level: number) => void;
}) {
  return (
    <aside className="palette" aria-label="Components">
      {onToggleCollapsed && (
        <div className="palette-head">
          <span>Components</span>
          <button
            className="palette-collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand the component list' : 'Collapse the component list'}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
          </button>
        </div>
      )}
      {GROUPS.map((g) => {
        const items = PALETTE_ORDER.filter((t) => COMPONENTS[t].group === g);
        if (!items.length) return null;
        return (
          <section key={g}>
            <h3>{g}</h3>
            {items.map((t) => {
              const lockedAt = locks?.get(t);
              return (
                <button
                  key={t}
                  className={`palette-item${lockedAt ? ' is-locked' : ''}`}
                  data-palette={t}
                  draggable={!lockedAt}
                  aria-disabled={!!lockedAt}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/aisim', t);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => (lockedAt ? onLocked?.(t, lockedAt) : onAdd(t))}
                  title={lockedAt ? `${COMPONENTS[t].name}: unlocks in level ${lockedAt}` : `${COMPONENTS[t].name}: ${COMPONENTS[t].blurb}`}
                  aria-label={lockedAt ? `${COMPONENTS[t].name}, unlocks in level ${lockedAt}` : COMPONENTS[t].name}
                >
                  <KindIcon kind={t} size="sm" />
                  <span className="palette-name">{COMPONENTS[t].name}</span>
                  {lockedAt ? (
                    <em className="palette-lock" aria-label={`Unlocks in level ${lockedAt}`}>
                      <Lock size={11} aria-hidden /> {lockedAt}
                    </em>
                  ) : (
                    fresh?.has(t) && <em className="palette-new">New</em>
                  )}
                </button>
              );
            })}
          </section>
        );
      })}
      <p className="palette-help">Tap a component to add it: it connects itself where it belongs. You can also drag it, and rewire from a node's right edge. Locked ones open up as you clear levels.</p>
    </aside>
  );
}
