export interface RichPart {
  text: string;
  /** True for a `[[...]]` English fragment. */
  en: boolean;
}

/**
 * Splits Hebrew tip text into plain parts and `[[...]]` English fragments.
 * Punctuation written inside the brackets stays with the English fragment; an unclosed
 * `[[` is kept as plain text.
 */
export function parseRichTip(text: string): RichPart[] {
  const parts: RichPart[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), en: false });
    parts.push({ text: m[1], en: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), en: false });
  return parts;
}

interface Props {
  text: string;
  className?: string;
  /** Render as an inline <span> (e.g. inside a list item) instead of a paragraph. */
  inline?: boolean;
}

/** Short English fragments are kept on one line so a phrase never breaks across lines. */
const NOWRAP_MAX = 24;

/** Hebrew text with English fragments isolated left-to-right (unit intros and lesson tips). */
export function RichTip({ text, className, inline = false }: Props) {
  const Tag = inline ? 'span' : 'p';
  return (
    <Tag className={className ?? (inline ? undefined : 'rich-tip')}>
      {parseRichTip(text).map((part, i) =>
        part.en ? (
          <bdi key={i} dir="ltr" lang="en" className={part.text.length <= NOWRAP_MAX ? 'en nowrap' : 'en'}>
            {part.text}
          </bdi>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </Tag>
  );
}
