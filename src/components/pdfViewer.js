/**
 * PDF Viewer Fallback (pdf.js, Shared Utility)
 * Replaces <object type="application/pdf"> embeds with a pdf.js-rendered reader
 * on devices whose browser can't display a PDF inline. Initialized globally from
 * src/global/index.js — it no-ops on any page without a PDF embed.
 *
 * Markup (Webflow embed, unchanged):
 *   <object data="{{wf:PDF File|Dynamo}}" type="application/pdf" class="pdf-viewer">
 *     This browser does not support PDFs. Please download the PDF to view it:
 *     <a href="{{wf:PDF File|Dynamo}}">Download PDF</a>.
 *   </object>
 *
 * Why this exists: <object> embeds only work where the browser ships an inline
 * PDF plugin — desktop only, in practice. Android Chrome has none, so it renders
 * the fallback children ("This browser does not support PDFs…"). iOS Safari is
 * worse: it paints page 1 into the box and then refuses to scroll or paginate,
 * so the document looks present but is unreadable past the first page. Neither
 * case can be fixed with CSS; the document has to be rasterized in JS instead.
 *
 * What it does on an unsupported device:
 * 1. Waits for the embed (or a named ancestor — see below) to come into view.
 * 2. Reads the PDF URL off the <object>'s data attribute.
 * 3. Lazy-loads pdf.js from jsDelivr (only then — supported browsers never
 *    download the ~400KB library, and keep the native embed).
 * 4. Builds a scrollable reader in the <object>'s place, inheriting its classes
 *    so the Webflow sizing still applies.
 * 5. Removes the <object> from the DOM once the document has actually rendered.
 *    It stays hidden-but-present until then, so a CDN failure or a bad URL can
 *    restore the native embed (and its download-link fallback) rather than
 *    leaving the page with a hole where the PDF was.
 *
 * Optional attributes on the <object>:
 * - data-pdf-src="…"    Render this URL instead of the data attribute.
 * - data-pdf-force-js   Use pdf.js even on a browser that supports inline PDFs.
 *                       Append ?pdfjs=1 to the URL to force it site-wide — the
 *                       way to check this on a desktop browser.
 * - data-closest-parent-trigger="[pdf-root]"
 *                       Load when the nearest ancestor matching this selector
 *                       scrolls into view, instead of the <object> itself.
 *
 * That attribute exists because of position: fixed. An embed inside a fixed
 * modal is always inside the viewport no matter where the page is scrolled, so
 * observing the <object> itself fires instantly and defers nothing. Pointing at
 * a static ancestor — one that really does scroll past — restores a meaningful
 * signal:
 *
 *   [pdf-root]   static, scrolls with the page  ← observe this
 *     [modal]    position: fixed
 *       <object data-closest-parent-trigger="[pdf-root]">
 *
 * It's a preload, not an open-detector: the PDF starts loading when the reader
 * reaches that part of the page, so the document is ready by the time the modal
 * is opened.
 *
 * Embeds injected after init (modal content fetched over the network, say) are
 * not picked up automatically — call initPdfViewer() again once they're in the
 * DOM. It's idempotent; embeds it already owns are skipped.
 *
 * Pages render on demand as they scroll into view, and canvases far outside the
 * viewport are released again, because a long document rendered all at once is
 * exactly what iOS Safari kills a tab over.
 *
 * Not included: a text layer. Pages are canvas only, so text isn't selectable or
 * searchable inside the viewer — the download link in the toolbar covers that.
 */

import { loadScript } from '../utils/helpers';
import { logger } from '../utils/logger';

const VIEWER_SELECTOR = 'object.pdf-viewer, object[type="application/pdf"]';
const SRC_OVERRIDE_ATTR = 'data-pdf-src';
const FORCE_ATTR = 'data-pdf-force-js';
const FORCE_QUERY_PARAM = 'pdfjs';
const CLAIMED_ATTR = 'data-pdfjs-claimed';
// Marks an <object> that a caller drives on demand (the generic PDF-link
// viewer — see pdfLinkModal.js). initPdfViewer() leaves these alone: their URL
// isn't known until a link is clicked, so auto-observing them would only render
// an empty embed. renderPdfInObject() owns them instead.
const DYNAMIC_ATTR = 'data-pdf-dynamic';
const TRIGGER_ATTR = 'data-closest-parent-trigger';
// Head start before the trigger is actually on screen. Irrelevant for a modal
// (which goes from display:none to visible in one step) but it means an inline
// embed has the library in hand by the time it's scrolled to.
const TRIGGER_ROOT_MARGIN = '200px 0px';

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;
// Pinned to 3.x on purpose. pdf.js 4.x is authored with class `static {}`
// initializer blocks, which Safari cannot even *parse* before 16.4 — an iOS
// 16.2 device throws "SyntaxError: Unexpected token '{'" the moment the script
// loads, and silently falls back to the broken native embed. The 4.x "legacy"
// build does not transpile those away. The 3.x legacy build is compiled to ES5
// (no static blocks), so it parses and runs on Safari 12+ / iOS 12+ — exactly
// the older-mobile audience this whole fallback exists for.
//
// 3.x ships a UMD bundle (.js), not the .mjs ESM that 4.x uses: it is loaded
// with a <script> tag and read off window.pdfjsLib, rather than import().
const PDFJS_MODULE_URL = `${PDFJS_BASE}/legacy/build/pdf.min.js`;
const PDFJS_WORKER_URL = `${PDFJS_BASE}/legacy/build/pdf.worker.min.js`;
const PDFJS_CMAP_URL = `${PDFJS_BASE}/cmaps/`;
const PDFJS_STANDARD_FONTS_URL = `${PDFJS_BASE}/standard_fonts/`;

// Rendering budget. Retina phones would otherwise allocate canvases several
// times larger than the screen can show: iOS caps total canvas memory per tab
// and drops the whole document (blank white pages) once it's exceeded. Worst
// case here is MAX_RENDERED_PAGES × MAX_CANVAS_AREA × 4 bytes ≈ 96MB, well
// inside that cap — and a phone-width page doesn't come close to the area cap
// anyway, so in practice only very wide layouts get scaled down.
const MAX_DPR = 2;
const MAX_CANVAS_AREA = 4 * 1024 * 1024; // device pixels per page
const MAX_RENDERED_PAGES = 6; // canvases kept alive at once
const RENDER_AHEAD_MARGIN = '150% 0px'; // start rendering ~1.5 screens early

let instances = [];
let pdfjsPromise = null;

// One shared observer for every embed still waiting to be triggered, rather
// than one per embed. Keyed by trigger element, because several embeds can name
// the same ancestor (two PDFs in one modal) and must not each observe it.
let pendingObserver = null;
const pendingByTrigger = new Map();

/**
 * Get pdf.js, loading it from the CDN only if it isn't already here.
 *
 * Three layers of "already loaded", innermost first:
 * 1. pdfjsPromise — this module's cache. Every embed on the page shares one
 *    load, including embeds triggered minutes apart, and including the window
 *    between two embeds starting: import() returns its promise synchronously,
 *    so the second caller always sees the assignment.
 * 2. window.pdfjsLib — a copy some other script put on the page, or a
 *    self-hosted build. Reused as-is rather than fetching a second one. This is
 *    also where our own UMD bundle lands once its <script> runs.
 * 3. loadScript() dedupes by src/id, so even a concurrent load resolves against
 *    the single injected tag rather than adding a second. That's the backstop,
 *    not the plan.
 * @returns {Promise<Object>} The pdfjs library (window.pdfjsLib).
 */
function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;

  if (typeof window !== 'undefined' && window.pdfjsLib?.getDocument) {
    logger.log('[PdfViewer] Reusing the pdf.js already present on the page.');
    const existing = window.pdfjsLib;
    // Don't overwrite a workerSrc that copy already has — it may be pointing at
    // a self-hosted worker that has to match its own build.
    if (existing.GlobalWorkerOptions && !existing.GlobalWorkerOptions.workerSrc) {
      existing.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    }
    pdfjsPromise = Promise.resolve(existing);
    return pdfjsPromise;
  }

  // The UMD bundle assigns window.pdfjsLib as a side effect of running, so the
  // library is read off the window once the <script> has loaded.
  pdfjsPromise = loadScript(PDFJS_MODULE_URL, { id: 'pdfjs-legacy-umd' })
    .then(() => {
      const lib = typeof window !== 'undefined' ? window.pdfjsLib : null;
      if (!lib || typeof lib.getDocument !== 'function') {
        throw new Error('pdf.js loaded but window.pdfjsLib.getDocument() is missing');
      }
      // pdf.js detects that this worker is cross-origin and wraps it in a
      // same-origin blob that imports it, so a plain CDN URL is fine here.
      if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
      return lib;
    })
    .catch((error) => {
      pdfjsPromise = null; // allow a retry on a later init
      throw error;
    });

  return pdfjsPromise;
}

/**
 * Can this browser display a PDF inside an <object>?
 *
 * navigator.pdfViewerEnabled is the standard answer and is correct on desktop
 * and on Android (false — no built-in viewer). It is NOT trustworthy on iOS:
 * Safari reports true because it does paint something, even though what it
 * paints is a frozen first page. Mobile is therefore ruled out by platform
 * before the flag is consulted at all.
 * @returns {boolean}
 */
function supportsInlinePdf() {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS || /Android/.test(ua)) return false;

  // Only an explicit false is meaningful — older browsers leave it undefined.
  if (navigator.pdfViewerEnabled === false) return false;

  return true;
}

/**
 * Has the reader been forced on, either per-embed or via ?pdfjs=1?
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isForced(element) {
  if (element.hasAttribute(FORCE_ATTR)) return true;
  try {
    return new URLSearchParams(window.location.search).has(FORCE_QUERY_PARAM);
  } catch {
    return false;
  }
}

/**
 * Resolve the PDF URL for an embed, or '' when there isn't a usable one.
 * @param {HTMLObjectElement} object
 * @returns {string}
 */
function resolveSource(object) {
  const raw = (object.getAttribute(SRC_OVERRIDE_ATTR) || object.getAttribute('data') || '').trim();
  // An empty CMS field leaves the binding text in place rather than a URL.
  if (!raw || raw.includes('{{')) return '';
  try {
    return new URL(raw, window.location.href).href;
  } catch {
    return '';
  }
}

/**
 * Build the reader shell (toolbar + scroll area) for one embed.
 * @param {HTMLObjectElement} object - The embed being replaced.
 * @param {string} src - Resolved PDF URL.
 * @returns {{root: HTMLElement, pages: HTMLElement, counter: HTMLElement}}
 */
function buildShell(object, src) {
  const root = document.createElement('div');
  // Inherit the embed's classes so whatever sizing Webflow put on .pdf-viewer
  // (height, aspect ratio, margins) keeps applying to the replacement.
  root.className = object.className;
  root.classList.add('pdfjs-viewer');
  root.setAttribute('role', 'document');
  root.setAttribute('aria-label', object.getAttribute('aria-label') || 'PDF document');

  const toolbar = document.createElement('div');
  toolbar.className = 'pdfjs-viewer__toolbar';

  const counter = document.createElement('span');
  counter.className = 'pdfjs-viewer__counter';
  // aria-live so the page number is announced as the reader is scrolled.
  counter.setAttribute('aria-live', 'polite');
  counter.textContent = 'Loading…';

  const download = document.createElement('a');
  download.className = 'pdfjs-viewer__download';
  // Reuse the embed's own fallback link when it has one, so a CMS-set label
  // survives the swap.
  const existingLink = object.querySelector('a[href]');
  download.href = (existingLink && existingLink.getAttribute('href')) || src;
  download.textContent = (existingLink && existingLink.textContent.trim()) || 'Download PDF';
  download.target = '_blank';
  download.rel = 'noopener';

  toolbar.append(counter, download);

  const pages = document.createElement('div');
  pages.className = 'pdfjs-viewer__pages';
  // Lenis hijacks wheel/touch scrolling globally; without this opt-out the
  // reader's own scroll area can't be scrolled at all.
  pages.setAttribute('data-lenis-prevent', '');

  const status = document.createElement('p');
  status.className = 'pdfjs-viewer__status';
  status.textContent = 'Loading PDF…';
  pages.appendChild(status);

  root.append(toolbar, pages);
  return { root, pages, counter };
}

/**
 * Render one page into its placeholder.
 * @param {Object} instance - Viewer instance state.
 * @param {Object} entry - Page entry ({ pageNumber, shell, … }).
 */
async function renderPage(instance, entry) {
  if (entry.rendered || entry.renderTask || instance.destroyed) return;

  const width = entry.shell.clientWidth;
  if (!width) return; // laid out at zero width (hidden tab, display:none) — retry later

  let page;
  try {
    page = await instance.doc.getPage(entry.pageNumber);
  } catch (error) {
    if (!instance.destroyed)
      logger.warn('[PdfViewer] Could not load page', entry.pageNumber, error);
    return;
  }
  if (instance.destroyed) return;

  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });

  // Correct the placeholder now that the real page size is known — the shells
  // were all sized from page 1, which is wrong for mixed-orientation documents.
  entry.shell.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

  // Oversample for retina, but never past the per-canvas budget.
  let outputScale = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const area = viewport.width * viewport.height * outputScale * outputScale;
  if (area > MAX_CANVAS_AREA) outputScale *= Math.sqrt(MAX_CANVAS_AREA / area);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
  canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
  canvas.className = 'pdfjs-viewer__canvas';

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  entry.renderTask = page.render({
    canvasContext: context,
    viewport,
    transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
  });

  try {
    await entry.renderTask.promise;
    if (instance.destroyed) return;
    entry.shell.replaceChildren(canvas);
    entry.canvas = canvas;
    entry.rendered = true;
    instance.renderedOrder.push(entry);
    releaseDistantPages(instance);
  } catch (error) {
    // A cancelled task is the expected outcome of scrolling away mid-render.
    if (error && error.name === 'RenderingCancelledException') return;
    if (!instance.destroyed) {
      logger.warn('[PdfViewer] Failed to render page', entry.pageNumber, error);
    }
  } finally {
    entry.renderTask = null;
    page.cleanup();
  }
}

/**
 * Free one page's canvas and put its placeholder back.
 * @param {Object} entry - Page entry.
 */
function releaseEntry(entry) {
  if (entry.canvas) {
    // Zeroing the canvas frees its backing store immediately; dropping the
    // node alone leaves it to the GC, which on iOS is too late to matter.
    entry.canvas.width = 0;
    entry.canvas.height = 0;
    entry.canvas = null;
  }
  entry.rendered = false;
  entry.shell.replaceChildren();
}

/**
 * Drop canvases for pages that have scrolled well out of view. Without this a
 * long document accumulates every page it has ever shown, which is what makes
 * iOS blank the tab.
 * @param {Object} instance - Viewer instance state.
 */
function releaseDistantPages(instance) {
  if (instance.renderedOrder.length <= MAX_RENDERED_PAGES) return;

  const viewportCenter = window.innerHeight / 2;
  const distanceFromView = (entry) => {
    const rect = entry.shell.getBoundingClientRect();
    return Math.abs(rect.top + rect.height / 2 - viewportCenter);
  };

  // Evict furthest-from-viewport first, rather than oldest — scrolling back up
  // through a document would otherwise keep discarding the pages just re-read.
  instance.renderedOrder.sort((a, b) => distanceFromView(a) - distanceFromView(b));

  // Skip anything the observer still counts as in-band. IntersectionObserver
  // only fires on a *change*, so releasing a page that never left would leave a
  // permanent blank — nothing would ever ask for it again. That makes the cap a
  // soft one, which is the right trade: pages in the band are about to be read.
  for (let i = instance.renderedOrder.length - 1; i >= MAX_RENDERED_PAGES; i -= 1) {
    const entry = instance.renderedOrder[i];
    if (entry.inView) continue;
    releaseEntry(entry);
    instance.renderedOrder.splice(i, 1);
  }
}

/**
 * Create the page placeholders and start observing them.
 * @param {Object} instance - Viewer instance state.
 */
async function layoutPages(instance) {
  const { doc, pages } = instance;

  // Size every placeholder from page 1 so the reader has its full scroll height
  // before anything is rasterized. renderPage() fixes up any page that differs.
  const firstPage = await doc.getPage(1);
  if (instance.destroyed) return;
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const defaultRatio = `${firstViewport.width} / ${firstViewport.height}`;
  firstPage.cleanup();

  const fragment = document.createDocumentFragment();
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const shell = document.createElement('div');
    shell.className = 'pdfjs-viewer__page';
    shell.style.aspectRatio = defaultRatio;
    shell.dataset.pageNumber = String(pageNumber);

    const entry = {
      pageNumber,
      shell,
      canvas: null,
      rendered: false,
      renderTask: null,
      inView: false,
    };
    instance.entries.push(entry);
    instance.entriesByShell.set(shell, entry);
    fragment.appendChild(shell);
  }

  pages.replaceChildren(fragment);
  instance.counter.textContent = `Page 1 of ${doc.numPages}`;

  instance.renderObserver = new IntersectionObserver(
    (observed) => {
      observed.forEach((record) => {
        const entry = instance.entriesByShell.get(record.target);
        if (!entry) return;
        // Tracked on both edges — releaseDistantPages() needs to know which
        // pages are still in the band, not just which ones just entered it.
        entry.inView = record.isIntersecting;
        if (record.isIntersecting) renderPage(instance, entry);
      });
    },
    { root: null, rootMargin: RENDER_AHEAD_MARGIN }
  );

  // A separate observer for the page counter: the band is a 1px line across the
  // middle of the screen, so "current page" means the one crossing it.
  instance.counterObserver = new IntersectionObserver(
    (observed) => {
      observed.forEach((record) => {
        if (!record.isIntersecting) return;
        const entry = instance.entriesByShell.get(record.target);
        if (entry) instance.counter.textContent = `Page ${entry.pageNumber} of ${doc.numPages}`;
      });
    },
    { root: null, rootMargin: '-50% 0px -50% 0px' }
  );

  instance.entries.forEach((entry) => {
    instance.renderObserver.observe(entry.shell);
    instance.counterObserver.observe(entry.shell);
  });

  // Canvases are rasterized at the width they had when rendered, so a width
  // change (rotation, resize) leaves them upscaled and soft. Drop them and let
  // the observer re-render at the new size.
  if (typeof ResizeObserver !== 'undefined') {
    instance.resizeObserver = new ResizeObserver(() => {
      const width = instance.pages.clientWidth;
      if (!width || width === instance.lastWidth) return;
      instance.lastWidth = width;
      if (instance.resizeTimer) clearTimeout(instance.resizeTimer);
      instance.resizeTimer = setTimeout(() => rerenderAll(instance), 250);
    });
    instance.lastWidth = instance.pages.clientWidth;
    instance.resizeObserver.observe(instance.pages);
  }
}

/**
 * Discard every rendered canvas and re-render what's currently on screen.
 * @param {Object} instance - Viewer instance state.
 */
function rerenderAll(instance) {
  if (instance.destroyed) return;

  instance.entries.forEach((entry) => {
    if (entry.renderTask) {
      entry.renderTask.cancel();
      entry.renderTask = null;
    }
    releaseEntry(entry);
  });
  instance.renderedOrder = [];

  // Re-render everything currently in the band, not just what's on screen: the
  // observer won't fire again for a page that stayed put, so anything in-band
  // left un-rendered here would never come back.
  instance.entries.forEach((entry) => {
    if (entry.inView) renderPage(instance, entry);
  });
}

/**
 * Put the original <object> back where its reader is, and unclaim it.
 *
 * This is what makes the component re-runnable. initGlobal() calls
 * cleanupPdfViewer() before initPdfViewer() on every init, so without this a
 * second init would tear down the reader while the embed it was built from had
 * already been removed — leaving a permanently empty gap where the PDF was.
 * @param {Object} instance - Viewer instance state.
 */
function restoreEmbed(instance) {
  const { object, root, detached } = instance;
  if (!object) return;

  // Re-insert before removing the root, so the embed lands back in its original
  // position rather than at the end of the parent.
  if (detached && root && root.parentNode) {
    root.parentNode.insertBefore(object, root);
  }
  object.style.display = '';
  object.removeAttribute(CLAIMED_ATTR);
  instance.detached = false;
}

/**
 * Swap one <object> embed for a pdf.js reader.
 * @param {HTMLObjectElement} object
 */
async function replaceEmbed(object) {
  const src = resolveSource(object);
  if (!src) {
    logger.warn('[PdfViewer] Embed has no usable PDF URL; leaving it alone.', object);
    return;
  }

  const { root, pages, counter } = buildShell(object, src);
  object.parentNode.insertBefore(root, object);
  // Hide rather than remove: iOS's frozen first-page render has to go now, but
  // the node is the only fallback left if pdf.js can't load.
  object.style.display = 'none';

  const instance = {
    object,
    root,
    pages,
    counter,
    doc: null,
    entries: [],
    entriesByShell: new WeakMap(),
    renderedOrder: [],
    renderObserver: null,
    counterObserver: null,
    resizeObserver: null,
    resizeTimer: null,
    lastWidth: 0,
    loadingTask: null,
    detached: false,
    destroyed: false,
  };
  instances.push(instance);

  try {
    const pdfjsLib = await loadPdfJs();
    if (instance.destroyed) return;

    instance.loadingTask = pdfjsLib.getDocument({
      url: src,
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
      // Mitigation for CVE-2024-4367 (patched upstream in 4.2.67, after the 3.x
      // build we're pinned to for older-Safari support). Disables the eval-based
      // font path a crafted PDF could abuse to run script. Fonts still render;
      // at worst a marginal perf cost on rare font types. See the version note
      // at the top of this file.
      isEvalSupported: false,
    });
    instance.doc = await instance.loadingTask.promise;
    if (instance.destroyed) return;

    await layoutPages(instance);
    if (instance.destroyed) return;

    // The reader exists and has the document — the embed has no job left.
    // Detached, not dropped: the reference is kept so cleanup can put the
    // original markup back (see restoreEmbed).
    object.remove();
    instance.detached = true;

    logger.log(`[PdfViewer] Rendering ${instance.doc.numPages}-page PDF with pdf.js`);
  } catch (error) {
    logger.error('[PdfViewer] pdf.js fallback failed; restoring the native embed.', error);
    teardown(instance);
    instances = instances.filter((candidate) => candidate !== instance);
    // Unclaims as well, so a later init can retry — loadPdfJs() clears its
    // cached promise on failure too, so a transient CDN error isn't permanent.
    restoreEmbed(instance);
    root.remove();
  }
}

/**
 * Tear down one instance's observers, timers and pdf.js resources.
 * @param {Object} instance - Viewer instance state.
 */
function teardown(instance) {
  instance.destroyed = true;

  if (instance.resizeTimer) clearTimeout(instance.resizeTimer);
  instance.renderObserver?.disconnect();
  instance.counterObserver?.disconnect();
  instance.resizeObserver?.disconnect();

  instance.entries.forEach((entry) => {
    entry.renderTask?.cancel();
    if (entry.canvas) {
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
  });
  instance.entries = [];
  instance.renderedOrder = [];

  instance.doc?.destroy();
  instance.doc = null;
  instance.loadingTask = null;
}

/**
 * What has to come into view before this embed loads: the nearest ancestor
 * matching data-closest-parent-trigger, or the <object> itself.
 * @param {HTMLObjectElement} object
 * @returns {Element}
 */
function resolveTrigger(object) {
  const selector = (object.getAttribute(TRIGGER_ATTR) || '').trim();
  if (!selector) return object;
  try {
    // Falling back to the object is deliberate: a selector that matches nothing
    // should still give a working (if less well-timed) viewer, not a dead embed.
    return object.closest(selector) || object;
  } catch (error) {
    logger.warn(`[PdfViewer] Invalid ${TRIGGER_ATTR} selector: "${selector}"`, error);
    return object;
  }
}

/**
 * Defer an embed until its trigger scrolls into view. Nothing — not the CDN
 * request, not the reader markup — happens before that.
 *
 * Geometry is the whole test, deliberately. The point of pointing at a static
 * ancestor is that a static element genuinely enters and leaves the viewport as
 * the page scrolls, which is the signal we want. Checking whether the modal is
 * *open* would be the wrong question: this is a preload, so that by the time
 * someone opens it the document is already there.
 * @param {HTMLObjectElement} object
 */
function observeTrigger(object) {
  if (typeof IntersectionObserver === 'undefined') {
    replaceEmbed(object); // load now rather than never
    return;
  }

  pendingObserver ??= new IntersectionObserver(
    (records) => {
      records.forEach((record) => {
        if (!record.isIntersecting) return;
        // One-shot: unobserve before loading so a trigger that stays on screen
        // can't fire twice.
        pendingObserver.unobserve(record.target);
        const waiting = pendingByTrigger.get(record.target) || [];
        pendingByTrigger.delete(record.target);
        waiting.forEach((embed) => replaceEmbed(embed));
      });
    },
    { rootMargin: TRIGGER_ROOT_MARGIN }
  );

  const trigger = resolveTrigger(object);
  const waiting = pendingByTrigger.get(trigger);
  if (waiting) {
    waiting.push(object); // already observed — just join the queue
    return;
  }
  pendingByTrigger.set(trigger, [object]);
  pendingObserver.observe(trigger);
}

/**
 * Replace unsupported <object> PDF embeds with a pdf.js reader.
 * Safe to call on every page — it exits immediately when there's no embed, and
 * leaves the native embed in place on browsers that can render it. Also safe to
 * call again after injecting new embeds; existing ones are skipped.
 */
export function initPdfViewer() {
  if (typeof document === 'undefined') return;

  const embeds = Array.from(document.querySelectorAll(VIEWER_SELECTOR)).filter(
    (object) => !object.hasAttribute(CLAIMED_ATTR) && !object.hasAttribute(DYNAMIC_ATTR)
  );
  if (!embeds.length) return;

  const forced = embeds.some(isForced);
  if (!forced && supportsInlinePdf()) {
    logger.log('[PdfViewer] Browser renders PDFs inline — keeping the native embed.');
    return;
  }

  embeds.forEach((object) => {
    object.setAttribute(CLAIMED_ATTR, '');
    observeTrigger(object);
  });
}

/**
 * Warm up pdf.js ahead of time on the devices that will actually use it.
 *
 * A no-op on browsers that render PDFs inline (all desktop) — they never touch
 * pdf.js, so there's no reason to pull the ~400KB library. On mobile it fetches
 * and caches the module now, via the same shared promise replaceEmbed() awaits,
 * so a PDF opened later renders without a cold CDN round-trip first.
 *
 * Meant to be called speculatively (e.g. when a PDF link scrolls into view).
 * Failures are swallowed — loadPdfJs() clears its cache on error, so the real
 * on-demand load can still retry.
 */
export function preloadPdfJs() {
  if (typeof navigator === 'undefined') return;
  if (supportsInlinePdf()) return;
  loadPdfJs().catch(() => {});
}

/**
 * Render a specific URL into a single reusable <object>, on demand.
 *
 * This is the entry point for the generic PDF-link viewer (pdfLinkModal.js):
 * one <object> lives in a modal and shows whichever PDF link was clicked. The
 * caller is responsible for the native path — it sets the <object>'s data
 * attribute so inline-capable browsers just render it. This function handles the
 * pdf.js path for the browsers that can't, and re-renders cleanly when the URL
 * changes between opens.
 *
 * @param {HTMLObjectElement} object - The reusable embed inside the viewer.
 * @param {string} url - Absolute PDF URL to render.
 * @returns {Promise<boolean>} true if pdf.js took over, false if the caller's
 *   native embed should stand (inline-capable browser, no URL, or bad input).
 */
export async function renderPdfInObject(object, url) {
  if (typeof document === 'undefined' || !object) return false;

  const resolved = (url || '').trim();
  if (!resolved) return false;

  // Inline-capable (all desktop) unless explicitly forced: the caller's native
  // <object data> embed renders it, so pdf.js stays out of the way.
  if (!isForced(object) && supportsInlinePdf()) return false;

  // Tear down any reader this object already owns from a previous open (a
  // different URL). restoreEmbed puts the original <object> back and unclaims
  // it, so replaceEmbed below starts from a clean slate.
  const stale = instances.filter((instance) => instance.object === object);
  if (stale.length) {
    stale.forEach((instance) => {
      teardown(instance);
      restoreEmbed(instance);
      instance.root?.remove();
    });
    instances = instances.filter((instance) => !stale.includes(instance));
  }

  object.setAttribute(SRC_OVERRIDE_ATTR, resolved);
  object.setAttribute(CLAIMED_ATTR, '');
  await replaceEmbed(object);
  return true;
}

/**
 * Destroy every reader created by initPdfViewer().
 */
export function cleanupPdfViewer() {
  pendingObserver?.disconnect();
  pendingObserver = null;
  // Unclaim embeds that never got triggered, so a later init can adopt them
  // instead of filtering them out as already-owned.
  pendingByTrigger.forEach((waiting) => {
    waiting.forEach((object) => object.removeAttribute(CLAIMED_ATTR));
  });
  pendingByTrigger.clear();

  instances.forEach((instance) => {
    teardown(instance);
    // Restore before removing the root — restoreEmbed needs it as an anchor to
    // put the <object> back in the right place.
    restoreEmbed(instance);
    instance.root?.remove();
  });
  instances = [];
}
