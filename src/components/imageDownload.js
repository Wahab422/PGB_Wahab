/**
 * Image Download (Shared Utility)
 * Turns a link into a "download this image" button.
 * Initialized globally from src/global/index.js.
 *
 * Markup:
 *   <div image-download>
 *     <img image-download-image src="…" />
 *     <a image-download-link href="#">Download</a>
 *   </div>
 *
 * Uses event delegation (one listener on document), so it works for links that
 * exist at load time AND for links injected later — e.g. inside the people modal,
 * which fetches its content after the page has initialized. There is no need to
 * re-run this after dynamic content is added.
 *
 * Each [image-download-link] gets its href replaced with the image's URL plus a
 * download attribute (a no-JS fallback / "save link as" target); this happens on
 * load for existing links and lazily on hover/focus for dynamically-added ones.
 * On click it fetches the image as a blob and saves it — the download attribute
 * alone is ignored for cross-origin images (Webflow serves images from a CDN),
 * so the browser would otherwise just open the image. The blob route forces a
 * real download when the CDN allows CORS, and falls back to a native attempt.
 *
 * Optional attributes:
 * - image-download-src="…"      Override the URL to download (e.g. a full-res
 *                               version) — on the [image-download] or the <img>.
 * - image-download-filename="…" Override the saved filename — on the
 *                               [image-download] or the link. Defaults to the
 *                               URL's basename.
 */

import { logger } from '../utils/logger';

const CONTAINER_SELECTOR = '[image-download]';
const IMAGE_SELECTOR = '[image-download-image]';
const LINK_SELECTOR = '[image-download-link]';
const SRC_OVERRIDE_ATTR = 'image-download-src';
const FILENAME_ATTR = 'image-download-filename';
const READY_ATTR = 'data-image-download-ready';

let abortController = null;
let onClick = null;
let onEnhance = null;

// Prefer an explicit override, then the currently-rendered responsive source,
// then the plain src attribute.
function resolveImageUrl(container, img) {
  const override = container.getAttribute(SRC_OVERRIDE_ATTR) || img.getAttribute(SRC_OVERRIDE_ATTR);
  return override || img.currentSrc || img.getAttribute('src') || '';
}

function resolveFilename(url, container, link) {
  const override = link.getAttribute(FILENAME_ATTR) || container.getAttribute(FILENAME_ATTR);
  if (override) return override;
  try {
    const { pathname } = new URL(url, window.location.href);
    const base = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
    return base || 'image';
  } catch {
    return 'image';
  }
}

// Give the filename an extension from the blob's MIME type when it lacks one.
function ensureExtension(filename, blob) {
  if (/\.[a-z0-9]+$/i.test(filename)) return filename;
  const subtype = (blob.type || '').split('/')[1];
  return subtype ? `${filename}.${subtype.split('+')[0]}` : filename;
}

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = ensureExtension(filename, blob);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke once the click has been processed.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// Last resort when the blob fetch fails (e.g. CDN without CORS): let the browser
// handle a native download-attribute anchor. May open the image cross-origin,
// but it's the best we can do without CORS.
function nativeFallback(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Resolve the container + image for a given link.
function getParts(link) {
  const container = link.closest(CONTAINER_SELECTOR);
  if (!container) return null;
  const img = container.querySelector(IMAGE_SELECTOR);
  if (!img) return null;
  return { container, img };
}

// Point the link at the image (once) so it's a valid link even without JS.
function enhanceLink(link) {
  if (link.hasAttribute(READY_ATTR)) return;
  const parts = getParts(link);
  if (!parts) return;
  const url = resolveImageUrl(parts.container, parts.img);
  if (!url) return;
  link.setAttribute('href', url);
  link.setAttribute('download', resolveFilename(url, parts.container, link));
  link.setAttribute(READY_ATTR, '');
}

function handleEnhance(event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest(LINK_SELECTOR);
  if (link) enhanceLink(link);
}

async function handleClick(event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest(LINK_SELECTOR);
  if (!link) return;

  const parts = getParts(link);
  if (!parts) return;

  const url = resolveImageUrl(parts.container, parts.img);
  if (!url) {
    logger.warn('[ImageDownload] No image source to download.', parts.container);
    return;
  }
  const filename = resolveFilename(url, parts.container, link);

  event.preventDefault();
  const { signal } = abortController;
  try {
    const res = await fetch(url, { mode: 'cors', signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const blob = await res.blob();
    if (signal.aborted) return;
    saveBlob(blob, filename);
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    logger.warn('[ImageDownload] Blob download failed; using native fallback.', error);
    nativeFallback(url, filename);
  }
}

export function initImageDownload() {
  if (typeof document === 'undefined' || onClick) return;

  abortController = new AbortController();
  onClick = handleClick;
  onEnhance = handleEnhance;

  // Delegated on document so it covers current and future [image-download-link]s
  // (e.g. modal content fetched after load) without needing to re-run.
  document.addEventListener('click', onClick);
  document.addEventListener('pointerover', onEnhance, { passive: true });
  document.addEventListener('focusin', onEnhance);

  // Enhance links already present.
  document.querySelectorAll(LINK_SELECTOR).forEach(enhanceLink);

  logger.log('[ImageDownload] Delegated handlers ready');
}

export function cleanupImageDownload() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (onClick) {
    document.removeEventListener('click', onClick);
    onClick = null;
  }
  if (onEnhance) {
    document.removeEventListener('pointerover', onEnhance);
    document.removeEventListener('focusin', onEnhance);
    onEnhance = null;
  }
}
