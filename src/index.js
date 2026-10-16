import './utils/intersectionObserverGuard';
import { enterZoomIns } from './animations/zoomIn';
import { pauseImageRevealWatch } from './animations/imageReveal';
import { initGlobal, teardownGlobal } from './global';
import { refreshLenisForPage, resetScrollPosition } from './global/lenis';
import { initPageTransitions, pageTransitionsEnabled } from './global/pageTransition';
import { ScrollTrigger } from './utils/gsapCore';
import { holdScrollRefresh } from './utils/scrollRefresh';
import { logger } from './utils/logger';

document.documentElement.classList.add('has-js');

if (typeof window !== 'undefined') {
  resetScrollPosition();
}

// Page-specific code only. Carousels, the testimonial slider and the video
// players are initialised by the global pass wherever their markup appears
// (global/index.js → initComponentsOnDemand), so a page needs a module here
// only for code that exists on that one page. Each module is its own chunk,
// downloaded only on its page (see bin/build.js). `cleanup` runs before
// another page is started in its place (Barba page transitions).
const pageRegistry = {
  home: () =>
    import('./pages/home').then((m) => ({ init: m.initHomePage, cleanup: m.cleanupHomePage })),
};

// data-page values set in Webflow that need no page module — everything on
// those pages is handled by the global pass. Listed so the router can tell an
// intentional "no page code" apart from a typo or a missing registration.
const PAGES_WITHOUT_PAGE_CODE = new Set([]);

// Read fresh each time: a Barba page swap copies the new page's data-page
// onto the body (src/global/pageTransition.js).
function getCurrentPage() {
  const bodyPage = document.body.getAttribute('data-page');
  const htmlPage = document.documentElement.getAttribute('data-page');
  return bodyPage || htmlPage || null;
}

// The running page module's cleanup, if it has one.
let pageCleanup = null;

async function runPageModule() {
  const pageName = getCurrentPage();

  // No data-page is fine now: carousels, videos etc. were already initialised
  // by the global pass — only page-specific code is skipped.
  if (!pageName) {
    logger.log('[Webflow Router] No data-page — global components only.');
    return;
  }

  if (PAGES_WITHOUT_PAGE_CODE.has(pageName)) return;

  const loadPage = pageRegistry[pageName];

  if (loadPage && typeof loadPage === 'function') {
    try {
      // Dynamically import and initialize the page module
      const page = await loadPage();
      if (typeof page?.init === 'function') {
        await page.init();
        pageCleanup = typeof page.cleanup === 'function' ? page.cleanup : null;
      }
    } catch (error) {
      logger.error(`[Webflow Router] Error initializing page "${pageName}":`, error);
    }
  } else {
    // Kept in production (console.warn survives the build): an unknown value
    // is a typo in Webflow or a page module that was never registered.
    logger.warn(
      `[Webflow Router] Unknown data-page "${pageName}" — add it to pageRegistry or PAGES_WITHOUT_PAGE_CODE in src/index.js.`
    );
  }
}

// A Barba page swap: the old page is gone, the new one in place — stop the
// old page's code and start the new page's, as a fresh load would.
async function swapPage() {
  try {
    pageCleanup?.();
  } catch (error) {
    logger.error('[Webflow Router] Error cleaning up the page:', error);
  }
  pageCleanup = null;
  teardownGlobal();
  try {
    await initGlobal();
  } catch (error) {
    logger.error('[Webflow Router] Error initializing global components:', error);
  }
  try {
    refreshLenisForPage();
    await runPageModule();
    ScrollTrigger.refresh();
  } finally {
    // Held since the transition began (see startTransition below).
    holdScrollRefresh(false);
  }
}

// A page transition is starting: the old page stays as it is until the swap.
function startTransition() {
  holdScrollRefresh(true);
  pauseImageRevealWatch();
}

async function initPage() {
  resetScrollPosition();
  document.documentElement.classList.add('ready');

  try {
    await initGlobal();
  } catch (error) {
    logger.error('[Webflow Router] Error initializing global components:', error);
  }

  await runPageModule();

  // Barba page transitions, when the page is set up for them in Webflow
  // ([data-barba="wrapper"] / [data-barba="container"]; see
  // src/global/pageTransition.js). Off: plain page loads, as before.
  if (pageTransitionsEnabled()) {
    initPageTransitions({
      onStart: startTransition,
      // The window opening is the new page's entrance: its first screen's
      // zoom-ins settle from their zoom as it opens.
      onEnter: enterZoomIns,
      onSwap: swapPage,
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
