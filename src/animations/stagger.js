/**
 * Stagger In — a container's items rise in one after another as they scroll
 * into view, as the rest of the site's items do (24px, 1s, power3.out, 0.12s
 * apart): [data-stagger-in] on a grid or list, on any page. A picture card (an
 * item an image fills) rises the same way, its image settling from a touch of
 * zoom. Started on every page from handleGlobalAnimation() in
 * components/gsap.js.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="solutions-grid" data-stagger-in=".solution-card">  ← these items
 *   <div class="list" data-stagger-in>                             ← its children
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-stagger-in=".card"          which items (a CSS selector inside it);
 *                                    empty: its direct children
 *   data-stagger-in-each="0.12"      seconds between items
 *   data-stagger-in-delay="0.1"      seconds before the first one
 *   data-stagger-in-from="start"     where the stagger starts: start, center,
 *                                    end, edges, random
 *   data-stagger-in-start="top 90%"  when an item plays (ScrollTrigger start)
 *   data-stagger-in-order="2"        on items: play them in this order (ascending)
 *                                    instead of the page's, all together when
 *                                    the container comes into view; items
 *                                    without it go last
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The container is hidden until its items are set up (src/styles/
 * stagger-in.css, with a 4s failsafe; a page with one on its first screen
 * keeps the same rule in its head code), so they don't show and then vanish
 * to rise in — e.g. through a page transition's opening window. Items that
 * come into view together (a grid row) stagger; each row as it's scrolled
 * to. Ones the page opened already scrolled past still play. Items added
 * later (CMS load more, filters) rise in the same way. Left alone inside a
 * modal. Under prefers-reduced-motion nothing is hidden or moved.
 * cleanupStaggerIns() restores the authored inline styles.
 * The original name, anim-stagger, still works.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { debounce } from '../utils/helpers';
import { prefersReducedMotion } from '../utils/motion';
import { restingPosition } from '../utils/scrollPosition';
import { requestScrollRefresh } from '../utils/scrollRefresh';
import { readNumber } from '../utils/section';

const ATTR = 'data-stagger-in';
const LEGACY_ATTR = 'anim-stagger';
const SELECTOR = `[${ATTR}], [${LEGACY_ATTR}]`;
const SKIP = '[data-modal-name]';
// Set once its items are set up: src/styles/stagger-in.css hides the
// container until then (the legacy name, for pages published with the
// previous head code).
const READY_ATTR = 'data-stagger-in-ready';
const LEGACY_READY = 'data-anim-stagger-ready';
const ORDER_ATTR = 'data-stagger-in-order';

const MOTION = { y: 60, duration: 1, ease: 'power3.out', each: 0.17, delay: 0.1, start: 'top 90%' };
const CARD = { zoom: 1.06, settle: 1.6, ease: 'expo.out' };

const instances = new Map();

const option = (container, name) => container.getAttribute(`${ATTR}-${name}`);

function settings(container) {
  return {
    each: readNumber(option(container, 'each'), MOTION.each),
    delay: readNumber(option(container, 'delay'), MOTION.delay),
    from: option(container, 'from') || 'start',
    start: option(container, 'start') || MOTION.start,
  };
}

// Its items: the selector's matches inside it, else its direct children.
function itemsOf(container) {
  const raw = (container.getAttribute(ATTR) ?? container.getAttribute(LEGACY_ATTR) ?? '').trim();
  const selector = raw === 'true' ? '' : raw;
  if (selector) {
    try {
      return Array.from(container.querySelectorAll(selector));
    } catch {
      // not a valid selector: its children, below
    }
  }
  return Array.from(container.children);
}

// A picture card's image: one filling the item.
function cardImage(item) {
  const box = item.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  return (
    Array.from(item.querySelectorAll('img, video')).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width >= box.width * 0.9 && r.height >= box.height * 0.9;
    }) || null
  );
}

const orderOf = (item) =>
  item.hasAttribute(ORDER_ATTR) ? readNumber(item.getAttribute(ORDER_ATTR), Infinity) : Infinity;

function initContainer(container) {
  const s = settings(container);
  const seen = new WeakSet();
  const images = new WeakMap();

  // Waiting: lowered and hidden (a picture card's image a touch zoomed).
  const prepare = (items) =>
    items.forEach((item) => {
      seen.add(item);
      const image = cardImage(item);
      if (image) {
        images.set(item, image);
        gsap.set(image, { scale: CARD.zoom });
      }
      gsap.set(item, { autoAlpha: 0, y: MOTION.y });
    });

  // In, one after another (`from` sets where the stagger starts).
  const reveal = (batch, from) => {
    const offset = gsap.utils.distribute({ each: s.each, from });
    const timeline = gsap.timeline({ delay: s.delay });
    batch.forEach((item, i) => {
      const at = offset(i, item, batch);
      timeline.to(
        item,
        {
          autoAlpha: 1,
          y: 0,
          duration: MOTION.duration,
          ease: MOTION.ease,
          clearProps: 'opacity,visibility,transform',
        },
        at
      );
      const image = images.get(item);
      if (image) {
        timeline.to(
          image,
          { scale: 1, duration: CARD.settle, ease: CARD.ease, clearProps: 'transform' },
          at
        );
      }
    });
  };

  // end: 'max', so items the page opened already scrolled past still play.
  const watch = (items) => {
    if (!items.length) return;
    prepare(items);
    // Ordered: all together, in their order, when the container comes in.
    if (items.some((item) => item.hasAttribute(ORDER_ATTR))) {
      // Sort is stable: equal orders keep the page's order.
      const ordered = [...items].sort((a, b) => orderOf(a) - orderOf(b));
      ScrollTrigger.create({
        trigger: container,
        start: s.start,
        end: 'max',
        once: true,
        onEnter: () => ctx.add(() => reveal(ordered, 'start')),
      });
      return;
    }
    items.forEach((item) => {
      ScrollTrigger.create({
        trigger: item,
        start: restingPosition(item, s.start),
        end: 'max',
        once: true,
        onEnter: () => queue(item),
      });
    });
  };

  // Items whose triggers fire together (a grid row, a fast scroll) play as
  // one staggered group, in the page's order.
  let pending = [];
  const flush = () => {
    const batch = pending.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    pending = [];
    // Recorded in the context, so cleanup stops it mid-play.
    ctx.add(() => reveal(batch, s.from));
  };
  const queue = (item) => {
    if (!pending.length) gsap.delayedCall(0, flush);
    pending.push(item);
  };

  const ctx = gsap.context(() => watch(itemsOf(container)));
  container.setAttribute(READY_ATTR, '');
  if (container.hasAttribute(LEGACY_ATTR)) container.setAttribute(LEGACY_READY, '');

  // Items added later (CMS load more, filters).
  const observer =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(
          debounce(() => {
            const added = itemsOf(container).filter((item) => !seen.has(item));
            if (!added.length) return;
            ctx.add(() => watch(added));
            requestScrollRefresh();
          }, 100)
        );
  observer?.observe(container, { childList: true, subtree: true });

  return () => {
    observer?.disconnect();
    ctx.revert();
  };
}

/** Wire every [data-stagger-in] on the page. Safe to call repeatedly. */
export function initStaggerIns() {
  if (typeof document === 'undefined') return;
  const reduce = prefersReducedMotion();
  document.querySelectorAll(SELECTOR).forEach((container) => {
    if (instances.has(container) || container.closest(SKIP)) return;
    if (reduce) {
      container.setAttribute(READY_ATTR, '');
      return;
    }
    instances.set(container, initContainer(container));
  });
}

export function cleanupStaggerIns() {
  instances.forEach((cleanup) => cleanup());
  instances.clear();
}
