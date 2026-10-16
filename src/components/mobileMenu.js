/**
 * Mobile Menu — the navbar's menu on phones (up to 767px, where Webflow shows
 * the Menu button and hides the menu panel). The button opens the full-screen
 * panel: it uncovers from the top down like a blind, then its links rise in
 * one after another; the button's label rolls from "Menu" to "Close". Closing
 * lifts the links away and draws the panel back up, the label rolling back.
 * Initialised from src/global/navbar.js.
 *
 * ── Markup (attributes in the Navbar component) ──────────────────────────────
 *   <div nav class="nav">
 *     <div nav-menu class="menu">…links, the Solutions list, Contact sales…</div>
 *     <a class="nav-link">logo</a>
 *     <div class="nav-foot">… <div menu-btn class="menu-btn">Menu</div></div>
 *   </div>
 *
 * ── Options ──────────────────────────────────────────────────────────────────
 *   menu-btn-close="Close"   the button's label while open (default "Close");
 *                            the closed label is the button's own text
 *   nav-menu-item            on elements to rise in, in place of the default:
 *                            the panel's visible links and buttons (a
 *                            dropdown's whole label, arrow included)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * While open the page doesn't scroll (Lenis is stopped; the panel itself
 * scrolls if it's taller than the screen), Tab stays inside the navbar, and
 * Escape or a link closes it (a "#" link — the Solutions label — doesn't).
 * Its dropdowns ([nav-submenu]) are accordions: open to start with, folded
 * away and back by a tap on their label (see initAccordions).
 * The button is a real button for the keyboard and screen readers (Enter /
 * Space, aria-expanded, "Open menu" / "Close menu"). Opened or closed mid-way,
 * it carries on from where it is. Widening past the phone layout puts it all
 * straight back. Under prefers-reduced-motion it fades in and out. The panel
 * is shown by src/styles/mobile-menu.css (Webflow keeps it display: none).
 * cleanupMobileMenu() restores the authored markup.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { getLenis, startLenis, stopLenis } from '../global/lenis';
import { getInitialFocusTarget, trapTabKey } from '../utils/focus';
import { listRows } from './navSubmenu';

const SELECTORS = {
  nav: '[nav]',
  menu: '[nav-menu]',
  button: '[menu-btn]',
  item: '[nav-menu-item]',
  submenu: '[nav-submenu]',
};
// On the menu while it's on screen (open, or closing): mobile-menu.css shows it.
const SHOWN_ATTR = 'nav-menu-shown';
// On the nav while the menu is open.
const OPEN_ATTR = 'nav-menu-open';
const LABELS_ATTR = 'menu-btn-labels';
// On a dropdown folded away in the phone menu.
const ACCORDION_CLOSED_ATTR = 'nav-submenu-closed';
const PHONE = '(max-width: 767px)';

const MOTION = {
  // The panel uncovering / drawing back up.
  panel: { open: 0.85, close: 0.65, ease: 'power4.inOut' },
  // The links rising in after it, and lifting away first on the way out.
  items: { rise: 48, duration: 0.9, ease: 'power3.out', each: 0.05, at: 0.35, leave: 0.3 },
  // The label roll.
  label: { duration: 0.6, ease: 'power3.inOut' },
  // A dropdown folding away / unfolding, its rows rising back in.
  accordion: { duration: 0.6, ease: 'power3.inOut', rise: 16, each: 0.04 },
};
const COVERED = 'inset(0% 0% 100% 0%)';
const OPEN = 'inset(0% 0% 0% 0%)';

let teardown = null;

// What rises in: [nav-menu-item]s, else the panel's visible links and buttons
// (a dropdown's label as a whole, its arrow with it), in order.
function itemsOf(menu) {
  const chosen = menu.querySelectorAll(SELECTORS.item);
  const found = chosen.length ? Array.from(chosen) : Array.from(menu.querySelectorAll('a, button'));
  const items = found.map((el) => {
    const submenu = el.closest(SELECTORS.submenu);
    const label = submenu?.firstElementChild;
    return label?.contains(el) ? label : el;
  });
  return [...new Set(items)].filter((el) => el.getClientRects().length);
}

/**
 * The menu's dropdowns ([nav-submenu], the Solutions list) as accordions on
 * phones: open to start with, as Webflow lays them out; a tap on the label or
 * its arrow folds the list away (its rows lifting out, the arrow turning
 * down) and unfolds it again (the rows rising back in). The desktop dropdown
 * (components/navSubmenu.js) does nothing below its breakpoint, so the two
 * never meet. Returns { reset, cleanup }: reset() puts them back open at once.
 */
function initAccordions(menu, phone, reduced) {
  const accordions = Array.from(menu.querySelectorAll(SELECTORS.submenu))
    .map((root) => {
      const label = root.firstElementChild;
      const panel = root.lastElementChild;
      if (!label || !panel || label === panel) return null;
      const link = label.querySelector('a') || label;
      const arrow = label.querySelector('svg');
      const rows = () => listRows(panel).filter((row) => row.offsetHeight);
      let open = true;
      let timeline = null;

      const set = (value) => {
        open = value;
        root.toggleAttribute(ACCORDION_CLOSED_ATTR, !open);
        link.setAttribute('aria-expanded', String(open));
        // Folded away: out of the Tab order too.
        panel.inert = !open;
      };
      const toggle = () => {
        set(!open);
        timeline?.kill();
        const { duration, ease, rise, each } = MOTION.accordion;
        timeline = gsap.timeline({
          onComplete: () => {
            if (open)
              gsap.set([panel, ...rows()], { clearProps: 'height,overflow,opacity,transform' });
          },
        });
        if (arrow) timeline.to(arrow, { rotation: open ? 0 : -90, duration, ease }, 0);
        if (reduced) {
          timeline.set(panel, { height: open ? 'auto' : 0, overflow: 'clip' }, 0);
          return;
        }
        gsap.set(panel, { overflow: 'clip' });
        if (open) {
          gsap.set(rows(), { y: rise, opacity: 0 });
          timeline
            .fromTo(panel, { height: 0 }, { height: 'auto', duration, ease }, 0)
            .to(rows(), { y: 0, opacity: 1, duration, ease, stagger: each }, 0.08);
        } else {
          timeline
            .to(rows(), { y: -8, opacity: 0, duration: duration * 0.5, ease: 'power2.in' }, 0)
            .to(panel, { height: 0, duration, ease }, 0.05);
        }
      };
      const onClick = (event) => {
        if (!phone.matches) return;
        event.preventDefault();
        toggle();
      };
      label.addEventListener('click', onClick);
      // Open, at once. aria-expanded: open on phones; on desktop the
      // dropdown's own closed state (components/navSubmenu.js).
      const reset = () => {
        timeline?.kill();
        open = true;
        root.removeAttribute(ACCORDION_CLOSED_ATTR);
        panel.inert = false;
        link.setAttribute('aria-expanded', String(phone.matches));
        gsap.set([panel, ...listRows(panel)], {
          clearProps: 'height,overflow,opacity,transform',
        });
        if (arrow) gsap.set(arrow, { clearProps: 'transform' });
      };
      reset();
      return {
        reset,
        cleanup: () => {
          label.removeEventListener('click', onClick);
          reset();
        },
      };
    })
    .filter(Boolean);

  return {
    reset: () => accordions.forEach((a) => a.reset()),
    cleanup: () => accordions.forEach((a) => a.cleanup()),
  };
}

// The button's label as two stacked lines in a clipped box — the closed one
// and the open one — so it can roll between them.
function buildLabels(button) {
  const original = button.innerHTML;
  const closed = button.textContent.trim() || 'Menu';
  const open = button.getAttribute('menu-btn-close') || 'Close';
  const box = document.createElement('span');
  box.setAttribute(LABELS_ATTR, '');
  box.setAttribute('aria-hidden', 'true');
  const lines = [closed, open].map((text) => {
    const line = document.createElement('span');
    line.textContent = text;
    box.append(line);
    return line;
  });
  button.replaceChildren(box);
  gsap.set(lines[1], { yPercent: 100 });
  return {
    lines,
    restore: () => {
      button.innerHTML = original;
    },
  };
}

export function initMobileMenu() {
  if (typeof document === 'undefined' || teardown) return;
  const nav = document.querySelector(SELECTORS.nav);
  const menu = nav?.querySelector(SELECTORS.menu);
  const button = nav?.querySelector(SELECTORS.button);
  if (!menu || !button) return;

  const phone = window.matchMedia(PHONE);
  const reduced = prefersReducedMotion();
  const labels = buildLabels(button);
  const accordions = initAccordions(menu, phone, reduced);
  const added = [];
  const setOwn = (el, name, value) => {
    if (el.hasAttribute(name)) return;
    el.setAttribute(name, value);
    added.push([el, name]);
  };
  if (!menu.id) setOwn(menu, 'id', 'nav-menu');
  if (!button.matches('button')) {
    setOwn(button, 'role', 'button');
    setOwn(button, 'tabindex', '0');
  }
  setOwn(button, 'aria-controls', menu.id);
  // The panel scrolls itself when it's taller than the screen (the page's
  // Lenis leaves it alone).
  setOwn(menu, 'data-lenis-prevent', '');

  let open = false;
  let timeline = null;
  let items = [];

  const name = () => button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  const lockScroll = (lock) => {
    if (lock) stopLenis();
    else startLenis();
    if (getLenis()) return;
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  };
  const roll = (to) => {
    const [closed, opened] = labels.lines;
    const { duration, ease } = MOTION.label;
    const up = to === 'open';
    return [
      [closed, { yPercent: up ? -100 : 0, duration, ease }],
      [opened, { yPercent: up ? 0 : 100, duration, ease }],
    ];
  };

  // Back to closed at once: widening past the phone layout, cleanup.
  const reset = () => {
    timeline?.kill();
    timeline = null;
    if (open) lockScroll(false);
    open = false;
    nav.removeAttribute(OPEN_ATTR);
    menu.removeAttribute(SHOWN_ATTR);
    gsap.set([menu, ...items], { clearProps: 'clipPath,opacity,visibility,transform' });
    gsap.set(labels.lines[0], { yPercent: 0 });
    gsap.set(labels.lines[1], { yPercent: 100 });
    button.setAttribute('aria-expanded', 'false');
    name();
  };

  const show = ({ focus = false } = {}) => {
    if (open || !phone.matches) return;
    const fromClosed = !menu.hasAttribute(SHOWN_ATTR);
    open = true;
    timeline?.kill();
    nav.setAttribute(OPEN_ATTR, '');
    menu.setAttribute(SHOWN_ATTR, '');
    menu.scrollTop = 0;
    button.setAttribute('aria-expanded', 'true');
    name();
    lockScroll(true);
    items = itemsOf(menu);

    timeline = gsap.timeline();
    roll('open').forEach(([el, vars]) => timeline.to(el, vars, 0));
    if (reduced) {
      if (fromClosed) gsap.set(menu, { opacity: 0 });
      timeline.to(menu, { opacity: 1, duration: 0.25, ease: 'none' }, 0);
    } else {
      const { rise, duration, ease, each, at } = MOTION.items;
      if (fromClosed) {
        gsap.set(menu, { clipPath: COVERED });
        // Opacity only (not visibility), so the keyboard can land on them at once.
        gsap.set(items, { y: rise, opacity: 0 });
      }
      timeline
        .to(menu, { clipPath: OPEN, duration: MOTION.panel.open, ease: MOTION.panel.ease }, 0)
        .to(items, { y: 0, opacity: 1, duration, ease, stagger: each }, fromClosed ? at : 0);
    }
    // From the keyboard: into the menu, on its first link.
    if (focus)
      requestAnimationFrame(() => getInitialFocusTarget(menu)?.focus({ preventScroll: true }));
  };

  const hide = ({ focus = false } = {}) => {
    if (!open) return;
    open = false;
    timeline?.kill();
    nav.removeAttribute(OPEN_ATTR);
    button.setAttribute('aria-expanded', 'false');
    name();
    lockScroll(false);
    if (focus) button.focus({ preventScroll: true });

    timeline = gsap.timeline({
      onComplete: () => {
        menu.removeAttribute(SHOWN_ATTR);
        gsap.set([menu, ...items], { clearProps: 'clipPath,opacity,visibility,transform' });
      },
    });
    roll('close').forEach(([el, vars]) => timeline.to(el, vars, 0));
    if (reduced) {
      timeline.to(menu, { opacity: 0, duration: 0.2, ease: 'none' }, 0);
    } else {
      timeline
        .to(items, { y: -16, opacity: 0, duration: MOTION.items.leave, ease: 'power2.in' }, 0)
        .to(
          menu,
          { clipPath: COVERED, duration: MOTION.panel.close, ease: MOTION.panel.ease },
          MOTION.items.leave * 0.5
        );
    }
  };

  const toggle = (event) => {
    // A keyboard press arrives as a click with no pointer (detail 0).
    const focus = event?.detail === 0;
    if (open) hide({ focus });
    else show({ focus });
  };

  const onButtonKey = (event) => {
    if (button.matches('button') || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggle({ detail: 0 });
  };
  const onMenuClick = (event) => {
    const link = event.target.closest('a[href]');
    const href = link?.getAttribute('href');
    if (open && href && href !== '#') hide();
  };
  const onKey = (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      hide({ focus: true });
    } else if (event.key === 'Tab') {
      trapTabKey(event, nav);
    }
  };
  const onLayout = () => {
    if (!phone.matches) reset();
    accordions.reset();
  };

  button.addEventListener('click', toggle);
  button.addEventListener('keydown', onButtonKey);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('keydown', onKey);
  phone.addEventListener('change', onLayout);
  reset();

  teardown = () => {
    reset();
    button.removeEventListener('click', toggle);
    button.removeEventListener('keydown', onButtonKey);
    menu.removeEventListener('click', onMenuClick);
    document.removeEventListener('keydown', onKey);
    phone.removeEventListener('change', onLayout);
    accordions.cleanup();
    labels.restore();
    button.removeAttribute('aria-expanded');
    button.removeAttribute('aria-label');
    added.forEach(([el, attr]) => el.removeAttribute(attr));
  };
}

export function cleanupMobileMenu() {
  teardown?.();
  teardown = null;
}
