/**
 * Fade — an element fades in as it scrolls into view, once: [data-fade] on
 * anything, on any page. Elements that come into view together fade in one
 * after another. Started on every page from handleGlobalAnimation() in
 * components/gsap.js.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="tag" data-fade>…</div>          ← fades in
 *   <div class="tag" data-fade="up">…</div>     ← fades in, rising 20px
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-fade="up"              rise as it fades in
 *   data-fade-delay="0.3"       seconds to wait once it's in view
 *   data-fade-start="top 80%"   when it plays (ScrollTrigger start; default
 *                               top 90%)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Hidden until this runs (src/styles/fade.css, with a 4s failsafe), so it
 * doesn't show and then vanish — e.g. through a page transition's opening
 * window. One the page opened already scrolled past still plays. Ones inside
 * a modal are left alone, and ones in a [data-timeline-reveal] step are faded
 * in by that step (src/animations/timelineReveal.js). Under
 * prefers-reduced-motion nothing is hidden. cleanupFades() restores the
 * authored inline styles.
 * The original name, anim-element (or the .anim-element class), still works.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { restingPosition } from '../utils/scrollPosition';
import { readNumber } from '../utils/section';

export const FADE_SELECTOR = '[data-fade], [anim-element], .anim-element';
const SKIP = '[data-modal-name], [data-timeline-reveal]';
// Set once it's set up: src/styles/fade.css hides it until then.
const READY_ATTR = 'data-fade-ready';

const MOTION = {
  duration: 1.1,
  ease: 'power2.out',
  rise: 20, // px, for data-fade="up"
  each: 0.08, // s between ones coming into view together
  start: 'top 90%',
};

let ctx = null;

/** Wire every [data-fade] on the page. Safe to call repeatedly. */
export function initFades() {
  if (typeof document === 'undefined' || ctx) return;
  const elements = Array.from(document.querySelectorAll(FADE_SELECTOR)).filter(
    (el) => !el.parentElement?.closest(SKIP)
  );
  if (!elements.length) return;
  if (prefersReducedMotion()) {
    elements.forEach((el) => el.setAttribute(READY_ATTR, ''));
    return;
  }

  // Ones whose triggers fire together (a row, a fast scroll) fade in one
  // after another, in the page's order.
  let pending = [];
  const flush = () => {
    const batch = pending.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    pending = [];
    ctx?.add(() =>
      batch.forEach((el, i) => {
        gsap.to(el, {
          autoAlpha: 1,
          y: 0,
          duration: MOTION.duration,
          ease: MOTION.ease,
          delay: i * MOTION.each + Math.max(0, readNumber(el.getAttribute('data-fade-delay'), 0)),
          clearProps: 'opacity,visibility,transform',
        });
      })
    );
  };
  const queue = (el) => {
    if (!pending.length) gsap.delayedCall(0, flush);
    pending.push(el);
  };

  ctx = gsap.context(() => {
    elements.forEach((el) => {
      const rises = el.getAttribute('data-fade') === 'up';
      gsap.set(el, rises ? { autoAlpha: 0, y: MOTION.rise } : { autoAlpha: 0 });
      el.setAttribute(READY_ATTR, '');
      // end: 'max', so one the page opened already scrolled past still plays.
      ScrollTrigger.create({
        trigger: el,
        start: restingPosition(el, el.getAttribute('data-fade-start') || MOTION.start),
        end: 'max',
        once: true,
        onEnter: () => queue(el),
      });
    });
  });
}

export function cleanupFades() {
  ctx?.revert();
  ctx = null;
}
