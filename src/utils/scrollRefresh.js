/**
 * One ScrollTrigger refresh for a layout change, however many things notice it.
 *
 * Several observers watch for layout changes that move the triggers (the
 * page's height, revealed images, the project CTA section). One window resize
 * sets them all off at once, and ScrollTrigger refreshes on a resize by
 * itself too. Each refresh measures every trigger, so they share this:
 * requests are debounced into one, and it's skipped altogether when a
 * refresh has already run since the last request (ScrollTrigger's own, or a
 * page swap's).
 */
import { ScrollTrigger } from './gsapCore';

// Longer than ScrollTrigger's own resize delay (200ms), so after a window
// resize its refresh comes first and this one is skipped.
const DELAY = 250;

let lastRefreshAt = 0;
let requestedAt = 0;
let timer = null;
let listening = false;
let held = false;

/**
 * Ignore requests while the layout is changing on purpose — a page
 * transition pins both pages, which collapses the page's height; a refresh
 * then would land mid-animation, and the swap refreshes anyway.
 */
export function holdScrollRefresh(hold) {
  held = hold;
  if (hold) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Ask for a ScrollTrigger refresh after a layout change. */
export function requestScrollRefresh() {
  if (held) return;
  if (!listening) {
    listening = true;
    ScrollTrigger.addEventListener('refresh', () => {
      lastRefreshAt = performance.now();
    });
  }
  requestedAt = performance.now();
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (lastRefreshAt >= requestedAt) return;
    ScrollTrigger.refresh();
  }, DELAY);
}
