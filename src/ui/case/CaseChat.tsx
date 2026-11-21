import type { CaseFile } from '../../engine/levels/kit';

/** The false claim, marked so it's the one thing the eye lands on. */
function WithLie({ text, lie }: { text: string; lie?: string }) {
  const at = lie ? text.indexOf(lie) : -1;
  if (!lie || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="transcript-lie">{lie}</mark>
      {text.slice(at + lie.length)}
    </>
  );
}

/**
 * One customer exchange as a short transcript. Before the fix: the bot's reply with the false claim
 * marked, and what's actually true. After: the same question, answered right.
 */
export function CaseChat({ chat, fixed = false, compact = false }: { chat: CaseFile['chat']; fixed?: boolean; compact?: boolean }) {
  return (
    <div className={`transcript${compact ? ' is-compact' : ''}${fixed ? ' is-fixed' : ''}`}>
      <dl>
        <div className="transcript-row">
          <dt>{chat.userLabel ?? 'Customer'}</dt>
          <dd>{chat.user}</dd>
        </div>
        {fixed && chat.sent && (
          <div className="transcript-row is-sent">
            <dt>Provider saw</dt>
            <dd>{chat.sent}</dd>
          </div>
        )}
        <div className="transcript-row">
          <dt>Your bot</dt>
          <dd>{fixed ? chat.fixed : <WithLie text={chat.bot} lie={chat.lie} />}</dd>
        </div>
        {!fixed && (
          <div className="transcript-row is-truth">
            <dt>{chat.truthLabel ?? 'Actually'}</dt>
            <dd>
              {chat.truth}
              {chat.source && <span className="transcript-source"> ({chat.source})</span>}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
