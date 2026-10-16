import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion, scrollBehavior } from '../utils/motion';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** @type {import('lenis').default | null} */
let lenis = null;
let lenisInitialized = false;
let lenisLoaded = false;
let refreshScheduled = false;
let refreshTimeoutId = null;
let scrollToResizeAttached = false;
let scrollResetAttached = false;

// Cached navbar height — invalidated on resize
let _cachedNavbarHeight = null;

// Active-section observer state
let activeObserver = null;
/** @type {Map<string, Set<Element>>} sectionId → trigger elements */
const activeTriggerMap = new Map();
/** Section ids currently inside the intersection root */
const intersectingIds = new Set();
/** Ordered list of observed section ids (DOM order) */
let orderedSectionIds = [];

// ---------------------------------------------------------------------------
// Helpers — DOM / device
// ---------------------------------------------------------------------------

function toReadableLabel(value) {
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeScrollToId(value) {
  if (!value) return '';
  const id = String(value).trim().replace(/^#/, '');
  return id && !/\s/.test(id) ? id : '';
}

function getScrollToTarget(rawValue) {
  const id = normalizeScrollToId(rawValue);
  return id ? document.getElementById(id) : null;
}

/**
 * Cached navbar height — only re-measures on resize.
 */
export function getNavbarHeight() {
  if (_cachedNavbarHeight !== null) return _cachedNavbarHeight;

  const navbar =
    document.querySelector('.nav') ||
    document.querySelector('[data-nav-wrap]') ||
    document.querySelector('[data-navbar]') ||
    document.querySelector('header');

  if (!navbar) {
    _cachedNavbarHeight = 0;
    return 0;
  }

  const rect = Math.round(navbar.getBoundingClientRect().height || 0);
  const offset = Math.round(navbar.offsetHeight || 0);
  _cachedNavbarHeight = Math.max(rect, offset);
  return _cachedNavbarHeight;
}

function invalidateNavbarHeight() {
  _cachedNavbarHeight = null;
}

// Top chrome that can sit fixed/sticky over the top of the viewport: the main
// nav, then any sticky sub-nav (anchor links) stacked beneath it. Order matters
// — top-most first — because getStickyTopOffset() accumulates down the stack.
const STICKY_TOP_SELECTORS = [
  '.nav, [data-nav-wrap], [data-navbar], header',
  '[data-subnav], .sub-nav-links__wrap',
];

/**
 * Height of the top chrome to offset an anchor scroll by — the main nav plus the
 * sticky sub-nav.
 *
 * - Main nav: measured live, and only counted while it's actually covering the
 *   top (a nav translated away on scroll has bottom <= 0, so it contributes 0).
 * - Sub-nav: its height is ALWAYS reserved. It's `position: sticky`, so at click
 *   time it may still be far down the page (not yet stuck) and can't be detected
 *   by position — but it will be pinned at the top once you land on a section, so
 *   we always account for it.
 */
function getStickyTopOffset() {
  let offset = 0;

  const nav = document.querySelector(STICKY_TOP_SELECTORS[0]);
  if (nav) {
    const position = getComputedStyle(nav).position;
    if (position === 'fixed' || position === 'sticky') {
      const rect = nav.getBoundingClientRect();
      // Shown nav sits at the top (top ~0, bottom = its height); a hidden one is
      // translated up (bottom <= 0) and contributes nothing.
      if (rect.height >= 1 && rect.top <= 4 && rect.bottom > 0) offset = rect.bottom;
    }
  }

  const subnav = document.querySelector(STICKY_TOP_SELECTORS[1]);
  if (subnav) {
    offset += Math.round(subnav.getBoundingClientRect().height || subnav.offsetHeight || 0);
  }

  // Fall back to the measured navbar height if nothing resolved (no nav found and
  // no sub-nav present).
  return Math.round(offset) || getNavbarHeight();
}

function getScrollOffset(triggerElement) {
  if (!triggerElement) return getStickyTopOffset();
  const raw = (triggerElement.getAttribute('data-scroll-offset') || '').trim().toLowerCase();
  if (!raw || raw === 'navbar') return getStickyTopOffset();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : getStickyTopOffset();
}

// <a>/<button> are natively focusable and already activate on Enter/Space —
// only non-native triggers (e.g. a Webflow <div data-scroll-to>) need a role,
// keyboard focus, and manual key handling bolted on.
const NATIVE_INTERACTIVE_TAGS = new Set(['A', 'BUTTON']);

function isPointerDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// ---------------------------------------------------------------------------
// Aria labels on [data-scroll-to] triggers
// ---------------------------------------------------------------------------

export function applyScrollToAriaLabels() {
  const triggers = document.querySelectorAll('[data-scroll-to]');
  if (!triggers.length) return;

  // Bake in the FULL sticky top offset = main nav height + sticky sub-nav height,
  // so anchors clear both bars (not just the nav). The sub-nav height is measured
  // regardless of its current scroll position, since it's always pinned once you
  // land on a section.
  const subnav = document.querySelector(STICKY_TOP_SELECTORS[1]);
  const subnavHeight = subnav
    ? Math.round(subnav.getBoundingClientRect().height || subnav.offsetHeight || 0)
    : 0;
  const stickyOffset = getNavbarHeight() + subnavHeight;

  triggers.forEach((el) => {
    const raw = el.getAttribute('data-scroll-to');
    const id = normalizeScrollToId(raw);

    if (!id) {
      logger.warn('[Lenis] Invalid data-scroll-to — expected an element id, got:', raw);
      return;
    }

    if (raw !== id) el.setAttribute('data-scroll-to', id);

    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      const label = toReadableLabel(id);
      if (label) el.setAttribute('aria-label', `Scroll to ${label}`);
    }

    // A plain <div>/<span> defaults to role="generic", which doesn't support
    // ARIA naming — the aria-label above is invalid without a role that does,
    // and the element isn't keyboard-reachable at all. Give non-native
    // triggers a button role plus keyboard focus; Enter/Space activation is
    // wired in initClickHandlers below.
    if (!NATIVE_INTERACTIVE_TAGS.has(el.tagName)) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    }

    const offsetAttr = (el.getAttribute('data-scroll-offset') || '').trim().toLowerCase();
    if (!offsetAttr || offsetAttr === 'navbar') {
      el.setAttribute('data-scroll-offset', String(stickyOffset));
    }
  });

  if (!scrollToResizeAttached && typeof window !== 'undefined') {
    scrollToResizeAttached = true;
    window.addEventListener(
      'resize',
      () => {
        invalidateNavbarHeight();
        requestAnimationFrame(applyScrollToAriaLabels);
      },
      { passive: true }
    );
  }
}

// ---------------------------------------------------------------------------
// Scroll execution
// ---------------------------------------------------------------------------

/**
 * @param {Element} element
 * @param {{ offset?: number }} [opts]
 */
function scrollToElement(element, { offset } = {}) {
  if (!element) return;
  const scrollOffset = typeof offset === 'number' ? offset : getNavbarHeight();

  if (lenis) {
    lenis.scrollTo(element, { offset: -scrollOffset, duration: 1.2 });
  } else {
    const top = element.getBoundingClientRect().top + window.scrollY - scrollOffset;
    window.scrollTo({ top, behavior: scrollBehavior() });
  }
}

// ---------------------------------------------------------------------------
// Hash handling
// ---------------------------------------------------------------------------

function handleUrlHash() {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#!') return;

  const target = document.querySelector(hash);
  if (!target) {
    logger.warn(`[Lenis] No element found for hash: ${hash}`);
    return;
  }

  requestAnimationFrame(() => {
    scrollToElement(target, { offset: getStickyTopOffset() });
    logger.log(`[Lenis] Scrolled to hash: ${hash}`);
  });
}

export function initUrlHash() {
  if (document.readyState === 'complete') {
    handleUrlHash();
  } else {
    window.addEventListener('load', handleUrlHash, { once: true });
  }
  window.addEventListener('hashchange', handleUrlHash);
}

// ---------------------------------------------------------------------------
// Click handlers
// ---------------------------------------------------------------------------

function getSamePageHash(anchor) {
  const href = anchor.getAttribute('href') || '';
  if (!href || href === '#' || href === '#!') return null;
  if (href.startsWith('#')) return href;

  try {
    const url = new URL(href, window.location.href);
    if (url.pathname === window.location.pathname && url.hash) return url.hash;
  } catch {
    // Malformed href — ignore
  }
  return null;
}

function initClickHandlers() {
  document.addEventListener(
    'click',
    (e) => {
      const anchor = e.target.closest('a[href]');
      if (anchor) {
        const hash = getSamePageHash(anchor);
        if (hash) {
          const target = document.querySelector(hash);
          if (target) {
            e.preventDefault();
            history.pushState(null, '', hash);
            scrollToElement(target, { offset: getStickyTopOffset() });
            return;
          }
        }
      }

      const trigger = e.target.closest('[data-scroll-to]');
      if (trigger) {
        e.preventDefault();
        const target = getScrollToTarget(trigger.getAttribute('data-scroll-to'));
        if (!target) return;
        const id = normalizeScrollToId(trigger.getAttribute('data-scroll-to'));
        history.pushState(null, '', `#${id}`);
        scrollToElement(target, { offset: getScrollOffset(trigger) });
        return;
      }

      const t = e.target;
      if (
        t?.closest('.w-pagination-wrapper') ||
        t?.closest('.w-pagination-next') ||
        t?.closest('.w-radio')
      ) {
        scheduleScrollRefresh(500);
      }
    },
    { passive: false }
  );

  // Native <a>/<button> triggers already activate on Enter/Space — this only
  // covers the role="button" divs/spans applyScrollToAriaLabels sets up,
  // which need keyboard activation wired in by hand. Re-dispatches through
  // .click() so the handler above stays the single source of truth.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const trigger = e.target.closest?.('[data-scroll-to]');
    if (!trigger || NATIVE_INTERACTIVE_TAGS.has(trigger.tagName) || e.repeat) return;
    e.preventDefault();
    trigger.click();
  });
}

// ---------------------------------------------------------------------------
// Scroll refresh
// ---------------------------------------------------------------------------

export function scheduleScrollRefresh(followUpDelayMs = 500) {
  if (refreshScheduled) return;
  refreshScheduled = true;

  // Clear any pending follow-up to prevent stacking
  if (refreshTimeoutId !== null) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }

  const refresh = () => {
    try {
      if (lenis?.resize) lenis.resize();
      if (window.ScrollTrigger?.refresh) window.ScrollTrigger.refresh();
    } catch (err) {
      logger.error('[Lenis] Refresh error:', err);
    }
  };

  requestAnimationFrame(() => {
    refreshScheduled = false;
    refresh();
  });

  if (followUpDelayMs > 0) {
    refreshTimeoutId = setTimeout(() => {
      refreshTimeoutId = null;
      refresh();
    }, followUpDelayMs);
  }

  logger.log('[Lenis] Scroll refresh scheduled');
}

// ---------------------------------------------------------------------------
// Lenis instantiation
// ---------------------------------------------------------------------------

// GSAP ticker callback driving Lenis — kept so destroyLenis() can remove it.
let tickerCallback = null;
const resizeLenis = () => lenis?.resize();

function loadLenis() {
  if (lenisLoaded) return;
  lenisLoaded = true;

  // Reduced motion: no smooth (eased, inertial) scrolling at all — native
  // scroll only. Every helper in this file already falls back to native
  // window.scrollTo when `lenis` is null, and modal-basic falls back to an
  // overflow:hidden scroll lock.
  if (prefersReducedMotion()) {
    logger.log('[Lenis] prefers-reduced-motion — using native scroll, Lenis not loaded.');
    return;
  }

  try {
    const pointer = isPointerDevice();

    lenis = new Lenis({
      duration: pointer ? 1.2 : 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      // Smooth wheel on pointer devices only. Touch always stays native
      // (syncTouch defaults to false) — the old `smoothTouch` option was a
      // no-op in this API, so this matches what actually ran before.
      smoothWheel: pointer,
      wheelMultiplier: pointer ? 1 : 0,
      infinite: false,
      autoResize: true,
      lerp: pointer ? 0.1 : 0.08,
      // Scrollable areas inside the page (modal bodies, the contact map list,
      // menu panels) scroll natively instead of being hijacked — including
      // while Lenis is stopped as a modal's scroll lock, which used to block
      // them unless the author remembered [data-lenis-prevent] in Webflow.
      allowNestedScroll: true,
    });

    // Drive Lenis from GSAP's ticker and feed its scroll to ScrollTrigger, so
    // Lenis and every ScrollTrigger update in the same frame (they previously
    // ran on two separate rAF loops, which can leave scrubbed animations a
    // frame behind). lagSmoothing(0) is the setting Lenis documents for this.
    lenis.on('scroll', ScrollTrigger.update);
    tickerCallback = (time) => lenis?.raf(time * 1000);
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);
    // Lenis notices the page growing by watching <html>'s size, but Webflow
    // sets html { height: 100% }, so that never changes and content added
    // after load (load-more, tabs, nested fragments) left its scroll limit
    // short of the bottom. Every page-height change already brings a
    // ScrollTrigger refresh (components/gsap.js), so re-measure Lenis then too.
    ScrollTrigger.addEventListener('refreshInit', resizeLenis);

    resetScrollPosition();
    logger.log('[Lenis] Ready ✓');
  } catch (err) {
    logger.error('[Lenis] Failed to load:', err);
    lenisLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

export function initLenis() {
  if (lenisInitialized) return;

  if (
    typeof window !== 'undefined' &&
    (window.__WF_DESIGNER__ || window.Webflow?.env?.('editor'))
  ) {
    logger.log('[Lenis] Webflow editor detected — disabled');
    return;
  }

  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  resetScrollPosition();
  attachScrollResetOnPageShow();

  lenisInitialized = true;
  applyScrollToAriaLabels();
  initClickHandlers();
  initUrlHash();
  // Called here (at DOMContentLoaded) rather than at module load: with the
  // ES-module build, shared chunks evaluate before the entry's own code, so a
  // module-load call ran before utils/intersectionObserverGuard had patched
  // IntersectionObserver — and a throw there aborted the whole chunk.
  initActiveScrollTo();
  loadLenis();
}

/**
 * After a page swap (src/global/pageTransition.js): Lenis itself and its
 * document / window listeners carry on (they read the DOM when they fire), so
 * only what was measured or found on the old page is redone — the navbar
 * height, the [data-scroll-to] labels and active tracking, Lenis's own size —
 * and a #hash in the new URL is honoured.
 */
export function refreshLenisForPage() {
  if (!lenisInitialized) return;
  invalidateNavbarHeight();
  applyScrollToAriaLabels();
  destroyActiveScrollTo();
  initActiveScrollTo();
  lenis?.resize();
  if (window.location.hash) handleUrlHash();
}

// ---------------------------------------------------------------------------
// Active [data-scroll-to] tracking via IntersectionObserver
// ---------------------------------------------------------------------------

/**
 * Mark triggers as active when their target section enters the viewport.
 *
 * Adds `.is-current` and `aria-current="true"` to every `[data-scroll-to]`
 * element whose target section is currently the "primary" visible section.
 *
 * The active section is the topmost one (in DOM order) whose id is inside
 * the intersection root — this handles short sections and fast scrolling.
 *
 * @param {object} [opts]
 * @param {string} [opts.activeClass='is-current'] CSS class to toggle
 * @param {string} [opts.rootMargin='-10% 0px -80% 0px']
 *   IntersectionObserver rootMargin. The defaults create a thin horizontal
 *   "trigger band" near the top of the viewport. Adjust the second value
 *   (bottom inset) to widen / narrow the band.
 * @param {number|number[]} [opts.threshold=0]
 */
export function initActiveScrollTo({ activeClass = 'is-current', offset, threshold = 0 } = {}) {
  // Trigger band sits at the full sticky top offset (main nav + sticky sub-nav),
  // so a section becomes `is-current` exactly when its top clears both bars —
  // matching where an anchor scroll actually lands.
  const topOffset = typeof offset === 'number' ? offset : getStickyTopOffset();
  // Bottom inset as a % of the viewport. innerHeight can be 0 (a background or
  // prerendered tab), which made this "-NaN%" / "-Infinity%" — an invalid
  // rootMargin that throws. Clamp to a valid 0–100 range instead.
  const viewportHeight = window.innerHeight || 0;
  const bottomInset = viewportHeight
    ? Math.min(100, Math.max(0, 100 - (topOffset / viewportHeight) * 100))
    : 0;
  const rootMargin = `-${topOffset + 3}px 0px -${bottomInset}% 0px`;
  // Rebuild the trigger map — picks up any late-rendered nav items
  activeTriggerMap.clear();
  intersectingIds.clear();
  orderedSectionIds = [];

  document.querySelectorAll('[data-scroll-to]').forEach((el) => {
    const id = normalizeScrollToId(el.getAttribute('data-scroll-to'));
    if (!id) return;
    if (!activeTriggerMap.has(id)) activeTriggerMap.set(id, new Set());
    activeTriggerMap.get(id).add(el);
  });

  if (!activeTriggerMap.size) return;

  // Disconnect any previous observer
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }

  // Collect sections in their DOM order — this is the tiebreaker when
  // multiple sections intersect simultaneously (e.g. very short sections).
  activeTriggerMap.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) orderedSectionIds.push(id);
  });

  // Sort by DOM position (compareDocumentPosition is O(log n))
  orderedSectionIds.sort((a, b) => {
    const elA = document.getElementById(a);
    const elB = document.getElementById(b);
    if (!elA || !elB) return 0;
    const rel = elA.compareDocumentPosition(elB);
    return rel & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  function applyActiveState() {
    // Deepest intersecting target wins, then every in-band ancestor of it is
    // marked too — so a nested target and the section wrapping it can both be
    // active (sider link + top sub-nav).
    const inBand = orderedSectionIds.filter((id) => intersectingIds.has(id));
    const deepest =
      inBand.find((id) => {
        const el = document.getElementById(id);
        return !inBand.some(
          (other) => other !== id && el?.contains(document.getElementById(other))
        );
      }) ?? null;

    const activeIds = new Set();
    if (deepest) {
      activeIds.add(deepest);
      const deepestEl = document.getElementById(deepest);
      inBand.forEach((id) => {
        if (id !== deepest && document.getElementById(id)?.contains(deepestEl)) activeIds.add(id);
      });
    }

    activeTriggerMap.forEach((triggers, id) => {
      const isActive = activeIds.has(id);
      triggers.forEach((el) => {
        el.classList.toggle(activeClass, isActive);
        el.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    });
  }

  activeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          intersectingIds.add(entry.target.id);
        } else {
          intersectingIds.delete(entry.target.id);
        }
      });
      applyActiveState();
    },
    { rootMargin, threshold }
  );

  orderedSectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) activeObserver.observe(el);
  });

  logger.log('[Lenis] Active scroll-to observer ready —', orderedSectionIds.length, 'sections');
}

/** Tear down the active-state observer and clear all active classes. */
export function destroyActiveScrollTo(activeClass = 'is-current') {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  activeTriggerMap.forEach((triggers) => {
    triggers.forEach((el) => {
      el.classList.remove(activeClass);
      el.removeAttribute('aria-current');
    });
  });
  activeTriggerMap.clear();
  intersectingIds.clear();
  orderedSectionIds = [];
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

/** @returns {import('lenis').default | null} */
export function getLenis() {
  return lenis;
}

/**
 * Smooth-scroll to any element or selector.
 *
 * @param {string | HTMLElement} target
 * @param {{ offset?: number, duration?: number }} [options]
 */
export function scrollTo(target, options = {}) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) {
    logger.warn('[Lenis] scrollTo: target not found:', target);
    return;
  }

  // BUG FIX: extract offset separately so the spread can't clobber it,
  // and pass it as a positive number (scrollToElement negates it internally).
  const { offset, ...rest } = options;
  const resolvedOffset = typeof offset === 'number' ? offset : getNavbarHeight();

  if (lenis) {
    lenis.scrollTo(element, { offset: -resolvedOffset, duration: 1.2, ...rest });
  } else {
    const top = element.getBoundingClientRect().top + window.scrollY - resolvedOffset;
    window.scrollTo({ top, behavior: scrollBehavior() });
  }
}

// ---------------------------------------------------------------------------
// Scroll position: top on a fresh visit, restored on Back/Forward
// ---------------------------------------------------------------------------
// history.scrollRestoration stays 'manual' (see initLenis): the browser's own
// restore runs before Lenis, ScrollTrigger pin spacers and late CMS content
// have laid out, so it would land in the wrong place — which is why every load
// used to be forced to the top, and Back always lost your place. Instead the
// position is saved on pagehide and restored once the page has loaded.

const SCROLL_KEY_PREFIX = 'scl-scroll:';
const scrollKey = () => `${SCROLL_KEY_PREFIX}${window.location.pathname}${window.location.search}`;

function readSavedScroll() {
  try {
    const value = Number(sessionStorage.getItem(scrollKey()));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null; // storage blocked (private mode, disabled cookies)
  }
}

function saveScroll() {
  try {
    sessionStorage.setItem(scrollKey(), String(Math.round(window.scrollY)));
  } catch {
    // storage blocked — Back just starts at the top, as before
  }
}

// Back/Forward navigation with a saved position for this URL. Evaluated once:
// the navigation type describes how this document was loaded.
const restoringFromHistory =
  typeof window !== 'undefined' &&
  performance.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward' &&
  readSavedScroll() !== null;

function restoreSavedScroll() {
  const y = readSavedScroll();
  if (y === null) return;
  const apply = () => {
    // Re-measure first (CMS lists, images and pin spacers are in by now),
    // then jump — no animation.
    lenis?.resize();
    ScrollTrigger.refresh();
    window.scrollTo(0, y);
    lenis?.scrollTo(y, { immediate: true, force: true });
  };
  if (document.readyState === 'complete') requestAnimationFrame(apply);
  else window.addEventListener('load', () => requestAnimationFrame(apply), { once: true });
}

export function resetScrollPosition() {
  if (typeof window === 'undefined') return;

  // Back/Forward: restoreSavedScroll() puts the reader back where they were.
  if (restoringFromHistory) return;

  // Preserve in-page hash landings (e.g. /page#Resources): if the URL targets an
  // existing element, skip the top-reset so initUrlHash can scroll there instead.
  const hashId = window.location.hash.replace(/^#/, '');
  if (hashId && document.getElementById(hashId)) return;

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true });
  }
}

function attachScrollResetOnPageShow() {
  if (scrollResetAttached || typeof window === 'undefined') return;
  scrollResetAttached = true;

  window.addEventListener('pageshow', (event) => {
    // Restored from the back/forward cache: the page (scroll position, GSAP
    // state) is exactly as the reader left it — leave it alone.
    if (event.persisted) return;
    resetScrollPosition();
  });
  window.addEventListener('pagehide', saveScroll);

  if (restoringFromHistory) restoreSavedScroll();
}

export function scrollToTop() {
  if (lenis) {
    lenis.scrollTo(0, { duration: 1.2 });
  } else {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }
}

export function scrollToBottom() {
  if (lenis) {
    lenis.scrollTo(document.body.scrollHeight, { duration: 1.5 });
  } else {
    window.scrollTo({ top: document.body.scrollHeight, behavior: scrollBehavior() });
  }
}

export function stopLenis() {
  lenis?.stop();
}

export function startLenis() {
  lenis?.start();
}

export function destroyLenis() {
  ScrollTrigger.removeEventListener('refreshInit', resizeLenis);
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }
  if (lenis) {
    lenis.off?.('scroll', ScrollTrigger.update);
    lenis.destroy();
    lenis = null;
  }
  // BUG FIX: reset resize guard so re-init after destroy works correctly
  scrollToResizeAttached = false;
  invalidateNavbarHeight();
  lenisLoaded = false;
  lenisInitialized = false;
  logger.log('[Lenis] Destroyed');
}
