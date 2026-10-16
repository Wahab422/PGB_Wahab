/**
 * Section Entrance — a section's opening as it scrolls in:
 *   1. Pictures settle — [data-entrance-picture] eases from a slight zoom to
 *      rest with the scroll, from the section's top entering the screen to it
 *      reaching the top.
 *   2. Items rise in — each [data-entrance-item] rises and fades in once it is
 *      fully in view; items arriving together go one after another, in page
 *      order (e.g. the carousel dots, then the tab menu, then the CTA).
 * Initialised from src/global/index.js on pages that have a [data-entrance].
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <section data-tabs-comp data-entrance>
 *     …<img data-entrance-picture>                  ← settles from a zoom (scrubbed)
 *     <div data-carousel-dots data-entrance-item>   ← rise in, left to right
 *     <div class="tab-menu" data-entrance-item>
 *     <div class="solution-cta" data-entrance-item>
 *   </section>
 * Both parts are optional: whatever is tagged animates.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The picture zoom is clipped by its container (the carousel's viewport is
 * overflow: hidden). It runs through --entrance-scale on the section and the
 * `scale` rule in src/styles/section-entrance.css, so it survives on a layer a
 * mask reveal moves and then clears (the carousel's [data-carousel-mask-media]
 * <img>s).
 * Items in a closed tab panel (display: none) at init are left alone (shown),
 * so they're there when the tab opens. Items are hidden by the stylesheet
 * until the script has set them up (data-entrance-ready), so a hero's text
 * doesn't show and then vanish first; an item taller than the screen starts
 * when its top is well on screen. Under prefers-reduced-motion
 * nothing moves and nothing is hidden. cleanupSectionEntrances() restores the
 * authored inline styles.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  root: '[data-entrance]',
  picture: '[data-entrance-picture]',
  item: '[data-entrance-item]',
};

const PICTURE = { fromScale: 1.15 };
// Read by src/styles/section-entrance.css.
const SCALE_VAR = '--entrance-scale';
const ITEMS = {
  y: 24,
  duration: 1,
  stagger: 0.12,
  ease: 'power3.out',
  // Starts when an item is fully on screen (bottom at the bottom), unless
  tallShare: 0.9, // it's taller than this share of the screen:
  tallStart: 'top 85%', // then when its top is well on screen
};
// Set once a section's items are set up: src/styles/section-entrance.css
// hides them until then.
const READY_ATTR = 'data-entrance-ready';

const contexts = [];

const isRendered = (el) => el.getClientRects().length > 0;

function initEntrance(section) {
  const pictures = section.querySelectorAll(SELECTORS.picture);
  const items = Array.from(section.querySelectorAll(SELECTORS.item)).filter(isRendered);

  const ctx = gsap.context(() => {
    // 1. Pictures settle with the scroll, through --entrance-scale (see
    // Behaviour); at rest the property is removed again.
    if (pictures.length) {
      const zoom = { value: PICTURE.fromScale };
      const render = () => {
        if (zoom.value > 1.0005) section.style.setProperty(SCALE_VAR, String(zoom.value));
        else section.style.removeProperty(SCALE_VAR);
      };
      gsap.to(zoom, {
        value: 1,
        ease: 'none',
        onUpdate: render,
        onStart: render,
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: true },
      });
      render();
    }

    // 2. Items rise in, once each, batched so ones arriving together stagger.
    // end: 'max' so a jump past the start still plays it.
    if (items.length) {
      gsap.set(items, { autoAlpha: 0, y: ITEMS.y });
      ScrollTrigger.batch(items, {
        // Measured where the item will rest, not ITEMS.y lower where it waits
        // (or text sitting at the foot of a hero never starts on load). An
        // item taller than the screen is never fully in view: it starts once
        // its top is well on screen instead.
        start: (self) =>
          self.trigger.offsetHeight > window.innerHeight * ITEMS.tallShare
            ? ITEMS.tallStart
            : `bottom-=${ITEMS.y} bottom`,
        end: 'max',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: ITEMS.duration,
            ease: ITEMS.ease,
            stagger: ITEMS.stagger,
            clearProps: 'opacity,visibility,transform',
          }),
      });
    }
  }, section);
  section.setAttribute(READY_ATTR, '');
  return ctx;
}

/** Wire every [data-entrance] section. Safe to call repeatedly. */
export function initSectionEntrances() {
  if (typeof document === 'undefined' || contexts.length) return;
  if (prefersReducedMotion()) return;
  document.querySelectorAll(SELECTORS.root).forEach((section) => {
    contexts.push(initEntrance(section));
  });
}

export function cleanupSectionEntrances() {
  contexts.splice(0).forEach((ctx) => ctx.revert());
  document
    .querySelectorAll(SELECTORS.root)
    .forEach((section) => section.style.removeProperty(SCALE_VAR));
}
