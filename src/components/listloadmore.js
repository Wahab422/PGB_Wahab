/**
 * Load More (Shared Utility) — two markup flavours, one implementation.
 * Both are initialised globally from src/global/index.js.
 *
 * Accessibility (WCAG 2.1 AA), shared by both:
 *   - Items not yet revealed get [hidden] + aria-hidden + an inline
 *     display:none, so screen readers can't reach them and they stay hidden
 *     even when a Webflow class sets `display` (which beats [hidden] alone).
 *   - An icon-only trigger gets aria-label="Load more items". It must be a
 *     <button> in markup for native role + keyboard behaviour.
 *   - After each load a visually hidden aria-live="polite" region announces how
 *     many items were loaded and how many remain, e.g.
 *     "3 items loaded. 7 of 10 shown. 3 remaining." — and focus moves to the
 *     first newly revealed item (so it isn't left on a button that disappears
 *     once everything is shown, and new items aren't skipped).
 *   - The reveal fades items in with a stagger (plus a small slide for the
 *     custom list), shorter and without the slide under prefers-reduced-motion.
 *
 * ─── 1) Custom Load More — initListLoadMore() ───────────────────────────────
 * Webflow Setup:
 * - List wrapper: data-custom-loadmore="list"
 * - Trigger (pick one):
 *   - Inside list: any descendant with data-custom-loadmore="btn", or
 *   - Anywhere in the page: set data-custom-loadmore-button="#your-id" (or any valid
 *     document.querySelector selector) on the list wrapper — first match wins.
 * - Items: data-custom-loadmore="item" on each item (recommended). A list with no
 *   marked items is treated as EMPTY (count 0, button hidden) — this keeps an empty
 *   CMS list from mistaking its own header/dividers/wrapper for items. To count the
 *   list's direct children instead (flat lists that never mark items), opt in with
 *   data-loadmore-children on the list root.
 * - Optional: data-custom-loadmore="shown" / data-custom-loadmore="total" on any
 *   element(s) inside the list — each receives just the number (visible count /
 *   total count), updated on load and after each click. Bare numbers only, so the
 *   surrounding wording lives in your markup, e.g.:
 *     Showing <span data-custom-loadmore="shown"></span> of
 *     <span data-custom-loadmore="total"></span>
 *
 * Options (on list wrapper):
 * - data-custom-loadmore-initial="3"  Number of items visible on load
 * - data-custom-loadmore-step="3"     Items to reveal per click
 * - data-loadmore-initial="3"         Clear alias for initial visible count
 * - data-loadmore-step="3"            Clear alias for items revealed per click
 * - initial-load-items="3"           Alias for initial visible count
 * - load-no-of-items="3"             Alias for items revealed per click
 *
 * ─── 2) Basic List Load More — initBasicListLoadMore() ──────────────────────
 * Markup:
 *   <div basic-list-load-more-wrap>
 *     <div basic-list-load-more basic-list-load-more-count="6">
 *       <div>item</div>   <!-- direct children = items -->
 *       <div>item</div>
 *       …
 *     </div>
 *     <button basic-list-load-more-btn>Load more</button>
 *   </div>
 *
 * - Shows the first N items on load (N = basic-list-load-more-count, on the list
 *   element); each click reveals the next N. The button is hidden once every
 *   item is visible, and re-shown if more items are added later.
 * - A MutationObserver watches the list's direct children, so items added or
 *   removed after init are folded in automatically: the first `visibleCount`
 *   stay visible, the rest are hidden, and the button visibility is re-evaluated.
 *   At least N items (or all, if fewer) are always visible — so a list that is
 *   emptied and repopulated recovers correctly.
 */

import { scheduleScrollRefresh } from '../global/lenis';
import { logger } from '../utils/logger';
import { focusRevealedItem } from '../utils/focus';
import { prefersReducedMotion } from '../utils/motion';

// ————— Shared —————

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function setItemHidden(el, hidden) {
  el.hidden = hidden;
  if (hidden) {
    el.setAttribute('aria-hidden', 'true');
    // The [hidden] attribute's UA `display:none` is overridden by any authored
    // display (Webflow items are usually flex/block), so force it inline where
    // it wins. Cleared on reveal so CSS owns the display again.
    el.style.display = 'none';
  } else {
    el.removeAttribute('aria-hidden');
    el.style.display = '';
  }
}

function setButtonHidden(button, hidden) {
  if (hidden) {
    // `!important` beats any Webflow `display` on the button's class. The
    // reveal-animation markers are stripped too, so a scroll-reveal pass can't
    // fade the button back in or clear the inline style.
    button.removeAttribute('anim-element-up');
    button.classList.remove('anim-element-up');
    button.style.setProperty('display', 'none', 'important');
  } else {
    button.style.removeProperty('display');
  }
}

function labelIconOnlyButton(button) {
  if (!button.hasAttribute('aria-label') && !button.textContent.trim()) {
    button.setAttribute('aria-label', 'Load more items');
  }
}

/**
 * Fade (and, with `slide`, lift) a batch of freshly revealed items in,
 * staggered, then refresh scroll-driven positions once it has finished.
 */
function revealItems(items, { slide = false } = {}) {
  if (!items.length) return;
  const reduced = prefersReducedMotion();
  const duration = reduced ? 0.2 : 0.5;
  const stagger = reduced ? 0.03 : 0.08;
  const move = slide && !reduced;

  items.forEach((item) => {
    item.style.opacity = '0';
    if (move) item.style.transform = 'translateY(16px)';
    item.style.transition = 'none';
  });

  // Double rAF: commit the initial state before applying the transition so the
  // browser doesn't skip straight to the end state.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      items.forEach((item, index) => {
        const delay = `${index * stagger}s`;
        item.style.transition = move
          ? `opacity ${duration}s ease ${delay}, transform ${duration}s ease ${delay}`
          : `opacity ${duration}s ease ${delay}`;
        item.style.opacity = '1';
        if (move) item.style.transform = 'translateY(0)';
      });

      const last = items[items.length - 1];
      const cleanup = (event) => {
        if (event.propertyName !== 'opacity') return;
        items.forEach((item) => {
          item.style.opacity = '';
          if (move) item.style.transform = '';
          item.style.transition = '';
        });
        last.removeEventListener('transitionend', cleanup);
      };
      last.addEventListener('transitionend', cleanup);
    });
  });

  scheduleScrollRefresh((duration + items.length * stagger) * 1000 + 100);
}

// A visually hidden polite live region right after `anchor`, announcing the
// result of each load.
function createAnnouncer(anchor) {
  const region = document.createElement('span');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  Object.assign(region.style, {
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
  anchor.insertAdjacentElement('afterend', region);

  return {
    announce(loaded, visible, total) {
      const loadedText = `${loaded} item${loaded !== 1 ? 's' : ''} loaded.`;
      const msg =
        visible >= total
          ? `${loadedText} All ${total} items are now shown.`
          : `${loadedText} ${visible} of ${total} shown. ${total - visible} remaining.`;
      region.textContent = '';
      requestAnimationFrame(() => {
        region.textContent = msg;
      });
    },
    // Remove the live region so it is not left as an orphan in the DOM.
    remove: () => region.remove(),
  };
}

function cleanupAll(instances, label) {
  instances.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      logger.warn(`[${label}] Cleanup error:`, error);
    }
  });
  instances.clear();
}

// ————— 1) Custom Load More —————

const customInstances = new Map();
const boundButtons = new WeakSet();
const SELECTORS = {
  root: '[data-custom-loadmore="list"]',
  button: '[data-custom-loadmore="btn"]',
  item: '[data-custom-loadmore="item"]',
  shown: '[data-custom-loadmore="shown"]',
  total: '[data-custom-loadmore="total"]',
};

const DEFAULTS = {
  initial: 3,
  step: 3,
};

function getAttrValue(el, names) {
  for (const name of names) {
    const value = el.getAttribute(name);
    if (value !== null && value !== '') return value;
  }
  return null;
}

function getItems(root, button) {
  const markedItems = Array.from(root.querySelectorAll(SELECTORS.item));
  if (markedItems.length) return markedItems;

  // No marked [data-custom-loadmore="item"] found. Falling back to the list's direct
  // children is only safe for flat lists that never mark items — for a marked list
  // that's simply empty (e.g. an empty CMS collection) it would mistake the header,
  // dividers, and wrapper for items and report a bogus count. So the fallback is
  // opt-in via data-loadmore-children; otherwise an unmarked list is treated as empty.
  const allowChildrenFallback =
    root.hasAttribute('data-loadmore-children') ||
    root.hasAttribute('data-custom-loadmore-children');
  if (!allowChildrenFallback) return [];

  return Array.from(root.children).filter((child) => child !== button);
}

function resolveButton(root) {
  const externalSelector = getAttrValue(root, [
    'data-custom-loadmore-button',
    'data-loadmore-button',
  ]);
  if (externalSelector) {
    try {
      const el = document.querySelector(externalSelector);
      if (el) return el;
      logger.warn(`[LoadMore] data-custom-loadmore-button matched nothing: ${externalSelector}`);
    } catch (error) {
      logger.warn(
        `[LoadMore] Invalid data-custom-loadmore-button selector: ${externalSelector}`,
        error
      );
    }
  }
  return root.querySelector(SELECTORS.button);
}

function createCustomInstance(root) {
  const button = resolveButton(root);
  if (!button) {
    logger.warn(
      '[LoadMore] No trigger found (add data-custom-loadmore-button on the list or data-custom-loadmore="btn" inside it).'
    );
    return null;
  }

  if (boundButtons.has(button)) {
    logger.warn(
      '[LoadMore] That trigger is already used by another list — use a unique element or id per list.'
    );
    return null;
  }

  // Numeric count targets: [data-custom-loadmore="shown"] gets the visible count,
  // [data-custom-loadmore="total"] gets the total — bare numbers, so the "Showing …
  // of …" wording lives in the markup. Resolved up-front so an empty list zeroes them
  // too. Refreshed on init and after each reveal.
  const shownEls = Array.from(root.querySelectorAll(SELECTORS.shown));
  const totalEls = Array.from(root.querySelectorAll(SELECTORS.total));
  const setCounts = (shown, total) => {
    shownEls.forEach((el) => {
      el.textContent = shown;
    });
    totalEls.forEach((el) => {
      el.textContent = total;
    });
  };

  const items = getItems(root, button);
  if (!items.length) {
    setButtonHidden(button, true);
    setCounts(0, 0);
    return null;
  }

  const initialCount = parsePositiveInt(
    getAttrValue(root, [
      'data-custom-loadmore-initial',
      'data-loadmore-initial',
      'initial-load-items',
      'data-initial-load-items',
    ]),
    DEFAULTS.initial
  );
  const stepCount = parsePositiveInt(
    getAttrValue(root, [
      'data-custom-loadmore-step',
      'data-loadmore-step',
      'load-no-of-items',
      'data-load-no-of-items',
    ]),
    DEFAULTS.step
  );

  let visibleCount = Math.min(initialCount, items.length);

  items.forEach((item, index) => {
    setItemHidden(item, index >= visibleCount);
  });

  const updateCounts = () => setCounts(visibleCount, items.length);
  updateCounts();

  if (visibleCount >= items.length) {
    setButtonHidden(button, true);
    return null;
  }

  labelIconOnlyButton(button);
  // Inserted adjacent to the list root so its position is predictable.
  const announcer = createAnnouncer(root);

  boundButtons.add(button);

  const onClick = (event) => {
    event.preventDefault();

    const nextCount = Math.min(visibleCount + stepCount, items.length);
    const newlyRevealed = items.slice(visibleCount, nextCount);
    newlyRevealed.forEach((item) => setItemHidden(item, false));
    visibleCount = nextCount;

    updateCounts();
    revealItems(newlyRevealed, { slide: true });
    focusRevealedItem(newlyRevealed[0]);

    if (visibleCount >= items.length) setButtonHidden(button, true);
    announcer.announce(newlyRevealed.length, visibleCount, items.length);
  };

  button.addEventListener('click', onClick);

  return () => {
    button.removeEventListener('click', onClick);
    boundButtons.delete(button);
    announcer.remove();
  };
}

export function initListLoadMore(options = {}) {
  if (typeof document === 'undefined') {
    logger.warn('[LoadMore] document is undefined (SSR) - skipping init.');
    return () => {};
  }

  const roots =
    options.rootElements ||
    Array.from(document.querySelectorAll(options.rootSelector || SELECTORS.root));

  if (!roots.length) {
    logger.info('[LoadMore] No lists found - nothing to initialize.');
    return () => {};
  }

  let initializedCount = 0;

  roots.forEach((root) => {
    if (customInstances.has(root)) return;
    const cleanup = createCustomInstance(root);
    if (cleanup) {
      customInstances.set(root, cleanup);
      initializedCount += 1;
    }
  });

  if (initializedCount > 0) {
    logger.log(
      `📦 Load more ready (${initializedCount} instance${initializedCount > 1 ? 's' : ''})`
    );
  }

  return () => cleanupListLoadMore();
}

export function cleanupListLoadMore() {
  cleanupAll(customInstances, 'LoadMore');
}

// ————— 2) Basic List Load More —————

const BASIC_SELECTORS = {
  wrap: '[basic-list-load-more-wrap]',
  list: '[basic-list-load-more]',
  btn: '[basic-list-load-more-btn]',
};
const BASIC_COUNT_ATTR = 'basic-list-load-more-count';
const BASIC_DEFAULT_COUNT = 6;

// wrap element -> instance cleanup fn
const basicInstances = new Map();

function createBasicInstance(wrap) {
  const list = wrap.matches(BASIC_SELECTORS.list) ? wrap : wrap.querySelector(BASIC_SELECTORS.list);
  if (!list) {
    logger.warn('[BasicLoadMore] No [basic-list-load-more] list found in wrap.', wrap);
    return null;
  }

  const btn = wrap.querySelector(BASIC_SELECTORS.btn);
  if (!btn) {
    logger.warn('[BasicLoadMore] No [basic-list-load-more-btn] found in wrap.', wrap);
    return null;
  }

  const count = parsePositiveInt(list.getAttribute(BASIC_COUNT_ATTR), BASIC_DEFAULT_COUNT);
  const getItems = () => Array.from(list.children);

  // How many items (from the start) are currently visible.
  let visibleCount = Math.min(count, getItems().length);

  labelIconOnlyButton(btn);
  // After the list, not inside it — the MutationObserver below watches the
  // list's children.
  const announcer = createAnnouncer(list);

  /**
   * Re-apply hidden state to every item and refresh button visibility.
   * @param {boolean} animate - fade in items that go hidden -> visible.
   */
  function reconcile(animate) {
    const items = getItems();
    const total = items.length;

    // Always keep at least N visible (or all, if fewer), and never more than
    // exist — this recovers cleanly if items are removed then re-added.
    const minVisible = Math.min(count, total);
    visibleCount = Math.min(Math.max(visibleCount, minVisible), total);

    const revealed = [];
    items.forEach((item, index) => {
      const shouldHide = index >= visibleCount;
      if (!shouldHide && item.hidden && animate) revealed.push(item);
      setItemHidden(item, shouldHide);
    });

    setButtonHidden(btn, visibleCount >= total);
    revealItems(revealed);
    return revealed;
  }

  const onClick = (event) => {
    event.preventDefault();
    visibleCount = Math.min(visibleCount + count, getItems().length);
    const revealed = reconcile(true);
    // Land on the new content, not on a button that may just have hidden.
    focusRevealedItem(revealed[0]);
    announcer.announce(revealed.length, visibleCount, getItems().length);
  };
  btn.addEventListener('click', onClick);

  // Coalesce bursts of child mutations into a single reconcile per frame.
  let reconcileScheduled = false;
  const scheduleReconcile = () => {
    if (reconcileScheduled) return;
    reconcileScheduled = true;
    requestAnimationFrame(() => {
      reconcileScheduled = false;
      reconcile(true);
    });
  };
  const observer = new MutationObserver(scheduleReconcile);
  observer.observe(list, { childList: true });

  // Initial paint: no animation (items are already in the document).
  reconcile(false);

  return () => {
    btn.removeEventListener('click', onClick);
    observer.disconnect();
    announcer.remove();
    // Leave the list fully visible on teardown so nothing stays stuck hidden.
    getItems().forEach((item) => setItemHidden(item, false));
    setButtonHidden(btn, false);
  };
}

export function initBasicListLoadMore() {
  if (typeof document === 'undefined') {
    logger.warn('[BasicLoadMore] document is undefined (SSR) - skipping init.');
    return;
  }

  const wraps = document.querySelectorAll(BASIC_SELECTORS.wrap);
  if (!wraps.length) return;

  let initialized = 0;
  wraps.forEach((wrap) => {
    if (basicInstances.has(wrap)) return;
    const cleanup = createBasicInstance(wrap);
    if (cleanup) {
      basicInstances.set(wrap, cleanup);
      initialized += 1;
    }
  });

  if (initialized > 0) {
    logger.log(`📦 Basic load more ready (${initialized} instance${initialized > 1 ? 's' : ''})`);
  }
}

export function cleanupBasicListLoadMore() {
  cleanupAll(basicInstances, 'BasicLoadMore');
}
