import { useEffect, useState } from 'react';
import { Blocks, Compass, Music2, Play, Volume2, VolumeX } from 'lucide-react';
import { onSfxChange, setSfx, sfxOn } from '../audio/sfx';
import { useVoice } from '../audio/useVoice';
import { VoiceMenu } from '../audio/VoiceMenu';

/* ---------- welcome screen ---------- */

export function WelcomeScreen({ onPlay, onBrowse, onFree, onClose }: { onPlay: () => void; onBrowse: () => void; onFree: () => void; onClose: () => void }) {
  const [voiceMenu, setVoiceMenu] = useState<DOMRect | null>(null);
  const [voice, set] = useVoice();
  const [sounds, setSounds] = useState(sfxOn());
  useEffect(() => onSfxChange(setSounds), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !voiceMenu) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, voiceMenu]);
  return (
    <div className="overlay welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome">
        {/* a 6-second loop of what playing looks like: broken → add a part → fixed */}
        <div className="demo" aria-hidden>
          <div className="demo-bubble">It made that up!</div>
          <div className="demo-row">
            <span className="wa-node">Users</span>
            <span className="wa-wire" />
            <span className="demo-slot">
              <span className="demo-q">?</span>
              <span className="demo-part">Vector DB</span>
            </span>
            <span className="wa-wire demo-wire2" />
            <span className="wa-node wa-llm">AI</span>
          </div>
          <div className="demo-metric">
            <span className="demo-bad">Accuracy 23%</span>
            <span className="demo-good">Accuracy 81% ✓</span>
          </div>
        </div>
        <h1 id="welcome-title">Learn how AI apps really work, by fixing broken ones.</h1>
        <p>
          Each level hands you an AI app with a real problem: it makes things up, falls over under load, gets tricked. Find the problem, fix it, watch the numbers turn green. No
          code, no setup.
        </p>
        <button className="btn btn-primary welcome-play" autoFocus onClick={onPlay}>
          <Play size={16} aria-hidden /> Play level 1 <span className="welcome-time">2 min</span>
        </button>
        <div className="welcome-toggles">
          <label className="welcome-voice">
            <input type="checkbox" checked={voice} onChange={(e) => set(e.target.checked)} />
            {voice ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            Voice guide
          </label>
          <button className="link-btn welcome-choose" onClick={(e) => setVoiceMenu(e.currentTarget.getBoundingClientRect())}>
            Choose voice
          </button>
          <label className="welcome-voice">
            <input type="checkbox" checked={sounds} onChange={(e) => setSfx(e.target.checked)} />
            <Music2 size={15} aria-hidden />
            Sound effects
          </label>
        </div>
        {voiceMenu && <VoiceMenu anchor={voiceMenu} onClose={() => setVoiceMenu(null)} />}
        <div className="welcome-alt">
          <button className="btn btn-ghost" onClick={onBrowse}>
            <Compass size={15} aria-hidden /> Choose a level
          </button>
          <button className="btn btn-ghost" onClick={onFree}>
            <Blocks size={15} aria-hidden /> Free build
          </button>
        </div>
      </div>
    </div>
  );
}
