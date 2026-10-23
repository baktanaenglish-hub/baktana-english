import { useEffect, useId, useState } from 'react';
import type { Persona, PersonaId } from '../../../shared/call';

/**
 * The face of a call character. Characters with photos (PHOTO_PERSONAS) are animated from frames
 * of the same picture; the others, and any whose photos fail to load, are drawn as an illustrated
 * portrait. Both breathe and blink, and move their mouth while `talking`.
 */
interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  iris: string;
  lips: string;
}

const LOOKS: Record<PersonaId, Look> = {
  teacher: { skin: '#f3cfae', skinShade: '#e3b38f', hair: '#7a4a2a', iris: '#4a7a3a', lips: '#c4646c' },
  friend: { skin: '#e2ae84', skinShade: '#cd946a', hair: '#2b1d17', iris: '#5a3a22', lips: '#b9555f' },
  barista: { skin: '#a8714a', skinShade: '#8f5d3b', hair: '#1f1612', iris: '#3a2416', lips: '#8a4a42' },
  interviewer: { skin: '#f0c7a2', skinShade: '#dcad86', hair: '#8a6a45', iris: '#3d5f8a', lips: '#b8706a' },
};

interface Props {
  persona: Persona;
  talking?: boolean;
  className?: string;
}

/**
 * Characters with photo frames in public/personas/<id>-<frame>.webp: the same picture with the
 * mouth closed (idle) or open (talk) and, when `blinks`, the eyes closed for each (blink,
 * blink-talk).
 */
const PHOTO_PERSONAS: Partial<Record<PersonaId, { blinks: boolean }>> = {
  teacher: { blinks: true },
  friend: { blinks: false },
  barista: { blinks: true },
  interviewer: { blinks: true },
};
const FRAMES = ['idle', 'talk', 'blink', 'blink-talk'] as const;
type Frame = (typeof FRAMES)[number];

export function PersonaPortrait(props: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = PHOTO_PERSONAS[props.persona.id];
  if (photo && !photoFailed) {
    return <PhotoPortrait {...props} blinks={photo.blinks} onError={() => setPhotoFailed(true)} />;
  }
  return <IllustratedPortrait {...props} />;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function PhotoPortrait({
  persona,
  talking = false,
  className,
  blinks,
  onError,
}: Props & { blinks: boolean; onError: () => void }) {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const still = reducedMotion();

  // While talking, open and close the mouth at an uneven, speech-like rhythm.
  useEffect(() => {
    if (!talking || still) return;
    let open = false;
    let timer = 0;
    const step = () => {
      open = !open;
      setMouthOpen(open);
      timer = window.setTimeout(step, open ? 110 + Math.random() * 140 : 70 + Math.random() * 120);
    };
    timer = window.setTimeout(step, 60);
    return () => {
      window.clearTimeout(timer);
      setMouthOpen(false);
    };
  }, [talking, still]);

  // Blink every few seconds.
  useEffect(() => {
    if (still || !blinks) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setBlinking(true);
          timer = window.setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 140);
        },
        2500 + Math.random() * 3500,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [still, blinks]);

  const open = talking && (still || mouthOpen);
  const frame: Frame = blinking ? (open ? 'blink-talk' : 'blink') : open ? 'talk' : 'idle';
  return (
    <div
      className={`portrait photo${talking ? ' talking' : ''}${className ? ` ${className}` : ''}`}
      style={{ background: persona.color }}
      aria-hidden="true"
    >
      <div className="pp-photo">
        {(blinks ? FRAMES : FRAMES.slice(0, 2)).map((f) => (
          <img
            key={f}
            src={`${import.meta.env.BASE_URL}personas/${persona.id}-${f}.webp`}
            alt=""
            draggable={false}
            decoding="async"
            className={f === 'idle' || f === frame ? 'on' : undefined}
            onError={f === 'idle' ? onError : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function IllustratedPortrait({ persona, talking = false, className }: Props) {
  const clip = useId();
  const look = LOOKS[persona.id];
  return (
    <svg
      viewBox="0 0 200 200"
      className={`portrait${talking ? ' talking' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
        <radialGradient id={`${clip}-bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="200" height="200" fill={persona.color} />
        <rect width="200" height="200" fill={`url(#${clip}-bg)`} />
        <g className="pp-figure">
          <HairBack id={persona.id} look={look} />
          <Outfit id={persona.id} />
          <rect x="88" y="122" width="24" height="36" rx="10" fill={look.skinShade} />
          <g className="pp-head">
            <ellipse cx="60" cy="96" rx="7" ry="10" fill={look.skinShade} />
            <ellipse cx="140" cy="96" rx="7" ry="10" fill={look.skinShade} />
            <ellipse cx="100" cy="92" rx="40" ry="47" fill={look.skin} />
            <HairFront id={persona.id} look={look} />
            <Brows id={persona.id} look={look} />
            <Eye cx={84} look={look} />
            <Eye cx={116} look={look} />
            <path
              d="M100 96 Q96 107 99 110 Q102 111 105 108"
              fill="none"
              stroke={look.skinShade}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="72" cy="110" r="7" fill="#ff7f8f" opacity="0.22" />
            <circle cx="128" cy="110" r="7" fill="#ff7f8f" opacity="0.22" />
            {persona.id === 'barista' && <Beard look={look} />}
            <Mouth look={look} />
            {persona.id === 'teacher' && <Glasses />}
            {persona.id === 'friend' && <Earrings />}
          </g>
        </g>
      </g>
    </svg>
  );
}

function Eye({ cx, look }: { cx: number; look: Look }) {
  return (
    <g className="pp-eye">
      <ellipse cx={cx} cy="92" rx="7.5" ry="5.5" fill="#fff" />
      <circle cx={cx} cy="92" r="4.2" fill={look.iris} />
      <circle cx={cx} cy="92" r="2" fill="#1a1a1a" />
      <circle cx={cx + 1.4} cy="90.6" r="1.2" fill="#fff" />
    </g>
  );
}

function Mouth({ look }: { look: Look }) {
  return (
    <>
      <path
        className="pp-smile"
        d="M89 118 Q100 127 111 118"
        fill="none"
        stroke={look.lips}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="pp-mouth">
        <ellipse cx="100" cy="120" rx="10" ry="7" fill="#5e1f2a" />
        <path d="M91 117 Q100 113 109 117 L109 118.5 Q100 115.5 91 118.5 Z" fill="#fff" />
        <ellipse cx="100" cy="124" rx="5" ry="2.2" fill="#d06a76" />
        <ellipse cx="100" cy="120" rx="10" ry="7" fill="none" stroke={look.lips} strokeWidth="2.5" />
      </g>
    </>
  );
}

function Brows({ id, look }: { id: PersonaId; look: Look }) {
  const w = id === 'barista' || id === 'interviewer' ? 3.6 : 2.8;
  return (
    <g className="pp-brows" stroke={look.hair} strokeWidth={w} strokeLinecap="round" fill="none">
      <path d="M76 81 Q84 77 92 80" />
      <path d="M108 80 Q116 77 124 81" />
    </g>
  );
}

function HairBack({ id, look }: { id: PersonaId; look: Look }) {
  switch (id) {
    case 'teacher':
      // A chin-length bob.
      return (
        <path
          d="M52 96 C46 14 154 14 148 96 L150 128 C142 136 128 134 124 126 L124 100 L76 100 L76 126 C72 134 58 136 50 128 Z"
          fill={look.hair}
        />
      );
    case 'friend':
      // Long hair past the shoulders.
      return (
        <path
          d="M52 94 C42 12 158 12 148 94 L158 180 C142 192 122 186 118 174 L118 120 L82 120 L82 174 C78 186 58 192 42 180 Z"
          fill={look.hair}
        />
      );
    default:
      return null;
  }
}

function HairFront({ id, look }: { id: PersonaId; look: Look }) {
  switch (id) {
    case 'teacher':
      return <path d="M58 92 C52 20 148 18 142 90 C132 70 110 62 90 66 C78 70 66 78 58 92 Z" fill={look.hair} />;
    case 'friend':
      return (
        <>
          <path d="M58 94 C52 18 148 18 142 94 C136 74 118 62 100 66 C82 62 64 74 58 94 Z" fill={look.hair} />
          <path d="M100 40 C99 50 99 58 100 66" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
        </>
      );
    case 'barista':
      // Short curls.
      return (
        <g fill={look.hair}>
          <path d="M60 84 C58 54 142 54 140 84 C130 70 70 70 60 84 Z" />
          {[64, 76, 88, 100, 112, 124, 136].map((x, i) => (
            <circle key={x} cx={x} cy={i % 2 ? 54 : 60} r="11" />
          ))}
          {[70, 84, 100, 116, 130].map((x) => (
            <circle key={`b${x}`} cx={x} cy="47" r="10" />
          ))}
        </g>
      );
    case 'interviewer':
      // Short, neat, parted on the side.
      return (
        <path
          d="M60 90 C54 26 146 24 140 88 C138 72 128 64 112 62 C94 60 76 64 66 74 C62 80 60 86 60 90 Z"
          fill={look.hair}
        />
      );
  }
}

function Outfit({ id }: { id: PersonaId }) {
  const shoulders = 'M24 200 C26 170 58 152 100 152 C142 152 174 170 176 200 Z';
  switch (id) {
    case 'teacher':
      // A cardigan over a white blouse.
      return (
        <>
          <path d={shoulders} fill="#2f5fb8" />
          <path d="M80 153 L100 200 L120 153 C112 151 88 151 80 153 Z" fill="#fdfbf7" />
          <path d="M86 152 L100 166 L114 152" fill="none" stroke="#d9d4cc" strokeWidth="2" />
          <circle cx="100" cy="180" r="2" fill="#d9d4cc" />
          <circle cx="100" cy="192" r="2" fill="#d9d4cc" />
        </>
      );
    case 'friend':
      // A hoodie.
      return (
        <>
          <path d={shoulders} fill="#e85d8f" />
          <path
            d="M72 158 C82 172 118 172 128 158"
            fill="none"
            stroke="#c9437a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M92 168 L90 190 M108 168 L110 190" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'barista':
      // A light shirt with an apron.
      return (
        <>
          <path d={shoulders} fill="#ece6dc" />
          <path d="M70 200 L74 168 L126 168 L130 200 Z" fill="#6d4a2f" />
          <path d="M80 168 L88 152 M120 168 L112 152" stroke="#6d4a2f" strokeWidth="5" strokeLinecap="round" />
          <rect x="88" y="178" width="24" height="12" rx="3" fill="#5a3c25" />
        </>
      );
    case 'interviewer':
      // A suit and tie.
      return (
        <>
          <path d={shoulders} fill="#26344f" />
          <path d="M84 152 L100 186 L116 152 C110 150 90 150 84 152 Z" fill="#f6f7fb" />
          <path d="M96.5 158 L103.5 158 L106 184 L100 192 L94 184 Z" fill="#2f8a5f" />
          <path d="M95 152 L100 160 L105 152 Z" fill="#2f8a5f" />
          <path d="M84 152 L96 178 L84 172 L78 158 Z M116 152 L104 178 L116 172 L122 158 Z" fill="#1c2840" />
        </>
      );
  }
}

function Beard({ look }: { look: Look }) {
  return (
    <g fill={look.hair}>
      <path
        d="M62 100 C62 132 80 142 100 142 C120 142 138 132 138 100 C134 120 122 130 100 130 C78 130 66 120 62 100 Z"
        opacity="0.9"
      />
      <path d="M86 113 Q100 107 114 113 Q108 116 100 115 Q92 116 86 113 Z" />
    </g>
  );
}

function Glasses() {
  return (
    <g fill="none" stroke="#3a2a22" strokeWidth="2.5">
      <rect x="72" y="84" width="24" height="17" rx="7" />
      <rect x="104" y="84" width="24" height="17" rx="7" />
      <path d="M96 91 Q100 88 104 91 M72 90 L62 88 M128 90 L138 88" />
    </g>
  );
}

function Earrings() {
  return (
    <g fill="none" stroke="#f2c14e" strokeWidth="2.5">
      <circle cx="59" cy="110" r="5" />
      <circle cx="141" cy="110" r="5" />
    </g>
  );
}
