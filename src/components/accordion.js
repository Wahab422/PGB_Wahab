/**
 * Accordion — Accessibility Patterns (WCAG 2.1 AA)
 * --------------------------------------------------
 * Each accordion item follows the WAI-ARIA Accordion pattern:
 *
 * [data-accordion-toggle] (trigger wrapper):
 *   - If it contains a real interactive descendant (a <button> or <a href>),
 *     THAT element becomes the actual control: it gets aria-expanded /
 *     aria-controls / aria-label and keyboard focus. The wrapper itself
 *     stays a plain, non-interactive click target (bigger hit area for
 *     mouse users only).
 *   - Only when no such descendant exists does the wrapper itself become
 *     the control (role="button", tabindex="0"). This avoids nesting two
 *     interactive elements — a role="button" div wrapping a real <button> —
 *     which is its own violation and produces a duplicate keyboard stop.
 *   - aria-label is computed from the WRAPPER's full trimmed text content
 *     (so it reflects the visible question even when the actual control is
 *     an icon-only nested button with no text of its own), unless one is
 *     already set by hand.
 *   - Keyboard:
 *       Enter / Space — toggle the panel open or closed.
 *       ArrowDown — move focus to the next accordion trigger.
 *       ArrowUp — move focus to the previous accordion trigger.
 *       Home — move focus to the first trigger.
 *       End — move focus to the last trigger.
 *       Escape — close the open panel and return focus to its trigger.
 *
 * [data-accordion-body] (animated wrapper, required):
 *   - The grid-template-rows collapse trick lives here (see CSS below).
 *
 * [data-accordion-content] (inner content region, optional but recommended):
 *   - Child of [data-accordion-body]. Gets role="region", aria-labelledby,
 *     a stable id, and `inert` mirrors collapsed/expanded state.
 *   - If this attribute hasn't been added in Webflow yet, [data-accordion-body]
 *     itself is used as the content region instead, so ARIA wiring and
 *     `inert` still work correctly today. Add data-accordion-content to the
 *     inner wrapper (child of body) to match the fully documented structure.
 *   - `inert` is what actually keeps a closed panel's links out of the tab
 *     order and out of the accessibility tree — the CSS collapse alone does
 *     not do this, it's a purely visual clip. Without a working content
 *     target, a Tab user lands on invisible links inside every closed panel.
 *
 * Container ([data-accordion-list]):
 *   - role="region" with aria-label or aria-labelledby from the nearest heading
 *     so screen readers can navigate to the accordion as a landmark.
 *
 * Hover event type:
 *   - When data-accordion-event="hover", the items open on mouseenter over
 *     the wrapper (a larger hover target is normal UX for hover menus).
 *     Keyboard users still get Enter / Space + Arrow navigation because those
 *     handlers are added unconditionally.
 *
 * data-accordion-auto-change:
 *   - Cycles panels on a timer with no pause control. WCAG 2.2.2 requires a
 *     way to pause, stop, or hide auto-updating content that runs longer
 *     than 5 seconds, unless it's part of an essential activity. This
 *     attribute isn't currently used anywhere on the site — if it's adopted
 *     later, add a visible pause control before shipping it.
 *
 * Screen reader expectation:
 *   Tab → "FAQ, collapsed, button" → Enter → "FAQ, expanded, button" →
 *   Tab into panel content → Escape (generic browser behaviour) returns to trigger.
 *
 * Accordion Component (Shared Utility)
 * CSS-based accordion with optional image sync
 *
 * Called globally from global/index.js — initAccordion() no-ops on pages with
 * no [data-accordion-list="css"] elements, so no per-page wiring is needed.
 *
 * Usage:
 * 1. Add data attributes in Webflow (see below)
 *
 * Webflow Setup:
 * 1. Add data-accordion-list="css" to the accordion container
 * 2. Add data-accordion to each accordion item
 * 3. Add data-accordion-toggle to the clickable header/trigger
 * 4. Add data-accordion-body to the animated wrapper (direct child of item)
 * 5. Add data-accordion-content to the inner content element (child of body)
 *    — recommended; falls back to data-accordion-body itself if omitted.
 *
 * Options (add to data-accordion-list element):
 * - data-accordion-close-siblings="true" - Close other panels when one opens
 * - data-accordion-first-active="true" - Open first panel on load
 * - data-accordion-collapsible="false" - Keep at least one panel open (defaults to true)
 * - data-accordion-event="hover" - Use hover instead of click
 * - data-accordion-desktop-only - Only initialize on screens >= 992px
 */
import { scheduleScrollRefresh, scrollTo as lenisScrollTo } from '../global/lenis';
import { handleError } from '../utils/helpers';
import { logger } from '../utils/logger';

const accordionInitialized = new Set();
// Timers and observers to stop on cleanup (a page swap).
const accordionCleanups = [];
let _accordionIdCounter = 0;
const DESKTOP_MIN_WIDTH = 992;
const ACCORDION_CSS_TEXT = `
/* Accordions CSS */
[data-accordion-list='css'] [data-accordion-body] {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.6s cubic-bezier(0.625, 0.05, 0, 1);
}

[data-accordion-list='css'] [data-accordion='active'] [data-accordion-body] {
  grid-template-rows: 1fr !important;
}

[data-accordion-list='css'] [data-accordion-content] {
  overflow: hidden;
  min-height: 0;
}

/* overflow:hidden above is load-bearing for the grid-template-rows collapse
   trick (it's what lets the row actually shrink to 0fr instead of being
   forced tall by its content's intrinsic min-height) — but it also clips a
   focus ring on a link near the panel's top/bottom edge while open. Lift it
   only while something inside has focus. */
[data-accordion-list='css'] [data-accordion-content]:focus-within {
  overflow: visible;
}

[data-accordion-img] {
  position: absolute !important;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}

[data-accordion-img='active'] {
  opacity: 1;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}

/* Auto-change progress bar */
[data-accordion-list][data-accordion-auto-change] [data-accordion-progress] {
  opacity: 0;
}

[data-accordion-list][data-accordion-auto-change] [data-accordion='active'] [data-accordion-progress] {
  opacity: 1;
  animation: accordion-progress-fill var(--accordion-duration, 4s) linear forwards;
}

@keyframes accordion-progress-fill {
  from { width: 0%; }
  to { width: 100%; }
}

/* prefers-reduced-motion: open/close and image swaps happen instantly. */
@media (prefers-reduced-motion: reduce) {
  [data-accordion-list='css'] [data-accordion-body],
  [data-accordion-img] {
    transition: none;
  }
}
`;
let accordionCssInjected = false;

function ensureAccordionCSS() {
  if (accordionCssInjected || typeof document === 'undefined') return;
  accordionCssInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-accordion-style', 'true');
  style.textContent = ACCORDION_CSS_TEXT;
  document.head.appendChild(style);
}

function shouldInitForViewport(accordion) {
  if (!accordion || !accordion.hasAttribute('data-accordion-desktop-only')) {
    return true;
  }

  if (typeof window === 'undefined' || !window.matchMedia) {
    return true;
  }

  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

/**
 * Given the [data-accordion-toggle] wrapper, return the element that should
 * actually carry the accessible name + state, and be the keyboard stop.
 * Prefers a real interactive descendant (button / link) over the wrapper
 * itself, so we never end up with a role="button" div wrapping a real
 * <button> (an ARIA "nested interactive controls" violation).
 */
function resolveToggleControl(toggleWrap) {
  if (!toggleWrap) return null;
  return toggleWrap.querySelector('button, a[href], [role="button"]') || toggleWrap;
}

/**
 * Given an accordion item, return the element that should carry role="region",
 * aria-labelledby, and `inert`. Prefers the documented inner
 * [data-accordion-content] (child of [data-accordion-body]); falls back to
 * [data-accordion-body] itself if that attribute hasn't been added in
 * Webflow yet, so ARIA wiring and `inert` keep working either way.
 */
function resolveContentRegion(item) {
  const body = item.querySelector('[data-accordion-body]');
  if (!body) return null;
  return body.querySelector('[data-accordion-content]') || body;
}

function actuallyInitAccordion(accordion) {
  if (accordionInitialized.has(accordion)) return;
  accordionInitialized.add(accordion);

  logger.log('🎵 Accordion initializing...');

  try {
    const closeSiblings = accordion.getAttribute('data-accordion-close-siblings') === 'true';
    const firstActive = accordion.getAttribute('data-accordion-first-active') === 'true';
    const collapsible = accordion.getAttribute('data-accordion-collapsible') !== 'false';
    const eventType = accordion.getAttribute('data-accordion-event') || 'click';
    const scrollActive = accordion.hasAttribute('data-accordion-scroll-active');

    // Only set role="region" if Webflow hasn't already set a role (e.g. role="list")
    // — overriding role="list" breaks the role="listitem" containment on w-dyn-items.
    if (!accordion.hasAttribute('role')) accordion.setAttribute('role', 'region');
    if (!accordion.hasAttribute('aria-label') && !accordion.hasAttribute('aria-labelledby')) {
      const heading = accordion.querySelector('h1,h2,h3,h4,h5,h6');
      if (heading) {
        if (!heading.id) heading.id = `accordion-heading-${++_accordionIdCounter}`;
        accordion.setAttribute('aria-labelledby', heading.id);
      } else {
        accordion.setAttribute('aria-label', accordion.dataset.label || 'Accordion section');
      }
    }

    const accordionInstanceId = ++_accordionIdCounter;

    const items = accordion.querySelectorAll('[data-accordion]');
    items.forEach((item, index) => {
      const toggleWrap = item.querySelector('[data-accordion-toggle]');
      const toggle = resolveToggleControl(toggleWrap);
      const content = resolveContentRegion(item);

      if (toggle && content) {
        const contentId = content.id || `accordion-content-${accordionInstanceId}-${index}`;
        const toggleId = toggle.id || `accordion-toggle-${accordionInstanceId}-${index}`;

        content.id = contentId;
        toggle.id = toggleId;

        // Only fake button semantics when there's no real interactive
        // element to use — a real <button>/<a> already has these for free.
        if (toggle === toggleWrap) {
          toggle.setAttribute('role', 'button');
          toggle.setAttribute('tabindex', '0');
        }

        toggle.setAttribute('aria-controls', contentId);
        const isActive = item.getAttribute('data-accordion') === 'active';
        toggle.setAttribute('aria-expanded', String(isActive));

        // Check for a MEANINGFUL existing label, not just the attribute's
        // presence — hasAttribute('aria-label') is true even for
        // aria-label="", which would otherwise be treated as "already
        // labeled" and left silently unnamed.
        const existingLabel = (toggle.getAttribute('aria-label') || '').trim();
        if (!existingLabel && !toggle.hasAttribute('aria-labelledby')) {
          // Read from the wrapper, not just `toggle` — if toggle resolved to
          // an icon-only nested button, its own textContent is empty, but
          // the wrapper still contains the visible heading text.
          const label = (toggleWrap.textContent || '').replace(/\s+/g, ' ').trim();
          if (label) toggle.setAttribute('aria-label', label);
        }

        content.setAttribute('role', 'region');
        content.setAttribute('aria-labelledby', toggleId);
        content.inert = !isActive;
      } else if (!content) {
        logger.log(
          '⚠️ Accordion item has no [data-accordion-body] — skipping ARIA wiring for this item.'
        );
      }
    });

    if (firstActive) {
      const first = accordion.querySelector('[data-accordion]');
      if (first) {
        first.setAttribute('data-accordion', 'active');
        const toggle = resolveToggleControl(first.querySelector('[data-accordion-toggle]'));
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'true');
        }
        const content = resolveContentRegion(first);
        if (content) content.inert = false;
        first.dispatchEvent(
          new CustomEvent('accordion:toggle', {
            detail: { open: true },
            bubbles: true,
          })
        );
      }
    }

    function toggleItem(item, open) {
      if (!open && !collapsible) {
        const activeCount = accordion.querySelectorAll('[data-accordion="active"]').length;
        if (activeCount <= 1) return;
      }

      item.setAttribute('data-accordion', open ? 'active' : 'not-active');

      const toggle = resolveToggleControl(item.querySelector('[data-accordion-toggle]'));
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      const content = resolveContentRegion(item);
      if (content) content.inert = !open;

      item.dispatchEvent(
        new CustomEvent('accordion:toggle', {
          detail: { open },
          bubbles: true,
        })
      );

      if (closeSiblings && open) {
        accordion.querySelectorAll('[data-accordion="active"]').forEach((sib) => {
          if (sib !== item) {
            sib.setAttribute('data-accordion', 'not-active');
            const sibToggle = resolveToggleControl(sib.querySelector('[data-accordion-toggle]'));
            if (sibToggle) {
              sibToggle.setAttribute('aria-expanded', 'false');
            }
            const sibContent = resolveContentRegion(sib);
            if (sibContent) sibContent.inert = true;
            sib.dispatchEvent(
              new CustomEvent('accordion:toggle', {
                detail: { open: false },
                bubbles: true,
              })
            );
          }
        });
      }

      scheduleScrollRefresh();

      if (scrollActive && open && toggle) {
        let scrolled = false;
        const maybeScroll = () => {
          if (scrolled) return;
          if (toggle.getBoundingClientRect().top < 0) {
            scrolled = true;
            lenisScrollTo(toggle);
          }
        };
        requestAnimationFrame(maybeScroll);
        setTimeout(maybeScroll, 650);
      }
    }

    if (eventType === 'hover') {
      accordion.querySelectorAll('[data-accordion-toggle]').forEach((toggleWrap) => {
        const item = toggleWrap.closest('[data-accordion]');
        if (!item) return;
        toggleWrap.addEventListener('mouseenter', () => toggleItem(item, true));
      });
    } else {
      accordion.addEventListener('click', (e) => {
        const toggleWrap = e.target.closest('[data-accordion-toggle]');
        if (!toggleWrap) return;
        const item = toggleWrap.closest('[data-accordion]');
        if (!item) return;
        const isActive = item.getAttribute('data-accordion') === 'active';
        toggleItem(item, !isActive);
      });
    }

    // Keyboard navigation — always active regardless of eventType.
    accordion.addEventListener('keydown', (e) => {
      const toggleWrap = e.target.closest('[data-accordion-toggle]');
      if (!toggleWrap) return;

      // Only handle keys when focus is actually on the resolved control
      // (the real button/link, or the wrapper if no button exists) — not
      // on arbitrary focusable content elsewhere inside the wrapper.
      const toggle = resolveToggleControl(toggleWrap);
      if (e.target !== toggle) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = toggleWrap.closest('[data-accordion]');
        if (!item) return;
        const isActive = item.getAttribute('data-accordion') === 'active';
        toggleItem(item, !isActive);
        return;
      }

      if (e.key === 'Escape') {
        const item = toggleWrap.closest('[data-accordion]');
        if (item && item.getAttribute('data-accordion') === 'active') {
          toggleItem(item, false);
          toggle.focus();
        }
        return;
      }

      // Arrow-key navigation between accordion triggers (WAI-ARIA pattern).
      // Built from resolved controls, not raw wrapper divs — a wrapper
      // without tabindex can't actually receive .focus().
      const allToggles = Array.from(accordion.querySelectorAll('[data-accordion-toggle]'))
        .map(resolveToggleControl)
        .filter(Boolean);
      const currentIndex = allToggles.indexOf(toggle);
      if (currentIndex === -1) return;

      let targetIndex = -1;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (currentIndex + 1) % allToggles.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (currentIndex - 1 + allToggles.length) % allToggles.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = allToggles.length - 1;
      }

      if (targetIndex !== -1) {
        try {
          allToggles[targetIndex].focus({ preventScroll: false });
        } catch (_) {
          allToggles[targetIndex].focus();
        }
      }
    });

    // Auto-change — cycles through items on a timer when data-accordion-auto-change is present.
    // NOTE: not currently used anywhere on the site (verified). If adopted later,
    // add a visible pause/stop control before shipping — see WCAG 2.2.2 note above.
    const autoChangeAttr = accordion.getAttribute('data-accordion-auto-change');
    if (autoChangeAttr !== null) {
      const seconds = parseFloat(autoChangeAttr) || 4;
      accordion.style.setProperty('--accordion-duration', `${seconds}s`);

      const itemsArray = Array.from(items);
      let autoTimer = null;

      function scheduleNext() {
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => {
          const current = itemsArray.findIndex(
            (i) => i.getAttribute('data-accordion') === 'active'
          );
          toggleItem(itemsArray[(current + 1) % itemsArray.length], true);
          scheduleNext();
        }, seconds * 1000);
      }

      scheduleNext();
      accordionCleanups.push(() => clearTimeout(autoTimer));

      // Reset the timer whenever the user manually clicks a trigger.
      accordion.addEventListener('click', (e) => {
        if (e.target.closest('[data-accordion-toggle]')) scheduleNext();
      });
    }
  } catch (error) {
    handleError(error, 'Accordion Initialization');
  }
}

export function initAccordionCSS() {
  const accordions = document.querySelectorAll('[data-accordion-list="css"]');

  if (!accordions.length) return;
  ensureAccordionCSS();

  logger.log(`🎵 Found ${accordions.length} accordion(s) - initializing...`);

  accordions.forEach((accordion) => {
    if (!shouldInitForViewport(accordion)) return;
    actuallyInitAccordion(accordion);
  });
}

/**
 * Initialize accordion image sync
 * Syncs images with accordion states
 * Uses IntersectionObserver to defer image wiring until the block is near the viewport.
 *
 * Usage in Webflow:
 * 1. Create a parent element with data-accordion-imgs
 * 2. Inside, have your accordion with data-accordion-list="css"
 * 3. Add data-accordion-img to each image you want to sync
 * 4. Images will show/hide based on which accordion panel is active
 */
export function initAccordionImages() {
  const imgsBlocks = document.querySelectorAll('[data-accordion-imgs]');

  if (!imgsBlocks.length) return;

  logger.log(`⏳ Found ${imgsBlocks.length} accordion image block(s) - will sync when visible...`);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          initImageBlockSync(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    }
  );

  imgsBlocks.forEach((block) => {
    observer.observe(block);
  });
  accordionCleanups.push(() => observer.disconnect());
}

function initImageBlockSync(imgsBlock) {
  logger.log('🖼️ Accordion images syncing...');

  const accordions = Array.from(imgsBlock.querySelectorAll('[data-accordion-list="css"]')).flatMap(
    (list) => Array.from(list.querySelectorAll('[data-accordion]'))
  );
  const imgs = imgsBlock.querySelectorAll('[data-accordion-img]');

  if (!accordions.length || !imgs.length) return;

  const setActiveByIndex = (idx) => {
    imgs.forEach((img, i) =>
      img.setAttribute('data-accordion-img', i === idx ? 'active' : 'not-active')
    );
  };

  const updateFromDOM = () => {
    const idx = accordions.findIndex((acc) => acc.getAttribute('data-accordion') === 'active');
    // Default to first image when none are active
    setActiveByIndex(idx >= 0 ? idx : 0);
  };

  updateFromDOM();

  accordions.forEach((acc, i) => {
    acc.addEventListener('accordion:toggle', (e) => {
      if (e.detail.open) setActiveByIndex(i);
    });
  });

  logger.log('✅ Accordion images synced');
}

export function initAccordion() {
  initAccordionCSS();
  initAccordionImages();
  scheduleScrollRefresh();
}

/** Stop the timers and observers and forget the accordions (a page swap). */
export function cleanupAccordion() {
  accordionCleanups.splice(0).forEach((stop) => stop());
  accordionInitialized.clear();
}
