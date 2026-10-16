/**
 * Generic PDF-link Viewer (Global)
 * Opens any link to a .pdf file inside an in-page PDF viewer instead of
 * navigating away. Wired globally from src/global/index.js — no-ops on any page
 * that doesn't have the viewer modal.
 *
 * How it works:
 * 1. One reusable modal on the page, [data-modal-name="generic-pdf-viewer"],
 *    contains a single <object type="application/pdf">. That <object> is the
 *    screen every PDF is shown on.
 * 2. Clicking any <a href="…/something.pdf"> is intercepted: the clicked URL is
 *    written onto the <object>, the modal is opened, and the document renders —
 *    natively on desktop, via the pdf.js fallback on mobile (see pdfViewer.js).
 * 3. When a PDF link scrolls into view, pdf.js is preloaded on the devices that
 *    will need it, so the document is ready the moment the link is clicked.
 *
 * When it steps aside and lets the link behave normally (plain navigation):
 * - There's no generic-pdf-viewer modal (or no <object> inside it) on the page.
 * - The link opts out with a `download` attribute or [data-pdf-download].
 * - The click is a modified/non-primary click (⌘/Ctrl/Shift/Alt/middle) — the
 *   browser's own "open in new tab" etc. is respected.
 * - The connection is slow (Network Information API says slow-2g/2g or
 *   Save-Data). Rendering a PDF over a slow link is worse than a direct
 *   download, so we don't hijack it. Note this API is Chromium-only; where it's
 *   unavailable (iOS Safari, Firefox) "unknown" is treated as "not slow".
 *
 * Markup (already in the Webflow project — this only detects and drives it):
 *   <div data-modal-name="generic-pdf-viewer" data-modal-close-outside>
 *     <div data-modal-content>
 *       <button data-modal-close>Close</button>
 *       <object type="application/pdf" class="pdf-viewer"
 *               data-closest-parent-trigger="[data-modal-name='generic-pdf-viewer']">
 *         <a href="">Download PDF</a>
 *       </object>
 *     </div>
 *   </div>
 *
 * Opt a single link out of the viewer (keep it a plain download/navigation):
 *   <a href="/brochure.pdf" data-pdf-download>Download brochure</a>
 */

import { openModalBasic } from './modal-basic';
import { preloadPdfJs, renderPdfInObject } from './pdfViewer';
import { logger } from '../utils/logger';

const GENERIC_MODAL_NAME = 'generic-pdf-viewer';
const GENERIC_MODAL_SELECTOR = `[data-modal-name="${GENERIC_MODAL_NAME}"]`;
const DYNAMIC_ATTR = 'data-pdf-dynamic';
const OPT_OUT_ATTR = 'data-pdf-download';
// Head start so pdf.js is warming before the link is actually on screen.
const PRELOAD_ROOT_MARGIN = '400px 0px';

let clickHandler = null;
let preloadObserver = null;

/**
 * Does this href point at a .pdf file? Query string and hash are ignored, so
 * "/doc.pdf?v=2" and "/doc.pdf#page=3" both count.
 * @param {string} href
 * @returns {boolean}
 */
function isPdfHref(href) {
  if (!href) return false;
  const path = href.split('#')[0].split('?')[0].trim();
  return /\.pdf$/i.test(path);
}

/**
 * Should this link keep its normal behaviour rather than open the viewer?
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
function isOptedOut(link) {
  return link.hasAttribute('download') || link.hasAttribute(OPT_OUT_ATTR);
}

/**
 * A modified or non-primary click the browser should handle itself
 * (open-in-new-tab, download, etc.) instead of us hijacking it.
 * @param {MouseEvent} event
 * @returns {boolean}
 */
function isModifiedClick(event) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Is the connection slow enough that a direct download beats rendering inline?
 * Chromium-only; anywhere the API is missing this returns false (see file head).
 * @returns {boolean}
 */
function isSlowConnection() {
  if (typeof navigator === 'undefined') return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const type = connection.effectiveType || '';
  return type === 'slow-2g' || type === '2g';
}

/**
 * The generic viewer modal on the page, or null if there isn't one.
 * @returns {HTMLElement|null}
 */
function getViewerModal() {
  return document.querySelector(GENERIC_MODAL_SELECTOR);
}

/**
 * Show a PDF in the viewer modal.
 * @param {HTMLElement} modal - The generic-pdf-viewer modal.
 * @param {HTMLObjectElement} object - The reusable embed inside it.
 * @param {HTMLAnchorElement} link - The clicked link (URL + focus return).
 */
function openInViewer(modal, object, link) {
  const url = link.href;

  // Native path: point the embed at the PDF so inline-capable browsers render
  // it directly, and keep the fallback download link in sync.
  object.setAttribute('data', url);
  const fallbackLink = object.querySelector('a[href]');
  if (fallbackLink) fallbackLink.setAttribute('href', url);

  // Open first so the modal (and the embed) have layout before pdf.js measures
  // and rasterizes — a reader built against a display:none box has zero width.
  openModalBasic(GENERIC_MODAL_NAME, link);

  // pdf.js path (mobile): render the URL. No-ops on desktop, where the native
  // embed set above is already showing.
  renderPdfInObject(object, url).catch((error) => {
    logger.error('[PdfLinkModal] Failed to render PDF in the viewer.', error);
  });
}

/**
 * Delegated click handler for every PDF link on the page.
 * @param {MouseEvent} event
 */
function handleClick(event) {
  const link = event.target.closest('a[href]');
  if (!link) return;

  if (!isPdfHref(link.getAttribute('href'))) return;
  if (isOptedOut(link) || isModifiedClick(event)) return;

  const modal = getViewerModal();
  if (!modal) return; // no viewer on this page — let the link navigate

  const object = modal.querySelector('object');
  if (!object) return;

  // Slow / unmeasurable-but-slow: a direct download beats a heavy inline render.
  if (isSlowConnection()) return;

  event.preventDefault();
  openInViewer(modal, object, link);
}

/**
 * Start warming pdf.js as soon as any PDF link nears the viewport. One-shot and
 * shared: pdf.js only needs loading once, so the observer disconnects itself
 * after the first PDF link appears.
 */
function setupPreload() {
  if (typeof IntersectionObserver === 'undefined') return;

  const links = Array.from(document.querySelectorAll('a[href]')).filter(
    (link) => isPdfHref(link.getAttribute('href')) && !isOptedOut(link)
  );
  if (!links.length) return;

  preloadObserver = new IntersectionObserver(
    (records) => {
      if (!records.some((record) => record.isIntersecting)) return;
      preloadPdfJs();
      preloadObserver?.disconnect();
      preloadObserver = null;
    },
    { rootMargin: PRELOAD_ROOT_MARGIN }
  );

  links.forEach((link) => preloadObserver.observe(link));
}

/**
 * Wire up the generic PDF-link viewer. Safe to call on every page: it exits
 * quietly when there's no viewer modal, and is idempotent.
 */
export function initPdfLinkModal() {
  if (typeof document === 'undefined') return;

  const modal = getViewerModal();
  if (!modal) return;

  // Tag the embed so initPdfViewer() leaves it for renderPdfInObject() to drive
  // on demand, rather than auto-observing an as-yet-empty embed.
  const object = modal.querySelector('object');
  if (object) object.setAttribute(DYNAMIC_ATTR, '');

  if (!clickHandler) {
    clickHandler = handleClick;
    document.addEventListener('click', clickHandler);
  }

  setupPreload();
  logger.log('📄 Generic PDF-link viewer ready');
}

/**
 * Remove listeners and observers created by initPdfLinkModal().
 */
export function cleanupPdfLinkModal() {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler);
    clickHandler = null;
  }
  preloadObserver?.disconnect();
  preloadObserver = null;
}
