/**
 * Page Intro — the homepage's opening, on a fresh load (every one, or the
 * first of a browser session — the head code below decides):
 *   1. A white screen with one line across its middle — a caption on the
 *      left, the wordmark, a caption on the right — rising in through their
 *      masks, as the site's text does: the wordmark first.
 *   2. Held a moment, they leave upwards the same way, and the hero comes up
 *      right behind them as a panel from below the screen — one lift. Its
 *      background lags a little behind the panel and settles from a slight
 *      zoom; the picture on it (the frame, a cut-out) rises into place a beat
 *      behind, still settling after the panel lands, and the glow behind it
 *      comes on.
 *   3. The nav comes down from above the screen, its logo first — the
 *      wordmark that just left upwards, dropping into its place.
 *   4. The hero's heading rises in line by line and the scroll cue follows,
 *      on the line the captions held.
 * Initialised from src/global/index.js before the hero picture's own entrance
 * (src/animations/zoomIn.js), which it replaces when it plays.
 *
 * ── Markup (Webflow) ─────────────────────────────────────────────────────────
 *   <div data-page-intro class="page-intro">                       ← display: none
 *     <div class="eyebrow">Glass partitions and moving walls</div>   ← left caption
 *     <div class="eyebrow">For design-driven interiors</div>         ← right caption
 *   </div>
 *   Anywhere on the page, hidden (display: none) in Webflow: while the intro
 *   plays it's shown across the middle of the screen, behind the hero
 *   (src/styles/page-intro.css). Style the captions there as you like. The
 *   wordmark between them is a copy of the nav's logo, made by the script —
 *   the logo is the link with data-page-intro-logo, else the first link to
 *   "/", an svg drawn in currentColor. The logo and its siblings (the rest of
 *   the nav) are what come down. The hero is the [data-hero] section: its
 *   [data-parallax] layer is the background, its [data-zoom-in] the picture
 *   on it, and the text beside its heading in [data-scroll-fade] the cue.
 *
 *   Head code (the page's, in Webflow) — the switch: it marks the loads the
 *   intro plays on, and keeps the page hidden until it starts, so it doesn't
 *   show for a moment first (bw-intro-failsafe, already there, shows the page
 *   anyway after 4s). once=false plays it on every load; once=true on the
 *   first of a browser session only (and again with ?intro in the URL):
 *     <script>try{var once=false;if(!once||!sessionStorage.getItem('page-intro-seen')||/[?&]intro\b/.test(location.search))document.documentElement.setAttribute('data-page-intro-pending','')}catch(e){}</script>
 *     <style>@media (prefers-reduced-motion: no-preference){html[data-page-intro-pending] body:has([data-page-intro])>*{visibility:hidden;animation:bw-intro-failsafe 0s linear 4s forwards}}</style>
 *   Without it the intro doesn't play.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Plays on the loads the head code marks: not when the page comes in through
 * a page transition (that's its entrance — and the head code doesn't run
 * then), not when it opens on a #section, and not under
 * prefers-reduced-motion. The page can't be scrolled or used until the nav
 * is in. The captions wait for the fonts (so they break as they will), and
 * leave only once the hero's picture is in (so it doesn't rise empty) —
 * each for a limited time.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { fontsReady, splitLines } from '../utils/splitLines';
import { startLenis, stopLenis } from '../global/lenis';
import { showZoomIns } from './zoomIn';
import { playSplitText } from './splitText';

const SELECTORS = {
  root: '[data-page-intro]',
  logo: '[data-page-intro-logo]',
  home: 'a[href="/"]',
  // The previous names (data-hero-intro…) still work.
  hero: '[data-hero], [data-hero-intro]',
  bg: '[data-parallax], [data-hero-intro-bg]',
  image: '[data-zoom-in], [data-hero-intro-image]',
  text: '[data-scroll-fade], [data-hero-intro-text]',
  splitText: '[data-split-text]',
};
// On <html>: set by the head code before first paint on the loads the intro
// plays on (the page stays hidden), then while it plays, and while it holds
// the scroll.
const PENDING_ATTR = 'data-page-intro-pending';
const PLAYING_ATTR = 'data-page-intro-playing';
const LOCKED_ATTR = 'data-page-intro-locked';
// The wordmark between the captions (a copy of the nav's logo, in its mask).
const MARK_ATTR = 'data-page-intro-mark';
// On the hero: its [data-split-text] heading plays when told (splitText.js).
const HELD_ATTR = 'data-split-text-held';
// Played this session — read by the head code when it's set to once=true.
const SEEN_KEY = 'page-intro-seen';

const MOTION = {
  // 1. Rising into their masks (% of their height): the wordmark, then the
  // captions.
  in: { from: 120, duration: 1.2, ease: 'power3.out', stagger: 0.1 },
  // Leaving upwards at `at` (later if the hero's picture is still loading):
  // the captions, then the wordmark.
  out: { at: 1.55, to: -120, duration: 0.65, ease: 'power3.in', stagger: 0.05 },
  // 2. The hero rising, `after` their leaving starts. Its picture starts
  // `lag` of the screen higher inside it and zoomed to `zoom`, and settles —
  // the zoom over `settle`.
  rise: {
    after: 0.15,
    duration: 1.3,
    ease: 'power4.inOut',
    lag: 0.1,
    zoom: 1.12,
    settle: 2.4,
    settleEase: 'power2.out',
  },
  // From the rise's start: the hero's picture rising into place from `rise`%
  // of its height lower, and zoomed (from its bottom right, where it sits)…
  picture: { at: 0.5, rise: 20, zoom: 1.06, duration: 2.0, ease: 'power3.out' },
  // …and the rest of the background (the glow behind it) coming on.
  glow: { at: 0.9, duration: 1.8, ease: 'power2.out' },
  // 3–4. From the rise's start. The nav's items start `above` px above the
  // screen.
  nav: { at: 1.0, above: 24, duration: 1.1, ease: 'power3.out', stagger: 0.08 },
  heading: { at: 1.15 },
  cue: { at: 1.4, y: 10, duration: 1.2, ease: 'power3.out' },
  // The scroll is free again.
  unlock: 1.3,
  // Longest waits (ms) for the fonts and the hero's picture.
  waits: { fonts: 1500, image: 3000 },
  // Past this (ms into the page load) the head code's failsafe has shown the
  // page already, so it isn't hidden again for the intro.
  late: 3500,
};

let firstLoad = true;
let cleanup = null;

const remember = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked — the head code plays it on every load then
  }
};

const within = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

const loaded = (img) => {
  if (!img) return Promise.resolve();
  const ready = img.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
  return ready.then(() => img.decode?.()).catch(() => {});
};

// The hero's scroll cue: the text beside its heading.
function findCue(hero) {
  const text = hero.querySelector(SELECTORS.text);
  if (!text) return null;
  const heading = `h1, h2, h3, h4, h5, h6, ${SELECTORS.splitText}`;
  return (
    Array.from(text.children).find(
      (el) => !el.matches(heading) && !el.querySelector(SELECTORS.splitText)
    ) || null
  );
}

// The wordmark between the captions: a copy of the nav's logo, as wide, in
// a mask of its own.
function makeMark(root, logo, captions) {
  const mark = document.createElement('div');
  mark.setAttribute(MARK_ATTR, '');
  mark.setAttribute('aria-hidden', 'true');
  mark.style.width = `${logo.getBoundingClientRect().width}px`;
  const art = (logo.querySelector('svg, img') || logo).cloneNode(true);
  art.removeAttribute('id');
  mark.append(art);
  if (captions[0]) captions[0].after(mark);
  else root.append(mark);
  return { mark, art };
}

function play({ root, hero, logo }) {
  const html = document.documentElement;
  // What comes down from the top: the logo first, then the rest of the nav.
  const nav = [logo, ...Array.from(logo.parentElement.children).filter((el) => el !== logo)];
  const bg = hero.querySelector(SELECTORS.bg);
  const image = hero.querySelector(SELECTORS.image);
  // The background's other layers (its glow).
  const glow = bg
    ? Array.from(bg.children).filter((el) => el !== image && !el.contains(image))
    : [];
  const headings = Array.from(hero.querySelectorAll(SELECTORS.splitText));
  const cue = findCue(hero);
  const captions = Array.from(root.children);
  const blocked = nav.map((el) => [el, el.inert]);
  // How far up each nav item starts: just past the screen's top. Measured
  // now, before anything moves (a measure taken once the tween starts would
  // see the item already moved — and find nothing to travel).
  const drops = nav.map((el) => -(el.getBoundingClientRect().bottom + MOTION.nav.above));
  const { mark, art } = makeMark(root, logo, captions);
  const { in: enter, out: leave, rise } = MOTION;

  // ── The stage: everything where the intro starts it ────────────────────────
  html.setAttribute(PLAYING_ATTR, '');
  html.setAttribute(LOCKED_ATTR, '');
  stopLenis();
  hero.setAttribute(HELD_ATTR, '');
  showZoomIns(document); // its own entrance is this
  blocked.forEach(([el]) => {
    el.inert = true;
  });
  // Above the captions (src/styles/page-intro.css puts them at z-index 0).
  const style = getComputedStyle(hero);
  const lift = {};
  if (style.position === 'static') lift.position = 'relative';
  if (style.zIndex === 'auto') lift.zIndex = 1;
  gsap.set(hero, { ...lift, y: window.innerHeight });
  if (bg) gsap.set(bg, { y: -window.innerHeight * rise.lag, scale: rise.zoom });
  gsap.set([...nav, ...captions, cue].filter(Boolean), { autoAlpha: 0 });
  gsap.set(art, { yPercent: enter.from });
  html.removeAttribute(PENDING_ATTR);

  // The picture, loading meanwhile: the captions don't leave without it.
  let pictureIn = false;
  const picture = within(loaded(image), MOTION.waits.image).then(() => {
    pictureIn = true;
  });

  let cancelled = false;
  let done = false;
  let timeline = null;
  let splits = [];
  // Where the caption lines are, for lines a re-split (a resize) replaces.
  let place = enter.from;
  const placeAt = (yPercent) => () => {
    place = yPercent;
  };

  const unlock = () => {
    html.removeAttribute(LOCKED_ATTR);
    startLenis();
  };

  const finish = () => {
    if (done) return;
    done = true;
    splits.forEach((split) => split.revert());
    mark.remove();
    gsap.set([...nav, ...captions, cue].filter(Boolean), {
      clearProps: 'transform,opacity,visibility',
    });
    gsap.set(hero, { clearProps: ['transform', ...Object.keys(lift)].join(',') });
    if (bg) gsap.set(bg, { y: 0, scale: 1 });
    if (image) gsap.set(image, { clearProps: 'transform,transformOrigin' });
    gsap.set(glow, { clearProps: 'opacity' });
    blocked.forEach(([el, inert]) => {
      el.inert = inert;
    });
    hero.removeAttribute(HELD_ATTR);
    html.removeAttribute(PLAYING_ATTR);
    unlock();
    // Measured while the hero was below the screen.
    ScrollTrigger.refresh();
  };

  const run = () => {
    const lines = splits.flatMap((split) => split.lines());
    const { nav: n, heading, cue: c } = MOTION;
    const risesAt = leave.at + rise.after;
    timeline = gsap.timeline({ onComplete: finish });

    // 1. In: the wordmark, then the captions.
    timeline
      .set(captions, { autoAlpha: 1 }, 0)
      .to(art, { yPercent: 0, duration: enter.duration, ease: enter.ease }, 0)
      .to(lines, { yPercent: 0, duration: enter.duration, ease: enter.ease }, enter.stagger)
      .call(placeAt(0), null, enter.stagger);

    // …held until the picture is in.
    if (!pictureIn) timeline.addPause(leave.at, () => picture.then(() => timeline.play()));

    // 2. Out — the captions, then the wordmark — and the hero up behind them.
    const out = { yPercent: leave.to, duration: leave.duration, ease: leave.ease };
    timeline
      .to(lines, out, leave.at)
      .to(art, out, leave.at + leave.stagger)
      .call(placeAt(leave.to), null, leave.at)
      .to(hero, { y: 0, duration: rise.duration, ease: rise.ease }, risesAt);
    if (bg) {
      timeline
        .to(bg, { y: 0, duration: rise.duration, ease: rise.ease }, risesAt)
        .to(bg, { scale: 1, duration: rise.settle, ease: rise.settleEase }, risesAt);
    }
    // The picture rising into place a beat behind the panel, the glow coming on.
    const { picture: p, glow: g } = MOTION;
    if (image) {
      timeline.fromTo(
        image,
        { yPercent: p.rise, scale: p.zoom, transformOrigin: '100% 100%' },
        { yPercent: 0, scale: 1, duration: p.duration, ease: p.ease },
        risesAt + p.at
      );
    }
    if (glow.length) {
      timeline.from(glow, { opacity: 0, duration: g.duration, ease: g.ease }, risesAt + g.at);
    }

    // 3. The nav comes down from above the screen, logo first — no fade: it
    // slides in past the screen's top edge.
    timeline
      .set(nav, { autoAlpha: 1 }, risesAt + n.at)
      .fromTo(
        nav,
        { y: (index) => drops[index] },
        { y: 0, duration: n.duration, ease: n.ease, stagger: n.stagger },
        risesAt + n.at
      );

    // 4. The hero's heading and scroll cue.
    timeline.call(() => headings.forEach(playSplitText), null, risesAt + heading.at);
    if (cue) {
      timeline.fromTo(
        cue,
        { y: c.y },
        { y: 0, autoAlpha: 1, duration: c.duration, ease: c.ease },
        risesAt + c.at
      );
    }
    timeline.call(unlock, null, risesAt + MOTION.unlock);
  };

  (async () => {
    await within(fontsReady(), MOTION.waits.fonts);
    if (cancelled) return;
    splits = captions.map((el) => splitLines(el, (lines) => gsap.set(lines, { yPercent: place })));
    run();
  })();

  return () => {
    cancelled = true;
    timeline?.kill();
    finish();
  };
}

/** Play the page's intro, if it has one and this load should. */
export function initPageIntro() {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const fresh = firstLoad;
  firstLoad = false;
  cleanupPageIntro();

  const root = document.querySelector(SELECTORS.root);
  const hero = document.querySelector(SELECTORS.hero);
  const logo = document.querySelector(SELECTORS.logo) || document.querySelector(SELECTORS.home);
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const plays =
    fresh &&
    root &&
    hero &&
    logo?.parentElement &&
    !prefersReducedMotion() &&
    html.hasAttribute(PENDING_ATTR) &&
    !(hash && document.getElementById(hash)) &&
    performance.now() < MOTION.late;

  if (!plays) {
    html.removeAttribute(PENDING_ATTR);
    return;
  }
  remember();
  cleanup = play({ root, hero, logo });
}

export function cleanupPageIntro() {
  cleanup?.();
  cleanup = null;
}
