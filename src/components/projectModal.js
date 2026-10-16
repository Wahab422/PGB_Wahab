/**
 * Project Modal — the Projects page's "View project" buttons open one shared
 * modal and fill it with that project's panel, taken from its CMS template
 * page (/project/<slug>). The Projects Template page renders just the panel,
 * so a project is edited in the CMS and its panel designed once, on the
 * template. Initialised from src/global/index.js on pages that have a
 * [data-project-modal].
 *
 * ── Markup (attributes in Webflow) ───────────────────────────────────────────
 * Projects page:
 *   <button data-project="{Slug}">View project</button>          ← each card
 *   <section data-project-modal="/project/" data-modal-name="project"
 *            data-modal-close-outside id="project-modal" class="modal">
 *     <div data-project-modal-slot class="modal-content">
 *       <div class="modal-content-head"><div data-modal-close>−</div></div>
 *       ← the project's panel goes here
 *     </div>
 *   </section>
 * Projects Template page (/project/<slug>):
 *   <div data-project-inner class="modal-inner">…</div>
 *
 *   data-project-modal="/project/"   the template pages' path (the CMS
 *                                    collection's slug); default /project/.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * A click on a [data-project] opens the modal straight away (modal-basic.js:
 * focus trap, scroll lock, Esc, a click outside the panel or the − closes)
 * and loads the project's page; its [data-project-inner] fades up in as soon
 * as it's there. Pages load ahead on hover / focus, and each only once, so
 * reopening a project is instant. Every opening puts in a fresh copy of the
 * panel, scrolled to the top, so its animation attributes (data-split-text,
 * data-fade, data-stagger-in, data-reveal-image) play each time, as they
 * scroll into view in the modal (animations/panelReveal.js), and its "more
 * projects" block opens with the modal's scroll (animations/moreProject.js);
 * its hotspots and its buttons' arrow hover are wired as it goes in
 * (components/hotspots.js, components/button.js — the page's own were set
 * up before the panel was there). The modal scrolls smoothly,
 * with a Lenis of its own (see smoothScroll below). If a page can't be loaded,
 * the browser goes to it instead. cleanupProjectModal() takes it all back off.
 */

import Lenis from 'lenis';
import { openModalBasic } from './modal-basic';
import { animatePanel, PANEL_ATTR } from '../animations/panelReveal';
import { animateMoreProjects } from '../animations/moreProject';
import { getLenis } from '../global/lenis';
import { gsap } from '../utils/gsapCore';
import { logger } from '../utils/logger';

const SELECTORS = {
  trigger: '[data-project]',
  modal: '[data-project-modal]',
  slot: '[data-project-modal-slot]',
  inner: '[data-project-inner]',
  close: '[data-modal-close]',
  hotspots: '[data-hotspots]',
  arrowButton: 'svg[btn-animate-svg]',
};
// While the project's page loads (on the modal).
const LOADING_ATTR = 'data-project-modal-loading';
// On the panel as it goes in: src/styles/project-modal.css fades it up.
const ENTER_ATTR = 'data-project-inner-enter';
const DEFAULT_PATH = '/project/';

// url → Promise<Element | null>: the page's panel, fetched once.
const pages = new Map();
let teardown = null;

function loadPanel(url) {
  if (!pages.has(url)) {
    const request = fetch(url, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return response.text();
      })
      .then((html) => {
        const page = new DOMParser().parseFromString(html, 'text/html');
        const panel = page.querySelector(SELECTORS.inner);
        if (!panel) throw new Error(`no ${SELECTORS.inner} on ${url}`);
        return panel;
      })
      .catch((error) => {
        pages.delete(url); // try again next time
        logger.error('[ProjectModal] could not load the project:', error);
        return null;
      });
    pages.set(url, request);
  }
  return pages.get(url);
}

// A div as the close button: keyboard + screen readers.
function asButton(el, label) {
  if (!el || el.matches('button, a[href]')) return () => {};
  const added = ['role', 'tabindex', 'aria-label'].filter((name) => !el.hasAttribute(name));
  if (added.includes('role')) el.setAttribute('role', 'button');
  if (added.includes('tabindex')) el.setAttribute('tabindex', '0');
  if (added.includes('aria-label')) el.setAttribute('aria-label', label);
  const onKey = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    el.click();
  };
  el.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('keydown', onKey);
    added.forEach((name) => el.removeAttribute(name));
  };
}

/**
 * The modal's own smooth scroll: a Lenis on the modal, set like the page's
 * (src/global/lenis.js) and driven by the same GSAP ticker. Only where the
 * page has one — not under reduced motion — and only for a mouse, as there:
 * touch scrolls natively. Stopped while the modal is closed. The page's Lenis
 * leaves the modal alone (modal-basic.js marks it data-lenis-prevent and
 * stops the page's while it's open); this one only reads events inside it.
 */
function smoothScroll(modal, content) {
  const pointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (!getLenis() || !pointer) return null;
  const lenis = new Lenis({
    wrapper: modal,
    content,
    eventsTarget: modal,
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    lerp: 0.1,
    smoothWheel: true,
    autoResize: true,
    allowNestedScroll: true,
  });
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  lenis.stop();
  return {
    // Back to the top at once (an opening), then scrolling.
    start() {
      lenis.scrollTo(0, { immediate: true, force: true });
      lenis.start();
      lenis.resize();
    },
    stop: () => lenis.stop(),
    resize: () => lenis.resize(),
    destroy() {
      gsap.ticker.remove(tick);
      lenis.destroy();
    },
  };
}

export function initProjectModal() {
  if (typeof document === 'undefined' || teardown) return;
  const modal = document.querySelector(SELECTORS.modal);
  const name = modal?.getAttribute('data-modal-name');
  if (!modal || !name) {
    if (modal) logger.warn('[ProjectModal] the modal needs a data-modal-name');
    return;
  }
  const slot = modal.querySelector(SELECTORS.slot) || modal;
  const path = (modal.getAttribute('data-project-modal') || DEFAULT_PATH).replace(/\/?$/, '/');
  const urlOf = (slug) => `${path}${encodeURIComponent(slug)}`;
  const slugOf = (trigger) => trigger.getAttribute('data-project')?.trim();
  const cleanups = [asButton(modal.querySelector(SELECTORS.close), 'Close')];
  const listen = (type, handler, options) => {
    document.addEventListener(type, handler, options);
    cleanups.push(() => document.removeEventListener(type, handler, options));
  };

  let shown = null; // { slug, panel, hotspots, buttons, animations, more }
  let latest = 0; // the last project asked for wins
  const scroll = smoothScroll(modal, slot === modal ? modal.firstElementChild : slot);
  if (scroll) {
    const stop = () => scroll.stop();
    modal.addEventListener('modal:close', stop);
    cleanups.push(() => {
      modal.removeEventListener('modal:close', stop);
      scroll.destroy();
    });
  }

  const clear = () => {
    if (!shown) return;
    shown.hotspots?.cleanupHotspots(shown.panel);
    shown.buttons?.cleanupArrowButtons(shown.panel);
    shown.animations();
    shown.more.cleanup();
    shown.panel.remove();
    shown = null;
  };

  const show = async (slug, trigger) => {
    const ask = ++latest;
    // From inside (another project from this one): the modal stays open and
    // the button goes with the old panel, so focus moves to the close.
    const swapping = modal.contains(trigger);
    openModalBasic(name, trigger);
    // A fresh panel every time, even for the project just closed, so its
    // animations play on each opening (the page itself comes from the cache).
    clear();
    modal.scrollTop = 0;
    scroll?.start();
    modal.setAttribute(LOADING_ATTR, '');
    slot.setAttribute('aria-busy', 'true');
    const source = await loadPanel(urlOf(slug));
    if (ask !== latest) return;
    modal.removeAttribute(LOADING_ATTR);
    slot.removeAttribute('aria-busy');
    if (!source) {
      window.location.assign(urlOf(slug));
      return;
    }

    const panel = document.importNode(source, true);
    // A click anywhere outside the panel closes (modal-basic.js).
    panel.setAttribute('data-modal-content', '');
    // Before it's in: the site-wide image reveal leaves it alone.
    panel.setAttribute(PANEL_ATTR, '');
    panel.setAttribute(ENTER_ATTR, '');
    slot.append(panel);
    scroll?.resize();
    if (swapping) modal.querySelector(SELECTORS.close)?.focus({ preventScroll: true });
    // Its elements' animations, played as they scroll into view in the modal.
    shown = {
      slug,
      panel,
      hotspots: null,
      buttons: null,
      animations: animatePanel(panel, modal),
      more: animateMoreProjects(panel, modal),
    };
    const { more } = shown;
    // Measured again once it's done moving in.
    panel.addEventListener(
      'animationend',
      () => {
        panel.removeAttribute(ENTER_ATTR);
        more.refresh();
      },
      { once: true }
    );
    const title = panel.querySelector('h1, h2, h3')?.textContent.trim();
    if (title) modal.setAttribute('aria-label', title);

    // Its buttons' arrow hover (the page's own were wired before it was here).
    if (panel.querySelector(SELECTORS.arrowButton)) {
      import('./button')
        .then((buttons) => {
          if (shown?.panel !== panel) return;
          shown.buttons = buttons;
          buttons.initArrowButtons(panel);
        })
        .catch((error) => logger.error('[ProjectModal] arrow buttons:', error));
    }
    if (panel.querySelector(SELECTORS.hotspots)) {
      const hotspots = await import('./hotspots');
      if (shown?.panel !== panel) return;
      shown.hotspots = hotspots;
      hotspots.initHotspots(panel);
    }
  };

  listen('click', (event) => {
    // One inside the modal (the "more projects" button) swaps it to that one.
    const trigger = event.target.closest(SELECTORS.trigger);
    const slug = trigger && slugOf(trigger);
    if (!slug) return;
    event.preventDefault();
    show(slug, trigger).catch((error) => logger.error('[ProjectModal]', error));
  });
  // Load ahead, so the panel is usually there by the time of the click.
  const warm = (event) => {
    const trigger = event.target.closest?.(SELECTORS.trigger);
    const slug = trigger && slugOf(trigger);
    if (slug) loadPanel(urlOf(slug));
  };
  listen('pointerover', warm, { passive: true });
  listen('focusin', warm);

  const triggers = Array.from(document.querySelectorAll(SELECTORS.trigger));
  if (!modal.id) modal.id = 'project-modal';
  triggers.forEach((trigger) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', modal.id);
  });

  teardown = () => {
    cleanups.forEach((fn) => fn());
    clear();
    modal.removeAttribute(LOADING_ATTR);
    slot.removeAttribute('aria-busy');
    triggers.forEach((trigger) => {
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-controls');
    });
  };
  logger.log(`🗂️ Project modal ready (${triggers.length} projects)`);
}

export function cleanupProjectModal() {
  teardown?.();
  teardown = null;
}
