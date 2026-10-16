/**
 * Carousel — Embla-powered sliders for Webflow, wired entirely by attributes.
 *
 * Loaded on demand by src/global/index.js on pages that contain a
 * [data-carousel]. Each carousel initialises when it nears the viewport; Embla
 * (bundled from npm, pinned in package.json) is its own lazily imported chunk.
 *
 * ── Markup ───────────────────────────────────────────────────────────────────
 *   <div data-carousel>                          ← root + options
 *     <div data-carousel-wrapper>                ← viewport (clips)
 *       <div data-carousel-container>            ← slides container
 *         <div>Slide 1</div>
 *         <div>Slide 2</div>
 *       </div>
 *     </div>
 *     <div data-carousel-btns>
 *       <button data-carousel-prev-btn type="button">Prev</button>
 *       <button data-carousel-next-btn type="button">Next</button>
 *     </div>
 *     <div data-carousel-dots><div data-carousel-dot class="carousel-dot"></div></div>
 *     <div data-carousel-progress-bar><div data-carousel-progress-fill></div></div>
 *   </div>
 *
 *   [data-carousel-wrapper]          viewport (the root itself if absent)
 *   [data-carousel-container]        slides container — its children are the slides
 *   [data-carousel-item]             the slides, when there's no container
 *   [data-carousel-btns]             prev/next wrapper, hidden when neither can move
 *   [data-carousel-prev-btn] / [data-carousel-next-btn]
 *   [data-carousel-dots] > [data-carousel-dot]    dots (see "Dots")
 *   [data-slide-btn]                 any element that jumps to a slide — in DOM
 *                                    order, or data-slide-index="0" for an explicit one
 *   [data-carousel-progress-bar] > [data-carousel-progress-fill]
 *   [data-carousel-autoplay-toggle]  your own Pause/Play control (else one is injected)
 *   [data-carousel-mask-wrap] / [data-carousel-mask-media]      mask-effect layers
 *   [data-carousel-text-animate="v1|v2|v3"] / [data-carousel-img-animate="v1|parallax"]
 *                                    per-slide animations
 *
 * ── Options (on [data-carousel]) ─────────────────────────────────────────────
 * Layout & navigation
 *   data-align="start|center|end"  slide alignment (default start)
 *   data-center                    shorthand for data-align="center"
 *   data-center-bounds             contain snaps when centred
 *   data-click-center              clicking a slide scrolls it into view
 *   data-active-in-view            the same, and lifts the active slide above its
 *                                  neighbours (for content wider than its slide)
 *   data-loop                      loop (fade/mask carousels always wrap)
 *   data-no-drag                   no dragging
 *   data-drag-free                 free momentum, then snap to the next slide once
 *                                  past DRAG_THRESHOLD (5% of the scroll range)
 *   data-vertical                  vertical axis (give the viewport a height)
 *   data-slide-classes             is-passed / is-upcoming / is-prev / is-next and
 *                                  passed-N / upcoming-N classes on the slides
 *   data-sync="group"              keep carousels with the same group in step
 *   data-carousel="mobile|tablet"  only initialise at ≤767px / ≤991px (the only
 *                                  values data-carousel takes besides "marquee";
 *                                  transitions are set with data-carousel-effect)
 *
 * Autoplay
 *   data-autoplay                  auto-advance
 *   data-autoplay-delay="8000"     ms per slide (default 8000)
 *   data-autoplay-stop-on-interaction   stop for good after a pointer/key press
 *   data-pause-on-hover            also pause while the pointer is over it
 *   Keyboard focus inside always pauses it (WCAG 2.2.2), and a Pause/Play
 *   control is always there — [data-carousel-autoplay-toggle], or an injected
 *   <button class="autoplay-toggle"> (src/utils/autoplayToggle.js). A user's
 *   Pause sticks until they press Play. With a [data-carousel-progress-bar] the fill
 *   runs 0 → 100% per slide; without autoplay it shows the position instead
 *   (slide 2 of 4 = 33%). The bar carries data-progress / data-current-slide /
 *   data-total-slides for styling.
 *
 * Fade — data-carousel-effect="fade"
 *   Slides are stacked and cross-faded; Embla only tracks the index. Always
 *   wraps (buttons, keys, swipe and autoplay all go through stepFade()), and
 *   dragging is replaced by a swipe listener. The slides are lined up while
 *   Embla measures, so the list's own Webflow layout doesn't matter.
 *   data-fade-duration="650" (ms, min 150), data-fade-ease="cubic-bezier(…)".
 *
 * Mask — data-carousel-effect="mask" (a fade-family mode)
 *   The mask slider's reveal (src/utils/maskReveal.js). Per slide,
 *   [data-carousel-mask-wrap] wipes across and [data-carousel-mask-media] counter-moves so
 *   the picture holds still — no wrap: the whole slide wipes; no media: a plain
 *   push. Input is ignored mid-reveal ([data-mask-animating] is set meanwhile)
 *   and an autoplay step waits for it. GSAP is loaded only for mask carousels.
 *   data-mask-duration="1.1" (s), data-mask-ease="Pagtrans" (any GSAP ease),
 *   data-mask-parallax="100" (100 = picture still, 50 = drifts, 0 = push).
 *
 * Marquee — data-carousel="marquee"
 *   Continuous scroll, no snapping: data-speed="80" (px/s),
 *   data-direction="reverse", data-pause-on-hover.
 *
 * Slide entrance animations (the value picks the version)
 *   [data-carousel-text-animate="v1"]  (fade/mask) text fades up in on the active
 *                                      slide — CSS, in and out at the same time
 *   [data-carousel-img-animate="v1"]   (fade/mask) images scale up + fade in on
 *                                      the active slide
 *   [data-carousel-text-animate="v2"]  (any carousel) the old slide's text rises
 *                                      out, then the new one rises in, staggered
 *                                      (TEXT_V2)
 *   [data-carousel-text-animate="v3"]  (any carousel) line by line, after
 *                                      fluid.glass: text split into masked lines
 *                                      that rise from below on every change,
 *                                      whichever way it goes; buttons move
 *                                      as one piece; plays in on first view and
 *                                      each time its tab panel is shown (TEXT_V3)
 *   [data-carousel-img-animate="parallax"]  (sliding carousels) on a slide's
 *                                      picture: it drifts a little slower than
 *                                      its slide as the track moves — dragged
 *                                      or stepped — as if seen through a window
 *                                      (IMG_PARALLAX)
 *   Without a value nothing animates.
 *
 * Stepping from outside (e.g. src/components/slideCursor.js)
 *   slider.dispatchEvent(new CustomEvent('carousel:step', { detail: { direction: 1 } }))
 *   steps it like the arrow keys (-1 back): direction-aware, wraps at the ends.
 *
 * ── Dots ─────────────────────────────────────────────────────────────────────
 * Put ONE styled [data-carousel-dot] in [data-carousel-dots]: it is cloned once per snap
 * (classes and inner markup kept) and the active dot gets .is-active plus
 * aria-current. Clones are tagged [data-carousel-dot-clone] and removed on
 * destroy. Without a [data-carousel-dot], author [data-slide-btn]s in the container
 * are used, else unstyled <button class="carousel-dot"> dots are generated.
 *
 * ── Accessibility & motion ───────────────────────────────────────────────────
 * WAI-ARIA carousel pattern: a labelled region (an existing role such as
 * tabpanel is kept), slides as labelled groups, a polite live region that only
 * goes quiet while rotation runs, and hidden fade slides made inert. Arrow keys
 * navigate (not with Alt/Ctrl/Cmd, nor inside form fields). Under
 * prefers-reduced-motion autoplay never runs, marquees stay still and the mask /
 * text animations switch instantly; manual navigation keeps working.
 *
 * ── Legacy markup still accepted ─────────────────────────────────────────────
 * [slider-prev-btn] / [slider-next-btn]; buttons in [data-carousel-btns] labelled
 * aria-label="Previous slide" / "Next slide"; else the first two [data-carousel-btn]
 * or <button>s in [data-carousel-btns]; a lone unattributed child of
 * [data-carousel-progress-bar] as its fill; the "upcomming-N" class spelling (cleared
 * like upcoming-N). Elements are never looked up by class — markup relying on
 * .carousel-wrapper / .carousel / .carousel-btns / .carousel-dots /
 * .carousel-item / .carousel-progress-fill needs the matching attribute. State
 * classes (is-active, is-passed, upcoming-N, …) are still applied.
 * NOT accepted any more: the pre-data- attribute names (carousel-wrapper,
 * carousel, carousel-dots, carousel-mask-wrap, …) — use data-carousel-*; and
 * data-effect, data-fade and data-carousel="fade" / "mask" — use
 * data-carousel-effect; and a value-less [data-carousel-text-animate] /
 * [data-carousel-img-animate] — add ="v1".
 */

import { gsap } from '../utils/gsapCore';
import { debounce, handleError } from '../utils/helpers';
import { fontsReady, hideLines, riseLines, showLines, splitLines } from '../utils/splitLines';
import { logger } from '../utils/logger';
import { setupAutoplayToggle } from '../utils/autoplayToggle';
import { prefersReducedMotion, scrollBehavior } from '../utils/motion';

// ─── Selectors ───────────────────────────────────────────────────────────────
// Structure is marked with data-carousel-* attributes, options are other data-*
// attributes on the root; elements are only ever looked up by attribute (or
// tag), never by class.
const ROOT_SELECTOR = '[data-carousel]';
const VIEWPORT_SELECTOR = '[data-carousel-wrapper]';
const CONTAINER_SELECTOR = '[data-carousel-container]';
const SLIDE_FALLBACK_SELECTOR = '[data-carousel-item]';
const BTNS_WRAPPER_SELECTOR = '[data-carousel-btns]';
// Explicit [data-carousel-prev-btn] / [data-carousel-next-btn] win; the aria-label half is
// a fallback for markup that only labelled its buttons.
const PREV_BTN_SELECTOR =
  '[data-carousel-prev-btn], [data-carousel-btns] [aria-label="Previous slide"]';
const NEXT_BTN_SELECTOR =
  '[data-carousel-next-btn], [data-carousel-btns] [aria-label="Next slide"]';
const LEGACY_PREV_BTN_SELECTOR = '[slider-prev-btn]';
const LEGACY_NEXT_BTN_SELECTOR = '[slider-next-btn]';
// Last resort inside [data-carousel-btns]: first match = prev, second = next.
const NAV_BTN_FALLBACK_SELECTOR = '[data-carousel-btn], button';
const DOTS_CONTAINER_SELECTOR = '[data-carousel-dots]';
// A dot in [data-carousel-dots] — the first one is the template cloned per snap.
const DOT_SELECTOR = '[data-carousel-dot]';
// Dots the carousel added (clones / generated), removed again on destroy.
const DOT_CLONE_ATTR = 'data-carousel-dot-clone';
const SLIDE_BTN_SELECTOR = '[data-slide-btn]';
const PROGRESS_BAR_SELECTOR = '[data-carousel-progress-bar]';
const PROGRESS_FILL_SELECTOR = '[data-carousel-progress-fill]';
// A per-item progress fill inside a [data-slide-btn] / [data-carousel-dot] —
// the active one grows with the autoplay timer (e.g. a feature list's lines).
const BTN_PROGRESS_SELECTOR = '[data-carousel-btn-progress]';
const MASK_WRAP_SELECTOR = '[data-carousel-mask-wrap]';
const MASK_MEDIA_SELECTOR = '[data-carousel-mask-media]';
const MARQUEE_CLONE_ATTR = 'data-marquee-clone';

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 991;
const MARQUEE_INIT_RETRY_DELAYS = [0, 120, 280, 600, 1200];

// ─── Slide text animation v2 — [data-carousel-text-animate="v2"] ─────────────────
// v1 ([data-carousel-text-animate="v1"], FADE_ANIMATE_CSS) fades the old
// slide's text out and the new one's in at the same time, so on stacked
// (fade/mask) slides the two cross over in the same spot. v2 sequences them with the Web Animations API: the outgoing text
// leaves first (up + fade), then the incoming text rises in, staggered in DOM
// order. Opacity/transform only, so it stays on the compositor.
const TEXT_V2_SELECTOR = '[data-carousel-text-animate="v2"]';
// Set on a carousel that has v2 text, scoping TEXT_V2_CSS to it.
const TEXT_V2_ROOT_ATTR = 'data-carousel-text-v2';
const TEXT_V2_ANIMATION_ID = 'carousel-text-v2';
const TEXT_V2 = {
  outDuration: 450,
  outStagger: 40,
  outEase: 'cubic-bezier(0.55, 0, 0.45, 1)',
  outY: '-0.4em',
  // The incoming text starts as the outgoing text finishes.
  inDelay: 380,
  inStagger: 90,
  inDuration: 800,
  inEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inY: '0.8em',
};

// ─── Slide text animation v3 — [data-carousel-text-animate="v3"] ─────────────────
// Line by line, as fluid.glass does it (taken from their code): each text
// element is split into masked lines (utils/splitLines.js). On a slide change
// the old slide's text fades out while the new slide's text fades in and its
// lines rise into place from two line-heights below, top line first — the
// same on every change, whichever way it goes — all starting together.
// Links / buttons (and anything holding media) aren't split; they just fade
// with their slide. The active slide's text also plays in, line by line, when
// the carousel's top comes into view, and again each time its tab panel is
// shown.
const TEXT_V3_SELECTOR = '[data-carousel-text-animate="v3"]';
const TEXT_V3_ROOT_ATTR = 'data-carousel-text-v3';
const TEXT_V3 = {
  // Lines rise with utils/splitLines.js riseLines (fluid.glass's 200% / 1.5s /
  // power3.out / 0.1s, on the compositor). The slide's text fades over / out
  // with GSAP's default 0.5s, as theirs.
  fadeDuration: 0.5,
  fadeEase: 'power3.inOut',
  // Unsplit pieces (buttons) fade in over the lines' duration on first view.
  introFadeDuration: 1.5,
  introFadeEase: 'power3.out',
};
// Elements animated whole rather than split into lines.
const TEXT_V3_BLOCK = 'a, button, input, select, textarea';
const TEXT_V3_HAS_MEDIA = 'img, svg, video, picture, iframe, a, button';

// ─── Slide picture parallax — [data-carousel-img-animate="parallax"] ─────────
// Each picture is moved against its slide's travel by `travel` of the slide's
// width per slide width the slide is away from its resting place (up to one),
// and enlarged by twice that, so its edges never show. The picture's parent
// (the slide) clips it.
const IMG_PARALLAX_SELECTOR = '[data-carousel-img-animate="parallax"]';
const IMG_PARALLAX_ROOT_ATTR = 'data-carousel-img-parallax';
const IMG_PARALLAX = { travel: 0.06 };
const IMG_PARALLAX_CSS = `
[${IMG_PARALLAX_ROOT_ATTR}] :has(> ${IMG_PARALLAX_SELECTOR}) {
  overflow: clip;
}
[${IMG_PARALLAX_ROOT_ATTR}] ${IMG_PARALLAX_SELECTOR} {
  will-change: transform;
}
`;

// ─── Module state ────────────────────────────────────────────────────────────
/** Embla factory — set once the library chunk has loaded. */
let EmblaCarousel = null;
let libraryPromise = null;
// Sliders that came into view before Embla arrived; initialised when it does.
let pendingSliders = [];
// Every initialised slider, so destroyCarousels() reaches them even once
// they've left the page (a Barba page swap removes the old page first).
const liveSliders = new Set();
// The lazy-init IntersectionObserver (one at a time — see initCarousel()).
let carouselObserver = null;
// Counter for generated viewport ids (aria-controls on slide buttons).
let carouselUid = 0;
const syncedSliderGroups = new Map();
/** utils/maskReveal (and GSAP with it) — loaded for mask carousels only. */
let maskRevealModule = null;
let maskRevealPromise = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCarouselTokens(slider) {
  const attrValue = slider.getAttribute('data-carousel');
  if (!attrValue) return [];
  return attrValue
    .toLowerCase()
    .split(/[\s,|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isMaskCarousel(slider) {
  return slider.getAttribute('data-carousel-effect') === 'mask';
}

// Mask carousels count as fade carousels: they share the stacked layout and
// every fade nav path (manual wrapping, swipe, autoplay) — only the visual
// switch in updateActiveSlides() differs.
function isFadeCarousel(slider) {
  return slider.getAttribute('data-carousel-effect') === 'fade' || isMaskCarousel(slider);
}

// data-carousel="mobile" / "tablet" carousels only initialise below that width.
function shouldInitForViewport(slider) {
  const tokens = getCarouselTokens(slider);
  if (typeof window === 'undefined') return true;
  if (tokens.includes('mobile')) {
    return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
  }
  if (tokens.includes('tablet')) {
    return window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`).matches;
  }
  return true;
}

/** Integer attribute value, or `fallback` when missing / not a number. */
function readIntAttr(el, name, fallback) {
  const value = Number.parseInt(el.getAttribute(name), 10);
  return Number.isFinite(value) ? value : fallback;
}

/** Numeric (float) attribute value, or `fallback` when missing / not a number. */
function readFloatAttr(el, name, fallback) {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

/** An element from a selector string, or the element itself. */
function resolveElement(target) {
  return typeof target === 'string' ? document.querySelector(target) : target;
}

/** Run teardown callbacks; one that throws is logged and the rest still run. */
function runCleanups(tasks, context) {
  tasks.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      handleError(error, context);
    }
  });
}

// ─── Injected styles ─────────────────────────────────────────────────────────
// Each block goes into <head> once, the first time a carousel needs it. The
// :where() rules sit at zero specificity so Webflow styles always win.
const injectedStyles = new Set();

function injectStyles(attr, css) {
  if (injectedStyles.has(attr) || typeof document === 'undefined') return;
  injectedStyles.add(attr);
  const style = document.createElement('style');
  style.setAttribute(attr, 'true');
  style.textContent = css;
  document.head.appendChild(style);
}

// Fade/mask carousels: v1 slide text + image entrance animations. The doubled
// attribute selectors keep them at (0,2,0) so a single Webflow class can't
// override the hidden/shown states.
const FADE_ANIMATE_CSS = `
[data-carousel-text-animate="v1"][data-carousel-text-animate="v1"] {
  opacity: 0;
  transform: translateY(12px);
  transition-property: opacity, transform;
  transition-duration: 0.5s;
  transition-timing-function: ease;
  transition-delay: 0s;
}
.is-active [data-carousel-text-animate="v1"][data-carousel-text-animate="v1"] {
  opacity: 1;
  transform: translateY(0);
}
.is-active .quote-card-head [data-carousel-text-animate="v1"][data-carousel-text-animate="v1"] {
  transition-delay: 0.15s;
}
.is-active .review-block-bottom [data-carousel-text-animate="v1"][data-carousel-text-animate="v1"]:nth-of-type(1) {
  transition-delay: 0.3s;
}
.is-active .review-block-bottom [data-carousel-text-animate="v1"][data-carousel-text-animate="v1"]:nth-of-type(2) {
  transition-delay: 0.45s;
}

[data-carousel-img-animate="v1"][data-carousel-img-animate="v1"] {
  opacity: 0;
  transform: scale(0.95);
  transition-property: opacity, transform;
  transition-duration: 0.6s;
  transition-timing-function: ease;
  transition-delay: 0s;
}
.is-active [data-carousel-img-animate="v1"][data-carousel-img-animate="v1"] {
  opacity: 1;
  transform: scale(1);
  transition-delay: 0.2s;
}

/* Kept from the original project: on pages with a fade carousel, the injected
   Pause/Play toggle (.autoplay-toggle) is hidden. */
.autoplay-toggle {
  display: none;
}
`;

// Mask carousel layers. Both stay in flow, so the slide keeps its natural
// height for the fade layout's height lock.
const MASK_ROOT = '[data-carousel][data-carousel-effect="mask"]';
const MASK_CSS = `
:where(${MASK_ROOT} [data-carousel-container] > *) {
  overflow: hidden;
}
:where(${MASK_ROOT} [data-carousel-mask-wrap]) {
  position: relative;
  overflow: hidden;
  will-change: transform;
}
:where(${MASK_ROOT} [data-carousel-mask-media]) {
  display: block;
  width: 100%;
  will-change: transform;
}
`;

// v2 text end states only: hidden on inactive slides, left to its own CSS on
// the active one — the animations run between these, so no fill-mode
// leftovers. Scoped to initialised carousels, so text never hides before the
// script runs (or if it fails).
const TEXT_V2_CSS = `
[${TEXT_V2_ROOT_ATTR}] [data-carousel-container] > :not(.is-active) ${TEXT_V2_SELECTOR}${TEXT_V2_SELECTOR} {
  opacity: 0;
}
`;

// Generated dots are native <button>s (focus, Enter/Space and screen-reader
// semantics for free) but carry no styling of their own: this strips the
// browser's button chrome, so site CSS (.carousel-dot { … }) owns their look.
const DOT_RESET_CSS = `
:where(button[data-carousel-dot]) {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  line-height: inherit;
  cursor: pointer;
}
`;

// data-active-in-view: the active slide gets a positioning context + z-index
// so content overflowing its box (e.g. a video player wider than the slide)
// renders above its neighbours instead of under them.
const ACTIVE_IN_VIEW_CSS = `
[data-carousel][data-active-in-view] [data-carousel-container] > * {
  cursor: pointer;
}
[data-carousel][data-active-in-view] [data-carousel-container] > .is-active {
  position: relative;
  z-index: 2;
}
`;

const ensureFadeCarouselAnimateStyles = () =>
  injectStyles('data-carousel-fade-animate', FADE_ANIMATE_CSS);
const ensureMaskCarouselStyles = () => injectStyles('data-carousel-mask-style', MASK_CSS);
const ensureTextV2Styles = () => injectStyles('data-carousel-text-v2-style', TEXT_V2_CSS);
const ensureDotButtonResetStyles = () => injectStyles('data-carousel-dot-reset', DOT_RESET_CSS);
const ensureActiveInViewStyles = () =>
  injectStyles('data-carousel-active-in-view-style', ACTIVE_IN_VIEW_CSS);

// ─── Fade layout ─────────────────────────────────────────────────────────────
// Inline styles the fade layout (applyFadeMeasureLayout, applyFadeLayout,
// updateActiveSlides) puts on the container and on each slide.
const FADE_CONTAINER_PROPS = [
  'position',
  'display',
  'flexDirection',
  'flexWrap',
  'height',
  'transform',
  'transition',
];
const FADE_SLIDE_PROPS = [
  'position',
  'inset',
  'width',
  'flex',
  'minWidth',
  'opacity',
  'zIndex',
  'willChange',
  'transition',
  'pointerEvents',
];

/**
 * Strip every inline style the fade layout left behind (and Embla's
 * translate), so a later init measures the slides in their natural flow —
 * leaving any of them (notably width:100%) keeps the slides stacked and Embla
 * collapses to a single snap. Hidden slides are made reachable again too.
 * @param {HTMLElement} slider
 */
function resetFadeInlineStyles(slider) {
  const container = slider.querySelector(CONTAINER_SELECTOR);
  if (!container) return;
  FADE_CONTAINER_PROPS.forEach((prop) => {
    container.style[prop] = '';
  });
  Array.from(container.children).forEach((slide) => {
    FADE_SLIDE_PROPS.forEach((prop) => {
      slide.style[prop] = '';
    });
    slide.inert = false;
    slide.removeAttribute('aria-hidden');
  });
}

/**
 * Line fade/mask slides up one per view — in a row, or a column with
 * data-vertical — so Embla measures one snap per slide; applyFadeLayout()
 * stacks them right after. That makes the list's own Webflow layout
 * irrelevant: a block list, a column, or absolutely positioned items (the
 * usual way to stack a hero slider) would otherwise measure as a single snap.
 * @param {HTMLElement} container
 * @param {boolean} vertical
 */
function applyFadeMeasureLayout(container, vertical) {
  container.style.display = 'flex';
  container.style.flexDirection = vertical ? 'column' : 'row';
  container.style.flexWrap = 'nowrap';
  Array.from(container.children).forEach((slide) => {
    slide.style.position = 'relative';
    slide.style.inset = 'auto';
    slide.style.flex = '0 0 100%';
    slide.style.minWidth = '0';
  });
}

// ─── Loading ─────────────────────────────────────────────────────────────────
/**
 * The mask reveal (and GSAP with it), its own chunk — fetched only when a mask
 * carousel is about to initialise. A failed load resolves to null and those
 * carousels switch slides instantly instead.
 */
function loadMaskReveal() {
  if (!maskRevealPromise) {
    maskRevealPromise = import('../utils/maskReveal')
      .then((module) => {
        maskRevealModule = module;
        return module;
      })
      .catch((error) => {
        handleError(error, 'Carousel Mask Reveal Loader');
        maskRevealPromise = null;
        return null;
      });
  }
  return maskRevealPromise;
}

/**
 * Embla, as its own chunk — fetched the first time a (non-marquee) carousel
 * nears the viewport. Sliders queued meanwhile are initialised on arrival.
 */
async function loadCarouselLibrary() {
  if (EmblaCarousel) return;
  if (!libraryPromise) {
    libraryPromise = (async () => {
      try {
        ({ default: EmblaCarousel } = await import('embla-carousel'));
        if (pendingSliders.length) {
          logger.log(`Initializing ${pendingSliders.length} pending carousel(s)...`);
          initializeCarousels(pendingSliders);
          pendingSliders = [];
        }
      } catch (error) {
        handleError(error, 'Carousel Library Loader');
        libraryPromise = null;
        throw error;
      }
    })();
  }
  await libraryPromise;
}

/**
 * The library chunk couldn't load (offline, blocked, a failed deploy): hide the
 * prev/next and dot controls rather than leave them doing nothing.
 * [data-carousel-failed] is there for any styling fallback.
 */
function markCarouselFailed(slider) {
  slider.setAttribute('data-carousel-failed', '');
  slider.querySelectorAll(`${BTNS_WRAPPER_SELECTOR}, ${DOTS_CONTAINER_SELECTOR}`).forEach((el) => {
    el.hidden = true;
  });
}

function loadAndInitSliderSafely(slider) {
  loadAndInitSlider(slider).catch(() => markCarouselFailed(slider));
}

async function loadAndInitSlider(slider) {
  if (slider._carouselInitialized) return;

  if (getCarouselTokens(slider).includes('marquee')) {
    initializeMarqueeWithRetry(slider);
    return;
  }

  // A mask carousel needs its reveal before it initialises, and the library
  // loader initialises queued sliders the moment Embla arrives — so fetch both
  // (in parallel) before queueing it.
  if (isMaskCarousel(slider) && !maskRevealModule) {
    await Promise.all([loadMaskReveal(), loadCarouselLibrary()]);
    if (slider._carouselInitialized) return;
  }

  if (!EmblaCarousel) {
    if (!pendingSliders.includes(slider)) pendingSliders.push(slider);
    await loadCarouselLibrary();
  }

  if (!slider._carouselInitialized) initializeCarousels([slider]);
}

// A marquee measures its content to decide whether it needs to scroll at all;
// images/fonts can still be loading, so an attempt that finds nothing to do
// is retried a few times with growing delays.
function initializeMarqueeWithRetry(slider, attempt = 0) {
  if (!slider || slider._carouselInitialized) return;
  if (!slider.isConnected) return;
  if (!shouldInitForViewport(slider)) return;

  if (slider._marqueeRetryTimer) {
    window.clearTimeout(slider._marqueeRetryTimer);
    slider._marqueeRetryTimer = null;
  }

  const marqueeCleanup = initMarquee(slider);
  if (marqueeCleanup.length) {
    slider._carouselInitialized = true;
    liveSliders.add(slider);
    slider._carouselCleanup = marqueeCleanup;
    return;
  }

  if (attempt >= MARQUEE_INIT_RETRY_DELAYS.length - 1) return;

  slider._marqueeRetryTimer = window.setTimeout(
    () => {
      initializeMarqueeWithRetry(slider, attempt + 1);
    },
    MARQUEE_INIT_RETRY_DELAYS[attempt + 1]
  );
}

/**
 * Wire every [data-carousel] on the page: shared styles now, each carousel as
 * it nears the viewport. Safe to call again (page transitions) — the previous
 * observer is replaced, and initialised carousels are skipped.
 */
export function initCarousel() {
  const sliders = Array.from(document.querySelectorAll(ROOT_SELECTOR));
  if (!sliders.length) return;

  if (sliders.some(isFadeCarousel)) ensureFadeCarouselAnimateStyles();
  if (sliders.some(isMaskCarousel)) ensureMaskCarouselStyles();
  if (sliders.some((slider) => slider.hasAttribute('data-active-in-view'))) {
    ensureActiveInViewStyles();
  }

  logger.log(`⏳ Found ${sliders.length} carousel(s) - will load when visible...`);

  carouselObserver?.disconnect();
  carouselObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(({ isIntersecting, target: slider }) => {
        if (!isIntersecting || !shouldInitForViewport(slider)) return;
        observer.unobserve(slider);
        slider.setAttribute('data-carousel-observed', 'true');
        loadAndInitSliderSafely(slider);
      });
    },
    { rootMargin: '200px' }
  );
  sliders.forEach((slider) => carouselObserver.observe(slider));
}

/**
 * Initialize a continuous marquee (ticker) carousel.
 * Clones slides once for seamless looping, then drives position with rAF.
 * @param {HTMLElement} slider
 * @returns {Array<Function>} cleanup tasks
 */
function initMarquee(slider) {
  const container = slider.querySelector(CONTAINER_SELECTOR);
  if (!container) return [];

  const removeClones = () =>
    Array.from(container.children)
      .filter((child) => child.hasAttribute(MARQUEE_CLONE_ATTR))
      .forEach((clone) => clone.remove());

  // Drop clones left over from a previous init (a crash path where the cleanup
  // below never ran), so a destroy → init cycle never clones the clones.
  removeClones();

  const originalSlides = Array.from(container.children);
  if (!originalSlides.length) return [];

  const speed = readIntAttr(slider, 'data-speed', 80);
  const reverse = slider.getAttribute('data-direction') === 'reverse';
  const pauseOnHover = slider.hasAttribute('data-pause-on-hover');

  const wrapper = slider.querySelector(VIEWPORT_SELECTOR) || slider;
  wrapper.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexWrap = 'nowrap';
  container.style.willChange = 'transform';

  const originalSetWidth = container.scrollWidth;
  const viewportWidth = wrapper.clientWidth;
  if (originalSetWidth <= viewportWidth + 1) {
    container.style.transform = 'none';
    return [];
  }

  // Clone slides so the loop is seamless (tagged so re-init/cleanup can
  // tell them apart from author slides)
  originalSlides.forEach((slide) => {
    const clone = slide.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute(MARQUEE_CLONE_ATTR, '');
    // aria-hidden alone leaves any links in the clone in the Tab order (and
    // silent to screen readers); inert removes them. Clones must not repeat
    // the originals' ids either.
    clone.inert = true;
    [clone, ...clone.querySelectorAll('[id]')].forEach((node) => node.removeAttribute('id'));
    container.appendChild(clone);
  });

  // One set width = half of total scrollWidth (original + clones)
  let setWidth = container.scrollWidth / 2;

  let offset = 0;
  // Pause reasons: pointer over (data-pause-on-hover), keyboard focus inside
  // (always), and the user's Pause/Play control.
  let hoverPaused = false;
  let focusPaused = false;
  let userPaused = false;
  let lastTime = null;
  let rafId = null;

  // Honor the OS-level reduced-motion preference: keep the marquee static while
  // it is on, and react live if the user toggles the setting mid-session.
  const motionQuery =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  let motionPaused = Boolean(motionQuery && motionQuery.matches);
  const isPaused = () => hoverPaused || focusPaused || userPaused || motionPaused;

  // The loop stops scheduling frames while paused (no idle 60–120 Hz rAF loop,
  // including for reduced-motion users); run() restarts it once the last
  // pause reason clears.
  function tick(timestamp) {
    if (isPaused() || setWidth <= 0) {
      rafId = null;
      lastTime = null;
      return;
    }
    if (!lastTime) lastTime = timestamp;
    const delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    offset += speed * delta;
    if (offset >= setWidth) offset -= setWidth;
    container.style.transform = `translateX(${reverse ? offset : -offset}px)`;

    rafId = requestAnimationFrame(tick);
  }

  const run = () => {
    if (rafId !== null || isPaused()) return;
    lastTime = null;
    rafId = requestAnimationFrame(tick);
  };

  const motionChangeHandler = (event) => {
    motionPaused = event.matches;
    run();
  };
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener('change', motionChangeHandler);
  }

  run();

  const resizeHandler = debounce(() => {
    setWidth = container.scrollWidth / 2;
  }, 150);
  window.addEventListener('resize', resizeHandler);

  const cleanupTasks = [
    () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    () => window.removeEventListener('resize', resizeHandler),
    () => {
      if (motionQuery && motionQuery.removeEventListener) {
        motionQuery.removeEventListener('change', motionChangeHandler);
      }
    },
    // Restore the container so a later re-init starts from the author's slides
    () => {
      container.style.transform = '';
      removeClones();
    },
  ];

  if (pauseOnHover) {
    const pauseHandler = () => {
      hoverPaused = true;
    };
    const resumeHandler = () => {
      hoverPaused = false;
      run();
    };
    slider.addEventListener('mouseenter', pauseHandler);
    slider.addEventListener('mouseleave', resumeHandler);
    cleanupTasks.push(
      () => slider.removeEventListener('mouseenter', pauseHandler),
      () => slider.removeEventListener('mouseleave', resumeHandler)
    );
  }

  // Pause/Play control (WCAG 2.2.2) — author [data-carousel-autoplay-toggle] or an
  // injected button at the end of the slider. Not created under reduced
  // motion, where the marquee never moves.
  let toggle = null;
  if (!motionPaused) {
    toggle = setupAutoplayToggle({
      root: slider,
      attr: 'data-carousel-autoplay-toggle',
      noun: 'scrolling',
      place: (btn) => slider.appendChild(btn),
      onChange: (paused) => {
        userPaused = paused;
        if (!paused) {
          hoverPaused = false; // pressing Play means the pointer is over it
          run();
        }
      },
    });
    cleanupTasks.push(() => toggle.destroy());
  }
  const isOnToggle = (node) => Boolean(node && toggle?.el.contains(node));

  // Keyboard focus inside always pauses (not the Pause/Play control itself).
  const focusInHandler = (event) => {
    focusPaused = !isOnToggle(event.target);
    run();
  };
  const focusOutHandler = (event) => {
    const next = event.relatedTarget;
    if (next && slider.contains(next) && !isOnToggle(next)) return;
    focusPaused = false;
    run();
  };
  slider.addEventListener('focusin', focusInHandler);
  slider.addEventListener('focusout', focusOutHandler);
  cleanupTasks.push(
    () => slider.removeEventListener('focusin', focusInHandler),
    () => slider.removeEventListener('focusout', focusOutHandler)
  );

  return cleanupTasks;
}

/**
 * Initialize specific carousel instances
 * @param {Array|NodeList} sliderList
 */
function initializeCarousels(sliderList) {
  if (!sliderList || !sliderList.length) return;

  sliderList.forEach((slider) => {
    if (slider._carouselInitialized) return;
    if (!shouldInitForViewport(slider)) return;

    const carouselViewport = slider.querySelector(VIEWPORT_SELECTOR) || slider;
    // [data-carousel-container], when present, is what getSlides() and the fade layout work
    // on; Embla itself falls back to the viewport's first child.
    const carouselContainer = slider.querySelector(CONTAINER_SELECTOR);
    const resolvedContainer = carouselContainer || carouselViewport.children[0];
    if (!resolvedContainer) {
      logger.warn('Carousel has no slides container — check DOM structure:', slider);
      return;
    }

    slider._carouselInitialized = true;
    liveSliders.add(slider);

    const navButtonsWrapper = slider.querySelector(BTNS_WRAPPER_SELECTOR);
    const fallbackNavButtons = navButtonsWrapper
      ? Array.from(navButtonsWrapper.querySelectorAll(NAV_BTN_FALLBACK_SELECTOR))
      : [];

    const explicitNextBtn =
      slider.querySelector(LEGACY_NEXT_BTN_SELECTOR) || slider.querySelector(NEXT_BTN_SELECTOR);
    const explicitPrevBtn =
      slider.querySelector(LEGACY_PREV_BTN_SELECTOR) || slider.querySelector(PREV_BTN_SELECTOR);

    const prevBtn = explicitPrevBtn || fallbackNavButtons[0] || null;
    let nextBtn =
      explicitNextBtn ||
      (fallbackNavButtons.length > 1 ? fallbackNavButtons[1] : fallbackNavButtons[0]) ||
      null;

    if (prevBtn && nextBtn && prevBtn === nextBtn) {
      nextBtn = null;
    }

    let slideButtons = [];
    // Resolved slide index per button in slideButtons (explicit data-slide-index
    // wins; the rest take the unclaimed indices in DOM order) — see ensureDots().
    let slideButtonIndices = [];
    const customProgressBar = slider.querySelector(PROGRESS_BAR_SELECTOR);
    // Checked before ensureDots(): a template dot isn't a [data-slide-btn] yet.
    const hasButtonProgress = Boolean(
      slider.querySelector(
        `${SLIDE_BTN_SELECTOR} ${BTN_PROGRESS_SELECTOR}, ${DOT_SELECTOR} ${BTN_PROGRESS_SELECTOR}`
      )
    );
    // Autoplay runs on the rAF progress timer (freezing/resuming with the
    // hover/focus hold) whenever something displays its progress.
    const progressTimer = Boolean(customProgressBar || hasButtonProgress);
    const syncId = slider.getAttribute('data-sync');

    const centerMode = slider.hasAttribute('data-center');
    const centerBounds = slider.hasAttribute('data-center-bounds');
    const clickToCenter = slider.hasAttribute('data-click-center');
    const activeInView = slider.hasAttribute('data-active-in-view');
    const loopMode = slider.hasAttribute('data-loop');
    const disableDrag = slider.hasAttribute('data-no-drag');
    const dragFree = slider.hasAttribute('data-drag-free');
    const autoplayEnabled = slider.hasAttribute('data-autoplay');
    const autoplayStopOnInteraction = slider.hasAttribute('data-autoplay-stop-on-interaction');
    const pauseOnHover = slider.hasAttribute('data-pause-on-hover');
    const fadeMode = isFadeCarousel(slider);
    const verticalMode = slider.hasAttribute('data-vertical');
    const slideClassesEnabled = slider.hasAttribute('data-slide-classes');
    const alignAttr = slider.getAttribute('data-align');
    const autoplayDelay = readIntAttr(slider, 'data-autoplay-delay', 8000);
    const fadeDuration = Math.max(150, readIntAttr(slider, 'data-fade-duration', 650));
    const fadeEase = slider.getAttribute('data-fade-ease') || 'cubic-bezier(0.22, 1, 0.36, 1)';
    const maskMode = isMaskCarousel(slider);
    const maskDuration = Math.max(0, readFloatAttr(slider, 'data-mask-duration', 1.1));
    const maskEase = slider.getAttribute('data-mask-ease') || undefined; // → Pagtrans
    const maskParallax = readFloatAttr(slider, 'data-mask-parallax', 100);

    // Fade keeps every snap; centred carousels trim to their bounds only with
    // data-center-bounds; everything else trims.
    let containScroll = 'trimSnaps';
    if (fadeMode) containScroll = 'keepSnaps';
    else if (centerMode) containScroll = centerBounds ? 'keepSnaps' : false;

    const carouselOptions = {
      container: resolvedContainer,
      align: alignAttr || (centerMode ? 'center' : 'start'),
      containScroll,
      // No Embla loop for fade carousels: it works by cloning slides and
      // repositioning them with translate3d, which the stacked fade layout
      // (transform: none, position: absolute) destroys — Embla would then
      // scroll to blank clones. Fade carousels wrap manually instead (stepFade()
      // and a custom swipe listener).
      loop: fadeMode ? false : loopMode,
      watchDrag: fadeMode ? false : !disableDrag,
      dragFree: fadeMode ? false : dragFree,
      axis: verticalMode ? 'y' : 'x',
      // Non-fade: let Embla auto-reInit on resize so snap points track the new
      // slide widths. Fade: DISABLE it — Embla would re-measure while the slides
      // are absolutely stacked (fade layout) and collapse to a single snap. Our
      // own resize handler below does the correct reset-then-reInit instead.
      watchResize: !fadeMode,
      // Slides added/removed (CMS load-more, Finsweet): Embla reInits on its
      // own. Fade: un-stack and line the slides up first (same as the resize
      // path), or the re-measure sees them stacked and collapses to one snap.
      watchSlides: fadeMode
        ? () => {
            if (maskMode) finishMaskReveal();
            resetFadeInlineStyles(slider);
            if (carouselContainer) applyFadeMeasureLayout(carouselContainer, verticalMode);
            return true;
          }
        : true,
    };

    let carouselApi = null;
    const cleanupTasks = [];
    let scrollToIndex = () => {};
    let restartAutoplay = null;
    let lastButtonStateKey = null;

    // ─── Progress bar rAF state ───────────────────────────────────────────────
    let progressRafId = null;
    let progressStartTime = null;
    // Elapsed ms carried across a data-pause-on-hover pause so the fill resumes
    // from where it stopped instead of snapping back to 0%.
    let progressResumeOffset = 0;
    // True while autoplay is held by interaction — keyboard focus inside the
    // slider (always), or the pointer over it (with data-pause-on-hover).
    let interactionHold = false;
    // Autoplay stop reasons besides that hold. Every path that (re)starts
    // rotation checks autoplayBlocked(), so a stop sticks: a user who paused
    // (Pause button, or data-autoplay-stop-on-interaction) stays paused
    // through later slide changes, and a slide video that suspended autoplay
    // isn't overridden when the pointer/focus leaves the slider.
    let autoplayUserStopped = false;
    let autoplaySuspended = false;
    const autoplayBlocked = () => interactionHold || autoplayUserStopped || autoplaySuspended;
    let progressFillEl = null;
    // Slide count the fade layout was last applied for — lets applyFadeLayout()
    // skip the expensive measure/write pass on every select/scroll event.
    let fadeLayoutSlideCount = 0;

    // ─── Mask reveal state (data-carousel-effect="mask") ───────────────────────────────
    // Slide currently on screen — select has already moved Embla's index by the
    // time updateActiveSlides() runs, so this is what the reveal starts from.
    let maskShownIndex = null;
    // Slide wiping out during a reveal (kept visible under the incoming one).
    let maskOutgoingIndex = null;
    let maskTimeline = null;
    // Direction queued by stepFade() — it knows last → first is still "next".
    // 0 = derive from the index comparison (dots, sync, slide buttons).
    let maskPendingDirection = 0;
    // Set while re-measuring on resize, where Embla's index briefly resets.
    let maskSuppressed = false;
    // Autoplay step that came due mid-reveal — run once the reveal ends, so a
    // reveal longer than the autoplay delay delays rotation instead of stalling it.
    let maskQueuedStep = 0;

    // User navigation (buttons, dots, keyboard, swipe) is ignored while a
    // reveal runs, so a quick second click can't cut the current wipe short.
    const isMaskBusy = () => maskTimeline !== null;

    function getMaskLayers(slide) {
      if (!slide) return null;
      return {
        wrap: slide.querySelector(MASK_WRAP_SELECTOR) || slide,
        media: slide.querySelector(MASK_MEDIA_SELECTOR),
      };
    }

    /** Jump the running reveal (if any) to its end state. */
    function finishMaskReveal() {
      const timeline = maskTimeline;
      maskTimeline = null;
      timeline?.kill();
      slider.removeAttribute('data-mask-animating');
      if (maskOutgoingIndex !== null) {
        const outgoing = getSlides()[maskOutgoingIndex];
        maskOutgoingIndex = null;
        if (outgoing) {
          outgoing.style.opacity = '0';
          outgoing.style.zIndex = '1';
        }
      }
      if (maskRevealModule) {
        const layers = getSlides().map(getMaskLayers);
        maskRevealModule.resetMaskReveal(layers.flatMap((l) => [l.wrap, l.media]));
      }
    }

    /**
     * Start the reveal from the slide on screen to `activeIndex`. Runs before
     * updateActiveSlides() sets visibility, which keeps the outgoing slide shown.
     */
    function startMaskReveal(activeIndex) {
      const fromIndex = maskShownIndex;
      maskShownIndex = activeIndex;
      const direction = maskPendingDirection;
      maskPendingDirection = 0;
      if (fromIndex === null || fromIndex === activeIndex || maskSuppressed) return;

      finishMaskReveal();
      const slides = getSlides();
      const outgoing = getMaskLayers(slides[fromIndex]);
      const incoming = getMaskLayers(slides[activeIndex]);
      if (!maskRevealModule || !outgoing || !incoming) return;
      if (prefersReducedMotion() || maskDuration <= 0) return;

      maskOutgoingIndex = fromIndex;
      // Styling hook, e.g. [data-mask-animating] [data-carousel-btns] { cursor: wait }
      slider.setAttribute('data-mask-animating', '');
      maskTimeline = maskRevealModule.maskReveal({
        outgoing,
        incoming,
        direction: direction || (activeIndex > fromIndex ? 1 : -1),
        duration: maskDuration,
        ease: maskEase,
        parallax: maskParallax,
        axis: verticalMode ? 'y' : 'x',
        onComplete: () => {
          finishMaskReveal();
          runQueuedMaskStep();
        },
      });
    }

    function runQueuedMaskStep() {
      const step = maskQueuedStep;
      maskQueuedStep = 0;
      // Queued by autoplay — drop it if rotation was paused, held (hover/focus)
      // or suspended (a slide video) while the reveal ran.
      if (step && !autoplayBlocked()) stepFade(step);
    }

    // ─── Slide text v2 (see TEXT_V2) ──────────────────────────────────────────
    const textV2 = Boolean(slider.querySelector(TEXT_V2_SELECTOR));
    let textShownIndex = null;

    function cancelTextV2(elements) {
      elements.forEach((el) =>
        el.getAnimations().forEach((animation) => {
          if (animation.id === TEXT_V2_ANIMATION_ID) animation.cancel();
        })
      );
    }

    /**
     * Play the text hand-over from the slide on screen to `activeIndex`. Runs
     * before updateActiveSlides() moves .is-active, so the outgoing text is
     * read while still visible; both animations then override the CSS end
     * states until they finish.
     */
    function animateTextV2(activeIndex) {
      if (!textV2) return;
      const fromIndex = textShownIndex;
      textShownIndex = activeIndex;
      if (fromIndex === null || fromIndex === activeIndex || maskSuppressed) return;

      const slides = getSlides();
      const textsOf = (slide) =>
        slide ? Array.from(slide.querySelectorAll(TEXT_V2_SELECTOR)) : [];
      const outgoing = textsOf(slides[fromIndex]);
      const incoming = textsOf(slides[activeIndex]);
      if (prefersReducedMotion() || typeof Element.prototype.animate !== 'function') {
        cancelTextV2([...outgoing, ...incoming]); // CSS end states switch instantly
        return;
      }

      outgoing.forEach((el, index) => {
        // Start from where it is now — mid-way through its own entrance when
        // navigation is quick — rather than jumping back to fully shown.
        const { opacity, transform } = getComputedStyle(el);
        cancelTextV2([el]);
        const animation = el.animate(
          [
            { opacity, transform },
            { opacity: 0, transform: `translateY(${TEXT_V2.outY})` },
          ],
          {
            duration: TEXT_V2.outDuration,
            delay: index * TEXT_V2.outStagger,
            easing: TEXT_V2.outEase,
            fill: 'backwards', // hold the start frame through the stagger delay
          }
        );
        animation.id = TEXT_V2_ANIMATION_ID;
      });

      incoming.forEach((el, index) => {
        cancelTextV2([el]);
        const animation = el.animate(
          [
            { opacity: 0, transform: `translateY(${TEXT_V2.inY})` },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: TEXT_V2.inDuration,
            delay: TEXT_V2.inDelay + index * TEXT_V2.inStagger,
            easing: TEXT_V2.inEase,
            fill: 'backwards', // stay hidden until its turn
          }
        );
        animation.id = TEXT_V2_ANIMATION_ID;
      });
    }

    // ─── Slide text v3 (see TEXT_V3) ──────────────────────────────────────────
    const textV3 = Boolean(slider.querySelector(TEXT_V3_SELECTOR)) && !prefersReducedMotion();
    // Text element → its split handle (lines refresh on every re-split).
    const textV3Splits = new Map();
    let textV3Ready = false; // split, states set, watching visibility
    let textV3Revealed = false; // the active slide's text has played in
    let textV3ShownIndex = null;
    let textV3Timeline = null; // the fades (GSAP)
    let textV3Rise = null; // the lines (compositor)

    const isTextV3Block = (el) =>
      el.matches(TEXT_V3_BLOCK) || Boolean(el.querySelector(TEXT_V3_HAS_MEDIA));

    /** A slide's v3 elements, and their split lines in reading order. */
    function textV3Of(slide) {
      const elements = slide ? Array.from(slide.querySelectorAll(TEXT_V3_SELECTOR)) : [];
      const lines = elements.flatMap((el) => textV3Splits.get(el)?.lines() ?? []);
      return { elements, lines };
    }

    function hideTextV3({ elements, lines }) {
      gsap.set(elements, { autoAlpha: 0 });
      hideLines(lines);
    }

    function showTextV3({ elements, lines }) {
      gsap.set(elements, { autoAlpha: 1 });
      showLines(lines);
    }

    function killTextV3() {
      textV3Timeline?.kill();
      textV3Timeline = null;
      // Hold the lines where they are, so text mid-rise fades out from there.
      textV3Rise?.cancel({ hold: true });
      textV3Rise = null;
    }

    /** Every slide's v3 text in its resting state for the current index. */
    function syncTextV3() {
      if (!textV3Ready || !carouselApi) return;
      killTextV3();
      const activeIndex = carouselApi.selectedScrollSnap();
      getSlides().forEach((slide, index) => {
        if (index === activeIndex && textV3Revealed) showTextV3(textV3Of(slide));
        else hideTextV3(textV3Of(slide));
      });
    }

    /** Lines rising into place from below, top line first. */
    function riseTextV3(lines) {
      textV3Rise = riseLines(lines, { from: 200 });
    }

    /** The active slide's text plays in (first view, or its tab shown again). */
    function playTextV3Intro() {
      killTextV3();
      const { elements, lines } = textV3Of(getSlides()[carouselApi.selectedScrollSnap()]);
      const timeline = gsap.timeline();
      // Split text shows at once (its lines are what move); unsplit pieces fade in.
      const blocks = elements.filter((el) => !textV3Splits.has(el));
      gsap.set(
        elements.filter((el) => textV3Splits.has(el)),
        { autoAlpha: 1 }
      );
      riseTextV3(lines);
      if (blocks.length) {
        timeline.fromTo(
          blocks,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: TEXT_V3.introFadeDuration, ease: TEXT_V3.introFadeEase },
          0
        );
      }
      textV3Timeline = timeline;
    }

    /**
     * Hand the text over from the slide on screen to `activeIndex`. Called from
     * updateActiveSlides() before the slide classes move.
     */
    function animateTextV3(activeIndex) {
      if (!textV3) return;
      const fromIndex = textV3ShownIndex;
      textV3ShownIndex = activeIndex;
      if (!textV3Ready || fromIndex === null || fromIndex === activeIndex || maskSuppressed) return;

      const slides = getSlides();
      if (!textV3Revealed) {
        // Not played in yet (off screen / hidden tab): just keep everything hidden.
        slides.forEach((slide) => hideTextV3(textV3Of(slide)));
        return;
      }

      killTextV3();
      slides.forEach((slide, index) => {
        if (index !== fromIndex && index !== activeIndex) hideTextV3(textV3Of(slide));
      });

      const outgoing = textV3Of(slides[fromIndex]);
      const incoming = textV3Of(slides[activeIndex]);
      const fade = { duration: TEXT_V3.fadeDuration, ease: TEXT_V3.fadeEase };
      const timeline = gsap.timeline({
        // Park the old slide's lines below their masks for its next entrance.
        onComplete: () => hideLines(outgoing.lines),
      });
      // Fade from wherever it is now (mid-entrance on quick navigation).
      timeline.to(outgoing.elements, { autoAlpha: 0, ...fade }, 0);
      timeline.fromTo(incoming.elements, { autoAlpha: 0 }, { autoAlpha: 1, ...fade }, 0);
      riseTextV3(incoming.lines);
      textV3Timeline = timeline;
    }

    /** Split the v3 text, set its states and start watching the carousel's visibility. */
    function initTextV3() {
      slider.setAttribute(TEXT_V3_ROOT_ATTR, '');
      let observer = null;
      let cancelled = false;
      // A re-split (resize, a hidden tab shown) replaces the line elements:
      // put every slide back in its resting state, once per batch.
      let resyncQueued = false;
      const queueSync = () => {
        if (resyncQueued) return;
        resyncQueued = true;
        queueMicrotask(() => {
          resyncQueued = false;
          syncTextV3();
        });
      };

      fontsReady().then(() => {
        if (cancelled) return;
        slider.querySelectorAll(TEXT_V3_SELECTOR).forEach((el) => {
          if (isTextV3Block(el) || !el.textContent.trim()) return;
          textV3Splits.set(el, splitLines(el, queueSync));
        });
        textV3Ready = true;
        textV3ShownIndex = carouselApi ? carouselApi.selectedScrollSnap() : 0;
        syncTextV3();

        // Play in on first view; when hidden (display: none — a closed tab),
        // reset so it plays in again the next time it's shown. Scrolling out
        // of view doesn't reset it.
        observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              if (textV3Revealed) return;
              textV3Revealed = true;
              playTextV3Intro();
            } else if (!slider.getClientRects().length) {
              textV3Revealed = false;
              syncTextV3();
            }
          },
          { threshold: 0 }
        );
        observer.observe(slider);
      });

      cleanupTasks.push(() => {
        cancelled = true;
        observer?.disconnect();
        killTextV3();
        textV3Splits.forEach((split) => split.revert());
        textV3Splits.clear();
        slider.querySelectorAll(TEXT_V3_SELECTOR).forEach((el) => {
          gsap.set(el, { clearProps: 'opacity,visibility,transform' });
        });
        slider.removeAttribute(TEXT_V3_ROOT_ATTR);
        textV3Ready = false;
        textV3Revealed = false;
      });
    }

    // ─── Slide picture parallax (see IMG_PARALLAX) ─────────────────────────────
    let imgParallax = null; // { apply, measure } once set up

    /** Move every picture by how far its slide is from where slides rest. */
    function initImgParallax() {
      const pictures = getSlides()
        .map((slide) => ({ slide, picture: slide.querySelector(IMG_PARALLAX_SELECTOR) }))
        .filter(({ picture }) => picture);
      if (!pictures.length) return;
      injectStyles(IMG_PARALLAX_ROOT_ATTR, IMG_PARALLAX_CSS);
      slider.setAttribute(IMG_PARALLAX_ROOT_ATTR, '');
      const { travel } = IMG_PARALLAX;
      const scale = 1 + 2 * travel;
      // Where a slide's left edge rests in the viewport when it's selected —
      // measured with the track at rest (set up, and every re-init / resize).
      let rest = 0;
      const measure = () => {
        const selected = getSlides()[carouselApi.selectedScrollSnap()];
        if (!selected) return;
        rest =
          selected.getBoundingClientRect().left - carouselViewport.getBoundingClientRect().left;
      };
      const apply = () => {
        const left = carouselViewport.getBoundingClientRect().left + rest;
        pictures.forEach(({ slide, picture }) => {
          const box = slide.getBoundingClientRect();
          if (!box.width) return;
          const away = Math.max(-1, Math.min(1, (box.left - left) / box.width));
          picture.style.transform = `translate3d(${(-away * travel * 100).toFixed(3)}%, 0, 0) scale(${scale})`;
        });
      };
      measure();
      apply();
      imgParallax = { apply, measure };
      cleanupTasks.push(() => {
        imgParallax = null;
        pictures.forEach(({ picture }) => picture.style.removeProperty('transform'));
        slider.removeAttribute(IMG_PARALLAX_ROOT_ATTR);
      });
    }

    /**
     * Resolve (and cache) the fill element inside [data-carousel-progress-bar].
     * @returns {HTMLElement|null}
     */
    function getProgressFill() {
      if (!customProgressBar) return null;
      if (progressFillEl) return progressFillEl;
      progressFillEl = customProgressBar.querySelector(PROGRESS_FILL_SELECTOR);
      if (!progressFillEl && customProgressBar.children.length === 1) {
        // Migration aid: older markup carried class="carousel-progress-fill" with
        // no attribute. When the bar has exactly one child, treat it as the fill
        // and stamp the attribute so CSS/JS can target it consistently.
        progressFillEl = customProgressBar.firstElementChild;
        progressFillEl.setAttribute('data-carousel-progress-fill', '');
      }
      return progressFillEl;
    }

    /** Mirror the bar's state onto data-progress / data-current-slide / data-total-slides. */
    function setProgressAttributes(progress) {
      if (!carouselApi) return;
      customProgressBar.setAttribute('data-progress', Math.round(progress));
      customProgressBar.setAttribute('data-current-slide', carouselApi.selectedScrollSnap() + 1);
      customProgressBar.setAttribute('data-total-slides', carouselApi.scrollSnapList().length);
    }

    /**
     * Fill the active slide button's [data-carousel-btn-progress] to `progress`
     * (0–100) and empty every other one.
     */
    function renderButtonProgress(progress) {
      if (!hasButtonProgress || !carouselApi) return;
      const activeIndex = carouselApi.selectedScrollSnap();
      slideButtons.forEach((button, arrayIndex) => {
        const fill = button.querySelector(BTN_PROGRESS_SELECTOR);
        if (!fill) return;
        const isActive = (slideButtonIndices[arrayIndex] ?? arrayIndex) === activeIndex;
        fill.style.transform = `scaleX(${isActive ? progress / 100 : 0})`;
      });
    }

    /**
     * Cancel any in-flight progress bar animation and optionally reset the fill.
     * @param {boolean} [reset=true] - whether to zero out the fill width
     */
    function cancelProgressBar(reset = true) {
      if (progressRafId !== null) {
        cancelAnimationFrame(progressRafId);
        progressRafId = null;
      }
      progressStartTime = null;
      if (!reset) return;
      const fill = getProgressFill();
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      }
      renderButtonProgress(0);
    }

    /**
     * Start the progress bar rAF loop for the current slide.
     * The fill grows from 0 → 100% over `autoplayDelay` ms, then
     * advances the carousel to the next slide.
     * @param {boolean} [resume=false] - continue from a data-pause-on-hover pause
     *   instead of restarting the fill at 0%.
     */
    function startProgressBar(resume = false) {
      if (!progressTimer || !autoplayEnabled) return;
      // onSelect calls this directly (not via startAutoplay), so the
      // reduced-motion gate must live here too — otherwise one manual
      // navigation would restart perpetual rotation for reduced-motion users.
      // Item fills then just mark the active item.
      if (prefersReducedMotion()) {
        renderButtonProgress(100);
        return;
      }
      const fill = getProgressFill();
      if (!fill && !hasButtonProgress) return;

      if (!resume) {
        progressResumeOffset = 0;
        if (fill) {
          fill.style.transition = 'none';
          fill.style.width = '0%';
          void fill.offsetWidth; // commit the reset before the fill starts growing
        }
        renderButtonProgress(0);
      }

      // While held (hover/focus pause) or stopped/suspended, leave the bar
      // frozen; releasing the hold restarts the loop. (A fresh start above
      // still zeroes the fill so slide changes made while held don't resume
      // mid-bar on the new slide.) Without this check, a manual slide change
      // after the user stopped autoplay restarted rotation via onSelect.
      if (autoplayBlocked()) return;

      progressStartTime = null;

      function tick(timestamp) {
        if (progressStartTime === null) {
          // Backdate the start by any elapsed time carried across a hover pause
          progressStartTime = timestamp - progressResumeOffset;
          progressResumeOffset = 0;
        }
        const elapsed = timestamp - progressStartTime;
        const progress = Math.min((elapsed / autoplayDelay) * 100, 100);

        if (fill) {
          fill.style.width = `${progress}%`;
          setProgressAttributes(progress);
        }
        renderButtonProgress(progress);

        if (progress < 100) {
          progressRafId = requestAnimationFrame(tick);
        } else {
          progressRafId = null;
          progressStartTime = null;
          if (carouselApi) {
            if (fadeMode) {
              stepFade(1, { queueIfBusy: true });
            } else if (carouselApi.canScrollNext()) {
              carouselApi.scrollNext();
            } else {
              carouselApi.scrollTo(0);
            }
          }
        }
      }

      progressRafId = requestAnimationFrame(tick);
    }

    /**
     * Update the progress bar for non-autoplay carousels.
     * Shows discrete percentage based on selected slide index.
     */
    function updateStaticProgressBar() {
      if (autoplayEnabled || !carouselApi) return;
      // Without autoplay, an item fill simply marks the active item.
      renderButtonProgress(100);
      const fill = getProgressFill();
      if (!fill) return;

      const totalSlides = carouselApi.scrollSnapList().length;
      const currentIndex = carouselApi.selectedScrollSnap();
      const progress = totalSlides > 1 ? Math.round((currentIndex / (totalSlides - 1)) * 100) : 100;

      fill.style.width = `${progress}%`;
      setProgressAttributes(progress);
    }

    function getSlides() {
      if (carouselContainer) {
        return Array.from(carouselContainer.children);
      }
      // No [data-carousel-container] — fall back to explicitly tagged slides
      return Array.from(slider.querySelectorAll(SLIDE_FALLBACK_SELECTOR));
    }

    /**
     * Advance a fade carousel by `direction` (+1 / -1), wrapping at both ends.
     * Fade mode disables Embla's clone-based loop, so wrapping is always manual
     * — every nav path (buttons, keyboard, autoplay, swipe) goes through this
     * one helper so their loop behaviour can't drift apart.
     * Mask carousels ignore the step while a reveal runs; autoplay passes
     * `queueIfBusy` so its step runs as soon as the reveal ends instead.
     */
    function stepFade(direction, { queueIfBusy = false } = {}) {
      if (!carouselApi) return false;
      if (isMaskBusy()) {
        if (queueIfBusy) maskQueuedStep = direction;
        return false;
      }
      const totalSlides = carouselApi.scrollSnapList().length;
      if (totalSlides < 2) return false;
      const currentIndex = carouselApi.selectedScrollSnap();
      maskPendingDirection = direction;
      return scrollToIndex((currentIndex + direction + totalSlides) % totalSlides, true);
    }

    /**
     * Stack the slides (absolute, full width) inside a container locked to the
     * tallest slide. Re-measuring after a resize / slide change goes through
     * resetFadeInlineStyles() + applyFadeMeasureLayout() + Embla reInit first.
     */
    function applyFadeLayout() {
      if (!fadeMode || !carouselContainer) return;
      const slides = getSlides();
      if (!slides.length) return;
      // Embla writes a translate3d onto the container on EVERY navigation,
      // before emitting select/scroll. Neutralizing it is load-bearing for
      // fade mode (the absolutely-stacked slides would shift offscreen inside
      // the overflow:hidden viewport), so it must happen even when the
      // measure/write pass below is skipped.
      carouselContainer.style.transform = 'none';
      carouselContainer.style.transition = 'none';
      // Skip the measure/write pass when the layout is already applied — this
      // runs on every select/scroll event. The per-slide style check catches
      // fresh nodes swapped in with an unchanged count (e.g. CMS re-renders).
      if (
        fadeLayoutSlideCount === slides.length &&
        slides.every((slide) => slide.style.position === 'absolute')
      ) {
        return;
      }
      const previousHeight = carouselContainer.style.height;
      const maxHeight = slides.reduce((max, slide) => Math.max(max, slide.offsetHeight), 0);
      carouselViewport.style.overflow = 'hidden';
      carouselContainer.style.position = 'relative';
      carouselContainer.style.display = 'block';
      // Measuring is done — drop applyFadeMeasureLayout()'s row styles.
      carouselContainer.style.flexDirection = '';
      carouselContainer.style.flexWrap = '';
      if (maxHeight > 0) {
        carouselContainer.style.height = `${maxHeight}px`;
      } else if (previousHeight) {
        // Hidden subtree (display:none ancestor): offsetHeight measures 0.
        // Restore the last locked height instead of collapsing the carousel;
        // a resize while visible will re-measure properly.
        carouselContainer.style.height = previousHeight;
      }
      slides.forEach((slide) => {
        slide.style.position = 'absolute';
        slide.style.inset = '0';
        slide.style.width = '100%';
        slide.style.flex = '';
        slide.style.minWidth = '';
        // Mask mode swaps visibility instantly — the reveal does the transition.
        slide.style.willChange = maskMode ? '' : 'opacity';
        slide.style.transition = maskMode ? 'none' : `opacity ${fadeDuration}ms ${fadeEase}`;
      });
      fadeLayoutSlideCount = slides.length;
    }

    /**
     * Make `dot` a slide button for slide `index`. Clones always get a fresh
     * label (they'd otherwise all carry the template's); an author's own dot
     * keeps any label it already has.
     */
    function prepareDot(dot, index, isClone) {
      setOwnAttribute(dot, 'data-slide-btn', '');
      if (isClone || !dot.hasAttribute('aria-label')) {
        setOwnAttribute(dot, 'aria-label', `Go to slide ${index + 1}`);
      }
    }

    /**
     * One dot per slide inside [data-carousel-dots]. The first [data-carousel-dot] there
     * is the template: it becomes slide 1's dot and is cloned for the rest,
     * classes and inner markup included, so Webflow styles every dot. Already
     * one dot per slide (a re-init, or the author placed them all) → kept as-is.
     * No [data-carousel-dot] at all → author [data-slide-btn]s in the container are
     * used, else plain <button> dots are generated.
     * Clones/generated dots are tagged [data-carousel-dot-clone] and removed
     * again on destroy, leaving only the author's markup.
     */
    function buildDots(dotsContainer, slideCount) {
      const dots = Array.from(dotsContainer.querySelectorAll(DOT_SELECTOR));

      if (dots.length === slideCount) {
        dots.forEach((dot, index) => prepareDot(dot, index, dot.hasAttribute(DOT_CLONE_ATTR)));
        return;
      }

      const template = dots[0];
      if (template) {
        dots.slice(1).forEach((dot) => dot.remove());
        // State from a previous init (or the Designer) mustn't be copied into clones.
        template.classList.remove('is-active');
        template.removeAttribute('aria-current');
        template.removeAttribute('data-slide-index');
        prepareDot(template, 0, template.hasAttribute(DOT_CLONE_ATTR));
        let previous = template;
        for (let index = 1; index < slideCount; index += 1) {
          const clone = template.cloneNode(true);
          clone.setAttribute(DOT_CLONE_ATTR, '');
          [clone, ...clone.querySelectorAll('[id]')].forEach((node) => node.removeAttribute('id'));
          prepareDot(clone, index, true);
          previous.after(clone);
          previous = clone;
        }
        return;
      }

      const authorButtons = dotsContainer.querySelectorAll(SLIDE_BTN_SELECTOR);
      if (authorButtons.length) {
        if (authorButtons.length !== slideCount) {
          logger.warn(
            `Carousel has ${slideCount} slides but ${authorButtons.length} dot buttons. Button count should match slide count.`
          );
        }
        return;
      }

      // Fallback: native <button>s carrying NO styles of their own — the
      // zero-specificity reset strips the browser's button chrome and no inline
      // styles are set, so site CSS (.carousel-dot / [data-carousel-dot]) owns them.
      ensureDotButtonResetStyles();
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < slideCount; index += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.setAttribute('data-carousel-dot', '');
        dot.setAttribute(DOT_CLONE_ATTR, '');
        prepareDot(dot, index, true);
        fragment.appendChild(dot);
      }
      dotsContainer.appendChild(fragment);
    }

    // Attributes the carousel added to dots / slide buttons — not the author's —
    // so destroy can strip exactly those and leave the Webflow markup as it was.
    const addedAttributes = new Map();

    function setOwnAttribute(el, name, value) {
      if (!el.hasAttribute(name)) {
        if (!addedAttributes.has(el)) addedAttributes.set(el, new Set());
        addedAttributes.get(el).add(name);
      }
      el.setAttribute(name, value);
    }

    function removeOwnAttributes() {
      addedAttributes.forEach((names, el) => names.forEach((name) => el.removeAttribute(name)));
      addedAttributes.clear();
    }

    // Listeners on the current slideButtons — rebuilt by bindSlideButtons()
    // whenever ensureDots() re-resolves them (init and every reInit), so dots
    // cloned for a changed slide count (e.g. CMS load-more) aren't left dead.
    let slideButtonCleanups = [];

    function unbindSlideButtons() {
      slideButtonCleanups.forEach((fn) => fn());
      slideButtonCleanups = [];
    }

    function bindSlideButtons() {
      unbindSlideButtons();
      // Targets are snap indices (what scrollTo takes) — clamp to the last snap.
      const snapCount = carouselApi ? carouselApi.scrollSnapList().length : getSlides().length;
      slideButtons.forEach((button, index) => {
        const resolvedIndex = slideButtonIndices[index] ?? index;
        const targetIndex = Math.max(0, Math.min(resolvedIndex, snapCount - 1));

        const clickHandler = () => {
          // Only restart autoplay when the jump actually happened (a mask
          // carousel ignores it mid-reveal).
          if (scrollToIndex(targetIndex, fadeMode) && restartAutoplay) restartAutoplay();
        };
        // Native <button>s already turn Enter/Space into a click.
        const keyHandler = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickHandler();
          }
        };
        button.addEventListener('click', clickHandler);
        if (button.tagName !== 'BUTTON') {
          button.addEventListener('keydown', keyHandler);
          if (!button.hasAttribute('role')) setOwnAttribute(button, 'role', 'button');
          if (!button.hasAttribute('tabindex')) setOwnAttribute(button, 'tabindex', '0');
        }
        if (!button.hasAttribute('aria-label')) {
          setOwnAttribute(button, 'aria-label', `Go to slide ${targetIndex + 1}`);
        }
        if (!button.hasAttribute('aria-controls')) {
          setOwnAttribute(button, 'aria-controls', carouselViewport.id);
        }
        slideButtonCleanups.push(() => {
          button.removeEventListener('click', clickHandler);
          button.removeEventListener('keydown', keyHandler);
        });
      });
    }

    function ensureDots() {
      const dotsContainer = slider.querySelector(DOTS_CONTAINER_SELECTOR);

      const slides = getSlides();
      if (!slides.length) return;

      // One dot per snap, not per slide: with several slides per view (e.g. 6
      // slides, 3 visible → 4 snaps) per-slide dots past the last snap could
      // never become active. Fade/mask always have one snap per slide.
      const dotCount =
        !fadeMode && carouselApi ? carouselApi.scrollSnapList().length : slides.length;
      if (dotsContainer) buildDots(dotsContainer, dotCount);

      // data-slide-index="N" pins a button to slide N; null = take the next free one.
      const explicitIndex = (button) =>
        button.hasAttribute('data-slide-index')
          ? Number.parseInt(button.getAttribute('data-slide-index'), 10)
          : null;

      // Explicitly indexed buttons first (by index), then the rest in DOM order.
      slideButtons = Array.from(slider.querySelectorAll(SLIDE_BTN_SELECTOR))
        .sort((a, b) => {
          const aIndex = explicitIndex(a);
          const bIndex = explicitIndex(b);
          if (aIndex !== null && bIndex !== null) return aIndex - bIndex;
          if (aIndex !== null) return -1;
          if (bIndex !== null) return 1;
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        })
        .slice(0, slides.length);

      // Resolve each button's target index once: explicit indices win, the
      // others take the lowest unclaimed indices in DOM order (so an explicit
      // button sorting ahead of them can't shift every implicit index).
      const claimedIndices = new Set(
        slideButtons.map(explicitIndex).filter((index) => index !== null)
      );
      let nextFreeIndex = 0;
      slideButtonIndices = slideButtons.map((button) => {
        const index = explicitIndex(button);
        if (index !== null) return index;
        while (claimedIndices.has(nextFreeIndex)) nextFreeIndex += 1;
        claimedIndices.add(nextFreeIndex);
        return nextFreeIndex;
      });
    }

    function updateActiveSlides() {
      if (!carouselApi) return;
      const slides = getSlides();
      if (!slides.length) return;
      if (fadeMode) {
        if (!carouselContainer) {
          logger.warn('Fade mode requires a carousel container inside the slider.');
          return;
        }
        applyFadeLayout();
      }
      const activeIndex = carouselApi.selectedScrollSnap();
      if (maskMode) startMaskReveal(activeIndex);
      animateTextV2(activeIndex);
      animateTextV3(activeIndex);
      slides.forEach((slide, index) => {
        Array.from(slide.classList).forEach((className) => {
          if (/^(upcoming|upcomming|passed)-\d+$/.test(className)) {
            slide.classList.remove(className);
          }
        });
        slide.classList.toggle('is-active', index === activeIndex);
        if (fadeMode) {
          const isActive = index === activeIndex;
          // Mid-reveal the outgoing slide stays visible, under the incoming one.
          const isOutgoing = index === maskOutgoingIndex;
          slide.style.opacity = isActive || isOutgoing ? '1' : '0';
          slide.style.zIndex = isActive ? '3' : isOutgoing ? '2' : '1';
          slide.style.pointerEvents = isActive ? 'auto' : 'none';
          // Visually hidden slides must also leave the accessibility tree and
          // tab order — links inside them were still focusable otherwise.
          if (isActive) {
            slide.removeAttribute('aria-hidden');
            slide.inert = false;
          } else {
            // Rescue focus before inerting: inert blurs any focused child to
            // <body>, which would kill arrow-key navigation after one step
            // and release the pause-on-hover focus hold mid-interaction.
            if (slide.contains(document.activeElement)) {
              slider.focus({ preventScroll: true });
            }
            slide.setAttribute('aria-hidden', 'true');
            slide.inert = true;
          }
        }
        if (!slideClassesEnabled) return;
        slide.classList.toggle('is-passed', index < activeIndex);
        slide.classList.toggle('is-upcoming', index > activeIndex);
        slide.classList.toggle('is-prev', index === activeIndex - 1);
        slide.classList.toggle('is-next', index === activeIndex + 1);

        if (index > activeIndex) {
          const distance = index - activeIndex;
          slide.classList.add(`upcoming-${distance}`);
        } else if (index < activeIndex) {
          const distance = activeIndex - index;
          slide.classList.add(`passed-${distance}`);
        }
      });
      updateSlideButtons(activeIndex);
    }

    function updateSlideButtons(activeIndex) {
      if (!slideButtons.length) return;
      let activeButton = null;

      slideButtons.forEach((button, arrayIndex) => {
        const buttonIndex = slideButtonIndices[arrayIndex] ?? arrayIndex;
        const isActive = buttonIndex === activeIndex;
        button.classList.toggle('is-active', isActive);
        if (isActive) {
          activeButton = button;
          button.setAttribute('aria-current', 'true');
        } else {
          button.removeAttribute('aria-current');
        }
      });

      keepActiveSlideButtonInView(activeButton);
    }

    function keepActiveSlideButtonInView(activeButton) {
      if (!activeButton) return;

      const scrollParent = findHorizontalScrollParent(activeButton);
      if (!scrollParent) return;

      const parentRect = scrollParent.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const sidePadding = 8;
      const isOutOfView =
        buttonRect.left < parentRect.left + sidePadding ||
        buttonRect.right > parentRect.right - sidePadding;

      if (!isOutOfView) return;

      const parentCenter = parentRect.left + parentRect.width / 2;
      const buttonCenter = buttonRect.left + buttonRect.width / 2;
      const delta = buttonCenter - parentCenter;
      const targetScrollLeft = Math.max(
        0,
        Math.min(
          scrollParent.scrollWidth - scrollParent.clientWidth,
          scrollParent.scrollLeft + delta
        )
      );
      scrollParent.scrollTo({
        left: targetScrollLeft,
        behavior: scrollBehavior(),
      });
    }

    function findHorizontalScrollParent(element) {
      let current = element.parentElement;
      while (current && current !== slider) {
        const styles = window.getComputedStyle(current);
        const overflowX = styles.overflowX;
        const hasOverflowingContent = current.scrollWidth > current.clientWidth + 1;
        const canScrollX =
          hasOverflowingContent &&
          (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden');

        if (canScrollX) {
          return current;
        }
        current = current.parentElement;
      }

      return null;
    }

    function setNavButtonState(button, enabled, hidden) {
      if (!button) return;
      button.style.pointerEvents = enabled ? 'auto' : 'none';
      button.style.opacity = enabled ? '1' : '0.5';
      button.style.display = hidden ? 'none' : '';
      button.setAttribute('aria-disabled', String(!enabled));
      // pointer-events:none doesn't stop keyboard activation — take disabled
      // buttons out of the tab order so their announced state matches reality.
      button.setAttribute('tabindex', enabled ? '0' : '-1');
    }

    function updateButtonStates() {
      if (!carouselApi) return;
      // Fade carousels wrap, so prev/next always work with more than one slide.
      const wraps = fadeMode && getSlides().length > 1;
      const canPrev = wraps || carouselApi.canScrollPrev();
      const canNext = wraps || carouselApi.canScrollNext();
      const bothDisabled = !canPrev && !canNext;

      // Only touch the DOM when the state actually changed (runs on every select).
      const stateKey = `${canPrev}|${canNext}`;
      if (stateKey === lastButtonStateKey) return;
      lastButtonStateKey = stateKey;

      if (navButtonsWrapper) {
        navButtonsWrapper.style.display = bothDisabled ? 'none' : '';
        navButtonsWrapper.setAttribute('aria-hidden', String(bothDisabled));
      }
      setNavButtonState(prevBtn, canPrev, bothDisabled);
      setNavButtonState(nextBtn, canNext, bothDisabled);
    }

    try {
      // Fade/mask: one slide per view while Embla measures (see
      // applyFadeMeasureLayout), then updateActiveSlides() stacks them.
      if (fadeMode && carouselContainer) applyFadeMeasureLayout(carouselContainer, verticalMode);
      carouselApi = EmblaCarousel(carouselViewport, carouselOptions);

      carouselViewport._carousel = carouselApi;
      slider._carouselInstance = carouselApi;

      // Returns false when the jump was ignored (a mask carousel mid-reveal).
      scrollToIndex = (index, jump = false) => {
        if (!carouselApi || isMaskBusy()) return false;
        carouselApi.scrollTo(index, jump);
        return true;
      };

      ensureDots();

      const slides = getSlides();
      // Dots are built per snap, so compare against the snap count.
      const snapTotal = carouselApi.scrollSnapList().length;
      if (slideButtons.length !== snapTotal && slideButtons.length > 0) {
        logger.warn(
          `Carousel has ${snapTotal} snap positions but ${slideButtons.length} slide buttons. Button indices may not match slide indices.`
        );
      }

      // WAI-ARIA carousel pattern: identify each slide for screen readers, and
      // only announce slide changes when rotation isn't automatic. Default to
      // 'polite'; startAutoplay flips it to 'off' while rotation actually runs
      // (it may never run — reduced motion, stop-on-interaction, hover hold).
      if (!carouselViewport.id) {
        carouselUid += 1;
        carouselViewport.id = `carousel-viewport-${carouselUid}`;
      }
      resolvedContainer.setAttribute('aria-live', 'polite');
      slides.forEach((slide, index) => {
        if (!slide.hasAttribute('role')) slide.setAttribute('role', 'group');
        if (!slide.hasAttribute('aria-roledescription')) {
          slide.setAttribute('aria-roledescription', 'slide');
        }
        if (!slide.hasAttribute('aria-label')) {
          slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);
        }
      });

      if (textV2) {
        ensureTextV2Styles();
        slider.setAttribute(TEXT_V2_ROOT_ATTR, '');
        cleanupTasks.push(() => {
          cancelTextV2(Array.from(slider.querySelectorAll(TEXT_V2_SELECTOR)));
          slider.removeAttribute(TEXT_V2_ROOT_ATTR);
        });
      }
      if (textV3) initTextV3();
      if (!fadeMode && !prefersReducedMotion()) initImgParallax();

      updateButtonStates();
      updateActiveSlides();

      if (!autoplayEnabled) {
        updateStaticProgressBar();
      }

      // ─── Autoplay ───────────────────────────────────────────────────────────
      if (autoplayEnabled) {
        let autoplayIntervalId = null;
        let autoplayToggle = null;

        // APG: the live region is 'off' only WHILE rotation actually runs;
        // in any stopped/held state slide changes must announce politely.
        const setLiveRegion = (rotating) => {
          resolvedContainer.setAttribute('aria-live', rotating ? 'off' : 'polite');
        };

        const startAutoplay = (resumeProgress = false) => {
          if (autoplayBlocked()) return;
          // Respect the OS-level reduced-motion preference: autoplay never
          // runs while it's on. Manual navigation is unaffected.
          if (prefersReducedMotion()) return;
          setLiveRegion(true);
          if (progressTimer) {
            startProgressBar(resumeProgress);
          } else {
            if (autoplayIntervalId) return;
            autoplayIntervalId = window.setInterval(() => {
              if (!carouselApi) return;
              if (fadeMode) {
                stepFade(1, { queueIfBusy: true });
                return;
              }
              if (carouselApi.canScrollNext()) {
                carouselApi.scrollNext();
              } else {
                carouselApi.scrollTo(0);
              }
            }, autoplayDelay);
          }
        };

        const stopAutoplay = () => {
          setLiveRegion(false);
          cancelProgressBar(true);
          if (autoplayIntervalId) {
            window.clearInterval(autoplayIntervalId);
            autoplayIntervalId = null;
          }
        };

        restartAutoplay = () => {
          if (autoplayStopOnInteraction) return;
          stopAutoplay();
          startAutoplay();
        };

        // Exposes suspend/resume so external code (e.g. a video player in a slide)
        // can pause autoplay while it plays and hand control back when it stops.
        // A suspend is its own stop reason, so releasing a hover/focus hold
        // can't restart rotation under a playing video; resume only clears it
        // (a user stop still wins).
        slider._carouselAutoplay = {
          suspend: () => {
            autoplaySuspended = true;
            stopAutoplay();
          },
          resume: () => {
            autoplaySuspended = false;
            stopAutoplay();
            startAutoplay();
          },
        };
        cleanupTasks.push(() => {
          delete slider._carouselAutoplay;
        });

        startAutoplay();

        if (autoplayStopOnInteraction) {
          const stopHandler = (event) => {
            // The Pause/Play control handles its own state.
            if (autoplayToggle?.el.contains(event.target)) return;
            autoplayUserStopped = true;
            stopAutoplay();
            autoplayToggle?.setPaused(true);
          };
          slider.addEventListener('pointerdown', stopHandler);
          slider.addEventListener('keydown', stopHandler);
          cleanupTasks.push(() => {
            slider.removeEventListener('pointerdown', stopHandler);
            slider.removeEventListener('keydown', stopHandler);
          });
        }

        // ─── Interaction hold (autoplay carousels) ────────────────────────────
        // Hold autoplay while keyboard focus is inside the slider — always, so
        // content doesn't change under a keyboard / screen-reader user
        // (WCAG 2.2.2) — and, with data-pause-on-hover, while the pointer is
        // over it. With a progress bar the fill freezes in place and resumes
        // from the same point; with a plain interval the timer is cleared and a
        // fresh full delay starts on release. Focus on the Pause/Play control
        // itself doesn't hold, so pressing Play actually starts rotation.
        // Marquee carousels handle pausing inside initMarquee().
        let pointerOver = false;
        let focusWithin = false;
        const isOnToggle = (node) => Boolean(node && autoplayToggle?.el.contains(node));

        const updateHold = () => {
          const shouldHold = pointerOver || focusWithin;
          if (shouldHold === interactionHold) return;
          interactionHold = shouldHold;
          if (shouldHold) {
            // Rotation is paused — manual slide changes should announce
            setLiveRegion(false);
            if (progressTimer) {
              // Capture elapsed time BEFORE cancelling — cancelProgressBar()
              // nulls progressStartTime. rAF timestamps share
              // performance.now()'s time origin, so the subtraction is safe.
              if (progressRafId !== null && progressStartTime !== null) {
                progressResumeOffset = performance.now() - progressStartTime;
              }
              cancelProgressBar(false); // keep the fill frozen at its current width
            } else if (autoplayIntervalId) {
              window.clearInterval(autoplayIntervalId);
              autoplayIntervalId = null;
            }
          } else {
            startAutoplay(true); // no-op while stopped or suspended
          }
        };

        const focusInHandler = (event) => {
          focusWithin = !isOnToggle(event.target);
          updateHold();
        };
        const focusOutHandler = (event) => {
          // focusout also fires when focus moves between children — only
          // release the hold once focus actually leaves the slider (or moves
          // onto the Pause/Play control).
          const next = event.relatedTarget;
          if (next && slider.contains(next) && !isOnToggle(next)) return;
          focusWithin = false;
          updateHold();
        };
        slider.addEventListener('focusin', focusInHandler);
        slider.addEventListener('focusout', focusOutHandler);
        cleanupTasks.push(() => {
          slider.removeEventListener('focusin', focusInHandler);
          slider.removeEventListener('focusout', focusOutHandler);
        });

        if (pauseOnHover) {
          const pointerEnterHandler = () => {
            pointerOver = true;
            updateHold();
          };
          const pointerLeaveHandler = () => {
            pointerOver = false;
            updateHold();
          };
          slider.addEventListener('mouseenter', pointerEnterHandler);
          slider.addEventListener('mouseleave', pointerLeaveHandler);
          cleanupTasks.push(() => {
            slider.removeEventListener('mouseenter', pointerEnterHandler);
            slider.removeEventListener('mouseleave', pointerLeaveHandler);
          });
        }

        // ─── Pause/Play control (WCAG 2.2.2) ──────────────────────────────────
        // An author-provided [data-carousel-autoplay-toggle] inside the slider is
        // used if present; otherwise a button is injected after the progress
        // bar (or at the end of the slider — not inside [data-carousel-btns], which
        // may be aria-hidden). Skipped under reduced motion, where autoplay
        // never runs.
        if (!prefersReducedMotion()) {
          autoplayToggle = setupAutoplayToggle({
            root: slider,
            attr: 'data-carousel-autoplay-toggle',
            noun: 'slideshow',
            place: (btn) => {
              if (customProgressBar?.parentNode) customProgressBar.after(btn);
              else slider.appendChild(btn);
            },
            onChange: (paused) => {
              autoplayUserStopped = paused;
              if (paused) {
                stopAutoplay();
                return;
              }
              // An explicit Play overrides a hover hold: the pointer is
              // necessarily over the slider while clicking it.
              pointerOver = false;
              interactionHold = false;
              startAutoplay();
            },
          });
          const toggle = autoplayToggle;
          cleanupTasks.push(() => toggle.destroy());
        }
        // ─────────────────────────────────────────────────────────────────────

        cleanupTasks.push(() => stopAutoplay());
      }
      // ───────────────────────────────────────────────────────────────────────

      const onSelect = () => {
        updateButtonStates();
        updateActiveSlides();

        if (autoplayEnabled && progressTimer) {
          cancelProgressBar(false);
          startProgressBar();
        } else if (autoplayEnabled && !progressTimer && restartAutoplay) {
          restartAutoplay();
        } else if (!autoplayEnabled) {
          updateStaticProgressBar();
        }
      };

      const onScroll = () => {
        if (fadeMode) {
          applyFadeLayout();
        }
        imgParallax?.apply();
      };

      const onReInit = () => {
        imgParallax?.measure();
        imgParallax?.apply();
        ensureDots();
        bindSlideButtons();
        updateButtonStates();
        updateActiveSlides();
        if (!autoplayEnabled) {
          updateStaticProgressBar();
        }
      };

      carouselApi.on('select', onSelect);
      carouselApi.on('scroll', onScroll);
      carouselApi.on('reInit', onReInit);

      cleanupTasks.push(() => {
        carouselApi.off('select', onSelect);
        carouselApi.off('scroll', onScroll);
        carouselApi.off('reInit', onReInit);
      });

      // Kill a running reveal and drop its transforms, so a destroy or re-init
      // mid-transition leaves no slide half wiped.
      if (maskMode) {
        cleanupTasks.push(() => {
          maskQueuedStep = 0;
          finishMaskReveal();
        });
      }

      // ─── Custom swipe listener for fade carousels ──────────────────────────
      // Embla's built-in drag is disabled in fade mode (watchDrag: false)
      // because it conflicts with the absolute-position fade layout. We add our
      // own lightweight pointer swipe so users can still swipe between slides.
      // Like every other fade nav path it goes through stepFade(), so it always
      // wraps last → first and first → last.
      //
      // SWIPE_THRESHOLD (px): minimum horizontal movement to trigger a slide change.
      //   Lower (e.g. 20) → very sensitive.
      //   Higher (e.g. 80) → requires a bigger swipe.
      if (fadeMode) {
        const SWIPE_THRESHOLD = 50;
        let swipeStartX = null;
        let swipeStartY = null;
        let isSwiping = false;

        const onPointerDown = (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          swipeStartX = e.clientX;
          swipeStartY = e.clientY;
          isSwiping = true;
        };

        const onPointerUp = (e) => {
          if (!isSwiping || swipeStartX === null) return;
          isSwiping = false;

          const deltaX = e.clientX - swipeStartX;
          const deltaY = e.clientY - swipeStartY;

          swipeStartX = null;
          swipeStartY = null;

          // Ignore if movement was more vertical than horizontal (page scroll)
          if (Math.abs(deltaY) > Math.abs(deltaX)) return;

          // Ignore if not far enough horizontally
          if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

          // Swiped left → next slide; swiped right → previous slide (wraps)
          if (stepFade(deltaX < 0 ? 1 : -1) && restartAutoplay) restartAutoplay();
        };

        const onPointerCancel = () => {
          isSwiping = false;
          swipeStartX = null;
          swipeStartY = null;
        };

        carouselViewport.addEventListener('pointerdown', onPointerDown);
        carouselViewport.addEventListener('pointerup', onPointerUp);
        carouselViewport.addEventListener('pointercancel', onPointerCancel);

        cleanupTasks.push(() => {
          carouselViewport.removeEventListener('pointerdown', onPointerDown);
          carouselViewport.removeEventListener('pointerup', onPointerUp);
          carouselViewport.removeEventListener('pointercancel', onPointerCancel);
        });
      }
      // ──────────────────────────────────────────────────────────────────────

      // ─── Snap-after-free-drag ──────────────────────────────────────────────
      // When data-drag-free is enabled Embla scrolls freely with no snapping.
      // On pointerUp we measure how far the user dragged away from the current
      // snap point (as a 0–1 fraction of the full scroll range):
      //
      //   dragDelta > +DRAG_THRESHOLD  → advance one slide forward
      //   dragDelta < -DRAG_THRESHOLD  → advance one slide backward
      //   |dragDelta| <= DRAG_THRESHOLD → not far enough, snap back
      //
      // DRAG_THRESHOLD (fraction of scroll range, default 0.05 = 5%):
      //   Lower (e.g. 0.02) → very easy to advance, almost any touch moves it.
      //   Higher (e.g. 0.15) → requires a more deliberate drag distance.
      if (dragFree && !fadeMode) {
        const DRAG_THRESHOLD = 0.05;

        const snapAfterDrag = () => {
          if (!carouselApi) return;

          const snapList = carouselApi.scrollSnapList();
          const currentIndex = carouselApi.selectedScrollSnap();
          const lastIndex = snapList.length - 1;

          const progress = carouselApi.scrollProgress();
          const currentSnap = snapList[currentIndex];
          const dragDelta = progress - currentSnap;

          let targetIndex = currentIndex;

          if (dragDelta > DRAG_THRESHOLD) {
            targetIndex = loopMode
              ? (currentIndex + 1) % snapList.length
              : Math.min(currentIndex + 1, lastIndex);
          } else if (dragDelta < -DRAG_THRESHOLD) {
            targetIndex = loopMode
              ? (currentIndex - 1 + snapList.length) % snapList.length
              : Math.max(currentIndex - 1, 0);
          }

          carouselApi.scrollTo(targetIndex);
          if (restartAutoplay) restartAutoplay();
        };

        carouselApi.on('pointerUp', snapAfterDrag);
        cleanupTasks.push(() => carouselApi.off('pointerUp', snapAfterDrag));
      }
      // ──────────────────────────────────────────────────────────────────────

      // debounce() has no cancel — a resize just before destroy/reinit would
      // otherwise still run 150ms later and rewrite the (re-used) DOM.
      let resizeDestroyed = false;
      cleanupTasks.push(() => {
        resizeDestroyed = true;
      });

      const resizeHandler = debounce(() => {
        if (resizeDestroyed || !fadeMode || !carouselApi) return;
        // Hidden (tab pane, dropdown, modal — display:none): everything measures
        // 0, which would clear the locked height and collapse to one snap. The
        // layout from while it was visible stays valid, so keep it.
        if (!carouselViewport.clientWidth) return;
        // Un-stack the slides and line them up one per view so Embla re-measures
        // the real snaps — a plain reInit on the stacked layout would collapse to
        // one snap. onReInit → updateActiveSlides re-applies the fade layout (and
        // re-measures heights) afterward.
        const currentIndex = carouselApi.selectedScrollSnap();
        // Mask: settle any running reveal, and don't play one for the index
        // bouncing through 0 while Embla re-measures.
        if (maskMode) finishMaskReveal();
        maskSuppressed = true;
        resetFadeInlineStyles(slider);
        if (carouselContainer) applyFadeMeasureLayout(carouselContainer, verticalMode);
        carouselApi.reInit();
        // Keep the current slide — a guard in case reInit moved the index.
        const total = carouselApi.scrollSnapList().length;
        if (currentIndex > 0 && currentIndex < total) carouselApi.scrollTo(currentIndex, true);
        maskSuppressed = false;
        // An autoplay step queued behind the reveal settled above.
        if (maskMode) runQueuedMaskStep();
      }, 150);
      window.addEventListener('resize', resizeHandler);
      cleanupTasks.push(() => window.removeEventListener('resize', resizeHandler));

      const bindNavButton = (button, direction, label) => {
        if (!button) return;
        const onClick = () => {
          if (fadeMode) {
            stepFade(direction);
            return;
          }
          if (direction > 0) carouselApi.scrollNext();
          else carouselApi.scrollPrev();
          updateButtonStates();
          if (restartAutoplay) restartAutoplay();
        };
        button.addEventListener('click', onClick);
        // Don't clobber author-provided (possibly localised) labels; the role is
        // only needed when the element isn't a native <button>.
        if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
        if (button.tagName !== 'BUTTON') button.setAttribute('role', 'button');
        cleanupTasks.push(() => button.removeEventListener('click', onClick));
      };
      bindNavButton(nextBtn, 1, 'Next slide');
      bindNavButton(prevBtn, -1, 'Previous slide');

      bindSlideButtons();
      cleanupTasks.push(() => {
        unbindSlideButtons();
        // Leave the author's markup as it was: drop the dots the carousel
        // cloned/generated, the active state, and the attributes it added.
        slider.querySelectorAll(`[${DOT_CLONE_ATTR}]`).forEach((dot) => dot.remove());
        slideButtons.forEach((button) => {
          button.classList.remove('is-active');
          button.removeAttribute('aria-current');
        });
        removeOwnAttributes();
      });

      if (clickToCenter || activeInView) {
        const slides = getSlides();
        slides.forEach((slide, index) => {
          const slideHandler = () => scrollToIndex(index, fadeMode);
          slide.addEventListener('click', slideHandler);
          cleanupTasks.push(() => slide.removeEventListener('click', slideHandler));
        });
      }

      if (!slider._keyboardSetup) {
        const keyboardHandler = (event) => {
          const nextKey = verticalMode ? 'ArrowDown' : 'ArrowRight';
          const prevKey = verticalMode ? 'ArrowUp' : 'ArrowLeft';
          const direction = event.key === nextKey ? 1 : event.key === prevKey ? -1 : 0;
          if (!direction) return;
          // Leave browser/OS shortcuts (Alt+← is Back) and caret movement in
          // form fields inside a slide alone.
          if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
          event.preventDefault();
          let moved = true;
          if (fadeMode) moved = stepFade(direction);
          else if (direction > 0) carouselApi.scrollNext();
          else carouselApi.scrollPrev();
          if (moved && restartAutoplay) restartAutoplay();
        };
        slider.addEventListener('keydown', keyboardHandler);
        slider.tabIndex = 0;
        // Keep a role the element already has — a carousel that is also a tab
        // panel must stay role="tabpanel" (tabs.js ties it to its tab through
        // aria-labelledby); overriding it broke that for screen readers.
        if (!slider.hasAttribute('role')) {
          slider.setAttribute('role', 'region');
          slider.setAttribute('aria-roledescription', 'carousel');
        }
        // Fallback label only when the author provided none. Not "Carousel" —
        // aria-roledescription already announces the widget type, and per APG
        // the label must not repeat it ("Carousel, carousel").
        if (!slider.hasAttribute('aria-label') && !slider.hasAttribute('aria-labelledby')) {
          slider.setAttribute('aria-label', 'Featured content');
        }
        slider._keyboardSetup = true;
        cleanupTasks.push(() => slider.removeEventListener('keydown', keyboardHandler));
      }

      // A step asked for from outside (src/components/slideCursor.js):
      //   slider.dispatchEvent(new CustomEvent('carousel:step', { detail: { direction: 1 } }))
      // The same step as the arrow keys — direction-aware, wraps at the ends,
      // ignored mid mask reveal.
      const stepHandler = (event) => {
        const direction = Math.sign(event.detail?.direction || 0);
        if (!direction || !carouselApi) return;
        let moved = true;
        if (fadeMode) moved = stepFade(direction);
        else if (direction > 0) carouselApi.scrollNext();
        else carouselApi.scrollPrev();
        if (moved && restartAutoplay) restartAutoplay();
      };
      slider.addEventListener('carousel:step', stepHandler);
      cleanupTasks.push(() => slider.removeEventListener('carousel:step', stepHandler));

      registerSyncedSlider(syncId, carouselApi);

      slider._carouselCleanup = cleanupTasks;
    } catch (error) {
      // Dispose everything the failed attempt already set up — the un-marking
      // below allows a retry, which would otherwise double-bind listeners on
      // top of the partial init and leak a live Embla instance.
      const api = carouselApi;
      runCleanups(
        api ? [...cleanupTasks, () => api.destroy()] : cleanupTasks,
        'Carousel Initialization'
      );
      delete slider._keyboardSetup;
      slider._carouselInitialized = false;
      slider._carouselInstance = null;
      carouselViewport._carousel = null;
      handleError(error, 'Carousel Initialization');
    }
  });

  logger.log(`✅ ${sliderList.length} carousel(s) initialized`);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * The actual [data-carousel] element for a root/wrapper reference — callers
 * (e.g. a page-level "#testimonial-slider") don't always pass the root itself.
 * @param {HTMLElement} element
 * @returns {HTMLElement|null}
 */
export function getCarouselElementFromRoot(element) {
  if (!element) return null;
  return element.hasAttribute('data-carousel')
    ? element
    : element.querySelector?.(ROOT_SELECTOR) || null;
}

/**
 * The suspend/resume controls an autoplay carousel exposes (e.g. for a slide
 * video that should hold rotation while it plays).
 * @param {string|HTMLElement} selector
 * @returns {{ suspend: Function, resume: Function }|null}
 */
export function getCarouselAutoplayControls(selector) {
  const element = resolveElement(selector);
  const carouselRoot = getCarouselElementFromRoot(element) || element;
  return carouselRoot?._carouselAutoplay || null;
}

/**
 * The Embla instance of a carousel, from its root or its viewport.
 * @param {string|HTMLElement} selector
 * @returns {Object|null}
 */
export function getCarouselInstance(selector) {
  const element = resolveElement(selector);
  if (!element) return null;
  return (
    element._carouselInstance ||
    element._carousel ||
    element.querySelector?.(VIEWPORT_SELECTOR)?._carousel ||
    null
  );
}

/**
 * Load and initialise a carousel now (without waiting for it to scroll into
 * view), resolving with its Embla instance — or null if it never initialises.
 * @param {string|HTMLElement} selector - [data-carousel] root or a wrapper
 * @returns {Promise<object|null>}
 */
export async function ensureCarouselInitialized(selector) {
  const root = resolveElement(selector);
  const slider = getCarouselElementFromRoot(root) || root;
  if (!slider) return null;

  const existing = getCarouselInstance(slider);
  if (existing) return existing;

  try {
    await loadAndInitSlider(slider);
  } catch {
    markCarouselFailed(slider);
    return null;
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 200; // ~10s at 50ms per attempt

    // setTimeout, not requestAnimationFrame: rAF halts in background/hidden
    // tabs, which would leave this promise unsettled there.
    const tick = () => {
      const api = getCarouselInstance(slider);
      if (api) {
        resolve(api);
        return;
      }
      if (attempts >= maxAttempts) {
        resolve(null);
        return;
      }
      attempts += 1;
      window.setTimeout(tick, 50);
    };

    tick();
  });
}

/**
 * Tear one slider down: run its cleanups, destroy its Embla instance, strip the
 * fade layout (so a re-init measures real snaps, not one collapsed snap) and
 * un-mark it fully — otherwise a later init would skip it and lose keyboard nav.
 * @param {HTMLElement} slider
 */
function teardownSlider(slider) {
  if (slider._marqueeRetryTimer) {
    window.clearTimeout(slider._marqueeRetryTimer);
    slider._marqueeRetryTimer = null;
  }

  if (Array.isArray(slider._carouselCleanup)) {
    runCleanups(slider._carouselCleanup, 'Carousel Cleanup');
    slider._carouselCleanup = null;
  }

  const viewport = slider.querySelector(VIEWPORT_SELECTOR);
  const api = slider._carouselInstance || viewport?._carousel;
  if (api) runCleanups([() => api.destroy()], 'Carousel Cleanup');

  resetFadeInlineStyles(slider);

  slider._carouselInitialized = false;
  liveSliders.delete(slider);
  slider._carouselInstance = null;
  if (viewport) viewport._carousel = null;
  delete slider._keyboardSetup;
}

/**
 * Re-init (or force-init) every carousel inside `container` — call after
 * moving carousel DOM to a new place (e.g. into a panel).
 * @param {HTMLElement} container
 */
export function reinitCarouselsIn(container) {
  container.querySelectorAll(ROOT_SELECTOR).forEach((slider) => {
    if (slider._carouselInitialized) teardownSlider(slider);
    loadAndInitSliderSafely(slider);
  });
}

/** Destroy every carousel on the page (and stop watching pending ones). */
export function destroyCarousels() {
  carouselObserver?.disconnect();
  carouselObserver = null;
  new Set([...liveSliders, ...document.querySelectorAll(ROOT_SELECTOR)]).forEach(teardownSlider);
  liveSliders.clear();
  pendingSliders = [];
  syncedSliderGroups.clear();
}

/**
 * Add a carousel to its data-sync group: selecting a slide in one moves the
 * others to the same index.
 * @param {string|null} syncId
 * @param {Object} carouselApi
 */
function registerSyncedSlider(syncId, carouselApi) {
  if (!syncId || !carouselApi) return;

  if (!syncedSliderGroups.has(syncId)) syncedSliderGroups.set(syncId, new Set());
  const group = syncedSliderGroups.get(syncId);
  group.add(carouselApi);

  const syncHandler = () => {
    const targetIndex = carouselApi.selectedScrollSnap();
    group.forEach((otherCarousel) => {
      if (otherCarousel === carouselApi) return;
      // Skip when already aligned — each scrollTo fires the other slider's own
      // sync handler back, and sliders with unequal slide counts (where the
      // target index clamps) would otherwise ping-pong.
      if (otherCarousel.selectedScrollSnap() === targetIndex) return;
      otherCarousel.scrollTo(targetIndex);
    });
  };

  carouselApi.on('select', syncHandler);
  carouselApi.on('reInit', syncHandler);

  carouselApi.on('destroy', () => {
    carouselApi.off('select', syncHandler);
    carouselApi.off('reInit', syncHandler);
    group.delete(carouselApi);
    if (group.size === 0) syncedSliderGroups.delete(syncId);
  });
}
