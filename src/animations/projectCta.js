/**
 * Project CTA — the scroll sequence for #project-cta-section:
 *   1. the project image opens out of a small centred square to full-bleed,
 *      tied to the scroll as the section comes into view;
 *   2. as it finishes opening (90% open by default, the section's top just
 *      short of the top of the screen), the next-project image opens out of
 *      its centre;
 *   3. then the "Explore all projects" button fades up.
 * Steps 2–3 play in time (the section is fully on screen then, and starts
 * leaving right after, so a scrubbed step would be missed) and reverse when
 * scrolling back up into step 1. Initialised from src/global/index.js on pages
 * that have the section.
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <section id="project-cta-section" class="section">
 *     <div class="content for-p-cta">
 *       <div class="p-cta-item">
 *         <img data-scroll-mask-project class="p-cta-img" …>        ← step 1
 *         <img data-scroll-mask-next-project class="n-p-cta-img" …> ← step 2 (optional)
 *         <div class="p-cta-text">…</div>
 *         <a explore-all-projects class="btn" …>…</a>               ← step 3 (optional)
 *       </div>
 *     </div>
 *     <div class="bg"><img class="cta-bg" …></div>                  ← shows around the square
 *   </section>
 *
 * ── Options (on [data-scroll-mask-project]) ──────────────────────────────────
 *   data-scroll-mask-size="30%"     the square's side at the start: a % of the
 *                                   image's shorter side, or px ("240px")
 *   data-scroll-mask-radius="0"     the square's corner radius at the start (px);
 *                                   it eases to 0 as the mask opens
 *   data-scroll-mask-scrub="true"   true (follow the scroll exactly) or seconds
 *                                   of catch-up smoothing ("0.5")
 *   data-scroll-mask-next-at="0.9"  how far step 1 has opened (0–1) when step 2
 *                                   starts. Below 1 so it doesn't wait for the
 *                                   smooth scroll's slow last pixels (or never
 *                                   start when the scroll stops just short)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The project mask is a clip-path inset() measured in px, so it's a true
 * square whatever the image's aspect ratio. Step 1 starts the moment the
 * square comes up into view and ends with the image centred on screen; both
 * are clamped to the page's scroll range, so it still completes if the
 * section is near the bottom of the page. Arriving already past it (reload,
 * anchor link) shows the end state. Everything is re-measured on each
 * ScrollTrigger refresh, and a refresh is requested when the section changes
 * size (a lazy image loading, a breakpoint). Until step 3 the button is
 * hidden with visibility too, so it can't be tabbed to while invisible. Under
 * prefers-reduced-motion nothing is masked or hidden. cleanupProjectCta()
 * kills the ScrollTrigger and restores the elements' authored inline styles.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { requestScrollRefresh } from '../utils/scrollRefresh';
import { logger } from '../utils/logger';
import { prefersReducedMotion } from '../utils/motion';
import { DEFAULT_SQUARE, FULL_CLIP, readScrub, squareInsets } from '../utils/scrollMask';

const SELECTORS = {
  section: '#project-cta-section',
  project: '[data-scroll-mask-project]',
  next: '[data-scroll-mask-next-project]',
  button: '[explore-all-projects]',
};
const DEFAULT_NEXT_AT = 0.9;

let cleanup = null;

function initSection(section, gsap, ScrollTrigger) {
  const project = section.querySelector(SELECTORS.project);
  if (!project) {
    logger.warn('[ProjectCta] needs a [data-scroll-mask-project] image — skipped:', section);
    return null;
  }
  const next = section.querySelector(SELECTORS.next);
  const button = section.querySelector(SELECTORS.button);

  const sizeAttr = project.getAttribute('data-scroll-mask-size') || DEFAULT_SQUARE;
  const nextAtAttr = Number.parseFloat(project.getAttribute('data-scroll-mask-next-at'));
  const nextAt = Number.isFinite(nextAtAttr)
    ? Math.min(1, Math.max(0, nextAtAttr))
    : DEFAULT_NEXT_AT;
  const radius = Math.max(
    0,
    Number.parseFloat(project.getAttribute('data-scroll-mask-radius')) || 0
  );

  // The centred square's insets, from the image's layout size (offset*
  // ignore transforms, which would skew it).
  const square = () => squareInsets(project, sizeAttr);
  const squareClip = () => {
    const { x, y } = square();
    return `inset(${y}px ${x}px ${y}px ${x}px round ${radius}px)`;
  };
  // Measured from the section's top, so the image can sit anywhere in it.
  const offsetInSection = () =>
    project.getBoundingClientRect().top - section.getBoundingClientRect().top;
  // Start: the square's top edge coming up into view — not the section's,
  // which would spend the first part of the scroll on a square still below
  // the screen.
  const squareEntersView = () =>
    `clamp(top+=${Math.max(0, offsetInSection() + square().y)} bottom)`;
  // End: the image centred on screen — for a full-screen image, the section's
  // top at the top of the screen.
  const imageCentred = () => `clamp(top+=${offsetInSection() + project.offsetHeight / 2} center)`;
  const ctx = gsap.context(() => {
    // Steps 2–3, played as step 1 finishes. The next-project image opens out
    // of its centre — in %, so it needs no measuring and fits any size — on an
    // ease-out, so it moves the moment it starts (an in-out sat still ~0.35s).
    const reveal = gsap.timeline({ paused: true });
    if (next) {
      reveal.fromTo(
        next,
        { clipPath: 'inset(50% 50% 50% 50%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.out' }
      );
    }
    if (button) {
      reveal.fromTo(
        button,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' },
        next ? 0.4 : 0
      );
    }

    // Steps 2–3 follow step 1's state: shown once it's nextAt open, hidden
    // as soon as it's back below that. Synced from the progress on every update rather than
    // from onLeave / onEnterBack: with ScrollTrigger's limitCallbacks (set in
    // components/gsap.js) a jump that skips the whole range — e.g. from below
    // the section back to the top — fires none of those.
    const sync = (self) => {
      if (self.progress >= nextAt) {
        if (reveal.progress() < 1 || reveal.reversed()) reveal.play();
      } else if (reveal.progress() > 0 && !reveal.reversed()) {
        reveal.reverse();
      }
    };

    // Step 1, scrubbed by the scroll.
    const open = gsap.fromTo(
      project,
      { clipPath: squareClip },
      { clipPath: FULL_CLIP, ease: 'none', paused: true }
    );
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: squareEntersView,
      end: imageCentred,
      animation: open,
      scrub: readScrub(project.getAttribute('data-scroll-mask-scrub')),
      invalidateOnRefresh: true,
      onUpdate: sync,
      onLeave: sync,
      onLeaveBack: sync,
      // Already past step 1 (reload, anchor link): show the end state at once.
      onRefresh: (self) => {
        if (self.progress >= nextAt && reveal.progress() === 0) reveal.progress(1);
      },
    });
    if (trigger.progress >= nextAt) reveal.progress(1);
  }, section);

  // A refresh only when the section's size really changes.
  let lastSize = `${section.offsetWidth}x${section.offsetHeight}`;
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          const size = `${section.offsetWidth}x${section.offsetHeight}`;
          if (size === lastSize) return;
          lastSize = size;
          requestScrollRefresh();
        });
  resizeObserver?.observe(section);

  return () => {
    resizeObserver?.disconnect();
    ctx.revert();
  };
}

/** Wire #project-cta-section. Safe to call repeatedly. */
export function initProjectCta() {
  if (typeof document === 'undefined' || cleanup || prefersReducedMotion()) return;
  const section = document.querySelector(SELECTORS.section);
  if (!section) return;
  cleanup = initSection(section, gsap, ScrollTrigger);
}

export function cleanupProjectCta() {
  cleanup?.();
  cleanup = null;
}
