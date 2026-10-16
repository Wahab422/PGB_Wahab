/**
 * Global Animations — starts the site's scroll animations on every page.
 * Each animation lives in its own module in src/animations/, with its
 * attribute, options and behaviour documented at the top:
 *   [data-stagger-in=".child"]  items rise in one after another   stagger.js
 *   [data-fade]                 fades in on scroll-in             fade.js
 *   [data-counter]              its number counts up              counter.js
 *   [data-reveal-image]         an image frame opens on scroll-in imageReveal.js
 *   [data-split-text]           text rises in line by line        splitText.js
 *   [data-float]                drifts past the page              float.js
 * [data-zoom-in], [data-parallax] and [data-scroll-fade] (zoomIn.js,
 * parallax.js, scrollFade.js) are started earlier, from src/global/index.js,
 * as a hero's picture is hidden until its zoom-in is set up.
 *
 * GSAP and ScrollTrigger themselves come from utils/gsapCore.js (bundled, or
 * Webflow's when its GSAP integration is on the page).
 */

import { ScrollTrigger } from '../utils/gsapCore';
import { cleanupCounters, initCounters } from '../animations/counter';
import { cleanupFades, initFades } from '../animations/fade';
import { cleanupFloats, initFloats } from '../animations/float';
import { cleanupImageReveals, initImageReveals } from '../animations/imageReveal';
import { cleanupSplitTexts, initSplitTexts } from '../animations/splitText';
import { cleanupStaggerIns, initStaggerIns } from '../animations/stagger';
import { safe } from '../utils/helpers';
import { prefersReducedMotion } from '../utils/motion';
import { requestScrollRefresh } from '../utils/scrollRefresh';

let scrollTriggerConfigured = false;
let animationsInitialized = false;

/**
 * One-time ScrollTrigger setup. Async only because its callers already
 * `await ensureGSAPLoaded()` (GSAP used to load from a CDN).
 */
export async function ensureGSAPLoaded() {
  if (scrollTriggerConfigured) return;
  // Throttle onEnter/onLeave/onUpdate delivery to at most once per tick even
  // during very fast scrolling (scrollbar drag, trackpad flick) — cheap, and
  // no visible effect at normal scroll speeds.
  ScrollTrigger.config({ limitCallbacks: true });
  refreshOnPageHeightChange();
  scrollTriggerConfigured = true;
}

/**
 * ScrollTrigger measures every trigger when it's created and on load / window
 * resize — not when the page's height changes underneath it. Components that
 * settle after the first triggers exist do exactly that: tabs hiding their
 * inactive panels, carousels laying out, CMS load-more, nested content, late
 * images. Every trigger below the change then fires a screen early or late.
 * So: a refresh whenever the page's height actually changes (the refresh
 * itself can change it — pin spacers — so the height after any refresh is the
 * new baseline, which stops a loop).
 */
function refreshOnPageHeightChange() {
  if (typeof ResizeObserver === 'undefined' || !document.body) return;
  const pageHeight = () => document.documentElement.scrollHeight;
  let lastHeight = pageHeight();
  ScrollTrigger.addEventListener('refresh', () => {
    lastHeight = pageHeight();
  });
  new ResizeObserver(() => {
    if (pageHeight() !== lastHeight) requestScrollRefresh();
  }).observe(document.body);
}

/**
 * Start the page's scroll animations, once per page (resetGlobalAnimations()
 * before the next). Each starts on its own, so one failing doesn't stop the
 * rest. Under prefers-reduced-motion none of them run: nothing is pre-hidden
 * then, so every element simply stays as it is.
 */
export async function handleGlobalAnimation() {
  if (animationsInitialized) return;
  animationsInitialized = true;
  await ensureGSAPLoaded();
  if (prefersReducedMotion()) return;
  safe(initStaggerIns, 'Stagger in');
  safe(initFades, 'Fade');
  safe(initImageReveals, 'Image reveal');
  safe(initSplitTexts, 'Split text');
  safe(initFloats, 'Float');
  safe(initCounters, 'Counter');
}

/**
 * Undo handleGlobalAnimation() so it can run again for a new page (a page
 * swap, src/global/pageTransition.js).
 */
export function resetGlobalAnimations() {
  cleanupStaggerIns();
  cleanupFades();
  cleanupImageReveals();
  cleanupSplitTexts();
  cleanupFloats();
  cleanupCounters();
  animationsInitialized = false;
}
