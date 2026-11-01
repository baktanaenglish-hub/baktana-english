/**
 * Line icons for the phone-call screen, adapted from Lucide (https://lucide.dev, ISC licence).
 * They inherit the text colour (`currentColor`) and are hidden from screen readers – the buttons
 * that hold them carry the Hebrew label.
 */
import type { ReactNode } from 'react';

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`call-icon${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const SPEAKER =
  'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z';

export const MicIcon = () => (
  <Icon>
    <path d="M12 19v3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <rect x="9" y="2" width="6" height="13" rx="3" />
  </Icon>
);

/** "Stop talking" while the microphone listens. */
export const StopIcon = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </Icon>
);

export const SpeakerIcon = () => (
  <Icon>
    <path d={SPEAKER} />
    <path d="M16 9a5 5 0 0 1 0 6" />
    <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </Icon>
);

export const SpeakerOffIcon = () => (
  <Icon>
    <path d={SPEAKER} />
    <path d="M22 9l-6 6" />
    <path d="M16 9l6 6" />
  </Icon>
);

export const KeyboardIcon = () => (
  <Icon>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
  </Icon>
);

/** "How do you say…?" – a Hebrew word in, English out. */
export const TranslateIcon = () => (
  <Icon>
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </Icon>
);

/** A handset; the hang-up button turns it upside down. */
export const PhoneIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
  </Icon>
);

export const SendIcon = () => (
  <Icon>
    <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
    <path d="M6 12h16" />
  </Icon>
);
