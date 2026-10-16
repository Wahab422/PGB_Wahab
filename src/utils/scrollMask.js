/**
 * Shared by the scroll-scrubbed square masks — the project CTA section
 * (animations/projectCta.js) and the project panel's "more projects" block
 * (animations/moreProject.js): an image opening out of a small centred square.
 */

export const DEFAULT_SQUARE = '30%';
export const FULL_CLIP = 'inset(0px 0px 0px 0px round 0px)';

/** "30%" → 30% of the shorter side; "240px" / "240" → px. */
export function resolveSide(value, width, height) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0) return resolveSide(DEFAULT_SQUARE, width, height);
  return String(value).trim().endsWith('%') ? (Math.min(width, height) * amount) / 100 : amount;
}

/** A scrub attribute: true (follow the scroll exactly) or seconds of catch-up. */
export function readScrub(value) {
  if (value === null || value === '' || value === 'true') return true;
  if (value === 'false') return false;
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) ? seconds : true;
}

/**
 * The centred square's insets on `el` (px), from its layout size — offset*
 * ignores transforms, so a scaled element is measured in its own units, as
 * its clip-path is.
 */
export function squareInsets(el, size) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const side = Math.min(resolveSide(size, width, height), width, height);
  return { y: (height - side) / 2, x: (width - side) / 2 };
}
