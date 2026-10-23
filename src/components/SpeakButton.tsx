import { canSpeak, speak } from '../lib/speech';

interface Props {
  text: string;
  slow?: boolean;
  big?: boolean;
}

export function SpeakButton({ text, slow = false, big = false }: Props) {
  if (!canSpeak) return null;
  return (
    <button
      type="button"
      className={`speak-btn${big ? ' big' : ''}${slow ? ' slow' : ''}`}
      onClick={() => speak(text, slow)}
      aria-label={slow ? 'השמעה איטית' : 'השמעה'}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
