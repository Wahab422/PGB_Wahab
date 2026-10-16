/**
 * Slide Cursor — prev / next indicators that follow the mouse over a
 * carousel and act as its cursor: over the carousel's right half the "next"
 * indicator shows under the pointer, over its left half "prev", and a click
 * slides the carousel that way (the arrow keys' step: direction-aware, wraps
 * at the ends). Over the carousel's links, buttons and dots they hide and the
 * normal pointer is back. Crossing from one half to the other reads as one
 * indicator changing its label: the boxes cross-fade in place while the
 * content slides the way you're heading (to "next": the old label leaves to
 * the left, the new one comes in from the right), with a small dead zone
 * around the middle so a resting hand doesn't flip it back and forth.
 * Or a single "drag" indicator: it shows under the pointer anywhere over the
 * carousel, which you drag to slide (the carousel's own dragging); it shrinks
 * a little while it's held down. Initialised from src/global/index.js on
 * pages that have a [data-slide-cursor].
 *
 * ── Markup (attributes on the Webflow elements) ──────────────────────────────
 *   <section data-tabs-comp>                       ← the scope (the indicators' parent,
 *     <div data-carousel …>…</div>                    or a [data-slide-cursor-scope])
 *     <div data-carousel …>…</div>                 ← every [data-carousel] in the scope
 *     <div class="slider-indicator" data-slide-cursor="next">next [→]</div>
 *     <div class="slider-indicator" data-slide-cursor="prev">[←] Prev</div>
 *   </section>
 *   or, for dragging:
 *   <div data-carousel …>
 *     <div class="slider-indicator" data-slide-cursor="drag"><div>Drag</div></div>
 *     <div data-carousel-wrapper>…</div>
 *   </div>
 * Style the indicators in Webflow, positioned absolute at the scope's top-left
 * (the script moves them with transforms, centred on the pointer). With a
 * "drag" one in the scope, prev / next there are left unused.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Mouse only (a fine pointer that can hover): on touch screens the indicators
 * stay hidden (src/styles/slide-cursor.css) and the carousel is swiped. They
 * are decorative (aria-hidden) — keyboard users have the carousel's arrow
 * keys and dots. Under prefers-reduced-motion they follow without lag and
 * appear without animating. cleanupSlideCursors() restores everything.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  indicator: '[data-slide-cursor]',
  scope: '[data-slide-cursor-scope]',
  carousel: '[data-carousel]',
  // Over these the indicator hides and they work as they are.
  skip: 'a[href], button, input, select, textarea, label, [role="button"], [data-carousel-dots]',
};
// Set on the scope while active — src/styles/slide-cursor.css hides the
// normal pointer over its carousels then.
const READY_ATTR = 'data-slide-cursor-ready';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const MOTION = {
  follow: 0.45, // s, how long the indicator takes to catch up with the pointer
  show: 0.5,
  hide: 0.25,
  hiddenScale: 0.6,
  swap: 0.45, // s, the new label sliding in
  slide: 14, // px the labels travel when swapping
  deadZone: 24, // px either side of the middle where the side doesn't flip
  pressed: 0.85, // the drag indicator's scale while it's held down
};

const instances = [];

function initScope(scope, indicators) {
  const reduced = prefersReducedMotion();
  const byDirection = {
    prev: indicators.find((el) => el.getAttribute('data-slide-cursor') === 'prev'),
    next: indicators.find((el) => el.getAttribute('data-slide-cursor') === 'next'),
    drag: indicators.find((el) => el.getAttribute('data-slide-cursor') === 'drag'),
  };
  // One indicator for the whole carousel, which is dragged rather than clicked.
  const dragging = Boolean(byDirection.drag);
  const carousels = () => [...scope.querySelectorAll(SELECTORS.carousel)];

  // Each indicator follows the pointer in its offset parent's coordinates.
  // The followers are made inside the context so cleanup kills them: they sit
  // paused until the pointer first moves, and a paused tween that never ran
  // survives gsap.killTweensOf() — keeping the whole old page in memory after
  // a Barba page swap.
  const follow = new Map();
  const ctx = gsap.context(() => {
    gsap.set(indicators, {
      xPercent: -50,
      yPercent: -50,
      autoAlpha: 0,
      scale: MOTION.hiddenScale,
      pointerEvents: 'none',
    });
    indicators.forEach((el) => {
      follow.set(el, {
        x: gsap.quickTo(el, 'x', { duration: reduced ? 0 : MOTION.follow, ease: 'expo.out' }),
        y: gsap.quickTo(el, 'y', { duration: reduced ? 0 : MOTION.follow, ease: 'expo.out' }),
      });
    });
  });
  indicators.forEach((el) => el.setAttribute('aria-hidden', 'true'));
  scope.setAttribute(READY_ATTR, '');
  const place = (el, pointer, snap) => {
    const origin = (el.offsetParent || scope).getBoundingClientRect();
    const x = pointer.x - origin.left;
    const y = pointer.y - origin.top;
    const to = follow.get(el);
    if (snap) {
      to.x(x, x);
      to.y(y, y);
    } else {
      to.x(x);
      to.y(y);
    }
  };

  let pointer = null;
  let active = null; // { direction, carousel } under the pointer, or null

  // What's under the pointer: a carousel side to show an indicator for.
  const resolve = (target) => {
    const carousel = target?.closest?.(SELECTORS.carousel);
    if (!carousel || !scope.contains(carousel) || target.closest(SELECTORS.skip)) return null;
    if (dragging) return { direction: 'drag', carousel };
    const rect = carousel.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    let direction = pointer.x < mid ? 'prev' : 'next';
    // Near the middle, keep the side it's on.
    if (active?.carousel === carousel && Math.abs(pointer.x - mid) < MOTION.deadZone) {
      direction = active.direction;
    }
    return byDirection[direction] ? { direction, carousel } : null;
  };

  const contentOf = (el) => [...el.children];
  const show = (el) => {
    gsap.set(contentOf(el), { x: 0, autoAlpha: 1, overwrite: true });
    gsap.to(el, {
      autoAlpha: 1,
      scale: 1,
      duration: reduced ? 0 : MOTION.show,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  };
  // One side to the other: the boxes cross-fade where the old one is (no
  // shrink, so it reads as one box) while the labels slide the way the
  // pointer is heading.
  const swap = (from, to, direction) => {
    const way = direction === 'next' ? 1 : -1;
    const fast = (seconds) => (reduced ? 0 : seconds);
    // The new one starts exactly where the old one is; from there both
    // follow the pointer together (update() keeps placing them).
    const toFollow = follow.get(to);
    const x = Number(gsap.getProperty(from, 'x'));
    const y = Number(gsap.getProperty(from, 'y'));
    toFollow.x(x, x);
    toFollow.y(y, y);
    gsap.to(from, { autoAlpha: 0, duration: fast(0.3), ease: 'power1.out', overwrite: 'auto' });
    gsap.to(contentOf(from), {
      x: -way * MOTION.slide,
      autoAlpha: 0,
      duration: fast(0.22),
      ease: 'power2.in',
      overwrite: 'auto',
    });
    gsap.set(to, { scale: 1 });
    gsap.to(to, { autoAlpha: 1, duration: fast(0.18), ease: 'none', overwrite: 'auto' });
    gsap.fromTo(
      contentOf(to),
      { x: way * MOTION.slide, autoAlpha: 0 },
      {
        x: 0,
        autoAlpha: 1,
        duration: fast(MOTION.swap),
        delay: fast(0.06),
        ease: 'expo.out',
        overwrite: 'auto',
      }
    );
  };
  const hide = (el) =>
    gsap.to(el, {
      autoAlpha: 0,
      scale: MOTION.hiddenScale,
      duration: reduced ? 0 : MOTION.hide,
      ease: 'power2.in',
      overwrite: 'auto',
    });

  const update = (target) => {
    const next = pointer ? resolve(target) : null;
    const was = active?.direction;
    const now = next?.direction;
    active = next;
    if (was && now && was !== now) {
      swap(byDirection[was], byDirection[now], now);
    } else if (now && was !== now) {
      // Coming from nothing: appear right under the pointer.
      const el = byDirection[now];
      if (Number(gsap.getProperty(el, 'opacity')) === 0) place(el, pointer, true);
      show(el);
    } else if (was && !now) {
      hide(byDirection[was]);
    }
    // Everything on screen — the shown one and any still fading out — keeps
    // following the pointer, so a swap never splits into two boxes.
    if (!pointer) return;
    indicators.forEach((el) => {
      if (el === byDirection[now] || Number(gsap.getProperty(el, 'opacity')) > 0) {
        place(el, pointer);
      }
    });
  };

  const onMove = (event) => {
    if (event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    update(event.target);
  };

  // Scrolling moves the page under a still pointer: re-check what's under it.
  let scrollQueued = false;
  const onScroll = () => {
    if (!pointer || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      update(document.elementFromPoint(pointer.x, pointer.y));
    });
  };

  const onLeaveWindow = () => {
    pointer = null;
    update(null);
  };

  // Held down to drag: the drag indicator shrinks a little until let go.
  let held = false;
  const press = (down) => {
    if (held === down) return;
    held = down;
    gsap.to(byDirection.drag, {
      scale: down ? MOTION.pressed : 1,
      duration: reduced ? 0 : down ? 0.3 : 0.45,
      ease: down ? 'power3.out' : 'back.out(3)',
      overwrite: 'auto',
    });
  };
  const onDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (resolve(event.target)?.direction === 'drag') press(true);
  };
  const onUp = () => {
    if (held) press(false);
  };

  // A click on the carousel slides it towards the side its indicator shows.
  const onClick = (event) => {
    if (dragging) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (!pointer) pointer = { x: event.clientX, y: event.clientY };
    const hit = resolve(event.target);
    if (!hit || !carousels().includes(hit.carousel)) return;
    hit.carousel.dispatchEvent(
      new CustomEvent('carousel:step', { detail: { direction: hit.direction === 'next' ? 1 : -1 } })
    );
    if (!reduced) {
      gsap.fromTo(
        byDirection[hit.direction],
        { scale: 0.88 },
        { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' }
      );
    }
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeaveWindow);
  scope.addEventListener('click', onClick);
  if (dragging) {
    scope.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    document.documentElement.removeEventListener('mouseleave', onLeaveWindow);
    scope.removeEventListener('click', onClick);
    scope.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    indicators.forEach((el) => [el, ...el.children].forEach((node) => gsap.killTweensOf(node)));
    ctx.revert();
    indicators.forEach((el) => el.removeAttribute('aria-hidden'));
    scope.removeAttribute(READY_ATTR);
  };
}

/** Wire every scope's [data-slide-cursor] indicators. Safe to call repeatedly. */
export function initSlideCursors() {
  if (typeof document === 'undefined' || instances.length) return;
  if (!window.matchMedia(FINE_POINTER).matches) return;
  const scopes = new Map();
  document.querySelectorAll(SELECTORS.indicator).forEach((el) => {
    const scope = el.closest(SELECTORS.scope) || el.parentElement;
    if (!scope) return;
    if (!scopes.has(scope)) scopes.set(scope, []);
    scopes.get(scope).push(el);
  });
  scopes.forEach((indicators, scope) => instances.push(initScope(scope, indicators)));
}

export function cleanupSlideCursors() {
  instances.splice(0).forEach((cleanup) => cleanup());
}
