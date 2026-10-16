/**
 * Global disclosure: .dropdown / .dropdown-head / .dropdown-body (or bare
 * attributes of the same names). Webflow owns the visual design; this
 * component owns placement, interaction and accessibility.
 * Native popovers escape clipping ancestors without moving or cloning content.
 * Controls keep their native semantics; arbitrary content is a labelled group,
 * never guessed to be a menu/listbox. Finsweet reset radios share their field's group;
 * clicking the selected radio again clears it (selects the reset, else unchecks it).
 * Optional: data-dropdown-event="hover", data-dropdown-close-delay="150",
 * data-dropdown-close-on-select, data-dropdown-group="name". .open starts open.
 * dropdown:toggle bubbles with detail.open. cleanupDropdown restores enhancements.
 */
import { logger } from '../utils/logger';
import { getFocusableElements } from '../utils/focus';

const ROOT = '.dropdown, [dropdown]';
const instances = new Map();
let events;
let observer;
let resizeObserver;
let frame = 0;
let idCounter = 0;
let pointerTarget = null;

function uniqueId() {
  let id;
  do {
    id = `dropdown-${++idCounter}`;
  } while (document.getElementById(id));
  return id;
}

// Remember only properties we change, so teardown preserves other scripts' work.
function attribute(instance, element, name, value) {
  let saved = instance.attributes.get(element);
  if (!saved) instance.attributes.set(element, (saved = new Map()));
  if (!saved.has(name)) saved.set(name, element.getAttribute(name));
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function enhanceContent(instance) {
  const { body } = instance;
  body.querySelectorAll('input, select, textarea').forEach((input) => {
    if (input.closest(ROOT) !== instance.root) return;
    // Webflow's copied "All" radio must reset its own Finsweet field, not another.
    if (input.matches('input[type="radio"][fs-list-field][fs-list-value=""]')) {
      const names = new Set(
        [...body.querySelectorAll('input[type="radio"][fs-list-field]')]
          .filter(
            (peer) =>
              peer.getAttribute('fs-list-field') === input.getAttribute('fs-list-field') &&
              peer.getAttribute('fs-list-value') &&
              peer.name
          )
          .map((peer) => peer.name)
      );
      if (names.size === 1) attribute(instance, input, 'name', [...names][0]);
      if (
        !input.disabled &&
        ![...body.querySelectorAll('input[type="radio"]')].some(
          (peer) => peer.name === input.name && peer.checked
        )
      ) {
        attribute(instance, input, 'checked', '');
        input.checked = true;
      }
    }
    const label = input.closest('label');
    if (!label) return;
    if (!input.id || document.querySelectorAll(`#${CSS.escape(input.id)}`).length > 1) {
      attribute(instance, input, 'id', uniqueId());
      attribute(instance, label, 'for', input.id);
      label.querySelectorAll('[for]').forEach((text) => attribute(instance, text, 'for', input.id));
    }
  });
}

function position(instance) {
  const { root, head, body } = instance;
  if (!body.matches(':popover-open')) return;
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 12;
  const top = (viewport?.offsetTop || 0) + 12;
  const right = left + (viewport?.width || document.documentElement.clientWidth) - 24;
  const bottom = top + (viewport?.height || window.innerHeight) - 24;
  const trigger = head.getBoundingClientRect();
  if (
    trigger.bottom < top ||
    trigger.top > bottom ||
    trigger.right < left ||
    trigger.left > right
  ) {
    setOpen(instance, false);
    return;
  }
  body.style.setProperty('--dropdown-max-width', `${Math.max(0, right - left)}px`);
  body.style.setProperty('--dropdown-min-width', `${Math.min(trigger.width, right - left)}px`);
  const below = Math.max(0, bottom - trigger.bottom - 6);
  const above = Math.max(0, trigger.top - top - 6);
  // Measure untransformed layout: a running entrance must not change placement.
  const naturalHeight = body.scrollHeight;
  const flip = naturalHeight > below && above > below;
  body.style.setProperty('--dropdown-max-height', `${flip ? above : below}px`);
  const x = Math.min(
    Math.max(trigger.left, left),
    Math.max(left, right - Math.ceil(parseFloat(getComputedStyle(body).width)))
  );
  const y = flip
    ? trigger.top - 6 - Math.ceil(parseFloat(getComputedStyle(body).height))
    : trigger.bottom + 6;
  body.style.setProperty('--dropdown-x', `${x}px`);
  body.style.setProperty('--dropdown-y', `${Math.max(top, y)}px`);
  body.style.setProperty(
    '--dropdown-origin',
    `${Math.max(0, Math.min(body.offsetWidth, trigger.left + trigger.width / 2 - x))}px ${flip ? '100%' : '0%'}`
  );
  root.setAttribute('data-dropdown-positioned', '');
}

function schedulePosition() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    instances.forEach(position);
  });
}

function setOpen(instance, open, instant = false) {
  clearTimeout(instance.timer);
  instance.root.toggleAttribute('data-dropdown-instant', instant);
  if (open === instance.body.matches(':popover-open')) return;
  if (open) {
    instance.root.removeAttribute('data-dropdown-positioned');
    const group = instance.root.getAttribute('data-dropdown-group');
    if (group)
      instances.forEach((other) => {
        if (other !== instance && other.root.getAttribute('data-dropdown-group') === group)
          setOpen(other, false, instant);
      });
    instance.body.showPopover({ source: instance.head });
    position(instance);
  } else {
    instance.body.hidePopover();
  }
}

function bindEvents() {
  if (events) return;
  events = new AbortController();
  const { signal } = events;
  document.addEventListener(
    'pointerdown',
    (event) => {
      pointerTarget = event.target;
      instances.forEach((instance) => {
        instance.root.removeAttribute('data-dropdown-instant');
        // Native light-dismiss happens before click when a div acts as the invoker.
        instance.pointerOpen = instance.head.contains(event.target)
          ? !instance.body.matches(':popover-open')
          : undefined;
      });
    },
    { signal }
  );
  document.addEventListener(
    'keydown',
    (event) => {
      pointerTarget = null;
      const instance = instances.get(event.target.closest(ROOT));
      instance?.root.setAttribute('data-dropdown-instant', '');
    },
    { signal, capture: true }
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const instance = instances.get(event.target.closest(ROOT));
      if (!instance?.body.matches(':popover-open')) return;
      setOpen(instance, false, true);
      instance.head.focus({ preventScroll: true });
      event.preventDefault();
    },
    { signal }
  );
  document.addEventListener(
    'focusout',
    (event) => {
      const root = event.target.closest(ROOT);
      const instance = instances.get(root);
      if (!instance || root.contains(event.relatedTarget)) return;
      if (!event.relatedTarget && root.contains(pointerTarget)) return;
      requestAnimationFrame(() => {
        if (instances.has(root) && !root.contains(document.activeElement))
          setOpen(instance, false, true);
      });
    },
    { signal }
  );
  window.addEventListener('resize', schedulePosition, { signal, passive: true });
  document.addEventListener(
    'scroll',
    (event) => {
      if (![...instances.values()].some(({ body }) => body.contains(event.target)))
        schedulePosition();
    },
    { signal, passive: true, capture: true }
  );
  window.visualViewport?.addEventListener('resize', schedulePosition, { signal, passive: true });
  window.visualViewport?.addEventListener('scroll', schedulePosition, { signal, passive: true });
  resizeObserver = new ResizeObserver(schedulePosition);
  observer = new MutationObserver(() => {
    instances.forEach(enhanceContent);
    schedulePosition();
  });
}

export function initDropdown() {
  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    logger.warn('[Dropdown] Requires a browser with the Popover API.');
    return;
  }
  document.querySelectorAll(ROOT).forEach((root) => {
    if (instances.has(root)) return;
    const head = [...root.querySelectorAll('.dropdown-head, [dropdown-head]')].find(
      (el) => el.closest(ROOT) === root
    );
    const body = [...root.querySelectorAll('.dropdown-body, [dropdown-body]')].find(
      (el) => el.closest(ROOT) === root
    );
    if (!head || !body) return;
    bindEvents();
    const instance = {
      root,
      head,
      body,
      attributes: new Map(),
      styles: new Map(
        [
          '--dropdown-display',
          '--dropdown-max-width',
          '--dropdown-min-width',
          '--dropdown-max-height',
          '--dropdown-x',
          '--dropdown-y',
          '--dropdown-origin',
        ].map((name) => [
          name,
          [body.style.getPropertyValue(name), body.style.getPropertyPriority(name)],
        ])
      ),
      timer: 0,
      startOpen: root.classList.contains('open'),
    };
    instances.set(root, instance);
    if (!head.id || document.querySelectorAll(`#${CSS.escape(head.id)}`).length > 1)
      attribute(instance, head, 'id', uniqueId());
    if (!body.id || document.querySelectorAll(`#${CSS.escape(body.id)}`).length > 1)
      attribute(instance, body, 'id', uniqueId());
    if (!head.matches('button, input[type="button"], input[type="submit"]')) {
      attribute(instance, head, 'role', 'button');
      attribute(instance, head, 'tabindex', '0');
    } else if (head.matches('button') && !head.hasAttribute('type')) {
      attribute(instance, head, 'type', 'button');
    }
    attribute(instance, head, 'aria-controls', body.id);
    attribute(instance, head, 'aria-expanded', 'false');
    if (body.matches('div, span') && !body.hasAttribute('role'))
      attribute(instance, body, 'role', 'group');
    if (!body.hasAttribute('aria-label') && !body.hasAttribute('aria-labelledby'))
      attribute(instance, body, 'aria-labelledby', head.id);
    if (!body.hasAttribute('tabindex')) attribute(instance, body, 'tabindex', '-1');
    attribute(instance, body, 'hidden', null);
    attribute(instance, body, 'inert', '');
    attribute(instance, body, 'aria-hidden', 'true');
    const display = getComputedStyle(body).display;
    attribute(instance, body, 'popover', 'auto');
    body.style.setProperty('--dropdown-display', display === 'none' ? 'block' : display);
    attribute(instance, root, 'data-dropdown-ready', '');
    const { signal } = events;
    body.addEventListener(
      'beforetoggle',
      (event) => {
        const open = event.newState === 'open';
        root.classList.toggle('open', open);
        head.setAttribute('aria-expanded', String(open));
        body.inert = !open;
        body.setAttribute('aria-hidden', String(!open));
        clearTimeout(instance.timer);
        root.dispatchEvent(new CustomEvent('dropdown:toggle', { detail: { open }, bubbles: true }));
      },
      { signal }
    );
    head.addEventListener(
      'click',
      (event) => {
        if (head.matches(':disabled, [aria-disabled="true"]')) return;
        event.preventDefault();
        const open =
          event.detail > 0 && instance.pointerOpen !== undefined
            ? instance.pointerOpen
            : !body.matches(':popover-open');
        instance.pointerOpen = undefined;
        setOpen(instance, open, event.detail === 0);
      },
      { signal }
    );
    head.addEventListener(
      'keydown',
      (event) => {
        if (head.matches(':disabled, [aria-disabled="true"]')) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen(instance, !body.matches(':popover-open'), true);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(instance, true, true);
          const controls = getFocusableElements(body);
          const selected = controls.find((control) =>
            control.matches('input[type="radio"]:checked')
          );
          (selected || (event.key === 'ArrowUp' ? controls.at(-1) : controls[0]) || body).focus({
            preventScroll: true,
          });
        }
      },
      { signal }
    );
    if (root.getAttribute('data-dropdown-event') === 'hover') {
      root.addEventListener(
        'pointerenter',
        (event) => {
          if (
            event.pointerType !== 'mouse' ||
            !matchMedia('(hover: hover) and (pointer: fine)').matches
          )
            return;
          setOpen(instance, true);
        },
        { signal }
      );
      root.addEventListener(
        'pointerleave',
        (event) => {
          if (event.pointerType !== 'mouse' || root.contains(document.activeElement)) return;
          const delay = parseInt(root.getAttribute('data-dropdown-close-delay'), 10);
          instance.timer = setTimeout(
            () => setOpen(instance, false),
            Number.isFinite(delay) ? Math.max(0, delay) : 150
          );
        },
        { signal }
      );
    }
    if (root.hasAttribute('data-dropdown-close-on-select')) {
      body.addEventListener(
        'click',
        (event) => {
          if (event.target.closest('a[href], button')) {
            setOpen(instance, false, event.detail === 0);
            if (body.contains(document.activeElement)) head.focus({ preventScroll: true });
          }
        },
        { signal }
      );
    }
    // Clicking the selected option again clears it: its field's "All" radio
    // is selected (Finsweet's reset), else the radio is simply unchecked.
    // Whether it was already selected is noted as it's pressed — by the
    // click, the browser has checked it either way.
    body.addEventListener(
      'pointerdown',
      (event) => {
        const input = event.target.closest('label')?.querySelector('input[type="radio"]');
        instance.pressed = input ? { input, wasChecked: input.checked } : null;
      },
      { signal, capture: true }
    );
    body.addEventListener(
      'click',
      (event) => {
        const { pressed } = instance;
        if (!pressed || event.target !== pressed.input) return;
        instance.pressed = null;
        const { input } = pressed;
        if (!pressed.wasChecked || input.getAttribute('fs-list-value') === '') return;
        const reset = [...body.querySelectorAll('input[type="radio"][fs-list-value=""]')].find(
          (peer) => peer.name === input.name && peer !== input && !peer.disabled
        );
        if (reset) {
          reset.click();
          return;
        }
        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { signal }
    );
    body.addEventListener(
      'focusin',
      (event) => {
        // Reveal keyboard focus within the panel without scrolling the page/trigger.
        const bounds = body.getBoundingClientRect();
        const target = event.target.getBoundingClientRect();
        if (target.top < bounds.top) body.scrollTop += target.top - bounds.top - body.clientTop;
        else if (target.bottom > bounds.bottom)
          body.scrollTop += target.bottom - bounds.bottom + body.clientTop;
      },
      { signal }
    );
    enhanceContent(instance);
    resizeObserver.observe(head);
    resizeObserver.observe(body);
    observer.observe(body, { childList: true, subtree: true, characterData: true });
    if (instance.startOpen) setOpen(instance, true, true);
  });
}

export function cleanupDropdown() {
  events?.abort();
  events = null;
  observer?.disconnect();
  resizeObserver?.disconnect();
  cancelAnimationFrame(frame);
  frame = 0;
  instances.forEach((instance) => {
    clearTimeout(instance.timer);
    if (instance.body.matches(':popover-open')) instance.body.hidePopover();
    instance.attributes.forEach((attributes, element) =>
      attributes.forEach((value, name) => {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      })
    );
    instance.styles.forEach(([value, priority], name) => {
      if (value) instance.body.style.setProperty(name, value, priority);
      else instance.body.style.removeProperty(name);
    });
    instance.root.classList.toggle('open', instance.startOpen);
    instance.root.removeAttribute('data-dropdown-positioned');
    instance.root.removeAttribute('data-dropdown-instant');
  });
  instances.clear();
  pointerTarget = null;
}
