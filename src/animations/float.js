/**
 * Float — an element drifts past the page as it scrolls by, trailing the
 * scroll slightly so it feels like it has weight: [data-float] on anything
 * (an image frame, a card). Two neighbours with different amounts, or one
 * floating and one not, slide past each other and read as depth. Started on
 * every page from handleGlobalAnimation() in components/gsap.js.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="fig" data-float>…</div>          ← drifts up 90px either side
 *   <div class="fig" data-float="-60">…</div>    ← drifts down 60px either side
 *   <div class="projects-grid">                  ← blocks side by side:
 *     <div class="project-block" data-float="auto">…</div>   ← left column  → drifts up
 *     <div class="project-block" data-float="auto">…</div>   ← right column → drifts down
 *   </div>
 *   (or a CMS list, each block in its own item — the list is what they're
 *   side by side in)
 *   <div class="project-block" data-float="-40 200">…</div>  ← one per column:
 *                                    left drifts down 40px, right up 200px
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-float="90"        px the element travels either side of its place;
 *                          positive drifts up (faster than the page), negative
 *                          drifts down (slower). Default 90.
 *   data-float="auto"      the direction comes from the element's column among
 *                          the other auto floats beside it (in its parent, or
 *                          the nearest ancestor holding more): the left column
 *                          drifts up, the right one down, so neighbours slide
 *                          past each other; a centred or full-width element, or
 *                          a single column (the layout stacking), stays put.
 *                          Re-read on every refresh (resize, breakpoint).
 *   data-float-amount="60" px either side for data-float="auto". Default 60.
 *   data-float="-40 200"   one number per column, from the left — for blocks
 *                          side by side that share one attribute (a CMS list's
 *                          items), grouped as for auto. Any further columns
 *                          take the last number; a single column stays put.
 *                          Re-read on every refresh.
 *   data-float-lag="0.8"   seconds the drift takes to catch up with the scroll
 *                          (0 = locked to the scroll). Default 0.8.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The element sits in its Webflow position when its centre is at the centre
 * of the screen. Its range is measured from where it rests (utils/
 * scrollPosition.js), so its own movement never shifts it. It never drifts
 * further down than the room left below it in its section — the next section
 * would paint over it — keeping its full travel, shifted up instead. Inside a
 * position: sticky section (e.g. "Built for purpose", which pins while the
 * next section slides over it) the element instead floats up and settles into
 * place as the section arrives, finishing as it pins — drifting on while
 * pinned would slide it over the pinned content (the statement). Works
 * alongside [data-reveal-image] on the same frame (this moves the frame, the
 * reveal clips it and moves the image inside). Desktop and tablet only
 * (768px+): on phones layouts stack and a drifting element would run into the
 * next one. Off under prefers-reduced-motion. cleanupFloats() restores the
 * authored inline styles.
 */

import { gsap } from '../utils/gsapCore';
import { layoutTop, restingPosition } from '../utils/scrollPosition';

const SELECTOR = '[data-float]';
const DEFAULT_AMOUNT = 90;
const AUTO = 'auto';
const DEFAULT_AUTO_AMOUNT = 60;
// An auto float whose centre is this close to its parent's centre (as a share
// of the parent's width) counts as centred — no column, no float.
const CENTRE_TOLERANCE = 0.05;
const DEFAULT_LAG = 0.8;
const WHEN = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';

let media = null;

function readNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

// The nearest ancestor that pins with position: sticky, if any.
function stickyAncestor(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
}

const isAuto = (el) => el.getAttribute('data-float')?.trim() === AUTO;

// data-float="-40 200": its numbers, one per column; null for a single amount.
function columnAmounts(el) {
  const numbers = (el.getAttribute('data-float') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number.parseFloat);
  return numbers.length > 1 && numbers.every(Number.isFinite) ? numbers : null;
}

const byColumn = (el) => isAuto(el) || !!columnAmounts(el);

// The column floats laid out alongside el, and the element they're laid out
// in: the nearest ancestor holding more than one — its parent, or for a CMS
// list (each block alone in its own .w-dyn-item) the list.
function columnGroup(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const group = Array.from(node.querySelectorAll(SELECTOR)).filter(byColumn);
    if (group.length > 1 || node.matches('section')) return { container: node, group };
  }
  return { container: el.parentElement, group: [el] };
}

// The left edges of the group's columns, left to right; one in a single
// column (the layout stacking). Only horizontal positions are read, which the
// vertical drift doesn't change.
function columnLefts(group) {
  const lefts = [];
  group.forEach((other) => {
    const left = other.getBoundingClientRect().left;
    if (!lefts.some((seen) => Math.abs(seen - left) < 1)) lefts.push(left);
  });
  return lefts.sort((a, b) => a - b);
}

// data-float="auto": 1 (drifts up) in the left column, -1 (down) in the right,
// 0 centred, full-width or in a single column.
function sideOf(el, container, group) {
  const box = container.getBoundingClientRect();
  if (columnLefts(group).length < 2 || !box.width) return 0;
  const own = el.getBoundingClientRect();
  const offset = (own.left + own.width / 2 - (box.left + box.width / 2)) / box.width;
  if (Math.abs(offset) < CENTRE_TOLERANCE) return 0;
  return offset < 0 ? 1 : -1;
}

// data-float="-40 200": the number for el's column, counted from the left (the
// last number for any further columns); 0 in a single column.
function columnPick(el, group, amounts) {
  const lefts = columnLefts(group);
  if (lefts.length < 2) return 0;
  const own = el.getBoundingClientRect().left;
  const column = lefts.findIndex((left) => Math.abs(left - own) < 1);
  return amounts[Math.min(Math.max(column, 0), amounts.length - 1)];
}

function addFloat(el) {
  const auto = isAuto(el);
  const columns = columnAmounts(el);
  const fixed = readNumber(el.getAttribute('data-float'), DEFAULT_AMOUNT);
  if (!auto && !columns && !fixed) return;
  const autoAmount = Math.abs(
    readNumber(el.getAttribute('data-float-amount'), DEFAULT_AUTO_AMOUNT)
  );
  const lag = Math.max(0, readNumber(el.getAttribute('data-float-lag'), DEFAULT_LAG));
  // px either side: positive drifts up, negative down, 0 stays put. Re-read on
  // every refresh, as a column float's column changes with the layout.
  const amount = () => {
    if (!auto && !columns) return fixed;
    const { container, group } = columnGroup(el);
    return auto ? sideOf(el, container, group) * autoAmount : columnPick(el, group, columns);
  };
  const section = el.closest('section');
  const sticky = stickyAncestor(el);

  // How far down the element may go: never past the bottom of its section
  // (layout positions, so the drift doesn't skew them).
  const lowest = (travel) => {
    const room = section
      ? layoutTop(section) + section.offsetHeight - (layoutTop(el) + el.offsetHeight)
      : Infinity;
    return Math.min(travel, Math.max(0, room));
  };

  // Scroll positions: the element's top reaching the bottom of the screen, and
  // its sticky ancestor pinning (its top reaching its own sticky `top`).
  const entersAt = () => layoutTop(el) - window.innerHeight;
  const pinsAt = () => layoutTop(sticky) - (Number.parseFloat(getComputedStyle(sticky).top) || 0);

  if (sticky && pinsAt() > entersAt()) {
    // Inside a sticky section: settle into place as the section arrives,
    // finishing as it pins. Drifting on through the pinned part would slide
    // the element over the content pinned above / below it.
    gsap.fromTo(
      el,
      {
        y: () => {
          const signed = amount();
          return signed > 0 ? lowest(signed) : signed;
        },
      },
      {
        y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: entersAt,
          end: pinsAt,
          scrub: lag || true,
          invalidateOnRefresh: true,
        },
      }
    );
    return;
  }

  // [from, to] y: 2 × travel, never further down than lowest().
  const range = () => {
    const signed = amount();
    if (!signed) return [0, 0];
    const travel = Math.abs(signed);
    const low = lowest(travel);
    const high = low - 2 * travel;
    // Drifting up = low on the way in, high on the way out; down the reverse.
    return signed > 0 ? [low, high] : [high, low];
  };

  gsap.fromTo(
    el,
    { y: () => range()[0] },
    {
      y: () => range()[1],
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: restingPosition(el, 'top bottom'),
        end: restingPosition(el, 'bottom top'),
        scrub: lag || true,
        invalidateOnRefresh: true,
      },
    }
  );
}

/** Wire every [data-float] on the page. Safe to call repeatedly. */
export function initFloats() {
  if (typeof document === 'undefined' || media) return;
  const elements = Array.from(document.querySelectorAll(SELECTOR));
  if (!elements.length) return;
  // matchMedia sets the floats up / takes them down as the breakpoint or the
  // reduced-motion setting changes, restoring the inline styles each time.
  media = gsap.matchMedia();
  media.add(WHEN, () => elements.forEach(addFloat));
}

export function cleanupFloats() {
  media?.revert();
  media = null;
}
