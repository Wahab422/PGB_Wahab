/**
 * Skip-to-main-content link (WCAG 2.4.1 Bypass Blocks).
 *
 * Page markup lives in Webflow, not this repo, so there's no reliable place
 * to hand-author this in Designer — it's injected as the very first
 * focusable element in <body> instead. Visual styling (visually hidden
 * off-screen until focused) lives in index.css under `.skip-link`.
 *
 * Usage: call initSkipLink() from global/index.js. No cleanup needed — a
 * second call keeps the one link and only points it at the current <main>
 * (a Barba page swap brings a new one, see src/global/pageTransition.js).
 */
import { logger } from '../utils/logger';

const SKIP_LINK_ID = 'skip-to-main-content';
const MAIN_CONTENT_ID = 'main-content';

const findMain = () => document.querySelector('main, [role="main"]');

export function initSkipLink() {
  if (typeof document === 'undefined') return;

  const main = findMain();
  if (!main) {
    logger.warn('[SkipLink] No <main> (or [role="main"]) found — skipping.');
    return;
  }

  if (!main.id) main.id = MAIN_CONTENT_ID;
  // <main> isn't natively focusable; tabindex="-1" makes it a valid target
  // for the skip link's focus jump without adding it to the normal Tab order.
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

  const existing = document.getElementById(SKIP_LINK_ID);
  if (existing) {
    existing.href = `#${main.id}`;
    return;
  }

  const link = document.createElement('a');
  link.id = SKIP_LINK_ID;
  link.className = 'skip-link';
  link.href = `#${main.id}`;
  link.textContent = 'Skip to main content';

  // Fragment navigation to a tabindex="-1" target already moves focus there
  // in every modern browser, but explicitly focusing on click is a common,
  // cheap belt-and-suspenders addition some older engines needed. The <main>
  // is looked up on click — a page swap may have replaced it.
  link.addEventListener('click', () => {
    requestAnimationFrame(() => findMain()?.focus());
  });

  document.body.insertBefore(link, document.body.firstChild);
}
