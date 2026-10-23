import type { CSSProperties } from 'react';

/** Exposes a persona's accent colour to the stylesheet as `--persona`. */
export const personaStyle = (color: string) => ({ '--persona': color }) as CSSProperties;
