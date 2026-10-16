/**
 * Tabs
 * ====
 * Accessible, autoplay-ready tabs for Webflow markup, following the WAI-ARIA
 * Tabs pattern (tablist / tab / tabpanel). Optional extras: autoplay progress
 * bars, a sliding "glide" indicator, GSAP-animated panel content, a mask-reveal
 * transition between panels, per-panel video playback and a two-view
 * "swap-main" layout. Loaded on demand by src/global/index.js wherever
 * [data-tabs-comp] is on the page.
 *
 * Quick start
 * -----------
 *   import { initTabs, cleanupTabs } from '../components/tabs';
 *   initTabs();    // once, after DOM ready (and after GSAP, for content animations)
 *   cleanupTabs(); // on teardown
 *
 *   <div data-tabs-comp>
 *     <div data-tabs-list>
 *       <button data-tabs-btn>Tab 1<div class="tab-btn-progress"></div></button>
 *       <button data-tabs-btn>Tab 2<div class="tab-btn-progress"></div></button>
 *     </div>
 *     <div data-tabs-img>…</div>
 *     <div data-tabs-img>…</div>
 *   </div>
 *
 * initTabs(options) sets up every root that isn't set up yet and returns a
 * function that runs cleanupTabs(). Options (both optional): rootElements, an
 * explicit list of roots, or rootSelector (default "[data-tabs-comp]").
 * cleanupTabs() tears down every instance.
 *
 * The first [data-tabs-btn] with the active class (or "is-active") starts
 * active, otherwise the first one. After each change the root dispatches a
 * bubbling "tabs:change" event with
 *   detail: { index, button, panel, reason: 'user' | 'auto' }
 *
 * Elements
 * --------
 *   [data-tabs-comp]              Root; carries the options below.
 *   [data-tabs-btn]               A tab toggle (its value is the key for id matching).
 *   [data-tabs-img]               A panel — a picture, or any block (e.g. a carousel);
 *                                 its value is the key for id matching.
 *   [data-tabs-list]              The tablist (optional; default: the closest common
 *                                 ancestor of the buttons).
 *   .tab-btn-progress /           Inside a button: autoplay progress bar (its inline
 *   [data-tabs-btn-progress]      width runs 0% → 100% over the delay).
 *   [data-tabs-content-element]   Inside a panel: animated in / out on change.
 *   [data-tabs-content]           Content outside the panels that changes with them
 *                                 (see Linked content).
 *   [data-tabs-btn-glide-toggle]  Sliding active-tab indicator (see Glide indicator).
 *   [data-tabs-prev-content] /    Previous / next tab buttons.
 *   [data-tabs-next-content]
 *   [data-tabs-scroll-wrap]       Horizontally scrolling tab bar the active tab is
 *                                 centred in (default: the nearest overflow-x auto /
 *                                 scroll ancestor of the first button that overflows).
 *   [data-tabs-mask-wrap] /       Per-panel mask reveal layers (see Mask reveal).
 *   [data-tabs-mask-media] /
 *   [data-tabs-mask-swap]
 *   [data-sub] / [data-main] /    Swap-main layout (see Swap-main).
 *   [data-tabs-swap-toggle]
 *
 * Options (attributes on [data-tabs-comp])
 * ----------------------------------------
 * Booleans are on when present with any value but "false". Those marked
 * (flag) are on whenever present, whatever their value.
 *   data-match-by="id"                  Pair toggles ↔ panels by attribute value
 *                                       (default: DOM order).
 *   data-swap-main                      (flag) Two-view sub / main layout; implies
 *                                       id matching.
 *   data-tabs-label="…"                 Tablist accessible name (default "Tabs").
 *   data-tabs-sub-label="…" /           The same for the swap-main [data-sub] /
 *   data-tabs-main-label="…"            [data-main] tablists.
 *   data-tabs-active-class="is-active"  Class on the active toggles and panel
 *                                       (default "active").
 *   data-tabs-activate-on="hover"       Also activate a tab on mouseenter (click
 *                                       always works).
 *   data-tabs-loop="false"              Stop at the first / last tab instead of
 *                                       wrapping (arrow keys, prev / next, autoplay).
 *   data-tabs-animate="false"           Don't animate [data-tabs-content-element]s.
 *   data-tabs-scroll-active="false"     Don't scroll the active tab into view.
 *   data-tabs-autoplay                  Rotate through the tabs (default off).
 *   data-tabs-autoplay-delay="5000"     Autoplay interval in ms.
 *   data-tabs-autoplay-pause-on-hover   Pause while hovered (default off).
 *   data-tabs-autoplay-pause-on-focus   Pause while focus is inside (default off).
 *   data-tabs-autoplay-pause-on-hidden  Pause while the page is hidden (default on).
 *   data-stop-autoplay-on-first-interaction
 *                                       Stop autoplay for good on the first
 *                                       user-triggered tab change (default off).
 *   data-tabs-advance-on-video-end      (flag) With autoplay: advance when the
 *                                       active panel's first <video> ends instead
 *                                       of on the timer.
 *   data-tabs-no-video-autoplay         (flag) Don't play / pause panel videos on
 *                                       change (e.g. a video player owns playback).
 *   data-tabs-effect="mask"             Mask reveal between panels.
 *   data-tabs-mask-duration="1.1"       Reveal length in seconds (0 = instant).
 *   data-tabs-mask-ease="…"             GSAP ease (default "Pagtrans").
 *   data-tabs-mask-parallax="100"       100 = picture still, 50 = drifts, 0 = push
 *                                       (same as the carousel's data-mask-parallax).
 *
 * Features
 * --------
 * Matching toggles ↔ panels
 *   By default the Nth [data-tabs-btn] controls the Nth [data-tabs-img]; the
 *   counts must match, otherwise the instance is skipped. With data-match-by="id"
 *   they pair by a shared attribute value, e.g.
 *     <button data-tabs-btn="pricing">…</button>  ↔  <div data-tabs-img="pricing">…</div>
 *   Several toggles may share one panel (all of them get the active class);
 *   order and counts don't matter. Unmatched toggles are skipped, unmatched
 *   panels stay hidden.
 *
 * Swap-main
 *   [data-tabs-comp][data-swap-main] > [data-sub] + [data-main]
 *     [data-sub]   a compact bar of [data-tabs-btn]s, shown first
 *     [data-main]  the full tabs: [data-tabs-btn]s and the [data-tabs-img] panels
 *   Give sub buttons, main buttons and panels matching values. The shown
 *   container gets the class "active" (always "active", whatever
 *   data-tabs-active-class says); style the show / hide in CSS.
 *     - Starts collapsed on [data-sub], with nothing selected or open.
 *     - A sub button opens [data-main] on its panel and focuses the matching main tab.
 *     - Another main tab just switches the panel.
 *     - Re-clicking the active main tab collapses back to [data-sub].
 *   [data-tabs-swap-toggle] (optional, anywhere in the root) switches directly:
 *   collapses main if it's open, otherwise reopens it on the last active panel.
 *
 * Linked content
 *   [data-tabs-content] elements anywhere in the root (not inside a panel) take
 *   turns with the panels: the Nth one shows with the Nth panel (by DOM order),
 *   or the one with the panel's value under data-match-by="id". E.g. pictures
 *   as the panels on one side, a text block for each on the other:
 *     <div data-tabs-comp data-tabs-effect="mask">
 *       <div class="fig"> …[data-tabs-btn]s… <img data-tabs-img> ×3</div>
 *       <div class="text"><h2>…</h2> <div data-tabs-content>…</div> ×3</div>
 *     </div>
 *   On a change the showing one's parts (its [data-tabs-content-element]s, else
 *   its children) lift and fade away one after another, then the next one's
 *   rise into place — while the panels change. The others are hidden
 *   (display: none), like inactive panels; data-tabs-animate="false" makes it
 *   a plain swap.
 *
 * Autoplay
 *   Runs while the component is on screen (and, by default, the page is
 *   visible). The active tab's progress bar fills over the delay; every change
 *   restarts the cycle.
 *
 * Panel videos
 *   On each change the active panel's first <video> plays (muted) and every
 *   <video> in the outgoing panel pauses, unless data-tabs-no-video-autoplay.
 *
 * Content animations
 *   [data-tabs-content-element]s start hidden, rise / fade in with a stagger
 *   when their panel opens, and blur / fade out before it closes. Uses
 *   window.gsap (put there by src/components/gsap.js); shorter and without
 *   movement under prefers-reduced-motion.
 *
 * Glide indicator
 *   A decorative element inside the tab list, next to the buttons, e.g.
 *   <div data-tabs-btn-glide-toggle class="…"></div>. It follows the tab that
 *   controls the active panel: --glide-x / --glide-y / --glide-width /
 *   --glide-height are set on it (relative to its parent, which
 *   src/styles/tabs.css makes position: relative) and tabs.css turns them into
 *   position + size with a transition. Style its look (background, radius) on
 *   its class. It gets .is-moving for a short squash on each move (not under
 *   reduced motion) and data-state="hidden" when no tab is active (swap-main
 *   collapsed). One per tablist: swap-main can have one in [data-sub] and one
 *   in [data-main].
 *
 * Mask reveal (data-tabs-effect="mask")
 *   The mask carousel's transition (src/utils/maskReveal.js), for panels: the
 *   new panel wipes in over the old one, from the right for a later tab and
 *   from the left for an earlier one. Per panel (both optional):
 *     [data-tabs-mask-wrap]   the clipped layer that wipes across (default: the panel)
 *     [data-tabs-mask-media]  the layer that counter-moves so the picture stays put
 *                             (e.g. the panel's image, or a carousel's
 *                             [data-carousel-wrapper]); without it the panel pushes in.
 *                             On a panel that is itself the picture (an <img>
 *                             panel), the panel is uncovered by a clip instead,
 *                             both pictures staying put
 *     [data-tabs-mask-swap]   a group outside the wrap that stays in place instead
 *                             (e.g. a carousel's [data-carousel-dots]): its children
 *                             shrink away one by one, then the new panel's pop in.
 *                             Both panels' groups should sit in the same spot.
 *   Panels should be siblings in one container (the outgoing panel is pinned
 *   over the incoming one's spot). User tab changes during a reveal are
 *   ignored; an autoplay switch waits for it. The switch is instant under
 *   reduced motion, on the first activation and until maskReveal.js has loaded.
 *
 * Carousels in panels
 *   A carousel inside a display: none panel never scrolls into view, so it
 *   can't initialise itself. [data-carousel]s in (or on) the incoming panel
 *   are initialised as it opens; the mask reveal waits for them (600 ms max).
 *
 * Accessibility (WAI-ARIA Tabs pattern, WCAG 2.1 AA)
 * --------------------------------------------------
 * Tablist: role="tablist" on [data-tabs-list] (default: the buttons' closest
 *   common ancestor), named by data-tabs-label (default "Tabs") unless it already
 *   has aria-label / aria-labelledby. Wrappers between it and its tabs (e.g. the
 *   .w-dyn-item around each CMS-rendered button) get role="none". Swap-main gets
 *   two tablists, one per region: [data-sub] and [data-main] are separate DOM
 *   subtrees, so one tablist can't contain both.
 * Tabs: role="tab", aria-selected and aria-controls → its panel. aria-label is
 *   "<its text> tab button" unless it already has aria-label / aria-labelledby
 *   (icon-only tabs need one set by hand). Roving tabindex: only the selected
 *   tab (in swap-main, initially the first sub button) has tabindex="0".
 * Keyboard: ArrowLeft / ArrowRight move to the previous / next tab and activate
 *   it, Home / End to the first / last; Enter / Space activate the focused tab.
 *   In swap-main arrows stay within the focused tab's region, and in the sub bar
 *   they only move focus.
 * Panels: role="tabpanel", aria-labelledby → every toggle that controls it, and
 *   tabindex="0" (unless already set) so keyboard users can reach content with
 *   nothing focusable in it. Inactive panels get aria-hidden="true", hidden and
 *   display: none.
 * Swap-main: the hidden region gets aria-hidden="true"; [data-tabs-swap-toggle]
 *   gets aria-expanded (whether main is open), kept in sync on every path.
 * Glide indicator: aria-hidden="true" (decorative).
 * Prev / next / swap-toggle buttons: must be <button>s; no other ARIA is added,
 *   so they need a visible label or an aria-label set in Webflow.
 * data-tabs-autoplay-pause-on-focus keeps content from changing while a
 *   keyboard user is inside the component.
 */

import { settleSplitText } from '../animations/splitText';
import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const DEFAULT_AUTOPLAY_MS = 5000;
// root → cleanup function of its instance.
const instances = new Map();
// Numbers the generated tab / panel ids (tabs-btn-<n>-<i>, tabs-panel-<n>-<i>).
let instanceCounter = 0;

const SELECTORS = {
  root: '[data-tabs-comp]',
  list: '[data-tabs-list]',
  button: '[data-tabs-btn]',
  panel: '[data-tabs-img]',
  panelElement: '[data-tabs-content-element]',
  linked: '[data-tabs-content]',
  prevContent: '[data-tabs-prev-content]',
  nextContent: '[data-tabs-next-content]',
  swapToggle: '[data-tabs-swap-toggle]',
  scrollWrap: '[data-tabs-scroll-wrap]',
  progress: '.tab-btn-progress, [data-tabs-btn-progress]',
  glide: '[data-tabs-btn-glide-toggle]',
  maskWrap: '[data-tabs-mask-wrap]',
  maskMedia: '[data-tabs-mask-media]',
  maskSwap: '[data-tabs-mask-swap]',
  video: 'video',
  sub: '[data-sub]',
  main: '[data-main]',
};

/**
 * Set up every tabs root that isn't set up yet.
 * @param {{ rootElements?: Element[], rootSelector?: string }} [options]
 * @returns {() => void} Runs cleanupTabs().
 */
export function initTabs(options = {}) {
  if (typeof document === 'undefined') {
    logger.warn('[Tabs] document is undefined (SSR) - skipping init.');
    return () => {};
  }

  const roots =
    options.rootElements ||
    Array.from(document.querySelectorAll(options.rootSelector || SELECTORS.root));

  if (!roots.length) {
    logger.info('[Tabs] No tabs found on the page - nothing to initialize.');
    return () => {};
  }

  let initializedCount = 0;

  roots.forEach((root) => {
    if (instances.has(root)) return;
    const cleanup = createTabsInstance(root);
    if (cleanup) {
      instances.set(root, cleanup);
      initializedCount += 1;
    }
  });

  if (initializedCount > 0) {
    logger.log(`🧭 Tabs ready (${initializedCount} instance${initializedCount > 1 ? 's' : ''})`);
  }

  return () => cleanupTabs();
}

/** Tear down every tabs instance (listeners, timers, observers, a running reveal). */
export function cleanupTabs() {
  instances.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      handleError(error, 'Tabs Cleanup');
    }
  });
  instances.clear();
}

function createTabsInstance(root) {
  let buttons = Array.from(root.querySelectorAll(SELECTORS.button));
  const panels = Array.from(root.querySelectorAll(SELECTORS.panel));
  if (!buttons.length || !panels.length) return null;

  // Swap-main (see the header): a [data-sub] button bar shown first, and
  // [data-main] with the full tabs. Needs both containers.
  const swapMain = root.hasAttribute('data-swap-main');
  const subContainer = swapMain ? root.querySelector(SELECTORS.sub) : null;
  const mainContainer = swapMain ? root.querySelector(SELECTORS.main) : null;
  const swapEnabled = swapMain && !!subContainer && !!mainContainer;
  if (swapMain && !swapEnabled) {
    logger.warn(
      '[Tabs] data-swap-main requires both [data-sub] and [data-main] children — swap disabled.',
      root
    );
  }

  // Resolve which panel each toggle controls: panelForButton[i] is the panel
  // buttons[i] controls. By DOM order (strict 1:1) by default; by the shared
  // [data-tabs-btn] / [data-tabs-img] value with data-match-by="id" or
  // swap-main, where several toggles may share a panel, toggles with no
  // matching panel are dropped and panels with no toggle stay hidden.
  const matchById =
    swapEnabled || (root.getAttribute('data-match-by') || '').trim().toLowerCase() === 'id';
  let panelForButton;

  if (matchById) {
    const panelByKey = new Map();
    panels.forEach((panel) => {
      const key = getMatchKey(panel, 'data-tabs-img');
      if (!key) {
        logger.warn('[Tabs] data-match-by="id": a [data-tabs-img] is missing an id value.', panel);
        return;
      }
      if (!panelByKey.has(key)) {
        panelByKey.set(key, panel);
      } else {
        logger.warn(
          `[Tabs] data-match-by="id": duplicate panel id "${key}" — first one wins.`,
          panel
        );
      }
    });

    const keptButtons = [];
    const resolvedPanels = [];
    buttons.forEach((btn) => {
      const key = getMatchKey(btn, 'data-tabs-btn');
      const panel = key ? panelByKey.get(key) : null;
      if (!panel) {
        logger.warn(
          `[Tabs] data-match-by="id": no [data-tabs-img] matches toggle id "${key || ''}" — skipping toggle.`,
          btn
        );
        return;
      }
      keptButtons.push(btn);
      resolvedPanels.push(panel);
    });

    buttons = keptButtons;
    panelForButton = resolvedPanels;
    if (!buttons.length) return null;
  } else {
    if (buttons.length !== panels.length) return null;
    panelForButton = panels.slice();
  }

  instanceCounter += 1;
  const instanceId = instanceCounter;

  // --- Swap-main view state -------------------------------------------------
  // The class toggled on the [data-sub] / [data-main] containers.
  const SWAP_ACTIVE_CLASS = 'active';
  // Which container each toggle lives in ('sub' | 'main' | null).
  const buttonRegion = buttons.map((btn) => {
    if (!swapEnabled) return null;
    if (mainContainer.contains(btn)) return 'main';
    if (subContainer.contains(btn)) return 'sub';
    return null;
  });
  let mainOpen = false;
  const swapToggleButtons = swapEnabled
    ? Array.from(root.querySelectorAll(SELECTORS.swapToggle))
    : [];

  // Show [data-main] (open) or the [data-sub] bar (collapsed), and mirror it in
  // aria-hidden on both regions and aria-expanded on every swap toggle.
  const setMainOpen = (open) => {
    mainOpen = open;
    mainContainer.classList.toggle(SWAP_ACTIVE_CLASS, open);
    subContainer.classList.toggle(SWAP_ACTIVE_CLASS, !open);
    mainContainer.setAttribute('aria-hidden', String(!open));
    subContainer.setAttribute('aria-hidden', String(open));
    swapToggleButtons.forEach((btn) => btn.setAttribute('aria-expanded', String(open)));
  };

  const openMain = () => {
    if (!swapEnabled || mainOpen) return;
    setMainOpen(true);
  };

  const collapseToSub = () => {
    if (!swapEnabled) return;
    // Collapsing exits the tabs entirely — no toggle (sub or main) stays active.
    clearActiveButtons();
    setMainOpen(false);
  };

  const firstButtonInRegion = (region) => buttonRegion.findIndex((r) => r === region);
  const buttonForPanelInRegion = (panel, region) =>
    buttons.findIndex((_, i) => buttonRegion[i] === region && panelForButton[i] === panel);

  // Start collapsed: the sub bar is what the user sees first.
  if (swapEnabled) setMainOpen(false);

  const reduceMotion = prefersReducedMotion();

  const autoplayEnabled = getBooleanAttr(root, 'data-tabs-autoplay', false);
  const autoplayMs = getNumberAttr(root, 'data-tabs-autoplay-delay', DEFAULT_AUTOPLAY_MS);
  const pauseOnHover = getBooleanAttr(root, 'data-tabs-autoplay-pause-on-hover', false);
  const pauseOnFocus = getBooleanAttr(root, 'data-tabs-autoplay-pause-on-focus', false);
  const pauseOnHidden = getBooleanAttr(root, 'data-tabs-autoplay-pause-on-hidden', true);
  const scrollActive = getBooleanAttr(root, 'data-tabs-scroll-active', true);
  const animateContent = getBooleanAttr(root, 'data-tabs-animate', true);
  const loopTabs = getBooleanAttr(root, 'data-tabs-loop', true);
  const activateOn = root.getAttribute('data-tabs-activate-on') || 'click';
  const activeClass = root.getAttribute('data-tabs-active-class') || 'active';
  const stopAutoplayOnFirstInteraction = getBooleanAttr(
    root,
    'data-stop-autoplay-on-first-interaction',
    false
  );
  const advanceOnVideoEnd = root.hasAttribute('data-tabs-advance-on-video-end');
  // Playing the active panel's <video> (muted) and pausing the outgoing one is
  // on by default; opt out where a dedicated video player owns playback and
  // the muted replay on returning to a tab is unwanted.
  const videoAutoplay = !root.hasAttribute('data-tabs-no-video-autoplay');

  // Mask reveal between panels — see switchPanelsWithMask().
  const maskEffect = root.getAttribute('data-tabs-effect') === 'mask';
  const maskDuration = Math.max(0, getNumberAttr(root, 'data-tabs-mask-duration', 1.1));
  // undefined → maskReveal()'s default ease (Pagtrans).
  const maskEase = root.getAttribute('data-tabs-mask-ease') || undefined;
  const maskParallax = getNumberAttr(root, 'data-tabs-mask-parallax', 100);
  // Set once utils/maskReveal has loaded; until then panels switch instantly.
  let maskRevealModule = null;
  // { finish, queued } while a panel reveal runs — tab switches wait for it.
  let panelReveal = null;
  let destroyed = false;
  if (maskEffect) {
    import('../utils/maskReveal')
      .then((module) => {
        maskRevealModule = module;
      })
      .catch((error) => handleError(error, 'Tabs Mask Reveal Loader'));
  }

  const presetIndex = findPresetIndex(buttons, activeClass);
  let activeIndex = presetIndex > -1 ? presetIndex : 0;
  let hasInitialized = false;

  // Autoplay state. isPaused: hover / focus pause; isAutoplayStopped: stopped
  // for good by data-stop-autoplay-on-first-interaction.
  let isInView = false;
  let isPaused = false;
  let isAutoplayStopped = false;

  let timerId = null;
  let remainingMs = autoplayMs;
  let cycleStartTs = 0;

  let videoEndedCleanup = null;
  let setActiveTransitionId = 0;

  const cleanupHandlers = [];
  // addEventListener, with the matching removal queued for teardown.
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    cleanupHandlers.push(() => target.removeEventListener(type, handler));
  };

  const now = () => (window.performance ? performance.now() : Date.now());

  const clearTimer = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  // --- Panel visibility and videos ------------------------------------------
  const setPanelVisibility = (panel, isVisible) => {
    if (!panel) return;
    panel.hidden = !isVisible;
    panel.style.display = isVisible ? '' : 'none';
  };

  const getVideosInPanel = (panel) => {
    if (!panel) return [];
    if (panel.tagName && panel.tagName.toLowerCase() === 'video') return [panel];
    return Array.from(panel.querySelectorAll(SELECTORS.video));
  };

  const pausePanelVideos = (panel) => {
    getVideosInPanel(panel).forEach((v) => {
      try {
        v.pause();
      } catch (e) {
        // ignore
      }
    });
  };

  // Muted, so browsers allow it without a user gesture; a refused play() is
  // not an error worth reporting.
  const playMuted = (video) => {
    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  const playPanelVideos = (panel) => {
    const first = getVideosInPanel(panel)[0];
    if (first) playMuted(first);
  };

  const clearVideoAdvance = () => {
    if (videoEndedCleanup) {
      videoEndedCleanup();
      videoEndedCleanup = null;
    }
  };

  // data-tabs-advance-on-video-end: play the panel's first video and move to
  // the next tab when it ends (instead of the autoplay timer).
  const setupVideoAdvance = (panel, currentIdx) => {
    clearVideoAdvance();
    const firstVideo = getVideosInPanel(panel)[0];
    if (!firstVideo) return;

    const onEnded = () => {
      const nextIdx = getNextIndex(currentIdx, buttons.length, loopTabs);
      if (nextIdx !== currentIdx) {
        setActive(nextIdx, false);
      }
    };
    firstVideo.addEventListener('ended', onEnded);
    videoEndedCleanup = () => {
      firstVideo.removeEventListener('ended', onEnded);
      videoEndedCleanup = null;
    };
    playMuted(firstVideo);
  };

  // Initial state — in swap mode nothing opens until the user enters main.
  const initialPanel = swapEnabled ? null : panelForButton[activeIndex];
  panels.forEach((panel) => {
    const isInitial = panel === initialPanel;
    setPanelVisibility(panel, isInitial);
    panel.classList.toggle(activeClass, isInitial);
    if (animateContent) {
      panel.querySelectorAll(SELECTORS.panelElement).forEach((el) => {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });
    }
  });

  // --- Autoplay progress bars -----------------------------------------------
  const getProgressEl = (idx) => buttons[idx]?.querySelector(SELECTORS.progress) || null;

  const setProgressInstant = (idx, percent) => {
    const progress = getProgressEl(idx);
    if (!progress) return;
    progress.style.transition = 'none';
    progress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    void progress.offsetWidth;
  };

  const animateProgressToEnd = (idx, ms) => {
    const progress = getProgressEl(idx);
    if (!progress) return;
    progress.style.transition = 'none';
    void progress.offsetWidth;
    progress.style.transition = `width ${ms}ms linear`;
    progress.style.width = '100%';
  };

  // How far through the current autoplay cycle we are, 0–100.
  const cyclePercent = () => 100 * (1 - remainingMs / autoplayMs);

  // --- Keep the active tab in view in a scrolling tab bar -------------------
  // [data-tabs-scroll-wrap], else the nearest ancestor of the first button that
  // scrolls horizontally and actually overflows.
  const getTabsScroller = () => {
    const explicit = root.querySelector(SELECTORS.scrollWrap);
    if (explicit) return explicit;

    const btn0 = buttons[0];
    if (!btn0) return null;

    let el = btn0.parentElement;
    while (el && el !== root) {
      const cs = window.getComputedStyle(el);
      const ox = cs.overflowX;
      const canScroll = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2;
      if (canScroll) return el;
      el = el.parentElement;
    }
    return null;
  };

  const scrollActiveTabIntoView = (idx) => {
    if (!scrollActive) return;
    const scroller = getTabsScroller();
    const btn = buttons[idx];
    if (!scroller || !btn) return;

    const behavior = reduceMotion ? 'auto' : 'smooth';
    const scrollerRect = scroller.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    const btnCenter = btnRect.left - scrollerRect.left + btnRect.width / 2;
    const desiredLeft = btnCenter - scroller.clientWidth / 2;

    const nextScrollLeft = Math.max(
      0,
      Math.min(scroller.scrollWidth - scroller.clientWidth, scroller.scrollLeft + desiredLeft)
    );

    scroller.scrollTo({ left: nextScrollLeft, behavior });
  };

  // --- Autoplay -------------------------------------------------------------
  // The timer counts down remainingMs from cycleStartTs, so a pause (hover,
  // focus, off screen, page hidden) resumes where it left off.
  const pauseAutoplayAndProgress = () => {
    if (!autoplayEnabled) return;
    clearVideoAdvance();
    if (isAutoplayStopped) {
      setProgressInstant(activeIndex, 100);
      return;
    }
    clearTimer();

    if (cycleStartTs) {
      const elapsed = now() - cycleStartTs;
      remainingMs = Math.max(0, remainingMs - elapsed);
    }
    cycleStartTs = 0;

    setProgressInstant(activeIndex, cyclePercent());
  };

  const advanceAutoplay = () => {
    remainingMs = autoplayMs;
    setActive(getNextIndex(activeIndex, buttons.length, loopTabs), false);
  };

  const startAutoplayAndProgress = () => {
    if (!autoplayEnabled || !isInView || isPaused || isAutoplayStopped) return;

    if (advanceOnVideoEnd) {
      setupVideoAdvance(panelForButton[activeIndex], activeIndex);
      return;
    }

    clearTimer();

    if (remainingMs <= 0) {
      advanceAutoplay();
      return;
    }

    setProgressInstant(activeIndex, cyclePercent());
    animateProgressToEnd(activeIndex, remainingMs);

    cycleStartTs = now();
    timerId = window.setTimeout(advanceAutoplay, remainingMs);
  };

  const resetCycle = () => {
    remainingMs = autoplayMs;
    cycleStartTs = 0;
  };

  // --- Content-element animations ([data-tabs-content-element]) -------------
  // GSAP is read from window.gsap (put there by src/components/gsap.js, which
  // src/global/index.js loads before tabs); without it these are skipped.
  const animateInContentElements = (panel) => {
    if (!panel || !animateContent) return;
    const items = Array.from(panel.querySelectorAll(SELECTORS.panelElement));
    if (!items.length) return;

    const gsap = window.gsap;
    if (!gsap) return;

    const duration = reduceMotion ? 0.25 : 0.5;
    const stagger = reduceMotion ? 0.02 : 0.05;
    const fromY = reduceMotion ? 0 : 20;
    const fromScale = reduceMotion ? 1 : 0.98;

    gsap
      .timeline()
      .set(items, {
        opacity: 0,
        y: fromY,
        pointerEvents: 'auto',
        filter: 'blur(0px)',
        scale: fromScale,
      })
      .to(items, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        scale: 1,
        duration,
        stagger,
        ease: 'power2.out',
      });
  };

  const animateOutContentElements = (panel) =>
    new Promise((resolve) => {
      if (!panel || !animateContent) return resolve();
      const items = Array.from(panel.querySelectorAll(SELECTORS.panelElement));
      if (!items.length) return resolve();

      const gsap = window.gsap;
      if (!gsap) return resolve();

      const duration = reduceMotion ? 0.2 : 0.3;
      const stagger = reduceMotion ? 0.02 : 0.04;
      const toY = reduceMotion ? 0 : -10;
      const toBlur = reduceMotion ? 0 : 6;
      const toScale = reduceMotion ? 1 : 0.98;

      gsap.killTweensOf(items);
      gsap.to(items, {
        opacity: 0,
        y: toY,
        filter: `blur(${toBlur}px)`,
        scale: toScale,
        duration,
        stagger,
        ease: 'power2.in',
        onComplete: () => {
          items.forEach((el) => (el.style.pointerEvents = 'none'));
          resolve();
        },
      });
    });

  // --- Linked content ([data-tabs-content]) ----------------------------------
  // Outside the panels, one per panel (see the header): the showing one's
  // parts go, then the next one's come in.
  const linked = Array.from(root.querySelectorAll(SELECTORS.linked)).filter(
    (el) => !panels.some((panel) => panel.contains(el))
  );
  const linkedFor = (panel) => {
    if (!panel || !linked.length) return null;
    if (matchById) {
      const key = getMatchKey(panel, 'data-tabs-img');
      return linked.find((el) => getMatchKey(el, 'data-tabs-content') === key) || null;
    }
    return linked[panels.indexOf(panel)] || null;
  };
  const linkedParts = (el) => {
    const marked = Array.from(el.querySelectorAll(SELECTORS.panelElement));
    return marked.length ? marked : Array.from(el.children);
  };
  const LINKED_PROPS = 'opacity,transform,visibility';
  // Its [data-split-text] (src/animations/splitText.js) can't play on its own
  // scroll trigger while hidden: put in place as it shows — the parts' own
  // rise brings it in.
  const showLinkedEl = (el) => {
    setPanelVisibility(el, true);
    el.querySelectorAll('[data-split-text]').forEach(settleSplitText);
  };
  // (undefined until the first call, which hides all but the one showing.)
  let shownLinked;
  let linkedSwitch = null;
  const showLinked = (next, animate) => {
    if (!linked.length || next === shownLinked) return;
    const gsap = window.gsap;
    const prev = shownLinked;
    shownLinked = next;
    linkedSwitch?.kill();
    linkedSwitch = null;
    // Animated, the showing one stays until its parts have gone, and the next
    // one shows after it.
    const animated = Boolean(animate && gsap && animateContent && prev);
    linked.forEach((el) => {
      if (animated && el === prev) return;
      // (On load the showing one's text plays on its own, as it scrolls in.)
      if (!animated && el === next) {
        if (hasInitialized) showLinkedEl(el);
        else setPanelVisibility(el, true);
      } else setPanelVisibility(el, false);
    });
    if (!animated) {
      if (gsap) gsap.set(linked.flatMap(linkedParts), { clearProps: LINKED_PROPS });
      return;
    }
    const outParts = linkedParts(prev);
    const inParts = next ? linkedParts(next) : [];
    linkedSwitch = gsap
      .timeline()
      .to(outParts, {
        opacity: 0,
        y: reduceMotion ? 0 : -10,
        duration: reduceMotion ? 0.2 : 0.35,
        stagger: reduceMotion ? 0.02 : 0.05,
        ease: 'power2.in',
      })
      .add(() => {
        setPanelVisibility(prev, false);
        gsap.set(outParts, { clearProps: LINKED_PROPS });
        if (next) showLinkedEl(next);
      });
    if (inParts.length) {
      linkedSwitch.fromTo(
        inParts,
        { opacity: 0, y: reduceMotion ? 0 : 18 },
        {
          opacity: 1,
          y: 0,
          duration: reduceMotion ? 0.25 : 0.9,
          stagger: reduceMotion ? 0.02 : 0.08,
          ease: reduceMotion ? 'power1.out' : 'expo.out',
          clearProps: LINKED_PROPS,
        }
      );
    }
  };
  showLinked(linkedFor(initialPanel), false);

  // --- Glide indicator ([data-tabs-btn-glide-toggle]) -----------------------
  // One entry per tablist that holds a glide: { el, tabs, current }. Filled
  // once the tablists are resolved (further down); every active-tab change
  // goes through markActiveButtons / clearActiveButtons, which re-place it.
  const glides = [];

  // Size + position the glide over its current tab, relative to the glide's
  // positioned parent (scrollLeft keeps it right in a scrolled tab bar).
  const placeGlide = (glide, animate) => {
    const { el, current } = glide;
    const parent = el.offsetParent;
    // Not rendered (display:none) — the ResizeObserver re-places it once shown.
    if (!current || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const tabRect = current.getBoundingClientRect();
    if (!animate) el.style.transition = 'none';
    el.style.setProperty(
      '--glide-x',
      `${tabRect.left - parentRect.left - parent.clientLeft + parent.scrollLeft}px`
    );
    el.style.setProperty(
      '--glide-y',
      `${tabRect.top - parentRect.top - parent.clientTop + parent.scrollTop}px`
    );
    el.style.setProperty('--glide-width', `${tabRect.width}px`);
    el.style.setProperty('--glide-height', `${tabRect.height}px`);
    if (!animate) {
      void el.offsetWidth; // commit the jump before the transition comes back
      el.style.transition = '';
    }
  };

  const restartGlideSquash = (el) => {
    el.classList.remove('is-moving');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('is-moving');
  };

  // Follow the tab (in this glide's own tablist) that controls the active
  // panel — the selected one if several share it (id mode); hide when none.
  const updateGlides = (animate) => {
    glides.forEach((glide) => {
      const active = glide.tabs.filter((tab) => tab.classList.contains(activeClass));
      const next = active.find((tab) => tab.getAttribute('aria-selected') === 'true') || active[0];
      const wasShown = Boolean(glide.current);
      glide.el.setAttribute('data-state', next ? 'active' : 'hidden');
      // Hidden: keep the last position so it fades out in place.
      if (!next) {
        glide.current = null;
        return;
      }
      const moved = wasShown && glide.current !== next;
      glide.current = next;
      if (animate && moved && !reduceMotion) restartGlideSquash(glide.el);
      // Slide only between two tabs; a first placement or a re-show jumps.
      placeGlide(glide, animate && moved);
    });
  };

  // --- Active toggle state --------------------------------------------------
  // Mark every toggle pointing at the active panel (id mode may have several);
  // roving tabindex + aria-selected stay on the single activated toggle.
  const markActiveButtons = (index) => {
    const activePanel = panelForButton[index];
    buttons.forEach((btn, i) => {
      const isActive = i === index;
      btn.classList.toggle(activeClass, panelForButton[i] === activePanel);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    updateGlides(hasInitialized);
  };

  // Swap-main: fully clear toggle active state, used when collapsing to sub so
  // neither the sub nor the main buttons look selected.
  const clearActiveButtons = () => {
    buttons.forEach((btn) => {
      btn.classList.remove(activeClass);
      btn.setAttribute('aria-selected', 'false');
    });
    updateGlides(true);
  };

  // --- Carousels in panels --------------------------------------------------
  // Carousels initialise when they scroll into view, which a display:none
  // panel never does — so initialise the incoming panel's now, before a mask
  // reveal, or it would wipe in un-laid-out. Capped, so one that never
  // initialises (e.g. data-carousel="mobile" on desktop) can't hold it up.
  const initCarouselsIn = async (panel) => {
    const carousels = [panel, ...panel.querySelectorAll('[data-carousel]')].filter(
      (el) => el.hasAttribute('data-carousel') && !el._carouselInitialized
    );
    if (!carousels.length) return;
    try {
      const { ensureCarouselInitialized } = await import('./carousel');
      await Promise.race([
        Promise.all(carousels.map((el) => ensureCarouselInitialized(el))),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } catch (error) {
      handleError(error, 'Tabs Carousel Init');
    }
  };

  // --- Mask reveal between panels (data-tabs-effect="mask") -----------------
  // Per panel: [data-tabs-mask-wrap] is the clipped layer that wipes across (the
  // panel itself if absent) and [data-tabs-mask-media] the layer that counter-moves
  // so the picture stays put (none → a plain push). Same maths as the mask
  // carousel/slider (utils/maskReveal).
  const maskLayers = (panel) => ({
    wrap: panel.querySelector(SELECTORS.maskWrap) || panel,
    media: panel.matches(SELECTORS.maskMedia) ? panel : panel.querySelector(SELECTORS.maskMedia),
  });
  // The children of a panel's [data-tabs-mask-swap] groups (e.g. carousel dots).
  const swapItems = (panel) =>
    Array.from(panel.querySelectorAll(SELECTORS.maskSwap)).flatMap((group) =>
      Array.from(group.children)
    );

  /**
   * Add the swap of the [data-tabs-mask-swap] items to the reveal `timeline`,
   * in shares of its duration: the outgoing ones shrink away (last first), then
   * the incoming ones pop in (first first) as the wipe settles.
   */
  const addSwapItems = (timeline, outgoingItems, incomingItems) => {
    const hidden = { scale: 0, autoAlpha: 0 };
    if (outgoingItems.length) {
      timeline.fromTo(
        outgoingItems,
        { scale: 1, autoAlpha: 1 },
        {
          ...hidden,
          duration: maskDuration * 0.3,
          ease: 'power2.in',
          stagger: { amount: maskDuration * 0.1, from: 'end' },
        },
        0
      );
    }
    if (incomingItems.length) {
      timeline.fromTo(
        incomingItems,
        hidden,
        {
          scale: 1,
          autoAlpha: 1,
          duration: maskDuration * 0.45,
          ease: 'back.out(2.5)',
          stagger: { amount: maskDuration * 0.15 },
        },
        maskDuration * 0.4
      );
    }
  };

  /**
   * Swap `prev` for `next` with the mask reveal. The outgoing panel is pinned
   * (absolutely, exactly where it sits) under the incoming one, which takes its
   * place in the flow; both run the reveal, then the outgoing panel is hidden
   * and every inline style touched here is restored to what it was.
   * Resolves once the reveal has started.
   */
  const switchPanelsWithMask = async (prev, next, direction) => {
    const parent = prev.parentElement;
    const outgoing = maskLayers(prev);
    const incoming = maskLayers(next);
    const saved = new Map();
    const save = (el) => {
      if (el && !saved.has(el)) saved.set(el, el.getAttribute('style'));
    };
    // The incoming layers are saved later, once its carousels have initialised
    // — those write their own inline styles (e.g. overflow on [data-carousel-wrapper])
    // that the restore must keep.
    const outgoingItems = swapItems(prev);
    let incomingItems = [];
    [prev, parent, outgoing.wrap, outgoing.media, ...outgoingItems].forEach(save);
    // Swap groups must paint over BOTH panels' wipes, so the panels then stay
    // out of stacking contexts (their wraps never overlap anyway) and the
    // groups are raised instead. Otherwise the incoming panel stacks on top.
    const swapGroups = [prev, next].flatMap((panel) =>
      Array.from(panel.querySelectorAll(SELECTORS.maskSwap))
    );
    const stackPanels = !swapGroups.length;
    swapGroups.forEach((group) => {
      const style = getComputedStyle(group);
      if (style.zIndex !== 'auto') return;
      save(group);
      if (style.position === 'static') group.style.position = 'relative';
      group.style.zIndex = '3';
    });

    const box = {
      left: prev.offsetLeft,
      top: prev.offsetTop,
      width: prev.offsetWidth,
      height: prev.offsetHeight,
    };
    Object.assign(prev.style, {
      position: 'absolute',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      zIndex: stackPanels ? '1' : '',
    });
    prev.inert = true;

    setPanelVisibility(next, true);
    next.classList.add(activeClass);
    save(next); // visible state — what it keeps after the reveal
    // Hidden (but laid out) until the reveal starts, so nothing flashes while
    // its carousels initialise.
    next.style.visibility = 'hidden';
    if (stackPanels) next.style.zIndex = '2';
    if (getComputedStyle(next).position === 'static') next.style.position = 'relative';
    // The incoming layer starts a full width outside its box.
    if (parent) parent.style.overflow = 'clip';
    outgoing.wrap.style.overflow = 'hidden';

    let timeline = null;
    let finished = false;
    // queued: an autoplay switch that came due mid-reveal, run once it ends.
    const state = { finish: null, queued: null };
    const finish = () => {
      if (finished) return;
      finished = true;
      timeline?.kill();
      maskRevealModule?.resetMaskReveal([
        outgoing.wrap,
        outgoing.media,
        incoming.wrap,
        incoming.media,
        ...outgoingItems,
        ...incomingItems,
      ]);
      saved.forEach((style, el) => {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      });
      prev.inert = false;
      prev.classList.remove(activeClass);
      setPanelVisibility(prev, false);
      panelReveal = null;
      if (state.queued !== null && !destroyed) setActive(state.queued, false);
    };
    state.finish = finish;
    panelReveal = state;

    await initCarouselsIn(next);
    if (finished) return; // destroyed while waiting

    save(incoming.wrap);
    save(incoming.media);
    // Read now: a carousel builds its dots as it initialises.
    incomingItems = swapItems(next);
    incomingItems.forEach(save);
    // Their own CSS transitions (e.g. on opacity) would drag behind the tweens.
    [...outgoingItems, ...incomingItems].forEach((el) => (el.style.transition = 'none'));
    incoming.wrap.style.overflow = 'hidden';
    next.style.visibility = '';
    // A panel that is itself the picture can't move against itself: it's
    // uncovered by a clip over the outgoing one (its clip-path is restored
    // with the rest of its inline style).
    timeline =
      incoming.media === next
        ? maskRevealModule.maskClipReveal({
            incoming: next,
            direction,
            duration: maskDuration,
            ease: maskEase,
            onComplete: finish,
          })
        : maskRevealModule.maskReveal({
            outgoing,
            incoming,
            direction,
            duration: maskDuration,
            ease: maskEase,
            parallax: maskParallax,
            onComplete: finish,
          });
    addSwapItems(timeline, outgoingItems, incomingItems);
  };

  const setActive = (index, userTriggered) => {
    if (index < 0 || index >= buttons.length) return Promise.resolve();
    if (index === activeIndex && hasInitialized) return Promise.resolve();
    // A panel reveal is running — ignore a user switch rather than cut it
    // short (the tab state never moved, so the UI stays consistent); an
    // autoplay switch waits for it instead, so rotation doesn't stall.
    if (panelReveal) {
      if (!userTriggered) panelReveal.queued = index;
      return Promise.resolve();
    }

    const thisTransitionId = ++setActiveTransitionId;

    if (userTriggered && stopAutoplayOnFirstInteraction && !isAutoplayStopped) {
      isAutoplayStopped = true;
      isPaused = true;
      clearTimer();
    }

    pauseAutoplayAndProgress();
    resetCycle();

    const prevIndex = activeIndex;
    const prevPanel = hasInitialized ? panelForButton[prevIndex] : null;
    const nextPanel = panelForButton[index];
    // In id mode two toggles can share one panel — skip panel transitions when
    // the underlying panel doesn't actually change (only the active toggle does).
    const panelChanged = prevPanel !== nextPanel;

    activeIndex = index;

    markActiveButtons(index);
    buttons.forEach((_, i) => setProgressInstant(i, 0));

    scrollActiveTabIntoView(index);

    // Update aria-hidden synchronously so AT users aren't exposed to outgoing content
    nextPanel.setAttribute('aria-hidden', 'false');
    panels.forEach((panel) => {
      if (panel !== nextPanel) panel.setAttribute('aria-hidden', 'true');
    });

    // Linked content changes alongside (not waited for).
    if (panelChanged) showLinked(linkedFor(nextPanel), hasInitialized);

    const outPromise =
      prevPanel && panelChanged ? animateOutContentElements(prevPanel) : Promise.resolve();

    return outPromise.then(async () => {
      if (thisTransitionId !== setActiveTransitionId) return;

      const useMask =
        maskEffect &&
        maskRevealModule &&
        !reduceMotion &&
        maskDuration > 0 &&
        hasInitialized &&
        panelChanged &&
        prevPanel;

      panels.forEach((panel) => {
        if (panel !== nextPanel && !(useMask && panel === prevPanel)) {
          panel.classList.remove(activeClass);
          setPanelVisibility(panel, false);
        }
      });

      if (useMask) {
        // Later tab in DOM order → forward (wipes in from the right).
        await switchPanelsWithMask(prevPanel, nextPanel, index > prevIndex ? 1 : -1);
      } else {
        setPanelVisibility(nextPanel, true);
        nextPanel.classList.add(activeClass);
        // Initialise its carousels right away rather than a frame or more later
        // when their IntersectionObserver notices the panel — no flash of
        // un-laid-out slides on a plain switch either.
        if (hasInitialized && panelChanged) initCarouselsIn(nextPanel);
      }

      if (panelChanged || !hasInitialized) animateInContentElements(nextPanel);
      hasInitialized = true;

      if (panelChanged && videoAutoplay) {
        pausePanelVideos(prevPanel);
        playPanelVideos(nextPanel);
      }

      if (isAutoplayStopped) {
        setProgressInstant(activeIndex, 100);
      } else {
        startAutoplayAndProgress(); // no-op unless autoplay is on, in view and not paused
      }

      root.dispatchEvent(
        new CustomEvent('tabs:change', {
          detail: {
            index,
            button: buttons[index],
            panel: nextPanel,
            reason: userTriggered ? 'user' : 'auto',
          },
          bubbles: true,
        })
      );
    });
  };

  // --- Activation, focus and keyboard ---------------------------------------
  const focusButton = (idx) => {
    const btn = buttons[idx];
    if (!btn) return;
    try {
      btn.focus({ preventScroll: true });
    } catch (error) {
      btn.focus();
    }
  };

  // Swap-main: focus the button in `region` that controls `panel`, if any.
  const focusRegionButton = (panel, region) => {
    const idx = buttonForPanelInRegion(panel, region);
    if (idx > -1) focusButton(idx);
  };

  // True when button i drives whichever panel is currently active.
  const controlsActivePanel = (i) => panelForButton[i] === panelForButton[activeIndex];

  // Activation entry point shared by pointer + keyboard. Without swap-main it is
  // just setActive; with it, it layers the sub/main view swap on top.
  const activateButton = (i, userTriggered) => {
    if (!swapEnabled) return setActive(i, userTriggered);

    const region = buttonRegion[i];

    // Re-clicking the active main tab collapses back to the sub view.
    if (region === 'main' && mainOpen && hasInitialized && controlsActivePanel(i)) {
      collapseToSub();
      focusRegionButton(panelForButton[i], 'sub');
      return Promise.resolve();
    }

    // From the sub bar (or a main tab while collapsed): open main + show panel.
    const wasClosed = !mainOpen;
    // setActive early-returns (skipping its re-mark) when the target is already
    // the active tab; after a collapse cleared the buttons we must re-mark so
    // reopening the same panel lights its toggles again.
    const needsRemark = i === activeIndex && hasInitialized;
    openMain();
    const result = setActive(i, userTriggered);
    if (needsRemark) markActiveButtons(i);
    // Expanding from a sub button hands focus to the matching main tab.
    if (wasClosed && region === 'sub') {
      result.then(() => focusRegionButton(panelForButton[i], 'main'));
    }
    return result;
  };

  const onButtonKeydown = (event, idx) => {
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      activateButton(idx, true);
      return;
    }

    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();

    // Arrows move within the focused button's own region (all buttons unless
    // swap-main), so focus never lands on a hidden button.
    const region = buttonRegion[idx];
    const group = buttons.map((_, i) => i).filter((i) => buttonRegion[i] === region);
    const pos = group.indexOf(idx);
    let nextPos = pos;
    if (key === 'ArrowRight') nextPos = getNextIndex(pos, group.length, loopTabs);
    if (key === 'ArrowLeft') nextPos = getPrevIndex(pos, group.length, loopTabs);
    if (key === 'Home') nextPos = 0;
    if (key === 'End') nextPos = group.length - 1;
    const nextIndex = group[nextPos];

    // Swap-main sub bar: arrows move focus only (Enter / click opens main).
    if (swapEnabled && region !== 'main') {
      focusButton(nextIndex);
      return;
    }
    setActive(nextIndex, true).then(() => focusButton(nextIndex));
  };

  // --- ARIA wiring: tablists, panels, tabs ----------------------------------
  // Every role="tab" element must be a DOM descendant of a role="tablist"
  // element, and that tablist needs an accessible name — an unlabelled or
  // parentless tab is exactly the "missing required context" failure axe/
  // Lighthouse report. Swap-main splits tabs across two SEPARATE containers
  // ([data-sub] and [data-main]), so it needs two tablists, not one.
  const applyTablistRole = (el, fallbackLabel) => {
    if (!el) return;
    el.setAttribute('role', 'tablist');
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      el.setAttribute('aria-label', fallbackLabel);
    }
  };

  // Smallest element within `boundary` that contains every element in
  // `elements`. A plain `elements[0].parentElement` breaks on CMS-rendered
  // lists (e.g. a Webflow collection list), which wrap each [data-tabs-btn] in
  // its own per-item element — that wrapper contains only the first button,
  // not its siblings, so a tablist role placed there still leaves the rest
  // of the tabs with no tablist ancestor.
  const closestCommonAncestor = (elements, boundary) => {
    if (!elements.length) return boundary;
    let candidate = elements[0].parentElement;
    while (candidate && candidate !== boundary) {
      if (elements.every((el) => candidate.contains(el))) return candidate;
      candidate = candidate.parentElement;
    }
    return boundary;
  };

  // A tablist must own its tabs directly (ignoring presentational wrappers).
  // Anything in between — typically the Webflow collection item around each
  // CMS-rendered button (`.w-dyn-item`, role="listitem") — breaks that: axe
  // reports aria-required-children on the tablist and aria-required-parent on
  // every listitem/tab. Make those wrappers presentational.
  const flattenTablist = (tablist, tabs) => {
    if (!tablist) return;
    tabs.forEach((tab) => {
      if (!tablist.contains(tab)) return;
      for (let node = tab.parentElement; node && node !== tablist; node = node.parentElement) {
        node.setAttribute('role', 'none');
      }
    });
  };

  // Each tablist with its own tabs and the region it lives in — used below to
  // find each tablist's glide indicator.
  const tablistGroups = [];
  if (swapEnabled) {
    const subButtons = buttons.filter((_, i) => buttonRegion[i] === 'sub');
    const mainButtons = buttons.filter((_, i) => buttonRegion[i] === 'main');
    const subList =
      subContainer.querySelector(SELECTORS.list) || closestCommonAncestor(subButtons, subContainer);
    const mainList =
      mainContainer.querySelector(SELECTORS.list) ||
      closestCommonAncestor(mainButtons, mainContainer);
    applyTablistRole(subList, root.getAttribute('data-tabs-sub-label') || 'Tabs');
    applyTablistRole(mainList, root.getAttribute('data-tabs-main-label') || 'Tabs');
    flattenTablist(subList, subButtons);
    flattenTablist(mainList, mainButtons);
    tablistGroups.push(
      { list: subList, tabs: subButtons, scope: subContainer },
      { list: mainList, tabs: mainButtons, scope: mainContainer }
    );
  } else {
    const listElement = root.querySelector(SELECTORS.list) || closestCommonAncestor(buttons, root);
    applyTablistRole(listElement, root.getAttribute('data-tabs-label') || 'Tabs');
    flattenTablist(listElement, buttons);
    tablistGroups.push({ list: listElement, tabs: buttons, scope: root });
  }

  // Assign an id + role to each unique panel once (a panel may be shared by
  // several toggles in id mode). tabindex="0" lets a keyboard user tab from
  // the active tab straight into panel content that has no focusable
  // descendant of its own (per the WAI-ARIA APG tabpanel pattern).
  const panelIdByPanel = new Map();
  panels.forEach((panel, pIdx) => {
    const panelId = panel.id || `tabs-panel-${instanceId}-${pIdx}`;
    panel.id = panelId;
    panelIdByPanel.set(panel, panelId);
    panel.setAttribute('role', 'tabpanel');
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '0');
  });

  // Collect the toggle ids that label each panel — a shared panel is labelled
  // by all of its toggles (space-separated aria-labelledby).
  const labelledByPanel = new Map();

  // In swap mode nothing is selected initially; roving focus starts on the
  // first sub button so keyboard users begin in the visible view.
  const initialFocusIndex = swapEnabled ? Math.max(firstButtonInRegion('sub'), 0) : activeIndex;
  buttons.forEach((btn, i) => {
    const panel = panelForButton[i];
    const btnId = btn.id || `tabs-btn-${instanceId}-${i}`;
    const isActive = !swapEnabled && i === activeIndex;
    btn.id = btnId;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', panelIdByPanel.get(panel));
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', i === initialFocusIndex ? '0' : '-1');
    // Mark every toggle that shares the initial active panel (id mode).
    btn.classList.toggle(activeClass, panel === initialPanel);

    // Give every tab an explicit accessible name from its own visible text,
    // when the author hasn't already set one. role="tab" computes its name
    // from content by default, but that's fragile (e.g. text swapped for an
    // icon later) — baking it into aria-label makes it explicit. Skipped when
    // there's no text to derive from; an icon-only tab still needs an
    // author-set aria-label in the Webflow editor.
    if (!btn.hasAttribute('aria-label') && !btn.hasAttribute('aria-labelledby')) {
      const label = btn.textContent.replace(/\s+/g, ' ').trim();
      if (label) btn.setAttribute('aria-label', `${label} tab button`);
    }

    if (!labelledByPanel.has(panel)) labelledByPanel.set(panel, []);
    labelledByPanel.get(panel).push(btnId);

    listen(btn, 'click', (evt) => {
      evt.preventDefault();
      activateButton(i, true);
    });
    listen(btn, 'keydown', (evt) => onButtonKeydown(evt, i));
    if (activateOn === 'hover') listen(btn, 'mouseenter', () => activateButton(i, true));
  });

  // Apply aria-labelledby (possibly several toggles) + initial aria-hidden per
  // panel. In swap mode initialPanel is null, so every panel starts hidden.
  panels.forEach((panel) => {
    const ids = labelledByPanel.get(panel);
    if (ids && ids.length) panel.setAttribute('aria-labelledby', ids.join(' '));
    panel.setAttribute('aria-hidden', panel === initialPanel ? 'false' : 'true');
  });

  // Glide indicators: the first [data-tabs-btn-glide-toggle] in each tablist (or,
  // failing that, in its region), ignoring any that belong to nested tabs.
  const ownGlide = (container) =>
    container
      ? Array.from(container.querySelectorAll(SELECTORS.glide)).find(
          (el) => el.closest(SELECTORS.root) === root && !glides.some((g) => g.el === el)
        )
      : null;
  tablistGroups.forEach(({ list, tabs, scope }) => {
    const el = ownGlide(list) || ownGlide(scope);
    if (!el || !tabs.length) return;
    el.setAttribute('aria-hidden', 'true');
    glides.push({ el, tabs, current: null });
  });

  if (glides.length) {
    // Place at the initial tab without sliding in from the corner.
    updateGlides(false);

    const onGlideAnimationEnd = (event) => event.currentTarget.classList.remove('is-moving');
    glides.forEach(({ el }) => listen(el, 'animationend', onGlideAnimationEnd));

    // Re-align (without sliding) whenever a tab or the list changes size —
    // web fonts arriving, a resize, or the tabs going from display:none (an
    // inactive parent tab or accordion) to shown.
    if (typeof ResizeObserver !== 'undefined') {
      const glideResizeObserver = new ResizeObserver(() => {
        glides.forEach((glide) => placeGlide(glide, false));
      });
      glides.forEach(({ el, tabs }) => {
        if (el.parentElement) glideResizeObserver.observe(el.parentElement);
        tabs.forEach((tab) => glideResizeObserver.observe(tab));
      });
      cleanupHandlers.push(() => glideResizeObserver.disconnect());
    }
  }

  // --- Prev / next and swap-toggle buttons ----------------------------------
  root.querySelectorAll(SELECTORS.prevContent).forEach((prevBtn) => {
    listen(prevBtn, 'click', (evt) => {
      evt.preventDefault();
      setActive(getPrevIndex(activeIndex, buttons.length, loopTabs), true);
    });
  });

  root.querySelectorAll(SELECTORS.nextContent).forEach((nextBtn) => {
    listen(nextBtn, 'click', (evt) => {
      evt.preventDefault();
      setActive(getNextIndex(activeIndex, buttons.length, loopTabs), true);
    });
  });

  // [data-tabs-swap-toggle]: swap-main only — switches sub <-> main directly,
  // instead of relying on re-clicking the active main tab to collapse back.
  // Its aria-expanded is kept in sync by setMainOpen().
  if (swapEnabled) {
    const onSwapToggleClick = (evt) => {
      evt.preventDefault();
      if (mainOpen) {
        collapseToSub();
        focusRegionButton(panelForButton[activeIndex], 'sub');
        return;
      }
      // Mirrors activateButton's needsRemark: setActive early-returns without
      // re-marking when the target is already activeIndex, which it always is
      // here (this only reopens whatever was last active) — except on the
      // very first use, when hasInitialized is still false and setActive's
      // own full run already marks correctly.
      const needsRemark = hasInitialized;
      openMain();
      setActive(activeIndex, true);
      if (needsRemark) markActiveButtons(activeIndex);
      focusRegionButton(panelForButton[activeIndex], 'main');
    };
    swapToggleButtons.forEach((btn) => listen(btn, 'click', onSwapToggleClick));
  }

  // --- Autoplay pause / resume triggers -------------------------------------
  const pauseForUser = () => {
    isPaused = true;
    pauseAutoplayAndProgress();
  };
  const resumeForUser = () => {
    isPaused = false;
    startAutoplayAndProgress();
  };
  if (pauseOnHover) {
    listen(root, 'mouseenter', pauseForUser);
    listen(root, 'mouseleave', resumeForUser);
  }
  if (pauseOnFocus) {
    listen(root, 'focusin', pauseForUser);
    listen(root, 'focusout', resumeForUser);
  }

  if (pauseOnHidden) {
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        pauseAutoplayAndProgress();
      } else {
        startAutoplayAndProgress();
      }
    });
  }

  // --- Start ----------------------------------------------------------------
  // The first activation waits until the component scrolls into view
  // (immediately without IntersectionObserver); autoplay only runs in view.
  // Swap mode stays collapsed until the user opens main.
  const activateInitialTab = () => {
    if (swapEnabled) return;
    setActive(activeIndex, false).then(() => {
      startAutoplayAndProgress();
    });
  };

  const observer =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                isInView = true;
                if (hasInitialized) {
                  scrollActiveTabIntoView(activeIndex);
                  startAutoplayAndProgress();
                } else {
                  activateInitialTab();
                }
              } else {
                isInView = false;
                pauseAutoplayAndProgress();
              }
            });
          },
          { threshold: 0.2 }
        )
      : null;

  if (observer) {
    observer.observe(root);
  } else {
    isInView = true;
    activateInitialTab();
  }

  return () => {
    clearVideoAdvance();
    clearTimer();
    if (observer) observer.disconnect();
    // Settle a running panel reveal first, so no panel stays pinned/half-wiped
    // (and a queued autoplay switch doesn't fire after teardown).
    destroyed = true;
    panelReveal?.finish();
    linkedSwitch?.kill();
    linked.forEach((el) => {
      el.hidden = false;
      el.style.display = '';
      window.gsap?.set(linkedParts(el), { clearProps: LINKED_PROPS });
    });
    cleanupHandlers.forEach((cleanup) => cleanup());
    cleanupHandlers.length = 0;
  };
}

function getMatchKey(element, attr) {
  if (!element) return null;
  const value = (element.getAttribute(attr) || '').trim();
  return value || null;
}

// Absent → fallback; present → true unless its value is exactly "false".
function getBooleanAttr(element, attr, fallback) {
  if (!element || !element.hasAttribute(attr)) return fallback;
  return element.getAttribute(attr) !== 'false';
}

function getNumberAttr(element, attr, fallback) {
  if (!element || !element.hasAttribute(attr)) return fallback;
  const value = Number(element.getAttribute(attr));
  return Number.isFinite(value) ? value : fallback;
}

// The tab marked active in markup (the active class, then "is-active"), or -1.
function findPresetIndex(buttons, activeClass) {
  const byActive = buttons.findIndex((btn) => btn.classList.contains(activeClass));
  if (byActive > -1) return byActive;
  return buttons.findIndex((btn) => btn.classList.contains('is-active'));
}

function getNextIndex(current, total, loop) {
  if (current + 1 < total) return current + 1;
  return loop ? 0 : total - 1;
}

function getPrevIndex(current, total, loop) {
  if (current - 1 >= 0) return current - 1;
  return loop ? total - 1 : 0;
}
