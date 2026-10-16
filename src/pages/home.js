import { safe, getCookie, setCookie } from '../utils/helpers';
import { logger } from '../utils/logger';
import { initRotatingTexts, cleanupRotatingTexts } from '../functions/rotatingTexts';
import { startLenis, stopLenis } from '../global/lenis';
import { prefersReducedMotion } from '../utils/motion';

const cleanupFunctions = [];

const HERO_LOADING_COOKIE = 'scl-hero-loading-shown';
const HERO_LOADING_COOKIE_DAYS = 1;

export async function initHomePage() {
  logger.log('🏠 Home page initialized');

  // Carousels, testimonials and the video players are initialised by the
  // global pass (global/index.js); only home-specific code lives here.
  // One try/catch per feature (safe), so one failing can't disable the others.
  safe(handleLoadingAnimation, 'Home loading animation');
  safe(initHeroVideoLazyLoad, 'Home hero video');
  safe(initRotatingTexts, 'Home rotating texts');
}

export function cleanupHomePage() {
  cleanupRotatingTexts();
  cleanupFunctions.forEach((fn) => fn());
  cleanupFunctions.length = 0;
  // The body outlives a Barba page swap: forget this visit's intro, so the
  // next visit (and other pages' code waiting on it) starts clean.
  document.body.classList.remove('loading-done', 'hero-settled');
  startLenis(); // in case the intro was still holding the scroll
}

function markHeroSettled() {
  document.body.classList.add('hero-settled');
  window.dispatchEvent(new Event('hero:settled'));
}

function handleLoadingAnimation() {
  const container = document.getElementById('hero-lottie');
  if (!container) {
    document.body.classList.add('loading-done');
    markHeroSettled();
    return;
  }
  if (typeof lottie === 'undefined') {
    logger.warn('[Home] Lottie not loaded - skipping hero loading animation');
    document.body.classList.add('loading-done');
    markHeroSettled();
    return;
  }

  if (getCookie(HERO_LOADING_COOKIE)) {
    logger.log('[Home] Skipping hero loading animation (already shown today)');
    document.body.classList.add('loading-done');
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    markHeroSettled();
    setTimeout(() => {
      document.querySelectorAll('[home-hero-text]').forEach((element) => {
        element.removeAttribute('transition-delay');
      });
    }, 1600);
    return;
  }

  const reduceMotion = prefersReducedMotion();
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const isSlowConnection =
    connection &&
    (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType));

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  const isLowPowerDevice = isMobile && navigator.deviceMemory && navigator.deviceMemory <= 4;

  if (reduceMotion || isSlowConnection || isLowPowerDevice) {
    logger.log(
      '[Home] Skipping hero loading animation (reduced motion, slow connection, or low-power device)'
    );
    document.body.classList.add('loading-done');
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    document.querySelectorAll('[home-hero-text]').forEach((element) => {
      element.removeAttribute('transition-delay');
    });
    markHeroSettled();
    return;
  }

  setCookie(HERO_LOADING_COOKIE, '1', HERO_LOADING_COOKIE_DAYS);

  let released = false;
  stopLenis();

  const releaseScroll = () => {
    if (released) return;
    released = true;
    document.body.classList.add('loading-done');
    startLenis();
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    requestAnimationFrame(() => requestAnimationFrame(markHeroSettled));
    setTimeout(() => {
      document.querySelectorAll('[home-hero-text]').forEach((element) => {
        element.removeAttribute('transition-delay');
      });
    }, 2000);
  };

  const PLAYBACK_SPEED = 6017 / 5000; // ≈ 1.2034

  const safetyTimer = setTimeout(() => {
    logger.warn('[Home] Lottie: safety timeout — releasing scroll');
    releaseScroll();
  }, 8000);

  const lottiePath = isMobile
    ? 'https://cdn.prod.website-files.com/6a155cbbc9c28f25a9dcaf1e/6a3a5b2349115c93172989a8_SCL_9x16_data.json'
    : 'https://cdn.prod.website-files.com/6a155cbbc9c28f25a9dcaf1e/6a33b05875caab725ce9db14_data.json';

  const MOBILE_DPR_CEILING = 1.25;
  const nativeDpr = window.devicePixelRatio || 1;
  const dpr = isMobile ? Math.min(nativeDpr * 0.75, MOBILE_DPR_CEILING) : nativeDpr;

  if (isMobile && typeof lottie.setQuality === 'function') {
    lottie.setQuality('medium');
  }

  const anim = lottie.loadAnimation({
    container,
    renderer: 'canvas',
    loop: false,
    autoplay: true,
    path: lottiePath,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
      progressiveLoad: false,
      hideOnTransparent: true,
      dpr,
    },
  });
  anim.setSpeed(PLAYBACK_SPEED);

  const onComplete = () => releaseScroll();
  const onDataFailed = () => {
    logger.error('[Home] Lottie: failed to load JSON');
    releaseScroll();
  };
  anim.addEventListener('complete', onComplete);
  anim.addEventListener('data_failed', onDataFailed);
  anim.addEventListener('DOMLoaded', () => logger.log('[Home] Lottie: loaded'));

  const onResize = () => anim.resize();
  const onOrientationChange = () => setTimeout(() => anim.resize(), 100);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientationChange);

  cleanupFunctions.push(() => {
    clearTimeout(safetyTimer);
    anim.removeEventListener('complete', onComplete);
    anim.removeEventListener('data_failed', onDataFailed);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    anim.destroy();
    if (!released) {
      released = true;
      startLenis();
    }
    document.body.classList.remove('loading-done');
  });
}

function initHeroVideoLazyLoad() {
  const video = document.getElementById('hero-section-video');
  if (!video || !video.dataset.src) return;

  const connection = navigator.connection || {};
  const shouldSkip =
    prefersReducedMotion() ||
    connection.saveData === true ||
    /^(slow-2g|2g)$/.test(connection.effectiveType || '');

  if (shouldSkip) return;

  const start = () => {
    if (video.getAttribute('src')) return;
    video.src = video.dataset.src;
    video.play().catch(() => {});
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && video.getAttribute('src')) {
      video.play().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  cleanupFunctions.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

  let idleHandle = null;
  const schedule = () => {
    if ('requestIdleCallback' in window) {
      idleHandle = requestIdleCallback(start, { timeout: 2000 });
    } else {
      idleHandle = setTimeout(start, 200);
    }
  };

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
    cleanupFunctions.push(() => window.removeEventListener('load', schedule));
  }

  cleanupFunctions.push(() => {
    if (idleHandle === null) return;
    if ('cancelIdleCallback' in window) cancelIdleCallback(idleHandle);
    else clearTimeout(idleHandle);
  });
}
