/**
 * Image Hover — a hover for any image, site-wide and opt-in: the image pushes
 * in slowly (a slight zoom, long soft ease) and a light shade fades over it.
 * All of it is CSS transitions on transform / opacity (src/styles/
 * image-hover.css); this script only builds the layers and switches the state.
 * Initialised from src/global/index.js on pages that have one. Project cards
 * ([data-project-hover], components/projectHover.js) use the same hover for
 * their image, driven by the whole card.
 *
 * ── Markup (one attribute in Webflow) ────────────────────────────────────────
 *   <div class="any-image-wrap" data-image-hover>   ← on the image's frame…
 *     <img …>
 *   </div>
 *   <img data-image-hover …>                         ← …or on the image itself
 *                                                      (its parent is the frame)
 * The frame is the hover area. It should clip its content (overflow: hidden,
 * or a [data-reveal-image] frame) so the zoom stays inside it.
 *
 * ── Options (on [data-image-hover], or on a [data-project-hover] card) ───────
 *   data-image-hover-zoom="1.06"    how far the image pushes in
 *   data-image-hover-shade="0.14"   the shade's strength (0–1; "0" for none)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The image is wrapped in its own zoom layer, so the push-in never fights an
 * animation already on the image (src/animations/imageReveal.js clips the
 * frame and moves the image). On with a mouse (pointerenter / pointerleave)
 * and with the keyboard (focus inside the frame, when focus is visible);
 * never on touch, where :hover would stick. Under prefers-reduced-motion only
 * the shade fades. cleanupImageHovers() restores the authored markup.
 */

const SELECTOR = '[data-image-hover]';
const CARD = '[data-project-hover]';
// The state the stylesheet animates, set on the hover area (frame or card).
export const HOVER_ON_ATTR = 'data-hover-on';
// Layers this script adds.
const ZOOM_ATTR = 'data-image-hover-zoom-layer';
const SHADE_ATTR = 'data-image-hover-shade-layer';

const cleanups = [];

const readNumber = (el, name) => {
  const value = Number.parseFloat(el?.getAttribute(name));
  return Number.isFinite(value) ? value : null;
};

/**
 * Wrap `img` in a zoom layer that takes its place in its frame, with a shade
 * over it. Options are read from `optionsFrom` (the [data-image-hover]
 * element or the card). Returns an undo.
 */
export function addImageHover(img, optionsFrom = img) {
  const zoom = document.createElement('div');
  zoom.setAttribute(ZOOM_ATTR, '');
  const absolute = ['absolute', 'fixed'].includes(getComputedStyle(img).position);
  Object.assign(
    zoom.style,
    absolute
      ? { position: 'absolute', inset: '0' }
      : { position: 'relative', width: '100%', height: '100%' }
  );
  const zoomTo = readNumber(optionsFrom, 'data-image-hover-zoom');
  if (zoomTo !== null) zoom.style.setProperty('--image-hover-zoom', String(zoomTo));
  img.replaceWith(zoom);
  zoom.append(img);

  const shadeStrength = readNumber(optionsFrom, 'data-image-hover-shade');
  let shade = null;
  if (shadeStrength !== 0) {
    shade = document.createElement('div');
    shade.setAttribute(SHADE_ATTR, '');
    if (shadeStrength !== null) {
      shade.style.setProperty(
        '--image-hover-shade',
        String(Math.min(1, Math.max(0, shadeStrength)))
      );
    }
    zoom.after(shade);
  }
  return () => {
    shade?.remove();
    zoom.replaceWith(img);
  };
}

/**
 * Turn `area`'s hover state ([data-hover-on]) on and off with the mouse and
 * keyboard focus. Returns an undo.
 */
export function bindHover(area) {
  const on = () => area.setAttribute(HOVER_ON_ATTR, '');
  const off = () => area.removeAttribute(HOVER_ON_ATTR);
  const onEnter = (event) => {
    if (event.pointerType === 'mouse') on();
  };
  const onLeave = (event) => {
    if (event.pointerType === 'mouse' && !area.matches(':has(:focus-visible)')) off();
  };
  const onFocusIn = () => {
    if (area.matches(':has(:focus-visible)')) on();
  };
  const onFocusOut = (event) => {
    if (!area.contains(event.relatedTarget) && !area.matches(':hover')) off();
  };
  area.addEventListener('pointerenter', onEnter);
  area.addEventListener('pointerleave', onLeave);
  area.addEventListener('focusin', onFocusIn);
  area.addEventListener('focusout', onFocusOut);
  return () => {
    area.removeEventListener('pointerenter', onEnter);
    area.removeEventListener('pointerleave', onLeave);
    area.removeEventListener('focusin', onFocusIn);
    area.removeEventListener('focusout', onFocusOut);
    off();
  };
}

function initOne(el) {
  const isMedia = el.matches('img, video');
  const img = isMedia ? el : el.querySelector('img, video');
  const frame = isMedia ? el.parentElement : el;
  if (!img || !frame) return null;
  const undoLayers = addImageHover(img, el);
  const undoHover = bindHover(frame);
  return () => {
    undoHover();
    undoLayers();
  };
}

/** Wire every [data-image-hover]. Safe to call repeatedly. */
export function initImageHovers() {
  if (typeof document === 'undefined' || cleanups.length) return;
  document.querySelectorAll(SELECTOR).forEach((el) => {
    // A project card already drives its image's hover (projectHover.js).
    if (el.closest(CARD)) return;
    const undo = initOne(el);
    if (undo) cleanups.push(undo);
  });
}

export function cleanupImageHovers() {
  cleanups.splice(0).forEach((fn) => fn());
}
