/**
 * Scroll Fade — as its section starts scrolling off the top of the screen,
 * the element drifts up and fades out; scrolling back brings it back:
 * [data-scroll-fade] on anything, on any page — usually a hero's text.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="hh-text" data-scroll-fade>…</div>
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-scroll-fade="60"   px it drifts up as it fades (default 60)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Its section is its closest <section> (else its parent): the fade runs over
 * the first third of that section leaving the screen (from its top at the top
 * of the screen), tied to the scroll — or sooner, so it has gone before it
 * reaches the fixed nav ([nav]; on phones the hero text sits close under it).
 * Off under prefers-reduced-motion. cleanupScrollFades() restores the authored
 * inline styles. The original name, data-hero-intro-text, still works.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { layoutTop } from '../utils/scrollPosition';
import { readNumber, sectionOf } from '../utils/section';

const SELECTOR = '[data-scroll-fade], [data-hero-intro-text]';
const DEFAULT_LIFT = 60;
// Share of the section's height over which it fades.
const FADE_SHARE = 0.35;
// The fixed nav it fades out before reaching.
const NAV = '[nav]';
// Shortest fade (px of scroll), however close under the nav it sits.
const MIN_FADE = 40;
// With little room, the share of it the drift up may take.
const TIGHT_LIFT_SHARE = 0.25;

// The scroll (px) over which it fades and how far (px) it drifts up: over a
// share of its section — but where that would carry it up under the fixed
// nav (on phones the hero text sits just below it), over the room it has, so
// it has gone by the time it gets there, drifting less.
function fadeFit(el, section, lift) {
  const share = section.offsetHeight * FADE_SHARE;
  const nav = document.querySelector(NAV);
  if (!nav || !/fixed|sticky/.test(getComputedStyle(nav).position))
    return { distance: share, lift };
  const room = layoutTop(el) - layoutTop(section) - nav.offsetHeight;
  if (room >= share + lift) return { distance: share, lift };
  const tightLift = Math.min(lift, Math.max(0, room) * TIGHT_LIFT_SHARE);
  return { distance: Math.max(MIN_FADE, room - tightLift), lift: tightLift };
}

let ctx = null;

/** Wire every [data-scroll-fade] on the page. Safe to call repeatedly. */
export function initScrollFades() {
  if (typeof document === 'undefined' || ctx || prefersReducedMotion()) return;
  const elements = document.querySelectorAll(SELECTOR);
  if (!elements.length) return;
  ctx = gsap.context(() => {
    elements.forEach((el) => {
      const section = sectionOf(el);
      const lift = readNumber(el.getAttribute('data-scroll-fade'), DEFAULT_LIFT);
      gsap.fromTo(
        el,
        { autoAlpha: 1, y: 0 },
        {
          autoAlpha: 0,
          y: () => -fadeFit(el, section, lift).lift,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${fadeFit(el, section, lift).distance}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    });
  });
}

export function cleanupScrollFades() {
  ctx?.revert();
  ctx = null;
}
