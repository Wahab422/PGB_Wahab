/**
 * Regular Video Player (Shared Utility)
 * Standalone video players inside [video-element-wrap] with toggle, scrubbing, and progress.
 * Not global: import on pages that render these wraps.
 *
 * Markup (inside [video-element-wrap]):
 * - .video-element — <video> with src (full) and optional data-looping-video-src (preview loop)
 * - [data-autoplay-on-view] (optional, on the wrap or video) — play the video MUTED
 *   once it's in view: its center reaches 60% down the viewport, OR its bottom edge
 *   is fully on-screen — whichever is earlier. Pauses when the wrap scrolls out of
 *   view. No [video-toggle-btn] is required in this mode.
 * - [video-toggle-btn]
 * - [video-controls-progress], .video-controls-progress-line
 * - [video-controls-time] — time display (falls back to .video-controls > div:last-child)
 * - img[data-poster-sub] (optional) — if the video has no [poster], its src is used as the poster
 *
 * Optional two-control overlay swap (mirrors sectionVideoPlayer): if the wrap has
 * BOTH an overlay (.video-overlay or .video-controls-overlay, holding a center
 * [video-toggle-btn]) and a bottom .video-controls bar, the overlay shows first;
 * clicking its toggle plays the video, fades the overlay out, and fades the
 * bottom controls in. A [video-return-btn] reverses it (pause + back to overlay).
 *
 * Usage:
 *   import { initRegularVideoPlayer, cleanupRegularVideoPlayer } from '../functions/regularVideoPlayer';
 *   initRegularVideoPlayer();
 */

import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';
import { enhanceControlA11y, activateOnEnterOrSpace, toggleLabelFor } from '../utils/controlA11y';
import { prefersReducedMotion } from '../utils/motion';
import {
  registerVideoPlayer,
  unregisterVideoPlayer,
  pauseOtherPlayers,
} from '../utils/videoPlayerRegistry';

const WRAP_SELECTOR = '[video-element-wrap]';
const instances = new Map();

export function initRegularVideoPlayer(options = {}) {
  if (typeof document === 'undefined') {
    logger.warn('[RegularVideoPlayer] document is undefined (SSR) - skipping init.');
    return () => {};
  }

  const wraps =
    options.rootElements ||
    Array.from(document.querySelectorAll(options.rootSelector || WRAP_SELECTOR));

  if (!wraps.length) {
    logger.info('[RegularVideoPlayer] No [video-element-wrap] found - nothing to initialize.');
    return () => {};
  }

  let initializedCount = 0;

  const getCallbacks = options.getCallbacks;

  wraps.forEach((wrap) => {
    if (instances.has(wrap)) return;
    const callbacks = typeof getCallbacks === 'function' ? getCallbacks(wrap) || {} : {};
    const cleanup = createVideoWrapInstance(wrap, callbacks);
    if (cleanup) {
      instances.set(wrap, cleanup);
      initializedCount += 1;
    }
  });

  if (initializedCount > 0) {
    logger.log(
      `[RegularVideoPlayer] Ready (${initializedCount} instance${initializedCount > 1 ? 's' : ''})`
    );
  }

  return () => cleanupRegularVideoPlayer();
}

export function cleanupRegularVideoPlayer() {
  instances.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      handleError(error, 'Regular Video Player Cleanup');
    }
  });
  instances.clear();
}

function createVideoWrapInstance(wrap, callbacks = {}) {
  const video = wrap.querySelector('.video-element');
  if (!video) {
    logger.warn('[RegularVideoPlayer] Missing .video-element inside wrap.', wrap);
    return null;
  }

  const allToggleBtns = wrap.querySelectorAll('[video-toggle-btn]');
  const progressBar = wrap.querySelector('[video-controls-progress]');
  const progressLine = wrap.querySelector('.video-controls-progress-line');
  const timeDisplay =
    wrap.querySelector('[video-controls-time]') ||
    wrap.querySelector('.video-controls > div:last-child');

  // Two-control swap (mirrors sectionVideoPlayer): an overlay holds a center
  // toggle; on first play it fades out and the bottom .video-controls bar fades
  // in. A [video-return-btn] reverses it. Only active when BOTH an overlay and a
  // bottom controls bar exist, so plain single-control videos are unaffected.
  const overlayEl =
    wrap.querySelector('.video-overlay') || wrap.querySelector('.video-controls-overlay');
  const bottomControls = wrap.querySelector('.video-controls');
  const returnBtns = wrap.querySelectorAll('[video-return-btn]');
  const hasOverlaySwap = Boolean(overlayEl && bottomControls);

  const loopingSrc = video.dataset.loopingVideoSrc;
  const hasLoopingSrc = typeof loopingSrc === 'string' && loopingSrc.trim() !== '';
  const originalSrc = video.getAttribute('src');

  // [data-autoplay-on-view] (on the wrap or the video): play the video MUTED once
  // it's in view (center reaches 60% down the viewport OR bottom edge fully on-screen,
  // whichever is earlier), and pause it when the wrap scrolls out of view. No
  // [video-toggle-btn] is required in this mode — see the watcher near the viewObserver.
  const autoplayOnView =
    wrap.hasAttribute('data-autoplay-on-view') || video.hasAttribute('data-autoplay-on-view');

  // Poster fallback: if the video has no authored [poster], borrow the src of an
  // img[data-poster-sub] in the wrap (a still exported alongside the video).
  if (!video.getAttribute('poster')) {
    const posterSub = wrap.querySelector('img[data-poster-sub]');
    const posterSrc = posterSub?.getAttribute('src');
    if (posterSrc) {
      video.setAttribute('poster', posterSrc);
      // Its src is now the video's poster, so the <img> is redundant — fade it out
      // (and drop pointer-events) once it has finished loading, so there's no flash
      // before the video poster paints.
      const hidePosterSub = () => {
        posterSub.style.opacity = '0';
        posterSub.style.pointerEvents = 'none';
      };
      if (posterSub.complete) hidePosterSub();
      else posterSub.addEventListener('load', hidePosterSub, { once: true });
    }
  }

  let progressRAF = null;
  let isScrubbing = false;
  let hasStarted = false;
  let playing = false;
  // Bumped by every play request, pause and reset; a play() promise settling
  // after a newer one of those is stale and ignored (a slow first play
  // resolving after Return used to mark the preview "playing"). playPending
  // is true while our own play() is in flight — a 'playing' event outside it
  // came from media keys / picture-in-picture instead.
  let playToken = 0;
  let playPending = false;

  const cleanupHandlers = [];
  // Only yield to other players when the main video is active — the muted
  // looping preview should keep playing regardless of what else starts.
  const registryId = registerVideoPlayer(() => {
    if (!hasStarted) return;
    if (!video.paused) pauseVideo(true);
    resetToPreview();
  });

  function addCleanup(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    cleanupHandlers.push(() => target.removeEventListener(event, handler, options));
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function setProgress(pct) {
    if (progressLine) progressLine.style.width = `${pct}%`;
  }

  function setTime(seconds) {
    if (timeDisplay) timeDisplay.textContent = formatTime(seconds);
  }

  function setBtnsState(state) {
    const label = toggleLabelFor(state);
    allToggleBtns.forEach((btn) => {
      btn.setAttribute('data-state', state);
      btn.setAttribute('aria-label', label);
    });
  }

  // When the overlay and bottom bar swap, don't leave keyboard focus on the
  // control that just faded out (autoAlpha → visibility:hidden drops it).
  const moveFocusIfInside = (from, to) => {
    if (!from || !to || !from.contains(document.activeElement)) return;
    const target = to.querySelector('[video-toggle-btn], [video-return-btn]');
    if (!target) return;
    // `to` is fading in from autoAlpha:0 (visibility:hidden), and hidden
    // elements can't take focus — GSAP only flips it visible on the tween's
    // first rendered frame, so wait for that before focusing.
    requestAnimationFrame(() => requestAnimationFrame(() => target.focus({ preventScroll: true })));
  };

  // Fade an element in/out. Uses GSAP (autoAlpha handles visibility) when it's
  // available; falls back to inline styles otherwise.
  function setElementVisible(el, visible, animate, y = 0) {
    if (!el) return;
    const gsap = window.gsap;
    if (gsap) {
      gsap.killTweensOf(el);
      const vars = { autoAlpha: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' };
      if (y) vars.y = visible ? 0 : y;
      if (animate) {
        gsap.to(el, {
          ...vars,
          duration: visible ? 0.4 : 0.3,
          ease: visible ? 'power2.out' : 'power2.in',
        });
      } else {
        gsap.set(el, vars);
      }
    } else {
      el.style.opacity = visible ? '1' : '0';
      el.style.visibility = visible ? '' : 'hidden';
      el.style.pointerEvents = visible ? '' : 'none';
    }
  }

  // Enter playback chrome: hide the overlay (center toggle), reveal bottom bar.
  function enterControls() {
    if (!hasOverlaySwap) return;
    setElementVisible(overlayEl, false, true);
    setElementVisible(bottomControls, true, true, 10);
    moveFocusIfInside(overlayEl, bottomControls);
  }

  // Back to the overlay state: hide the bottom bar, bring the overlay back.
  function exitControls() {
    if (!hasOverlaySwap) return;
    setElementVisible(bottomControls, false, true, 10);
    setElementVisible(overlayEl, true, true);
    moveFocusIfInside(bottomControls, overlayEl);
  }

  function getPctFromEvent(e) {
    if (!progressBar) return 0;
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return rect.width ? x / rect.width : 0;
  }

  function startRAF() {
    cancelAnimationFrame(progressRAF);
    function tick() {
      if (!video.duration) return;
      setProgress((video.currentTime / video.duration) * 100);
      setTime(video.currentTime);
      progressRAF = requestAnimationFrame(tick);
    }
    progressRAF = requestAnimationFrame(tick);
  }

  function stopRAF() {
    cancelAnimationFrame(progressRAF);
    progressRAF = null;
  }

  function scrubTo(e) {
    if (!video.duration || !progressBar) return;
    const pct = getPctFromEvent(e);
    if (progressLine) progressLine.style.transition = 'none';
    setProgress(pct * 100);
    setTime(pct * video.duration);
    video.currentTime = pct * video.duration;
  }

  function onScrubMove(e) {
    if (!isScrubbing) return;
    scrubTo(e);
  }

  function onScrubEnd() {
    if (!isScrubbing) return;
    isScrubbing = false;
    document.removeEventListener('mousemove', onScrubMove);
    document.removeEventListener('mouseup', onScrubEnd);
    document.removeEventListener('touchmove', onScrubMove);
    document.removeEventListener('touchend', onScrubEnd);
    requestAnimationFrame(() => {
      if (progressLine) progressLine.style.transition = '';
      if (!video.paused) startRAF();
    });
  }

  function onScrubStart(e) {
    isScrubbing = true;
    stopRAF();
    scrubTo(e);
    document.addEventListener('mousemove', onScrubMove);
    document.addEventListener('mouseup', onScrubEnd);
    document.addEventListener('touchmove', onScrubMove, { passive: true });
    document.addEventListener('touchend', onScrubEnd);
  }

  function restoreLoopingPreview() {
    if (!hasLoopingSrc) return;
    video.src = loopingSrc;
    video.loop = true;
    video.muted = true;
    video.load();
    // prefers-reduced-motion: load the preview (poster / first frame) but
    // don't set it moving.
    if (!prefersReducedMotion()) video.play().catch(() => {});
  }

  function resetToPreview() {
    if (!hasStarted) return;
    hasStarted = false;
    playToken += 1;
    playPending = false;
    setProgress(0);
    setTime(0);
    restoreLoopingPreview();
    wrap.classList.remove('active');
    exitControls();
  }

  // Reverse the overlay swap: pause, return to the preview/overlay state.
  function returnToOverlay() {
    if (!hasStarted) {
      exitControls();
      return;
    }
    if (!video.paused) pauseVideo(true);
    resetToPreview();
    callbacks.onPause?.();
  }

  function deactivate() {
    const wasStarted = hasStarted;
    if (!video.paused) pauseVideo(true);
    if (hasStarted) resetToPreview();
    else wrap.classList.remove('active');
    if (wasStarted) callbacks.onPause?.();
  }

  function startFullVideo() {
    if (hasStarted) return;
    hasStarted = true;

    pauseOtherPlayers(registryId);

    video.loop = false;
    video.muted = false;
    video.src = originalSrc;
    video.currentTime = 0;
    video.load();

    setBtnsState('loading');
    wrap.classList.add('active');
    // Swap the center overlay toggle out for the bottom controls bar.
    enterControls();

    const token = ++playToken;
    playPending = true;
    video
      .play()
      .then(() => {
        if (token !== playToken) return;
        playPending = false;
        playing = true;
        setBtnsState('playing');
        startRAF();
        callbacks.onPlay?.();
      })
      .catch(() => {
        if (token !== playToken) return;
        playPending = false;
        // Play was blocked/aborted — put the preview and overlay back.
        rollBackToPreview();
      });
  }

  // The full video couldn't start, or its source broke: back to the looping
  // preview and the overlay instead of a dead player.
  function rollBackToPreview() {
    playing = false;
    hasStarted = false;
    setBtnsState('paused');
    wrap.classList.remove('active');
    restoreLoopingPreview();
    exitControls();
  }

  function playVideo() {
    pauseOtherPlayers(registryId);
    setBtnsState('loading');
    wrap.classList.add('active');

    const token = ++playToken;
    playPending = true;
    video
      .play()
      .then(() => {
        if (token !== playToken) return;
        playPending = false;
        playing = true;
        setBtnsState('playing');
        startRAF();
        callbacks.onPlay?.();
      })
      .catch(() => {
        if (token !== playToken) return;
        playPending = false;
        playing = false;
        setBtnsState('paused');
        wrap.classList.remove('active');
      });
  }

  function pauseVideo(silent = false) {
    playToken += 1;
    playPending = false;
    video.pause();
    playing = false;
    setBtnsState('paused');
    stopRAF();
    wrap.classList.remove('active');
    if (!silent) callbacks.onPause?.();
  }

  function toggleVideo() {
    if (!hasStarted) {
      startFullVideo();
      return;
    }
    video.paused ? playVideo() : pauseVideo();
  }

  function onVideoEnded() {
    stopRAF();
    playing = false;
    hasStarted = false;
    setBtnsState('paused');
    setProgress(100);
    wrap.classList.remove('active');
    restoreLoopingPreview();
    exitControls();
    callbacks.onEnded?.();
  }

  // Sync state whenever the <video> pauses for any reason — registry takeover,
  // external pause, browser — not only via our own pauseVideo(). Without this,
  // data-state can stay "playing" after another player takes over.
  function onVideoPause() {
    // 'pause' fires right before 'ended' with video.ended true; let onVideoEnded
    // own that case so state isn't set twice.
    if (video.ended) return;
    // Ignore pauses of the muted looping preview (only the main video has state).
    if (!hasStarted) return;
    // Our own pauseVideo() clears `playing` first, so still-true means the
    // pause came from outside (media keys, picture-in-picture, the browser) —
    // finish what pauseVideo() would have done.
    const pausedExternally = playing;
    playing = false;
    setBtnsState('paused');
    stopRAF();
    if (pausedExternally) {
      wrap.classList.remove('active');
      callbacks.onPause?.();
    }
  }

  function onVideoWaiting() {
    if (hasStarted && playing) setBtnsState('loading');
  }

  function onVideoCanPlay() {
    if (!hasStarted) return;
    if (!video.paused) {
      playing = true;
      setBtnsState('playing');
      return;
    }
    const currentState = allToggleBtns[0]?.getAttribute('data-state');
    if (currentState === 'loading' && !playing) {
      setBtnsState('paused');
    }
  }

  function onVideoPlaying() {
    if (!hasStarted) return;
    // Resumed outside our own controls (media keys, picture-in-picture, the
    // OS media panel): do what playVideo() would have.
    const resumedExternally = !playing && !playPending;
    playing = true;
    setBtnsState('playing');
    if (resumedExternally) {
      pauseOtherPlayers(registryId);
      wrap.classList.add('active');
      startRAF();
      callbacks.onPlay?.();
    }
  }

  // The full video's source failed (network, unsupported file). Errors on the
  // preview itself just leave the poster showing.
  function onVideoError() {
    if (!hasStarted) return;
    logger.error('[RegularVideoPlayer] Video failed to load:', video.error, wrap);
    playToken += 1;
    playPending = false;
    rollBackToPreview();
    callbacks.onPause?.();
  }

  function onVideoTimeUpdate() {
    if (!hasStarted || video.paused) return;
    const currentState = allToggleBtns[0]?.getAttribute('data-state');
    if (currentState === 'loading') {
      setBtnsState('playing');
    }
  }

  function onLoadedMetadata() {
    if (hasStarted) setTime(video.duration);
  }

  // Webflow renders these as plain divs — button role, focus, a name, and an
  // Enter/Space bridge (same as sectionVideoPlayer; see utils/controlA11y.js).
  allToggleBtns.forEach((btn) => {
    btn.setAttribute('data-state', 'paused');
    enhanceControlA11y(btn, toggleLabelFor('paused'));
    addCleanup(btn, 'click', toggleVideo);
    addCleanup(btn, 'keydown', activateOnEnterOrSpace);
  });

  returnBtns.forEach((btn) => {
    enhanceControlA11y(btn, 'Return to preview');
    addCleanup(btn, 'click', returnToOverlay);
    addCleanup(btn, 'keydown', activateOnEnterOrSpace);
  });

  if (progressBar) {
    addCleanup(progressBar, 'mousedown', onScrubStart);
    addCleanup(progressBar, 'touchstart', onScrubStart, { passive: true });
  }

  addCleanup(video, 'ended', onVideoEnded);
  addCleanup(video, 'pause', onVideoPause);
  addCleanup(video, 'waiting', onVideoWaiting);
  addCleanup(video, 'canplay', onVideoCanPlay);
  addCleanup(video, 'playing', onVideoPlaying);
  addCleanup(video, 'error', onVideoError);
  addCleanup(video, 'timeupdate', onVideoTimeUpdate);
  addCleanup(video, 'loadedmetadata', onLoadedMetadata);

  // In autoplay-on-view mode the crossing watcher owns playback, so don't also
  // auto-start the muted looping preview here.
  if (hasLoopingSrc && !autoplayOnView) {
    restoreLoopingPreview();
  }

  // Start in the overlay state: bottom controls hidden until the first play.
  if (hasOverlaySwap) {
    setElementVisible(bottomControls, false, false, 10);
  }

  // Pause when the wrap leaves the viewport or becomes display:none (e.g. an
  // inactive tab panel). A hidden/off-screen <video> keeps playing on its own —
  // hiding it does not pause it — so stop it explicitly and sync data-state.
  // The main video stays paused when it comes back into view (the user resumes
  // it); a looping preview this observer paused restarts. Autoplay-on-view
  // previews are restarted by their own watcher below instead.
  let viewObserver = null;
  let previewPausedOffscreen = false;
  if (typeof IntersectionObserver !== 'undefined') {
    viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (previewPausedOffscreen && !hasStarted && video.paused) {
              video.play().catch(() => {});
            }
            previewPausedOffscreen = false;
            return;
          }
          if (video.paused) return;
          // Main video → route through pauseVideo so data-state + callbacks fire;
          // muted looping preview → just stop the element.
          if (hasStarted) {
            pauseVideo();
          } else {
            video.pause();
            previewPausedOffscreen = !autoplayOnView;
          }
        });
      },
      { threshold: 0 }
    );
    viewObserver.observe(wrap);
    cleanupHandlers.push(() => viewObserver.disconnect());
  }

  // ── Autoplay on view ────────────────────────────────────────────────────────
  // Start playing (muted) as soon as the video is meaningfully in view: either its
  // vertical center has reached 60% down the viewport, OR its bottom edge is fully
  // on-screen — whichever happens first (tall videos reach the 60% line first; short
  // ones get their bottom on-screen first). These are threshold checks, not a single
  // crossing, so a fast scroll can't skip them. Muted so autoplay isn't blocked; the
  // viewObserver above pauses it once the wrap scrolls out of view.
  // Skipped under prefers-reduced-motion: the (decorative) video stays on its poster.
  if (autoplayOnView && !prefersReducedMotion()) {
    video.muted = true;
    video.playsInline = true;

    const CENTER_TRIGGER = 0.6; // play once the video center reaches 60% down the screen
    let centerRAF = false;

    const evaluateInView = () => {
      centerRAF = false;
      // Once the user has started the full video, playback is theirs — don't
      // restart (and mute) it after they pause.
      if (hasStarted) return;
      if (!video.paused) return; // already playing
      const vh = window.innerHeight || 0;
      if (!vh) return;
      const rect = video.getBoundingClientRect();
      // Ignore when the video is off-screen (esp. scrolled above the top) so it can't
      // be resumed after the viewObserver has paused it out of view.
      if (rect.bottom <= 0 || rect.top >= vh) return;
      const videoCenter = rect.top + rect.height / 2;
      const centerReached = videoCenter <= vh * CENTER_TRIGGER; // center at/above 60%
      const bottomVisible = rect.bottom <= vh; // bottom edge fully on-screen (< 100%)
      if (centerReached || bottomVisible) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    const onViewScroll = () => {
      if (centerRAF) return;
      centerRAF = true;
      requestAnimationFrame(evaluateInView);
    };

    addCleanup(window, 'scroll', onViewScroll, { passive: true });
    addCleanup(window, 'resize', onViewScroll);
    evaluateInView(); // handle already-in-view on load
  }

  wrap._videoPlayer = {
    isPlaying: () => playing,
    isStarted: () => hasStarted,
    deactivate,
  };

  return () => {
    if (isScrubbing) onScrubEnd();
    stopRAF();
    video.pause();
    cleanupHandlers.forEach((fn) => fn());
    unregisterVideoPlayer(registryId);
    wrap.classList.remove('active');
    delete wrap._videoPlayer;
  };
}
