/**
 * Timeline Reveal — the "Drawings to handover" timeline, on every
 * .timeline-block[data-timeline-reveal]. Plays the steps' [data-fade] and
 * [data-split-text] itself (fade.js and splitText.js skip them).
 *
 * Desktop (768px+): each step sweeps in as it scrolls into view — the line
 * draws up to the ticks, the ticks grow in while the tag fades and the text
 * rises, then the line carries on to the end of the row.
 * Phones: tabs. The .timeline-menu-btns row scrolls / drags and snaps a pill
 * to the centre (src/styles/timeline-reveal.css); pill i shows step i.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { FADE_SELECTOR } from './fade';
import { playSplitText } from './splitText';

const FADE = { duration: 0.75, ease: 'cubic-bezier(.22,.6,.36,1)' };
const TICKS = { duration: 0.4, stagger: 0.025, ease: 'power2.out' };
const LINE = { leadMax: 0.6, leadEase: 'power2.inOut', speed: 1400 }; // speed in px/s
const TABS = { fadeOut: 0.25, fadeIn: 0.4, settle: 150 }; // s, s, ms

let media = null;

const clamp = (value, max) => Math.min(max, Math.max(0, value));
const clipTo = (width, x) => `inset(0px ${width - x}px 0px 0px)`; // line shown up to x
const middle = (el) => {
  const box = el.getBoundingClientRect();
  return box.left + box.width / 2;
};
const playTexts = (step) => step.querySelectorAll('[data-split-text]').forEach(playSplitText);

// ── Desktop: the sweep ───────────────────────────────────────────────────────

function initStep(step) {
  const cuts = step.querySelector('.timeline-cuts');
  const line = step.querySelector('.timeline-block-border');
  const ticks = step.querySelectorAll('.timeline-cuts-line');
  const fades = step.querySelectorAll(FADE_SELECTOR);
  if (!cuts || !line) return;

  gsap.set(fades, { opacity: 0 });
  gsap.set(ticks, { scaleY: 0, transformOrigin: '50% 50%' });
  gsap.set(line, { clipPath: clipTo(line.offsetWidth, 0) });

  // Measured when it plays, so the layout then is what counts.
  const play = () => {
    const lineBox = line.getBoundingClientRect();
    const cutsBox = cuts.getBoundingClientRect();
    const width = lineBox.width;
    const enter = clamp(cutsBox.left - lineBox.left, width);
    const leave = clamp(cutsBox.right - lineBox.left, width);
    const at = enter > 0 ? Math.min((2 * enter) / LINE.speed, LINE.leadMax) : 0;
    const ticksTime = TICKS.duration + TICKS.stagger * (ticks.length - 1);

    gsap
      .timeline()
      // 1. Up to the ticks.
      .to(line, { clipPath: clipTo(width, enter), duration: at, ease: LINE.leadEase })
      // 2. Behind the ticks (their white background covers it), in step with them.
      .to(ticks, { scaleY: 1, ...TICKS, clearProps: 'transform' }, at)
      .to(line, { clipPath: clipTo(width, leave), duration: ticksTime, ease: 'none' }, at)
      .to(fades, { opacity: 1, ...FADE, clearProps: 'opacity' }, at)
      .call(playTexts, [step], at)
      // 3. On to the end, leaving the ticks at LINE.speed (an ease-out starts at
      // twice its average speed).
      .to(line, {
        clipPath: clipTo(width, width),
        duration: (2 * (width - leave)) / LINE.speed,
        ease: 'power1.out',
        clearProps: 'clipPath',
      });
  };

  // end: 'max' so a jump past the start (reload, anchor link) still plays it.
  ScrollTrigger.create({ trigger: step, start: 'top 80%', end: 'max', once: true, onEnter: play });
}

// ── Phones: the tabs ─────────────────────────────────────────────────────────

function initTabs(steps) {
  const wrap = steps[0].parentElement.parentElement; // holds .timeline-menu and .timeline
  const row = wrap.querySelector('.timeline-menu-btns');
  if (!row) return null;
  const pills = Array.from(row.querySelectorAll('.tag')).slice(0, steps.length);
  const listen = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, listen);

  let shown = Math.max(
    0,
    pills.findIndex((pill) => pill.matches('.is-active'))
  );
  let entered = false;
  let settleTimer = null;
  let drag = null; // mouse drag; touch scrolls the row natively
  let dragged = false;

  const light = (index) =>
    pills.forEach((pill, i) => pill.classList.toggle('is-active', i === index));
  const nearest = () =>
    pills.reduce((best, pill, i) => {
      const off = (p) => Math.abs(middle(p) - middle(row));
      return off(pill) < off(pills[best]) ? i : best;
    }, 0);
  const centre = (index, behavior) =>
    row.scrollBy({ left: middle(pills[index]) - middle(row), behavior });

  const show = (index) => {
    if (index === shown) return;
    gsap.to(steps[shown], { autoAlpha: 0, duration: TABS.fadeOut });
    gsap.to(steps[index], { autoAlpha: 1, duration: TABS.fadeIn, delay: TABS.fadeOut / 2 });
    shown = index;
    entered = true;
    playTexts(steps[index]);
  };

  // Light the middle pill while scrolling; once the row settles, show its step
  // and let snapping back on (a mouse drag turns it off — turned on earlier,
  // the browser snaps back to the pill it was on before).
  const onScroll = () => {
    light(nearest());
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (!drag) row.style.scrollSnapType = '';
      show(nearest());
    }, TABS.settle);
  };
  on(row, 'scroll', onScroll);
  on(row, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 0) {
      drag = { x: event.clientX, left: row.scrollLeft };
      dragged = false;
    }
  });
  on(window, 'pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 3 && !dragged) {
      dragged = true;
      row.style.scrollSnapType = 'none';
    }
    if (dragged) row.scrollLeft = drag.left - dx;
  });
  on(window, 'pointerup', () => {
    const released = drag && dragged;
    drag = null;
    if (!released) return;
    centre(nearest(), 'smooth');
    onScroll(); // settles (and snaps back on) even when there's no glide
  });
  on(row, 'click', (event) => {
    const index = pills.findIndex((pill) => pill.contains(event.target));
    if (!dragged && index !== -1) centre(index, 'smooth');
    dragged = false; // the click that ends a drag isn't a tap
  });

  // Start on the authored pill; its step's text rises as the timeline arrives.
  wrap.setAttribute('data-timeline-tabs', ''); // turns on the phone CSS
  gsap.set(steps, { autoAlpha: (i) => (i === shown ? 1 : 0) });
  light(shown);
  // Centre it next frame (Safari ignores scrolling a row that only just became
  // scrollable) and again as the row comes into view, unless it's been used.
  const recentre = () => entered || centre(shown, 'auto');
  requestAnimationFrame(recentre);
  ScrollTrigger.create({ trigger: row, start: 'top bottom', once: true, onEnter: recentre });
  ScrollTrigger.create({
    trigger: steps[0].parentElement,
    start: 'top 85%',
    end: 'max',
    once: true,
    onEnter: () => entered || playTexts(steps[shown]),
  });

  return () => {
    clearTimeout(settleTimer);
    listen.abort();
    row.style.scrollSnapType = '';
    wrap.removeAttribute('data-timeline-tabs');
  };
}

/** Wire the [data-timeline-reveal] steps. Safe to call repeatedly. */
export function initTimelineReveals() {
  const steps = Array.from(document.querySelectorAll('[data-timeline-reveal]'));
  if (media || !steps.length) return;

  // Each mode runs while its query matches and is undone (tweens, triggers,
  // inline styles) when it stops — rotating or resizing across 767px.
  media = gsap.matchMedia();
  media.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () =>
    steps.forEach(initStep)
  );
  media.add('(max-width: 767px)', () => initTabs(steps));
  // timeline-reveal.css hides the ticks and line until this is set.
  steps.forEach((step) => step.setAttribute('data-timeline-reveal-ready', ''));
}

export function cleanupTimelineReveals() {
  media?.revert();
  media = null;
}
