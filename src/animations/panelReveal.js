/**
 * Panel Reveal — the site's scroll-in animations for content that scrolls
 * inside its own box rather than with the page: the project modal's panel
 * (components/projectModal.js). The site-wide versions follow the page's
 * scroll, which doesn't move while a modal is open, so inside the panel the
 * same attributes are played here instead, as each element comes into view
 * in the modal:
 *
 *   data-split-text        lines rise into place (animations/splitText.js)
 *   data-split-text-delay  seconds to wait once it's in view
 *   data-fade              fades in; data-fade="up" also rises 20px
 *                          (animations/fade.js); data-fade-delay
 *   data-stagger-in        its items rise in one after another; a selector
 *                          picks them, empty means its children
 *                          (animations/stagger.js); data-stagger-in-each,
 *                          data-stagger-in-delay
 *   data-reveal-image      the frame opens upward while its image settles
 *                          from a zoom (animations/imageReveal.js);
 *                          data-reveal-image-delay
 *
 * Same motion as the site-wide ones (no depth drift on images). Elements that
 * come into view together play one after another, top to bottom. Each plays
 * once per panel; the project modal puts in a fresh panel on every opening,
 * so they play each time. A frame holding hotspots opens without the zoom,
 * so they stay on their spots. Under prefers-reduced-motion nothing is
 * hidden or moved. The site-wide scripts leave all of these alone
 * inside a [data-panel-reveal] (imageReveal.js) or a modal (fade.js,
 * stagger.js; splitText.js only runs on what's on the page at load).
 *
 *   animatePanel(panel, scroller) → cleanup()
 */

import { gsap } from '../utils/gsapCore';
import { hideLines, riseLines, showLines, splitLines } from '../utils/splitLines';
import { prefersReducedMotion } from '../utils/motion';
import { logger } from '../utils/logger';

// Marks the panel: the site-wide image reveal skips what's inside.
export const PANEL_ATTR = 'data-panel-reveal';

const TEXT = '[data-split-text]';
const FADE = '[data-fade]';
const STAGGER = '[data-stagger-in]';
const IMAGE = '[data-reveal-image]';
const MEDIA = 'img, video';
const HOTSPOTS = '[data-hotspots]';

// The site-wide motion (fade.js, stagger.js, imageReveal.js).
const MOTION = {
  fade: { duration: 1.1, ease: 'power2.out', rise: 20 },
  stagger: { y: 24, duration: 1, ease: 'power3.out', each: 0.12, delay: 0.1 },
  image: { from: 1.35, reveal: 1.2, settle: 1.6, ease: 'expo.out' },
  // Between elements that come into view together.
  each: 0.1,
};
// How far into the modal an element must be before it plays.
const ROOT_MARGIN = '0px 0px -8% 0px';

// The frame's clip at rest: its own box, with its rounded corners.
function openClip(frame) {
  const radius = getComputedStyle(frame).borderRadius;
  return radius && radius !== '0px' ? `inset(0% 0% 0% 0% round ${radius})` : 'inset(0% 0% 0% 0%)';
}

const readNumber = (el, name, fallback = 0) => {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
};

/** Set up `panel`'s animations, played as they scroll into view in `scroller`. */
export function animatePanel(panel, scroller) {
  panel.setAttribute(PANEL_ATTR, '');
  const texts = Array.from(panel.querySelectorAll(TEXT));
  if (prefersReducedMotion()) {
    texts.forEach((el) => el.setAttribute('data-split-text-ready', ''));
    return () => panel.removeAttribute(PANEL_ATTR);
  }

  const cleanups = [];
  // element → play(delay); in the panel's order, for the in-view batches.
  const players = new Map();

  texts.forEach((el) => {
    if (!el.textContent.trim()) return;
    let played = false;
    let rise = null;
    try {
      const handle = splitLines(el, (lines) => (played ? showLines(lines) : hideLines(lines)));
      players.set(el, (delay) => {
        played = true;
        rise = riseLines(handle.lines(), {
          delay: delay + readNumber(el, 'data-split-text-delay'),
        });
      });
      cleanups.push(() => {
        rise?.cancel();
        handle.revert();
      });
    } catch (error) {
      logger.warn('[PanelReveal] could not split — left as is:', el, error);
    }
    el.setAttribute('data-split-text-ready', '');
  });

  const ctx = gsap.context(() => {
    panel.querySelectorAll(FADE).forEach((el) => {
      const { duration, ease, rise } = MOTION.fade;
      const y = el.getAttribute('data-fade') === 'up' ? rise : 0;
      gsap.set(el, { autoAlpha: 0, y });
      el.setAttribute('data-fade-ready', '');
      players.set(el, (delay) =>
        gsap.to(el, {
          autoAlpha: 1,
          y: 0,
          duration,
          ease,
          delay: delay + readNumber(el, 'data-fade-delay'),
        })
      );
    });

    panel.querySelectorAll(STAGGER).forEach((el) => {
      const selector = el.getAttribute('data-stagger-in')?.trim();
      const items = selector ? el.querySelectorAll(selector) : el.children;
      const { y, duration, ease, each, delay: first } = MOTION.stagger;
      if (items.length) gsap.set(items, { autoAlpha: 0, y });
      el.setAttribute('data-stagger-in-ready', '');
      players.set(el, (delay) =>
        gsap.to(items, {
          autoAlpha: 1,
          y: 0,
          duration,
          ease,
          stagger: readNumber(el, 'data-stagger-in-each', each),
          delay: delay + readNumber(el, 'data-stagger-in-delay', first),
        })
      );
    });

    panel.querySelectorAll(IMAGE).forEach((frame) => {
      if (frame.getAttribute('data-reveal-image') === 'false') return;
      // No zoom under hotspots: they're placed on the photo as it rests.
      const media =
        frame.matches(MEDIA) || frame.matches(HOTSPOTS) ? null : frame.querySelector(MEDIA);
      const { from, reveal, settle, ease } = MOTION.image;
      gsap.set(frame, { clipPath: 'inset(100% 0% 0% 0%)' });
      if (media) gsap.set(media, { scale: from, transformOrigin: '50% 50%' });
      players.set(frame, (delay) => {
        const at = delay + readNumber(frame, 'data-reveal-image-delay');
        gsap.to(frame, { clipPath: () => openClip(frame), duration: reveal, ease, delay: at });
        if (media) gsap.to(media, { scale: 1, duration: settle, ease, delay: at });
      });
    });
  }, panel);

  // Play what comes into view, a batch at a time, top to bottom.
  const order = Array.from(players.keys());
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
        .forEach((el, index) => {
          observer.unobserve(el);
          players.get(el)?.(index * MOTION.each);
        });
    },
    { root: scroller, rootMargin: ROOT_MARGIN }
  );
  order.forEach((el) => observer.observe(el));

  return () => {
    observer.disconnect();
    ctx.revert();
    cleanups.forEach((fn) => fn());
    panel.removeAttribute(PANEL_ATTR);
  };
}
