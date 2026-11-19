import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Volume2 } from 'lucide-react';
import { chosenVoice, isRecommended, listVoices, onVoicesChanged, previewVoice, setChosenVoice, setVoiceRate, voiceLang, voiceRate } from './voice';
import { useVoice } from './useVoice';

/* ---------- voice settings ---------- */

/** A small panel to turn the guide on or off, pick one of the device's voices, set the speed and hear a sample. */
/** "Google UK English Female" → "UK English Female · GB"; Android's "English Nigeria" already names its accent. */
function voiceLabel(v: SpeechSynthesisVoice) {
  const name = v.name
    .replace(/^(Microsoft|Google)\s/, '')
    .replace(/\s*[-–]\s*English.*$/i, '')
    .replace(/\s*Online\s*/, ' ')
    .trim();
  if (/^English\s/.test(name)) return name;
  const region = voiceLang(v).split('-')[1];
  return region ? `${name} · ${region}` : name;
}

export function VoiceMenu({ anchor, onClose }: { anchor: DOMRect | null; onClose: () => void }) {
  const [on, setOn] = useVoice();
  const [voices, setVoices] = useState(() => listVoices());
  const [name, setName] = useState(() => chosenVoice() || listVoices()[0]?.name || '');
  const [rate, setRate] = useState(() => voiceRate());
  const box = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onVoicesChanged(() => {
        const v = listVoices();
        setVoices(v);
        setName((n) => n || v[0]?.name || '');
      }),
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);
  const phone = window.innerWidth <= 900;
  const style: CSSProperties | undefined = anchor && !phone ? { top: anchor.bottom + 8, left: Math.min(Math.max(12, anchor.right - 300), window.innerWidth - 312) } : undefined;
  return (
    <div ref={box} className={`voice-menu${style ? '' : ' is-docked'}`} style={style} role="dialog" aria-label="Voice guide settings">
      <div className="voice-menu-head">
        <strong>Voice guide</strong>
        <label className="switch">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} aria-label="Voice guide on" />
          <span className="switch-track" aria-hidden />
        </label>
      </div>
      {voices.length ? (
        <>
          <label className="voice-field">
            <span>Voice</span>
            <select
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setChosenVoice(e.target.value);
                previewVoice(e.target.value);
              }}
            >
              {voices.map((v, i) => (
                <option key={v.name + v.lang} value={v.name}>
                  {voiceLabel(v)}
                  {i === 0 && isRecommended(v) ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="voice-field">
            <span>
              Speed <em>{rate.toFixed(1)}×</em>
            </span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.1}
              value={rate}
              onChange={(e) => {
                setRate(Number(e.target.value));
                setVoiceRate(Number(e.target.value));
              }}
              onPointerUp={() => previewVoice(name)}
            />
          </label>
          <button className="btn btn-ghost voice-sample" onClick={() => previewVoice(name)}>
            <Volume2 size={14} aria-hidden /> Play a sample
          </button>
          <p className="voice-note">These are the voices your device offers, so the list differs between phones and computers.</p>
        </>
      ) : (
        <p className="voice-note">This browser doesn't offer built-in voices. The guide's captions still show every message.</p>
      )}
    </div>
  );
}
