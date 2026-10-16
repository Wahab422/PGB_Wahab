/**
 * Reduced-motion helpers. The OS-level "reduce motion" setting is checked at
 * call time, so a change mid-session applies to the next animation / scroll.
 */

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** `behavior` for scrollTo / scrollIntoView: instant when motion is reduced. */
export function scrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
