/**
 * Guards `window.IntersectionObserver` against malformed `rootMargin` values
 * (e.g. "200" instead of "200px") that would otherwise throw an uncaught
 * `SyntaxError` and abort whatever set up the observer. Must be imported
 * first, before any other module that constructs an observer at module-eval
 * time (e.g. global/lenis.js's initActiveScrollTo()).
 */

function sanitizeRootMargin(value) {
  const parts = String(value).trim().split(/\s+/).slice(0, 4);
  if (!parts.length) return value;
  return parts.map((part) => (/^-?\d+(\.\d+)?$/.test(part) ? `${part}px` : part)).join(' ');
}

export function guardIntersectionObserver() {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return;
  if (window.__sclIOGuarded) return;
  window.__sclIOGuarded = true;

  const NativeIntersectionObserver = window.IntersectionObserver;

  window.IntersectionObserver = function IntersectionObserver(callback, options) {
    let opts = options;
    if (opts && opts.rootMargin != null) {
      opts = { ...opts, rootMargin: sanitizeRootMargin(opts.rootMargin) };
    }
    try {
      return new NativeIntersectionObserver(callback, opts);
    } catch (error) {
      // Sanitizing couldn't make it valid (e.g. NaN/Infinity) — fall back to
      // a safe default instead of letting the whole script crash.
      if (opts && opts.rootMargin != null) {
        return new NativeIntersectionObserver(callback, { ...opts, rootMargin: '0px' });
      }
      throw error;
    }
  };
}

guardIntersectionObserver();
