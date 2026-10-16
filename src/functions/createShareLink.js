/**
 * Share Link (Shared Utility)
 * Wires social-share and copy-URL links via data attributes.
 * Initialized globally from src/global/index.js.
 *
 * Markup:
 *   <a share-post="twitter">Share on X</a>
 *   <a share-post="linkedin">Share on LinkedIn</a>
 *   <a share-post="facebook">Share on Facebook</a>
 *   <button share-post="copy-url">
 *     Copy link
 *     <span toast>Copied!</span>
 *   </button>
 *
 * Optional attributes (on the share link itself):
 * - share-text="…"  Custom text for the tweet (Twitter/X only). Defaults to the
 *                   document title.
 * - share-url="…"   Share a specific URL instead of the current page URL.
 *
 * Uses event delegation on document, so it covers links present at load AND any
 * injected later (e.g. modal / nested content) — no need to re-run. Social links
 * get their href set on load and refreshed on hover/focus (so the URL stays
 * current); copy-url copies to the clipboard on click and briefly toggles
 * `is-active` on a child [toast].
 */

import { logger } from '../utils/logger';

const LINK_SELECTOR = '[share-post]';
const TYPE_ATTR = 'share-post';
const TEXT_ATTR = 'share-text';
const URL_ATTR = 'share-url';
const TOAST_SELECTOR = '[toast]';
const TOAST_ACTIVE_CLASS = 'is-active';
const TOAST_DURATION = 5000;

let onClick = null;
let onEnhance = null;
// Per-toast reset timers so rapid re-clicks restart (not stack) the timeout.
const toastTimers = new WeakMap();

// The URL to share: an explicit override, else the current page.
function resolveUrl(link) {
  return link.getAttribute(URL_ATTR) || window.location.href;
}

// Build the share endpoint for a social network. Returns '' for unknown types
// (e.g. copy-url, which is handled on click instead).
function buildShareHref(type, link) {
  const url = encodeURIComponent(resolveUrl(link));
  switch (type) {
    case 'twitter': {
      const text = encodeURIComponent(link.getAttribute(TEXT_ATTR) || document.title || '');
      return `https://twitter.com/intent/tweet?url=${url}${text ? `&text=${text}` : ''}`;
    }
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    default:
      return '';
  }
}

// Point a social link at its share URL and open it in an isolated new tab.
function enhanceLink(link) {
  const type = link.getAttribute(TYPE_ATTR);
  if (!type || type === 'copy-url') return; // copy-url has no href to set
  const href = buildShareHref(type, link);
  if (!href) return;
  link.setAttribute('href', href);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
}

// Copy the share URL to the clipboard, then flash the [toast] child if present.
function copyUrl(link) {
  if (!navigator.clipboard) {
    logger.warn('[ShareLink] Clipboard API unavailable — cannot copy URL.');
    return;
  }
  navigator.clipboard
    .writeText(resolveUrl(link))
    .then(() => {
      const toastEl = link.querySelector(TOAST_SELECTOR);
      if (!toastEl) return;
      toastEl.classList.add(TOAST_ACTIVE_CLASS);
      const existing = toastTimers.get(toastEl);
      if (existing) clearTimeout(existing);
      toastTimers.set(
        toastEl,
        setTimeout(() => {
          toastEl.classList.remove(TOAST_ACTIVE_CLASS);
          toastTimers.delete(toastEl);
        }, TOAST_DURATION)
      );
    })
    .catch((error) => {
      logger.error('[ShareLink] Failed to copy URL:', error);
    });
}

function handleClick(event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest(LINK_SELECTOR);
  if (!link) return;

  if (link.getAttribute(TYPE_ATTR) === 'copy-url') {
    event.preventDefault();
    copyUrl(link);
    return;
  }

  // Social link: ensure the href is current even if it was never hovered
  // (e.g. touch devices have no pointerover).
  enhanceLink(link);
}

function handleEnhance(event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest(LINK_SELECTOR);
  if (link) enhanceLink(link);
}

export function initShareLinks() {
  if (typeof document === 'undefined' || onClick) return;

  onClick = handleClick;
  onEnhance = handleEnhance;

  // Delegated on document so current and future [share-post] links are covered
  // without re-running after dynamic content is added.
  document.addEventListener('click', onClick);
  document.addEventListener('pointerover', onEnhance, { passive: true });
  document.addEventListener('focusin', onEnhance);

  // Prime links already present so their hrefs work on first click / touch.
  document.querySelectorAll(LINK_SELECTOR).forEach(enhanceLink);

  logger.log('[ShareLink] Delegated handlers ready');
}

export function cleanupShareLinks() {
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
