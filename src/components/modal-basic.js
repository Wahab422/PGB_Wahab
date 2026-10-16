/**
 * Basic Modal Component (Setup Guide)
 * Use when you need lightweight, accessible modals driven by data attributes.
 *
 * Quick start:
 * - Import: import { initModalBasic, cleanupModalBasic, closeModalBasic } from '../components/modal-basic';
 * - Init: call initModalBasic() once after DOM ready; call cleanupModalBasic() on page teardown/navigation.
 * - Markup checklist: [data-modal-name], [data-modal-target], [data-modal-close], optional [data-modal-content] wrapper for overlay close.
 * - Optional toggles: [data-modal-close-outside] (omit/true enables, "false" disables), [data-modal-escape="false"] to block ESC, [data-modal-label] for aria-label when no [data-modal-heading].
 * - Events: listen for modal:open / modal:close on the modal element; use closeModalBasic('api') to close programmatically.
 */

/**
 * Basic Modal Component
 * Enhances simple data-attribute driven modals with accessibility + focus management.
 *
 * HTML Structure (example):
 * <div data-modal-group-status="not-active">
 *   <button type="button" data-modal-target="contact-modal">
 *     Launch Contact Modal
 *   </button>
 *
 *   <div data-modal-name="contact-modal" data-modal-close-outside data-modal-label="Contact form">
 *     <div data-modal-content>
 *       <h2 data-modal-heading>Contact Us</h2>
 *       <p>Drop us a quick note and we will reply within 24 hours.</p>
 *
 *       <form>
 *         <!-- Your form fields -->
 *       </form>
 *
 *       <button type="button" data-modal-close>
 *         Close modal
 *       </button>
 *     </div>
 *   </div>
 * </div>
 *
 * data-modal-item usage (example):
 * <!-- Triggers -->
 * <button data-modal-target="gallery-modal" data-modal-item="photo-1">Open Photo 1</button>
 * <button data-modal-target="gallery-modal" data-modal-item="photo-2">Open Photo 2</button>
 *
 * <!-- Modal -->
 * <div data-modal-name="gallery-modal">
 *   <div data-modal-content>
 *     <div data-modal-item="photo-1">Photo 1 content</div>
 *     <div data-modal-item="photo-2">Photo 2 content</div>
 *   </div>
 * </div>
 *
 * Usage:
 * 1. Wrap modal content with an element that has [data-modal-name="uniqueName"].
 *    Optional attributes:
 *      - data-modal-close-outside (set or leave blank to enable outside click close, "false" to disable)
 *      - data-modal-escape="false" to disable closing with Escape
 *      - data-modal-label="Friendly label" if no [data-modal-heading] is provided
 * 2. Add the inner content wrapper with [data-modal-content] if you enable outside click close.
 * 3. Add trigger buttons/links with [data-modal-target="uniqueName"].
 * 4. Add any close buttons inside the modal with [data-modal-close].
 * 5. Optionally add [data-modal-item="value"] on triggers and matching inner elements to
 *    activate a specific panel when the modal opens.
 *
 * Bonus:
 * - Listen for `modal:open` / `modal:close` custom events on the modal element.
 * - Call `cleanupModalBasic()` before navigating away or re-initializing.
 * - If Lenis is not initialized, scroll locking falls back to `overflow: hidden` on
 *   <html> and <body> automatically.
 * - A [video-section] (sectionVideoPlayer) found inside the modal auto-plays on
 *   open and pauses on close — see playModalVideos() / pauseModalVideos().
 *
 *
 * CSS:
 *
 */

import { handleError } from '../utils/helpers';
import { getFocusableElements, getInitialFocusTarget, trapTabKey } from '../utils/focus';
import { startLenis, stopLenis, getLenis } from '../global/lenis';
import { logger } from '../utils/logger';

const SELECTORS = {
  modal: '[data-modal-name]',
  trigger: '[data-modal-target]',
  close: '[data-modal-close]',
  group: '[data-modal-group-status]',
  content: '[data-modal-content]',
};

const STATUS_ACTIVE = 'active';
const STATUS_INACTIVE = 'not-active';
const DEFAULT_MODAL_LABEL = 'Modal dialog';

let listenersAttached = false;
let activeModal = null;
let previouslyFocusedElement = null;
let headingIdCounter = 0;
let modalIdCounter = 0;
const cleanupCallbacks = [];

// ---------------------------------------------------------------------------
// Scroll lock helpers
// Falls back to overflow:hidden when Lenis is not initialized.
// ---------------------------------------------------------------------------

/**
 * Returns true if a Lenis instance is active.
 * Uses getLenis() from global/lenis.js (null under reduced motion, where Lenis
 * isn't created).
 */
function isLenisActive() {
  return typeof getLenis === 'function' && !!getLenis();
}

/**
 * Lock page scroll.
 * Tries Lenis first; if unavailable or not active, falls back to overflow:hidden.
 */
function lockScroll() {
  try {
    stopLenis();
  } catch {
    // Lenis threw (e.g. not initialized) — swallow and fall through to CSS fallback
  }

  if (!isLenisActive()) {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Unlock page scroll.
 * Tries Lenis first; if unavailable or not active, clears the overflow fallback.
 */
function unlockScroll() {
  try {
    startLenis();
  } catch {
    // Lenis threw (e.g. not initialized) — swallow and fall through to CSS fallback
  }

  if (!isLenisActive()) {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize modal interactions (idempotent)
 */
export function initModalBasic() {
  if (typeof document === 'undefined') {
    logger.warn('[ModalBasic] document is undefined (SSR) - skipping init.');
    return;
  }

  try {
    const modals = document.querySelectorAll(SELECTORS.modal);

    if (!modals.length) {
      if (!listenersAttached) {
        logger.info('[ModalBasic] No modals found on the page - nothing to initialize.');
      }
      return;
    }

    // Always keep accessibility attributes in sync (supports calling init multiple times)
    modals.forEach(enhanceModalAccessibility);
    enhanceTargetAccessibility();

    if (listenersAttached) {
      return;
    }

    const clickHandler = (event) => {
      const trigger = event.target.closest(SELECTORS.trigger);

      if (trigger) {
        const modalName = trigger.getAttribute('data-modal-target');
        if (!modalName) {
          return;
        }

        event.preventDefault();

        const currentActiveName = activeModal?.getAttribute('data-modal-name');
        if (currentActiveName === modalName) {
          closeAllModals('toggle');
          return;
        }

        try {
          openModal(modalName, trigger);
        } catch (error) {
          handleError(error, 'Modal Basic Open');
        }
        return;
      }

      const closeBtn = event.target.closest(SELECTORS.close);
      if (closeBtn) {
        event.preventDefault();
        closeAllModals('button');
        return;
      }

      // A video-return button inside a [video-modal] doubles as a modal close.
      // No stopPropagation — the video player's own return handler still runs
      // (returns to overlay + pauses); we just also close the enclosing modal.
      const returnBtn = event.target.closest('[video-return-btn]');
      if (
        returnBtn &&
        activeModal &&
        activeModal.contains(returnBtn) &&
        returnBtn.closest('[video-modal]')
      ) {
        closeAllModals('video-return');
        return;
      }

      const modalRoot = activeModal && document.body.contains(activeModal) ? activeModal : null;
      if (
        modalRoot &&
        allowOutsideClose(modalRoot) &&
        shouldCloseOnOutsideClick(event, modalRoot)
      ) {
        closeAllModals('overlay');
      }
    };

    const keydownHandler = (event) => {
      // Enter/Space on a non-native trigger that enhanceTargetAccessibility()
      // upgraded to role="button" — native <a href>/<button> already activate
      // on their own. Only when the trigger itself has focus, so an inner link
      // keeps its normal behaviour. Re-dispatches through .click() so
      // clickHandler stays the single source of truth.
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        const trigger = event.target.closest?.(SELECTORS.trigger);
        if (trigger && event.target === trigger && !isNativeControl(trigger)) {
          event.preventDefault();
          trigger.click();
          return;
        }
      }

      if (!activeModal || (activeModal && !document.body.contains(activeModal))) {
        activeModal = null;
      }

      if (event.key === 'Escape') {
        if (activeModal && allowEscapeClose(activeModal)) {
          event.preventDefault();
          closeAllModals('escape');
        }
        return;
      }

      if (event.key === 'Tab' && activeModal) {
        trapFocus(event);
      }
    };

    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keydownHandler);

    cleanupCallbacks.push(() => document.removeEventListener('click', clickHandler));
    cleanupCallbacks.push(() => document.removeEventListener('keydown', keydownHandler));

    listenersAttached = true;
    logger.log(`🪟 ModalBasic ready (${modals.length} modal${modals.length > 1 ? 's' : ''})`);
  } catch (error) {
    handleError(error, 'Modal Basic Initialization');
  }
}

/**
 * Cleanup modal listeners & close any open modal
 */
export function cleanupModalBasic() {
  if (!listenersAttached && !activeModal) return;

  try {
    closeAllModals('cleanup', { skipFocusRestore: true });
    const callbacks = cleanupCallbacks.splice(0);
    callbacks.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        handleError(error, 'Modal Basic Cleanup');
      }
    });
  } finally {
    listenersAttached = false;
  }
}

/**
 * Programmatic helper to close the current modal
 */
export function closeModalBasic(reason = 'api') {
  closeAllModals(reason);
}

/**
 * Programmatic helper to open a modal by name (same flow as clicking a
 * [data-modal-target]). Pass the element that triggered it so focus can be
 * restored to it on close.
 * @param {string} modalName - The [data-modal-name] value to open.
 * @param {HTMLElement} [trigger] - Element to restore focus to on close.
 */
export function openModalBasic(modalName, trigger) {
  try {
    openModal(modalName, trigger);
  } catch (error) {
    handleError(error, 'Modal Basic Open (API)');
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function openModal(modalName, trigger) {
  const modalSelector = getSafeSelector('data-modal-name', modalName);
  if (!modalSelector) {
    logger.warn('[ModalBasic] Invalid modal name provided.');
    return;
  }

  const modal = document.querySelector(modalSelector);
  if (!modal) {
    logger.warn(`[ModalBasic] Modal "${modalName}" not found in the DOM.`);
    return;
  }

  if (activeModal === modal) {
    return;
  }

  closeAllModals('switch', { skipFocusRestore: true });

  previouslyFocusedElement =
    (trigger && typeof trigger.focus === 'function' && trigger) ||
    (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  modal.setAttribute('data-modal-status', STATUS_ACTIVE);
  modal.setAttribute('aria-hidden', 'false');
  // Closed modals are inert (see closeAllModals) — lift it before focusModal()
  // runs, or nothing inside can take focus.
  modal.inert = false;
  modal.classList.add('open');

  // Lock scroll — uses Lenis if active, otherwise falls back to overflow:hidden
  lockScroll();

  // Auto-play any [video-section] (sectionVideoPlayer) inside the modal
  playModalVideos(modal);

  syncModalItemContent(modal, trigger);

  updateTriggerState(modalName, STATUS_ACTIVE);

  const group = findModalGroup(modal, trigger);
  if (group) {
    group.setAttribute('data-modal-group-status', STATUS_ACTIVE);
  }

  activeModal = modal;

  modal.dispatchEvent(
    new CustomEvent('modal:open', {
      detail: {
        name: modalName,
        trigger,
      },
      bubbles: true,
    })
  );

  focusModal(modal);
}

/**
 * Syncs active [data-modal-item] panel inside the modal to match the trigger's
 * [data-modal-item] value.
 *
 * - If the trigger has no [data-modal-item], this is a no-op.
 * - Removes 'active' from all [data-modal-item] elements inside the modal.
 * - Adds 'active' to the one whose attribute value matches the trigger's value.
 */
function syncModalItemContent(modal, trigger) {
  if (!modal || !trigger || !trigger.hasAttribute('data-modal-item')) return;

  const modalItem = trigger.getAttribute('data-modal-item');

  // Get all [data-modal-item] elements inside the modal
  const modalContentItems = modal.querySelectorAll('[data-modal-item]');

  if (!modalContentItems.length) return;

  // Remove active from all modal [data-modal-item] elements
  modalContentItems.forEach((item) => {
    item.classList.remove('active');
  });

  if (!modalItem) return;

  // Find the matching [data-modal-item] inside the modal and activate it
  const selector = getSafeSelector('data-modal-item', modalItem);
  if (!selector) return;

  const targetContent = modal.querySelector(selector);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

function closeAllModals(reason = 'manual', options = {}) {
  if (typeof document === 'undefined') return;

  const { skipFocusRestore = false } = options;

  resetAllTriggers();

  document.querySelectorAll(SELECTORS.modal).forEach((modal) => {
    const wasActive = modal.getAttribute('data-modal-status') === STATUS_ACTIVE;

    modal.setAttribute('data-modal-status', STATUS_INACTIVE);
    modal.setAttribute('aria-hidden', 'true');
    // Closed modals are only hidden visually (opacity/pointer-events), so their
    // links and buttons stayed in the Tab order — aria-hidden alone doesn't
    // remove them. inert does (same approach as the navbar dropdowns).
    modal.inert = true;
    modal.classList.remove('open');

    // Pause any video inside a [video-modal] so it doesn't keep playing (audio)
    // behind a closed modal. Managed players (regular/section) react to the
    // native 'pause' event, so their data-state stays in sync.
    pauseModalVideos(modal);

    if (modal.getAttribute('data-modal-temp-tabindex') === 'true') {
      modal.removeAttribute('tabindex');
      modal.removeAttribute('data-modal-temp-tabindex');
    }

    if (wasActive) {
      modal.dispatchEvent(
        new CustomEvent('modal:close', {
          detail: {
            name: modal.getAttribute('data-modal-name'),
            reason,
          },
          bubbles: true,
        })
      );
    }
  });

  document.querySelectorAll(SELECTORS.group).forEach((group) => {
    group.setAttribute('data-modal-group-status', STATUS_INACTIVE);
  });

  if (
    !skipFocusRestore &&
    previouslyFocusedElement &&
    typeof previouslyFocusedElement.focus === 'function' &&
    document.contains(previouslyFocusedElement)
  ) {
    try {
      previouslyFocusedElement.focus({ preventScroll: true });
    } catch (error) {
      previouslyFocusedElement.focus();
    }
  }

  previouslyFocusedElement = null;
  activeModal = null;

  // Unlock scroll — restores Lenis or clears overflow:hidden fallback
  unlockScroll();
}

/**
 * Pause videos inside a closing modal.
 *
 * Videos scoped by a [video-modal] element OR a [video-section] (sectionVideoPlayer)
 * are paused — the marker can be the modal root itself or any descendant wrapper.
 * Calls native pause(), which the regular/section video players observe to keep
 * their data-state in sync.
 */
function pauseModalVideos(modal) {
  if (!modal) return;

  const scopes = new Set();
  ['[video-modal]', '[video-section]'].forEach((selector) => {
    if (modal.matches(selector)) scopes.add(modal);
    modal.querySelectorAll(selector).forEach((scope) => scopes.add(scope));
  });
  if (!scopes.size) return;

  const videos = new Set();
  scopes.forEach((scope) => {
    scope.querySelectorAll('video').forEach((video) => videos.add(video));
  });

  videos.forEach((video) => {
    try {
      if (!video.paused) video.pause();
    } catch {
      // Ignore — element may already be detached mid-teardown.
    }
  });
}

/**
 * Play any [video-section] (sectionVideoPlayer) videos inside an opening modal.
 *
 * Clicks [video-toggle-btn] rather than calling video.play() directly: a
 * section still in its muted looping preview needs sectionVideoPlayer's own
 * start flow (src swap to the full video, unmute, overlay wipe) to actually
 * "play" — a raw play() call would just resume the preview loop. A section
 * that already started (e.g. re-opening a modal paused on close) simply
 * resumes, since the toggle button routes to play/pause based on current state.
 */
function playModalVideos(modal) {
  if (!modal) return;

  const sections = modal.matches('[video-section]')
    ? [modal]
    : Array.from(modal.querySelectorAll('[video-section]'));
  if (!sections.length) return;

  sections.forEach((section) => {
    const video = section.querySelector('.video-element');
    if (!video || !video.paused) return;

    const toggleBtn = section.querySelector('[video-toggle-btn]');
    if (toggleBtn) {
      toggleBtn.click();
    } else {
      video.play().catch(() => {});
    }
  });
}

function enhanceModalAccessibility(modal) {
  ensureModalId(modal);

  if (!modal.hasAttribute('role')) {
    modal.setAttribute('role', 'dialog');
  }
  modal.setAttribute('aria-modal', 'true');
  // The scroll lock is stopLenis(), and a stopped Lenis blocks wheel/touch
  // scrolling everywhere outside [data-lenis-prevent] — so a tall modal's own
  // content couldn't scroll unless the author remembered this attribute in
  // Webflow. (Lenis's allowNestedScroll covers most cases too; this is the
  // explicit guarantee.) Closed modals are pointer-events:none, so it has no
  // effect on the page behind them.
  modal.setAttribute('data-lenis-prevent', '');

  if (!modal.hasAttribute('data-modal-status')) {
    modal.setAttribute('data-modal-status', STATUS_INACTIVE);
  }

  const isActive = modal.getAttribute('data-modal-status') === STATUS_ACTIVE;
  modal.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  modal.inert = !isActive;

  if (!modal.hasAttribute('aria-labelledby')) {
    const heading = modal.querySelector('[data-modal-heading]');
    if (heading) {
      if (!heading.id) {
        headingIdCounter += 1;
        heading.id = `modal-heading-${headingIdCounter}`;
      }
      modal.setAttribute('aria-labelledby', heading.id);
    }
  }

  if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
    modal.setAttribute('aria-label', modal.getAttribute('data-modal-label') || DEFAULT_MODAL_LABEL);
  }
}

function isNativeControl(el) {
  return el.tagName === 'BUTTON' || (el.tagName === 'A' && el.hasAttribute('href'));
}

// The modal's own accessible name, reused to name a trigger that has no text
// of its own (e.g. an empty overlay div covering a card).
function getModalLabel(modal) {
  const labelledBy = (modal.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  const text = (
    labelledBy.map((id) => document.getElementById(id)?.textContent || '').join(' ') ||
    modal.getAttribute('aria-label') ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  return text && text !== DEFAULT_MODAL_LABEL ? text : 'Open dialog';
}

function enhanceTargetAccessibility() {
  const triggers = document.querySelectorAll(SELECTORS.trigger);
  if (!triggers.length) return;

  triggers.forEach((trigger) => {
    const modalName = trigger.getAttribute('data-modal-target');
    if (!modalName) return;

    const modalSelector = getSafeSelector('data-modal-name', modalName);
    if (!modalSelector) return;

    const modal = document.querySelector(modalSelector);
    if (!modal) {
      logger.warn(`[ModalBasic] Trigger found for unknown modal "${modalName}"`);
      return;
    }

    // Webflow often renders triggers as plain <div>s (e.g. the empty
    // .anchor-link-overlay on the /news Forum cards): not focusable, no role,
    // no name — mouse-only, and role="generic" doesn't allow the ARIA below.
    // Give them button semantics + keyboard focus (Enter/Space is bridged in
    // keydownHandler). Skipped when the trigger already contains a real
    // control: that inner control is the keyboard path (its click bubbles
    // here), and a role="button" wrapper around it would nest two controls.
    const hasInnerControl = !!trigger.querySelector('a[href], button, [tabindex]');
    if (!isNativeControl(trigger) && !hasInnerControl) {
      if (!trigger.hasAttribute('role')) trigger.setAttribute('role', 'button');
      if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
      const hasName =
        (trigger.getAttribute('aria-label') || '').trim() ||
        trigger.hasAttribute('aria-labelledby') ||
        trigger.textContent.trim();
      if (!hasName) trigger.setAttribute('aria-label', getModalLabel(modal));
    }

    const modalId = ensureModalId(modal);
    trigger.setAttribute('aria-controls', modalId);
    trigger.setAttribute('aria-haspopup', 'dialog');

    if (!trigger.hasAttribute('data-modal-status')) {
      trigger.setAttribute('data-modal-status', STATUS_INACTIVE);
    }

    const isActive = modal.getAttribute('data-modal-status') === STATUS_ACTIVE;
    trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  });
}

function focusElement(el) {
  try {
    el.focus({ preventScroll: true });
  } catch (error) {
    el.focus();
  }
}

// Make the dialog itself focusable (temporarily — removed again on close).
function focusModalItself(modal) {
  if (!modal.hasAttribute('tabindex')) {
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('data-modal-temp-tabindex', 'true');
  }
  focusElement(modal);
}

function focusModal(modal) {
  // Resolved inside the frame, once the open state has rendered — before it,
  // content can still be display:none and every candidate would be skipped.
  requestAnimationFrame(() => {
    if (activeModal !== modal) return; // closed or switched in the meantime
    const target = getInitialFocusTarget(modal);
    if (target) focusElement(target);
    // focus() fails silently on anything that can't take focus right now, so
    // verify — focus must never stay on the page behind the dialog. (On /news
    // the old first match was the unrendered fallback link inside the PDF
    // <object>, and focus stayed on <body>.)
    if (!modal.contains(document.activeElement)) focusModalItself(modal);
  });
}

function trapFocus(event) {
  if (!activeModal) return;
  if (!getFocusableElements(activeModal).length) {
    event.preventDefault();
    focusModalItself(activeModal);
    return;
  }
  trapTabKey(event, activeModal);
}

function shouldCloseOnOutsideClick(event, modal) {
  if (!modal.contains(event.target)) return false;

  const content = modal.querySelector(SELECTORS.content);
  if (!content) {
    // If there's no content wrapper, treat clicks directly on the modal root as overlay clicks
    return event.target === modal;
  }

  return !content.contains(event.target);
}

function allowOutsideClose(modal) {
  if (!modal) return false;
  if (!modal.hasAttribute('data-modal-close-outside')) return false;
  return modal.getAttribute('data-modal-close-outside') !== 'false';
}

function allowEscapeClose(modal) {
  return modal.getAttribute('data-modal-escape') !== 'false';
}

function findModalGroup(modal, trigger) {
  return modal.closest(SELECTORS.group) || trigger?.closest(SELECTORS.group) || null;
}

function resetAllTriggers() {
  document.querySelectorAll(SELECTORS.trigger).forEach((trigger) => {
    // aria-expanded only — aria-pressed would turn a dialog trigger into a
    // "toggle button" (and is invalid on links).
    trigger.setAttribute('data-modal-status', STATUS_INACTIVE);
    trigger.setAttribute('aria-expanded', 'false');
  });
}

function updateTriggerState(modalName, status) {
  const selector = getSafeSelector('data-modal-target', modalName);
  if (!selector) return;

  document.querySelectorAll(selector).forEach((trigger) => {
    trigger.setAttribute('data-modal-status', status);
    const isActive = status === STATUS_ACTIVE;
    trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  });
}

function ensureModalId(modal) {
  if (modal.id) return modal.id;
  modalIdCounter += 1;
  const newId = `modal-${modalIdCounter}`;
  modal.id = newId;
  return newId;
}

function getSafeSelector(attribute, value) {
  if (!attribute || value === null || typeof value === 'undefined') {
    return '';
  }

  const valueAsString = String(value);
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(valueAsString)
      : valueAsString.replace(/"/g, '\\"');

  return `[${attribute}="${escaped}"]`;
}
