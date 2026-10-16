/**
 * Section Video Player (Shared Utility)
 * Hero-style video section with overlay curtain animation, scrubbing, and toggle controls.
 * Not global: import only on pages that render [video-section].
 *
 * Quick start:
 * 1) import { initSectionVideoPlayer, cleanupSectionVideoPlayer } from '../functions/sectionVideoPlayer';
 * 2) await initSectionVideoPlayer(); // after DOM ready
 * 3) Markup (inside [video-section]):
 *    - .video-element — <video>
 *    - .video-overlay, .video-overlay-text
 *    - .video-controls-overlay with [video-toggle-btn]
 *    - .video-controls, [video-controls-progress], .video-controls-progress-line
 *    - .video-control-side (first/last) with .style-h3 and .video-control-divider
 *    - [video-toggle-btn] on overlay and/or controls
 *    - [video-return-btn] (optional) — returns to the overlay/preview state
 *    - [data-zoom] (optional, on [video-section] itself) — opts IN to the
 *      shrink-on-scroll-into-view / expand-on-leave zoom effect. Off by
 *      default: without it the wrap stays at its authored CSS size regardless
 *      of scroll or play state.
 *    - [no-autoplay] (optional, on [video-section] itself) — don't auto-play the
 *      muted looping preview; it loads paused on its first frame / poster until
 *      the user clicks a [video-toggle-btn].
 *
 * Behavior:
 * - If data-looping-video-src is set: plays muted looped preview until first play click.
 * - If no data-looping-video-src: shows poster only until first play click.
 * - Poster fallback: if the .video-element has no [poster], the src of an
 *   img[data-poster-sub] in the section is used as the poster.
 * - First play runs GSAP overlay wipe, unmutes, disables loop, shows bottom controls.
 * - No fullscreen takeover: the wrap plays in place at its authored CSS size on
 *   play/pause — no viewport pin, no nav/banner hide, no scroll lock. (The takeover
 *   code still exists internally, gated behind a hardcoded skipFullscreen = true,
 *   in case a specific section needs it reinstated later.)
 * - [video-return-btn] reverses the wipe: overlay animates back in, bottom controls
 *   animate out, and the video returns to its initial preview/poster state. If the
 *   section is in native fullscreen (see videoFullscreen.js — [video-fullscreen-btn]),
 *   the return button leaves fullscreen first and only then reverses the wipe.
 */

import { ensureGSAPLoaded } from '../components/gsap';
import { stopLenis, startLenis } from '../global/lenis';
import { exitVideoFullscreenFor } from './videoFullscreen';
import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';
import {
  registerVideoPlayer,
  unregisterVideoPlayer,
  pauseOtherPlayers,
} from '../utils/videoPlayerRegistry';
// Webflow authors these controls as plain divs, not <button>/<a> — see
// utils/controlA11y.js (shared with the regular and list players).
import { enhanceControlA11y, activateOnEnterOrSpace, toggleLabelFor } from '../utils/controlA11y';
import { prefersReducedMotion } from '../utils/motion';

const ROOT_SELECTOR = '[video-section]';
const instances = new Map();

export async function initSectionVideoPlayer(options = {}) {
  if (typeof document === 'undefined') {
    logger.warn('[SectionVideoPlayer] document is undefined (SSR) - skipping init.');
    return () => {};
  }

  const sections =
    options.rootElements ||
    Array.from(document.querySelectorAll(options.rootSelector || ROOT_SELECTOR));

  if (!sections.length) {
    logger.info('[SectionVideoPlayer] No [video-section] found - nothing to initialize.');
    return () => {};
  }

  try {
    await ensureGSAPLoaded();
  } catch (error) {
    handleError(error, 'Section Video Player GSAP');
    return () => {};
  }

  const gsap = window.gsap;
  if (!gsap) {
    logger.warn('[SectionVideoPlayer] GSAP not available after load.');
    return () => {};
  }

  let initializedCount = 0;
  const addedSections = new Set();

  sections.forEach((section) => {
    if (instances.has(section)) return;
    const cleanup = createSectionVideoPlayerInstance(section, gsap);
    if (cleanup) {
      instances.set(section, cleanup);
      addedSections.add(section);
      initializedCount += 1;
    }
  });

  if (initializedCount > 0) {
    logger.log(
      `[SectionVideoPlayer] Ready (${initializedCount} instance${initializedCount > 1 ? 's' : ''})`
    );
  }

  return () => {
    addedSections.forEach((section) => {
      const cleanup = instances.get(section);
      if (cleanup) {
        try {
          cleanup();
        } catch (error) {
          handleError(error, 'Section Video Player Cleanup');
        }
        instances.delete(section);
      }
    });
    addedSections.clear();
  };
}

export function cleanupSectionVideoPlayer() {
  instances.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      handleError(error, 'Section Video Player Cleanup');
    }
  });
  instances.clear();
}

function createSectionVideoPlayerInstance(videoSection, gsap) {
  const video = videoSection.querySelector('.video-element');
  if (!video) {
    logger.warn('[SectionVideoPlayer] Missing .video-element inside section.', videoSection);
    return null;
  }

  const loopingSrc = video.dataset.loopingVideoSrc;
  const hasLoopingSrc = typeof loopingSrc === 'string' && loopingSrc.trim() !== '';
  const originalSrc = video.getAttribute('src');

  // Poster fallback: if the video has no authored [poster], borrow the src of an
  // img[data-poster-sub] in the section (a still exported alongside the video).
  // This becomes the initial frame for poster-only and [no-autoplay] previews.
  if (!video.getAttribute('poster')) {
    const posterSub = videoSection.querySelector('img[data-poster-sub]');
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
  // Zoom (shrink-on-view / expand-on-leave) is OFF by default; [data-zoom] on
  // the [video-section] opts in. The wrap otherwise holds its authored CSS size.
  const zoomEnabled = videoSection.hasAttribute('data-zoom');
  // [no-autoplay]: don't auto-play the muted looping preview on load (or when
  // returning to the preview state). The preview stays loaded but paused on its
  // first frame / poster; the user starts playback via [video-toggle-btn].
  // prefers-reduced-motion is treated the same way: no moving preview loop,
  // just the poster / first frame until the user presses play.
  const noAutoplay = videoSection.hasAttribute('no-autoplay') || prefersReducedMotion();

  const allToggleBtns = videoSection.querySelectorAll('[video-toggle-btn]');
  const returnBtns = videoSection.querySelectorAll('[video-return-btn]');

  // Fullscreen takeover disabled site-wide — every [video-section] just
  // plays in place at its authored size on play/pause, no viewport pin, no
  // portal, no nav/banner hide, no scroll lock. All the takeover code below
  // is kept (skipFullscreen gates every bit of it) rather than deleted, in
  // case this needs to come back for a specific section later.
  const skipFullscreen = true;
  const videoOverlay = videoSection.querySelector('.video-overlay');
  const videoControlsOverlay = videoSection.querySelector('.video-controls-overlay');
  const overlayText = videoSection.querySelector('.video-overlay-text');
  const videoControls = videoSection.querySelector('.video-controls');
  const videoControlsTop = videoSection.querySelector('.video-controls-top');
  const progressBar = videoSection.querySelector('[video-controls-progress]');
  const progressLine = videoSection.querySelector('.video-controls-progress-line');
  const controlDivs = videoControls
    ? Array.from(videoControls.querySelectorAll(':scope > div'))
    : [];
  const timeDisplay =
    controlDivs.find(
      (d) =>
        !d.hasAttribute('video-controls-progress') &&
        !d.hasAttribute('video-toggle-btn') &&
        d.children.length === 0
    ) || null;

  const leftH3 = videoSection.querySelector('.video-control-side:first-child .style-h3');
  const leftDivider = videoSection.querySelector(
    '.video-control-side:first-child .video-control-divider'
  );
  const rightH3 = videoSection.querySelector('.video-control-side:last-child .style-h3');
  const rightDivider = videoSection.querySelector(
    '.video-control-side:last-child .video-control-divider'
  );
  const overlayToggleBtn = videoSection.querySelector('.video-controls-overlay [video-toggle-btn]');

  // The wrap sized to fill its parent in CSS (e.g. 100vw/100vh, or 100% of a
  // fixed-height parent). Prefer an explicit .video-wrap, else fall back to the
  // section root itself. Its full size is measured from the parent — see
  // getFullSize() — so the zoom works for either sizing model.
  const videoWrap = videoSection.querySelector('.video-wrap') || videoSection;
  // The wrap's authored border-radius (from CSS). Shown while shrunk (preview),
  // animated to 0 while full screen.
  const wrapBaseRadius = videoWrap ? getComputedStyle(videoWrap).borderRadius : '0px';

  let progressRAF = null;
  let isScrubbing = false;
  let hasStarted = false;
  // Bumped by every play request, pause and return. A play() promise that
  // settles after a newer one of those is stale and ignored — otherwise a slow
  // first play resolving after Return marked the preview "playing" and started
  // a progress loop that never stopped.
  let playToken = 0;
  let overlayTimeline = null;
  let isShrunk = false;
  let viewObserver = null;
  let isFullscreen = false;
  // While fullscreen, the wrap is portaled up to .page (so position:fixed anchors
  // to the viewport regardless of ancestor transforms); this holds its home slot.
  let fsPlaceholder = null;
  // Full-viewport black layer behind the (video-sized) wrap, so the letterbox area
  // stays black instead of showing the page.
  let fsBackdrop = null;
  // Last known intrinsic aspect ratio (w/h). Cached so a src swap that momentarily
  // zeroes videoWidth/videoHeight can't collapse the fit math.
  let lastAspect = 0;

  const cleanupHandlers = [];
  // Only yield to other players when the main video is active — the muted
  // looping preview should keep playing regardless of what else starts.
  const registryId = registerVideoPlayer(() => {
    if (hasStarted && !video.paused) pauseVideo();
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

  // ————— Wrap resize on scroll-into-view / play —————
  // Preview (in view): wrap shrinks so it's inset 2rem on all sides.
  // Playing: wrap grows back to the full 100vw/100vh the CSS defines.

  function getRemPx() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }

  // The wrap's full (un-shrunk) size follows its CSS box. That may be 100vw/100vh
  // or, just as often, "fill a fixed-height parent" (width/height: 100%). Measure
  // the parent's content box so the zoom math tracks the actual layout instead of
  // assuming the viewport — the two differ whenever the parent isn't exactly the
  // viewport size. Reading the parent (not the wrap) also keeps this immune to the
  // wrap's own inline width/height that shrink/expand set.
  function getFullSize() {
    const parent = videoWrap.parentElement;
    if (!parent) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const cs = getComputedStyle(parent);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return {
      width: Math.max(0, parent.clientWidth - padX),
      height: Math.max(0, parent.clientHeight - padY),
    };
  }

  // Inset per side: 2rem on desktop, 1.5rem on mobile.
  const MOBILE_BREAKPOINT = 767;
  function getShrunkSize() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const inset = getRemPx() * (isMobile ? 1.5 : 2);
    const { width, height } = getFullSize();
    return {
      width: Math.max(0, width - inset * 2),
      height: Math.max(0, height - inset * 2),
    };
  }

  function shrinkWrap() {
    if (!videoWrap || isShrunk || !zoomEnabled) return;
    isShrunk = true;
    const { width, height } = getShrunkSize();
    // Shrunk (preview): restore the authored corner radius.
    gsap.to(videoWrap, {
      width,
      height,
      borderRadius: wrapBaseRadius,
      duration: 0.8,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  function expandWrap() {
    if (!videoWrap || !isShrunk) return;
    isShrunk = false;
    // Animate to the full (parent-driven) size, then hand sizing back to the CSS
    // so it stays responsive at full size. Full screen => no radius.
    const { width, height } = getFullSize();
    gsap.to(videoWrap, {
      width,
      height,
      borderRadius: 0,
      duration: 0.8,
      ease: 'power3.out',
      overwrite: 'auto',
      onComplete: () => gsap.set(videoWrap, { clearProps: 'width,height' }),
    });
  }

  function onWindowResize() {
    if (!videoWrap) return;
    // Keep the fullscreen wrap fitted + centered across resizes.
    if (isFullscreen) {
      const box = getFullscreenBox();
      gsap.set(videoWrap, {
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      });
      return;
    }
    // Keep the shrunk (preview) size correct across viewport changes.
    if (!isShrunk) return;
    const { width, height } = getShrunkSize();
    gsap.set(videoWrap, { width, height });
  }

  // ————— Fullscreen playback: fixed viewport takeover —————
  // On first play the wrap is pinned to the full viewport (position:fixed) and the
  // video switches to object-fit:contain, so the whole frame shows — filling width
  // or height, whichever the aspect ratio allows — over a black backdrop. Page
  // scroll is locked (Lenis) and the navbar + banner are hidden for the duration.
  // Pausing keeps the takeover up; only returnToOverlay tears it down.
  const FULLSCREEN_Z = 'calc(var(--_z-indices---modal) + 1)';
  const BACKDROP_Z = 'var(--_z-indices---modal)';

  function setNavHideLock(locked) {
    window.dispatchEvent(new CustomEvent('nav:hide-lock', { detail: { locked } }));
  }
  function setBannerHidden(hidden) {
    window.dispatchEvent(new CustomEvent('nav:banner', { detail: { hidden } }));
  }

  // The wrap's fullscreen box: fit the video's intrinsic aspect ratio into the
  // viewport (fill width OR height, whichever the ratio allows) and center it, so
  // the wrap hugs the video exactly. If the video aspect (w/h) is wider than the
  // viewport, width = innerWidth; otherwise height = innerHeight — the other side
  // follows the ratio. Falls back to the viewport ratio (→ full fill) until the
  // intrinsic size is known.
  function getFullscreenBox() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (video.videoWidth && video.videoHeight) {
      lastAspect = video.videoWidth / video.videoHeight;
    }
    const ar = lastAspect || vw / vh;
    let width;
    let height;
    if (ar > vw / vh) {
      width = vw;
      height = vw / ar;
    } else {
      height = vh;
      width = vh * ar;
    }
    return { width, height, top: (vh - height) / 2, left: (vw - width) / 2 };
  }

  // Grow the wrap out to fill the viewport. Pin it (fixed) at its current on-screen
  // box, then animate top/left/width/height to the fitted box. Animating the box
  // (not a CSS transform) keeps the video from warping — object-fit re-fits the
  // frame every frame — while the wrap eases open over the black backdrop.
  function enterFixedFullscreen() {
    if (!videoWrap || isFullscreen) return;
    isFullscreen = true;
    const first = videoWrap.getBoundingClientRect();
    const portalTarget = document.querySelector('.page') || document.body;

    // Portal the wrap up to .page (fallback body) so position:fixed resolves
    // against the viewport even if an ancestor establishes a containing block
    // (transform/filter/will-change/etc.). A same-size placeholder keeps the
    // wrap's layout slot so it returns to the exact spot on exit, and the page
    // doesn't collapse while the wrap is out of flow. Moving a playing <video> in
    // the DOM doesn't interrupt playback. Pinning fixed at `first` happens in the
    // same task as the move, so there's no flash at the portal target.
    if (videoWrap.parentElement && videoWrap.parentElement !== portalTarget) {
      fsPlaceholder = document.createElement('div');
      fsPlaceholder.setAttribute('data-video-fullscreen-placeholder', '');
      fsPlaceholder.style.width = `${first.width}px`;
      fsPlaceholder.style.height = `${first.height}px`;
      videoWrap.parentElement.insertBefore(fsPlaceholder, videoWrap);
      portalTarget.appendChild(videoWrap);
    }

    // Full-viewport backdrop behind the (video-sized) wrap, so the letterbox area
    // shows the theme heading color instead of the page.
    fsBackdrop = document.createElement('div');
    fsBackdrop.setAttribute('data-video-fullscreen-backdrop', '');
    fsBackdrop.style.cssText = `position:fixed;inset:0;background:var(--_theme---text-heading);z-index:${BACKDROP_Z};pointer-events:none;`;
    portalTarget.appendChild(fsBackdrop);
    gsap.fromTo(fsBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });

    gsap.set(videoWrap, {
      position: 'fixed',
      top: first.top,
      left: first.left,
      width: first.width,
      height: first.height,
      // Override any authored max-width/height so the fitted box can actually reach
      // the viewport size (a max-width was silently capping the "fullscreen" width).
      maxWidth: 'none',
      maxHeight: 'none',
      margin: 0,
      overwrite: 'auto',
    });
    // z-index via a CSS var (set inline — GSAP coerces zIndex numerically, which
    // would mangle the var() string). clearProps 'zIndex' still strips it on exit.
    videoWrap.style.zIndex = FULLSCREEN_Z;
    video.style.objectFit = 'contain';
    const box = getFullscreenBox();
    gsap.to(videoWrap, {
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
      borderRadius: 0,
      duration: 0.7,
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
  }

  // Shrink the wrap back into the page. Clear the fixed box for a single
  // synchronous read of where it lands in normal flow, re-pin it fullscreen, then
  // animate down to that box. The measure + re-pin happen in the same frame, so
  // there's no visible flash. onDone runs once the wrap has settled home.
  function exitFixedFullscreen(onDone) {
    if (!videoWrap || !isFullscreen) {
      onDone?.();
      return;
    }
    isFullscreen = false;
    gsap.killTweensOf(videoWrap);
    // The placeholder still holds the wrap's home slot, so its box is exactly where
    // the wrap should land. The wrap is already fixed at its fitted box — animate
    // straight to the home slot, then move it back into the DOM and drop the
    // placeholder + backdrop.
    const target = fsPlaceholder
      ? fsPlaceholder.getBoundingClientRect()
      : videoWrap.getBoundingClientRect();
    if (fsBackdrop) {
      gsap.to(fsBackdrop, { opacity: 0, duration: 0.4, ease: 'power2.in' });
    }
    gsap.to(videoWrap, {
      top: target.top,
      left: target.left,
      width: target.width,
      height: target.height,
      borderRadius: wrapBaseRadius,
      duration: 0.6,
      ease: 'power3.inOut',
      overwrite: 'auto',
      onComplete: () => {
        restoreWrapHome();
        removeFsBackdrop();
        gsap.set(videoWrap, {
          clearProps:
            'position,top,left,width,height,maxWidth,maxHeight,margin,zIndex,backgroundColor',
        });
        video.style.objectFit = '';
        onDone?.();
      },
    });
  }

  // Move the wrap back into its original slot (before the placeholder) and remove
  // the placeholder. No-op if it was never portaled.
  function restoreWrapHome() {
    if (fsPlaceholder && fsPlaceholder.parentElement) {
      fsPlaceholder.parentElement.insertBefore(videoWrap, fsPlaceholder);
      fsPlaceholder.remove();
    }
    fsPlaceholder = null;
  }

  // Drop the black backdrop. No-op if there wasn't one.
  function removeFsBackdrop() {
    if (fsBackdrop) {
      gsap.killTweensOf(fsBackdrop);
      fsBackdrop.remove();
      fsBackdrop = null;
    }
  }

  // Enter the takeover: lock scroll, hide navbar + banner, grow the wrap to fill
  // the viewport.
  function enterPlaybackChrome() {
    if (skipFullscreen) return;
    setNavHideLock(true);
    setBannerHidden(true);
    stopLenis();
    enterFixedFullscreen();
  }
  // Exit the takeover: unlock scroll, restore navbar + banner, shrink the wrap back
  // into the page. onDone runs once the wrap has animated home.
  function exitPlaybackChrome(onDone) {
    if (skipFullscreen) {
      onDone?.();
      return;
    }
    startLenis();
    setNavHideLock(false);
    setBannerHidden(false);
    exitFixedFullscreen(onDone);
  }

  function animateOverlayOut() {
    // The overlay toggle scales away over ~0.3s and is display:none after —
    // inert right away so Tab can't land on it mid-animation.
    setInert([videoOverlay, videoControlsOverlay], true);
    if (!videoOverlay) return null;

    overlayTimeline?.kill();
    const tl = gsap.timeline({
      onComplete: () => gsap.set(videoOverlay, { display: 'none' }),
    });

    if (overlayText) {
      tl.to(overlayText, {
        clipPath: 'inset(0 0 100% 0)',
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
      });
    }

    tl.to(
      [leftH3, rightH3].filter(Boolean),
      {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        stagger: 0.06,
      },
      '<0.08'
    );

    if (leftDivider) {
      tl.to(
        leftDivider,
        {
          clipPath: 'inset(0 100% 0 0)',
          opacity: 0,
          duration: 0.45,
          ease: 'power3.in',
        },
        '<'
      );
    }

    if (rightDivider) {
      tl.to(
        rightDivider,
        {
          clipPath: 'inset(0 0 0 100%)',
          opacity: 0,
          duration: 0.45,
          ease: 'power3.in',
        },
        '<'
      );
    }

    if (overlayToggleBtn) {
      tl.to(
        overlayToggleBtn,
        {
          scale: 0,
          opacity: 0,
          duration: 0.3,
          ease: 'back.in(2)',
        },
        '<0.05'
      );
    }

    if (videoControlsOverlay) {
      tl.to(
        videoControlsOverlay,
        {
          clipPath: 'inset(100% 0 0 0)',
          opacity: 0,
          duration: 0.4,
          ease: 'power3.in',
        },
        '<0.08'
      );
    }

    tl.to(
      videoOverlay,
      {
        opacity: 0,
        duration: 0.25,
      },
      '-=0.15'
    );

    overlayTimeline = tl;
    return tl;
  }

  // Hidden control groups are only faded (opacity) — inert takes their
  // role="button" controls out of the Tab order and AT tree while invisible.
  const setInert = (elements, inert) =>
    elements.filter(Boolean).forEach((el) => {
      el.inert = inert;
    });

  // Keyboard users pressing play on the overlay toggle (or return in the
  // controls) would otherwise be left on a control that just vanished — move
  // focus to its counterpart, but only if focus was inside this section.
  const focusFirstToggleIn = (container) => {
    const btn = container?.querySelector('[video-toggle-btn], [video-return-btn]');
    btn?.focus({ preventScroll: true });
  };

  function animateControlsIn() {
    const targets = [videoControls, videoControlsTop].filter(Boolean);
    if (!targets.length) return;
    setInert(targets, false);
    gsap.set(targets, { pointerEvents: 'auto' });
    gsap.fromTo(
      targets,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.2 }
    );
  }

  function animateControlsOut() {
    const targets = [videoControls, videoControlsTop].filter(Boolean);
    if (!targets.length) return;
    setInert(targets, true);
    gsap.set(targets, { pointerEvents: 'none' });
    gsap.to(targets, {
      opacity: 0,
      y: 10,
      duration: 0.3,
      ease: 'power2.in',
    });
  }

  // Reverse of animateOverlayOut: restores every overlaid element to full
  // opacity and its un-wiped clip-path. Undoes the display:none that
  // animateOverlayOut sets on completion before fading the overlay back in.
  function animateOverlayIn() {
    setInert([videoOverlay, videoControlsOverlay], false);
    if (!videoOverlay) return null;

    overlayTimeline?.kill();
    gsap.set(videoOverlay, { display: '', opacity: 0 });

    const tl = gsap.timeline();

    tl.to(videoOverlay, { opacity: 1, duration: 0.25 });

    if (videoControlsOverlay) {
      tl.to(
        videoControlsOverlay,
        {
          clipPath: 'inset(0 0% 0 0)',
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
        },
        '<'
      );
    }

    if (overlayToggleBtn) {
      tl.to(
        overlayToggleBtn,
        {
          scale: 1,
          opacity: 1,
          duration: 0.3,
          ease: 'back.out(2)',
        },
        '<0.05'
      );
    }

    if (leftDivider) {
      tl.to(
        leftDivider,
        {
          clipPath: 'inset(0 0% 0 0)',
          opacity: 1,
          duration: 0.45,
          ease: 'power3.out',
        },
        '<'
      );
    }

    if (rightDivider) {
      tl.to(
        rightDivider,
        {
          clipPath: 'inset(0 0% 0 0)',
          opacity: 1,
          duration: 0.45,
          ease: 'power3.out',
        },
        '<'
      );
    }

    tl.to(
      [leftH3, rightH3].filter(Boolean),
      {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        stagger: 0.06,
      },
      '<0.08'
    );

    if (overlayText) {
      tl.to(
        overlayText,
        {
          clipPath: 'inset(0 0% 0 0)',
          opacity: 1,
          duration: 0.35,
          ease: 'power2.out',
        },
        '<0.08'
      );
    }

    overlayTimeline = tl;
    return tl;
  }

  function startFullVideo() {
    if (hasStarted) return;
    hasStarted = true;
    const focusWasInSection = videoSection.contains(document.activeElement);

    pauseOtherPlayers(registryId);

    video.loop = false;
    video.muted = false;
    video.src = originalSrc;
    video.currentTime = 0;

    setBtnsState('loading');

    // Take over the viewport (fixed, object-fit:contain), lock scroll, and hide
    // the navbar + banner while it plays.
    enterPlaybackChrome();

    animateOverlayOut();
    animateControlsIn();
    if (focusWasInSection) focusFirstToggleIn(videoControls || videoControlsTop);

    const token = ++playToken;
    video
      .play()
      .then(() => {
        if (token !== playToken) return;
        setBtnsState('playing');
        startRAF();
      })
      .catch(() => {
        if (token !== playToken) return;
        // The full video couldn't start (bad source, network): go back to the
        // preview instead of leaving a black box with a play icon.
        rollBackToPreview();
      });
  }

  function playVideo() {
    pauseOtherPlayers(registryId);
    setBtnsState('loading');
    // Still inside the fullscreen takeover (pausing keeps it up) — just resume.
    const token = ++playToken;
    video
      .play()
      .then(() => {
        if (token !== playToken) return;
        setBtnsState('playing');
        startRAF();
      })
      .catch(() => {
        if (token !== playToken) return;
        setBtnsState('paused');
      });
  }

  function pauseVideo() {
    playToken += 1;
    video.pause();
    setBtnsState('paused');
    stopRAF();
  }

  function toggleVideo() {
    if (!hasStarted) {
      startFullVideo();
      return;
    }
    video.paused ? playVideo() : pauseVideo();
  }

  function startPreview() {
    if (hasLoopingSrc && !noAutoplay) {
      video.loop = true;
      video.muted = true;
      video.src = loopingSrc;
      video.removeAttribute('poster');
      video.currentTime = 0;
      video.play().catch(() => {});
    } else if (hasLoopingSrc) {
      // no-autoplay: load the preview but leave it paused; keep the poster (if
      // any) as the still frame until the user starts playback.
      video.loop = true;
      video.muted = true;
      video.src = loopingSrc;
      video.currentTime = 0;
    } else {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  // reloadPreview: rebuild the preview from scratch instead of reusing the
  // loaded full video (used when that video failed, so it can't be reused).
  function returnToOverlay({ reloadPreview = false } = {}) {
    if (!hasStarted) return;
    hasStarted = false;
    playToken += 1;
    const focusWasInSection = videoSection.contains(document.activeElement);

    stopRAF();
    // Tear down the takeover: unlock scroll, restore the navbar + banner, and
    // animate the wrap back into the page. For [data-zoom] sections, re-shrink to
    // the preview inset once the wrap has landed.
    isShrunk = false;
    exitPlaybackChrome(() => {
      if (zoomEnabled) shrinkWrap();
    });
    animateControlsOut();
    animateOverlayIn();
    if (focusWasInSection) focusFirstToggleIn(videoControlsOverlay || videoOverlay);

    setBtnsState('paused');
    setProgress(0);

    if (hasLoopingSrc && !reloadPreview) {
      // Reuse the already-loaded video so the preview shows instantly:
      // rewind + mute + loop the current source instead of reloading the
      // preview clip (a src swap blanks the frame and flashes the section bg).
      video.loop = true;
      video.muted = true;
      video.currentTime = 0;
      // [no-autoplay] / reduced motion: the full video was playing — stop it,
      // or it carries on (muted, looping) behind the overlay.
      if (noAutoplay) video.pause();
      else video.play().catch(() => {});
    } else {
      // Poster-only sections have no decoded frame to keep, so reload to poster.
      startPreview();
    }
  }

  // Native fullscreen (videoFullscreen.js) pins the wrap to the viewport, so the
  // return wipe has to wait for the browser to collapse back out of it —
  // animating the overlay in against the fullscreen box lands it in the wrong
  // place once the viewport snaps back. No-ops (runs returnToOverlay straight
  // away) when this section isn't fullscreen.
  function onReturnClick() {
    exitVideoFullscreenFor(videoSection, () => returnToOverlay());
  }

  function rollBackToPreview() {
    exitVideoFullscreenFor(videoSection, () => returnToOverlay({ reloadPreview: true }));
  }

  function onVideoEnded() {
    stopRAF();
    setBtnsState('paused');
    setProgress(100);
    // Stay in the fullscreen takeover on the last frame; [video-return-btn] exits.
  }

  function onVideoPaused() {
    if (hasStarted) {
      setBtnsState('paused');
      stopRAF();
      // Pausing keeps the takeover up; only [video-return-btn] tears it down.
    }
  }

  function onVideoWaiting() {
    if (hasStarted) setBtnsState('loading');
  }

  function onVideoCanPlay() {
    if (!video.paused && hasStarted) setBtnsState('playing');
  }

  // Also covers playback resumed outside the page's own controls — media
  // keys, picture-in-picture, the OS media panel — and resuming after a stall.
  function onVideoPlaying() {
    if (!hasStarted) return;
    pauseOtherPlayers(registryId);
    setBtnsState('playing');
    startRAF();
  }

  // The full video's source failed (network, unsupported file): back to the
  // preview. Errors on the preview itself just leave the poster showing.
  function onVideoError() {
    if (!hasStarted) return;
    logger.error('[SectionVideoPlayer] Video failed to load:', video.error, videoSection);
    playToken += 1;
    rollBackToPreview();
  }

  function onLoadedMetadata() {
    setTime(video.duration);
    if (video.videoWidth && video.videoHeight) {
      lastAspect = video.videoWidth / video.videoHeight;
    }
    // If a src swap finished mid-takeover, re-fit the wrap to the now-known aspect.
    if (isFullscreen && videoWrap) {
      const box = getFullscreenBox();
      gsap.to(videoWrap, {
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }
  }

  const controlsGroup = [videoControls, videoControlsTop].filter(Boolean);
  if (controlsGroup.length) {
    gsap.set(controlsGroup, { opacity: 0, pointerEvents: 'none' });
    setInert(controlsGroup, true);
  }

  gsap.set([leftDivider, rightDivider, overlayText, videoControlsOverlay].filter(Boolean), {
    clipPath: 'inset(0 0% 0 0)',
  });

  allToggleBtns.forEach((btn) => {
    btn.setAttribute('data-state', 'paused');
    enhanceControlA11y(btn, 'Play video');
    addCleanup(btn, 'click', toggleVideo);
    addCleanup(btn, 'keydown', activateOnEnterOrSpace);
  });

  returnBtns.forEach((btn) => {
    enhanceControlA11y(btn, 'Return to preview');
    addCleanup(btn, 'click', onReturnClick);
    addCleanup(btn, 'keydown', activateOnEnterOrSpace);
  });

  if (progressBar) {
    addCleanup(progressBar, 'mousedown', onScrubStart);
    addCleanup(progressBar, 'touchstart', onScrubStart, { passive: true });
  }

  addCleanup(video, 'ended', onVideoEnded);
  addCleanup(video, 'pause', onVideoPaused);
  addCleanup(video, 'waiting', onVideoWaiting);
  addCleanup(video, 'canplay', onVideoCanPlay);
  addCleanup(video, 'playing', onVideoPlaying);
  addCleanup(video, 'error', onVideoError);
  addCleanup(video, 'loadedmetadata', onLoadedMetadata);

  // ————— Init: looping preview or poster only —————

  startPreview();

  // On load the wrap is full screen: ease its authored corner radius down to 0.
  // (If it's already in view, the observer below re-shrinks it and the radius
  // animates back in.) Zoom-only — without [data-zoom] the wrap keeps its
  // authored radius, since nothing ever animates it back.
  if (videoWrap && zoomEnabled) {
    gsap.to(videoWrap, {
      borderRadius: 0,
      duration: 0.8,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  // In preview: shrink when the wrap enters view, expand back to full when it
  // leaves. Once the full video is playing, playback owns the sizing.
  // Only wired for [data-zoom] sections (opt-in).
  if (videoWrap && zoomEnabled && typeof IntersectionObserver !== 'undefined') {
    // Observe a stable ancestor, NOT the wrap itself. The callback resizes the
    // wrap, so observing the element being resized makes its own intersection
    // ratio recompute and flip the state forever (shrink → ratio drops below the
    // threshold → expand → ratio rises → shrink …). It's worst in portrait,
    // where the ~100vh wrap sits right on the threshold and the mobile URL bar
    // nudges it constantly. The closest .section has a stable layout box, so its
    // intersection only changes with real scrolling.
    const zoomTarget =
      videoSection.closest('.section') || (videoWrap !== videoSection ? videoSection : videoWrap);
    viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (hasStarted) return;
          if (entry.isIntersecting) shrinkWrap();
          else expandWrap();
        });
      },
      { threshold: 0.6 }
    );
    viewObserver.observe(zoomTarget);
  }

  addCleanup(window, 'resize', onWindowResize);

  return () => {
    if (isScrubbing) onScrubEnd();
    stopRAF();
    overlayTimeline?.kill();
    viewObserver?.disconnect();
    if (videoWrap) gsap.killTweensOf(videoWrap);
    // If we tore down mid-playback, unlock scroll, restore the navbar/banner, and
    // strip any fixed-fullscreen styles left on the wrap. Instances that skipped
    // the takeover (modal / no return button) never entered it, nothing to undo.
    if (hasStarted && !skipFullscreen) {
      startLenis();
      setNavHideLock(false);
      setBannerHidden(false);
      restoreWrapHome();
      removeFsBackdrop();
      if (videoWrap) {
        gsap.set(videoWrap, {
          clearProps:
            'position,top,left,width,height,maxWidth,maxHeight,margin,zIndex,backgroundColor',
        });
      }
      video.style.objectFit = '';
      isFullscreen = false;
    }
    video.pause();
    cleanupHandlers.forEach((fn) => fn());
    unregisterVideoPlayer(registryId);
  };
}
