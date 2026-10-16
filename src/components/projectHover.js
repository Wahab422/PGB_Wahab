/**
 * Project Hover — the hover on a project card ([data-project-hover]):
 *   - its image pushes in with a light shade (the site-wide image hover,
 *     components/imageHover.js — driven here by the whole card),
 *   - the title rolls: its letters slide up and out while a copy rolls in
 *     from below, in a quick left-to-right wave.
 *   - over its image the mouse pointer becomes its "View project" button
 *     (the cursor button, components/cursorButton.js — the card's image is
 *     a [data-cursor-zone]); for touch and the keyboard the real button
 *     sits at the image's centre.
 * All of it is CSS transitions on transform / opacity (src/styles/
 * image-hover.css, src/styles/project-hover.css); this script only builds the
 * layers and switches the state. Initialised from src/global/index.js on
 * pages that have one.
 *
 * ── Markup (one attribute on the card in Webflow) ────────────────────────────
 *   <div class="project-block" data-project-hover>
 *     <div class="project-block-fig" …><img …> …</div>   ← the first <img>
 *     <div class="project-block-text">
 *       <h3 class="eyebrow">Walsk King LLP</h3>         ← the first heading rolls
 *       …
 * Optional, to pick other elements:
 *   [data-project-hover-image]   the image to push in (default: the first <img>)
 *   [data-project-hover-title]   the text that rolls (default: the first h1–h6)
 * The image hover's options (data-image-hover-zoom / -shade) go on the card.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The rolled title keeps one readable copy for screen readers (the rolling-in
 * copy is aria-hidden). On with a mouse and with the keyboard (focus inside,
 * when focus is visible); never on touch. Under prefers-reduced-motion only
 * the shade fades. cleanupProjectHovers() restores the authored markup.
 */

import { addImageHover, bindHover } from './imageHover';

const SELECTORS = {
  card: '[data-project-hover]',
  image: '[data-project-hover-image]',
  title: '[data-project-hover-title]',
};
// Layers this script adds.
const ROLL_ATTR = 'data-project-hover-roll';
const LINE_ATTR = 'data-project-hover-line';

const cleanups = [];

// The title as two stacked lines of letters inside a mask: the readable one,
// and an aria-hidden copy just below it that rolls up into its place.
function buildRoll(title) {
  const text = title.textContent.replace(/\s+/g, ' ').trim();
  if (!text) return () => {};
  const original = [...title.childNodes];
  const line = (hidden) => {
    const el = document.createElement('span');
    el.setAttribute(LINE_ATTR, hidden ? 'copy' : '');
    if (hidden) el.setAttribute('aria-hidden', 'true');
    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.style.setProperty('--i', String(i));
      span.textContent = char === ' ' ? ' ' : char;
      el.append(span);
    });
    return el;
  };
  const roll = document.createElement('span');
  roll.setAttribute(ROLL_ATTR, '');
  roll.append(line(false), line(true));
  title.replaceChildren(roll);
  return () => title.replaceChildren(...original);
}

function initCard(card) {
  const undo = [];
  const img =
    card.querySelector(SELECTORS.image) ||
    card.querySelector('[data-image-hover] img, img[data-image-hover]') ||
    card.querySelector('img');
  if (img?.parentElement) undo.push(addImageHover(img, card));
  const title = card.querySelector(SELECTORS.title) || card.querySelector('h1, h2, h3, h4, h5, h6');
  if (title) undo.push(buildRoll(title));
  undo.push(bindHover(card));
  return () => undo.reverse().forEach((fn) => fn());
}

/** Wire every [data-project-hover] card. Safe to call repeatedly. */
export function initProjectHovers() {
  if (typeof document === 'undefined' || cleanups.length) return;
  document.querySelectorAll(SELECTORS.card).forEach((card) => cleanups.push(initCard(card)));
}

export function cleanupProjectHovers() {
  cleanups.splice(0).forEach((fn) => fn());
}
