import { initNavSubmenus } from '../components/navSubmenu';
import { initMobileMenu, cleanupMobileMenu } from '../components/mobileMenu';
import { prefersReducedMotion } from '../utils/motion';
import { setNavGlide } from '../utils/navGlide';

let navCleanups = [];

export function initNavbar() {
  cleanupNavbar();
  navCleanups.push(initNavHover());
  // The desktop dropdowns ([nav-submenu]): unfold from their toggle.
  navCleanups.push(initNavSubmenus());
  // Phones: the Menu button opens the full-screen menu ([nav-menu]).
  initMobileMenu();
  navCleanups.push(cleanupMobileMenu);
}

export function cleanupNavbar() {
  navCleanups.forEach((fn) => fn());
  navCleanups = [];
}

// ---------------------------------------------------------------------------
// Hover highlight — one pill glides behind the hovered item of a nav list
// ---------------------------------------------------------------------------
//
// Webflow setup — either:
//   - Add an empty div with `data-nav-hover` next to the links (their
//     sibling), styled in Webflow as the pill: it glides behind whichever of
//     its siblings is hovered — a link, a button, or a wrapper holding one.
//     With a [nav-submenu] dropdown among them, it's for the dropdowns only
//     (whose box is their label; the dropdown grows it into its body): the
//     plain links have a hover of their own. E.g.
//       <nav><div data-nav-hover></div><a>About</a>…<div nav-submenu>…</div></nav>
//   - Or add `data-nav-hover` to the list wrapper itself (e.g. a dropdown
//     body): its links/buttons are the items, and the pill is your own element
//     with `data-nav-hover-highlight` inside it, or else one is created
//     (white at 10% opacity, 8px radius).
//   Either way, `data-nav-hover-item` picks the items explicitly. The pill
//   matches each item's box, so give items padding; it fades out over
//   anything else in the list. Mouse and keyboard only — taps don't show it. The item the pill is on carries `data-nav-hover-on`,
//   and every item it's over — gliding past included — `data-nav-hover-under`
//   (src/styles/nav-hover.css gives those the hover colour, so a white link
//   doesn't vanish on the white pill as it passes).
//   Like the tabs' glide (src/styles/tabs.css) it squashes and stretches as
//   it travels, the links' colour easing in step (src/styles/nav-hover.css) —
//   but snappier: hover re-aims it at every link the pointer crosses, so it
//   starts quickly and eases into place (0.25s) to keep up with the pointer.

const HOVER_SELECTORS = {
  list: '[data-nav-hover]',
  item: '[data-nav-hover-item]',
  highlight: '[data-nav-hover-highlight]',
  submenu: '[nav-submenu]',
};

// On the item the pill is on.
const HOVER_ON_ATTR = 'data-nav-hover-on';
// On the pill while it travels (its squash-and-stretch).
const HOVER_MOVING_ATTR = 'data-nav-hover-moving';
// On each item the pill covers (at least UNDER_SHARE of its width).
const HOVER_UNDER_ATTR = 'data-nav-hover-under';
const UNDER_SHARE = 0.4;

// A quick start, easing into place (src/styles/nav-hover.css matches it).
const HOVER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const HOVER_MOVE_MS = 250;
const HOVER_FADE_MS = 200;

export function initNavHover(root = document) {
  if (typeof document === 'undefined') return () => {};

  const cleanups = Array.from(root.querySelectorAll(HOVER_SELECTORS.list)).map((el) =>
    // An element with no links of its own is the pill, gliding over its siblings.
    el.querySelector(`a, button, ${HOVER_SELECTORS.item}`) || !el.parentElement
      ? initHoverList(el)
      : initHoverList(el.parentElement, el)
  );
  return () => cleanups.forEach((fn) => fn());
}

// `glide`: the pill, when it's an element among the items (their sibling).
function initHoverList(list, glide = null) {
  let items = Array.from(list.querySelectorAll(HOVER_SELECTORS.item));
  if (!items.length && glide) {
    const siblings = Array.from(list.children).filter(
      (el) => el !== glide && (el.matches('a, button') || el.querySelector('a, button'))
    );
    const submenus = siblings.filter((el) => el.matches(HOVER_SELECTORS.submenu));
    items = submenus.length ? submenus : siblings;
  }
  if (!items.length) items = Array.from(list.querySelectorAll('a, button'));
  if (!items.length) return () => {};

  let highlight = glide || list.querySelector(HOVER_SELECTORS.highlight);
  const created = !highlight;
  if (created) {
    highlight = document.createElement('span');
    highlight.setAttribute('data-nav-hover-highlight', '');
    highlight.style.background = 'rgba(255, 255, 255, 0.1)';
    highlight.style.borderRadius = '8px';
    list.prepend(highlight);
  }
  highlight.setAttribute('aria-hidden', 'true');
  Object.assign(highlight.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '-1',
    pointerEvents: 'none',
    opacity: '0',
  });

  // The pill is positioned against the list, and sits behind the items via
  // z-index -1 — `isolation` keeps it from dropping behind the list's own
  // background.
  const previousListStyle = { position: list.style.position, isolation: list.style.isolation };
  if (getComputedStyle(list).position === 'static') list.style.position = 'relative';
  list.style.isolation = 'isolate';

  let current = null;
  // The item under the pointer / focus — followed even while the pill is held.
  let wanted = null;
  let held = false;

  const setCurrent = (item) => {
    current?.removeAttribute(HOVER_ON_ATTR);
    current = item;
    item?.setAttribute(HOVER_ON_ATTR, '');
  };

  // Which items the pill is over, followed frame by frame while it glides.
  let underFrame = 0;
  let underUntil = 0;
  const markUnder = () => {
    const pill = highlight.getBoundingClientRect();
    items.forEach((item) => {
      const box = item.getBoundingClientRect();
      const overlap = Math.min(pill.right, box.right) - Math.max(pill.left, box.left);
      item.toggleAttribute(HOVER_UNDER_ATTR, box.width > 0 && overlap >= box.width * UNDER_SHARE);
    });
  };
  const followUnder = (ms) => {
    underUntil = Math.max(underUntil, performance.now() + ms);
    if (underFrame) return;
    const tick = () => {
      markUnder();
      underFrame = performance.now() < underUntil ? requestAnimationFrame(tick) : 0;
    };
    tick();
  };
  const clearUnder = () => {
    cancelAnimationFrame(underFrame);
    underFrame = 0;
    underUntil = 0;
    items.forEach((item) => item.removeAttribute(HOVER_UNDER_ATTR));
  };

  const setTransition = (animateMove) => {
    const moveMs = animateMove && !prefersReducedMotion() ? HOVER_MOVE_MS : 0;
    highlight.style.transition = [
      `transform ${moveMs}ms ${HOVER_EASE}`,
      `width ${moveMs}ms ${HOVER_EASE}`,
      `height ${moveMs}ms ${HOVER_EASE}`,
      `opacity ${HOVER_FADE_MS}ms ease`,
    ].join(', ');
  };

  const place = (item) => {
    const { x, y } = offsetWithin(item, list);
    highlight.style.width = `${item.offsetWidth}px`;
    highlight.style.height = `${item.offsetHeight}px`;
    highlight.style.transform = `translate(${x}px, ${y}px)`;
  };

  // The squash-and-stretch, restarted on each move between items.
  const squash = () => {
    highlight.removeAttribute(HOVER_MOVING_ATTR);
    if (prefersReducedMotion()) return;
    void highlight.offsetWidth; // restart the CSS animation
    highlight.setAttribute(HOVER_MOVING_ATTR, '');
  };
  const onSquashEnd = () => highlight.removeAttribute(HOVER_MOVING_ATTR);

  // Gliding from item to item; coming in from outside the list it appears in
  // place and only fades in, rather than sliding over from where it last was.
  const moveTo = (item) => {
    wanted = item;
    if (held || item === current) return;
    const gliding = current !== null;
    setTransition(gliding);
    place(item);
    if (gliding) squash();
    highlight.style.opacity = '1';
    setCurrent(item);
    followUnder(gliding ? HOVER_MOVE_MS + 50 : 0);
  };

  const hide = () => {
    wanted = null;
    if (held || !current) return;
    setCurrent(null);
    clearUnder();
    highlight.style.opacity = '0';
  };

  // For a component that takes the pill over for a while (src/utils/navGlide.js).
  const glideControl = {
    highlight,
    wanted: () => wanted,
    hold: () => {
      // Where it is right now — mid-glide included, its squash let go of.
      highlight.removeAttribute(HOVER_MOVING_ATTR);
      const rect = highlight.getBoundingClientRect();
      const opacity = parseFloat(getComputedStyle(highlight).opacity) || 0;
      held = true;
      clearUnder();
      highlight.style.transition = 'none';
      return { rect, opacity };
    },
    mark: (item) => setCurrent(item),
    release: (on) => {
      held = false;
      setTransition(false);
      if (on) place(on);
      highlight.style.opacity = on ? '1' : '0';
      setCurrent(on);
      if (on) followUnder(0);
      if (wanted === on) return;
      if (wanted) moveTo(wanted);
      else hide();
    },
  };
  items.forEach((item) => setNavGlide(item, glideControl));

  const onItemEnter = (e) => {
    if (e.pointerType !== 'touch') moveTo(e.currentTarget);
  };
  // Over the rest of the list (another link, a gap): no item wanted.
  const onListOver = (e) => {
    if (e.pointerType !== 'touch' && !items.some((el) => el.contains(e.target))) hide();
  };

  // Keyboard users get the same highlight on the focused item (but not on
  // mouse clicks, which also focus).
  const onFocusIn = (e) => {
    const item = items.find((el) => el.contains(e.target));
    if (!e.target.matches(':focus-visible')) return;
    if (item) moveTo(item);
    else hide();
  };

  const onFocusOut = (e) => {
    if (!list.contains(e.relatedTarget) && !list.matches(':hover')) hide();
  };

  // Keep the pill on its item if the layout shifts under it (fonts, resize).
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (!current || held) return;
          setTransition(false);
          place(current);
          followUnder(0);
        });
  resizeObserver?.observe(list);

  items.forEach((item) => item.addEventListener('pointerenter', onItemEnter));
  highlight.addEventListener('animationend', onSquashEnd);
  list.addEventListener('pointerleave', hide);
  list.addEventListener('pointerover', onListOver);
  list.addEventListener('focusin', onFocusIn);
  list.addEventListener('focusout', onFocusOut);

  return () => {
    items.forEach((item) => item.removeEventListener('pointerenter', onItemEnter));
    highlight.removeEventListener('animationend', onSquashEnd);
    highlight.removeAttribute(HOVER_MOVING_ATTR);
    list.removeEventListener('pointerleave', hide);
    list.removeEventListener('pointerover', onListOver);
    list.removeEventListener('focusin', onFocusIn);
    list.removeEventListener('focusout', onFocusOut);
    resizeObserver?.disconnect();
    clearUnder();
    items.forEach((item) => setNavGlide(item, null));
    setCurrent(null);
    if (created) highlight.remove();
    else highlight.style.opacity = '0';
    list.style.position = previousListStyle.position;
    list.style.isolation = previousListStyle.isolation;
  };
}

// Layout offset of `el` inside `ancestor`, ignoring transforms — so an open
// animation that scales the dropdown doesn't throw the pill off its item.
function offsetWithin(el, ancestor) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
    if (node && node !== ancestor) {
      x += node.clientLeft;
      y += node.clientTop;
    }
  }
  if (node === ancestor) return { x, y };

  // `ancestor` isn't in the offsetParent chain (e.g. a fixed-position item).
  const a = ancestor.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return { x: b.left - a.left - ancestor.clientLeft, y: b.top - a.top - ancestor.clientTop };
}
