/**
 * Text helpers for CMS / Rich Text content.
 */

// Zero-width characters editors (e.g. Google Docs) insert as placeholders:
// ZWSP, ZWNJ, ZWJ, BOM — built from escapes so the source stays ASCII-clean
// (literal zero-width characters are invisible). An alternation, not a
// [character class]: ZWJ inside a class is flagged by
// no-misleading-character-class (it can join the characters around it).
const ZERO_WIDTH = new RegExp('\\u200B|\\u200C|\\u200D|\\uFEFF', 'g');

/** The string without zero-width placeholder characters. */
export function stripZeroWidth(str) {
  return String(str ?? '').replace(ZERO_WIDTH, '');
}

/**
 * True when the string has no meaningful text once zero-width characters and
 * whitespace are stripped — e.g. the blank <li>s / <p>s Webflow leaves behind.
 */
export function isEmptyText(str) {
  return !stripZeroWidth(str).trim();
}
