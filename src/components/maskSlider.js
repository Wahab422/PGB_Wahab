/**
 * Mask Slider Component (Shared Utility)
 * Full-bleed image/video slider with a GSAP "mask reveal" transition.
 * Initialised globally from src/global/index.js — only on pages that contain a
 * [data-mask-slider] (this module itself is loaded on demand).
 *
 * How the reveal works — a counter-translate, not a CSS mask or clip-path:
 * every slide has an overflow:hidden wrapper (.img-wrap) around its media
 * (.img). On a change, one timeline runs four tweens from time 0
 * (dir = 100 forward, -100 backward):
 *   outgoing .img-wrap  xPercent 0     → -dir
 *   outgoing .img       xPercent 0     → +dir
 *   incoming .img-wrap  xPercent +dir  → 0
 *   incoming .img       xPercent -dir  → 0
 * Wrapper and media cancel each other out, so the picture stays put while its
 * edge wipes across like a mask. `parallax` (0–100) scales the media's
 * counter-move: 100 = perfectly still, 50 = the picture drifts as it reveals.
 *
 * Quick start (Webflow markup):
 *   <div data-mask-slider aria-label="Campus gallery"
 *        data-duration="1.1" data-ease="Pagtrans" data-parallax="100" data-initial-index="0">
 *     <div class="slide">
 *       <div class="img-wrap"><img class="img" src="…" alt="…"></div>
 *     </div>
 *     <div class="slide">
 *       <div class="img-wrap"><video class="img" src="…" muted loop playsinline></video></div>
 *     </div>
 *     <!-- Optional: your own controls. Omitted → default buttons are rendered. -->
 *     <button class="btn-prevslide" type="button">Prev</button>
 *     <button class="btn-nextslide" type="button">Next</button>
 *   </div>
 *   Slides are position:absolute, so give your own buttons a position and a
 *   z-index in Webflow or they sit underneath the slides.
 *   .slide can sit inside CMS wrappers (.w-dyn-list / .w-dyn-item). Styles live
 *   in src/styles/mask-slider.css, scoped to [data-mask-slider] so they never
 *   touch Webflow's own .slide / .img classes elsewhere.
 *
 * Quick start (from code — renders the slides itself):
 *   import { createMaskSlider } from '../components/maskSlider';
 *   const slider = createMaskSlider(document.querySelector('#hero-slider'), {
 *     slides: [
 *       { src: 'https://picsum.photos/seed/1/1600/900', alt: 'Hills' },
 *       { src: '/clip.mp4', alt: 'Campus walk', type: 'video' },
 *     ],
 *     duration: 1.1,        // seconds (default 1.1)
 *     ease: 'Pagtrans',     // any GSAP ease (default the "Pagtrans" CustomEase)
 *     parallax: 100,        // % of the counter-move (default 100)
 *     initialIndex: 0,
 *     onChange: (index) => {},
 *     className: 'is-hero', // extra class(es) on the root
 *     label: 'Campus gallery', // aria-label (default "Image slider")
 *   });
 *   slider.next(); slider.prev(); slider.goTo(2); slider.destroy();
 *
 * Driving a markup slider from other code:
 *   getMaskSlider(el) (or el._maskSlider) returns the same instance. Each change
 *   dispatches `maskslider:change` on the root ({ detail: { index, slider } });
 *   `maskslider:ready` fires once after init.
 *
 * Behaviour: next/prev wrap around; goTo(i) picks the direction by comparing
 * i with the current index; input during a transition is ignored; ArrowLeft /
 * ArrowRight work while focus is inside the slider; under
 * prefers-reduced-motion slides switch instantly. The neighbouring slides'
 * media is preloaded. destroy() kills the running timeline, clears the
 * transforms it set and removes everything the slider added to the DOM.
 */

import { gsap } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { maskReveal, PAGTRANS_EASE } from '../utils/maskReveal';
import { prefersReducedMotion } from '../utils/motion';

// The "Pagtrans" CustomEase is registered by utils/maskReveal (shared with
// mask-effect carousels); re-exported here so existing imports keep working.
export { PAGTRANS_EASE };

const ROOT_SELECTOR = '[data-mask-slider]';
const DEFAULTS = {
  duration: 1.1,
  ease: PAGTRANS_EASE,
  parallax: 100,
  initialIndex: 0,
  label: 'Image slider',
};

const instances = new Set();

function numberOr(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Options precedence: JS options → data-attributes → defaults. */
function resolveOptions(root, options) {
  const data = root.dataset;
  return {
    duration: numberOr(options.duration ?? data.duration, DEFAULTS.duration),
    ease: options.ease ?? data.ease ?? DEFAULTS.ease,
    parallax: numberOr(options.parallax ?? data.parallax, DEFAULTS.parallax),
    initialIndex: Math.trunc(
      numberOr(options.initialIndex ?? data.initialIndex, DEFAULTS.initialIndex)
    ),
    label: options.label ?? root.getAttribute('aria-label') ?? DEFAULTS.label,
    onChange: typeof options.onChange === 'function' ? options.onChange : null,
    className: options.className || '',
    slides: Array.isArray(options.slides) ? options.slides : null,
  };
}

function renderSlide({ src, alt = '', type = 'image' }) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  const wrap = document.createElement('div');
  wrap.className = 'img-wrap';

  let media;
  if (type === 'video') {
    media = document.createElement('video');
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'metadata';
    // <video> has no alt; the label keeps the slide's description.
    if (alt) media.setAttribute('aria-label', alt);
  } else {
    media = document.createElement('img');
    media.alt = alt;
    media.decoding = 'async';
    media.loading = 'lazy';
  }
  media.className = 'img';
  media.src = src;

  wrap.appendChild(media);
  slide.appendChild(wrap);
  return slide;
}

function createButton(className, label, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className} mask-slider__btn`;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  return button;
}

/** Fetch a slide's media ahead of time (display:none keeps lazy media idle). */
function preloadSlide(slide) {
  const media = slide?.media;
  if (!media || slide.preloaded) return;
  slide.preloaded = true;
  if (media.tagName === 'IMG') {
    if (media.loading === 'lazy') media.loading = 'eager';
  } else if (media.tagName === 'VIDEO' && media.preload !== 'auto') {
    media.preload = 'auto';
  }
}

function playMedia(slide) {
  const media = slide?.media;
  if (media?.tagName !== 'VIDEO' || prefersReducedMotion()) return;
  const playing = media.play();
  if (playing && typeof playing.catch === 'function') playing.catch(() => {});
}

function pauseMedia(slide) {
  const media = slide?.media;
  if (media?.tagName === 'VIDEO') media.pause();
}

/**
 * Create a mask slider on `root`. Without `options.slides`, the existing
 * .slide > .img-wrap > .img markup inside `root` is used.
 * @param {HTMLElement} root
 * @param {object} [options] - see the header comment
 * @returns {{ next: Function, prev: Function, goTo: Function, destroy: Function,
 *   readonly index: number, readonly length: number, root: HTMLElement } | null}
 */
export function createMaskSlider(root, options = {}) {
  if (!root) return null;
  if (root._maskSlider) return root._maskSlider;

  const config = resolveOptions(root, options);
  const created = []; // nodes this instance added — removed on destroy()
  const addedClasses = ['mask-slider', 'is-ready', ...config.className.split(/\s+/)].filter(
    Boolean
  );
  const addedAttributes = [];
  const setAttr = (el, name, value) => {
    if (el === root && !root.hasAttribute(name)) addedAttributes.push(name);
    el.setAttribute(name, value);
  };

  if (!root.hasAttribute('data-mask-slider')) setAttr(root, 'data-mask-slider', '');

  if (config.slides) {
    config.slides.forEach((data) => {
      const slide = renderSlide(data);
      root.appendChild(slide);
      created.push(slide);
    });
  }

  // Own slides only — skip any nested slider's.
  const slides = Array.from(root.querySelectorAll('.slide'))
    .filter((el) => el.closest(ROOT_SELECTOR) === root)
    .map((el) => {
      const wrap = el.querySelector('.img-wrap');
      const media = wrap && (wrap.querySelector('.img') || wrap.firstElementChild);
      return { el, wrap, media, preloaded: false };
    })
    .filter((slide) => {
      if (slide.wrap && slide.media) return true;
      logger.warn('[MaskSlider] .slide without .img-wrap > .img — skipped:', slide.el);
      return false;
    });

  if (!slides.length) {
    logger.warn('[MaskSlider] No slides found in', root);
    created.forEach((node) => node.remove());
    return null;
  }

  const n = slides.length;
  let current = ((config.initialIndex % n) + n) % n;
  let transitioning = false;
  let activeTimeline = null;
  const allTargets = slides.flatMap((slide) => [slide.wrap, slide.media]);

  // --- Accessibility -------------------------------------------------------
  root.classList.add(...addedClasses);
  setAttr(root, 'role', 'region');
  setAttr(root, 'aria-roledescription', 'carousel');
  setAttr(root, 'aria-label', config.label);
  if (!root.hasAttribute('tabindex')) setAttr(root, 'tabindex', '0');

  slides.forEach((slide, i) => {
    slide.el.setAttribute('role', 'group');
    slide.el.setAttribute('aria-roledescription', 'slide');
    slide.el.setAttribute('aria-label', `${i + 1} of ${n}`);
  });

  const liveRegion = document.createElement('div');
  liveRegion.className = 'mask-slider__status';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  root.appendChild(liveRegion);
  created.push(liveRegion);

  // --- Controls ------------------------------------------------------------
  const findOwn = (selector) =>
    Array.from(root.querySelectorAll(selector)).filter((el) => el.closest(ROOT_SELECTOR) === root);
  let prevButtons = findOwn('.btn-prevslide');
  let nextButtons = findOwn('.btn-nextslide');
  if (!prevButtons.length && !nextButtons.length) {
    const prevButton = createButton('btn-prevslide', 'Previous slide', 'Prev');
    const nextButton = createButton('btn-nextslide', 'Next slide', 'Next');
    root.append(prevButton, nextButton);
    created.push(prevButton, nextButton);
    prevButtons = [prevButton];
    nextButtons = [nextButton];
  } else {
    prevButtons.forEach(
      (b) => b.hasAttribute('aria-label') || b.setAttribute('aria-label', 'Previous slide')
    );
    nextButtons.forEach(
      (b) => b.hasAttribute('aria-label') || b.setAttribute('aria-label', 'Next slide')
    );
  }
  if (n < 2) [...prevButtons, ...nextButtons].forEach((b) => (b.hidden = true));

  // --- State ---------------------------------------------------------------
  function syncState() {
    slides.forEach((slide, i) => {
      const isCurrent = i === current;
      slide.el.setAttribute('aria-hidden', String(!isCurrent));
      slide.el.toggleAttribute('inert', !isCurrent);
    });
    // Nothing is announced on load: the live region gets its first text in
    // the same tick it's inserted, which screen readers don't read out.
    liveRegion.textContent = `Slide ${current + 1} of ${n}`;
    preloadSlide(slides[(current + 1) % n]);
    preloadSlide(slides[(current - 1 + n) % n]);
  }

  function showOnly(...indices) {
    slides.forEach((slide, i) => slide.el.classList.toggle('is-active', indices.includes(i)));
  }

  function finish(prevIndex) {
    const prev = slides[prevIndex];
    prev.el.classList.remove('is-active');
    gsap.set([prev.wrap, prev.media], { xPercent: 0 });
    pauseMedia(prev);
    activeTimeline = null;
    transitioning = false;
  }

  function announceChange() {
    syncState();
    config.onChange?.(current);
    root.dispatchEvent(
      new CustomEvent('maskslider:change', { detail: { index: current, slider: api } })
    );
  }

  function go(targetIndex, dir) {
    if (transitioning || n < 2) return;
    const nextIndex = ((targetIndex % n) + n) % n;
    if (nextIndex === current) return;

    const prevIndex = current;
    const outgoing = slides[prevIndex];
    const incoming = slides[nextIndex];
    current = nextIndex;

    showOnly(prevIndex, nextIndex);
    playMedia(incoming);

    if (prefersReducedMotion() || config.duration <= 0) {
      gsap.set([incoming.wrap, incoming.media], { xPercent: 0 });
      finish(prevIndex);
      announceChange();
      return;
    }

    transitioning = true;
    activeTimeline = maskReveal({
      outgoing,
      incoming,
      direction: dir,
      duration: config.duration,
      ease: config.ease,
      parallax: config.parallax,
      onComplete: () => finish(prevIndex),
    });
    announceChange();
  }

  // --- Events --------------------------------------------------------------
  const onPrev = () => api.prev();
  const onNext = () => api.next();
  const onKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // Leave arrows alone inside form fields.
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') api.prev();
    else api.next();
  };
  prevButtons.forEach((b) => b.addEventListener('click', onPrev));
  nextButtons.forEach((b) => b.addEventListener('click', onNext));
  root.addEventListener('keydown', onKeyDown);

  const api = {
    root,
    get index() {
      return current;
    },
    get length() {
      return n;
    },
    get isTransitioning() {
      return transitioning;
    },
    next() {
      go(current + 1, 100);
    },
    prev() {
      go(current - 1, -100);
    },
    goTo(index) {
      const target = Math.trunc(Number(index));
      if (!Number.isFinite(target)) return;
      const normalized = ((target % n) + n) % n;
      go(normalized, normalized > current ? 100 : -100);
    },
    destroy() {
      // Kill the running timeline (if any) and drop every inline transform, so
      // nothing keeps ticking or leaks after teardown.
      activeTimeline?.kill();
      activeTimeline = null;
      transitioning = false;
      gsap.killTweensOf(allTargets);
      gsap.set(allTargets, { clearProps: 'transform' });
      prevButtons.forEach((b) => b.removeEventListener('click', onPrev));
      nextButtons.forEach((b) => b.removeEventListener('click', onNext));
      root.removeEventListener('keydown', onKeyDown);
      slides.forEach(({ el }) => {
        el.classList.remove('is-active');
        ['role', 'aria-roledescription', 'aria-label', 'aria-hidden', 'inert'].forEach((a) =>
          el.removeAttribute(a)
        );
      });
      created.forEach((node) => node.remove());
      addedAttributes.forEach((name) => root.removeAttribute(name));
      root.classList.remove(...addedClasses);
      delete root._maskSlider;
      instances.delete(api);
    },
  };

  showOnly(current);
  syncState();
  playMedia(slides[current]);

  root._maskSlider = api;
  instances.add(api);
  root.dispatchEvent(new CustomEvent('maskslider:ready', { detail: { slider: api } }));
  return api;
}

/** Instance for a root element, or null. */
export function getMaskSlider(root) {
  return root?._maskSlider || null;
}

/** Enhance every [data-mask-slider] on the page. Safe to call repeatedly. */
export function initMaskSliders() {
  document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
    try {
      createMaskSlider(root);
    } catch (error) {
      logger.error('[MaskSlider] Failed to initialize:', error);
    }
  });
}

export function cleanupMaskSliders() {
  Array.from(instances).forEach((instance) => instance.destroy());
}
