/**
 * The section an element belongs to, for animations that follow its section
 * scrolling away (src/animations/parallax.js, scrollFade.js): its closest
 * <section>, else its parent.
 */
export const sectionOf = (el) => el.closest('section') || el.parentElement;

/** A number from an attribute, or `fallback` when it's missing or not one. */
export function readNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}
