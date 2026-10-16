/**
 * Counter — the number in an element's text counts up as it scrolls into
 * view, once: [data-counter] on the text, on any page. The text around the
 * number (a "+", a "%", "years") and its formatting (thousands separators,
 * decimals) stay as written. Counters that come into view together start one
 * after another. Started on every page from handleGlobalAnimation() in
 * components/gsap.js.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="stat-number" data-counter>1,200+</div>   ← 0+ … 1,200+
 *   <div data-counter>98.5%</div>                         ← 0.0% … 98.5%
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   data-counter-from="1900"      the number it counts from (default 0)
 *   data-counter-duration="2.5"   seconds (default 2)
 *   data-counter-delay="0.3"      seconds to wait once it's in view
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The first number in the element's text counts; the rest of the text, and
 * any markup inside it, is left as it is. It shows its starting number until
 * it plays (from the moment this runs), and one the page opened already
 * scrolled past still plays. Screen readers get the written number throughout
 * (aria-label while it counts). Under prefers-reduced-motion it just shows the
 * number. cleanupCounters() puts the written text back.
 * The original name, counter-anim, still works.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { readNumber } from '../utils/section';

const SELECTOR = '[data-counter], [counter-anim]';
// A number as written: digits, optional thousands commas, optional decimals.
const NUMBER = /\d[\d,]*(?:\.\d+)?/;

const MOTION = { duration: 2, ease: 'power3.out', each: 0.12, start: 'top 85%' };

let ctx = null;
let restores = [];

// The first text node holding a number, and the number in it.
function findNumber(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = node.data.match(NUMBER);
    if (match) return { node, match };
  }
  return null;
}

function initCounter(el) {
  const found = findNumber(el);
  if (!found) return null;
  const { node, match } = found;
  const written = node.data;
  const before = written.slice(0, match.index);
  const after = written.slice(match.index + match[0].length);
  const digits = match[0].replace(/,/g, '');
  const target = Number.parseFloat(digits);
  const decimals = (digits.split('.')[1] || '').length;
  const format = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: match[0].includes(','),
  });
  const from = readNumber(el.getAttribute('data-counter-from'), 0);
  const show = (value) => {
    node.data = `${before}${format.format(value)}${after}`;
  };
  const hadLabel = el.getAttribute('aria-label');
  const label = el.textContent.trim();

  const state = { value: from };
  show(from);
  if (hadLabel === null) el.setAttribute('aria-label', label);
  const restore = () => {
    node.data = written;
    if (hadLabel === null) el.removeAttribute('aria-label');
  };
  const play = (delay) =>
    gsap.to(state, {
      value: target,
      duration: readNumber(el.getAttribute('data-counter-duration'), MOTION.duration),
      ease: MOTION.ease,
      delay: delay + Math.max(0, readNumber(el.getAttribute('data-counter-delay'), 0)),
      onUpdate: () => show(state.value),
      onComplete: restore,
    });
  return { play, restore };
}

/** Wire every [data-counter] on the page. Safe to call repeatedly. */
export function initCounters() {
  if (typeof document === 'undefined' || ctx || prefersReducedMotion()) return;
  const elements = document.querySelectorAll(SELECTOR);
  if (!elements.length) return;

  // Ones whose triggers fire together start one after another.
  let pending = [];
  const flush = () => {
    const batch = pending;
    pending = [];
    ctx?.add(() => batch.forEach((counter, i) => counter.play(i * MOTION.each)));
  };
  const queue = (counter) => {
    if (!pending.length) gsap.delayedCall(0, flush);
    pending.push(counter);
  };

  ctx = gsap.context(() => {
    elements.forEach((el) => {
      const counter = initCounter(el);
      if (!counter) return;
      restores.push(counter.restore);
      // end: 'max', so one the page opened already scrolled past still plays.
      ScrollTrigger.create({
        trigger: el,
        start: MOTION.start,
        end: 'max',
        once: true,
        onEnter: () => queue(counter),
      });
    });
  });
}

export function cleanupCounters() {
  ctx?.revert();
  ctx = null;
  restores.forEach((restore) => restore());
  restores = [];
}
