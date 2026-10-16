/**
 * Pause / Play control for anything that moves or auto-advances on its own —
 * autoplay carousels, marquees, auto-rotating slideshows.
 *
 * WCAG 2.2.2 (Level A): content that moves for more than 5 seconds needs a
 * mechanism to pause it that works for everyone — hover/focus pauses alone
 * don't count (touch and screen-reader users can't hover, and focus pauses
 * end the moment focus leaves).
 *
 * If the component already contains an author-provided control (a Webflow
 * element carrying the given attribute), that element is used as-is — only its
 * accessible name and data-state are managed, so style it (and swap its icon
 * on [data-state]) in Webflow. Otherwise a small <button class="autoplay-toggle">
 * is injected; its default look lives in src/index.css and can be restyled.
 */

import { enhanceControlA11y, activateOnEnterOrSpace } from './controlA11y';

const ICON_PAUSE =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/>' +
  '<rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/></svg>';
const ICON_PLAY =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<path d="M5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.9 2.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>';

/**
 * @param {object} opts
 * @param {Element} opts.root - Component root; searched for an existing control.
 * @param {string} opts.attr - Attribute marking an author-provided control.
 * @param {string} [opts.noun='slideshow'] - Used in the name: "Pause slideshow".
 * @param {(el: HTMLButtonElement) => void} opts.place - Inserts the injected
 *   button into the DOM (only called when no author control exists).
 * @param {(paused: boolean) => void} opts.onChange - Called on every toggle
 *   with the new paused state.
 * @returns {{ el: Element, setPaused: (paused: boolean) => void, destroy: () => void }}
 */
export function setupAutoplayToggle({ root, attr, noun = 'slideshow', place, onChange }) {
  let el = root.querySelector(`[${attr}]`);
  const injected = !el;

  if (injected) {
    el = document.createElement('button');
    el.type = 'button';
    el.className = 'autoplay-toggle';
    el.setAttribute(attr, '');
    place(el);
  } else {
    enhanceControlA11y(el);
  }

  let paused = false;
  const render = () => {
    el.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${noun}`);
    el.setAttribute('data-state', paused ? 'paused' : 'playing');
    if (injected) el.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
  };

  const onClick = (event) => {
    event.preventDefault();
    paused = !paused;
    render();
    onChange(paused);
  };

  el.addEventListener('click', onClick);
  el.addEventListener('keydown', activateOnEnterOrSpace);
  render();

  return {
    el,
    setPaused(next) {
      paused = Boolean(next);
      render();
    },
    destroy() {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', activateOnEnterOrSpace);
      if (injected) el.remove();
    },
  };
}
