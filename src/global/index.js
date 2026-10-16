/**
 * Global Code - Runs on Every Page
 * Add code here that should execute on all pages (navbar, footer, etc.)
 */

import { initLenis } from './lenis';
import { initNavbar, cleanupNavbar } from './navbar';
import { initFooter, cleanupFooter } from './footer';
import { initFinsweetLists, cleanupFinsweetLists } from './finsweetLists';
import { handleGlobalAnimation, ensureGSAPLoaded, resetGlobalAnimations } from '../components/gsap';
import { ScrollTrigger } from '../utils/gsapCore';
import { initSkipLink } from '../components/skipLink';
import { initZoomIns, cleanupZoomIns } from '../animations/zoomIn';
import { initParallaxes, cleanupParallaxes } from '../animations/parallax';
import { initScrollFades, cleanupScrollFades } from '../animations/scrollFade';
import { initPageIntro, cleanupPageIntro } from '../animations/pageIntro';
import { initSplitTexts } from '../animations/splitText';
import { logger } from '../utils/logger';
import { safe } from '../utils/helpers';

/**
 * Feature modules downloaded only on pages whose markup needs them. Each is its
 * own chunk (bin/build.js splits every dynamic import), so a page without a PDF
 * embed never fetches the PDF viewer, a page without tabs never fetches tabs,
 * and so on. The selector is a single querySelector per feature.
 */
const ON_DEMAND_FEATURES = {
  dropdown: {
    selector: '.dropdown, [dropdown]',
    load: () => import('../components/dropdown'),
    cleanup: (m) => m.cleanupDropdown(),
  },
  listLoadMore: {
    selector: '[data-custom-loadmore="list"], [basic-list-load-more-wrap]',
    load: () => import('../components/listloadmore'),
    cleanup: (m) => {
      m.cleanupListLoadMore();
      m.cleanupBasicListLoadMore();
    },
  },
  nesting: {
    selector: '[data-nest-target]',
    load: () => import('../components/nest'),
    cleanup: (m) => m.cleanupNesting(),
  },
  imageDownload: {
    selector: '[image-download], [image-download-link]',
    load: () => import('../components/imageDownload'),
    cleanup: (m) => m.cleanupImageDownload(),
  },
  modals: {
    selector: '[data-modal-name]',
    load: () => import('../components/modal-basic'),
    cleanup: (m) => m.cleanupModalBasic(),
  },
  pdfLinkModal: {
    selector: '[data-modal-name="generic-pdf-viewer"]',
    load: () => import('../components/pdfLinkModal'),
    cleanup: (m) => m.cleanupPdfLinkModal(),
  },
  pdfViewer: {
    selector: 'object.pdf-viewer, object[type="application/pdf"]',
    load: () => import('../components/pdfViewer'),
    cleanup: (m) => m.cleanupPdfViewer(),
  },
  videoFullscreen: {
    selector: '[video-fullscreen-btn]',
    load: () => import('../functions/videoFullscreen'),
    cleanup: (m) => m.cleanupVideoFullscreen(),
  },
  shareLinks: {
    selector: '[share-post]',
    load: () => import('../functions/createShareLink'),
    cleanup: (m) => m.cleanupShareLinks(),
  },
  accordion: {
    selector: '[data-accordion-list="css"], [data-accordion-imgs]',
    load: () => import('../components/accordion'),
    cleanup: (m) => m.cleanupAccordion(),
  },
  richList: {
    selector: '[richlist="ref"]',
    load: () => import('../functions/populateRichList'),
  },
  mirrorText: {
    selector: '[mirror-textcontent-id]',
    load: () => import('../functions/mirrorTextContent'),
    cleanup: (m) => m.cleanupMirrorTextContent(),
  },
  tabs: {
    selector: '[data-tabs-comp]',
    load: () => import('../components/tabs'),
    cleanup: (m) => m.cleanupTabs(),
  },
  featureTabs: {
    selector: '[data-feature-tabs]',
    load: () => import('../components/featureTabs'),
    cleanup: (m) => m.cleanupFeatureTabs(),
  },
  arrowButtons: {
    selector: 'svg[btn-animate-svg]',
    load: () => import('../components/button'),
    cleanup: (m) => m.cleanupArrowButtons(),
  },
  marquee: {
    selector: '[data-marquee-scroll-direction-target]',
    load: () => import('../components/marquee'),
    cleanup: (m) => m.cleanupMarquees(),
  },
  projectCta: {
    selector: '#project-cta-section [data-scroll-mask-project]',
    load: () => import('../animations/projectCta'),
    cleanup: (m) => m.cleanupProjectCta(),
  },
  imageHover: {
    selector: '[data-image-hover]',
    load: () => import('../components/imageHover'),
    cleanup: (m) => m.cleanupImageHovers(),
  },
  projectHover: {
    selector: '[data-project-hover]',
    load: () => import('../components/projectHover'),
    cleanup: (m) => m.cleanupProjectHovers(),
  },
  cursorButton: {
    selector: '[data-cursor-zone]',
    load: () => import('../components/cursorButton'),
    cleanup: (m) => m.cleanupCursorButtons(),
  },
  slideCursor: {
    selector: '[data-slide-cursor]',
    load: () => import('../components/slideCursor'),
    cleanup: (m) => m.cleanupSlideCursors(),
  },
  sectionEntrance: {
    selector: '[data-entrance]',
    load: () => import('../animations/sectionEntrance'),
    cleanup: (m) => m.cleanupSectionEntrances(),
  },
  timelineReveal: {
    selector: '[data-timeline-reveal]',
    load: () => import('../animations/timelineReveal'),
    cleanup: (m) => m.cleanupTimelineReveals(),
  },
  stickyButton: {
    selector: '[sticky-button-wrap]',
    load: () => import('../components/stickyButton'),
    cleanup: (m) => m.cleanupStickyButtons(),
  },
  hotspots: {
    selector: '[data-hotspots]',
    load: () => import('../components/hotspots'),
    cleanup: (m) => m.cleanupHotspots(),
  },
  moreProject: {
    selector: '[data-more-project]',
    load: () => import('../animations/moreProject'),
    cleanup: (m) => m.cleanupMoreProjects(),
  },
  resourceEntrance: {
    selector: '[data-resources]',
    load: () => import('../animations/resourceEntrance'),
    cleanup: (m) => m.cleanupResourceEntrance(),
  },
  projectModal: {
    selector: '[data-project-modal]',
    load: () => import('../components/projectModal'),
    cleanup: (m) => m.cleanupProjectModal(),
  },
};

// Modules a previous initGlobal() loaded, so a re-init cleans those up without
// importing modules the page never used.
const loadedFeatures = {};

/**
 * Import every on-demand feature whose markup is on the page, all at once (no
 * chunk waterfall). Resolves to { key: module | null }; a chunk that fails to
 * load is logged and resolves to null, so the other features still initialise.
 */
async function loadOnDemandFeatures() {
  const entries = await Promise.all(
    Object.entries(ON_DEMAND_FEATURES).map(async ([key, { selector, load }]) => {
      if (!document.querySelector(selector)) return [key, null];
      try {
        const mod = await load();
        loadedFeatures[key] = mod;
        return [key, mod];
      } catch (error) {
        logger.error(`[Global] Failed to load ${key}:`, error);
        return [key, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

function cleanupOnDemandFeatures() {
  Object.entries(loadedFeatures).forEach(([key, mod]) => {
    const { cleanup } = ON_DEMAND_FEATURES[key];
    if (cleanup) safe(() => cleanup(mod), `Cleanup ${key}`);
  });
}

/**
 * Tear down everything initGlobal() started, before it runs again for a new
 * page (a Barba page swap, src/global/pageTransition.js) — the navbar and
 * footer, the on-demand features, the carousels / sliders / video players,
 * the global animations — and kill any ScrollTrigger left over.
 */
export function teardownGlobal() {
  safe(cleanupFinsweetLists, 'Cleanup Finsweet lists');
  safe(cleanupNavbar, 'Cleanup navbar');
  safe(cleanupFooter, 'Cleanup footer');
  safe(cleanupPageIntro, 'Cleanup page intro');
  safe(cleanupZoomIns, 'Cleanup zoom in');
  safe(cleanupParallaxes, 'Cleanup parallax');
  safe(cleanupScrollFades, 'Cleanup scroll fade');
  cleanupOnDemandFeatures();
  cleanupComponentsOnDemand();
  subNavStickyCleanup?.();
  subNavStickyCleanup = null;
  safe(resetGlobalAnimations, 'Reset global animations');
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

/**
 * Initialize all global components
 * This runs on every page before page-specific code
 */
export async function initGlobal() {
  logger.log('🌐 Initializing global components...');

  // Cleanup previous instances if re-initializing
  cleanupNavbar();
  cleanupFooter();
  cleanupPageIntro();
  cleanupZoomIns();
  cleanupParallaxes();
  cleanupScrollFades();
  cleanupOnDemandFeatures();
  // Each feature runs in its own try/catch (safe): one that throws is logged
  // and the rest still initialise, instead of everything after it dying.
  // Must be the very first focusable element in the DOM.
  safe(initSkipLink, 'Skip link');
  // Initialize Lenis smooth scroll (should be first)
  safe(initLenis, 'Lenis');
  // Initialize navbar
  safe(initNavbar, 'Navbar');
  safe(handleSubNavSticky, 'Sub-nav sticky');
  // Initialize footer
  safe(initFooter, 'Footer');
  // The homepage's opening (once a session) — before the hero's entrance,
  // which it replaces when it plays.
  safe(initPageIntro, 'Page intro');
  // [data-zoom-in] / [data-parallax] / [data-scroll-fade] straight away — a
  // hero's picture is hidden until its zoom-in is set up (and is usually the
  // page's largest paint), so they're bundled rather than waiting on the
  // downloads below.
  safe(initZoomIns, 'Zoom in');
  safe(initParallaxes, 'Parallax');
  safe(initScrollFades, 'Scroll fade');
  // …and the hero's heading with them, rather than with the rest of the
  // page's text after the downloads below (initSplitTexts skips it then).
  const hero = document.querySelector('[data-hero], [data-hero-intro]');
  if (hero) safe(() => initSplitTexts(hero), 'Hero text');

  // Everything below is only on the page if its markup is (see above).
  const f = await loadOnDemandFeatures();
  if (f.dropdown) safe(f.dropdown.initDropdown, 'Dropdown');
  if (f.listLoadMore) safe(f.listLoadMore.initListLoadMore, 'List load more');
  // Pull cross-page fragments into [data-nest-target] placeholders (on load).
  if (f.nesting) safe(f.nesting.initNesting, 'Nesting');
  // Wire [image-download] links to download their image.
  if (f.imageDownload) safe(f.imageDownload.initImageDownload, 'Image download');
  // Enhance [data-modal-name] modals (accessibility, focus trap, scroll lock).
  if (f.modals) safe(f.modals.initModalBasic, 'Modals');
  // [data-project] buttons open the project modal, filled from /project/<slug>.
  if (f.projectModal) safe(f.projectModal.initProjectModal, 'Project modal');
  // A project page's "more projects" block opens with the scroll.
  if (f.moreProject) safe(f.moreProject.initMoreProjects, 'More project');
  // The Resources page's filters, labels and file rows rise in as they're seen.
  if (f.resourceEntrance) safe(f.resourceEntrance.initResourceEntrance, 'Resource entrance');
  // Open any .pdf link inside the generic-pdf-viewer modal instead of
  // navigating — must run before initPdfViewer so it can tag the dynamic embed.
  if (f.pdfLinkModal) safe(f.pdfLinkModal.initPdfLinkModal, 'PDF link modal');
  // Swap <object type="application/pdf"> embeds for a pdf.js reader on browsers
  // that can't render PDFs inline (all mobile) — no-ops elsewhere.
  if (f.pdfViewer) safe(f.pdfViewer.initPdfViewer, 'PDF viewer');
  // Wire [video-fullscreen-btn] to the native Fullscreen API.
  if (f.videoFullscreen) safe(f.videoFullscreen.initVideoFullscreen, 'Video fullscreen');
  // Wire [share-post] social-share + copy-url links.
  if (f.shareLinks) safe(f.shareLinks.initShareLinks, 'Share links');
  // Batch-reveal [basic-list-load-more-wrap] lists.
  if (f.listLoadMore) safe(f.listLoadMore.initBasicListLoadMore, 'Basic list load more');
  // Wire [data-accordion-list="css"] accordions (FAQs, etc.).
  if (f.accordion) {
    setTimeout(() => {
      safe(f.accordion.initAccordion, 'Accordion');
    }, 0); // Defer to avoid blocking other init code
  }
  // Expand [richlist="ref"] rich-text lists into [richlist="item"] templates.
  if (f.richList) safe(f.richList.populateRichList, 'Rich list');
  // Mirror [mirror-textcontent=src] text into matching [mirror-textcontent=dest].
  if (f.mirrorText) safe(f.mirrorText.mirrorTextContent, 'Mirror text');
  // Autoplaying feature showcase: cross-fading media + items with progress lines.
  if (f.featureTabs) safe(f.featureTabs.initFeatureTabs, 'Feature tabs');
  // Wire the arrow hover (GSAP DrawSVG) on buttons holding an svg[btn-animate-svg].
  if (f.arrowButtons) safe(f.arrowButtons.initArrowButtons, 'Arrow buttons');
  // Load GSAP first so all page code (tabs, home, etc.) has it available
  try {
    await ensureGSAPLoaded();
    logger.log('✅ GSAP and ScrollTrigger loaded globally');
    await handleGlobalAnimation();
  } catch (error) {
    logger.error('Error loading GSAP:', error);
  }

  // Initialize tabs after GSAP is ready so content-element animations run on
  // first activation (tabs degrade gracefully if GSAP is unavailable).
  if (f.tabs) safe(f.tabs.initTabs, 'Tabs');
  // [data-slide-cursor]: prev / next indicators follow the mouse over a carousel; click slides it.
  if (f.slideCursor) safe(f.slideCursor.initSlideCursors, 'Slide cursor');
  // [data-cursor-zone]: over it the pointer becomes the zone's [data-cursor-button].
  if (f.cursorButton) safe(f.cursorButton.initCursorButtons, 'Cursor button');
  // [data-project-hover]: project card hover — image push-in, shade, title roll.
  if (f.projectHover) safe(f.projectHover.initProjectHovers, 'Project hover');
  // [data-image-hover]: any image pushes in with a light shade on hover.
  if (f.imageHover) safe(f.imageHover.initImageHovers, 'Image hover');
  // #project-cta-section: project image mask on scroll → next project → button.
  // [data-marquee-scroll-direction-target]: endless row, turns with the scroll.
  if (f.marquee) safe(f.marquee.initMarquees, 'Marquee');
  if (f.projectCta) safe(f.projectCta.initProjectCta, 'Project CTA');
  // [data-entrance]: pictures settle from a zoom on scroll-in, then items rise in.
  if (f.sectionEntrance) safe(f.sectionEntrance.initSectionEntrances, 'Section entrance');
  // [data-timeline-reveal]: each step's ticks rise in, then its line opens out from them.
  if (f.timelineReveal) safe(f.timelineReveal.initTimelineReveals, 'Timeline reveal');
  // [sticky-button-wrap]: rides the bottom of the screen, its label following the section in view.
  if (f.stickyButton) safe(f.stickyButton.initStickyButtons, 'Sticky button');
  // [data-hotspots]: CMS hotspots on a photo (Projects modal), each opening a card.
  if (f.hotspots) safe(f.hotspots.initHotspots, 'Hotspots');

  await initComponentsOnDemand();
  safe(initFinsweetLists, 'Finsweet lists');
}

/**
 * Page-agnostic components, initialised wherever their markup appears — not
 * only on pages whose data-page module remembered to call them (a page with a
 * missing or unregistered data-page used to get none: carousels never loaded,
 * video buttons were dead). Page modules keep only page-specific code.
 *
 * Each module is imported only when its element is on the page, so with code
 * splitting (bin/build.js) pages without it never download it. The check is a
 * single querySelector; the imports all start at once (no chunk waterfall) and
 * the inits then run in dependency order:
 *   carousel → mask slider → testimonials (drives a carousel) → section video → list video
 *   (after the section player, as on the pages that had both) → regular video
 *   (wired to pause the testimonial carousel while a testimonial video plays).
 * Each step is isolated, so one failing component can't take the rest down.
 */
// What initComponentsOnDemand() loaded, with each module's cleanup — run by
// cleanupComponentsOnDemand() before a new page's components start.
const componentCleanups = [];

/** Tear down the carousels, sliders and video players (a page swap). */
function cleanupComponentsOnDemand() {
  componentCleanups.splice(0).forEach(({ label, cleanup }) => safe(cleanup, `Cleanup ${label}`));
}

async function initComponentsOnDemand() {
  const has = (selector) => Boolean(document.querySelector(selector));
  const load = (needed, importer, label) =>
    needed
      ? importer().catch((error) => {
          logger.error(`[Global] Failed to load ${label}:`, error);
          return null;
        })
      : null;

  // Started before the batch below so it downloads in parallel with it.
  const maskSliderLoading = load(
    has('[data-mask-slider]'),
    () => import('../components/maskSlider'),
    'mask slider'
  );

  const [carousel, testimonials, sectionVideo, listVideos, regularVideo] = await Promise.all([
    load(has('[data-carousel]'), () => import('../components/carousel'), 'carousel'),
    load(
      has('#testimonial-slider'),
      () => import('../functions/testimonialsCustomSlider'),
      'testimonials'
    ),
    load(has('[video-section]'), () => import('../functions/sectionVideoPlayer'), 'section video'),
    load(has('[video-items-list]'), () => import('../functions/listVideos'), 'list videos'),
    load(
      has('[video-element-wrap]'),
      () => import('../functions/regularVideoPlayer'),
      'regular video'
    ),
  ]);

  const run = async (label, init) => {
    try {
      await init();
    } catch (error) {
      logger.error(`[Global] ${label} failed to initialize:`, error);
    }
  };

  const track = (label, cleanup) => componentCleanups.push({ label, cleanup });
  if (carousel) track('carousel', carousel.destroyCarousels);
  if (testimonials) track('testimonials', testimonials.cleanupTestimonialsCustomSlider);
  if (sectionVideo) track('section video', sectionVideo.cleanupSectionVideoPlayer);
  if (listVideos) track('list videos', listVideos.cleanupListVideos);
  if (regularVideo) track('regular video', regularVideo.cleanupRegularVideoPlayer);

  if (carousel) await run('Carousel', () => carousel.initCarousel());
  const maskSlider = await maskSliderLoading;
  if (maskSlider) track('mask slider', maskSlider.cleanupMaskSliders);
  if (maskSlider) await run('Mask slider', () => maskSlider.initMaskSliders());
  if (testimonials) {
    await run('Testimonials', () => testimonials.initTestimonialsCustomSlider());
  }
  if (sectionVideo) await run('Section video', () => sectionVideo.initSectionVideoPlayer());
  if (listVideos) await run('List videos', () => listVideos.initListVideos());
  if (regularVideo) {
    await run('Regular video', () =>
      regularVideo.initRegularVideoPlayer({
        getCallbacks: testimonials?.getTestimonialVideoCallbacks,
      })
    );
  }
}

/**
 * Additional GSAP global animations
 * Custom animations that run globally
 */

// Undoes handleSubNavSticky() (its window listeners) before it runs again.
let subNavStickyCleanup = null;

function handleSubNavSticky() {
  subNavStickyCleanup?.();
  subNavStickyCleanup = null;
  (function () {
    const el = document.querySelector('.sub-nav-links__wrap');
    if (!el) return;

    let ticking = false;

    function update() {
      ticking = false;
      const offset = parseFloat(getComputedStyle(el).top) || 0;
      const isStuck = el.getBoundingClientRect().top <= offset + 1;
      el.classList.toggle('stick-top', isStuck);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    subNavStickyCleanup = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    update();
  })();
}
