/**
 * The one GSAP core every module uses — import { gsap, ScrollTrigger } from
 * here, never from 'gsap' directly.
 *
 * GSAP + ScrollTrigger are bundled, but Webflow's GSAP integration can also put
 * its own copy on the page (gsap.min.js + ScrollTrigger.min.js from Webflow's
 * CDN) before this bundle runs. The bundled ScrollTrigger (and DrawSVGPlugin)
 * register themselves with whatever window.gsap exists the moment they load —
 * that's Webflow's core — and once registered they ignore any later
 * registerPlugin(). Tweens made on the bundled core then have no ScrollTrigger
 * ("Invalid property scrollTrigger … Missing plugin?") and simply play once
 * instead of following the scroll. So whichever core ScrollTrigger actually
 * bound to is the core used everywhere: Webflow's when it's on the page, else
 * the bundled one. Lenis, ScrollTrigger and every tween then share one ticker.
 */

import { gsap as bundledGsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function resolveCore() {
  const pageGsap = typeof window !== 'undefined' ? window.gsap : null;
  const boundToPage =
    pageGsap &&
    pageGsap !== bundledGsap &&
    typeof pageGsap.core?.globals === 'function' &&
    pageGsap.core.globals().ScrollTrigger === ScrollTrigger;
  return boundToPage ? pageGsap : bundledGsap;
}

export const gsap = resolveCore();
// DrawSVGPlugin (free since GSAP 3.13) drives the arrow button's line/arrowhead
// draw — see src/components/button.js. A no-op for plugins already bound here.
gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

// Files that use `gsap` / `ScrollTrigger` as bare globals (the old CDN
// contract) get this same core.
if (typeof window !== 'undefined') {
  window.gsap = gsap;
  window.ScrollTrigger = ScrollTrigger;
}

export { ScrollTrigger };
