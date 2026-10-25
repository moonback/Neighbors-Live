/** Control characters (except tab/newline), DEL, zero-width and bidi-override code points. */
const isStripped = (cp: number): boolean =>
  (cp < 0x20 && cp !== 0x09 && cp !== 0x0a) ||
  cp === 0x7f ||
  (cp >= 0x200b && cp <= 0x200f) ||
  (cp >= 0x202a && cp <= 0x202e) ||
  (cp >= 0x2066 && cp <= 0x2069);

/**
 * Normalises user text before storage: removes control / bidi-override characters, collapses
 * runs of spaces, limits blank lines. Output is plain text; HTML escaping happens at render time.
 */
export function sanitizeText(input: string): string {
  return Array.from(input.normalize('NFC'))
    .filter((ch) => !isStripped(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
