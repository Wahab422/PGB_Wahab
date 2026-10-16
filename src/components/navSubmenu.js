/**
 * Nav Submenu — the desktop navbar dropdown (Solutions). The white panel opens
 * out of its label like a window: a chip appears round the label (which turns
 * dark at once, its arrow flipping), then it opens out evenly — across and
 * down together — uncovering the content as it goes — the rows rising into place one
 * after another, the image settling from a slight zoom, the footer line last.
 * A highlight glides from row to row with the pointer (the first row, or the
 * current page's, highlighted to start with); the highlighted row's subtext
 * rises into its line, and its picture uncovers itself over the last one in
 * the direction the highlight moved. Closing draws the window up like a shutter, the content lifting a
 * little, and the label turns back as the edge passes it.
 * With the nav's glide highlight next to it (src/global/navbar.js), that pill
 * is the dropdown's body: first it grows from wherever it is (on the label,
 * or still gliding over) into the panel, taking on the panel's look, then the
 * content comes in. On the way out the content goes first (dropping away),
 * then the body collapses back into a pill: the link's the pointer moved on
 * to, or else the label's, fading out with the glide once the pointer's left
 * the nav. The panel itself is then see-through.
 * Initialised from src/global/navbar.js.
 *
 * ── Markup (attributes on the existing Webflow elements) ─────────────────────
 *   <li nav-submenu>                              ← the dropdown
 *     <div data-submenu-toggle>                   ← its label + arrow
 *       <a href="#">Solutions</a><svg>…</svg>
 *     </div>
 *     <div data-submenu-panel>                    ← the white panel
 *       <ul><li data-submenu-item>                ← the rows
 *         <a><div>Aristo</div><div>Premium, powerful sound</div></a>
 *       </li> ×6</ul>
 *       <div data-submenu-image><img></div>       ← settles from a zoom
 *       <div data-submenu-cta>…</div>             ← follows last
 *     </div>
 *   </li>
 * Without the data-submenu-* attributes it falls back to the structure: the
 * toggle is the first child, the panel the last, the rows the panel's list
 * rows (a ul's li's, or a CMS Collection List's items that hold a link), the
 * image the box holding the pictures (else its first <img>'s wrapper), the
 * footer the panel's part that holds neither the list nor the image. A row's
 * subtext is its link's last child. Rows and pictures can each be a
 * Collection List (Solutions), each picture in its own item.
 *   A picture for each row: nav-solution-item on the rows' links and
 *   nav-solution-item_img on the pictures (stacked in the image box), paired
 *   in order — the first row's link with the first picture, and so on. The
 *   highlighted row's picture shows; rows without one leave it as it is.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Desktop and tablet (from 768px, where the nav shows its links in a row) —
 * the phone menu shows the panel inline (src/components/mobileMenu.js). Opens on hover (with a short
 * grace period on the way out, so the pointer can cross gaps), on a click or
 * tap of the toggle, and on keyboard focus; arrow keys move through the rows,
 * Escape closes it and returns focus to the toggle. The toggle carries
 * aria-expanded. The panel's look (size, colours, radius, shadow) is
 * Webflow's; src/styles/nav-submenu.css hides it until opened and holds the
 * highlight's and the label's states. Under prefers-reduced-motion it opens
 * and closes without moving.
 */

import { gsap } from '../utils/gsapCore';
import { prefersReducedMotion } from '../utils/motion';
import { getNavGlide } from '../utils/navGlide';

const SELECTORS = {
  root: '[nav-submenu]',
  toggle: '[data-submenu-toggle]',
  panel: '[data-submenu-panel]',
  item: '[data-submenu-item]',
  image: '[data-submenu-image]',
  cta: '[data-submenu-cta]',
  // A row's link, and its picture (paired in order).
  solution: '[nav-solution-item]',
  picture: '[nav-solution-item_img]',
};
const READY_ATTR = 'data-submenu-ready';
// On each row (found or marked): src/styles/nav-submenu.css styles them by it,
// whatever they are (li's, Collection items).
const ROW_ATTR = 'data-submenu-row';
// Open (the label dark, the arrow flipped)…
const OPEN_ATTR = 'data-submenu-open';
// …or still opening / closing: the panel is showing.
const ACTIVE_ATTR = 'data-submenu-active';
// The rows rising in as it opens.
const ENTERING_ATTR = 'data-submenu-entering';
// The highlighted row.
const CURRENT_ATTR = 'data-submenu-current';
const PILL_ATTR = 'data-submenu-pill';
// The nav's glide highlight is the body (the panel is see-through).
const MORPH_ATTR = 'data-submenu-morph';
const NO_SHADOW = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
const DESKTOP = '(min-width: 768px)';

const MOTION = {
  // The chip round the label fading in.
  appear: 0.12,
  // The window (or the glide's pill) opening out evenly, across and down
  // together.
  grow: { duration: 0.42, ease: 'power3.out' },
  // When the content comes in (s): while the window opens (it uncovers it),
  // or — with the glide's pill as the body — once the body's all but open.
  content: { withWindow: 0.12, afterBody: 0.16 },
  // From then: the rows rising into place, one after another…
  rows: { duration: 0.6, ease: 'expo.out', stagger: 0.025, delay: 0 },
  // …the highlight wiping in under the first row (and gliding between rows)…
  pill: { duration: 0.55, ease: 'expo.out', delay: 0.08 },
  // (Gliding between rows: it sets off at once but eases into place rather
  // than jumping most of the way in the first frames.)
  glide: { duration: 0.6, ease: 'power3.out' },
  // …the image opening upward and settling from a slight zoom…
  image: { scale: 1.1, duration: 0.9, reveal: 0.6, ease: 'expo.out', delay: 0 },
  // A row's picture taking over from the last: uncovering itself as it rises
  // `shift`% and settles from `scale`, the last one drifting `push`% the
  // other way as it's covered.
  picture: { duration: 0.7, ease: 'expo.out', shift: 10, scale: 1.12, push: 8 },
  // …and the footer.
  cta: { y: 6, duration: 0.5, ease: 'expo.out', delay: 0.12 },
  // The content going (with the glide's pill), the body collapsing from
  // `collapseAt` (s) — or, the pointer gone on to another link, from
  // `onwardAt`, so the pill gets there quickly.
  out: { duration: 0.12, ease: 'power2.in', stagger: 0.008, collapseAt: 0.08, onwardAt: 0.03 },
  // Closing (without the glide's pill): the window draws up like a shutter,
  // accelerating away, its content lifting a little (px) as it goes.
  close: { duration: 0.32, ease: 'power1.in', lift: 10 },
  // The glide's pill as the body: taking on the panel's colour as it grows,
  // and collapsing back into a pill.
  tint: 0.25,
  morph: { duration: 0.3, ease: 'expo.out' },
  // Back in the label's pill with the pointer gone from the nav: it fades
  // out as it arrives (s into its collapse).
  fadeOut: { at: 0.1, duration: 0.16 },
  // Hover intent before opening, so passing over the label on the way
  // elsewhere doesn't open it (ms; mouse only).
  openDelay: 60,
  // Hover grace period before closing (ms).
  leaveDelay: 80,
};

const instances = [];

/**
 * A dropdown's rows when they aren't marked: a list's items that hold a link —
 * a plain list (ul > li) or a CMS Collection List (its role="listitem"s),
 * leaving out a Collection List of pictures (items without a link).
 */
export function listRows(panel) {
  return Array.from(panel.querySelectorAll('ul > li, [role="list"] > [role="listitem"]')).filter(
    (row) => row.querySelector('a, button')
  );
}

// The box the pictures sit in: the smallest one holding them all (with each
// picture in its own Collection item, not the first one's item), else the
// first image's wrapper.
function pictureBox(panel) {
  const pictures = Array.from(panel.querySelectorAll(SELECTORS.picture));
  if (pictures.length) {
    let box = pictures[0].parentElement;
    while (
      box &&
      box !== panel &&
      (box.matches('.w-dyn-item') || !pictures.every((el) => box.contains(el)))
    ) {
      box = box.parentElement;
    }
    if (box && box !== panel) {
      // A Collection List's own wrapper is just a wrapper: the list inside it,
      // styled as the box, is the frame.
      return box.matches('.w-dyn-list') && box.firstElementChild ? box.firstElementChild : box;
    }
  }
  return panel.querySelector('img')?.parentElement || null;
}

function parts(root) {
  const toggle = root.querySelector(SELECTORS.toggle) || root.firstElementChild;
  const panel =
    root.querySelector(SELECTORS.panel) ||
    (root.lastElementChild !== toggle ? root.lastElementChild : null);
  if (!toggle || !panel) return null;
  let items = Array.from(panel.querySelectorAll(SELECTORS.item));
  if (!items.length) items = listRows(panel);
  const list = items[0]?.parentElement || null;
  const image = panel.querySelector(SELECTORS.image) || pictureBox(panel);
  const cta =
    panel.querySelector(SELECTORS.cta) ||
    Array.from(panel.children).find(
      (el) => !(list && el.contains(list)) && !(image && el.contains(image))
    ) ||
    null;
  const link = toggle.querySelector('a, button') || toggle;
  return { toggle, panel, items, list, image, img: image?.querySelector('img') || null, cta, link };
}

// Webflow's box-shadow on the panel as a drop-shadow() — drawn on the whole
// dropdown, it follows the opening window (the panel's own would be clipped).
function dropShadowOf(boxShadow) {
  if (!boxShadow || boxShadow === 'none') return '';
  const first = boxShadow.split(/,(?![^(]*\))/)[0].trim();
  if (/\binset\b/.test(first)) return '';
  const color = /^(rgba?\([^)]*\)|#[\da-f]+|[a-z]+)/i.exec(first)?.[0] || '';
  const lengths = first.slice(color.length).trim().split(/\s+/).slice(0, 3);
  return `drop-shadow(${color} ${lengths.join(' ')})`;
}

// A computed box-shadow's first shadow (or none, as a tweenable shadow).
const firstShadow = (boxShadow) =>
  !boxShadow || boxShadow === 'none' ? NO_SHADOW : boxShadow.split(/,(?![^(]*\))/)[0].trim();

function initSubmenu(root) {
  const p = parts(root);
  if (!p) return null;
  const { toggle, panel, items, list, image, img, cta, link } = p;
  const desktop = window.matchMedia(DESKTOP);
  const canHover = window.matchMedia('(hover: hover)');
  const sections = Array.from(panel.children);
  const rows = () => items.filter((row) => row.offsetHeight > 0);
  const rowLink = (row) => row.querySelector('a') || row;

  const panelStyle = getComputedStyle(panel);
  const shadow = dropShadowOf(panelStyle.boxShadow);
  if (shadow) root.style.setProperty('--submenu-shadow', shadow);
  // The nav's glide pill, if there is one, is the body: it takes on the
  // panel's look (read before the panel turns see-through).
  const glide = getNavGlide(root);
  const body = glide?.highlight || null;
  const look = {
    bg: panelStyle.backgroundColor,
    radius: parseFloat(panelStyle.borderTopLeftRadius) || 0,
    shadow: firstShadow(panelStyle.boxShadow),
  };
  if (body) root.setAttribute(MORPH_ATTR, '');
  if (!panel.id) panel.id = `submenu-${instances.length + 1}`;
  link.setAttribute('aria-expanded', 'false');
  link.setAttribute('aria-controls', panel.id);
  root.setAttribute(READY_ATTR, '');
  items.forEach((row) => row.setAttribute(ROW_ATTR, ''));

  // The highlight, behind the rows (positioned against the list's wrapper).
  const track = list?.parentElement || null;
  const pill = track ? document.createElement('span') : null;
  const trackStyle = track
    ? { position: track.style.position, isolation: track.style.isolation }
    : null;
  if (pill) {
    pill.setAttribute(PILL_ATTR, '');
    pill.setAttribute('aria-hidden', 'true');
    track.prepend(pill);
    if (getComputedStyle(track).position === 'static') track.style.position = 'relative';
    track.style.isolation = 'isolate';
  }

  let isOpen = false;
  let timeline = null;
  let leaveTimer = null;
  let openTimer = null;
  let current = null;

  // Each row's own picture, stacked in the image box (see the header).
  const pictures = Array.from(panel.querySelectorAll(SELECTORS.picture));
  const solutions = Array.from(panel.querySelectorAll(SELECTORS.solution));
  const pictureOf = (row) => {
    const index = solutions.findIndex((el) => row.contains(el));
    return index === -1 ? null : pictures[index] || null;
  };
  // The picture on top, and how many are stacked over the bottom one.
  let shown = pictures[0] || null;
  let depth = 1;
  // The picture that settles from a zoom as the dropdown opens.
  const zoomed = () => (pictures.length ? shown : img);
  // At rest: only the shown picture, nothing in motion.
  const restPictures = () => {
    depth = 1;
    pictures.forEach((el) => {
      gsap.killTweensOf(el);
      if (el === shown) gsap.set(el, { autoAlpha: 1, zIndex: 1, clearProps: 'clipPath,transform' });
      else gsap.set(el, { autoAlpha: 0, clearProps: 'clipPath,transform,zIndex' });
    });
  };
  // A picture's clip, as its top and bottom insets (%).
  const clipOf = (el) => {
    const v = /inset\(([^)]*)\)/
      .exec(el.style.clipPath)?.[1]
      .trim()
      .split(/\s+/)
      .map(Number.parseFloat);
    return v ? { top: v[0], bottom: v.length > 2 ? v[2] : v[0] } : { top: 0, bottom: 0 };
  };
  // Still in the stack, with some of it uncovered.
  const inStack = (el) => {
    const { top, bottom } = clipOf(el);
    return el.style.visibility !== 'hidden' && top + bottom < 99.5;
  };
  // The highlighted row's picture uncovers itself over the last one — from
  // below when the highlight moved down, from above when it moved up —
  // rising into place and settling from a slight zoom, while the last one
  // drifts on the other way as it's covered. Moving on before it's done, the
  // next one simply uncovers itself over it; moving back to one still in the
  // stack, the ones over it draw back off it the way the highlight moved
  // (rather than it uncovering itself all over again, the box empty behind
  // it meanwhile). Instant when the dropdown opens on it (no `from`).
  const showPicture = (row, from) => {
    const next = pictureOf(row);
    if (!next || next === shown) return;
    const last = shown;
    shown = next;
    if (!from || !last || prefersReducedMotion()) {
      restPictures();
      return;
    }
    const { picture: m } = MOTION;
    const dir = items.indexOf(row) > items.indexOf(from) ? 1 : -1;
    const motion = { duration: m.duration, ease: m.ease };
    if (inStack(next)) {
      const zOf = (el) => Number(el.style.zIndex) || 0;
      pictures.forEach((el) => {
        if (el === next || zOf(el) <= zOf(next) || !inStack(el)) return;
        // Closing to its edge on the side the highlight moved towards.
        const { top, bottom } = clipOf(el);
        gsap.killTweensOf(el);
        gsap.fromTo(
          el,
          { clipPath: `inset(${top}% 0% ${bottom}% 0%)` },
          {
            clipPath:
              dir > 0
                ? `inset(${top}% 0% ${100 - top}% 0%)`
                : `inset(${100 - bottom}% 0% ${bottom}% 0%)`,
            yPercent: -dir * m.push,
            ...motion,
          }
        );
      });
      const { top, bottom } = clipOf(next);
      gsap.killTweensOf(next);
      gsap.fromTo(
        next,
        { clipPath: `inset(${top}% 0% ${bottom}% 0%)` },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          yPercent: 0,
          scale: 1,
          ...motion,
          onComplete: () => {
            if (shown === next) restPictures();
          },
        }
      );
      return;
    }
    depth += 1;
    gsap.killTweensOf(next);
    gsap.set(next, { autoAlpha: 1, zIndex: depth });
    gsap.fromTo(
      next,
      {
        clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)',
        yPercent: dir * m.shift,
        scale: m.scale,
      },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        yPercent: 0,
        scale: 1,
        ...motion,
        onComplete: () => {
          if (shown === next) restPictures();
        },
      }
    );
    gsap.to(last, { yPercent: -dir * m.push, ...motion, overwrite: 'auto' });
  };
  if (pictures.length) restPictures();

  const placePill = (row, glide) => {
    if (!pill) return;
    const a = rowLink(row).getBoundingClientRect();
    const t = track.getBoundingClientRect();
    const to = { x: a.left - t.left, y: a.top - t.top, width: a.width, height: a.height };
    if (glide && !prefersReducedMotion())
      gsap.to(pill, { ...to, ...MOTION.glide, overwrite: 'auto' });
    else gsap.set(pill, to);
  };
  // With `mark` false the highlight goes to the row, but the row itself (its
  // text, its subtext) only lights up once marked — as the dropdown opens.
  const setCurrent = (row, glide, mark = true) => {
    if (!row || row === current) return;
    const from = current;
    current?.removeAttribute(CURRENT_ATTR);
    current = row;
    if (mark) row.setAttribute(CURRENT_ATTR, '');
    placePill(row, glide);
    showPicture(row, glide ? from : null);
  };
  const markCurrent = () => current?.setAttribute(CURRENT_ATTR, '');
  // To start with: the row linking to this page, else the first.
  const firstRow = () => {
    const visible = rows();
    return (
      visible.find((row) => row.querySelector('[aria-current="page"], .w--current')) || visible[0]
    );
  };

  // The panel's window, as its insets (px): all 0 when it's open, and to start
  // with the label's own box — the chip, where the nav's glide highlight sits.
  const win = { top: 0, right: 0, bottom: 0, left: 0 };
  let chip = { ...win };
  let height = 0;
  let radius = '0px';
  // The label's middle, down from the panel's top and across from its left.
  let labelMid = 0;
  let labelX = 0;
  const measure = () => {
    const pr = panel.getBoundingClientRect();
    const tr = toggle.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    height = pr.height;
    chip = {
      top: Math.max(0, tr.top - pr.top),
      right: Math.max(0, pr.right - tr.right),
      bottom: Math.max(0, pr.bottom - tr.bottom),
      left: Math.max(0, tr.left - pr.left),
    };
    radius = getComputedStyle(panel).borderTopLeftRadius || '0px';
    labelMid = lr.top + lr.height / 2 - pr.top;
    labelX = lr.left + lr.width / 2 - pr.left;
  };
  const renderWindow = () => {
    panel.style.clipPath = `inset(${win.top}px ${win.right}px ${win.bottom}px ${win.left}px round ${radius})`;
  };

  // The body (the glide's pill): its box as insets from the panel's (px,
  // negative beyond it) and its corner radius — drawn on the pill, and as the
  // window the panel's content shows through.
  const b = { top: 0, right: 0, bottom: 0, left: 0, radius: 0 };
  // The panel's box, and where it is in the pill's coordinates.
  let frame = null;
  // The pill's own look, while the dropdown holds it.
  let rest = null;
  // The label's let go of (fading out with the pill): no longer follows it.
  let labelFree = false;
  const measureFrame = () => {
    const rect = panel.getBoundingClientRect();
    const parent = body.offsetParent || body.parentElement;
    const o = parent.getBoundingClientRect();
    frame = {
      rect,
      x: rect.left - o.left - parent.clientLeft,
      y: rect.top - o.top - parent.clientTop,
    };
  };
  const insetsOf = (r) => ({
    top: r.top - frame.rect.top,
    right: frame.rect.right - r.right,
    bottom: frame.rect.bottom - r.bottom,
    left: r.left - frame.rect.left,
  });
  const renderBody = () => {
    const { rect } = frame;
    body.style.width = `${Math.max(0, rect.width - b.left - b.right)}px`;
    body.style.height = `${Math.max(0, rect.height - b.top - b.bottom)}px`;
    body.style.transform = `translate(${frame.x + b.left}px, ${frame.y + b.top}px)`;
    body.style.borderRadius = `${b.radius}px`;
    panel.style.clipPath = `inset(${b.top}px ${b.right}px ${b.bottom}px ${b.left}px round ${b.radius}px)`;
    // The label's dark while the body is under it (src/styles/nav-submenu.css).
    const under =
      labelX > b.left &&
      labelX < rect.width - b.right &&
      labelMid > b.top &&
      labelMid < rect.height - b.bottom;
    if (!labelFree) root.toggleAttribute(OPEN_ATTR, under);
  };
  // Takes the pill over where it is now — mid-glide included — or, if it
  // isn't showing, at the label's box. Holding it already (a close cut
  // short), it carries on from there.
  const takeOver = () => {
    measureFrame();
    if (rest) return;
    const style = getComputedStyle(body);
    rest = {
      bg: style.backgroundColor,
      radius: parseFloat(style.borderTopLeftRadius) || 0,
      shadow: firstShadow(style.boxShadow),
    };
    const { rect: r, opacity } = glide.hold();
    const showing = opacity > 0.02 && r.width > 0 && r.height > 0;
    Object.assign(b, insetsOf(showing ? r : toggle.getBoundingClientRect()), {
      radius: rest.radius,
    });
    gsap.set(body, {
      opacity: showing ? opacity : 0,
      backgroundColor: rest.bg,
      boxShadow: rest.shadow,
    });
    renderBody();
  };

  // The image's own window, opening upward (0 → 1) as the content comes in
  // and closing downward as it goes.
  const imageWin = { open: 1 };
  const renderImage = () => {
    if (image) image.style.clipPath = `inset(${(1 - imageWin.open) * 100}% 0% 0% 0%)`;
  };

  // Fully open: nothing left inline that could clip the panel.
  const settle = () => {
    Object.assign(win, { top: 0, right: 0, bottom: 0, left: 0 });
    panel.style.clipPath = '';
    if (image) image.style.clipPath = '';
    root.removeAttribute(ENTERING_ATTR);
  };

  const hide = () => {
    timeline = null;
    collapsing?.kill();
    collapsing = null;
    // The label turns back at once, if the close hasn't turned it already:
    // its colour settles while the dropdown still counts as showing.
    if (root.hasAttribute(OPEN_ATTR)) {
      root.removeAttribute(OPEN_ATTR);
      getComputedStyle(link).color;
    }
    root.removeAttribute(ACTIVE_ATTR);
    root.removeAttribute(ENTERING_ATTR);
    panel.style.visibility = '';
    panel.style.clipPath = '';
    current?.removeAttribute(CURRENT_ATTR);
    current = null;
    const lines = items.map(rowLink);
    const single = pictures.length ? null : img;
    gsap.killTweensOf([panel, pill, single, imageWin, ...sections, ...lines].filter(Boolean));
    gsap.set([panel, pill, single, ...sections, ...lines].filter(Boolean), {
      clearProps: 'opacity,transform,width,height',
    });
    imageWin.open = 1;
    if (image) image.style.clipPath = '';
    if (pictures.length) restPictures();
  };

  // Closed: the pill goes back to the glide, on item `on` (null: hidden).
  const finish = (on) => {
    // Back in the label's pill as it fades out (the pointer's left the nav):
    // the label eases back with it rather than snapping white on white.
    if (rest && on === root && !glide.wanted()) root.removeAttribute(ACTIVE_ATTR);
    hide();
    if (!rest) return;
    rest = null;
    gsap.killTweensOf(body);
    gsap.set(body, { clearProps: 'backgroundColor,boxShadow,borderRadius' });
    glide.release(on);
  };

  // The content coming in, from `at` (s) on the timeline: each row's link
  // rises from below the row's edge (the rows clip it meanwhile —
  // src/styles/nav-submenu.css), one after another; the highlight wipes in
  // under the first row as it lights up; the image settles from a slight
  // zoom (and, with the glide's pill as the body, opens upward — without it
  // the opening window uncovers it); the footer follows.
  const contentIn = (tl, at) => {
    root.setAttribute(ENTERING_ATTR, '');
    const { rows: r } = MOTION;
    rows().forEach((row, i) => {
      tl.fromTo(
        rowLink(row),
        { y: row.offsetHeight },
        { y: 0, duration: r.duration, ease: r.ease, clearProps: 'transform' },
        at + r.delay + i * r.stagger
      );
    });
    tl.call(markCurrent, null, at + MOTION.pill.delay);
    if (pill && current) {
      tl.fromTo(
        pill,
        { opacity: 1, scaleX: 0, transformOrigin: '0% 50%' },
        { scaleX: 1, duration: MOTION.pill.duration, ease: MOTION.pill.ease },
        at + MOTION.pill.delay
      );
    }
    const { image: m } = MOTION;
    if (image && body) {
      imageWin.open = 0;
      renderImage();
      tl.to(
        imageWin,
        { open: 1, duration: m.reveal, ease: m.ease, onUpdate: renderImage },
        at + m.delay
      );
    }
    const zoom = zoomed();
    if (zoom) {
      tl.fromTo(
        zoom,
        { scale: m.scale },
        { scale: 1, duration: m.duration, ease: m.ease, clearProps: 'transform' },
        at + m.delay
      );
    }
    if (cta) {
      tl.fromTo(
        cta,
        { y: MOTION.cta.y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: MOTION.cta.duration,
          ease: MOTION.cta.ease,
          clearProps: 'transform',
        },
        at + MOTION.cta.delay
      );
    }
  };

  // Whatever a close cut short — or the open before it — comes back.
  const contentBack = (tl, at) => {
    const back = { duration: 0.5, ease: 'expo.out' };
    tl.call(markCurrent, null, at);
    tl.to([...sections, pill].filter(Boolean), { opacity: 1, duration: 0.25 }, at)
      .to(
        [...rows().map(rowLink), zoomed(), ...sections].filter(Boolean),
        { y: 0, scale: 1, ...back, clearProps: 'transform' },
        at
      )
      .to(imageWin, { open: 1, ...back, onUpdate: renderImage }, at);
    if (pill) tl.to(pill, { scaleX: 1, ...back }, at);
  };

  // The content going (the glide's pill as the body): the rows drop back
  // below their edges, the image closes downward, the highlight and the
  // footer fade — before the body collapses.
  const contentOut = (tl) => {
    const o = MOTION.out;
    root.setAttribute(ENTERING_ATTR, '');
    rows().forEach((row, i) => {
      tl.to(
        rowLink(row),
        { y: row.offsetHeight, duration: o.duration, ease: o.ease },
        i * o.stagger
      );
    });
    if (pill) tl.to(pill, { opacity: 0, duration: o.duration, ease: 'power1.out' }, 0);
    if (image) {
      tl.to(imageWin, { open: 0, duration: o.duration, ease: o.ease, onUpdate: renderImage }, 0);
    }
    if (cta) {
      tl.to(cta, { y: MOTION.cta.y, opacity: 0, duration: o.duration, ease: o.ease }, 0);
    }
  };

  // The body collapsing back into a pill, handing back the pill's own look:
  // the pill of the link the pointer's on — followed on to the next one if it
  // moves again meanwhile, each time from wherever it's got to, so it keeps
  // its pace — or else the label's own, which fades out as it arrives (the
  // pointer's left the nav), the label easing back with it.
  let collapsing = null;
  const collapse = () => {
    const next = glide.wanted();
    const to = next || root;
    glide.mark(to);
    measureFrame();
    collapsing?.kill();
    collapsing = gsap
      .timeline({ onComplete: () => finish(to) })
      .to(
        b,
        {
          ...insetsOf(to.getBoundingClientRect()),
          radius: rest.radius,
          ...MOTION.morph,
          onUpdate: () => {
            renderBody();
            const now = glide.wanted();
            if (now && now !== to && now !== root) collapse();
          },
        },
        0
      )
      .to(body, { backgroundColor: rest.bg, boxShadow: rest.shadow, ...MOTION.morph }, 0);
    if (next) {
      collapsing.to(body, { opacity: 1, duration: MOTION.fadeOut.duration }, 0);
      return;
    }
    const { at, duration } = MOTION.fadeOut;
    collapsing
      .call(
        () => {
          labelFree = true;
          root.removeAttribute(ACTIVE_ATTR);
          root.removeAttribute(OPEN_ATTR);
        },
        null,
        at
      )
      .to(body, { opacity: 0, duration, ease: 'power1.out' }, at);
  };

  const open = () => {
    clearTimeout(leaveTimer);
    if (isOpen || !desktop.matches) return;
    isOpen = true;
    // Still showing from a close cut short: carry on from where it got to.
    const fresh = !root.hasAttribute(ACTIVE_ATTR);
    // (With the glide's pill, the label turns as the pill's under it.)
    if (!body) root.setAttribute(OPEN_ATTR, '');
    root.setAttribute(ACTIVE_ATTR, '');
    link.setAttribute('aria-expanded', 'true');
    panel.style.visibility = 'visible';
    timeline?.kill();
    collapsing?.kill();
    if (fresh) setCurrent(firstRow(), false, false);

    measure();
    if (body) {
      labelFree = false;
      takeOver();
      glide.mark(root);
    }

    if (prefersReducedMotion()) {
      markCurrent();
      gsap.set([panel, ...sections], { opacity: 1 });
      if (pill) gsap.set(pill, { opacity: 1, scaleX: 1 });
      if (body) {
        Object.assign(b, { top: 0, right: 0, bottom: 0, left: 0, radius: look.radius });
        gsap.set(body, { opacity: 1, backgroundColor: look.bg, boxShadow: look.shadow });
        renderBody();
      }
      settle();
      return;
    }

    timeline = gsap.timeline({ onComplete: settle });
    if (body) {
      // The pill grows evenly into the body, taking on its look; the
      // content comes in once it's (all but) open.
      timeline
        .to(body, { opacity: 1, duration: MOTION.appear, ease: 'power1.out' }, 0)
        .to(
          b,
          {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            radius: look.radius,
            ...MOTION.grow,
            onUpdate: renderBody,
          },
          0
        )
        .to(body, { backgroundColor: look.bg, duration: MOTION.tint, ease: 'power1.out' }, 0)
        .to(body, { boxShadow: look.shadow, ...MOTION.grow }, 0);
    } else {
      // The window opens out of the label's box, uncovering the content as
      // it comes in.
      if (fresh) {
        Object.assign(win, chip);
        gsap.set(panel, { opacity: 0 });
      }
      renderWindow();
      timeline
        .to(panel, { opacity: 1, duration: MOTION.appear, ease: 'power1.out' }, 0)
        .to(
          win,
          { top: 0, right: 0, bottom: 0, left: 0, ...MOTION.grow, onUpdate: renderWindow },
          0
        );
    }
    const { content } = MOTION;
    if (fresh) contentIn(timeline, body ? content.afterBody : content.withWindow);
    else contentBack(timeline, 0);
  };

  const close = () => {
    clearTimeout(leaveTimer);
    clearTimeout(openTimer);
    if (!isOpen) return;
    isOpen = false;
    link.setAttribute('aria-expanded', 'false');
    timeline?.kill();
    collapsing?.kill();
    if (prefersReducedMotion() || !desktop.matches) {
      if (body) finish(desktop.matches ? glide.wanted() : null);
      else hide();
      return;
    }
    measure();
    const { duration, ease, lift } = MOTION.close;
    if (body) {
      measureFrame();
      // The content goes first; then the body collapses back into a pill.
      const onward = glide.wanted() && glide.wanted() !== root;
      timeline = gsap.timeline();
      contentOut(timeline);
      timeline.call(collapse, null, onward ? MOTION.out.onwardAt : MOTION.out.collapseAt);
      return;
    }
    if (!panel.style.clipPath) settle();
    timeline = gsap
      .timeline({ onComplete: hide })
      .to(
        win,
        {
          // The bottom edge rises to the window's top.
          bottom: height - win.top,
          duration,
          ease,
          onUpdate: () => {
            renderWindow();
            // The label turns back the moment the edge passes it
            // (src/styles/nav-submenu.css).
            if (height - win.bottom < labelMid) root.removeAttribute(OPEN_ATTR);
          },
        },
        0
      )
      .to(sections, { y: -lift, duration, ease }, 0);
  };

  // Hover (devices that can): opening after a moment's intent, and with a
  // grace period on the way out.
  const onEnter = (event) => {
    if (event.pointerType !== 'mouse' || !canHover.matches) return;
    clearTimeout(leaveTimer);
    clearTimeout(openTimer);
    if (!isOpen) openTimer = setTimeout(open, MOTION.openDelay);
  };
  // Straight on to another of the nav glide's links, it goes at once (once
  // the glide has seen which).
  const glideItemOf = (el) => {
    for (let node = el; node && node !== body.parentElement; node = node.parentElement) {
      if (getNavGlide(node) === glide) return node;
    }
    return null;
  };
  const onLeave = (event) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(openTimer);
    clearTimeout(leaveTimer);
    const next = body && event.relatedTarget ? glideItemOf(event.relatedTarget) : null;
    leaveTimer = setTimeout(close, next && next !== root ? 0 : MOTION.leaveDelay);
  };
  // The highlight follows the pointer from row to row (and stays put when it
  // moves on to the image or the footer).
  const onRowOver = (event) => {
    if (!isOpen) return;
    const row = items.find((el) => el.contains(event.target));
    if (row && row.offsetHeight) setCurrent(row, true);
  };
  // Click / tap anywhere on the label's box (touch, and a mouse click while
  // it's open).
  const onClick = (event) => {
    if (!desktop.matches) return;
    event.preventDefault();
    if (isOpen && !(event.pointerType === 'mouse' && canHover.matches)) close();
    else open();
  };
  // Keyboard: focus coming in opens it (not focus handed back to the toggle
  // from inside, as Escape does), and the highlight follows the focus;
  // leaving closes it.
  const onFocusIn = (event) => {
    if (!root.contains(event.relatedTarget) && root.querySelector(':focus-visible')) open();
    const row = items.find((el) => el.contains(event.target));
    if (row && isOpen) setCurrent(row, true);
  };
  const onFocusOut = (event) => {
    if (!root.contains(event.relatedTarget)) close();
  };
  // Escape closes; the arrow keys move from the toggle into the rows and
  // through them.
  const onKey = (event) => {
    if (event.key === 'Escape') {
      if (!isOpen) return;
      close();
      link.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!desktop.matches) return;
    const links = rows().map(rowLink);
    const at = links.indexOf(document.activeElement);
    if (!links.length || (at === -1 && document.activeElement !== link)) return;
    event.preventDefault();
    open();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    let next = at + step;
    if (at === -1) next = step === 1 ? 0 : links.length - 1;
    links[(next + links.length) % links.length].focus();
  };
  // Tapping elsewhere closes it.
  const onOutside = (event) => {
    if (isOpen && !root.contains(event.target)) close();
  };
  // Below the desktop breakpoint the panel is Webflow's inline mobile menu.
  const onBreakpoint = () => {
    if (!desktop.matches) close();
  };

  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  list?.addEventListener('pointerover', onRowOver);
  toggle.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside);
  desktop.addEventListener('change', onBreakpoint);

  return () => {
    clearTimeout(leaveTimer);
    clearTimeout(openTimer);
    timeline?.kill();
    collapsing?.kill();
    finish(null);
    root.removeAttribute(MORPH_ATTR);
    root.removeEventListener('pointerenter', onEnter);
    root.removeEventListener('pointerleave', onLeave);
    list?.removeEventListener('pointerover', onRowOver);
    toggle.removeEventListener('click', onClick);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onOutside);
    desktop.removeEventListener('change', onBreakpoint);
    root.removeAttribute(READY_ATTR);
    items.forEach((row) => row.removeAttribute(ROW_ATTR));
    root.style.removeProperty('--submenu-shadow');
    link.removeAttribute('aria-expanded');
    link.removeAttribute('aria-controls');
    if (pill) {
      pill.remove();
      track.style.position = trackStyle.position;
      track.style.isolation = trackStyle.isolation;
    }
    if (pictures.length) {
      gsap.killTweensOf(pictures);
      gsap.set(pictures, { clearProps: 'opacity,visibility,clipPath,transform,zIndex' });
    }
  };
}

/** Wire every [nav-submenu]. Safe to call repeatedly. */
export function initNavSubmenus() {
  if (typeof document === 'undefined' || instances.length) return cleanupNavSubmenus;
  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    const cleanup = initSubmenu(root);
    if (cleanup) instances.push(cleanup);
  });
  return cleanupNavSubmenus;
}

export function cleanupNavSubmenus() {
  instances.splice(0).forEach((cleanup) => cleanup());
}
