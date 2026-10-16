/**
 * Zoom In — an image settles from a slight zoom as it fades in, once, as it
 * comes into view: [data-zoom-in] on anything (an <img>, a frame), on any
 * page. One at the top of the page plays straight away — a hero's picture,
 * while its heading rises line by line ([data-split-text]).
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <img class="hero-img" data-zoom-in …>
 *   <img data-zoom-in data-parallax …>     ← zooms in, then sinks on scroll
 *                                            (src/animations/parallax.js)
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-zoom-in="1.2"          the zoom it settles from (default 1.12)
 *   data-zoom-in-delay="0.3"    seconds to wait once it's in view
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Hidden until this runs (src/styles/zoom-in.css, with a 4s failsafe; a page
 * whose picture is on its first screen keeps the same rule in its head code,
 * as the stylesheet arrives after the first paint), so it doesn't show and
 * then vanish. A page coming in through a page transition zooms the ones on
 * its first screen in as its window opens (enterZoomIns) — the window is
 * their fade, so they're seen through it at once, settling from the zoom as
 * on a reload; further down they keep their own entrance. After the page
 * intro they show as they are (showZoomIns). One the page opened already
 * scrolled past still plays. Under prefers-reduced-motion nothing is hidden
 * or moved. cleanupZoomIns() restores the authored inline styles.
 * The original name, data-hero-intro-image, still works.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { restingPosition } from '../utils/scrollPosition';
import { readNumber } from '../utils/section';

export const ZOOM_IN_SELECTOR = '[data-zoom-in], [data-hero-intro-image]';
// Set once it's set up (or shown as it is): src/styles/zoom-in.css hides it
// until then.
const READY_ATTR = 'data-zoom-in-ready';
// The previous head code hid a hero's picture until its [data-hero-intro]
// section had data-hero-intro-ready; still set there, for pages published
// with it.
const LEGACY_HERO = '[data-hero-intro]';
const LEGACY_READY = 'data-hero-intro-ready';

const MOTION = { scale: 1.12, duration: 2.2, ease: 'power3.out', start: 'top 85%' };
// Through a page transition: held at its zoom while the window opens (1.17s,
// global/pageTransition.js), settling as the window's all but full screen —
// started with the window, it was all but settled before it could be seen.
const AFTER_WINDOW = 0.8;

let ctx = null;

function markReady(el) {
  el.setAttribute(READY_ATTR, '');
  el.closest(LEGACY_HERO)?.setAttribute(LEGACY_READY, '');
}

/** Wire every [data-zoom-in] on the page. Safe to call repeatedly. */
export function initZoomIns() {
  if (typeof document === 'undefined' || ctx) return;
  const elements = Array.from(document.querySelectorAll(ZOOM_IN_SELECTOR));
  if (!elements.length) return;
  if (prefersReducedMotion()) {
    elements.forEach(markReady);
    return;
  }
  ctx = gsap.context(() => {
    elements.forEach((el) => {
      // Already set going by a page transition (enterZoomIns), or shown
      // after the page intro (showZoomIns).
      if (el.hasAttribute(READY_ATTR)) return;
      gsap.fromTo(
        el,
        { scale: readNumber(el.getAttribute('data-zoom-in'), MOTION.scale), autoAlpha: 0 },
        {
          scale: 1,
          autoAlpha: 1,
          duration: MOTION.duration,
          ease: MOTION.ease,
          delay: Math.max(0, readNumber(el.getAttribute('data-zoom-in-delay'), 0)),
          // end: 'max', so one the page opened already scrolled past still plays.
          scrollTrigger: {
            trigger: el,
            start: restingPosition(el, MOTION.start),
            end: 'max',
            once: true,
          },
        }
      );
      markReady(el);
    });
  });
}

/**
 * Show the ones on `container`'s first screen as they already are, without
 * their entrance — for a page coming in through a page transition (or the
 * page intro, src/animations/pageIntro.js), which is their entrance. Those
 * further down keep theirs, for when they're scrolled to.
 */
export function showZoomIns(container) {
  if (!container) return;
  const top = container === document ? 0 : container.getBoundingClientRect().top;
  container.querySelectorAll(ZOOM_IN_SELECTOR).forEach((el) => {
    if (el.getBoundingClientRect().top - top < window.innerHeight) markReady(el);
  });
}

/**
 * For a page coming in through a page transition (src/index.js): the ones on
 * the new page's first screen are shown at once (the window reveals them),
 * held at their zoom while it opens, and settle from it as it's all but full
 * screen — the same zoom as on a reload, without the fade. Those
 * further down keep their own entrance, set up with the page.
 */
export function enterZoomIns(container) {
  if (!container) return;
  const reduced = prefersReducedMotion();
  const top = container.getBoundingClientRect().top;
  container.querySelectorAll(ZOOM_IN_SELECTOR).forEach((el) => {
    if (el.getBoundingClientRect().top - top >= window.innerHeight) return;
    markReady(el);
    if (reduced) return;
    gsap.fromTo(
      el,
      { scale: readNumber(el.getAttribute('data-zoom-in'), MOTION.scale) },
      {
        scale: 1,
        duration: MOTION.duration,
        ease: MOTION.ease,
        delay: AFTER_WINDOW + Math.max(0, readNumber(el.getAttribute('data-zoom-in-delay'), 0)),
      }
    );
  });
}

export function cleanupZoomIns() {
  // They stay marked ready, so the stylesheet never hides them again.
  ctx?.revert();
  ctx = null;
}
