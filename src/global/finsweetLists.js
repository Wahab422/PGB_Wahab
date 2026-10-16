import { requestScrollRefresh } from '../utils/scrollRefresh';
import { logger } from '../utils/logger';
import { initResourceLists } from './resourceLists';
import { settleImageReveals } from '../animations/imageReveal';
import { getLenis } from './lenis';

const FINSWEET_SRC = 'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js';

let generation = 0;
let removeHooks = [];

export function cleanupFinsweetLists() {
  generation++;
  removeHooks.forEach((remove) => remove());
  removeHooks = [];
}

// Page-level head code runs only on a hard load, so arriving through a page
// transition leaves Finsweet unloaded; the queue below needs its script.
function ensureFinsweetScript() {
  if (document.querySelector('script[src*="@finsweet/attributes"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.type = 'module';
  script.src = FINSWEET_SRC;
  script.setAttribute('fs-list', '');
  document.head.append(script);
}

export function initFinsweetLists() {
  cleanupFinsweetLists();
  const currentGeneration = generation;
  const api = (window.FinsweetAttributes ||= []);
  const hasList = Boolean(document.querySelector('[fs-list-element="list"]'));
  if (!hasList && !api.modules?.list) return;

  const attach = (lists) => {
    if (currentGeneration !== generation || !lists) return;
    removeHooks.push(initResourceLists(lists));
    // Filtering doesn't move the page: a list that comes out shorter (fewer
    // items, none) would shrink the page under the scroll position, and the
    // browser would pull the page — filters and all — down to it. So as a
    // filter's applied the list keeps its height, and once it's rendered it
    // keeps only as much as holds the page where it was (none, if the items
    // fill it). It gives the rest back on the next change.
    const held = new Map(); // list → the scroll position as its filter changed
    const hold = (list) => {
      const wrapper = list.wrapperElement;
      held.set(list, window.scrollY);
      wrapper.style.minHeight = `${wrapper.offsetHeight}px`;
    };
    const fit = (list) => {
      if (!held.has(list)) return;
      const scroll = held.get(list);
      held.delete(list);
      const wrapper = list.wrapperElement;
      // Its content's own height (the children aren't stretched by min-height).
      const top = wrapper.getBoundingClientRect().top;
      const natural = Math.max(
        0,
        ...[...wrapper.children].map((child) => child.getBoundingClientRect().bottom - top)
      );
      const page = document.documentElement.scrollHeight - (wrapper.offsetHeight - natural);
      const short = scroll + window.innerHeight - page;
      if (short > 0.5) wrapper.style.minHeight = `${Math.ceil(natural + short)}px`;
      else wrapper.style.removeProperty('min-height');
      if (Math.abs(window.scrollY - scroll) > 1) {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(scroll, { immediate: true, force: true });
        else window.scrollTo(0, scroll);
      }
    };
    lists.forEach((list) => {
      if (list.wrapperElement.isConnected) {
        removeHooks.push(list.addHook('afterRender', requestScrollRefresh));
        removeHooks.push(list.addHook('afterRender', () => fit(list)));
      }
    });
    removeHooks.push(() =>
      lists.forEach((list) => list.wrapperElement.style.removeProperty('min-height'))
    );
    // Filtering doesn't animate the items: once a filter's touched (or
    // cleared), the list's pictures show as they are, without their reveal
    // (src/animations/imageReveal.js) — an item taken out and put back would
    // otherwise reveal again, cut short by the next quick click.
    const instanceOf = (el) =>
      el?.closest('[fs-list-instance]')?.getAttribute('fs-list-instance') || '';
    const settle = (event) => {
      const control = event.target.closest?.(
        event.type === 'click'
          ? '[fs-list-element="clear"]'
          : '[fs-list-element="filters"], [fs-list-element="clear"]'
      );
      if (!control) return;
      const instance = instanceOf(control);
      lists.forEach((list) => {
        if (!instance || instanceOf(list.listElement) === instance) {
          settleImageReveals(list.wrapperElement);
          hold(list);
        }
      });
    };
    ['input', 'change', 'click'].forEach((type) => document.addEventListener(type, settle, true));
    removeHooks.push(() =>
      ['input', 'change', 'click'].forEach((type) =>
        document.removeEventListener(type, settle, true)
      )
    );
    requestScrollRefresh();
  };

  if (Array.isArray(api)) {
    if (hasList) {
      api.push(['list', attach]);
      ensureFinsweetScript();
    }
    return;
  }

  const controls = api.modules?.list;
  const loading = controls
    ? controls.loading.then((lists) => {
        if (currentGeneration !== generation) return;
        // Preserve filtered-out items on initial load; restart only for replaced DOM.
        if (lists?.length && lists.every((list) => list.wrapperElement.isConnected)) return lists;
        return controls.restart();
      })
    : api.load('list');
  Promise.resolve(loading)
    .then(attach)
    .catch((error) => logger.error('Finsweet list initialization failed', error));
}
