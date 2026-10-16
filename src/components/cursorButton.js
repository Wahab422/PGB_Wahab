/**
 * Cursor Button — over a [data-cursor-zone] the mouse pointer becomes the
 * zone's own button: the button (a copy of it) grows in under the pointer as
 * one piece, from a fifth of its size with a slight turn, its letters rising
 * in, and follows the pointer with a soft lag — only as far as it stays
 * whole on the zone, so near an edge it waits at the edge; leaving the zone
 * it shrinks away and the normal pointer is back. A click anywhere in the zone follows
 * the button's link. Initialised from src/global/index.js on pages that have
 * a [data-cursor-zone].
 *
 * ── Markup (attributes on the Webflow elements) ──────────────────────────────
 *   <div class="project-block-fig" data-cursor-zone>     ← where the cursor changes
 *     <img …>
 *     <div class="btn-mover-overlay" data-cursor-button>  ← holds the button the
 *       <a class="btn" href="…">View project ↳</a>          cursor becomes
 *     </div>
 *   </div>
 * The button is the first link or <button> in [data-cursor-button] (or the
 * element itself). It keeps its Webflow look — colours are read where it sits, so a
 * dark section's theme carries over.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Mouse only (a fine pointer that can hover): on touch screens nothing
 * changes and the button stays where it is. On a project card's image the
 * cursor is its "View project" button (projectHover.js keeps the card's image
 * push-in and title roll, and the button in place for touch and the
 * keyboard). With the cursor on, the in-place
 * button is see-through (src/styles/cursor-button.css) but still there for
 * the keyboard — it shows again when tabbed to. Smoothness: only transform and
 * opacity animate, as Web Animations on the compositor, each one starting from
 * where it is now (in-out-in turns around seamlessly); only the follow is
 * GSAP. Under prefers-reduced-motion it neither lags nor animates.
 * cleanupCursorButtons() removes it all.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  zone: '[data-cursor-zone]',
  button: '[data-cursor-button]',
};
// Set on <html> while active — src/styles/cursor-button.css hides the normal
// pointer over the zones and turns their in-place buttons see-through.
const READY_ATTR = 'data-cursor-button-ready';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

// The chosen feel: "bloom", fast (×0.7), normal follow.
const SPEED = 0.7;
const FOLLOW = 0.6; // s, the button catching up with the pointer
// px the button keeps inside its zone's edges: it follows the pointer only as
// far as it stays whole on the zone (e.g. a project's image).
const INSET = 8;
const BLOOM = {
  from: 'scale(0.2) rotate(-8deg)',
  in: 720, // ms, before SPEED
  out: 300,
  letters: 560,
  lettersAt: 120,
  lettersOut: 130,
};

const LINEAR_OK =
  typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
// expo.out, sampled into linear() (exact); a cubic-bezier where unsupported.
const EXPO_OUT = LINEAR_OK
  ? `linear(${Array.from({ length: 49 }, (_, i) => {
      const t = i / 48;
      return +(t === 1 ? 1 : 1 - 2 ** (-10 * t)).toFixed(4);
    }).join(', ')})`
  : 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';

let cleanup = null;

// The text of `root` as one inline-block span per character.
function splitChars(root) {
  const spans = [];
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest('svg') || !el.childNodes.length) return;
    if (![...el.childNodes].every((n) => n.nodeType === Node.TEXT_NODE)) return;
    const text = el.textContent;
    if (!text.trim()) return;
    el.textContent = '';
    [...text].forEach((char) => {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.textContent = char === ' ' ? ' ' : char;
      el.append(span);
      spans.push(span);
    });
  });
  return spans;
}

function layer() {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '9999',
    pointerEvents: 'none',
  });
  document.body.append(el);
  return el;
}

function init() {
  const reduced = prefersReducedMotion();
  const ms = (value) => (reduced ? 0 : value * SPEED);
  const zones = [...document.querySelectorAll(SELECTORS.zone)];
  const buttonOf = (zone) => {
    const holder = zone.querySelector(SELECTORS.button);
    return holder?.querySelector('a[href], button') || holder;
  };

  // follower — a 0×0 point at the pointer — holds `group`, which holds the
  // copy of the hovered zone's button, centred on the pointer.
  const follower = layer();
  const group = document.createElement('div');
  Object.assign(group.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    opacity: '0',
    willChange: 'transform, opacity',
  });
  follower.append(group);
  const followX = gsap.quickTo(follower, 'x', { duration: reduced ? 0 : FOLLOW, ease: 'expo.out' });
  const followY = gsap.quickTo(follower, 'y', { duration: reduced ? 0 : FOLLOW, ease: 'expo.out' });

  // Per zone, built once: a copy of its button (colours read where it sits),
  // its letters.
  const measure = layer();
  measure.style.visibility = 'hidden';
  const copies = new Map();
  const copyFor = (zone) => {
    if (copies.has(zone)) return copies.get(zone);
    const source = buttonOf(zone);
    if (!source) return null;
    const own = getComputedStyle(source);
    const button = source.cloneNode(true);
    button.removeAttribute('href');
    button.removeAttribute('data-project'); // the copy opens nothing itself
    button.removeAttribute('id');
    button.removeAttribute('aria-label');
    button.setAttribute('tabindex', '-1');
    Object.assign(button.style, {
      position: 'absolute',
      margin: '0',
      maxWidth: 'none', // Webflow's .w-inline-block caps it at 100% of nothing
      whiteSpace: 'nowrap',
      visibility: 'visible',
      opacity: '1',
      color: own.color,
      backgroundColor: own.backgroundColor,
      borderColor: own.borderTopColor,
    });
    measure.append(button);
    const w = button.offsetWidth;
    const h = button.offsetHeight;
    Object.assign(button.style, { left: `${-w / 2}px`, top: `${-h / 2}px`, width: `${w}px` });
    const chars = splitChars(button);
    const icon = button.querySelector('svg');
    const copy = { button, parts: icon ? [...chars, icon] : chars, w, h };
    copies.set(zone, copy);
    return copy;
  };

  // Animate `el` to `to` from wherever it is right now, replacing its
  // previous animation.
  const running = new WeakMap();
  const run = (el, to, options) => {
    const cs = getComputedStyle(el);
    const from = {};
    Object.keys(to).forEach((prop) => {
      from[prop] = cs[prop];
    });
    running.get(el)?.cancel();
    const animation = el.animate([from, to], { fill: 'both', ...options });
    running.set(el, animation);
    return animation;
  };
  const set = (el, styles) => {
    running.get(el)?.cancel();
    running.delete(el);
    Object.assign(el.style, styles);
  };

  let pointer = null;
  let zone = null;
  let copy = null;
  let shown = false;
  let visible = false; // on screen: shown, or still on its way out
  let held = null; // the zone the button keeps to (still, as it goes)

  // Where the button goes: the pointer, kept far enough inside its zone that
  // the whole button stays on it (centred, if the zone is smaller).
  const aim = () => {
    const box = (zone || (visible ? held : null))?.getBoundingClientRect();
    if (!box || !copy) return pointer;
    const keep = (value, start, end, size) => {
      const min = start + size / 2 + INSET;
      const max = end - size / 2 - INSET;
      return min > max ? (start + end) / 2 : Math.min(max, Math.max(min, value));
    };
    return {
      x: keep(pointer.x, box.left, box.right, copy.w),
      y: keep(pointer.y, box.top, box.bottom, copy.h),
    };
  };
  const follow = (snap = false) => {
    const to = aim();
    if (snap) {
      followX(to.x, to.x);
      followY(to.y, to.y);
    } else {
      followX(to.x);
      followY(to.y);
    }
  };

  const enter = (next) => {
    const nextCopy = copyFor(next);
    if (!nextCopy) return;
    if (!visible || nextCopy !== copy) {
      // From nothing: right under the pointer, from small.
      copy = nextCopy;
      held = next;
      group.replaceChildren(copy.button);
      follow(true);
      set(group, { opacity: '0', transform: BLOOM.from });
      copy.parts.forEach((el) => set(el, { opacity: '0', transform: 'translate3d(0, 0.35em, 0)' }));
    }
    held = next;
    // (Back in mid-exit: it turns around from where it is.)
    run(
      group,
      { opacity: '1', transform: 'scale(1) rotate(0deg)' },
      { duration: ms(BLOOM.in), easing: EXPO_OUT }
    );
    copy.parts.forEach((el) =>
      run(
        el,
        { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        { duration: ms(BLOOM.letters), delay: ms(BLOOM.lettersAt), easing: EXPO_OUT }
      )
    );
    shown = true;
    visible = true;
  };

  const leave = () => {
    if (!copy || !shown) return;
    shown = false;
    copy.parts.forEach((el) =>
      run(
        el,
        { opacity: '0', transform: 'translate3d(0, -0.3em, 0)' },
        { duration: ms(BLOOM.lettersOut), easing: EASE_IN }
      )
    );
    run(
      group,
      { opacity: '0', transform: BLOOM.from },
      { duration: ms(BLOOM.out), delay: ms(40), easing: EASE_IN }
    )
      .finished.then(() => {
        if (!shown) visible = false;
      })
      .catch(() => {});
  };

  const update = (target) => {
    const next = target?.closest?.(SELECTORS.zone) || null;
    if (next === zone) return;
    if (zone) leave();
    zone = next;
    if (zone) enter(zone);
  };

  const onMove = (event) => {
    if (event.pointerType !== 'mouse') return;
    const first = !pointer;
    pointer = { x: event.clientX, y: event.clientY };
    if (first) gsap.set(follower, { x: pointer.x, y: pointer.y });
    update(event.target);
    follow();
  };

  // Scrolling moves the page under a still pointer: re-check what's under it.
  let scrollQueued = false;
  const onScroll = () => {
    if (!pointer || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      update(document.elementFromPoint(pointer.x, pointer.y));
      // The zone moved under it: keep the button inside.
      follow();
    });
  };

  const onLeaveWindow = () => {
    if (zone) leave();
    zone = null;
  };

  // A click anywhere in a zone follows its button's link.
  const onClick = (event) => {
    const hit = event.target.closest?.(SELECTORS.zone);
    if (!hit || event.target.closest('a[href], button')) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;
    buttonOf(hit)?.click();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeaveWindow);
  zones.forEach((el) => el.addEventListener('click', onClick));
  document.documentElement.setAttribute(READY_ATTR, '');

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    document.documentElement.removeEventListener('mouseleave', onLeaveWindow);
    zones.forEach((el) => el.removeEventListener('click', onClick));
    document.documentElement.removeAttribute(READY_ATTR);
    gsap.killTweensOf(follower);
    follower.remove();
    measure.remove();
  };
}

/** Wire the page's [data-cursor-zone]s. Safe to call repeatedly. */
export function initCursorButtons() {
  if (typeof document === 'undefined' || cleanup) return;
  if (!window.matchMedia(FINE_POINTER).matches) return;
  if (!document.querySelector(SELECTORS.zone)) return;
  cleanup = init();
}

export function cleanupCursorButtons() {
  cleanup?.();
  cleanup = null;
}
