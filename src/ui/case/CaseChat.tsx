import { BookOpen, Bot, Check, User, X } from 'lucide-react';
import type { CaseFile } from '../../engine/levels/kit';

/** Wraps the first occurrence of `phrase` in a <mark>, so the eye lands on it first. */
function Marked({ text, phrase, tone }: { text: string; phrase?: string; tone: 'lie' | 'fact' }) {
  const at = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (!phrase || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={`case-mark is-${tone}`}>{text.slice(at, at + phrase.length)}</mark>
      {text.slice(at + phrase.length)}
    </>
  );
}

/**
 * One customer exchange, laid out like an escalated support ticket. Before the fix: the bot's reply
 * with the false claim marked, checked against the source. After: the same question, answered right.
 */
export function CaseChat({ chat, fixed = false, compact = false }: { chat: CaseFile['chat']; fixed?: boolean; compact?: boolean }) {
  return (
    <div className={`ticket${compact ? ' is-compact' : ''}`}>
      <div className="ticket-row">
        <span className="ticket-avatar" aria-hidden>
          <User size={compact ? 13 : 15} />
        </span>
        <div className="ticket-body">
          <p className="ticket-who">Customer</p>
          <p className="ticket-text">{chat.user}</p>
        </div>
      </div>
      <div className={`ticket-row is-bot ${fixed ? 'is-right' : 'is-wrong'}`}>
        <span className="ticket-avatar" aria-hidden>
          <Bot size={compact ? 13 : 15} />
        </span>
        <div className="ticket-body">
          <p className="ticket-who">
            Your bot
            <span className="ticket-badge">
              {fixed ? <Check size={11} strokeWidth={3} aria-hidden /> : <X size={11} strokeWidth={3} aria-hidden />}
              {fixed ? 'Correct' : 'Made up'}
            </span>
          </p>
          <p className="ticket-text">{fixed ? <Marked text={chat.fixed} phrase={chat.fact} tone="fact" /> : <Marked text={chat.bot} phrase={chat.lie} tone="lie" />}</p>
        </div>
      </div>
      {!fixed && (
        <div className="ticket-check">
          <p className="ticket-who">
            <BookOpen size={13} aria-hidden /> {chat.source ? `Checked against the ${chat.source}` : "What's actually true"}
          </p>
          <p className="ticket-text">
            <Marked text={chat.truth} phrase={chat.fact} tone="fact" />
          </p>
        </div>
      )}
    </div>
  );
}
