/**
 * Mask reveal — the counter-translate transition shared by the mask slider
 * (src/components/maskSlider.js) and mask-effect carousels
 * (data-carousel-effect="mask" in src/components/carousel.js).
 *
 * Each slide has an overflow:hidden wrapper around its media. One timeline
 * runs four tweens from time 0 (dir = 100 forward, -100 backward):
 *   outgoing wrap   0     → -dir
 *   outgoing media  0     → +dir × parallax
 *   incoming wrap   +dir  → 0
 *   incoming media  -dir × parallax → 0
 * Wrapper and media cancel each other out, so the picture stays put while its
 * edge wipes across like a mask. `parallax` (0–100) scales the media's
 * counter-move: 100 = perfectly still, 50 = the picture drifts as it reveals.
 */

import { CustomEase } from 'gsap/CustomEase';
import { gsap } from './gsapCore';

// Registered once per page, at module load. Guarded for non-browser contexts
// (CustomEase touches the DOM when it builds the curve).
export const PAGTRANS_EASE = 'Pagtrans';
if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase);
  if (!CustomEase.get(PAGTRANS_EASE)) CustomEase.create(PAGTRANS_EASE, '.645,.045,.355,1');
}

/**
 * Build and play the mask reveal between two slides.
 * @param {object} config
 * @param {{ wrap: Element, media?: Element|null }} config.outgoing
 * @param {{ wrap: Element, media?: Element|null }} config.incoming
 * @param {number} config.direction - 1 forward, -1 backward
 * @param {number} config.duration - seconds
 * @param {string} [config.ease]
 * @param {number} [config.parallax] - 0–100
 * @param {'x'|'y'} [config.axis]
 * @param {Function} [config.onComplete]
 * @returns {gsap.core.Timeline}
 */
export function maskReveal({
  outgoing,
  incoming,
  direction,
  duration,
  ease = PAGTRANS_EASE,
  parallax = 100,
  axis = 'x',
  onComplete,
}) {
  const prop = axis === 'y' ? 'yPercent' : 'xPercent';
  const dir = direction < 0 ? -100 : 100;
  const counter = (dir * parallax) / 100;
  const tween = { duration, ease };
  const from = (value) => ({ [prop]: value });
  const to = (value) => ({ [prop]: value, ...tween });

  const timeline = gsap.timeline({ onComplete });
  timeline.fromTo(outgoing.wrap, from(0), to(-dir), 0);
  if (outgoing.media) timeline.fromTo(outgoing.media, from(0), to(counter), 0);
  timeline.fromTo(incoming.wrap, from(dir), to(0), 0);
  if (incoming.media) timeline.fromTo(incoming.media, from(-counter), to(0), 0);
  return timeline;
}

/**
 * The same reveal for a slide that is itself the picture (no wrapper to move
 * against it): the incoming one, stacked over the outgoing, is uncovered by a
 * clip from its leading edge — both stay put, as with a parallax of 100.
 * The caller restores the incoming one's inline clip-path afterwards.
 * @param {object} config
 * @param {Element} config.incoming
 * @param {number} config.direction - 1 forward (wipes in from the right), -1 backward
 * @param {number} config.duration - seconds
 * @param {string} [config.ease]
 * @param {Function} [config.onComplete]
 * @returns {gsap.core.Timeline}
 */
export function maskClipReveal({
  incoming,
  direction,
  duration,
  ease = PAGTRANS_EASE,
  onComplete,
}) {
  const covered = direction < 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
  return gsap
    .timeline({ onComplete })
    .fromTo(incoming, { clipPath: covered }, { clipPath: 'inset(0% 0% 0% 0%)', duration, ease });
}

/** Stop any reveal on `targets` and drop the transforms it left behind. */
export function resetMaskReveal(targets) {
  const list = targets.filter(Boolean);
  if (!list.length) return;
  gsap.killTweensOf(list);
  gsap.set(list, { clearProps: 'transform' });
}
