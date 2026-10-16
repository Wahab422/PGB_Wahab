/**
 * Page Transitions — Barba.js, with a "masked window" transition: on an
 * internal link the next page appears through a rounded window that grows
 * from the bottom edge of the screen, rising to the middle as it opens out to
 * the full screen, while the page you're leaving pushes in and dims behind
 * it. No full reload — only the [data-barba="container"] is
 * swapped, then the site's code is torn down and started again for the new
 * page (see src/index.js).
 *
 * ── Switch it on or off in Webflow ───────────────────────────────────────────
 *   Off by default. On for the whole site — in Site settings → Custom code →
 *   Head code:
 *     <meta name="page-transitions" content="on">
 *   (delete it, or set content="off", to switch them off again). Every page
 *   also needs the wrapper and container (already in place):
 *   <div class="page" data-barba="wrapper">
 *     <main class="main" data-barba="container">…</main>
 *   </div>
 *   Off for one page while they're on: data-page-transition="off" on its
 *   wrapper. Off means plain page loads, and Barba isn't even downloaded.
 *   data-barba-prevent on a link (or ="all" on a parent) makes that link a
 *   normal page load. Links that open a new tab, download, go to another site,
 *   or jump to an anchor on the same page are left alone anyway.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The incoming page is shown from its top; the new page's scroll-in
 * animations start once the window has opened. The <title>, meta
 * description, Webflow's page id (for its interactions) and the body's
 * data-page are taken from the new page; Webflow's interactions are
 * restarted. Under prefers-reduced-motion the pages swap without the
 * animation. A page Barba can't swap (no container, a failed request) loads
 * normally.
 */

import { gsap } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';
import { getLenis, startLenis, stopLenis } from './lenis';

const WRAPPER = '[data-barba="wrapper"]';
const CONTAINER = '[data-barba="container"]';
const ON = ['true', 'on', '1', 'yes'];
const OFF = ['false', 'off', '0', 'no'];

const EASE = 'pageWindow';
// Ease in and out: a gentle start, a soft landing.
const EASE_CURVE = '0.7, 0, 0.2, 1';
// Timings from Osmo's reference, about 2% slower.
const WINDOW = {
  // The window opening, and the old page pushing in and dimming behind it.
  duration: 1.17,
  // The incoming page: a screen-shaped window that grows from a point on the
  // bottom edge, its corners — only slightly rounded, to suit the brand's
  // square edges — squaring off as it reaches the full screen…
  radius: 0.25, // rem
  // …and rises to the middle of the screen while it opens (a little quicker).
  fromY: '50vh',
  riseDuration: 0.97,
  // The outgoing page: scales up from the bottom of the screen and dims.
  outScale: 1.2,
  shade: 0.22,
};

const isOn = (value) => ON.includes((value || '').trim().toLowerCase());
const isOff = (value) => OFF.includes((value || '').trim().toLowerCase());

/** Whether this page asks for Barba transitions (see the header). */
export function pageTransitionsEnabled() {
  if (typeof document === 'undefined') return false;
  // Off unless switched on for the site.
  const siteSwitch = document.querySelector('meta[name="page-transitions"]');
  if (!isOn(siteSwitch?.getAttribute('content'))) return false;
  const wrapper = document.querySelector(WRAPPER);
  if (!wrapper || !wrapper.querySelector(CONTAINER)) return false;
  return !isOff(wrapper.getAttribute('data-page-transition'));
}

// What the new page's document says about itself — Barba swaps the
// container only, so the rest has to be copied over by hand.
function adoptPageMeta(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (doc.title) document.title = doc.title;
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  const current = document.querySelector('meta[name="description"]');
  if (description !== undefined && current) current.setAttribute('content', description || '');
  const wfPage = doc.documentElement.getAttribute('data-wf-page');
  if (wfPage) document.documentElement.setAttribute('data-wf-page', wfPage);
  const page = doc.body?.getAttribute('data-page');
  if (page) document.body.setAttribute('data-page', page);
  else document.body.removeAttribute('data-page');
  return { page: page || null };
}

// Webflow's own JS (interactions, forms, its components) for the new content.
function restartWebflow() {
  const webflow = window.Webflow;
  if (!webflow) return;
  try {
    webflow.destroy();
    webflow.ready();
    webflow.require?.('ix2')?.init();
  } catch (error) {
    logger.warn('[Page transition] Webflow restart failed:', error);
  }
}

function toTop() {
  window.scrollTo(0, 0);
  getLenis()?.scrollTo(0, { immediate: true, force: true });
}

// The window at `open` (0 → 1). Written out whole each frame: the browser
// shortens an inset with four equal sides, which GSAP can't tween between.
const windowClip = (open) => {
  const inset = (1 - open) * 50;
  return `inset(${inset}% ${inset}% ${inset}% ${inset}% round ${(1 - open) * WINDOW.radius}rem)`;
};

const isSeeThrough = (color) =>
  !color || color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color);

// The colour behind the page: the container is see-through, the page colour
// comes from the wrapper or body (whichever sets it).
function pageBackground(container) {
  for (let el = container; el; el = el.parentElement) {
    const color = getComputedStyle(el).backgroundColor;
    if (!isSeeThrough(color)) return color;
  }
  return '#fff';
}

// The masked window: both pages are pinned to the screen for the length of
// it, the old one where it was scrolled to.
function maskedWindow(current, next, wrapper) {
  const reduced = prefersReducedMotion();
  const scrollY = window.scrollY;
  const shade = document.createElement('div');
  Object.assign(shade.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2',
    background: '#000',
    opacity: '0',
    pointerEvents: 'none',
  });
  wrapper.append(shade);

  // With both pages pinned the document has nothing to scroll, so the
  // scrollbar would vanish for the transition and come back as it ends,
  // jolting the new page 15px narrower. Keep its space.
  const root = document.documentElement;
  const overflowY = root.style.overflowY;
  if (window.innerWidth > root.clientWidth) root.style.overflowY = 'scroll';

  gsap.set(current, {
    position: 'fixed',
    top: -scrollY,
    left: 0,
    width: '100%',
    zIndex: 1,
    pointerEvents: 'none',
    // The bottom middle of the screen, where the window comes from.
    transformOrigin: `50% ${scrollY + window.innerHeight}px`,
    // Both pages on their own layers while they move, so the frames are
    // composited rather than the pages repainted every one.
    willChange: 'transform',
  });
  gsap.set(next, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    zIndex: 3,
    // The page colour comes with it — otherwise the old page shows through
    // the new one's gaps (the margin and rounded corners of a framed hero)
    // until the swap, then they flip to the page colour.
    backgroundColor: pageBackground(next),
    clipPath: windowClip(0),
    y: WINDOW.fromY,
    willChange: 'transform',
  });
  toTop();

  const done = () => {
    gsap.set(next, {
      clearProps:
        'position,top,left,width,height,overflow,zIndex,backgroundColor,clipPath,transform,willChange',
    });
    shade.remove();
    root.style.overflowY = overflowY;
  };
  if (reduced) {
    done();
    return Promise.resolve();
  }
  const win = { open: 0 };
  return new Promise((resolve) => {
    gsap
      .timeline({
        defaults: { duration: WINDOW.duration, ease: EASE },
        onComplete: () => {
          done();
          resolve();
        },
      })
      .to(current, { scale: WINDOW.outScale }, 0)
      .to(shade, { opacity: WINDOW.shade }, 0)
      .to(
        win,
        {
          open: 1,
          onUpdate: () => {
            next.style.clipPath = windowClip(win.open);
          },
        },
        0
      )
      .to(next, { y: 0, duration: WINDOW.riseDuration }, 0);
  });
}

// The likeliest next pages, fetched ahead in the background: the nav's links
// and the home page (plus any link with data-prefetch, or inside an element
// with it) — at most `max`. Only once the page has loaded and the intro (if
// any) has played, one per idle moment, so it never competes with the page's
// own loading or animation; not on a data-saver or 2G connection, and not
// while the tab is in the background. HTML only (Barba keeps it for the
// transition) — no images or scripts.
const WARM_UP = {
  links: 'nav a[href], a[href="/"], a[data-prefetch], [data-prefetch] a[href]',
  max: 6,
  // After the load event (ms), and the longest wait for an idle moment.
  delay: 1500,
  idleTimeout: 3000,
};

function warmUp(prefetchLink) {
  const connection = navigator.connection;
  if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) return;
  const idle = (fn) =>
    window.requestIdleCallback
      ? window.requestIdleCallback(fn, { timeout: WARM_UP.idleTimeout })
      : setTimeout(fn, 200);
  const later = (fn) => setTimeout(() => idle(fn), WARM_UP.delay);

  const start = () => {
    const seen = new Set();
    const queue = Array.from(document.querySelectorAll(WARM_UP.links)).filter((link) => {
      const key = link.pathname + link.search;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let count = 0;
    const next = () => {
      if (!queue.length || count >= WARM_UP.max) return;
      // Busy (the intro playing) or not being looked at: try again later.
      if (document.hidden || document.documentElement.hasAttribute('data-page-intro-playing')) {
        later(next);
        return;
      }
      const link = queue.shift();
      if (document.contains(link) && prefetchLink(link)) count += 1;
      idle(next);
    };
    later(next);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// Resolves once the next frame has been painted.
const afterNextPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

/**
 * Start Barba. `onStart()` runs as a transition begins (the old page still in
 * place); `onEnter(container)` just before the new page's window opens, with
 * its markup in place but none of its code running yet; `onSwap(info)` once
 * the new page is in place and the old one gone — tear the old page's code
 * down and start the new page's there.
 * Resolves once Barba is running (false if it couldn't start).
 */
export async function initPageTransitions({ onStart, onEnter, onSwap }) {
  if (!pageTransitionsEnabled()) return false;
  // Loaded only when transitions are on — their own chunk.
  let barba;
  let CustomEase;
  try {
    [{ default: barba }, { CustomEase }] = await Promise.all([
      import('@barba/core'),
      import('gsap/CustomEase'),
    ]);
  } catch (error) {
    logger.error('[Page transition] Barba failed to load:', error);
    return false;
  }
  gsap.registerPlugin(CustomEase);
  if (!CustomEase.get(EASE)) CustomEase.create(EASE, EASE_CURVE);

  const wrapper = document.querySelector(WRAPPER);
  // A link that only jumps to an anchor on this page, or is opted out.
  const staysHere = (el, href) => {
    if (el.closest('[data-barba-prevent]')) return true;
    try {
      const url = new URL(href, window.location.href);
      return url.pathname === window.location.pathname && Boolean(url.hash);
    } catch {
      return true;
    }
  };
  barba.init({
    preventRunning: true,
    timeout: 10000,
    // Links on this page that only jump to an anchor stay in-page.
    prevent: ({ el, href }) => staysHere(el, href),
    // A page that can't be fetched loads normally instead.
    requestError: (trigger, action, url) => {
      if (action === 'click' && url) window.location.assign(url);
      return false;
    },
    transitions: [
      {
        name: 'masked-window',
        sync: true,
        before: () => {
          stopLenis();
          try {
            onStart?.();
          } catch (error) {
            logger.error('[Page transition] onStart failed:', error);
          }
        },
        enter: ({ current, next }) => {
          try {
            onEnter?.(next.container);
          } catch (error) {
            logger.error('[Page transition] onEnter failed:', error);
          }
          return maskedWindow(current.container, next.container, wrapper);
        },
        after: async ({ next }) => {
          // Barba gets here in the same task as the window's last frame:
          // let that frame paint before the heavy restart below (parsing the
          // new page's HTML included), or the window sits just short of full
          // screen until it's done, then snaps.
          await afterNextPaint();
          const meta = adoptPageMeta(next.html);
          restartWebflow();
          toTop();
          try {
            await onSwap({ ...meta, container: next.container, namespace: next.namespace });
          } catch (error) {
            logger.error('[Page transition] Starting the new page failed:', error);
          }
          startLenis();
          getLenis()?.resize();
        },
      },
    ],
  });
  // Fetch a page as soon as its link is hovered (or touched / focused), so
  // the transition can start the moment it's clicked instead of after the
  // download. Barba keeps what it fetched.
  const prefetched = new Set();
  // Fetch the page `link` goes to, unless it's this page, another site, a new
  // tab or a download, or it's been fetched already. True if it fetched.
  const prefetchLink = (link) => {
    if (!link || link.target || link.hasAttribute('download')) return false;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || staysHere(link, link.href)) return false;
    const key = url.pathname + url.search;
    if (key === window.location.pathname + window.location.search || prefetched.has(key)) {
      return false;
    }
    prefetched.add(key);
    barba.prefetch(url.href);
    return true;
  };
  const prefetch = (event) => {
    prefetchLink(event.target.closest?.('a[href]'));
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  warmUp(prefetchLink);
  logger.log('🔀 Page transitions on (Barba)');
  return true;
}
