/**
 * Resource Entrance — the Resources page ([data-resources]) comes in quietly:
 * the filters, each product's photo, the category labels and the file rows
 * rise a few px and fade in as they first come into view, a few hundredths of
 * a second apart in page order. The headings keep their own split-text rise.
 * Initialised from src/global/index.js on pages that have [data-resources].
 *
 * ── Markup ───────────────────────────────────────────────────────────────────
 * Nothing to add: it uses the attributes the page already has for its filters
 * (src/global/resourceLists.js) —
 *   [fs-list-element="filters"]          ← the filters form: rises
 *   [data-resource-product] img          ← a product's photo: fades
 *   [data-resource-section] h3           ← a category label: rises
 *   [data-resource-id]                   ← a file row: rises
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Hidden until set up (src/styles/resources.css, with a 4s failsafe), then
 * each plays once, the first time it's on screen; those already on screen as
 * the page opens follow its heading in. Rows a filter change brings into view
 * are left to that change's own entrance (resourceLists.js calls
 * markResourceShown()), and rows a filter hides wait until they're shown and
 * scrolled to. Web Animations (as the filter transition), so nothing's left
 * inline. Off under prefers-reduced-motion. cleanupResourceEntrance() shows
 * everything and stops watching.
 */

import { prefersReducedMotion } from '../utils/motion';

const ROOT = '[data-resources]';
const TARGETS = [
  '[fs-list-element="filters"]',
  '[data-resource-product] img',
  '[data-resource-section] h3',
  '[data-resource-id]',
].join();
// On the root once set up: src/styles/resources.css stops hiding the targets.
const READY_ATTR = 'data-resources-entrance';
// On a target not yet seen: kept hidden.
const PENDING_ATTR = 'data-resource-pending';

const MOTION = {
  duration: 600,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  rise: '0.5rem',
  each: 40, // ms between ones coming into view together
  maxStaggered: 8, // later ones share the last delay
  first: 150, // ms: the first screen waits for the heading to start
  rootMargin: '0px 0px -8% 0px',
};

const RISE = [
  { opacity: 0, transform: `translateY(${MOTION.rise})` },
  { opacity: 1, transform: 'none' },
];
const FADE = [{ opacity: 0 }, { opacity: 1 }];

let observer = null;
let root = null;
let animations = [];

/** A target (or one inside `el`) shown by other means: no entrance of its own. */
export function markResourceShown(el) {
  if (!root) return;
  [el, ...el.querySelectorAll(`[${PENDING_ATTR}]`)].forEach((target) => {
    if (!target.hasAttribute(PENDING_ATTR)) return;
    target.removeAttribute(PENDING_ATTR);
    observer?.unobserve(target);
  });
}

export function initResourceEntrance() {
  cleanupResourceEntrance();
  root = document.querySelector(ROOT);
  if (!root) return;
  const targets = Array.from(root.querySelectorAll(TARGETS));
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    root.setAttribute(READY_ATTR, '');
    return;
  }

  let first = true;
  observer = new IntersectionObserver(
    (entries) => {
      const batch = entries
        .filter((entry) => entry.isIntersecting && entry.target.hasAttribute(PENDING_ATTR))
        .map((entry) => entry.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const start = first ? MOTION.first : 0;
      first = false;
      batch.forEach((target, index) => {
        observer.unobserve(target);
        target.removeAttribute(PENDING_ATTR);
        const animation = target.animate(target.matches('img') ? FADE : RISE, {
          duration: MOTION.duration,
          easing: MOTION.easing,
          delay: start + Math.min(index, MOTION.maxStaggered) * MOTION.each,
          fill: 'backwards',
        });
        animations.push(animation);
        animation.finished
          .catch(() => {})
          .then(() => {
            animations = animations.filter((a) => a !== animation);
          });
      });
    },
    { rootMargin: MOTION.rootMargin }
  );
  targets.forEach((target) => {
    target.setAttribute(PENDING_ATTR, '');
    observer.observe(target);
  });
  root.setAttribute(READY_ATTR, '');
}

export function cleanupResourceEntrance() {
  observer?.disconnect();
  observer = null;
  animations.forEach((animation) => animation.cancel());
  animations = [];
  if (!root) return;
  root.removeAttribute(READY_ATTR);
  root.querySelectorAll(`[${PENDING_ATTR}]`).forEach((el) => el.removeAttribute(PENDING_ATTR));
  root = null;
}
