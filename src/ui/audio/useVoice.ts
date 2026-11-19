import { useEffect, useState } from 'react';
import { onVoiceChange, setVoice, voiceOn } from './voice';

/* ---------- voice toggle state ---------- */

export function useVoice(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(voiceOn());
  useEffect(() => onVoiceChange(setOn), []);
  return [on, setVoice];
}
