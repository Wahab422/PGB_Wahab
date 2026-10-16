/**
 * Button semantics for controls Webflow renders as plain <div>s (video
 * play/pause/return buttons etc.). Shared by the three video players so they
 * stay in sync — previously only sectionVideoPlayer had it.
 */

/**
 * Give a non-native control a button role + keyboard focus, and (optionally)
 * an accessible name. Skipped for real <button>/<a> elements, which already
 * have both.
 * @param {Element} el
 * @param {string} [label]
 */
export function enhanceControlA11y(el, label) {
  if (!el) return;
  if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  }
  if (label) el.setAttribute('aria-label', label);
}

/**
 * keydown handler: Enter/Space activates a role="button" div via .click(), so
 * the control's existing click handler stays the single source of truth.
 * Native <button>/<a> already activate on their own and are left alone.
 * @param {KeyboardEvent} event
 */
export function activateOnEnterOrSpace(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const el = event.currentTarget;
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
  event.preventDefault();
  el.click();
}

/**
 * Accessible name for a play/pause toggle in a given data-state.
 * @param {string} state - 'playing' | 'paused' | 'loading'
 */
export function toggleLabelFor(state) {
  return state === 'playing' ? 'Pause video' : 'Play video';
}
