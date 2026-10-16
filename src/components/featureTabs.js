/**
 * Feature Tabs — an autoplaying feature showcase: a stack of background media
 * that takes turns with a list of feature items, each item with a progress
 * line timing its turn (everyday.io's "One home. One system." section).
 * Initialised from src/global/index.js on pages that have a
 * [data-feature-tabs].
 *
 * ── The motion ───────────────────────────────────────────────────────────────
 *   Entrance  The first time the section comes into view its picture settles
 *             from a zoom and the items rise in one after another; the first
 *             turn starts once they're in.
 *   Switch    The next picture wipes in over the last one, in the direction of
 *             travel (left to right going forward), settling from a zoom as it
 *             does — and keeps easing in very slowly for the rest of its turn,
 *             so the hold is never quite still. The last one is pushed back a
 *             touch as it's covered.
 *             The items hold their places: the outgoing one dims and its text
 *             sinks a little, the incoming one brightens, its text rising
 *             back as its icon fades up into the room below it.
 *   Line      The active item's line fills over the delay; a line handing over
 *             retracts into its end rather than vanishing.
 *
 * The progress line is a CSS animation lasting the delay: pausing it on
 * keyboard focus / hover, the autoplay-off state and reduced motion are
 * selectors, and its end (animationend) advances the tabs. The script moves
 * .is-active, runs the switch with GSAP, and flags the root as paused while
 * the section is off-screen or the browser tab hidden.
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <div data-feature-tabs data-feature-tabs-delay="6000">       ← root
 *     <div class="bg">
 *       <img data-feature-tabs-media …>  × N                     ← the pictures
 *       <div class="bg-blur-overlay"></div>
 *     </div>
 *     <div data-feature-tabs-stack class="xp-tabs">               ← optional: phones
 *       <div data-feature-tabs-item class="xp-tab">               ← item i ↔ media i
 *         <div class="xp-tab-head"><h3>Lead times</h3><div>…</div></div>
 *         <div data-feature-tabs-reveal class="xp-tab-icon"><svg/></div>   ← optional
 *         <div class="xp-tab-progress">
 *           <div data-feature-tabs-progress class="xp-tab-progress-line"></div>
 *         </div>
 *       </div>
 *       …
 *       <div class="xp-tabs-nav">                                 ← optional 2nd set
 *         <div data-feature-tabs-item class="xp-tab-progress">
 *           <div data-feature-tabs-progress class="xp-tab-progress-line"></div>
 *         </div>
 *         …
 *       </div>
 *     </div>
 *   </div>
 * Items pair with media in DOM order and wrap around, so a second set of items
 * (e.g. the mobile progress bars) simply repeats 1…N. A bar on its own is an
 * item too: tapping it shows its feature (its tap area is 24px tall).
 *
 * ── Options (on [data-feature-tabs]) ─────────────────────────────────────────
 *   data-feature-tabs-delay="6000"      ms each item stays active
 *   data-feature-tabs-pause-on-hover    also pause while the pointer is over it
 *   data-feature-tabs-autoplay="false"  no rotation — click / keys only
 * On the items' parent:
 *   data-feature-tabs-stack             on phones (Webflow's mobile breakpoint,
 *                                       under 768px) the items share one place
 *                                       and only the active one shows: the
 *                                       outgoing fades out, then the incoming
 *                                       fades in. The bottom of the picture
 *                                       blurs in behind them, stronger toward
 *                                       its edge (the Figma mobile design).
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Picking an item — click, tap or Enter/Space — shows it and its line starts
 * again from 0, carrying the rotation on from there. The line freezes while
 * keyboard focus is inside (:focus-visible, WCAG 2.2.2 — a mouse click or tap
 * doesn't count), while the section is off-screen or the tab hidden
 * ([data-feature-tabs-paused]), and — with the option — on hover. With
 * autoplay off, or under prefers-reduced-motion, nothing rotates and the
 * active line shows full; reduced motion also makes switches instant and
 * skips the entrance. Items holding a [data-feature-tabs-reveal] sit at 55%
 * opacity when inactive (75% on hover), and the reveal shows on the active
 * one; an inactive item's text (what's above the reveal) sits lower — by the
 * gap above the reveal plus half its height, measured from the layout, or
 * data-feature-tabs-drop="48" (px) on the root. cleanupFeatureTabs() restores
 * the authored inline styles.
 */

import { gsap } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  root: '[data-feature-tabs]',
  media: '[data-feature-tabs-media]',
  item: '[data-feature-tabs-item]',
  progress: '[data-feature-tabs-progress]',
  reveal: '[data-feature-tabs-reveal]',
};
// Set once a root is initialised — scopes the injected CSS, so nothing is
// hidden before the script runs (or if it fails).
const READY_ATTR = 'data-feature-tabs-ready';
// Off-screen, tab hidden or still entering: the active line's animation is
// frozen.
const PAUSED_ATTR = 'data-feature-tabs-paused';
// The picture being wiped over: kept showing, under the incoming one.
const LEAVING_ATTR = 'data-feature-tabs-leaving';
// On the items' parent: on phones, one item at a time, in one place.
const STACK_ATTR = 'data-feature-tabs-stack';
const STACK_QUERY = '(max-width: 767px)';
const ACTIVE_CLASS = 'is-active';
const PROGRESS_ANIMATION = 'feature-tabs-progress';
const DEFAULT_DELAY = 6000;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const MOTION = {
  // The incoming picture wipes in over the last one…
  wipe: { duration: 1.3, ease: 'power3.inOut' },
  // …settling from `zoom` over its whole turn: most of it as it wipes in, then
  // ever slower — the slow drift of the hold.
  settle: { zoom: 1.12, ease: 'expo.out' },
  // The outgoing picture is pushed back by this much as it's covered.
  push: 0.05,
  // A line handing over retracts into its end.
  line: { duration: 0.7, ease: 'power3.inOut' },
  // The first time it comes into view: the items rise in, then the first turn.
  entrance: { y: 28, duration: 1.1, ease: 'power3.out', stagger: 0.12 },
};

const READY = `[${READY_ATTR}]`;
// What the entrance sets on the items, handed back to the CSS after.
const ENTRANCE_PROPS = 'opacity,visibility,transform,transition';
const ACTIVE_LINE = `.${ACTIVE_CLASS} ${SELECTORS.progress}`;
// Rules the animation depends on (stacking, the line) use the attribute
// selectors' own specificity so a single Webflow class can't undo them; the
// look (inactive opacity, cursor) is in :where() so Webflow styles win.
const CSS_TEXT = `
/* Media: the media's parent clips them and gets its own stacking context;
   inside it the active picture (z 0) sits over the ones it's wiping over
   (below 0 — the script stacks them), and anything after them in that
   parent — e.g. a blur/gradient overlay — still paints on top. */
${READY} :has(> ${SELECTORS.media}) {
  isolation: isolate;
  overflow: hidden;
}
${READY} ${SELECTORS.media} {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  visibility: hidden;
}
${READY} ${SELECTORS.media}[${LEAVING_ATTR}] {
  visibility: visible;
}
${READY} ${SELECTORS.media}.${ACTIVE_CLASS} {
  z-index: 0;
  visibility: visible;
}

/* Progress: the active item's line fills over the delay and its end advances
   the tabs (animationend). Moving .is-active to another item drops the old
   line's animation and starts the new one from 0. */
@keyframes ${PROGRESS_ANIMATION} {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
${READY} ${SELECTORS.progress} {
  width: 100%;
  height: 100%;
  background-color: currentColor;
  transform: scaleX(0);
  transform-origin: left center;
}
${READY} ${ACTIVE_LINE} {
  animation: ${PROGRESS_ANIMATION} var(--feature-tabs-delay, ${DEFAULT_DELAY}ms) linear forwards;
}
/* Frozen in place: off-screen / tab hidden / entering (script), keyboard
   focus inside, or the pointer over it (opt-in; only where hover is real). */
${READY}[${PAUSED_ATTR}] ${ACTIVE_LINE},
${READY}:has(:focus-visible) ${ACTIVE_LINE} {
  animation-play-state: paused;
}
@media (hover: hover) {
  ${READY}[data-feature-tabs-pause-on-hover]:hover ${ACTIVE_LINE} {
    animation-play-state: paused;
  }
}
/* No autoplay: the active line just shows full. */
${READY}[data-feature-tabs-autoplay='false'] ${ACTIVE_LINE} {
  animation: none;
  transform: scaleX(1);
}

/* Items + reveal: every item keeps its reveal's room, so switching never
   moves anything — the inactive ones are dimmed, and the reveal fades up on
   the active one. */
:where(${READY} ${SELECTORS.item}) {
  cursor: pointer;
}
:where(${READY} ${SELECTORS.item}:has(${SELECTORS.reveal})) {
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
:where(${READY} ${SELECTORS.item}:has(${SELECTORS.reveal}):not(.${ACTIVE_CLASS})) {
  opacity: 0.55;
}
:where(${READY} ${SELECTORS.item}:has(${SELECTORS.reveal}):not(.${ACTIVE_CLASS}):hover) {
  opacity: 0.75;
}
${READY} ${SELECTORS.reveal} {
  opacity: 0;
  transform: translateY(0.5rem);
  transition:
    opacity 0.4s ${EASE},
    transform 0.4s ${EASE};
}
${READY} .${ACTIVE_CLASS} ${SELECTORS.reveal} {
  opacity: 1;
  transform: none;
  transition-duration: 0.9s;
  transition-delay: 0.3s;
}
/* An inactive item's text (what comes before its reveal) sits lower, by
   --feature-tabs-drop (the script measures it); it rises back as the item
   becomes active, sinking quicker as it goes. */
${READY} ${SELECTORS.item} > :has(~ ${SELECTORS.reveal}) {
  transition: transform 0.5s ${EASE};
}
${READY} ${SELECTORS.item}:not(.${ACTIVE_CLASS}) > :has(~ ${SELECTORS.reveal}) {
  transform: translateY(var(--feature-tabs-drop, 0px));
}
${READY} .${ACTIVE_CLASS}${SELECTORS.item} > :has(~ ${SELECTORS.reveal}) {
  transition-duration: 0.9s;
}

/* A bare progress bar as an item (the phone set): a 24px tall tap area. */
${READY} ${SELECTORS.item}:has(> ${SELECTORS.progress}:only-child) {
  position: relative;
}
${READY} ${SELECTORS.item}:has(> ${SELECTORS.progress}:only-child)::after {
  content: '';
  position: absolute;
  inset: -11px 0;
}

/* Stacked (phones): the items share one grid cell, only the active one
   showing. The bottom of the pictures blurs in behind the text — two layers,
   the stronger one nearer the edge, so the blur builds up toward it. */
@media ${STACK_QUERY} {
  ${READY} [${STACK_ATTR}] {
    display: grid;
  }
  ${READY} [${STACK_ATTR}] > ${SELECTORS.item} {
    grid-area: 1 / 1;
  }
  ${READY} [${STACK_ATTR}] > ${SELECTORS.item}:not(.${ACTIVE_CLASS}) {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  ${READY} [${STACK_ATTR}] > ${SELECTORS.item} > :has(~ ${SELECTORS.reveal}) {
    transform: none;
  }
  ${READY}:has([${STACK_ATTR}]) :has(> ${SELECTORS.media})::before,
  ${READY}:has([${STACK_ATTR}]) :has(> ${SELECTORS.media})::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    z-index: 1;
    pointer-events: none;
  }
  ${READY}:has([${STACK_ATTR}]) :has(> ${SELECTORS.media})::before {
    height: 24%;
    -webkit-backdrop-filter: blur(5px);
    backdrop-filter: blur(5px);
    -webkit-mask-image: linear-gradient(transparent, #000 60%);
    mask-image: linear-gradient(transparent, #000 60%);
  }
  ${READY}:has([${STACK_ATTR}]) :has(> ${SELECTORS.media})::after {
    height: 13%;
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    -webkit-mask-image: linear-gradient(transparent, #000 70%);
    mask-image: linear-gradient(transparent, #000 70%);
  }
}
/* …the outgoing item fading out, then the incoming one in. */
@media ${STACK_QUERY} and (prefers-reduced-motion: no-preference) {
  ${READY} [${STACK_ATTR}] > ${SELECTORS.item} {
    transition:
      opacity 0.3s ${EASE},
      visibility 0s linear 0.3s;
  }
  ${READY} [${STACK_ATTR}] > .${ACTIVE_CLASS}${SELECTORS.item} {
    transition:
      opacity 0.6s ${EASE} 0.2s,
      visibility 0s;
  }
}

/* No rotation and instant switches; the active line just shows full. */
@media (prefers-reduced-motion: reduce) {
  ${READY} ${SELECTORS.reveal},
  ${READY} ${SELECTORS.item} > :has(~ ${SELECTORS.reveal}),
  :where(${READY} ${SELECTORS.item}) {
    transition: none;
  }
  ${READY} ${ACTIVE_LINE} {
    animation: none;
    transform: scaleX(1);
  }
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-feature-tabs-style', 'true');
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

function readNumberAttr(el, name, fallback) {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

// How far a line has filled (its scaleX right now).
const filledOf = (fill) => {
  const transform = getComputedStyle(fill).transform;
  return transform && transform !== 'none' ? new DOMMatrix(transform).a : 0;
};

const instances = new Map();

function initFeatureTabsRoot(root) {
  const media = Array.from(root.querySelectorAll(SELECTORS.media));
  const items = Array.from(root.querySelectorAll(SELECTORS.item));
  const count = media.length;
  if (!count || !items.length) {
    logger.warn(
      '[FeatureTabs] needs [data-feature-tabs-media] and [data-feature-tabs-item] — skipped:',
      root
    );
    return null;
  }

  const delay = Math.max(500, readNumberAttr(root, 'data-feature-tabs-delay', DEFAULT_DELAY));
  const moving = !prefersReducedMotion();
  // Item i pairs with media i % count, so a second set of items repeats 1…N.
  const indexOf = (itemPosition) => itemPosition % count;
  const fills = items.map((item) => item.querySelector(SELECTORS.progress));

  const presetIndex = items.findIndex((item) => item.classList.contains(ACTIVE_CLASS));
  let active = presetIndex > -1 ? indexOf(presetIndex) : 0;
  let inView = false;
  // Still to come into view for the first time (its entrance holds the turn).
  let entered = !moving;
  const cleanups = [];
  const ctx = gsap.context(() => {});

  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };

  // ── Accessibility ───────────────────────────────────────────────────────────
  // Items are buttons that show their feature; the one showing is aria-current.
  // Items without text (e.g. bare progress bars) borrow their feature's title.
  const added = [];
  const setOwn = (el, name, value) => {
    if (el.hasAttribute(name)) return;
    el.setAttribute(name, value);
    added.push([el, name]);
  };
  const titleOf = (index) => {
    const withText = items.find(
      (item, position) => indexOf(position) === index && item.textContent.trim()
    );
    const heading = withText?.querySelector('h1, h2, h3, h4, h5, h6');
    return (heading || withText)?.textContent.trim().replace(/\s+/g, ' ') || `Feature ${index + 1}`;
  };
  items.forEach((item, position) => {
    if (item.tagName !== 'BUTTON') {
      setOwn(item, 'role', 'button');
      setOwn(item, 'tabindex', '0');
    }
    if (!item.textContent.trim()) setOwn(item, 'aria-label', titleOf(indexOf(position)));
  });

  // ── The pictures ────────────────────────────────────────────────────────────
  // What's on screen, bottom to top: the active picture last, under it the
  // ones it's still wiping over — each of which may still be wiping in itself:
  // a switch mid-wipe never snaps the last one to its end, the next picture
  // just wipes in over whatever is showing. Each one's z-index is its place in
  // the stack (the top at 0, the rest below), so anything after them in their
  // parent — an overlay — stays on top.
  let stack = [media[active]];
  const wipes = new Map(); // picture → its wipe in
  let settle = null; // the active picture's settle (it runs its whole turn)

  const restack = () =>
    stack.forEach((layer, i) => {
      layer.style.zIndex = String(i - (stack.length - 1));
    });

  // Off the screen: stopped and put back as authored (a stand-in is removed).
  const drop = (layer) => {
    wipes.get(layer)?.kill();
    wipes.delete(layer);
    gsap.killTweensOf(layer);
    if (!media.includes(layer)) {
      layer.remove();
      return;
    }
    layer.removeAttribute(LEAVING_ATTR);
    layer.style.removeProperty('z-index');
    gsap.set(layer, { clearProps: 'transform,clipPath' });
  };

  // A picture still showing under the active one can't just wipe in again —
  // lifting it out from under would leave a hole where it showed. A frozen
  // copy of it, as it is right now, takes its place in the stack instead.
  const standIn = (layer) => {
    const copy = layer.cloneNode(true);
    copy.removeAttribute('id');
    copy.classList.remove(ACTIVE_CLASS);
    copy.setAttribute('alt', '');
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute(LEAVING_ATTR, '');
    layer.before(copy);
    return copy;
  };

  // Just `layer` showing, as authored (no switch to animate).
  const showOnly = (layer) => {
    stack.filter((other) => other !== layer).forEach(drop);
    stack = [layer];
    restack();
  };

  // The picture settling from a zoom over its turn (and the wipe in).
  const settleIn = (layer) => {
    settle?.kill();
    settle = ctx.add(() =>
      gsap.fromTo(
        layer,
        { scale: MOTION.settle.zoom },
        { scale: 1, duration: delay / 1000 + MOTION.wipe.duration, ease: MOTION.settle.ease }
      )
    );
  };

  const wipeIn = (incoming, direction) => {
    const outgoing = stack[stack.length - 1];
    const at = stack.indexOf(incoming);
    if (at > -1) {
      stack[at] = standIn(incoming);
      drop(incoming);
    }
    stack.forEach((layer) => layer.setAttribute(LEAVING_ATTR, ''));
    stack.push(incoming);
    restack();

    // The one it covers is pushed back a touch (its own wipe, if still
    // running, carries on).
    settle?.kill();
    const pushed = Number(gsap.getProperty(outgoing, 'scale')) + MOTION.push;
    ctx.add(() => gsap.to(outgoing, { scale: pushed, ...MOTION.wipe }));

    const covered = direction > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
    const wipe = ctx.add(() =>
      gsap.fromTo(
        incoming,
        { clipPath: covered },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          ...MOTION.wipe,
          clearProps: 'clipPath',
          // It covers everything under it now: those can go.
          onComplete: () => {
            wipes.delete(incoming);
            const under = stack.indexOf(incoming);
            stack.slice(0, under).forEach(drop);
            stack = stack.slice(under);
            restack();
          },
        }
      )
    );
    wipes.set(incoming, wipe);
    settleIn(incoming);
  };

  // The lines handing over retract into their ends: the line's start runs to
  // where it had filled to as it shrinks.
  const retract = (fill) => {
    const filled = filledOf(fill);
    if (!filled) return;
    ctx.add(() =>
      gsap.fromTo(
        fill,
        { scaleX: filled, x: 0 },
        {
          scaleX: 0,
          x: filled * fill.offsetWidth,
          ...MOTION.line,
          clearProps: 'transform',
        }
      )
    );
  };

  // ── State → DOM ─────────────────────────────────────────────────────────────
  const show = (index, { animate = true, direction = 1 } = {}) => {
    const previous = active;
    const switching = animate && moving && entered && index !== previous;
    // Read before .is-active moves (it drops the line's animation).
    const handingOver = switching
      ? fills.filter((fill, position) => fill && indexOf(position) === previous)
      : [];
    const filled = handingOver.map(filledOf);

    active = index;
    media.forEach((layer, i) => layer.classList.toggle(ACTIVE_CLASS, i === index));
    items.forEach((item, position) => {
      const isActive = indexOf(position) === index;
      item.classList.toggle(ACTIVE_CLASS, isActive);
      if (isActive) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
      // A line coming back mid-retract: its CSS fill takes over again.
      if (isActive && fills[position]) {
        gsap.killTweensOf(fills[position]);
        gsap.set(fills[position], { clearProps: 'transform' });
      }
    });
    if (!switching) {
      showOnly(media[index]);
      return;
    }

    wipeIn(media[index], direction);
    handingOver.forEach((fill, i) => {
      gsap.set(fill, { scaleX: filled[i] });
      retract(fill);
    });
  };

  const updatePaused = () =>
    root.toggleAttribute(PAUSED_ATTR, !inView || !entered || document.hidden);

  // Stacked on a phone and not the active one: hidden by the CSS.
  const stackQuery = window.matchMedia(STACK_QUERY);
  const tuckedAway = (item) =>
    stackQuery.matches &&
    !item.classList.contains(ACTIVE_CLASS) &&
    Boolean(item.parentElement?.hasAttribute(STACK_ATTR));

  // The first time it comes into view: the picture settles and the items rise
  // in (those showing — stacked, the others are just handed back to the CSS);
  // the first turn starts as they land.
  const enter = () => {
    const { duration, ease, stagger } = MOTION.entrance;
    settleIn(media[active]);
    const hidden = items.filter(tuckedAway);
    ctx.add(() => {
      if (hidden.length) gsap.set(hidden, { clearProps: ENTRANCE_PROPS });
      gsap.to(
        items.filter((item) => !hidden.includes(item)),
        {
          autoAlpha: 1,
          y: 0,
          duration,
          ease,
          stagger,
          clearProps: ENTRANCE_PROPS,
          onComplete: () => {
            entered = true;
            updatePaused();
          },
        }
      );
    });
  };

  // ── Events ──────────────────────────────────────────────────────────────────
  // The active line finished: next feature. (Both sets of lines end together;
  // only the first counts — after it, the other one no longer belongs to the
  // active feature.) With a single feature this re-shows it and the line stays
  // full, as the animation fills forwards.
  listen(root, 'animationend', (event) => {
    if (event.animationName !== PROGRESS_ANIMATION) return;
    const position = fills.indexOf(event.target);
    if (position === -1 || indexOf(position) !== active) return;
    show((active + 1) % count);
  });

  items.forEach((item, position) => {
    const pick = () => {
      const index = indexOf(position);
      show(index, { direction: index < active ? -1 : 1 });
    };
    listen(item, 'click', pick);
    if (item.tagName !== 'BUTTON') {
      listen(item, 'keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        pick();
      });
    }
  });

  listen(document, 'visibilitychange', updatePaused);

  // The line only runs while the section is on screen, so a visitor doesn't
  // arrive mid-way through a turn they never saw.
  let waitingToEnter = moving;
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            inView = entry.isIntersecting;
            if (inView && waitingToEnter) {
              waitingToEnter = false;
              enter();
            }
            updatePaused();
          },
          { threshold: 0.25 }
        );
  if (observer) observer.observe(root);
  else {
    inView = true;
    entered = true;
  }

  // How far an inactive item's text sits lower: as set, or the gap above the
  // reveal plus half its height (re-measured as the layout changes).
  const setDrop = Number.parseFloat(root.getAttribute('data-feature-tabs-drop'));
  const measureDrop = () => {
    let drop = setDrop;
    if (!Number.isFinite(drop)) {
      const reveal = items
        .map((item) => item.querySelector(`:scope > ${SELECTORS.reveal}`))
        .find((el) => el?.offsetHeight && el.previousElementSibling);
      if (!reveal) return;
      const above = reveal.previousElementSibling;
      const gap = reveal.offsetTop - (above.offsetTop + above.offsetHeight);
      drop = Math.max(0, gap) + reveal.offsetHeight / 2;
    }
    root.style.setProperty('--feature-tabs-drop', `${Math.round(drop)}px`);
  };
  const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureDrop);
  sizes?.observe(root);
  cleanups.push(() => sizes?.disconnect());

  // ── Start ───────────────────────────────────────────────────────────────────
  injectStyles();
  root.style.setProperty('--feature-tabs-delay', `${delay}ms`);
  measureDrop();
  // Waiting to enter: the items hidden and the picture already at the zoom it
  // settles from (set while it's off-screen — set as it comes into view, the
  // jump to it would show).
  if (waitingToEnter && observer) {
    ctx.add(() => {
      // (Their own opacity transitions off meanwhile: they'd trail the tween.)
      gsap.set(items, { autoAlpha: 0, y: MOTION.entrance.y, transition: 'none' });
      gsap.set(media[active], { scale: MOTION.settle.zoom });
    });
  }
  updatePaused(); // paused until the observer reports the section on screen
  root.setAttribute(READY_ATTR, '');
  show(active, { animate: false });

  return () => {
    observer?.disconnect();
    cleanups.forEach((fn) => fn());
    stack.filter((layer) => !media.includes(layer)).forEach((copy) => copy.remove());
    ctx.revert();
    [READY_ATTR, PAUSED_ATTR].forEach((name) => root.removeAttribute(name));
    root.style.removeProperty('--feature-tabs-delay');
    root.style.removeProperty('--feature-tabs-drop');
    media.forEach((layer) => {
      layer.classList.remove(ACTIVE_CLASS);
      layer.removeAttribute(LEAVING_ATTR);
      layer.style.removeProperty('z-index');
    });
    items.forEach((item) => {
      item.classList.remove(ACTIVE_CLASS);
      item.removeAttribute('aria-current');
    });
    added.forEach(([el, name]) => el.removeAttribute(name));
  };
}

/** Wire every [data-feature-tabs] under `root`. Safe to call repeatedly. */
export function initFeatureTabs(root = document) {
  if (typeof document === 'undefined') return;
  root.querySelectorAll(SELECTORS.root).forEach((el) => {
    if (instances.has(el)) return;
    const cleanup = initFeatureTabsRoot(el);
    if (cleanup) instances.set(el, cleanup);
  });
}

export function cleanupFeatureTabs() {
  instances.forEach((cleanup) => cleanup());
  instances.clear();
}
