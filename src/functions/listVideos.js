import { ensureGSAPLoaded } from '../components/gsap';
import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';
import { enhanceControlA11y, activateOnEnterOrSpace, toggleLabelFor } from '../utils/controlA11y';
import { prefersReducedMotion } from '../utils/motion';
import {
  registerVideoPlayer,
  unregisterVideoPlayer,
  pauseOtherPlayers,
} from '../utils/videoPlayerRegistry';

const LIST_SELECTOR = '[video-items-list]';
const ITEM_SELECTOR = '[video-item]';
const instances = new Map();

// Shared across all items so we don't spin up dozens of IntersectionObservers.
const LAZY_ROOT_MARGIN = '200px 0px';
const LAZY_THRESHOLD = 0.01;

// ---------------------------------------------------------------------------
// Public init / cleanup
// ---------------------------------------------------------------------------

export async function initListVideos(options = {}) {
  if (typeof document === 'undefined') {
    logger.warn('[ListVideos] document undefined (SSR) — skipping.');
    return () => {};
  }

  const lists =
    options.rootElements ||
    Array.from(document.querySelectorAll(options.rootSelector || LIST_SELECTOR));

  if (!lists.length) {
    logger.info('[ListVideos] No [video-items-list] found — nothing to init.');
    return () => {};
  }

  try {
    await ensureGSAPLoaded();
  } catch (err) {
    handleError(err, 'ListVideos GSAP load');
    return () => {};
  }

  const gsap = window.gsap;
  if (!gsap) {
    logger.warn('[ListVideos] GSAP unavailable after load.');
    return () => {};
  }

  let count = 0;
  const addedLists = new Set();

  lists.forEach((list) => {
    if (instances.has(list)) return;
    const cleanup = createListInstance(list, gsap);
    if (cleanup) {
      instances.set(list, cleanup);
      addedLists.add(list);
      count += 1;
    }
  });

  if (count > 0) logger.log(`[ListVideos] Ready (${count} instance${count > 1 ? 's' : ''})`);

  return () => {
    addedLists.forEach((list) => {
      const cleanup = instances.get(list);
      if (cleanup) {
        try {
          cleanup();
        } catch (err) {
          handleError(err, 'ListVideos cleanup');
        }
        instances.delete(list);
      }
    });
    addedLists.clear();
  };
}

export function cleanupListVideos() {
  instances.forEach((cleanup) => {
    try {
      cleanup();
    } catch (err) {
      handleError(err, 'ListVideos cleanup');
    }
  });
  instances.clear();
}

// ---------------------------------------------------------------------------
// List instance
// ---------------------------------------------------------------------------

function createListInstance(list, gsap) {
  const items = Array.from(list.querySelectorAll(ITEM_SELECTOR));
  if (!items.length) return null;

  const itemInstances = [];

  function deactivateAll(except = null) {
    itemInstances.forEach((inst) => {
      if (inst !== except) inst.deactivate();
    });
    if (!except) list.classList.remove('video-playing');
  }

  items.forEach((item) => {
    const inst = createItemInstance(item, gsap, {
      onPlay: (self) => {
        deactivateAll(self);
        list.classList.add('video-playing');
        item.classList.add('active');
      },
      onPlaying: (self) => {
        // Actual playback started — the network is free again, so siblings can
        // reload their looping previews now without starving this video.
        list.classList.add('video-playing');
        itemInstances.forEach((other) => {
          if (other !== self) other.restorePreview();
        });
      },
      onPause: () => {
        // isActive (not isPlaying): an item that is still starting counts, so an
        // interrupted sibling's async play() rejection can't strip the class
        // right after the new item added it.
        if (!itemInstances.some((i) => i.isActive())) {
          list.classList.remove('video-playing');
        }
        item.classList.remove('active');
      },
      onEnded: () => {
        if (!itemInstances.some((i) => i.isActive())) {
          list.classList.remove('video-playing');
        }
        item.classList.remove('active');
      },
    });
    if (inst) itemInstances.push(inst);
  });

  return () => {
    itemInstances.forEach((inst) => inst.destroy());
    itemInstances.length = 0;
  };
}

// ---------------------------------------------------------------------------
// Overlay animations
// ---------------------------------------------------------------------------

/**
 * Build a small animation controller for the .video-overlay layer.
 *
 * Structure expected in HTML:
 *   .video-overlay                    — full-screen backdrop (display:none at rest)
 *     .video-controls-overlay         — slide-up panel (clip-path inset at rest)
 *       .video-controls-overlay-content
 *         [video-toggle-btn]          — big pill button (scale(0) at rest)
 *     .video-overlay-body             — duration text
 *     .video-overlay-head             — title / heading
 *
 * Returns { show, hide, kill } — all safe to call when elements are absent.
 */
function createOverlayController(item, gsap) {
  const overlay = item.querySelector('.video-overlay');
  const overlayPanel = item.querySelector('.video-controls-overlay');
  const overlayPillBtn = item.querySelector('.video-controls-overlay [video-toggle-btn]');

  // Nothing to animate — return no-op controller
  if (!overlay) return { show: () => {}, hide: () => {}, kill: () => {} };

  // Kill any in-flight tweens on these elements
  function killTweens() {
    gsap.killTweensOf([overlay, overlayPanel, overlayPillBtn].filter(Boolean));
  }

  // show() — called when video starts playing
  function show() {
    killTweens();

    // 1. Make the overlay visible first (was display:none)
    gsap.set(overlay, { display: 'block' });

    // 2. Fade in the backdrop
    gsap.to(overlay, {
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
    });

    // 3. Slide the controls panel up from below
    if (overlayPanel) {
      gsap.to(overlayPanel, {
        clipPath: 'inset(0% 0px 0px)',
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
        delay: 0.1,
      });
    }

    // 4. Scale + fade the pill button in
    if (overlayPillBtn) {
      gsap.to(overlayPillBtn, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: 'back.out(1.4)',
        delay: 0.2,
      });
    }
  }

  // hide() — called on pause, end, or deactivate
  // onComplete collapses display so the element stops intercepting pointer events
  function hide(onComplete) {
    killTweens();

    // 1. Scale + fade the pill button out first
    if (overlayPillBtn) {
      gsap.to(overlayPillBtn, {
        scale: 0,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
      });
    }

    // 2. Slide the controls panel back down
    if (overlayPanel) {
      gsap.to(overlayPanel, {
        clipPath: 'inset(100% 0px 0px)',
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        delay: 0.05,
      });
    }

    // 3. Fade out the backdrop, then collapse to display:none
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
      delay: 0.1,
      onComplete: () => {
        gsap.set(overlay, { display: 'none' });
        onComplete?.();
      },
    });
  }

  // Reset everything to initial state instantly (used by destroy)
  function kill() {
    killTweens();
    gsap.set(overlay, { display: 'none', opacity: 0 });
    if (overlayPanel) gsap.set(overlayPanel, { clipPath: 'inset(100% 0px 0px)', opacity: 0 });
    if (overlayPillBtn) gsap.set(overlayPillBtn, { scale: 0, opacity: 0 });
  }

  return { show, hide, kill };
}

// ---------------------------------------------------------------------------
// Item instance
// ---------------------------------------------------------------------------

function createItemInstance(item, gsap, callbacks = {}) {
  const video = item.querySelector('.video-element');
  if (!video) {
    logger.warn('[ListVideos] Missing .video-element in item:', item);
    return null;
  }

  const toggleBtns = item.querySelectorAll('[video-toggle-btn]');
  const progressBar = item.querySelector('[video-controls-progress]');
  const progressLine = item.querySelector('.video-controls-progress-line');
  const timeDisplay = item.querySelector('[data-video-time]');

  const overlayCtrl = createOverlayController(item, gsap);

  const loopingSrc = video.dataset.loopingVideoSrc?.trim() || '';
  const hasLooping = Boolean(loopingSrc);
  // Video is lazily loaded — the actual source lives in data-src until the
  // item scrolls into view (looping preview) or is clicked (main video).
  const originalSrc = video.dataset.src || video.getAttribute('src');
  const posterSrc = video.dataset.poster || '';

  let progressRAF = null;
  let isScrubbing = false;
  let hasStarted = false;
  let playing = false;
  let starting = false;
  // Whether the element currently holds the looping preview src (vs the main
  // video). Drives restorePreview so the preview is never double-loaded.
  let showingPreview = hasLooping;
  let previewFailsafeTimer = null;
  let lazyObserver = null;
  let lazyMediaActivated = false;

  const cleanupFns = [];
  // Only yield to other players when the main (audible) video is active —
  // the muted looping preview should keep playing regardless of what else
  // starts on the page. `starting` covers the window before play() resolves.
  const registryId = registerVideoPlayer(() => {
    if ((hasStarted || starting) && !video.paused) pauseVideo();
  });

  function on(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    cleanupFns.push(() => target.removeEventListener(event, handler, opts));
  }

  // ── Lazy loading (poster + looping preview) ─────────────────────────────────

  function loadPoster() {
    if (posterSrc) {
      video.poster = posterSrc;
      video.removeAttribute('data-poster');
    }
  }

  // Starts the muted looping preview — except under prefers-reduced-motion,
  // where it stays on its poster / first frame until the user presses play.
  function playPreview() {
    if (prefersReducedMotion()) return;
    video.play().catch(() => {});
  }

  // Called once, the first time the item enters (near) the viewport. Loads
  // the poster and, for items with a looping preview, starts it. Items
  // without a looping preview stay untouched until the user clicks play —
  // that path already lazily assigns `originalSrc` in playVideo(fresh).
  function activateLazyMedia() {
    if (lazyMediaActivated) return;
    lazyMediaActivated = true;
    loadPoster();
    if (hasLooping) {
      video.src = loopingSrc;
      video.loop = true;
      video.muted = true;
      playPreview();
    }
  }

  function setupLazyLoading() {
    if (typeof IntersectionObserver === 'undefined') {
      // No IO support — fall back to loading immediately.
      activateLazyMedia();
      return;
    }
    lazyObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activateLazyMedia();
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: LAZY_ROOT_MARGIN, threshold: LAZY_THRESHOLD }
    );
    lazyObserver.observe(item);
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function formatTime(s) {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function setProgress(pct) {
    if (progressLine) progressLine.style.width = `${pct}%`;
  }

  function setTime(seconds) {
    if (timeDisplay) timeDisplay.textContent = formatTime(seconds);
  }

  function setBtnsState(state) {
    const label = toggleLabelFor(state);
    toggleBtns.forEach((btn) => {
      btn.setAttribute('data-state', state);
      btn.setAttribute('aria-label', label);
    });
  }

  // ── RAF progress loop ──────────────────────────────────────────────────────

  function startRAF() {
    cancelAnimationFrame(progressRAF);
    const tick = () => {
      // Duration can be momentarily unavailable (e.g. metadata still resolving)
      // even after play() resolves — skip the UI update, not the loop, so it
      // self-heals on a later frame instead of freezing the progress bar.
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setTime(video.currentTime);
      }
      progressRAF = requestAnimationFrame(tick);
    };
    progressRAF = requestAnimationFrame(tick);
  }

  function stopRAF() {
    cancelAnimationFrame(progressRAF);
    progressRAF = null;
  }

  // ── Scrubbing ──────────────────────────────────────────────────────────────

  function pctFromEvent(e) {
    if (!progressBar) return 0;
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return rect.width ? x / rect.width : 0;
  }

  function scrubTo(e) {
    if (!video.duration || !progressBar) return;
    const pct = pctFromEvent(e);
    if (progressLine) progressLine.style.transition = 'none';
    setProgress(pct * 100);
    setTime(pct * video.duration);
    video.currentTime = pct * video.duration;
  }

  function onScrubMove(e) {
    if (isScrubbing) scrubTo(e);
  }

  function onScrubEnd() {
    if (!isScrubbing) return;
    isScrubbing = false;
    document.removeEventListener('mousemove', onScrubMove);
    document.removeEventListener('mouseup', onScrubEnd);
    document.removeEventListener('touchmove', onScrubMove, { passive: true });
    document.removeEventListener('touchend', onScrubEnd);
    requestAnimationFrame(() => {
      if (progressLine) progressLine.style.transition = '';
      if (!video.paused) startRAF();
    });
  }

  function onScrubStart(e) {
    // Scrubbing only makes sense on the main video, not the looping preview.
    if (!hasStarted) return;
    isScrubbing = true;
    stopRAF();
    scrubTo(e);
    document.addEventListener('mousemove', onScrubMove);
    document.addEventListener('mouseup', onScrubEnd);
    document.addEventListener('touchmove', onScrubMove, { passive: true });
    document.addEventListener('touchend', onScrubEnd);
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  function onPlaybackStarted() {
    starting = false;
    hasStarted = true;
    if (playing) return;
    playing = true;
    setBtnsState('playing');
    startRAF();
    overlayCtrl.show();
    callbacks.onPlaying?.(instance);
  }

  function playVideo(fresh = false) {
    // Clicking to play means the item is visible — make sure the poster/lazy
    // setup has run even if the observer hasn't fired yet (e.g. very fast
    // click right as the item enters the DOM).
    activateLazyMedia();

    // Re-entering the fresh path while play() is still pending would reassign
    // video.src mid-flight and abort the first request. toggleVideo turns that
    // second click into cancelStart(); this guard is the backstop.
    if (fresh) {
      if (starting) return;
      starting = true;
    }

    pauseOtherPlayers(registryId);
    setBtnsState('loading');
    callbacks.onPlay?.(instance);

    if (fresh) {
      showingPreview = false;
      video.loop = false;
      video.muted = false;
      video.src = originalSrc;
      video.removeAttribute('data-src');
      setProgress(0);
      setTime(0);
    }

    video
      .play()
      .then(onPlaybackStarted)
      .catch(() => {
        starting = false;
        playing = false;
        setBtnsState('paused');
        callbacks.onPause?.();
        // Start was aborted or blocked — bring the looping preview back, but
        // deferred, so a sibling that interrupted this start loads first.
        schedulePreviewRestore();
      });
  }

  function pauseVideo() {
    playing = false;
    video.pause();
    setBtnsState('paused');
    stopRAF();
    overlayCtrl.hide();
    callbacks.onPause?.();
  }

  // A click while the first play() is still loading cancels the start instead
  // of being swallowed — otherwise a stalled load leaves the item stuck on
  // 'loading' with no way to recover.
  function cancelStart() {
    starting = false;
    playing = false;
    video.pause();
    setBtnsState('paused');
    stopRAF();
    overlayCtrl.hide();
    callbacks.onPause?.();
    restorePreview();
  }

  function restorePreview() {
    clearTimeout(previewFailsafeTimer);
    previewFailsafeTimer = null;
    if (!hasLooping || showingPreview) return;
    if (hasStarted || starting) return;
    showingPreview = true;
    video.src = loopingSrc;
    video.loop = true;
    video.muted = true;
    playPreview();
  }

  // Deferred restore: used when reloading the preview right now would compete
  // with another video's download. The list calls restorePreview as soon as the
  // new video reports 'playing'; this timer is the failsafe if it never does
  // (e.g. the interrupting player is in another component).
  function schedulePreviewRestore() {
    if (!hasLooping || showingPreview) return;
    clearTimeout(previewFailsafeTimer);
    previewFailsafeTimer = setTimeout(restorePreview, 4000);
  }

  function toggleVideo() {
    if (starting) {
      cancelStart();
      return;
    }
    if (!hasStarted) {
      playVideo(true);
    } else {
      video.paused ? playVideo() : pauseVideo();
    }
  }

  // ── Video events ───────────────────────────────────────────────────────────

  function onVideoEnded() {
    stopRAF();
    playing = false;
    hasStarted = false;
    setBtnsState('paused');
    setProgress(100);
    overlayCtrl.hide();
    callbacks.onEnded?.();

    if (hasLooping) {
      showingPreview = true;
      video.src = loopingSrc;
      video.loop = true;
      video.muted = true;
      playPreview();
    }
  }

  // Backs up the play() promise: if the promise stalls or gets dropped but
  // playback genuinely starts, the media event still syncs the UI out of the
  // 'loading' state.
  function onVideoPlaying() {
    if (!starting && !hasStarted) return; // muted looping preview — ignore
    onPlaybackStarted();
  }

  function onVideoPause() {
    // Reaching the end of the video fires 'pause' immediately before 'ended', with
    // video.ended already true — bail here so onVideoEnded is the only handler that
    // reacts, instead of both firing overlayCtrl.hide() back-to-back.
    if (video.ended) return;
    if (playing) {
      playing = false;
      setBtnsState('paused');
      stopRAF();
      overlayCtrl.hide();
      callbacks.onPause?.();
    }
  }

  function onVideoWaiting() {
    if (hasStarted) setBtnsState('loading');
  }

  function onVideoCanPlay() {
    if (!video.paused && hasStarted) setBtnsState('playing');
  }

  function onLoadedMetadata() {
    if (hasStarted) setTime(video.duration);
  }

  // ── Wire up events ─────────────────────────────────────────────────────────

  // Webflow renders these as plain divs — button role, focus, a name, and an
  // Enter/Space bridge (same as sectionVideoPlayer; see utils/controlA11y.js).
  // The wrap-click below stays mouse-only on purpose: the toggle already gives
  // keyboard users the same play/pause action.
  toggleBtns.forEach((btn) => {
    btn.setAttribute('data-state', 'paused');
    enhanceControlA11y(btn, toggleLabelFor('paused'));
    on(btn, 'click', toggleVideo);
    on(btn, 'keydown', activateOnEnterOrSpace);
  });

  // Clicking the video-wrap (outside the controls bar) toggles play/pause.
  // .video-overlay is display:none at rest so we listen on the wrap and
  // exclude .video-controls (bottom bar) to avoid conflicting with scrub/buttons.
  const videoWrap = item.querySelector('[video-section]');
  if (videoWrap) {
    on(videoWrap, 'click', (e) => {
      if (e.target.closest('.video-controls')) return;
      if (e.target.closest('[video-toggle-btn]')) return;
      toggleVideo();
    });
  }

  if (progressBar) {
    on(progressBar, 'mousedown', onScrubStart);
    on(progressBar, 'touchstart', onScrubStart, { passive: true });
  }

  on(video, 'ended', onVideoEnded);
  on(video, 'playing', onVideoPlaying);
  on(video, 'pause', onVideoPause);
  on(video, 'waiting', onVideoWaiting);
  on(video, 'canplay', onVideoCanPlay);
  on(video, 'loadedmetadata', onLoadedMetadata);

  // Poster + looping preview are deferred until the item is near the viewport.
  setupLazyLoading();

  // ── Public instance API ────────────────────────────────────────────────────

  const instance = {
    isPlaying: () => playing,
    isActive: () => playing || starting,
    restorePreview,

    deactivate() {
      // Items still in preview mode need no teardown — pausing or reloading
      // them here would flicker every sibling on each play.
      const wasActive = hasStarted || starting;
      starting = false;
      playing = false;
      if (wasActive && !video.paused) {
        video.pause();
        setBtnsState('paused');
        stopRAF();
      }
      if (wasActive) overlayCtrl.hide();
      if (hasStarted) {
        hasStarted = false;
        setProgress(0);
        setTime(0);
      }
      if (hasLooping) {
        if (wasActive) {
          // Keep the paused frame for now: reloading the preview immediately
          // would compete with the newly-clicked video's download and can stall
          // its play() indefinitely. Restored via onPlaying/restorePreview once
          // the new video actually starts, or by the failsafe timer.
          schedulePreviewRestore();
        } else if (showingPreview && video.paused) {
          playPreview();
        }
      }
      item.classList.remove('active');
    },

    destroy() {
      if (isScrubbing) onScrubEnd();
      clearTimeout(previewFailsafeTimer);
      if (lazyObserver) {
        lazyObserver.disconnect();
        lazyObserver = null;
      }
      stopRAF();
      video.pause();
      overlayCtrl.kill();
      cleanupFns.forEach((fn) => fn());
      unregisterVideoPlayer(registryId);
    },
  };

  return instance;
}

// Backward compatibility aliases
export const initLeadershipVideoPlayer = initListVideos;
export const cleanupLeadershipVideoPlayer = cleanupListVideos;
