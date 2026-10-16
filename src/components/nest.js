/**
 * Nesting (Shared Utility) — declarative cross-page content injection.
 * Initialized globally from src/global/index.js.
 *
 * Pull a fragment from another page into a placeholder on the current page,
 * matched by a shared id. Runs on load; no-ops when no [data-nest-target] exist.
 *
 * Markup:
 *   Page 1 (current page):
 *     <div data-nest-list>
 *       <div data-nest-item>
 *         <div data-nest-target="bio-42">
 *           <a href="/people/jane-doe" data-nest-source>View</a>
 *         </div>
 *       </div>
 *     </div>
 *
 *   Page 2 (at /people/jane-doe):
 *     <div data-nest-target="bio-42"> …the content to pull in… </div>
 *
 * On load, each [data-nest-target] that contains an <a data-nest-source> fetches
 * that anchor's href, finds the element with the SAME data-nest-target id on that
 * page, and copies its innerHTML into the placeholder (inner-content swap — the
 * placeholder element stays put; its previous contents, including the source
 * anchor, are replaced). The anchor also works as a plain link if JS is off.
 * Fetches are de-duped and cached per URL, so many targets that share one source
 * page download it only once.
 *
 * Notes:
 * - Same-origin only (fetches an HTML page + parses it with DOMParser).
 * - Content is injected as-is; a [data-nest-target] inside fetched content is not
 *   processed recursively.
 */

import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';

const TARGET_SELECTOR = '[data-nest-target]';
const TARGET_ATTR = 'data-nest-target';
const DONE_ATTR = 'data-nest-done';
// The source URL comes from an <a href> inside the target, tagged data-nest-source.
const SOURCE_SELECTOR = 'a[data-nest-source]';

// The source anchor for a placeholder: a direct child preferred, else the first
// tagged anchor anywhere inside it.
function getSourceAnchor(el) {
  return el.querySelector(`:scope > ${SOURCE_SELECTOR}`) || el.querySelector(SOURCE_SELECTOR);
}

let abortController = null;
// url -> Promise<Document|null>. Shared across a single init pass so multiple
// placeholders pointing at the same page fetch + parse it only once.
const docCache = new Map();

function fetchDoc(url, signal) {
  if (docCache.has(url)) return docCache.get(url);

  const promise = fetch(url, { signal })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      return res.text();
    })
    .then((html) => new DOMParser().parseFromString(html, 'text/html'))
    .catch((error) => {
      // Aborting during cleanup is expected — swallow it quietly.
      if (error && error.name === 'AbortError') return null;
      handleError(error, 'Nesting Fetch');
      return null;
    });

  docCache.set(url, promise);
  return promise;
}

export function initNesting() {
  if (typeof document === 'undefined') return;

  // Only placeholders that carry a source anchor are Page-1 targets; a bare
  // [data-nest-target] (e.g. the source element on Page 2) is left alone.
  const placeholders = Array.from(document.querySelectorAll(TARGET_SELECTOR)).filter(
    (el) => !el.hasAttribute(DONE_ATTR) && getSourceAnchor(el)
  );

  if (!placeholders.length) return;

  abortController = new AbortController();
  const { signal } = abortController;

  placeholders.forEach((el) => {
    const id = el.getAttribute(TARGET_ATTR);
    const anchor = getSourceAnchor(el);
    const url = anchor && anchor.getAttribute('href');
    if (!id || !url) return;

    // Mark up front so a re-init can't double-process while the fetch is pending;
    // cleared again below if the swap fails, so a later retry can pick it up.
    el.setAttribute(DONE_ATTR, '');

    fetchDoc(url, signal).then((doc) => {
      if (!doc || signal.aborted) return;

      const match = doc.querySelector(`[${TARGET_ATTR}="${CSS.escape(id)}"]`);
      if (!match) {
        logger.warn(`[Nesting] No [${TARGET_ATTR}="${id}"] found in ${url}`);
        el.removeAttribute(DONE_ATTR);
        return;
      }

      el.innerHTML = match.innerHTML;
      logger.log(`[Nesting] Swapped "${id}" from ${url}`);
    });
  });

  logger.log(`[Nesting] ${placeholders.length} target(s) queued`);
}

export function cleanupNesting() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  docCache.clear();
}
