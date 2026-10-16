/**
 * Native Video Fullscreen (Shared Utility)
 *
 * Wires [video-fullscreen-btn] to the browser's Fullscreen API. Fullscreens the
 * video's WRAP (not the bare <video>) so the project's own controls — play/pause
 * pill, progress bar, timer — come along and stay usable in fullscreen.
 *
 * Global: initialized from global/index.js and no-ops on pages with no
 * [video-fullscreen-btn]. It does not touch the video players themselves; it
 * only moves their container in and out of fullscreen.
 *
 * Webflow setup:
 * - [video-fullscreen-btn] anywhere inside the wrap it should fullscreen.
 * - The wrap is resolved as the closest [video-fullscreen-target] (explicit
 *   override), else [video-element-wrap], else [video-section].
 * - The button gets data-fullscreen="true|false" so the icon can be styled per
 *   state (expand vs. collapse) in Webflow.
 *
 * iPhone: iOS Safari does not expose the Element Fullscreen API on iPhone (only
 * iPad and desktop do), so there it falls back to video.webkitEnterFullscreen()
 * — Apple's native fullscreen player, with native controls. Handled
 * automatically; no separate markup needed.
 */

import { logger } from '../utils/logger';

const BTN_SELECTOR = '[video-fullscreen-btn]';
// Resolution order for "what should go fullscreen", most specific first.
const TARGET_SELECTORS = ['[video-fullscreen-target]', '[video-element-wrap]', '[video-section]'];
const FS_ATTR = 'data-video-fullscreen';
const FILL_ATTR = 'data-video-fs-fill';

// The fullscreen element is given `position: fixed; inset: 0` by the UA
// stylesheet, so it is already a containing block for absolutely-positioned
// controls — deliberately no positioning is set here, since an inline
// `position` would override the UA rule and break the fullscreen layout.
const CSS_TEXT = `
/* Video fullscreen (native, wrap-level) */
[${FS_ATTR}='true'] {
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  background: #000;
}

/* Every wrapper between the wrap and the <video> has to fill, or the video
   collapses to its authored box in the middle of the screen. */
[${FS_ATTR}='true'] [${FILL_ATTR}] {
  width: 100% !important;
  height: 100% !important;
}

[${FS_ATTR}='true'] video {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
`;

let cssInjected = false;
let listenersAttached = false;
const cleanupFns = [];
// The element this module put into fullscreen, so an unrelated fullscreen
// session (or a native <video> fullscreen elsewhere) isn't mistaken for ours.
let currentTarget = null;

function ensureCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-video-fullscreen-style', 'true');
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

// Whether this browser can fullscreen an arbitrary element. False on iPhone,
// where only HTMLVideoElement.webkitEnterFullscreen() exists.
function supportsElementFullscreen() {
  const root = document.documentElement;
  return (
    typeof (root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen) ===
    'function'
  );
}

function requestFullscreen(el) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (typeof fn !== 'function') return null;
  try {
    return fn.call(el);
  } catch {
    return null;
  }
}

function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (typeof fn !== 'function') return;
  try {
    fn.call(document);
  } catch {
    // Ignore — nothing is fullscreen, or the browser refused.
  }
}

function resolveTarget(btn) {
  for (const selector of TARGET_SELECTORS) {
    const el = btn.closest(selector);
    if (el) return el;
  }
  return null;
}

// Mark the video and every ancestor up to (not including) the wrap, so the CSS
// above can make the whole chain fill the screen regardless of markup depth.
function markFillChain(target, video) {
  let node = video;
  while (node && node !== target) {
    node.setAttribute(FILL_ATTR, '');
    node = node.parentElement;
  }
}

function clearFillChain(target) {
  target.querySelectorAll(`[${FILL_ATTR}]`).forEach((el) => el.removeAttribute(FILL_ATTR));
}

// Webflow authors this as a plain div, not <button>/<a> — role + tabindex
// make it focusable and announce correctly, but neither activates on
// Enter/Space by itself, hence the paired keydown bridge in onKeydown below.
function enhanceButtonA11y(btn) {
  if (btn.tagName !== 'BUTTON' && btn.tagName !== 'A') {
    if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
    if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
  }
}

function syncButtons() {
  const fsEl = getFullscreenElement();
  document.querySelectorAll(BTN_SELECTOR).forEach((btn) => {
    const target = resolveTarget(btn);
    const isFullscreen = !!target && target === fsEl;
    btn.setAttribute('data-fullscreen', isFullscreen ? 'true' : 'false');
    enhanceButtonA11y(btn);
    btn.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  });
}

function teardown(target) {
  if (!target) return;
  target.removeAttribute(FS_ATTR);
  clearFillChain(target);
}

// Kick off playback if the player is sitting idle (poster, or a muted looping
// preview that hasn't been promoted to the real video yet). Routed through the
// player's own [video-toggle-btn] so its preview→main swap, unmute, and control
// state transitions all run exactly as they do on a normal play click.
function startPlaybackIfIdle(target) {
  const toggle = target.querySelector('[video-toggle-btn]');
  if (toggle && toggle.getAttribute('data-state') === 'paused') toggle.click();
}

function onKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const btn = event.target.closest?.(BTN_SELECTOR);
  if (!btn || btn.tagName === 'BUTTON' || btn.tagName === 'A') return; // native activation already works
  event.preventDefault();
  btn.click();
}

function onClick(event) {
  const btn = event.target.closest?.(BTN_SELECTOR);
  if (!btn) return;

  const target = resolveTarget(btn);
  if (!target) {
    logger.warn(
      '[VideoFullscreen] No [video-element-wrap] / [video-section] ancestor to fullscreen.',
      btn
    );
    return;
  }

  const video = target.querySelector('video');
  if (!video) {
    logger.warn('[VideoFullscreen] No <video> inside the fullscreen target.', target);
    return;
  }

  event.preventDefault();

  // Second click while already fullscreen → leave fullscreen.
  if (getFullscreenElement() === target) {
    exitFullscreen();
    return;
  }

  // iPhone: no element fullscreen — hand the video to Apple's native player,
  // which supplies its own controls.
  if (!supportsElementFullscreen()) {
    if (typeof video.webkitEnterFullscreen === 'function') {
      startPlaybackIfIdle(target);
      try {
        video.webkitEnterFullscreen();
      } catch {
        logger.warn('[VideoFullscreen] Native video fullscreen was refused.', video);
      }
    } else {
      logger.warn('[VideoFullscreen] Fullscreen is not supported in this browser.');
    }
    return;
  }

  ensureCSS();
  markFillChain(target, video);
  target.setAttribute(FS_ATTR, 'true');
  currentTarget = target;

  const result = requestFullscreen(target);
  if (result && typeof result.catch === 'function') {
    result.catch(() => {
      // Request rejected (not a trusted gesture, or blocked by permissions
      // policy) — undo the styling so the wrap doesn't sit there screen-sized.
      teardown(target);
      if (currentTarget === target) currentTarget = null;
      syncButtons();
    });
  }

  startPlaybackIfIdle(target);
}

// Fires for every fullscreen entry AND exit, including ESC and the browser's own
// exit affordance — so this is what keeps state honest, not the click handler.
function onFullscreenChange() {
  const fsEl = getFullscreenElement();
  if (currentTarget && fsEl !== currentTarget) {
    teardown(currentTarget);
    currentTarget = null;
  }
  syncButtons();
}

/**
 * Leave native fullscreen if `el` is the element currently fullscreened (or is
 * nested in it / contains it — the latter covers a <video> fullscreened by the
 * browser's own controls). `onDone` runs once the browser has actually
 * collapsed the viewport, so callers can animate against real layout instead of
 * the fullscreen box. When nothing of `el`'s is fullscreen, `onDone` runs
 * synchronously — so this is safe to call unconditionally.
 *
 * Returns true if an exit was requested.
 */
export function exitVideoFullscreenFor(el, onDone = () => {}) {
  const fsEl = getFullscreenElement();
  const isOurs = !!(el && fsEl && (fsEl === el || fsEl.contains(el) || el.contains(fsEl)));
  if (!isOurs) {
    onDone();
    return false;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    document.removeEventListener('fullscreenchange', finish);
    document.removeEventListener('webkitfullscreenchange', finish);
    onDone();
  };
  // Registered after this module's own onFullscreenChange, so the wrap's
  // fullscreen styling is already torn down by the time onDone runs. The timer
  // is the fallback for a browser that never fires the change event.
  document.addEventListener('fullscreenchange', finish);
  document.addEventListener('webkitfullscreenchange', finish);
  const timer = setTimeout(finish, 400);

  exitFullscreen();
  return true;
}

export function initVideoFullscreen() {
  if (typeof document === 'undefined') return;
  if (listenersAttached) return;

  // Self-guarding: no fullscreen buttons on this page, nothing to wire.
  if (!document.querySelector(BTN_SELECTOR)) return;

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  cleanupFns.push(() => document.removeEventListener('click', onClick));
  cleanupFns.push(() => document.removeEventListener('keydown', onKeydown));
  cleanupFns.push(() => document.removeEventListener('fullscreenchange', onFullscreenChange));
  cleanupFns.push(() => document.removeEventListener('webkitfullscreenchange', onFullscreenChange));

  syncButtons();
  listenersAttached = true;
  logger.log('⛶ Video fullscreen ready');
}

export function cleanupVideoFullscreen() {
  if (currentTarget) {
    teardown(currentTarget);
    currentTarget = null;
  }
  cleanupFns.splice(0).forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore cleanup errors
    }
  });
  listenersAttached = false;
}
