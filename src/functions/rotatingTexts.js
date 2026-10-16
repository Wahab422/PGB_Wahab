/**
 * Rotating Texts (Shared Utility)
 * Cycles a stack of words inside a fixed-height, overflow-clipped container so
 * only one word is visible at a time. The outgoing word slides up and out while
 * the next word rises into place — a classic vertical word rotator.
 *
 * Not global: import only on pages that render [rotating-texts].
 *
 * Quick start:
 *   import { initRotatingTexts, cleanupRotatingTexts } from '../functions/rotatingTexts';
 *   initRotatingTexts(); // after DOM ready
 *
 * Markup (the container needs a fixed height + overflow: clip in CSS):
 *   <div rotating-texts class="is-h1">
 *     <div>Civic Leadership</div>
 *     <div>Life</div>
 *     <div>Liberty</div>
 *   </div>
 *
 * Options (attributes on the container):
 *   - data-rotate-interval — ms each word stays visible (default 2000)
 *   - data-rotate-duration — ms of the slide transition (default 600)
 *   - data-rotate-count    — number of full passes through the set before
 *                            stopping (default: infinite). e.g. "1" cycles
 *                            through every word once.
 *   - data-rotate-stop     — where a count-limited rotation rests: "first"
 *                            (default) settles back on the first word, "last"
 *                            stops on the final word. No effect when the count
 *                            is infinite.
 *
 * Behavior:
 *   - Respects prefers-reduced-motion: doesn't rotate at all (first word stays).
 *   - Screen readers get the words once, as a comma-separated list, instead of
 *     the stacked words run together.
 *   - Pauses while the tab is hidden and resumes on return.
 *   - A single word (or none) is left untouched.
 */

import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';

const ROOT_SELECTOR = '[rotating-texts]';
const DEFAULT_INTERVAL = 2000;
const DEFAULT_DURATION = 600;

const instances = [];

function readNumberAttr(el, name, fallback) {
  const value = parseInt(el.getAttribute(name) || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Number of full passes through the set before stopping. Absent or non-positive
// means rotate forever.
function readCountAttr(el, name) {
  if (!el.hasAttribute(name)) return Infinity;
  const value = parseInt(el.getAttribute(name) || '', 10);
  return Number.isFinite(value) && value > 0 ? value : Infinity;
}

function createRotator(container) {
  const words = Array.from(container.children);
  if (words.length < 2) return null;

  const interval = readNumberAttr(container, 'data-rotate-interval', DEFAULT_INTERVAL);
  const duration = readNumberAttr(container, 'data-rotate-duration', DEFAULT_DURATION);
  const maxLoops = readCountAttr(container, 'data-rotate-count');
  // Where a count-limited rotation comes to rest: 'last' stops on the final
  // word, anything else settles back on the first word.
  const stopAtLast =
    (container.getAttribute('data-rotate-stop') || 'first').toLowerCase() === 'last';
  const lastIndex = words.length - 1;
  const reduceMotion = prefersReducedMotion();

  // Stack every word in a single grid cell so they overlap while the track
  // still sizes to the widest/tallest word — the container keeps its natural
  // width instead of collapsing (which absolute positioning would cause).
  container.style.display = 'grid';

  // Park the words with transitions off — otherwise words 2+ snap into the
  // shared cell and then visibly slide from word 1's spot down to their parked
  // position, overlapping it on load.
  words.forEach((word, index) => {
    word.style.transition = 'none';
    word.style.gridArea = '1 / 1';
    word.style.willChange = 'transform';
    // First word centered, the rest parked below the clip line.
    word.style.transform = index === 0 ? 'translateY(0)' : 'translateY(100%)';
  });

  // Commit the parked positions before enabling the slide transition.
  void container.offsetHeight;

  if (!reduceMotion) {
    words.forEach((word) => {
      word.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.6, 0.36, 1)`;
    });
  }

  // Screen readers (and search snippets) would otherwise read every stacked
  // word run together — the home <h1> came out as
  // "Education forLifeLibertyGoodFreedom". Hide the moving stack from AT and
  // expose the words once, as a list, in a visually hidden sibling.
  const srText = document.createElement('span');
  srText.setAttribute('data-rotating-texts-sr', '');
  // Leading space: the preceding heading text ("Education for") often has no
  // trailing space of its own, and this span is out of flow.
  srText.textContent = ` ${words
    .map((word) => word.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ')}`;
  Object.assign(srText.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  container.setAttribute('aria-hidden', 'true');
  container.after(srText);

  let current = 0;
  let loops = 0;
  let timerId = null;

  const advance = () => {
    const outgoing = words[current];
    const nextIndex = (current + 1) % words.length;
    const incoming = words[nextIndex];

    // Incoming starts below, then both move up one slot in the same frame.
    incoming.style.transform = 'translateY(100%)';
    // Force a reflow so the starting position is committed before transitioning.
    void incoming.offsetHeight;

    outgoing.style.transform = 'translateY(-100%)';
    incoming.style.transform = 'translateY(0)';

    // Reset the word that just left so it can re-enter from the bottom later.
    const resetOutgoing = () => {
      outgoing.style.transition = 'none';
      outgoing.style.transform = 'translateY(100%)';
      void outgoing.offsetHeight;
      outgoing.style.transition = reduceMotion
        ? 'none'
        : `transform ${duration}ms cubic-bezier(0.22, 0.6, 0.36, 1)`;
    };

    if (reduceMotion) {
      resetOutgoing();
    } else {
      window.setTimeout(resetOutgoing, duration);
    }

    current = nextIndex;

    // A wrap back to the first word completes one full pass through the set.
    if (nextIndex === 0) loops += 1;

    if (stopAtLast) {
      // Stop on the last word of the final pass — before it would wrap around.
      if (nextIndex === lastIndex && loops >= maxLoops - 1) {
        finished = true;
        stop();
      }
    } else if (loops >= maxLoops) {
      // Stop once the final pass has wrapped back to the first word.
      finished = true;
      stop();
    }
  };

  // Set once a count-limited rotation has finished, so returning to the tab
  // (visibilitychange) doesn't start it all over again.
  let finished = false;

  const start = () => {
    // Reduced motion: no rotation at all — the first word just stays put.
    if (timerId !== null || finished || reduceMotion) return;
    timerId = window.setInterval(advance, interval);
  };

  const stop = () => {
    if (timerId === null) return;
    window.clearInterval(timerId);
    timerId = null;
  };

  const isLoadingDone = () => document.body.classList.contains('loading-done');

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else if (isLoadingDone()) start();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Hold the rotation until the hero intro finishes (body.loading-done). If the
  // class isn't set yet, watch for it and start once it appears.
  let classObserver = null;
  if (isLoadingDone()) {
    start();
  } else {
    classObserver = new MutationObserver(() => {
      if (!isLoadingDone()) return;
      classObserver.disconnect();
      classObserver = null;
      if (!document.hidden) start();
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  return {
    destroy() {
      stop();
      classObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      srText.remove();
      container.removeAttribute('aria-hidden');
      container.style.display = '';
      words.forEach((word) => {
        word.style.gridArea = '';
        word.style.willChange = '';
        word.style.transition = '';
        word.style.transform = '';
      });
    },
  };
}

/**
 * Initialize every rotating-texts container on the page.
 */
export function initRotatingTexts() {
  const containers = document.querySelectorAll(ROOT_SELECTOR);
  if (containers.length === 0) return;

  containers.forEach((container) => {
    if (container._rotatingTexts) return; // guard against double init
    const rotator = createRotator(container);
    if (rotator) {
      container._rotatingTexts = rotator;
      instances.push(rotator);
    }
  });

  logger.log(`🔤 Rotating texts initialized (${instances.length})`);
}

/**
 * Tear down all rotators and restore the original inline styles.
 */
export function cleanupRotatingTexts() {
  instances.splice(0).forEach((rotator) => {
    try {
      rotator.destroy();
    } catch {
      // ignore cleanup errors
    }
  });
  document.querySelectorAll(ROOT_SELECTOR).forEach((container) => {
    delete container._rotatingTexts;
  });
}
