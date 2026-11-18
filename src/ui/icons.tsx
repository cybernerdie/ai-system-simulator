import {
  ArrowDownWideNarrow,
  Binary,
  Bot,
  Database,
  History,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Split,
  TextSearch,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { COMPONENTS } from '../engine/components';
import type { ComponentType } from '../engine/types';

export const ICONS: Record<ComponentType, LucideIcon> = {
  users: Users,
  input_guard: ShieldCheck,
  semantic_cache: Zap,
  router: Split,
  embedding: Binary,
  vector_db: Database,
  keyword_search: TextSearch,
  reranker: ArrowDownWideNarrow,
  agent: Bot,
  llm: Sparkles,
  output_guard: ScanEye,
  memory: History,
};

export function KindIcon({ kind, size = 'md' }: { kind: ComponentType; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[kind];
  const px = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  return (
    <span className={`kind-icon kind-icon-${size}`} style={{ ['--kind' as string]: COMPONENTS[kind].color }} aria-hidden>
      <Icon size={px} strokeWidth={2.25} />
    </span>
  );
}
