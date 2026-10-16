/**
 * Marquee — an endless horizontal row (logos, words…) that runs on its own,
 * turns around with the scroll direction and drifts sideways as the page
 * scrolls past it. Initialised from src/global/index.js on pages that have a
 * [data-marquee-scroll-direction-target].
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <div data-marquee-scroll-direction-target class="marquee"     ← wrapper + options
 *        data-marquee-speed="15" data-marquee-direction="right"
 *        data-marquee-scroll-speed="5" data-marquee-duplicate="2">
 *     <div data-marquee-scroll-target class="marquee__scroll">     ← drifts with the scroll
 *       <div data-marquee-collection-target class="marquee__collection">
 *         …logos / items…                                           ← the content, copied
 *       </div>
 *     </div>
 *   </div>
 *
 * ── Options (on the wrapper) ─────────────────────────────────────────────────
 *   data-marquee-speed="20"            seconds for a row one screen wide to pass
 *                                      once (longer rows take proportionally
 *                                      longer, so the pace stays the same); on
 *                                      tablets / phones it runs 2× / 4× quicker,
 *                                      keeping roughly the same px per second
 *   data-marquee-direction="left"      "left" (default) or "right"
 *   data-marquee-scroll-speed="5"      % of the wrapper's width the row drifts
 *                                      either way as the page scrolls past
 *                                      (default 0 — no drift)
 *   data-marquee-duplicate="2"         at least this many copies of the
 *                                      collection; more are added when a wide
 *                                      screen needs them to stay gap-free
 *   data-marquee-scroll-direction="false"  keep one direction — don't turn
 *                                      around when scrolling up
 *   data-marquee-pause-on-hover        ease to a stop under the pointer
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The row runs in its direction while the page scrolls down (and at rest), and
 * eases round to the opposite direction while it scrolls up. The loop is
 * seamless: the copies are identical and it wraps by exactly one copy's width.
 * Speed, drift and the number of copies are re-measured on resize, without the
 * loop jumping. It only runs while on screen. Copies are hidden from screen
 * readers and their links / buttons skipped by Tab (aria-hidden, tabindex -1),
 * so the content is read once — but they stay clickable. The wrapper gets data-marquee-status="normal" / "inverted" (which
 * way it's running) for styling, e.g. an arrow. Under prefers-reduced-motion
 * the row stands still: no loop, no drift, no copies. cleanupMarquees() stops
 * everything, removes the copies and restores the authored inline styles.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  root: '[data-marquee-scroll-direction-target]',
  scroll: '[data-marquee-scroll-target]',
  collection: '[data-marquee-collection-target]',
};
// Set once a wrapper is initialised — scopes the injected CSS.
const READY_ATTR = 'data-marquee-ready';
// Marks the copies this script adds (not data-marquee-clone: carousel.js's
// marquee mode uses that for its own clones).
const COPY_ATTR = 'data-marquee-copy';
const STATUS_ATTR = 'data-marquee-status';
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const DEFAULT_SPEED = 20;
// Seconds to ease round when the scroll direction changes / to stop on hover.
const TURN_DURATION = 0.6;

const CSS_TEXT = `
[${READY_ATTR}] ${SELECTORS.scroll} {
  display: flex;
  will-change: transform;
}
[${READY_ATTR}] ${SELECTORS.collection} {
  flex: none;
  will-change: transform;
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-marquee-style', 'true');
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

function readNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

// Tablets / phones run quicker, which keeps the px-per-second pace close to
// desktop's on a narrower screen.
function breakpointScale() {
  if (window.innerWidth < 479) return 0.25;
  if (window.innerWidth < 991) return 0.5;
  return 1;
}

const instances = new Map();

function initMarquee(wrapper, gsap, ScrollTrigger) {
  const scroll = wrapper.querySelector(SELECTORS.scroll);
  const collection = scroll?.querySelector(SELECTORS.collection);
  if (!scroll || !collection) {
    logger.warn(
      '[Marquee] needs [data-marquee-scroll-target] > [data-marquee-collection-target] — skipped:',
      wrapper
    );
    return null;
  }

  const { dataset } = wrapper;
  const speed = Math.max(0.1, readNumber(dataset.marqueeSpeed, DEFAULT_SPEED));
  // +1 = runs left, -1 = runs right.
  const baseDirection = dataset.marqueeDirection === 'right' ? -1 : 1;
  const drift = Math.max(0, readNumber(dataset.marqueeScrollSpeed, 0));
  const minCopies = Math.max(0, Math.floor(readNumber(dataset.marqueeDuplicate, 0)));
  const followScroll = dataset.marqueeScrollDirection !== 'false';
  const pauseOnHover = 'marqueePauseOnHover' in dataset;

  const authoredScrollStyle = scroll.getAttribute('style');
  const copies = [];
  let items = [collection];
  let setX = null;
  let duration = 1;
  // How far along one copy's width the row is, 0 → 1.
  let offset = 0;
  let running = false;
  // Signed pace: 1 = full speed left, -1 = full speed right, 0 = stopped.
  const pace = { value: baseDirection };
  let heading = baseDirection;
  const cleanups = [];

  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  // The scroll row is widened by the drift on both sides so drifting never
  // shows its edge.
  if (drift) {
    scroll.style.marginLeft = `${-drift}%`;
    scroll.style.width = `${100 + drift * 2}%`;
  }

  // Enough copies that the row stays covered at every point of the loop and
  // the drift: the items sit one copy to the left (covering the wrapper's left
  // edge), so the row needs to reach the screen's right edge with a copy to
  // spare.
  const ensureCopies = () => {
    const width = collection.offsetWidth;
    if (!width) return;
    const rowLeft = wrapper.getBoundingClientRect().left - (drift * 2 * wrapper.offsetWidth) / 100;
    const needed = Math.max(minCopies, Math.ceil((window.innerWidth - rowLeft) / width) + 1);
    if (copies.length >= needed) return;
    const fragment = document.createDocumentFragment();
    while (copies.length < needed) {
      const copy = collection.cloneNode(true);
      copy.setAttribute(COPY_ATTR, '');
      // Read once, tabbed once — but still clickable (not inert): most of the
      // row on screen is copies, and logos are often links.
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll(FOCUSABLE).forEach((el) => el.setAttribute('tabindex', '-1'));
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copies.push(copy);
      fragment.appendChild(copy);
    }
    scroll.appendChild(fragment);
    items = [collection, ...copies];
    setX = gsap.quickSetter(items, 'xPercent');
  };

  const measure = () => {
    ensureCopies();
    duration = speed * (collection.offsetWidth / window.innerWidth) * breakpointScale() || 1;
  };

  const render = () => setX?.(-100 * (1 + offset));

  const setHeading = (direction) => {
    heading = direction;
    wrapper.setAttribute(STATUS_ATTR, direction === baseDirection ? 'normal' : 'inverted');
  };

  // ── The loop ────────────────────────────────────────────────────────────────
  const tick = (time, deltaTime) => {
    if (!running || !pace.value) return;
    // Clamp the step so a long frame (tab switch) doesn't jump the row.
    const step = (Math.min(deltaTime, 100) / 1000 / duration) * pace.value;
    offset = (((offset + step) % 1) + 1) % 1;
    render();
  };

  const easePaceTo = (value) =>
    gsap.to(pace, { value, duration: TURN_DURATION, ease: 'power2.out', overwrite: true });

  let hovered = false;
  const turn = (direction) => {
    if (direction === heading) return;
    setHeading(direction);
    if (!hovered) easePaceTo(direction);
  };

  const ctx = gsap.context(() => {
    measure();
    render();
    setHeading(baseDirection);

    // Runs only while on screen; turns round with the scroll direction.
    ScrollTrigger.create({
      trigger: wrapper,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        running = self.isActive;
      },
      onUpdate: (self) => {
        if (followScroll) turn(self.direction === 1 ? baseDirection : -baseDirection);
      },
      onRefresh: (self) => {
        measure();
        render();
        running = self.isActive;
      },
    });

    // Sideways drift with the scroll, in px of the wrapper's width.
    if (drift) {
      const shift = () => (drift / 100) * wrapper.offsetWidth * baseDirection;
      gsap.fromTo(
        scroll,
        { x: () => shift() },
        {
          x: () => -shift(),
          ease: 'none',
          scrollTrigger: {
            trigger: wrapper,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    }
  }, wrapper);

  gsap.ticker.add(tick);

  if (pauseOnHover) {
    listen(wrapper, 'mouseenter', () => {
      hovered = true;
      easePaceTo(0);
    });
    listen(wrapper, 'mouseleave', () => {
      hovered = false;
      easePaceTo(heading);
    });
  }

  wrapper.setAttribute(READY_ATTR, '');

  return () => {
    gsap.ticker.remove(tick);
    gsap.killTweensOf(pace);
    cleanups.forEach((fn) => fn());
    ctx.revert();
    gsap.set(collection, { clearProps: 'transform' });
    copies.forEach((copy) => copy.remove());
    if (authoredScrollStyle === null) scroll.removeAttribute('style');
    else scroll.setAttribute('style', authoredScrollStyle);
    wrapper.removeAttribute(READY_ATTR);
    wrapper.removeAttribute(STATUS_ATTR);
  };
}

/** Wire every marquee under `root`. Safe to call repeatedly. */
export function initMarquees(root = document) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  injectStyles();
  root.querySelectorAll(SELECTORS.root).forEach((wrapper) => {
    if (instances.has(wrapper)) return;
    const cleanup = initMarquee(wrapper, gsap, ScrollTrigger);
    if (cleanup) instances.set(wrapper, cleanup);
  });
}

export function cleanupMarquees() {
  instances.forEach((cleanup) => cleanup());
  instances.clear();
}
