import {
  ensureCarouselInitialized,
  getCarouselAutoplayControls,
  getCarouselElementFromRoot,
} from '../components/carousel';

const SLIDER_ROOT_SELECTOR = '#testimonial-slider';

let autoplayControls = null;
let attachedCarousel = null;
let onSlideChangeHandler = null;
// While true, ALL setup paths are blocked — a hero intro is still locking scroll,
// and initializing the fade carousel then makes it collapse to a single snap.
// Cleared on `hero:settled` (see initTestimonialsCustomSlider).
let awaitingHeroSettle = false;
let initialized = false;
const cleanupFunctions = [];

function resolveSliderRoot() {
  return document.querySelector(SLIDER_ROOT_SELECTOR);
}

function isSliderVisible(root) {
  if (!root?.isConnected) return false;

  let node = root;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    node = node.parentElement;
  }

  const rect = root.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function stopTestimonialVideos() {
  document.querySelectorAll('#testimonial-slider-elements [video-element-wrap]').forEach((wrap) => {
    if (wrap._videoPlayer?.isStarted?.()) {
      wrap._videoPlayer.deactivate();
    }
  });
}

function resumeTestimonialAutoplay() {
  autoplayControls?.resume?.();
}

function pauseTestimonialAutoplay() {
  autoplayControls?.suspend?.();
}

function syncTestimonialSide(activeIndex) {
  document
    .querySelectorAll('#testimonial-slider-imgs [testimonial-slider-img]')
    .forEach((img, index) => {
      img.classList.toggle('active', index === activeIndex);
    });

  document
    .querySelectorAll('#testimonial-slider-elements [testimonial-slider-element]')
    .forEach((element, index) => {
      element.classList.toggle('active', index === activeIndex);
    });
}

function detachCarouselHandlers() {
  if (attachedCarousel && onSlideChangeHandler) {
    attachedCarousel.off('select', onSlideChangeHandler);
  }
  attachedCarousel = null;
  onSlideChangeHandler = null;
  autoplayControls = null;
}

function attachToCarousel(carousel, sliderRoot) {
  const carouselEl = getCarouselElementFromRoot(sliderRoot) || sliderRoot;
  autoplayControls = getCarouselAutoplayControls(carouselEl);

  if (attachedCarousel === carousel) {
    // Fade-family carousels (data-carousel-effect="fade" / "mask") stack their slides;
    // an Embla reInit there would re-measure them stacked and collapse to one
    // snap (carousel.js re-measures them itself).
    const isFade = ['fade', 'mask'].includes(carouselEl?.getAttribute('data-carousel-effect'));
    if (!isFade) carousel.reInit?.();
    // Setup re-runs on every intersection, resize and tab change. Only re-sync
    // the side panel here — the full slide-change handler also stops the
    // testimonial videos, which reset one that was playing.
    syncTestimonialSide(carousel.selectedScrollSnap());
    return;
  }

  detachCarouselHandlers();

  onSlideChangeHandler = () => {
    stopTestimonialVideos();
    syncTestimonialSide(carousel.selectedScrollSnap());
  };

  onSlideChangeHandler();
  carousel.on('select', onSlideChangeHandler);
  attachedCarousel = carousel;
}

async function setupTestimonialSlider() {
  // Blocked until the hero intro's scroll lock lifts — see awaitingHeroSettle.
  if (awaitingHeroSettle) return;
  const sliderRoot = resolveSliderRoot();
  if (!sliderRoot || !isSliderVisible(sliderRoot)) return;

  const carousel = await ensureCarouselInitialized(sliderRoot);
  if (!carousel) return;

  attachToCarousel(carousel, sliderRoot);
}

function scheduleSetup() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setupTestimonialSlider();
    });
  });
}

export function initTestimonialsCustomSlider() {
  const sliderRoot = resolveSliderRoot();
  if (!sliderRoot) return;
  // Called from the global pass (global/index.js); a second call would attach
  // every observer and listener twice.
  if (initialized) return;
  initialized = true;

  // Block ALL setup paths while a hero intro is still locking scroll. Initializing
  // the fade carousel while Lenis is stopped (html overflow:hidden) makes it
  // measure a single snap — and the lock itself fires a resize on the slider,
  // which would otherwise trigger setup through the ResizeObserver below. We only
  // unblock on `hero:settled` (fired after scroll is released and the layout
  // reflows). Pages with no intro set up immediately.
  const introPending =
    !!document.getElementById('hero-lottie') && !document.body.classList.contains('hero-settled');
  if (introPending) {
    awaitingHeroSettle = true;
    const onHeroSettled = () => {
      awaitingHeroSettle = false;
      scheduleSetup();
    };
    window.addEventListener('hero:settled', onHeroSettled, { once: true });
    cleanupFunctions.push(() => window.removeEventListener('hero:settled', onHeroSettled));
  } else {
    scheduleSetup();
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        scheduleSetup();
      }
    },
    { root: null, rootMargin: '200px', threshold: 0 }
  );
  intersectionObserver.observe(sliderRoot);
  cleanupFunctions.push(() => intersectionObserver.disconnect());

  const onTabChange = (event) => {
    const panel = event.detail?.panel;
    if (panel?.contains(sliderRoot)) {
      scheduleSetup();
    }
  };
  document.addEventListener('tabs:change', onTabChange);
  cleanupFunctions.push(() => document.removeEventListener('tabs:change', onTabChange));

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      if (isSliderVisible(sliderRoot)) {
        scheduleSetup();
      }
    });
    resizeObserver.observe(sliderRoot);
    cleanupFunctions.push(() => resizeObserver.disconnect());
  }
}

export function getTestimonialVideoCallbacks(wrap) {
  if (!wrap.closest('#testimonial-slider-elements')) return {};

  return {
    onPlay: pauseTestimonialAutoplay,
    onPause: resumeTestimonialAutoplay,
    onEnded: resumeTestimonialAutoplay,
  };
}

export function cleanupTestimonialsCustomSlider() {
  initialized = false;
  awaitingHeroSettle = false;
  detachCarouselHandlers();
  cleanupFunctions.splice(0).forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // ignore cleanup errors
    }
  });
}
