import { BookOpen, Check, X } from 'lucide-react';
import type { CaseFile } from '../../engine/levels/kit';

/**
 * One customer exchange. Before the fix: the bot's wrong answer and what's actually true.
 * After: the same question, answered right.
 */
export function CaseChat({ chat, fixed = false, compact = false }: { chat: CaseFile['chat']; fixed?: boolean; compact?: boolean }) {
  return (
    <div className={`case-chat${compact ? ' is-compact' : ''}`}>
      <div className="case-msg is-user">
        <span className="case-who">Customer</span>
        <p>{chat.user}</p>
      </div>
      <div className={`case-msg is-bot ${fixed ? 'is-right' : 'is-wrong'}`}>
        <span className="case-who">
          Your bot
          <span className="case-verdict">
            {fixed ? <Check size={11} strokeWidth={3} aria-hidden /> : <X size={11} strokeWidth={3} aria-hidden />}
            {fixed ? 'Right' : 'Wrong'}
          </span>
        </span>
        <p>{fixed ? chat.fixed : chat.bot}</p>
      </div>
      {!fixed && (
        <div className="case-truth">
          <BookOpen size={13} aria-hidden />
          <p>
            <strong>What's actually true: </strong>
            {chat.truth}
          </p>
        </div>
      )}
    </div>
  );
}
