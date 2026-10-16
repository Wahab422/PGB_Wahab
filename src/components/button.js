/**
 * Arrow Button (Shared Utility)
 * Animated arrow hover for the site's .btn: the arrowhead's chevron travels
 * round and closes while it springs upright into a square, and the arrow's line
 * erases from its tail toward the tip; leaving reverses both. Initialised globally from
 * src/global/index.js, and only on pages that have such a button.
 *
 * Which buttons: only a link/button that contains the arrow SVG marked
 * [btn-animate-svg] — every other .btn is left alone. Webflow markup as-is:
 *   <a href="…" class="btn w-inline-block …" data-wf--button--variant="base">
 *     <div split-wave-text class="btn-text">View project</div>
 *     <svg btn-animate-svg class="btn-icon arrow-svg" viewBox="0 0 14 11" fill="none">
 *       <path d="M0.600006 0V6H13.1" stroke="currentColor" stroke-width="1.2" />
 *       <rect x="9.18887" y="2.2251" width="5.56065" height="5.56065"
 *             transform="rotate(45 9.18887 2.2251)" stroke="currentColor" stroke-width="1.2" />
 *     </svg>
 *   </a>
 * - The path is the arrow's line; the rotated square is the arrowhead, drawn
 *   half-way (the ">" chevron) at rest.
 * - The button's own layout, text and variants are Webflow's — nothing here
 *   restyles them.
 * - Optional label roll: if the button also holds two `.label .line` spans
 *   (the second a decorative aria-hidden copy), the text rolls up on hover
 *   too; layout for that lives in src/styles/button.css.
 *
 * Behaviour:
 * - Mouse only: skipped where the primary input can't hover (touch), checked
 *   on each event so hybrid devices follow the input in use. Keyboard focus
 *   (:focus-visible) plays the same animation.
 * - A button inside a card with a hover of its own ([data-project-hover], or
 *   any wrapper given [data-btn-hover-area]) takes the card's hover: the arrow
 *   plays as the pointer comes onto the card, and src/styles/button.css gives
 *   the button its hover look meanwhile.
 * - Under prefers-reduced-motion the button stays in its rest state.
 * - Tweens are scoped per button with gsap.context(); cleanupArrowButtons()
 *   stops them, drops the listeners and restores the SVG's authored styles.
 */

import { gsap } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const SELECTORS = {
  svg: 'svg[btn-animate-svg]',
  button: 'a, button, .arrow-link',
  lines: '.label .line',
  // A card whose hover is the button's too (see Behaviour).
  area: '[data-project-hover], [data-btn-hover-area]',
};

const TWEEN = { duration: 1, ease: 'power3.out', overwrite: true };

// Rest / hover draw states (DrawSVG ranges).
const PATH_REST = '100%';
const PATH_ERASED = '0%';
const RECT_CHEVRON = '0% 50%';
const RECT_CLOSED = '50% 150%';
// The arrowhead on hover: turned upright (a square, not the authored 45°
// diamond) and a little larger, as a square looks smaller than a diamond of
// the same size. Turned about its own centre, so it stays where the tip is.
const SQUARE = { angle: 0, scale: 1.15 };
// The turn springs: it overshoots a little and settles (both ways).
const SPRING = { duration: 0.9, ease: 'back.out(3)' };

const instances = new Map();

// The rect's authored `rotate(angle cx cy)`, or null if it isn't one.
function readRotation(rect) {
  const match = /^\s*rotate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)\s*\)\s*$/i.exec(
    rect.getAttribute('transform') || ''
  );
  if (!match) return null;
  const [angle, px, py] = match.slice(1).map(Number);
  return { angle, px, py };
}

// Turns and scales the rect about the centre it's drawn at, through its
// transform attribute: `turn(angle, scale)` sets it; at the authored angle and
// scale 1 it's exactly the authored transform.
function rectTurner(rect, { angle: authored, px, py }) {
  const x = Number(rect.getAttribute('x')) || 0;
  const y = Number(rect.getAttribute('y')) || 0;
  const cx = x + (Number(rect.getAttribute('width')) || 0) / 2;
  const cy = y + (Number(rect.getAttribute('height')) || 0) / 2;
  // Where the authored rotation puts the rect's centre.
  const rad = (authored * Math.PI) / 180;
  const dx = cx - px;
  const dy = cy - py;
  const centreX = px + dx * Math.cos(rad) - dy * Math.sin(rad);
  const centreY = py + dx * Math.sin(rad) + dy * Math.cos(rad);
  return (angle, scale) =>
    rect.setAttribute(
      'transform',
      `translate(${centreX} ${centreY}) rotate(${angle}) scale(${scale}) translate(${-cx} ${-cy})`
    );
}

function canHover() {
  return !(window.matchMedia && window.matchMedia('(hover: none)').matches);
}

function initArrowButton(button, svg, gsap) {
  const path = svg.querySelector('path');
  const rect = svg.querySelector('rect');
  if (!path || !rect) {
    logger.warn('[ArrowButton] [btn-animate-svg] needs a <path> and a <rect> — skipped:', svg);
    return null;
  }
  const lines = Array.from(button.querySelectorAll(SELECTORS.lines));
  const rollLabel = lines.length >= 2;

  // The Webflow markup ships inline stroke-dash styles on the path/rect; keep
  // them so cleanup can hand the SVG back exactly as authored.
  const animated = rollLabel ? [path, rect, ...lines] : [path, rect];
  const authoredStyles = animated.map((el) => el.getAttribute('style'));
  const authoredTransform = rect.getAttribute('transform');

  // The arrowhead's turn into a square (left as authored if its transform
  // isn't a plain rotate()).
  const rotation = readRotation(rect);
  const turn = rotation ? rectTurner(rect, rotation) : null;
  const shape = rotation ? { angle: rotation.angle, scale: 1 } : null;
  const toShape = (target) =>
    turn &&
    gsap.to(shape, {
      ...target,
      ...TWEEN,
      ...SPRING,
      onUpdate: () => turn(shape.angle, shape.scale),
    });

  // Everything this button tweens is recorded in its own context.
  const ctx = gsap.context(() => {
    gsap.set(path, { drawSVG: PATH_REST });
    gsap.set(rect, { drawSVG: RECT_CHEVRON });
  }, button);

  const shouldAnimate = () => canHover() && !prefersReducedMotion();

  const enter = () => {
    if (!shouldAnimate()) return;
    ctx.add(() => {
      if (rollLabel) gsap.to(lines, { yPercent: -100, ...TWEEN });
      gsap.fromTo(
        rect,
        { drawSVG: RECT_CHEVRON },
        {
          drawSVG: RECT_CLOSED,
          ...TWEEN,
          // Closed, the outline's two dash ends meet at a corner and leave a
          // notch there: undashed, that corner joins like the others. (The
          // leave starts from RECT_CLOSED, which dashes it again.)
          onComplete: () => gsap.set(rect, { strokeDasharray: 'none', strokeDashoffset: 0 }),
        }
      );
      toShape(SQUARE);
      gsap.fromTo(path, { drawSVG: '-100%' }, { drawSVG: PATH_ERASED, ...TWEEN });
    });
  };

  const leave = () => {
    if (!shouldAnimate()) return;
    ctx.add(() => {
      if (rollLabel) gsap.to(lines, { yPercent: 0, ...TWEEN });
      gsap.fromTo(rect, { drawSVG: RECT_CLOSED }, { drawSVG: RECT_CHEVRON, ...TWEEN });
      if (rotation) toShape({ angle: rotation.angle, scale: 1 });
      gsap.fromTo(path, { drawSVG: PATH_ERASED }, { drawSVG: PATH_REST, ...TWEEN });
    });
  };

  // Keyboard users get the hover state on focus; a mouse click's focus doesn't
  // replay it (the pointer already did).
  const onFocus = () => {
    if (button.matches(':focus-visible')) enter();
  };
  // Inside a card with a hover of its own, the whole card is the hover area:
  // the arrow plays as the pointer comes onto the card.
  const area = button.closest(SELECTORS.area) || button;
  const onBlur = () => {
    if (!area.matches(':hover')) leave();
  };

  area.addEventListener('mouseenter', enter);
  area.addEventListener('mouseleave', leave);
  button.addEventListener('focus', onFocus);
  button.addEventListener('blur', onBlur);

  return () => {
    area.removeEventListener('mouseenter', enter);
    area.removeEventListener('mouseleave', leave);
    button.removeEventListener('focus', onFocus);
    button.removeEventListener('blur', onBlur);
    // revert() only rewinds tweens the context still holds — overwrite: true
    // kills each hover's predecessor — so restore the authored styles outright.
    ctx.revert();
    gsap.killTweensOf(animated);
    if (shape) gsap.killTweensOf(shape);
    if (authoredTransform === null) rect.removeAttribute('transform');
    else rect.setAttribute('transform', authoredTransform);
    animated.forEach((el, index) => {
      const style = authoredStyles[index];
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    });
  };
}

/** Wire every button holding an svg[btn-animate-svg] under `root`. Safe to call repeatedly. */
export function initArrowButtons(root = document) {
  if (typeof document === 'undefined') return;
  root.querySelectorAll(SELECTORS.svg).forEach((svg) => {
    const button = svg.closest(SELECTORS.button) || svg.parentElement;
    if (!button || instances.has(button)) return;
    const cleanup = initArrowButton(button, svg, gsap);
    if (cleanup) instances.set(button, cleanup);
  });
}

/**
 * Undo initArrowButtons(): every button, or only those under `root` (e.g. a
 * project modal's panel before it's removed, components/projectModal.js).
 */
export function cleanupArrowButtons(root = null) {
  instances.forEach((cleanup, button) => {
    if (root && !root.contains(button)) return;
    cleanup();
    instances.delete(button);
  });
}
