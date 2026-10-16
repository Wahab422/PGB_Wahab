/**
 * Focus helpers shared by the modal components (modal-basic, people modal).
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const EMBED_SELECTOR = 'iframe, object, embed';

/**
 * Keyboard-reachable elements inside `container`, in DOM order — filtered to
 * what can actually take focus right now: not aria-hidden/disabled, not in an
 * inert subtree, not fallback content of an <object>/<video>/<audio> (only
 * rendered when the embed fails — e.g. the "Download PDF" link inside a
 * working PDF <object>), and not display:none / visibility:hidden.
 * @param {Element} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('disabled')) return false;
    if (el.closest('[inert]')) return false;
    if (el.parentElement?.closest('object, video, audio')) return false;
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ visibilityProperty: true });
    }
    return el.getClientRects().length > 0;
  });
}

/**
 * Where to put focus when a dialog opens: its first focusable control, but
 * never an embed (a PDF <object> or an iframe swallows keystrokes, so Escape
 * would stop closing the dialog). Null when there's nothing suitable — the
 * caller then focuses the dialog itself.
 * @param {Element} container
 * @returns {HTMLElement|null}
 */
export function getInitialFocusTarget(container) {
  return getFocusableElements(container).find((el) => !el.matches(EMBED_SELECTOR)) || null;
}

/**
 * After new content is revealed (load more): move focus to the first new item
 * — its first control, or the item itself — so keyboard / screen-reader users
 * land on what just appeared. New items are inserted before the button, so
 * otherwise the next Tab skips them, and when the last batch hides the button
 * focus would drop to <body>.
 * @param {HTMLElement} item
 */
export function focusRevealedItem(item) {
  if (!item) return;
  const target = getInitialFocusTarget(item);
  if (target) {
    target.focus();
    return;
  }
  if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '-1');
  item.focus();
}

/**
 * Keep Tab / Shift+Tab inside `container`. Also pulls focus back in when it
 * has ended up outside (it never landed inside, or its element was removed),
 * and handles focus sitting on a tabindex="-1" element (a heading focused on
 * open, or the container itself), which isn't in the focusable list.
 * Call from a keydown handler while the dialog is open.
 * @param {KeyboardEvent} event
 * @param {Element} container
 */
export function trapTabKey(event, container) {
  if (event.key !== 'Tab' || !container) return;

  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!active || !container.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  const index = focusable.indexOf(active);
  if (index === -1) {
    // Only step in when the browser's own move would leave the container.
    const beforeFirst =
      active === container ||
      Boolean(active.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING);
    const afterLast = Boolean(
      active.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_PRECEDING
    );
    if (event.shiftKey && beforeFirst) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && afterLast) {
      event.preventDefault();
      first.focus();
    }
    return;
  }

  if (event.shiftKey && index === 0) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && index === focusable.length - 1) {
    event.preventDefault();
    first.focus();
  }
}
