/**
 * Parallax — as its section scrolls off the top of the screen, the element
 * sinks slower than the page (as fluid.glass's header does): [data-parallax]
 * on anything, on any page — usually a section's background picture.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <section class="section for-hero">           ← clips it: overflow hidden
 *     <div class="bg for-h" data-parallax>…</div>
 *   </section>
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-parallax="35"   how far it sinks, as a % of its own height, by the
 *                        time its section has left the screen (default 35)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Its section is its closest <section> (else its parent): the sinking runs
 * from that section's top at the top of the screen to its bottom leaving it,
 * tied to the scroll. The section must clip its content (Webflow: overflow
 * hidden — .for-hero does), so the sunken element never shows an edge; the
 * gap it leaves at the section's top is above the screen by then. Works with
 * [data-zoom-in] on the same element. Off under prefers-reduced-motion.
 * cleanupParallaxes() restores the authored inline styles.
 * The original name, data-hero-intro-bg, still works.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { readNumber, sectionOf } from '../utils/section';

// A mask slider's data-parallax is its own option (components/maskSlider.js).
export const PARALLAX_SELECTOR = '[data-parallax]:not([data-mask-slider]), [data-hero-intro-bg]';
const DEFAULT_SINK = 35;

let ctx = null;

/** Wire every [data-parallax] on the page. Safe to call repeatedly. */
export function initParallaxes() {
  if (typeof document === 'undefined' || ctx || prefersReducedMotion()) return;
  const elements = document.querySelectorAll(PARALLAX_SELECTOR);
  if (!elements.length) return;
  ctx = gsap.context(() => {
    elements.forEach((el) => {
      gsap.fromTo(
        el,
        { yPercent: 0 },
        {
          yPercent: readNumber(el.getAttribute('data-parallax'), DEFAULT_SINK),
          ease: 'none',
          scrollTrigger: {
            trigger: sectionOf(el),
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });
  });
}

export function cleanupParallaxes() {
  ctx?.revert();
  ctx = null;
}
