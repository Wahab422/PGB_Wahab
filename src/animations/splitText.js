/**
 * Split Text — headings and text reveal line by line as they come into view,
 * exactly as fluid.glass's headings do (taken from their code): the text is
 * split into masked lines, each line starts two line-heights below its mask
 * and rises into place, 0.1s after the one above, over 1.5s (power3.out). It
 * starts once the text's top is 15% up the screen (in step with the fades and
 * image reveals) — text on the first screen as the page opens — and plays
 * once. The lines move on the compositor (utils/splitLines.js riseLines), so
 * the rest of the page's work can't make them stutter. Started on every page
 * from handleGlobalAnimation() in components/gsap.js.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <h2 data-split-text>Before sign-off, experience the real system…</h2>
 *   <h1 data-split-text data-split-text-delay="0.5">Beautiful walls.<br>No surprises</h1>
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-split-text-delay="0.5"   seconds to wait once it's in view — e.g. the
 *                                 hero heading, so it follows the page in
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Lines are split after the page's fonts load, so they break where they'll
 * finally break, and re-split when the text's width changes (utils/
 * splitLines.js). Until it's split the text is kept hidden by
 * src/styles/split-text.css (so it doesn't show, vanish and rise in), with a
 * 4s CSS failsafe in case this script never runs; if fonts take longer than
 * FONT_WAIT it's split anyway. Text already passed when the page opens
 * (reload half-way down, anchor link) plays straight away. Screen readers read
 * it once, as written. Text inside a [data-timeline-reveal] step doesn't use
 * its own trigger: the step plays it, through playSplitText(), as its line
 * reaches its ticks. Under prefers-reduced-motion it's left alone.
 * cleanupSplitTexts() restores the original markup.
 */

import { ScrollTrigger } from '../utils/gsapCore';
import { layoutTop, restingPosition } from '../utils/scrollPosition';
import { fontsReady, hideLines, riseLines, showLines, splitLines } from '../utils/splitLines';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const SELECTOR = '[data-split-text]';
// Set once the text is split (or left as is): src/styles/split-text.css keeps
// [data-split-text] hidden until then, so it doesn't show and then vanish.
const READY_ATTR = 'data-split-text-ready';
// Longest wait for fonts before splitting anyway (ms).
const FONT_WAIT = 2500;
// When it plays: once its top is well on screen (as data-fade and
// data-reveal-image do); text on the first screen plays as the page opens.
const START = 'top 85%';
const START_FIRST_SCREEN = 'top bottom';

// Text inside these is split and hidden as usual, but plays when its owner
// calls playSplitText() instead of on its own scroll trigger
// (src/animations/timelineReveal.js; the hero's heading while the page intro
// plays, src/animations/pageIntro.js).
const HELD_BY = '[data-timeline-reveal], [data-split-text-held]';

const instances = new Map();
// el → its play(), once split; els asked to play before they were split.
const players = new Map();
const pendingPlays = new Set();
// el → its settle(): lines in place now, no rise.
const settlers = new Map();

function readDelay(el) {
  const delay = Number.parseFloat(el.getAttribute('data-split-text-delay'));
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

function initSplitText(el) {
  let played = false;
  let rise = null;
  let trigger = null;

  // Each split (and re-split) gives new line elements: put them where they
  // belong — below their masks until it plays, in place after (a re-split
  // mid-rise just lands the new lines in place).
  const handle = splitLines(el, (lines) => {
    if (played) showLines(lines);
    else hideLines(lines);
  });
  el.setAttribute(READY_ATTR, '');

  // The rise itself runs on the compositor (utils/splitLines.js riseLines);
  // played again, it starts over from below the masks.
  const play = () => {
    played = true;
    rise?.cancel();
    rise = riseLines(handle.lines(), { delay: readDelay(el) });
  };
  players.set(el, play);
  settlers.set(el, () => {
    // Split while hidden, maybe: lines that fit it now, before it's seen.
    handle.fit();
    if (played) return;
    played = true;
    trigger?.kill();
    showLines(handle.lines());
  });

  if (el.closest(HELD_BY)) {
    // Its owner plays it; it may have asked already, before the split.
    if (pendingPlays.delete(el)) play();
  } else {
    // end: 'max' — with limitCallbacks (components/gsap.js) text whose whole
    // range was already passed when the page opened would otherwise never play.
    trigger = ScrollTrigger.create({
      trigger: el,
      start: restingPosition(el, layoutTop(el) < window.innerHeight ? START_FIRST_SCREEN : START),
      end: 'max',
      once: true,
      onEnter: play,
    });
  }

  return () => {
    players.delete(el);
    settlers.delete(el);
    trigger?.kill();
    rise?.cancel();
    handle.revert();
  };
}

/** Wire every [data-split-text] on the page. Safe to call repeatedly. */
export function initSplitTexts(root = document) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const elements = Array.from(root.querySelectorAll(SELECTOR)).filter(
    (el) => !instances.has(el) && el.textContent.trim()
  );
  if (!elements.length) return;
  elements.forEach((el) => instances.set(el, null));
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT));
  Promise.race([fontsReady(), timeout]).then(() => {
    elements.forEach((el) => {
      if (!instances.has(el)) return; // cleaned up meanwhile
      try {
        instances.set(el, initSplitText(el));
      } catch (error) {
        // Leave this one as plain text; the rest still animate.
        el.setAttribute(READY_ATTR, '');
        instances.delete(el);
        logger.warn('[SplitText] could not split — left as is:', el, error);
      }
    });
  });
}

/**
 * Play (or replay) a [data-split-text] held by an owner (see HELD_BY). Safe to
 * call before the text is split: it plays once it is.
 */
export function playSplitText(el) {
  if (players.has(el)) players.get(el)();
  else if (instances.has(el)) pendingPlays.add(el);
}

/**
 * Put a [data-split-text] that hasn't played yet in place now, without its
 * rise, when another animation brings it in (the Resources filter,
 * src/global/resourceLists.js; a tab's [data-tabs-content], src/components/
 * tabs.js). Text that already played is left in place. Either way it's
 * re-split first if it was split at another width (e.g. while hidden), so its
 * lines don't change under the other animation.
 */
export function settleSplitText(el) {
  settlers.get(el)?.();
}

export function cleanupSplitTexts() {
  // The text stays marked ready, so the stylesheet never hides it again.
  instances.forEach((cleanup, el) => {
    cleanup?.();
    el.setAttribute(READY_ATTR, '');
  });
  instances.clear();
  pendingPlays.clear();
}
