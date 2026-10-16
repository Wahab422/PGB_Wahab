/**
 * Split text into masked lines — the shared splitter for the line-by-line
 * text animations (carousel text v3, …). GSAP's SplitText (bundled, free since
 * GSAP 3.13), so there's no CDN script and no hand-made line wrappers.
 *
 * - Waits for the page's fonts, so lines break where they will finally break.
 * - Re-splits whenever the element's width changes (a breakpoint, a hidden tab
 *   being shown) or a late font loads (SplitText's autoSplit), and reports the
 *   new lines through onLines — line elements are replaced on every split, so
 *   callers must re-apply their animation state to them.
 * - Each line sits in its own clipping mask (.split-line-mask), so a line moved
 *   down by its own height (yPercent: 100+) is hidden. The masks get a little
 *   room above and below so tall glyphs and descenders aren't cut at rest.
 * - Screen readers read the text once, as written (SplitText's aria: 'auto').
 *
 *   const handle = splitLines(el, (lines) => gsap.set(lines, { yPercent: 200 }));
 *   handle.revert(); // back to the original markup
 */

import { SplitText } from 'gsap/SplitText';
import { gsap } from './gsapCore';

gsap.registerPlugin(SplitText);

export const LINE_CLASS = 'split-line';

const MASK_CSS = `
.${LINE_CLASS}-mask {
  padding-block: 0.12em;
  margin-block: -0.12em;
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-split-lines-style', 'true');
  style.textContent = MASK_CSS;
  document.head.appendChild(style);
}

/** Resolves once the page's fonts are ready (immediately where unsupported). */
export function fontsReady() {
  return document.fonts?.ready ?? Promise.resolve();
}

/**
 * Split `el` into masked lines now (call after fontsReady()); `onLines(lines)`
 * runs after this split and after every automatic re-split.
 * fit() re-splits it now if its width has changed since — e.g. it was split
 * while hidden (display: none) and has just been shown — rather than ~0.2s
 * later, when SplitText would notice, moving the lines mid-animation.
 * @returns {{ lines: () => HTMLElement[], fit: () => void, revert: () => void }}
 */
export function splitLines(el, onLines) {
  injectStyles();
  let current = [];
  let width = 0;
  const split = SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: LINE_CLASS,
    autoSplit: true,
    onSplit: (self) => {
      current = self.lines;
      width = el.offsetWidth;
      onLines?.(current);
    },
  });
  if (!current.length && split.lines?.length) {
    current = split.lines;
    width = el.offsetWidth;
    onLines?.(current);
  }
  return {
    lines: () => current,
    fit: () => {
      if (el.offsetWidth && el.offsetWidth !== width) split.split(split.vars);
    },
    revert: () => split.revert(),
  };
}

// ── Moving the lines ────────────────────────────────────────────────────────
// fluid.glass's line reveal: from two line-heights below the mask, 1.5s,
// GSAP's power3.out, each line 0.1s after the one before.
//
// power3.out is 1 − (1 − t)⁴. CSS linear() can draw that curve exactly
// (sampled densely); older browsers get the closest cubic-bezier.
const POWER3_OUT = (() => {
  const points = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return (1 - (1 - t) ** 4).toFixed(4);
  });
  const exact = `linear(${points.join(', ')})`;
  const supported =
    typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
  return supported ? exact : 'cubic-bezier(0.165, 0.84, 0.44, 1)';
})();

export const LINE_RISE = {
  from: 200, // % of the line's height
  duration: 1.5,
  stagger: 0.1,
  easing: POWER3_OUT,
};

const offset = (percent) => `translate3d(0, ${percent}%, 0)`;

/** Park lines `percent` of their height off their masks (200 = below, −200 = above). */
export function hideLines(lines, percent = LINE_RISE.from) {
  lines.forEach((line) => {
    line.getAnimations().forEach((animation) => animation.cancel());
    line.style.transform = offset(percent);
  });
}

/** Lines back in place, nothing running. */
export function showLines(lines) {
  lines.forEach((line) => {
    line.getAnimations().forEach((animation) => animation.cancel());
    line.style.transform = '';
    line.style.willChange = '';
  });
}

/**
 * Rise `lines` into place. Runs as browser animations of transform on their
 * own layers, so the compositor moves them: nothing on the main thread (the
 * marquee, scroll-linked effects, Lenis) can make them stutter, and small
 * text glides by sub-pixels instead of snapping to whole pixels. `from` −200
 * drops them in from above; `reverse` starts with the last line.
 * cancel({ hold: true }) stops the lines where they are (e.g. to fade them
 * out from there) rather than back at their start.
 * @returns {{ cancel: (options?: { hold?: boolean }) => void }}
 */
export function riseLines(lines, { from = LINE_RISE.from, delay = 0, reverse = false } = {}) {
  const ordered = reverse ? [...lines].reverse() : lines;
  const animations = ordered.map((line, index) => {
    line.getAnimations().forEach((animation) => animation.cancel());
    line.style.willChange = 'transform';
    line.style.transform = offset(from);
    const animation = line.animate([{ transform: offset(from) }, { transform: offset(0) }], {
      duration: LINE_RISE.duration * 1000,
      delay: (delay + index * LINE_RISE.stagger) * 1000,
      easing: LINE_RISE.easing,
      fill: 'both',
    });
    // Done: leave the line in place as plain text (crisp, no layer).
    animation.finished
      .then(() => {
        line.style.transform = '';
        line.style.willChange = '';
        animation.cancel();
      })
      .catch(() => {}); // cancelled
    return animation;
  });
  return {
    cancel: ({ hold = false } = {}) =>
      animations.forEach((animation) => {
        if (hold && animation.playState === 'running') {
          try {
            animation.commitStyles(); // the current position becomes the inline transform
          } catch {
            // element no longer rendered — nothing to hold
          }
        }
        animation.cancel();
      }),
  };
}
