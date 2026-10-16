/**
 * More Project — the "more projects" slider at the foot of a project's panel
 * (the Projects Template page, shown in the Projects page's project modal):
 *   1. the showing project's picture opens out of a small centred square to
 *      its full frame, tied to the scroll as the block comes into view (as
 *      the project CTA section's does, animations/projectCta.js), the blurred
 *      picture behind showing round the square;
 *   2. as it's all but open, its title rises in line by line;
 *   3. then Prev / Next and the button fade up.
 * Steps 2–3 play in time and reverse when scrolling back up into step 1.
 * Once open it's a slider, changing slides as the homepage's solutions
 * carousel does ([data-tabs-comp], components/carousel.js mask effect + v3
 * text): the new picture wipes across over the old in its mask, drifting a
 * little against it (utils/maskReveal.js, Pagtrans 1.1s, parallax 90), while
 * the old title fades out and the new one fades in, its lines rising into
 * place from below (fluid.glass's rise, utils/splitLines.js) — and the
 * blurred picture behind cross-fades to match. The button's label stays as
 * it is (it's the same for every project); its arrow draws itself again, line
 * then head (the arrow button's draw, components/button.js).
 * Prev / Next, the arrow keys or a swipe; it wraps round at the ends. The
 * button opens the project showing:
 * in the project modal it swaps the modal to it (components/projectModal.js,
 * through data-project), on the template page itself it goes to its page.
 * In the project modal it follows the modal's scroll (projectModal.js calls
 * animateMoreProjects(panel, modal) on every opening); on the template page,
 * the page's (initMoreProjects(), from src/global/index.js).
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <div data-more-project class="more-project">
 *     <img data-more-project-bg class="more-project-bg" …>        ← blurred, follows
 *     <div class="w-dyn-list"><div role="list">                   ← the projects
 *       <div role="listitem" class="more-project-fg">             ← a slide
 *         <img …>                                                 ← its picture
 *         <h2 data-more-project-title data-more-project-slug="{Slug}">…</h2>
 *       </div> …
 *     </div></div>
 *     <div data-more-project-prev class="slider-indicator">[←] Prev</div>
 *     <div data-more-project-next class="slider-indicator">Next [→]</div>
 *     <div data-more-project-cta class="more-project-cta"><button class="btn">…</button></div>
 *   </div>
 * Slides are [data-more-project-slide]s, else the Collection List's items (a
 * Collection item can't take attributes); one [data-more-project-image] works
 * too, as a single picture. The picture wipes inside a mask: a
 * [data-more-project-mask] round it if there is one, else one is put round it
 * (and taken off again by the cleanup). data-more-project-slug can sit on
 * anything in a slide.
 *
 * ── Options (on [data-more-project]) ─────────────────────────────────────────
 *   data-more-project-size="30%"     the square's side at the start: a % of the
 *                                    picture's shorter side, or px ("240px")
 *   data-more-project-radius="0"     the square's corner radius at the start
 *                                    (px); it eases to 0 as it opens
 *   data-more-project-scrub="true"   true (follow the scroll exactly) or
 *                                    seconds of catch-up smoothing ("0.5")
 *   data-more-project-next-at="0.9"  how far step 1 has opened (0–1) when the
 *                                    title comes in
 *   data-mask-parallax="90"          the picture's drift as it wipes in (100 =
 *                                    still, 0 = pushed), as on the carousels
 * (Read from [data-more-project-image] too, where there is one.)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * The square is a clip-path inset() in px, so it's a true square whatever the
 * picture's shape. Step 1 starts as the square comes up into view and ends
 * with the picture centred in the scroller, both clamped to its scroll range
 * (the block is the panel's last). Re-measured when the block or the panel
 * above it changes size (lazy images, a breakpoint) and once the panel has
 * finished coming in. Titles are split into lines once the fonts are in (and
 * re-split if their width changes). Prev / Next are buttons to keyboards and
 * screen readers, hidden (visibility too) until step 3 like the button; a
 * change asked for mid-wipe waits for it. Only the showing slide is visible
 * to screen readers. Under prefers-reduced-motion nothing is masked or hidden
 * and slides change at once. The cleanup puts everything back as authored.
 */

import { gsap, ScrollTrigger } from '../utils/gsapCore';
import { logger } from '../utils/logger';
import { maskReveal, PAGTRANS_EASE, resetMaskReveal } from '../utils/maskReveal';
import { prefersReducedMotion } from '../utils/motion';
import { DEFAULT_SQUARE, FULL_CLIP, readScrub, squareInsets } from '../utils/scrollMask';
import { fontsReady, hideLines, riseLines, showLines, splitLines } from '../utils/splitLines';

const SELECTORS = {
  block: '[data-more-project]',
  slide: '[data-more-project-slide]',
  image: '[data-more-project-image]',
  item: '[role="listitem"], .w-dyn-item',
  mask: '[data-more-project-mask]',
  title: '[data-more-project-title]',
  slug: '[data-more-project-slug]',
  bg: '[data-more-project-bg]',
  prev: '[data-more-project-prev]',
  next: '[data-more-project-next]',
  cta: '[data-more-project-cta]',
  // The site's Button's arrow (components/button.js).
  arrow: 'svg[btn-animate-svg]',
  modal: '[data-project-modal]',
};
// Blocks inside a project panel (projectModal.js) are animated with the panel.
const PANEL = '[data-panel-reveal], [data-project-modal]';
// On a mask this script put round a picture (so the cleanup takes it off).
const ADDED_MASK_ATTR = 'data-more-project-mask-added';
const DEFAULT_NEXT_AT = 0.9;
const SWIPE = 40; // px

const MOTION = {
  // Step 3: the controls and the button, after the title's first line.
  controls: { y: 16, duration: 0.6, ease: 'power2.out', at: 0.3, stagger: 0.06 },
  controlsOut: { duration: 0.3, ease: 'power2.in' },
  // Scrolling back: the title fades before its lines are parked again.
  titleOut: { duration: 0.4, ease: 'power2.in' },
  // A change of slide, as the homepage's solutions carousel: the mask wipe…
  wipe: { duration: 1.1, ease: PAGTRANS_EASE, parallax: 90 },
  // …the titles fading over (carousel.js TEXT_V3), the new one's lines rising
  // as they do (utils/splitLines.js riseLines, from two line-heights below)…
  titleFade: { duration: 0.5, ease: 'power3.inOut' },
  // …and the blurred picture behind cross-fading.
  bg: { duration: 0.9, ease: 'power1.inOut' },
  // The button: its arrow's line drawing from the tail and then its head, as
  // the wipe lands.
  arrowLine: { duration: 0.8, ease: 'power3.out', delay: 0.35 },
  arrowHead: { duration: 0.6, ease: 'power3.out', delay: 0.75 },
};

let pageCleanup = null;

// The block's slides: marked ones, else one picture, else the list's items
// that hold a picture.
function slideElementsOf(block) {
  const marked = Array.from(block.querySelectorAll(SELECTORS.slide));
  if (marked.length) return marked;
  const image = Array.from(block.querySelectorAll(SELECTORS.image)).find(
    (el) => el.getClientRects().length
  );
  if (image) return [image];
  return Array.from(block.querySelectorAll(SELECTORS.item)).filter((item) =>
    item.querySelector('img')
  );
}

// A picture's source, to show in another <img> (the blurred background).
function copySource(from, to) {
  if (!from || !to) return;
  ['srcset', 'sizes'].forEach((name) => {
    if (from.hasAttribute(name)) to.setAttribute(name, from.getAttribute(name));
    else to.removeAttribute(name);
  });
  to.src = from.currentSrc || from.src;
}

// The mask the picture wipes in: an authored one, else a box put round it
// that fills the slide (the picture filling the box, as it filled the slide).
function maskOf(slide, media) {
  const authored = slide.querySelector(SELECTORS.mask);
  if (authored || !media) return authored || slide;
  const mask = document.createElement('div');
  mask.setAttribute(ADDED_MASK_ATTR, '');
  Object.assign(mask.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
  media.before(mask);
  mask.append(media);
  return mask;
}

function unmask(mask) {
  if (!mask?.hasAttribute(ADDED_MASK_ATTR)) return;
  mask.replaceWith(...mask.childNodes);
}

// A div as a button: keyboard + screen readers. Returns the undo.
function asButton(el, label, onPress) {
  const added = ['role', 'tabindex', 'aria-label'].filter((name) => !el.hasAttribute(name));
  if (added.includes('role')) el.setAttribute('role', 'button');
  if (added.includes('tabindex')) el.setAttribute('tabindex', '0');
  if (added.includes('aria-label')) el.setAttribute('aria-label', label);
  const onClick = (event) => {
    event.preventDefault();
    onPress();
  };
  const onKey = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onPress();
  };
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('keydown', onKey);
    added.forEach((name) => el.removeAttribute(name));
  };
}

function animateBlock(block, scroller) {
  const elements = slideElementsOf(block);
  if (!elements.length) {
    logger.warn('[MoreProject] no slides (a Collection List of pictures) — skipped:', block);
    return null;
  }
  const reduced = prefersReducedMotion();
  const many = elements.length > 1;
  const slides = elements.map((el) => {
    const media = el.matches('img') ? null : el.querySelector('img');
    return {
      el,
      media,
      mask: reduced || !many ? el : maskOf(el, media),
      title:
        el.querySelector(SELECTORS.title) || (many ? null : block.querySelector(SELECTORS.title)),
      slug: (el.matches(SELECTORS.slug) ? el : el.querySelector(SELECTORS.slug))
        ?.getAttribute('data-more-project-slug')
        ?.trim(),
      split: null, // its title's lines, once split
    };
  });
  const bg = block.querySelector(SELECTORS.bg);
  const prev = block.querySelector(SELECTORS.prev);
  const next = block.querySelector(SELECTORS.next);
  const cta = block.querySelector(SELECTORS.cta);
  const button = cta?.querySelector('a, button') || cta;
  const controls = [prev, next, cta].filter(Boolean);

  const options = block.querySelector(SELECTORS.image) || block;
  const read = (name) =>
    options.getAttribute(`data-more-project-${name}`) ??
    block.getAttribute(`data-more-project-${name}`);
  const size = read('size') || DEFAULT_SQUARE;
  const nextAtValue = Number.parseFloat(read('next-at'));
  const nextAt = Number.isFinite(nextAtValue)
    ? Math.min(1, Math.max(0, nextAtValue))
    : DEFAULT_NEXT_AT;
  const radius = Math.max(0, Number.parseFloat(read('radius')) || 0);
  const parallaxValue = Number.parseFloat(block.getAttribute('data-mask-parallax'));
  const parallax = Number.isFinite(parallaxValue) ? parallaxValue : MOTION.wipe.parallax;

  let index = 0;
  let busy = null; // the running wipe
  let queued = 0; // a step asked for meanwhile
  let shown = reduced; // steps 2–3 played
  let rise = null; // the lines rising (compositor)
  let destroyed = false;
  const opening = { open: reduced ? 1 : 0 };
  const cleanups = [];
  const ctx = gsap.context(() => {}, block);
  const add = (fn) => ctx.add(fn);
  const current = () => slides[index];
  const linesOf = (slide) => slide?.split?.lines() ?? [];

  // Every scroll frame: the showing slide's square, written straight on
  // (cleared again by the cleanup). Measured in its own units.
  const renderOpening = () => {
    const { el } = current();
    if (opening.open >= 1) {
      el.style.clipPath = FULL_CLIP;
      return;
    }
    const { x, y } = squareInsets(el, size);
    const k = 1 - opening.open;
    el.style.clipPath = `inset(${y * k}px ${x * k}px ${y * k}px ${x * k}px round ${radius * k}px)`;
  };
  // On screen, from the block's top: the showing slide's top and size.
  const placed = () => {
    const { el } = current();
    const box = el.getBoundingClientRect();
    return {
      top: box.top - block.getBoundingClientRect().top,
      height: box.height,
      scale: el.offsetHeight ? box.height / el.offsetHeight : 1,
    };
  };
  const squareEntersView = () => {
    const { top, scale } = placed();
    return `clamp(top+=${Math.max(0, top + squareInsets(current().el, size).y * scale)} bottom)`;
  };
  const imageCentred = () => {
    const { top, height } = placed();
    return `clamp(top+=${top + height / 2} center)`;
  };

  // The button opens the project showing; labelled with it.
  const inModal = Boolean(block.closest(SELECTORS.modal));
  const syncButton = () => {
    if (!button) return;
    const { slug, title } = current();
    const name = title?.textContent.trim();
    if (slug && inModal) button.setAttribute('data-project', slug);
    if (name) button.setAttribute('aria-label', `View project: ${name}`);
  };

  // Set up: only the first slide showing (and to screen readers), the
  // background its picture, the titles and controls hidden till steps 2–3.
  add(() => {
    slides.forEach((slide, i) => {
      gsap.set(slide.el, { autoAlpha: i === index ? 1 : 0 });
      if (i !== index) slide.el.setAttribute('aria-hidden', 'true');
      if (slide.title && !reduced) gsap.set(slide.title, { autoAlpha: 0 });
    });
    if (!reduced) gsap.set(controls, { autoAlpha: 0, y: MOTION.controls.y });
    if (!many) [prev, next].forEach((el) => el && gsap.set(el, { display: 'none' }));
  });
  const bgOriginal = bg && {
    src: bg.getAttribute('src'),
    srcset: bg.getAttribute('srcset'),
    sizes: bg.getAttribute('sizes'),
  };
  // A second background on top of it, for the cross-fade.
  const bgFront = bg?.cloneNode(false);
  if (bg) {
    copySource(current().media, bg);
    bgFront.removeAttribute('data-more-project-bg');
    bgFront.setAttribute('aria-hidden', 'true');
    bgFront.alt = '';
    bg.after(bgFront);
    add(() => gsap.set(bgFront, { autoAlpha: 0 }));
  }
  syncButton();
  if (!reduced) renderOpening();

  const arrow = button?.querySelector(SELECTORS.arrow);
  const arrowLine = arrow?.querySelector('path');
  const arrowHead = arrow?.querySelector('rect');

  // The button on a change of slide: its arrow draws itself again — not
  // while it's hovered or focused, when the arrow is the button's own hover's
  // (components/button.js). Its label stays: it's the same for every project.
  const refreshButton = () => {
    add(() => {
      if (!arrowLine || button.matches(':hover, :focus-visible')) return;
      gsap.fromTo(
        arrowLine,
        { drawSVG: '0% 0%' },
        { drawSVG: '0% 100%', ...MOTION.arrowLine, overwrite: true }
      );
      if (arrowHead) {
        // Back to its rest: the chevron, half the square.
        gsap.fromTo(
          arrowHead,
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 50%', ...MOTION.arrowHead, overwrite: true }
        );
      }
    });
  };

  // The titles, split into masked lines once the fonts are in. A re-split
  // (a width change) puts the new lines in their slide's state.
  if (!reduced) {
    fontsReady().then(() => {
      if (destroyed) return;
      slides.forEach((slide) => {
        if (!slide.title) return;
        slide.split = splitLines(slide.title, (lines) => {
          if (slide === current() && shown && !rise) showLines(lines);
          else if (slide !== current() || !shown) hideLines(lines);
        });
      });
    });
  }

  // The showing title's lines rising in (step 2, or a change of slide).
  const riseTitle = (slide) => {
    rise?.cancel({ hold: true });
    rise = null;
    const lines = linesOf(slide);
    if (!lines.length) return;
    const playing = riseLines(lines);
    rise = playing;
    // Done rising: nothing to hold on to (a re-split then just shows them).
    setTimeout(
      () => {
        if (rise === playing) rise = null;
      },
      (1.5 + lines.length * 0.1) * 1000
    );
  };

  // Steps 2–3, in and back out.
  const showControls = () => {
    if (shown) return;
    shown = true;
    const { title } = current();
    add(() => {
      if (title) gsap.set(title, { autoAlpha: 1 });
      const c = MOTION.controls;
      gsap.to(controls, {
        autoAlpha: 1,
        y: 0,
        duration: c.duration,
        ease: c.ease,
        stagger: c.stagger,
        delay: title ? c.at : 0,
        overwrite: 'auto',
      });
    });
    riseTitle(current());
  };
  const hideControls = () => {
    if (!shown) return;
    shown = false;
    const slide = current();
    add(() => {
      if (slide.title) {
        gsap.to(slide.title, {
          autoAlpha: 0,
          ...MOTION.titleOut,
          overwrite: 'auto',
          onComplete: () => {
            if (!shown || slide !== current()) hideLines(linesOf(slide));
          },
        });
      }
      gsap.to(controls, {
        autoAlpha: 0,
        y: MOTION.controls.y,
        ...MOTION.controlsOut,
        overwrite: 'auto',
      });
    });
  };

  // A change of slide: `step` 1 (next) or -1 (previous), wrapping round.
  const go = (step) => {
    if (!many || !shown) return;
    if (busy) {
      queued = step;
      return;
    }
    const from = current();
    index = (index + step + slides.length) % slides.length;
    const to = current();
    from.el.setAttribute('aria-hidden', 'true');
    to.el.removeAttribute('aria-hidden');
    syncButton();

    if (bg) {
      copySource(to.media, bgFront);
      add(() =>
        gsap.fromTo(
          bgFront,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            ...MOTION.bg,
            onComplete: () => {
              copySource(bgFront, bg);
              gsap.set(bgFront, { autoAlpha: 0 });
            },
          }
        )
      );
    }

    if (reduced) {
      add(() => {
        gsap.set(from.el, { autoAlpha: 0 });
        gsap.set(to.el, { autoAlpha: 1, clipPath: FULL_CLIP });
      });
      return;
    }

    add(() => {
      // The new slide over the old, whole: the old one drops a layer, under
      // it (the new one isn't raised, which would cover the controls and the
      // button, a layer above the slides).
      gsap.set(to.el, { autoAlpha: 1, clipPath: FULL_CLIP });
      gsap.set(from.el, { zIndex: 1 });
      // The titles fade over, the new one's lines rising as they do.
      if (from.title) gsap.to(from.title, { autoAlpha: 0, ...MOTION.titleFade, overwrite: 'auto' });
      if (to.title) {
        gsap.fromTo(
          to.title,
          { autoAlpha: 0 },
          { autoAlpha: 1, ...MOTION.titleFade, overwrite: 'auto' }
        );
      }
      busy = maskReveal({
        outgoing: { wrap: from.mask, media: from.media },
        incoming: { wrap: to.mask, media: to.media },
        direction: step,
        duration: MOTION.wipe.duration,
        ease: MOTION.wipe.ease,
        parallax,
        onComplete: () => {
          gsap.set(from.el, { autoAlpha: 0, zIndex: '' });
          resetMaskReveal([from.mask, from.media, to.mask, to.media]);
          // Parked for its next entrance.
          hideLines(linesOf(from));
          busy = null;
          const again = queued;
          queued = 0;
          if (again) go(again);
        },
      });
    });
    riseTitle(to);
    refreshButton();
  };

  if (many) {
    if (prev) cleanups.push(asButton(prev, 'Previous project', () => go(-1)));
    if (next) cleanups.push(asButton(next, 'Next project', () => go(1)));
    // Arrow keys while focus is in the block.
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
      else return;
      event.preventDefault();
    };
    // A sideways swipe on a touch screen.
    let touch = null;
    const onDown = (event) => {
      touch = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event) => {
      if (!touch) return;
      const dx = event.clientX - touch.x;
      const dy = event.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    };
    block.addEventListener('keydown', onKey);
    block.addEventListener('pointerdown', onDown, { passive: true });
    block.addEventListener('pointerup', onUp, { passive: true });
    cleanups.push(() => {
      block.removeEventListener('keydown', onKey);
      block.removeEventListener('pointerdown', onDown);
      block.removeEventListener('pointerup', onUp);
    });
  }

  // On the template page itself, the button goes to the showing project's
  // page (in the modal, projectModal.js swaps to it through data-project).
  if (button && !inModal) {
    const onClick = (event) => {
      const { slug } = current();
      if (!slug) return;
      event.preventDefault();
      const base = window.location.pathname.replace(/[^/]*$/, '');
      window.location.assign(`${base}${encodeURIComponent(slug)}`);
    };
    button.addEventListener('click', onClick);
    cleanups.push(() => button.removeEventListener('click', onClick));
  }

  // Step 1, scrubbed by the scroll; steps 2–3 follow its progress (synced on
  // every update, so a jump past the whole range still lands right).
  let trigger = null;
  if (!reduced) {
    const sync = (self) => {
      if (self.progress >= nextAt) showControls();
      else hideControls();
    };
    add(() => {
      const open = gsap.to(opening, {
        open: 1,
        ease: 'none',
        paused: true,
        onUpdate: renderOpening,
      });
      trigger = ScrollTrigger.create({
        trigger: block,
        scroller,
        start: squareEntersView,
        end: imageCentred,
        animation: open,
        scrub: readScrub(read('scrub')),
        invalidateOnRefresh: true,
        onUpdate: sync,
        onLeave: sync,
        onLeaveBack: sync,
        onRefresh: (self) => {
          renderOpening();
          sync(self);
        },
      });
      sync(trigger);
    });
  }

  // Re-measured when the block's size really changes.
  let lastSize = `${block.offsetWidth}x${block.offsetHeight}`;
  const resizeObserver =
    trigger && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const sizeNow = `${block.offsetWidth}x${block.offsetHeight}`;
          if (sizeNow === lastSize) return;
          lastSize = sizeNow;
          trigger.refresh();
        })
      : null;
  resizeObserver?.observe(block);

  return {
    refresh: () => trigger?.refresh(),
    cleanup: () => {
      destroyed = true;
      resizeObserver?.disconnect();
      cleanups.forEach((fn) => fn());
      busy?.kill();
      rise?.cancel();
      ctx.revert();
      slides.forEach((slide) => {
        slide.split?.revert();
        resetMaskReveal([slide.mask, slide.media]);
        unmask(slide.mask);
        slide.el.removeAttribute('aria-hidden');
        slide.el.style.clipPath = '';
      });
      if (button) {
        if (inModal) button.removeAttribute('data-project');
        button.removeAttribute('aria-label');
      }
      bgFront?.remove();
      if (bg) {
        Object.entries(bgOriginal).forEach(([name, value]) => {
          if (value === null) bg.removeAttribute(name);
          else bg.setAttribute(name, value);
        });
      }
    },
  };
}

/**
 * The blocks in `scope`, following `scroller`'s scroll (an element, e.g. the
 * project modal, or the window). Returns { refresh, cleanup }: refresh()
 * re-measures them (e.g. once the panel's finished moving in).
 */
export function animateMoreProjects(scope, scroller = window) {
  const blocks = Array.from(scope.querySelectorAll(SELECTORS.block))
    .map((block) => animateBlock(block, scroller))
    .filter(Boolean);
  const refresh = () => blocks.forEach((b) => b.refresh());
  // Images loading above the block move it down the scroller: re-measured as
  // the panel's height changes (the page's own triggers see to the window).
  let lastHeight = scope.offsetHeight;
  const resizeObserver =
    blocks.length && scope instanceof Element && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (scope.offsetHeight === lastHeight) return;
          lastHeight = scope.offsetHeight;
          refresh();
        })
      : null;
  resizeObserver?.observe(scope);
  return {
    refresh,
    cleanup: () => {
      resizeObserver?.disconnect();
      blocks.forEach((b) => b.cleanup());
    },
  };
}

/** The blocks on the page itself (the template page), not in a project panel. */
export function initMoreProjects() {
  if (typeof document === 'undefined' || pageCleanup) return;
  const blocks = Array.from(document.querySelectorAll(SELECTORS.block)).filter(
    (block) => !block.closest(PANEL)
  );
  if (!blocks.length) return;
  const animated = blocks.map((block) => animateBlock(block, window)).filter(Boolean);
  pageCleanup = () => animated.forEach((b) => b.cleanup());
}

export function cleanupMoreProjects() {
  pageCleanup?.();
  pageCleanup = null;
}
