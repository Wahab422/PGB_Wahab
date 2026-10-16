/**
 * Sticky Button — a button that rides along the bottom of the screen over the
 * sections marked for it, its label and link following the section (as on
 * telhaclarke.com.au): it rises in as a marked section comes up, rolls to the
 * next one's label as that's reached, and drops away over an unmarked section
 * (rising back in, with the new label, at the next marked one) and as the
 * footer comes up. Initialised from src/global/index.js on pages that have one.
 *
 * ── Markup (attributes in Webflow) ───────────────────────────────────────────
 *   <main>
 *     <section …>…                    ← unmarked: no button over it
 *     <section sticky-button-text="Explore all solutions" sticky-button-link="/all-solutions">…
 *     <section sticky-button-text="Explore all projects" sticky-button-link="/projects">…
 *     …
 *     <div sticky-button-wrap class="sticky-btn-wrap">   ← the last thing in <main>
 *       <a class="btn" href="/projects">                  ← the site's Button
 *         <div class="btn-text">Explore all projects</div>
 *         <svg btn-animate-svg …></svg>
 *       </a>
 *     </div>
 *   </main>
 *
 * ── Options (on a section) ───────────────────────────────────────────────────
 *   sticky-button-text="…"   shows the button over this section, with this
 *                            label; empty = the button's own text
 *   sticky-button-link="…"   where the button goes meanwhile (default: its own
 *                            link)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * A marked section has the button from its top reaching 70% down the screen
 * until its bottom does (the lower part of the screen, where the button is,
 * is over it then) — or, when an unmarked section (or the footer) follows it,
 * only until its bottom reaches the bottom of the screen, so it goes as that
 * section (or the footer) comes into view; anywhere else — an unmarked
 * section — it's hidden. Going, it closes and drops away. Near the footer
 * it's held at the bottom of the screen as it goes rather than carried up with
 * the page. With no section marked, it shows with its own label from the
 * first section (the hero) scrolling by to the end of the page, and settles
 * there where it sits in Webflow, at the bottom of <main>. Showing, it rises
 * in and opens out from its label to uncover the arrow; a new label
 * rolls up into place as the button narrows or widens to fit it.
 * The wrap is position: sticky with no height of its own
 * (src/styles/sticky-button.css), so it takes no room in the page; until this
 * runs the button is hidden (4s failsafe). Hidden, it can't be tabbed to; its
 * accessible name follows the label. Under prefers-reduced-motion it appears,
 * disappears and changes label without moving. cleanupStickyButtons() restores
 * the button as authored.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';
import { FAST_IN_OUT as EASE } from '../utils/eases';
import { layoutTop } from '../utils/scrollPosition';

const SELECTORS = {
  wrap: '[sticky-button-wrap]',
  button: 'a, button',
  label: '.btn-text',
  icon: 'svg',
  section: '[sticky-button-text]',
};
// Set once it's set up: src/styles/sticky-button.css hides the button until then.
const READY_ATTR = 'sticky-button-ready';
// On the label's box once it holds one line per label (styled in the CSS).
const LABELS_ATTR = 'sticky-button-labels';
// A marked section has the button while it's across this line, 70% down the
// screen…
const START = 'top 70%';
const END = 'bottom 70%';
// …or, followed by an unmarked section (or the footer), until its bottom
// reaches the bottom of the screen: the button goes as that comes into view.
const END_ALONE = 'bottom bottom';
// With no section marked: from the first section's bottom crossing it on.
const FALLBACK = { start: 'bottom 70%', end: 'max' };

const MOTION = {
  // Hidden: below the screen, a little smaller.
  hidden: { yPercent: 200, scale: 0.8 },
  duration: 1,
  // The hide is quicker: it closes and drops away in about 0.6s in all.
  hideDuration: 0.5,
  // When, in the show, it opens out to uncover the arrow.
  open: 0.4,
  // When, in the hide, it starts to drop (after it starts to close).
  drop: 0.2,
  roll: 0.9,
  // A label's box widening takes this share of the roll (so it leads the new
  // label in); narrowing, it starts this share into the roll (so it trails the
  // old label out).
  lead: 0.6,
  trail: 0.25,
};

const instances = new Map();

function initStickyButton(wrap) {
  const button = wrap.querySelector(SELECTORS.button);
  const labelBox = button?.querySelector(SELECTORS.label);
  if (!labelBox) {
    logger.warn('[StickyButton] needs a button with a .btn-text label — skipped:', wrap);
    return null;
  }
  const icon = button.querySelector(SELECTORS.icon);
  const authored = {
    label: labelBox.innerHTML,
    labelStyle: labelBox.getAttribute('style'),
    style: button.getAttribute('style'),
    iconStyle: icon?.getAttribute('style') ?? null,
    href: button.getAttribute('href'),
    ariaLabel: button.getAttribute('aria-label'),
  };
  const ownText = labelBox.textContent.trim();

  const marked = Array.from(document.querySelectorAll(SELECTORS.section));
  // The next marked section starts where this one ends (worked out on each
  // refresh): the button stays on, rolling to its label.
  const followedByStop = (section, i) => {
    const next = marked[i + 1];
    return (
      Boolean(next) && Math.abs(layoutTop(next) - (layoutTop(section) + section.offsetHeight)) < 2
    );
  };
  const stops = marked.length
    ? marked.map((section, i) => ({
        trigger: section,
        start: START,
        end: () => (followedByStop(section, i) ? END : END_ALONE),
        text: section.getAttribute('sticky-button-text').trim() || ownText,
        link: section.getAttribute('sticky-button-link')?.trim() || authored.href,
      }))
    : [
        {
          trigger: document.querySelector('section'),
          ...FALLBACK,
          text: ownText,
          link: authored.href,
        },
      ];
  if (!stops[0].trigger) {
    wrap.setAttribute(READY_ATTR, '');
    return null;
  }

  // One line per label, stacked in the label's box, which clips them: the
  // current one in place, the rest below it.
  const texts = [...new Set(stops.map((stop) => stop.text))];
  labelBox.textContent = '';
  labelBox.setAttribute(LABELS_ATTR, '');
  const lines = new Map(
    texts.map((text) => {
      const line = document.createElement('span');
      line.textContent = text;
      labelBox.append(line);
      return [text, line];
    })
  );

  const reduced = prefersReducedMotion();
  let current = stops[0];
  let shown = false;
  let widths = new Map();
  let showing = null;
  let hiding = null;
  // The button's own padding and borders, and the gap and arrow after its
  // label (px, unscaled).
  let frame = { edges: 0, arrow: 0 };
  // How far open the button is: 0 = closed to its label, 1 = open, showing the
  // arrow too (its width then left to the layout).
  const opening = { value: reduced ? 1 : 0 };

  // The labels' and the button's parts' widths, unscaled (the button is scaled
  // while it shows / hides).
  const measure = () => {
    const scale = Number(gsap.getProperty(button, 'scale')) || 1;
    widths = new Map(
      texts.map((text) => [text, Math.ceil(lines.get(text).getBoundingClientRect().width / scale)])
    );
    const style = getComputedStyle(button);
    const px = (value) => Number.parseFloat(value) || 0;
    frame = {
      edges:
        px(style.paddingLeft) +
        px(style.paddingRight) +
        px(style.borderLeftWidth) +
        px(style.borderRightWidth),
      arrow: icon ? icon.getBoundingClientRect().width / scale + px(style.columnGap) : 0,
    };
  };

  // Part-open, the button is as wide as its label's box is right now (it may
  // be rolling to a new label meanwhile) plus that share of the arrow. The
  // arrow fades out over the first half of the closing, before the button's
  // edge reaches it, and back in over the second half of the opening, after
  // the edge has passed it — so it's never seen cut off.
  const applyOpening = () => {
    const open = opening.value;
    if (icon) icon.style.opacity = String(Math.min(1, Math.max(0, open * 2 - 1)));
    if (open >= 1) {
      button.style.removeProperty('width');
      return;
    }
    const label = Number.parseFloat(labelBox.style.width) || 0;
    button.style.width = `${frame.edges + label + frame.arrow * open}px`;
  };

  gsap.set(button, { ...(reduced ? {} : MOTION.hidden), autoAlpha: 0 });
  // Out of the box, a label is hidden too: the box's clip alone lets a pixel
  // of it show while the button is scaled.
  const PARKED = { yPercent: 100, visibility: 'hidden' };
  lines.forEach((line, text) => {
    if (text !== current.text) gsap.set(line, PARKED);
  });

  const label = (stop) => {
    if (stop.link) button.setAttribute('href', stop.link);
    button.setAttribute('aria-label', stop.text);
  };
  const fitLabel = () => {
    gsap.set(labelBox, { width: widths.get(current.text) });
    applyOpening();
  };

  // Rises in, then opens out to uncover the arrow — from wherever a hide cut
  // short left it.
  const show = () => {
    shown = true;
    hiding?.kill();
    gsap.set(button, { autoAlpha: 1 });
    if (reduced) return;
    showing = gsap
      .timeline({ defaults: { ease: EASE, duration: MOTION.duration } })
      .to(button, { yPercent: 0, scale: 1 })
      .to(opening, { value: 1, onUpdate: applyOpening }, MOTION.duration * MOTION.open);
  };

  const hide = () => {
    shown = false;
    showing?.kill();
    if (reduced) {
      gsap.set(button, { autoAlpha: 0 });
      return;
    }
    hiding = gsap
      .timeline({
        defaults: { ease: EASE, duration: MOTION.hideDuration },
        onComplete: () => gsap.set(button, { autoAlpha: 0 }),
      })
      .to(opening, { value: 0, onUpdate: applyOpening })
      .to(button, { ...MOTION.hidden }, MOTION.hideDuration * MOTION.drop);
  };

  // The old label rolls up out of the box, the new one up into it, as the box
  // fits the new one. Out of sight (hidden, not still dropping away), or with
  // reduced motion, it just swaps.
  const roll = (from, to) => {
    const out = lines.get(from);
    const into = lines.get(to);
    gsap.killTweensOf(labelBox, 'width');
    if (!(shown || hiding?.isActive()) || reduced) {
      gsap.set(out, { ...PARKED, overwrite: true });
      gsap.set(into, { yPercent: 0, visibility: 'visible', overwrite: true });
      fitLabel();
      return;
    }
    // Wider, the box opens out ahead of the new label rising into it;
    // narrower, it closes in once the old label has mostly risen out — so
    // neither is cut off by its edge.
    const wider = widths.get(to) > (Number.parseFloat(labelBox.style.width) || 0);
    gsap
      .timeline({ defaults: { ease: EASE, duration: MOTION.roll, overwrite: true } })
      .to(out, {
        yPercent: -100,
        // (Not called if it's rolled back in first: that tween kills this one.)
        onComplete: () => gsap.set(out, { visibility: 'hidden' }),
      })
      .fromTo(into, { yPercent: 100, visibility: 'visible' }, { yPercent: 0 }, 0)
      .to(
        labelBox,
        {
          width: widths.get(to),
          duration: MOTION.roll * (wider ? MOTION.lead : 1),
          onUpdate: applyOpening,
        },
        wider ? 0 : MOTION.roll * MOTION.trail
      );
  };

  const goTo = (stop) => {
    if (stop === current) return;
    const from = current.text;
    current = stop;
    label(stop);
    if (stop.text !== from) roll(from, stop.text);
  };

  // Each stop's scroll range, kept up to date by ScrollTrigger.
  const ranges = stops.map(({ trigger, start, end }) =>
    ScrollTrigger.create({ trigger, start, end })
  );
  // The scroll position at which the end of <main> (the wrap's place, the
  // footer after it) comes up from the bottom of the screen: past it the wrap
  // no longer sticks but rides up with the page, by however far past it is.
  let release = Infinity;
  // How far the button's held down against that (px).
  let held = 0;
  // Leaving, the button stays at the bottom of the screen rather than being
  // carried up the screen with the wrap.
  const hold = (scroll) => {
    const rise = shown ? 0 : Math.max(0, scroll - release);
    if (rise === held) return;
    held = rise;
    gsap.set(button, { y: rise });
  };

  // The stop the page is scrolled into (-1: none — the button hides). Worked
  // out from the scroll position on every update, not from enter / leave
  // callbacks, so a jump straight past several (an anchor link, a reload
  // part-way down) still lands on the right one. With sections marked, none
  // once the end of <main> comes up: the button drops away as the footer
  // does.
  const sync = () => {
    const scroll = window.scrollY;
    let index = -1;
    if (!(marked.length && scroll >= release)) {
      ranges.forEach((range, i) => {
        if (scroll >= range.start && scroll <= range.end) index = i;
      });
    }
    if (index < 0) {
      if (shown) hide();
    } else {
      goTo(stops[index]);
      if (!shown) show();
    }
    hold(scroll);
  };
  // Re-measured on every refresh (resize, fonts, the page's height changing
  // as images load) — without cutting short a label rolling in.
  const refit = () => {
    measure();
    release = layoutTop(wrap) - window.innerHeight;
    if (gsap.isTweening(labelBox)) applyOpening();
    else fitLabel();
  };
  const page = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: sync,
    onRefresh: () => {
      refit();
      sync();
    },
  });

  label(current);
  refit();
  wrap.setAttribute(READY_ATTR, '');
  sync();
  // The labels' widths change as the web fonts arrive.
  document.fonts?.ready.then(() => instances.has(wrap) && refit());

  return () => {
    page.kill();
    ranges.forEach((range) => range.kill());
    showing?.kill();
    hiding?.kill();
    gsap.killTweensOf([button, labelBox, opening, ...lines.values()]);
    labelBox.removeAttribute(LABELS_ATTR);
    labelBox.innerHTML = authored.label;
    const restore = (el, name, value) =>
      value === null ? el.removeAttribute(name) : el.setAttribute(name, value);
    restore(labelBox, 'style', authored.labelStyle);
    restore(button, 'style', authored.style);
    if (icon) restore(icon, 'style', authored.iconStyle);
    restore(button, 'href', authored.href);
    restore(button, 'aria-label', authored.ariaLabel);
  };
}

/** Wire every [sticky-button-wrap] on the page. Safe to call repeatedly. */
export function initStickyButtons() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(SELECTORS.wrap).forEach((wrap) => {
    if (instances.has(wrap)) return;
    const cleanup = initStickyButton(wrap);
    if (cleanup) instances.set(wrap, cleanup);
  });
}

export function cleanupStickyButtons() {
  instances.forEach((cleanup) => cleanup());
  instances.clear();
}
