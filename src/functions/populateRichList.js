/**
 * Populate Rich List
 * Expands a Webflow Rich Text list into a repeated, styled item template.
 * Mirrors peoplePopulateRichContent's list handling, but standalone.
 *
 * Markup (inside a [richlist] container):
 *   [richlist="list"]           — the element that holds the repeated items
 *     [richlist="item"]         — template item, cloned once per <li>
 *       [richlist="item-text"]  — element that receives each <li>'s innerHTML
 *   [richlist="ref"]            — source Rich Text containing the <ul>/<ol> + <li>s
 *
 * For each [richlist="ref"]: clone [richlist="item"] once per <li>, dropping the
 * <li>'s innerHTML into the clone's [richlist="item-text"]. The original item
 * template and the [richlist="ref"] source are removed when done.
 *
 * Idempotent: it removes the ref after processing, so re-running is a no-op.
 */

import { logger } from '../utils/logger';
import { isEmptyText } from '../utils/text';

export function populateRichList() {
  if (typeof document === 'undefined') return;

  const refs = document.querySelectorAll('[richlist="ref"]');
  if (!refs.length) return;

  refs.forEach((ref) => {
    // The nearest [richlist] ancestor of the ref is the container that also
    // holds the item template.
    const container = ref.parentElement && ref.parentElement.closest('[richlist]');
    const itemTemplate = container && container.querySelector('[richlist="item"]');

    if (!itemTemplate) {
      logger.warn('[RichList] No [richlist="item"] found for a [richlist="ref"].', ref);
      return;
    }

    const list = itemTemplate.parentElement;
    const items = Array.from(ref.querySelectorAll('li'));

    items.forEach((li) => {
      // textContent, not innerText: innerText forces a layout, and the
      // insertBefore below invalidates it again — one forced reflow per <li>.
      if (isEmptyText(li.textContent)) return;
      const clone = itemTemplate.cloneNode(true);
      const itemText = clone.querySelector('[richlist="item-text"]');
      if (itemText) itemText.innerHTML = li.innerHTML;
      list.insertBefore(clone, itemTemplate);
    });

    // Drop the placeholder template and the source rich text.
    itemTemplate.remove();
    ref.remove();

    logger.log(`[RichList] Populated ${items.length} item(s)`);
  });
}
