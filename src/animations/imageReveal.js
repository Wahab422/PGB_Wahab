/**
 * Image Reveal — the scroll-in image animation, site-wide and opt-in:
 *   1. Reveal — the first time the frame scrolls into view, it opens upward
 *      from its bottom edge while the image settles from a slight zoom. Once;
 *      it doesn't replay on the way back.
 *   2. Depth — afterwards the image keeps drifting gently inside its frame as
 *      the page scrolls (slower than the frame, like looking through a
 *      window). It's slightly enlarged, so the frame never shows an edge.
 * Images that come into view together (a gallery row) open one after another.
 * Started on every page from handleGlobalAnimation() in components/gsap.js,
 * so it also picks up frames that only arrive later.
 *
 * ── Markup (one attribute on the image's wrapper in Webflow) ─────────────────
 *   <div class="any-image-wrap" data-reveal-image>     ← the frame: clipped, revealed
 *     <img src="…">                                    ← the image: zoom + depth
 *   </div>
 * The first <img> or <video> inside is the image (tab pictures stacked in it,
 * [data-tabs-img], are all the image, taking turns). The frame keeps its own size
 * and layout; it's clipped to its box (with its border-radius), so it doesn't
 * need overflow: hidden. On the <img> itself the attribute still works, as a
 * plain reveal (no zoom or depth — there's no frame to hold them), and so does
 * a frame whose image another animation already moves ([data-zoom-in],
 * [data-parallax]).
 *
 * ── Options (on [data-reveal-image]) ─────────────────────────────────────────
 *   data-reveal-image-depth="false"   reveal only — no drift afterwards
 *   data-reveal-image-depth="12"      a stronger drift: the image travels ±12%
 *                                     of its height (default 6, up to 15),
 *                                     enlarged as much as that needs
 *   data-reveal-image-start="top 85%" when the reveal starts (ScrollTrigger
 *                                     start; default: the frame's top 15% of
 *                                     the way up the screen)
 *   data-reveal-image-delay="0.2"     seconds to wait before revealing (adds to
 *                                     the automatic stagger)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * A frame already on screen at load reveals straight away, and so does one
 * the page opened already scrolled past (it's never stuck hidden). One that
 * isn't rendered when its turn comes (in a closed tab or modal) reveals the
 * moment it's shown. Frames added later (load more, nested content) are
 * picked up and removed ones cleaned up, and a ScrollTrigger refresh follows
 * any frame changing size (a lazy image loading). Under prefers-reduced-motion
 * nothing is hidden or moved. It works alongside the float
 * (src/animations/float.js): that moves a block with y, this clips the frame
 * and moves the image inside it. cleanupImageReveals() kills everything and
 * restores the authored inline styles.
 */

// The shared core directly (not components/gsap.js, which imports this file
// to start it from handleGlobalAnimation()).
import { gsap as gsapCore, ScrollTrigger } from '../utils/gsapCore';
import { debounce } from '../utils/helpers';
import { requestScrollRefresh } from '../utils/scrollRefresh';
import { restingPosition } from '../utils/scrollPosition';
import { prefersReducedMotion } from '../utils/motion';
import { PARALLAX_SELECTOR } from './parallax';
import { ZOOM_IN_SELECTOR } from './zoomIn';

const SELECTOR = '[data-reveal-image]';
const MEDIA = 'img, video';
const TAB_PANEL = '[data-tabs-img]';
// An image another animation already scales or moves ([data-zoom-in],
// [data-parallax]) gets the clip reveal only, so the two never fight over its
// transform.
const MOVED = `${ZOOM_IN_SELECTOR}, ${PARALLAX_SELECTOR}`;

// ── The effect ──────────────────────────────────────────────────────────────
// Depth: the image is enlarged by DEPTH_SCALE and travels ±DEPTH_TRAVEL % of
// its height inside the frame — inside the (DEPTH_SCALE − 1) / 2 margin the
// enlargement leaves on each side, so no edge ever shows.
const DEPTH_SCALE = 1.15;
const DEPTH_TRAVEL = 6;
// A stronger drift (data-reveal-image-depth="12"): up to this travel (%), the
// image enlarged to keep the margin it needs (1 + 2 × travel / 100, and a
// touch more) — below REVEAL_SCALE, so the reveal still settles from a zoom.
const MAX_TRAVEL = 15;
const EDGE_ROOM = 0.03;

// The frame's drift: its travel (%) and the scale that leaves room for it, or
// null for none (data-reveal-image-depth="false" / "0").
function depthOf(el) {
  const value = (el.getAttribute('data-reveal-image-depth') || '').trim();
  if (value === 'false') return null;
  const asked = Number.parseFloat(value);
  const travel = Number.isFinite(asked) ? Math.min(MAX_TRAVEL, Math.max(0, asked)) : DEPTH_TRAVEL;
  if (!travel) return null;
  return { travel, scale: Math.max(DEPTH_SCALE, 1 + (2 * travel) / 100 + EDGE_ROOM) };
}
// Reveal: the image starts this much bigger and settles to DEPTH_SCALE.
const REVEAL_SCALE = 1.35;
const REVEAL_DURATION = 1.2;
const SETTLE_DURATION = 1.6;
// Frames whose reveals start within STAGGER_WINDOW ms of each other open
// STAGGER s apart, in the order they came into view.
const STAGGER = 0.12;
const STAGGER_WINDOW = 120;

// The frame's clip at rest: its own box, with its rounded corners.
function openClip(frame) {
  const radius = getComputedStyle(frame).borderRadius;
  return radius && radius !== '0px' ? `inset(0% 0% 0% 0% round ${radius})` : 'inset(0% 0% 0% 0%)';
}

/**
 * Adds the reveal to `timeline` (at `position`): `frame` opens upward from its
 * bottom edge and `media` (optional) settles from REVEAL_SCALE to `restScale`.
 */
function addReveal(gsap, timeline, frame, media, { position = 0, restScale = DEPTH_SCALE } = {}) {
  timeline.fromTo(
    frame,
    { clipPath: 'inset(100% 0% 0% 0%)' },
    { clipPath: () => openClip(frame), duration: REVEAL_DURATION, ease: 'expo.out' },
    position
  );
  if (media) {
    timeline.fromTo(
      media,
      { scale: REVEAL_SCALE },
      { scale: restScale, duration: SETTLE_DURATION, ease: 'expo.out' },
      position
    );
  }
  return timeline;
}

/**
 * ScrollTrigger vars that call `onReveal` once, when `frame` reaches `start`.
 * The range runs to the end of the page (end: 'max') rather than the frame's
 * bottom: with limitCallbacks (components/gsap.js) a frame whose whole range
 * was already passed when the page loaded — opened scrolled down, an anchor
 * jump — would otherwise get no onEnter at all and stay hidden for good.
 */
function revealTrigger(frame, start, onReveal) {
  return {
    trigger: frame,
    start: restingPosition(frame, start || 'top 85%'),
    end: 'max',
    once: true,
    onEnter: onReveal,
  };
}

/** The depth drift: `media` travels inside `frame` while it crosses the screen. */
function addDepth(gsap, frame, media, { travel, scale }) {
  gsap.set(media, { scale, transformOrigin: '50% 50%' });
  return gsap.fromTo(
    media,
    { yPercent: -travel },
    {
      yPercent: travel,
      ease: 'none',
      scrollTrigger: {
        trigger: frame,
        start: restingPosition(frame, 'top 85%'),
        end: restingPosition(frame, 'bottom top'),
        scrub: true,
      },
    }
  );
}

// ── Site-wide wiring ────────────────────────────────────────────────────────
const instances = new Map();
let resizeObserver = null;
let mutationObserver = null;
const sizes = new WeakMap();
// Reveals waiting for their frame to be shown (it was in a closed tab or
// modal when its turn came): frame → start function, run by the
// ResizeObserver once the frame has a size.
const waitingToShow = new Map();
// Frames shown as they are, without their reveal (settleImageReveals): kept by
// element, so a CMS item a filter takes out and puts back stays that way.
const settled = new WeakSet();
// el → shows it now, without its reveal (while it's wired).
const settlers = new Map();
// el → re-measures its depth drift where it now is (a CMS item moved).
const remeasure = new Map();
// Frames to re-measure once they're laid out (a list still hidden as its items
// go back in): measured as soon as they have a size, before they're painted.
const unmeasured = new Set();
// The automatic stagger: when the last reveal started, and how many in a row.
let lastStart = 0;
let inARow = 0;

function staggerDelay() {
  const now = performance.now();
  inARow = now - lastStart < STAGGER_WINDOW ? inARow + 1 : 0;
  lastStart = now;
  return inARow * STAGGER;
}

function initImageReveal(el, gsap) {
  const isMedia = el.matches(MEDIA);
  const frame = el;
  const first = isMedia ? null : el.querySelector(MEDIA);
  // Tab pictures stacked in the frame ([data-tabs-img], components/tabs.js)
  // take turns as its image: they all get the zoom and depth, so changing tab
  // never changes it.
  const found = first?.matches(TAB_PANEL)
    ? Array.from(el.querySelectorAll(MEDIA)).filter((m) => m.matches(TAB_PANEL))
    : first;
  // No zoom or depth on an image another animation already moves.
  const media = found && ![found].flat().some((m) => m.matches(MOVED)) ? found : null;
  const depth = media ? depthOf(el) : null;
  const extraDelay = Math.max(
    0,
    Number.parseFloat(el.getAttribute('data-reveal-image-delay')) || 0
  );

  const ctx = gsap.context((self) => {
    const drift = depth ? addDepth(gsap, frame, media, depth) : null;
    if (drift) {
      remeasure.set(el, () => {
        const trigger = drift.scrollTrigger;
        if (!trigger) return;
        trigger.refresh();
        // …and drawn there now, not on the next scroll update (the refresh
        // moves its start / end but leaves its progress where it was).
        const span = trigger.end - trigger.start;
        const progress = span > 0 ? (trigger.scroll() - trigger.start) / span : 0;
        drift.progress(Math.min(1, Math.max(0, progress)));
      });
    }
    const intro = addReveal(gsap, gsap.timeline({ paused: true }), frame, media, {
      restScale: depth ? depth.scale : 1,
    });
    if (settled.has(el)) {
      intro.progress(1);
      return;
    }
    let trigger = null;
    settlers.set(el, () => {
      trigger?.kill();
      waitingToShow.delete(frame);
      intro.progress(1);
    });
    const start = () => {
      const delay = staggerDelay() + extraDelay;
      // Recorded in the context, so cleanup cancels a pending start.
      if (delay) self.add(() => gsap.delayedCall(delay, () => intro.play()));
      else intro.play();
    };
    trigger = ScrollTrigger.create(
      revealTrigger(frame, el.getAttribute('data-reveal-image-start'), () => {
        // Not rendered (display: none, e.g. a closed tab): reveal when it's shown.
        if (!frame.getClientRects().length && resizeObserver) waitingToShow.set(frame, start);
        else start();
      })
    );
  });

  sizes.set(el, `${el.offsetWidth}x${el.offsetHeight}`);
  resizeObserver?.observe(el);

  return () => {
    waitingToShow.delete(el);
    settlers.delete(el);
    remeasure.delete(el);
    unmeasured.delete(el);
    resizeObserver?.unobserve(el);
    ctx.revert();
  };
}

function watch() {
  if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      entries.forEach(({ target }) => {
        if (unmeasured.has(target) && target.offsetHeight) {
          unmeasured.delete(target);
          remeasure.get(target)?.();
        }
        const start = waitingToShow.get(target);
        if (!start || !target.getClientRects().length) return;
        waitingToShow.delete(target);
        start();
      });
      const changed = entries.some(({ target }) => {
        const size = `${target.offsetWidth}x${target.offsetHeight}`;
        if (sizes.get(target) === size) return false;
        sizes.set(target, size);
        return true;
      });
      if (changed) requestScrollRefresh();
    });
  }
  if (!mutationObserver && typeof MutationObserver !== 'undefined') {
    const sweep = debounce(() => {
      let removed = false;
      instances.forEach((cleanup, el) => {
        if (el.isConnected) return;
        cleanup();
        instances.delete(el);
        removed = true;
      });
      const before = instances.size;
      initImageReveals();
      if (removed || instances.size !== before) requestScrollRefresh();
    }, 100);
    mutationObserver = new MutationObserver((records) => {
      // A frame a filter puts back (settled: no reveal) is wired again at
      // once, before it's painted; and as frames come and go the ones that
      // stay (moved along by them) have their depth drift re-measured where
      // they now are — left to the sweep / the next refresh, an image would
      // show out of place for a moment and then jump.
      let moved = false;
      records.forEach(({ addedNodes }) =>
        addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          [node, ...node.querySelectorAll(SELECTOR)]
            .filter((el) => el.matches(SELECTOR) && el.isConnected)
            .forEach((el) => {
              moved = true;
              if (!instances.has(el) && settled.has(el)) wire(el);
            });
        })
      );
      if (moved) {
        remeasure.forEach((refresh, el) => {
          if (!el.isConnected) return;
          if (el.offsetHeight) refresh();
          else unmeasured.add(el);
        });
      }
      sweep();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/** Wire every [data-reveal-image] under `root`. Safe to call repeatedly. */
export function initImageReveals(root = document) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  watch();
  root.querySelectorAll(SELECTOR).forEach(wire);
}

function wire(el) {
  if (instances.has(el)) return;
  if (el.getAttribute('data-reveal-image') === 'false') return;
  // Content scrolling in its own box (the project modal): animations/panelReveal.js.
  if (el.closest('[data-panel-reveal]')) return;
  instances.set(el, initImageReveal(el, gsapCore));
}

/**
 * Show the frames under `root` as they are from now on, without their reveal —
 * a CMS list being filtered (src/global/finsweetLists.js): its items are taken
 * out and put back, and would otherwise reveal again, cut short by the next
 * click. One already revealing jumps to its end.
 */
export function settleImageReveals(root) {
  root?.querySelectorAll(SELECTOR).forEach((el) => {
    settled.add(el);
    settlers.get(el)?.();
  });
}

/**
 * Stop picking up new frames until the next initImageReveals() — during a
 * page swap (src/global/pageTransition.js), while the incoming page is still
 * pinned and clipped and would be measured wrong.
 */
export function pauseImageRevealWatch() {
  mutationObserver?.disconnect();
  mutationObserver = null;
}

export function cleanupImageReveals() {
  mutationObserver?.disconnect();
  mutationObserver = null;
  instances.forEach((cleanup) => cleanup());
  instances.clear();
  resizeObserver?.disconnect();
  resizeObserver = null;
}
