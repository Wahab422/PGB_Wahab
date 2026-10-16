import { requestScrollRefresh } from '../utils/scrollRefresh';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';
import { settleSplitText } from '../animations/splitText';
import { markResourceShown } from '../animations/resourceEntrance';

const EASE = 'cubic-bezier(0.22, 0.6, 0.36, 1)'; // the site's --ease
const OUT = 140; // results fade out before any list re-renders
const IN = 300; // each visible element's entrance
const STAGGER = 18; // between elements, in page order
const MAX_STAGGERED = 10; // later elements share the last delay

// Text rises; file cards and photos open top-down like the projects grid.
const RISE = [
  { opacity: 0, transform: 'translateY(0.5rem)' },
  { opacity: 1, transform: 'none' },
];
const OPEN = [
  { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
  { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
];
const FADE = [{ opacity: 0 }, { opacity: 1 }];

// The new number rolls in from the direction it moved: up when the count
// grows, down when it shrinks. The first set (on ready) stays still.
function setCount(element, value) {
  const previous = element.textContent.trim();
  if (previous === String(value)) return;
  element.textContent = String(value);
  if (!element.closest('[data-resources-ready]')) return;
  const offset = value > Number(previous) ? '45%' : '-45%';
  const motion = prefersReducedMotion()
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { opacity: 0, transform: `translateY(${offset})`, filter: 'blur(2px)' },
        { opacity: 1, transform: 'none', filter: 'none' },
      ];
  element.animate(motion, { duration: 320, easing: EASE });
}

export function initResourceLists(lists) {
  const root = document.querySelector('[data-resources]');
  if (!root) return () => {};
  const entries = lists
    .filter((list) => list.instance === 'resources' && root.contains(list.wrapperElement))
    .map((list) => ({
      list,
      product: list.wrapperElement.closest('[data-resource-product]'),
      section: list.wrapperElement.closest('[data-resource-section]'),
    }));
  if (!entries.length) return () => {};

  const valid = entries.every(
    ({ list, product, section }) =>
      product?.dataset.resourceProduct?.trim() &&
      section &&
      list.items.value.every(
        (item) =>
          item.element.dataset.resourceId && item.element.querySelector('[fs-list-field="product"]')
      )
  );
  if (!valid) {
    logger.error('Resources: check product, section, resource ID and product field bindings.');
    return () => {};
  }

  for (const { list, product } of entries) {
    for (const item of list.items.value) {
      item.element.querySelector('[fs-list-field="product"]').textContent =
        product.dataset.resourceProduct.trim();
      item.collectFields();
    }
  }

  // One transition per filter change, shared by all twenty lists: the results
  // fade out, the lists render behind that, rows and products are hidden, then
  // whatever is in view rises in, staggered in page order. The results come
  // back only once Finsweet is quiet, so a change never plays as two fades.
  const stage = [
    entries[0].product.parentElement,
    ...root.querySelectorAll('[data-resource-empty]'),
  ];
  const allLists = entries.map(({ list }) => list);
  const form = document.querySelector('[fs-list-element="filters"][fs-list-instance="resources"]');
  const search = form?.querySelector('input[fs-list-field*="title"]');
  const searchDelay = Number(search?.getAttribute('fs-list-debounce')) || 0;
  const pending = new Set(); // lists filtering that haven't rendered yet
  let ready = false;
  // Only a visitor's own change animates; Finsweet's start-up passes (after a
  // page transition there are two) render in place.
  let intent = false;
  let leaving = null;
  let faded = false;
  let holdUntil = 0; // a debounced search pass is still to come
  let timer = 0;
  let stageAnimations = [];
  let itemAnimations = [];

  const leave = () => {
    if (leaving) return;
    const reduced = prefersReducedMotion();
    const out = reduced ? [{ opacity: 0 }] : [{ opacity: 0, transform: 'translateY(-0.25rem)' }];
    stageAnimations = stage.map((element) =>
      element.animate(out, { duration: OUT, easing: EASE, fill: 'forwards' })
    );
    faded = false;
    leaving = Promise.all(stageAnimations.map((animation) => animation.finished))
      .catch(() => {})
      .then(() => {
        faded = true;
        schedule();
      });
  };

  const enter = () => {
    leaving = null;
    intent = false;
    const reduced = prefersReducedMotion();
    const inView = (element) => {
      const { top, bottom } = element.getBoundingClientRect();
      return bottom > 0 && top < window.innerHeight && element.getClientRects().length > 0;
    };
    const candidates = [
      ...root.querySelectorAll(
        [
          // The heading's wrapper, so a trademark mark beside it moves with it.
          '[data-resource-product]:not([hidden]) :has(> h2)',
          '[data-resource-product]:not([hidden]) img',
          '[data-resource-section]:not([hidden]) h3',
          '[data-resource-id]',
          '[data-resource-empty]:not([hidden])',
        ].join()
      ),
    ].filter(inView);
    // Outermost only, in page order; a heading pulled into view by the filter
    // joins this entrance instead of starting its own slower split-text rise.
    const targets = candidates.filter(
      (element) => !candidates.some((other) => other !== element && other.contains(element))
    );
    targets.forEach((element) => {
      element.querySelectorAll('[data-split-text]').forEach(settleSplitText);
      // This entrance replaces the scroll one for whatever it brings in.
      markResourceShown(element);
    });
    itemAnimations.forEach((animation) => animation.cancel());
    // Same frame: the stage returns while its contents start invisible.
    stageAnimations.forEach((animation) => animation.cancel());
    itemAnimations = targets.map((element, index) => {
      const opens = element.matches('[data-resource-id], img');
      const keyframes = reduced ? FADE : opens ? OPEN : RISE;
      return element.animate(keyframes, {
        duration: IN,
        delay: reduced ? 0 : Math.min(index, MAX_STAGGERED) * STAGGER,
        easing: EASE,
        fill: 'backwards',
      });
    });
  };

  let active = true;
  let frame = 0;
  const update = () => {
    frame = 0;
    clearTimeout(timer);
    if (!active || !root.isConnected) return;
    if (leaving) {
      if (!faded) return; // the fade's end schedules again
      const wait = holdUntil - performance.now();
      if (wait > 0) {
        timer = setTimeout(schedule, wait);
        return;
      }
      if (pending.size) {
        // Each render schedules again; this only rescues a list that never
        // renders, so the results can't stay hidden.
        timer = setTimeout(() => {
          pending.clear();
          schedule();
        }, 600);
        return;
      }
    }
    const ids = new Set();
    const visibleProducts = new Set();
    for (const { list, section, product } of entries) {
      section.hidden = list.renderedItems.size === 0;
      if (!section.hidden) visibleProducts.add(product);
      for (const item of list.renderedItems) ids.add(item.element.dataset.resourceId);
    }
    for (const product of root.querySelectorAll('[data-resource-product]')) {
      product.hidden = !visibleProducts.has(product);
      // Hidden headings don't rise unseen; they come back with the entrance.
      if (product.hidden) product.querySelectorAll('[data-split-text]').forEach(settleSplitText);
    }
    for (const count of root.querySelectorAll('[data-resource-count]')) setCount(count, ids.size);
    for (const empty of root.querySelectorAll('[data-resource-empty]')) empty.hidden = ids.size > 0;
    root.setAttribute('data-resources-ready', '');
    if (leaving) enter();
    ready = true;
    requestScrollRefresh();
  };
  const schedule = () => {
    if (active && !frame) frame = requestAnimationFrame(update);
  };
  const remove = entries.flatMap(({ list }) => [
    list.addHook('filter', (items) => {
      if (ready && intent) {
        pending.add(list);
        leave();
      }
      return items;
    }),
    list.addHook('beforeRender', (items) => (leaving ? leaving.then(() => items) : items)),
    list.addHook('afterRender', (items) => {
      pending.delete(list);
      schedule();
      return items;
    }),
  ]);

  // A visitor's input marks the next filter pass as theirs. A dropdown choice
  // fades on the click itself, before Finsweet's worker answers (every list
  // re-runs on it); typing fades once the search debounce runs the filter.
  const onChange = (event) => {
    if (!ready) return;
    intent = true;
    if (!event.target.matches('input[type="radio"][fs-list-field]')) return;
    allLists.forEach((list) => pending.add(list));
    leave();
  };
  // Finsweet's own clear resets field by field: six filter passes over a
  // second. Resetting every dropdown in one task gives one pass; a search
  // reset adds one debounced pass, which the results wait for.
  const onClear = (event) => {
    const button = event.target.closest('[fs-list-element="clear"]');
    if (!ready || !form || !button || !root.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    intent = true;
    allLists.forEach((list) => pending.add(list));
    leave();
    for (const radio of form.querySelectorAll('input[type="radio"][fs-list-value=""]')) {
      if (radio.checked) continue;
      radio.checked = true;
      radio.dispatchEvent(new Event('input', { bubbles: true }));
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (search?.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      holdUntil = performance.now() + searchDelay + 50;
    }
  };
  form?.addEventListener('change', onChange);
  form?.addEventListener('input', onChange);
  root.addEventListener('click', onClear, true);
  // Fields are inherited after bootstrap; rerun saved filters against the complete item data.
  Promise.all(
    entries.map(({ list }) =>
      list.triggerHook('filter', {
        resetCurrentPage: true,
        scrollToAnchor: false,
      })
    )
  )
    .then(schedule)
    .catch((error) => logger.error('Resource filtering failed', error));

  return () => {
    active = false;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    form?.removeEventListener('change', onChange);
    form?.removeEventListener('input', onChange);
    root.removeEventListener('click', onClear, true);
    [...stageAnimations, ...itemAnimations].forEach((animation) => animation.cancel());
    remove.forEach((stop) => stop());
  };
}
