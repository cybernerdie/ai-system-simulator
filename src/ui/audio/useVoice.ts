import { useEffect, useState } from 'react';
import { onVoiceChange, setVoice, voiceOn } from './voice';

/** Whether the voice guide is on, kept in step with every other place that can switch it. */
export function useVoice(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(voiceOn());
  useEffect(() => onVoiceChange(setOn), []);
  return [on, setVoice];
}
