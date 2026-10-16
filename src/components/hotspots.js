/**
 * Hotspots — "+" markers on a photo, each opening a card (a picture, a name
 * and a line of text), placed from the CMS: the Projects modal's site view,
 * and a solution page's hotspots module (below). Each hotspot is a CMS item
 * (Projects Hotspots: X / Y position, Order, Project; Solutions Hotspots: the
 * same with Solution and Category), so a project or solution can have as many
 * as it needs. Initialised from src/global/index.js
 * on pages that have a [data-hotspots].
 *
 * ── Markup (attributes in Webflow) ───────────────────────────────────────────
 *   <div data-hotspots class="site-view">          ← the photo's box (positioned)
 *     <img class="bg" …>
 *     <div class="hotspots-list">
 *       Collection List — Hotspots
 *         <div data-hotspot class="hotspot"
 *              data-hotspot-x="{X position}" data-hotspot-y="{Y position}"
 *              data-hotspot-order="{Order}" data-hotspot-project="{Project › Slug}">
 *           <div data-hotspot-toggle class="hotspot-icon">+</div>
 *           <div data-hotspot-card class="hotspot-card">
 *             <div class="hotspot-card-fig">
 *               <img alt="{Name}" …>
 *               <div data-hotspot-close class="hotspot-icon">−</div>
 *             </div>
 *             <div class="hotspot-card-text">{Name} {Text}</div>
 *           </div>
 *         </div>
 *     </div>
 *   </div>
 *
 * A solution page's hotspots module works the same way, from the Solutions
 * Hotspots collection, with a tab per category (💠Solution Hotspot
 * Categories: Sliding door, Pivot door) — each tab's picture wiping in (the
 * tabs' mask effect) with that category's hotspots on it:
 *   <div data-hotspots data-hotspots-solution="{Slug}"
 *        data-tabs-comp data-tabs-effect="mask">               ← the photo's box
 *     <img data-tabs-img data-tabs-mask-media …>               ← Sliding door photo
 *     <img data-tabs-img data-tabs-mask-media …>               ← Pivot door photo
 *     Collection List — Solutions Hotspots
 *       <div data-hotspot … data-hotspot-solution="{Solution › Slug}"
 *            data-hotspot-category="{Category › Slug}">…</div>
 *     <button data-tabs-btn data-hotspots-category="sliding-door">Sliding door</button>
 *     <button data-tabs-btn data-hotspots-category="pivot-door">Pivot door</button>
 *   </div>
 *
 * ── Options (on [data-hotspots]) ─────────────────────────────────────────────
 *   data-hotspots-project="slug"   show only that project's hotspots — set it
 *                                  as the modal opens a project (picked up
 *                                  live). Without it: the project of the first
 *                                  hotspot in the list.
 *   data-hotspots-solution="slug"  the same for a solution page's module
 *                                  (each hotspot's data-hotspot-solution).
 *   data-hotspots-category="slug"  show only that category's hotspots (picked
 *                                  up live). Without it: the category of the
 *                                  active tab ([data-tabs-btn] with
 *                                  data-hotspots-category, in the
 *                                  [data-tabs-comp] it's in or holds), else of
 *                                  the first hotspot. Hotspots without a
 *                                  category always show.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────────
 * Each + is centred on its X / Y, as a % of the photo as it's drawn — cropped
 * to fill the box (object-fit: cover, e.g. a landscape photo in a phone's
 * tall box) or not — so it stays on the same spot of the photo at any size;
 * one whose spot is cropped out of view is hidden. A + opens its card (one at
 * a time); the −, a click anywhere else or Esc closes it. Near the bottom of
 * the photo the card opens upwards, and it slides sideways as far as it takes
 * to stay on the photo. The + and − are
 * buttons (Enter / Space), and the hotspots tab in their Order. Hidden until
 * set up (src/styles/hotspots.css), so they don't show piled up first. On a
 * change of tab the open card closes, the old category's hotspots shrink away
 * and the new one's pop in one after another as its picture wipes in (at
 * once under prefers-reduced-motion).
 *
 * Position picker: open the page with ?hotspots=edit. Each hotspot shows its
 * X / Y, and clicking the photo shows (and copies) the X / Y of that spot —
 * the numbers for a hotspot's X position / Y position fields.
 * cleanupHotspots() takes it all back off.
 */

import { logger } from '../utils/logger';

const SELECTORS = {
  root: '[data-hotspots]',
  hotspot: '[data-hotspot]',
  toggle: '[data-hotspot-toggle]',
  card: '[data-hotspot-card]',
  close: '[data-hotspot-close]',
  // A category's hotspots follow these tabs (src/components/tabs.js).
  tabs: '[data-tabs-comp]',
  tabButton: '[data-tabs-btn][data-hotspots-category]',
  // The photo the hotspots sit on: each tab's ([data-tabs-img], in the tabs'
  // order), else the box's own picture.
  tabPhoto: 'img[data-tabs-img], [data-tabs-img] img',
  photo: ':scope > img, :scope > picture img',
};
// On a hotspot whose spot is cropped out of view (a narrow screen).
const OUTSIDE_ATTR = 'data-hotspot-outside';
// On a hotspot fading out / popping in as the category changes.
const LEAVING_ATTR = 'data-hotspot-leaving';
const ENTERING_ATTR = 'data-hotspot-entering';
const SWAP = {
  // ms: the old hotspots fade out, then the new ones come in — as the tab's
  // picture is half wiped in (the mask effect's 1.1s) — …
  wait: 450,
  // …each this many seconds after the one before.
  stagger: 0.08,
};
// Set once a hotspot is placed: src/styles/hotspots.css hides it until then.
const READY_ATTR = 'data-hotspot-ready';
const OPEN_ATTR = 'data-hotspot-open';
// The card opens leftwards (lined up with the +'s right edge) / upwards.
const FLIP_X_ATTR = 'data-hotspot-flip-x';
const FLIP_Y_ATTR = 'data-hotspot-flip-y';
const EDIT_ATTR = 'data-hotspots-edit';
// Room (px) the card keeps from the photo's edges before it flips.
const EDGE = 8;

const instances = new Map();
let cardCount = 0;

const readPercent = (el, name) => {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
};

function initHotspotsRoot(root) {
  const hotspots = Array.from(root.querySelectorAll(SELECTORS.hotspot));
  if (!hotspots.length) return null;
  const cleanups = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };
  // Attributes and inline styles this adds, taken back off by the cleanup.
  const added = [];
  const setOwn = (el, name, value) => {
    if (el.hasAttribute(name)) return;
    el.setAttribute(name, value);
    added.push([el, name]);
  };

  // ── Order: by the Order field (the CMS list's own order otherwise), so the
  // hotspots tab in that order. Each sits in its own Collection item.
  const orderOf = (hotspot) => {
    const value = Number.parseFloat(hotspot.getAttribute('data-hotspot-order'));
    return Number.isFinite(value) ? value : Infinity;
  };
  const itemOf = (hotspot) => hotspot.closest('.w-dyn-item') || hotspot;
  hotspots
    .map((hotspot, index) => ({ hotspot, index }))
    .sort((a, b) => orderOf(a.hotspot) - orderOf(b.hotspot) || a.index - b.index)
    .forEach(({ hotspot }) => {
      const item = itemOf(hotspot);
      item.parentElement?.append(item);
    });

  // ── Placing and wiring each hotspot.
  const parts = hotspots.map((hotspot) => {
    const toggle = hotspot.querySelector(SELECTORS.toggle);
    const card = hotspot.querySelector(SELECTORS.card);
    const close = hotspot.querySelector(SELECTORS.close);
    const x = readPercent(hotspot, 'data-hotspot-x');
    const y = readPercent(hotspot, 'data-hotspot-y');
    if (!toggle || !card || x === null || y === null) {
      logger.warn('[Hotspots] needs a toggle, a card and an X / Y — skipped:', hotspot);
      return null;
    }
    // Until the photo's measured (placePhotos below): as a share of the box.
    hotspot.style.left = `${x}%`;
    hotspot.style.top = `${y}%`;
    const name = card.querySelector('img')?.alt?.trim() || card.textContent.trim().split('\n')[0];
    cardCount += 1;
    setOwn(card, 'id', `hotspot-card-${cardCount}`);
    [toggle, close].filter(Boolean).forEach((button) => {
      setOwn(button, 'role', 'button');
      setOwn(button, 'tabindex', '0');
    });
    setOwn(toggle, 'aria-label', name ? `${name}: show details` : 'Show details');
    setOwn(toggle, 'aria-controls', card.id);
    if (close) setOwn(close, 'aria-label', 'Close');
    toggle.setAttribute('aria-expanded', 'false');
    hotspot.setAttribute(READY_ATTR, '');
    return { hotspot, toggle, card, close, x, y };
  });
  const live = parts.filter(Boolean);

  // ── Opening and closing.
  let open = null;
  const shut = (part, { focus = false } = {}) => {
    if (!part) return;
    part.hotspot.removeAttribute(OPEN_ATTR);
    part.toggle.setAttribute('aria-expanded', 'false');
    if (open === part) open = null;
    if (focus) part.toggle.focus();
  };
  // Opens down from the +, or up if there's more room above; and sideways
  // from the +'s left edge, slid back as far as it takes to stay on the photo
  // (a small screen: as wide as the photo, more or less).
  const place = (part) => {
    part.hotspot.removeAttribute(FLIP_Y_ATTR);
    part.card.style.removeProperty('left');
    part.card.style.removeProperty('right');
    const box = root.getBoundingClientRect();
    const icon = part.toggle.getBoundingClientRect();
    const from = part.hotspot.getBoundingClientRect().left;
    const { offsetWidth: width, offsetHeight: height } = part.card;
    const roomBelow = box.bottom - icon.bottom - EDGE;
    const roomAbove = icon.top - box.top - EDGE;
    if (height > roomBelow && roomAbove > roomBelow) part.hotspot.setAttribute(FLIP_Y_ATTR, '');
    let shift = Math.min(0, box.right - EDGE - (from + width));
    shift = Math.max(shift, box.left + EDGE - from);
    if (shift) {
      part.card.style.left = `${Math.round(shift)}px`;
      part.card.style.right = 'auto';
    }
  };
  const show = (part) => {
    if (open && open !== part) shut(open);
    place(part);
    part.hotspot.setAttribute(OPEN_ATTR, '');
    part.toggle.setAttribute('aria-expanded', 'true');
    open = part;
  };
  const press = (button, action) => {
    listen(button, 'click', (event) => {
      event.stopPropagation();
      action();
    });
    listen(button, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      action();
    });
  };
  live.forEach((part) => {
    press(part.toggle, () => (open === part ? shut(part) : show(part)));
    if (part.close) press(part.close, () => shut(part, { focus: true }));
  });
  listen(document, 'click', (event) => {
    if (open && !open.hotspot.contains(event.target)) shut(open);
  });
  // Captured, and stopped there: inside a modal, Esc closes the card first,
  // not the modal with it (modal-basic.js listens on the document too).
  listen(
    document,
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !open) return;
      event.stopPropagation();
      shut(open, { focus: true });
    },
    true
  );

  // ── Which hotspots show (and, in the picker, their badges): the project's,
  // and of those the category's — the tab showing, with tabs.
  const badges = new Map(); // hotspot → its picker badge
  // Whose hotspot it is: its project (Projects Hotspots) or solution
  // (Solutions Hotspots).
  const projectOf = (hotspot) =>
    hotspot.getAttribute('data-hotspot-project') ||
    hotspot.getAttribute('data-hotspot-solution') ||
    '';
  const categoryOf = (hotspot) => hotspot.getAttribute('data-hotspot-category') || '';
  const categorised = hotspots.some(categoryOf);
  // The tabs whose buttons pick the category ([data-hotspots-category] on each).
  const tabs = categorised
    ? root.closest(SELECTORS.tabs) || root.querySelector(SELECTORS.tabs)
    : null;
  const tabButtons = tabs ? Array.from(tabs.querySelectorAll(SELECTORS.tabButton)) : [];
  const categoryOfButton = (button) => button?.getAttribute('data-hotspots-category') || '';
  // The category showing: set on the root, else the active tab's, else the
  // first hotspot's.
  const currentCategory = () => {
    const set = root.getAttribute('data-hotspots-category');
    if (set) return set;
    const active =
      tabButtons.find((button) => button.getAttribute('aria-selected') === 'true') ||
      tabButtons.find((button) => button.matches('.is-active, .active'));
    return categoryOfButton(active) || categoryOf(hotspots.find(categoryOf) || hotspots[0]);
  };
  const shows = (hotspot, project, category) =>
    !(project && projectOf(hotspot) !== project) &&
    !(category && categoryOf(hotspot) && categoryOf(hotspot) !== category);

  // A change of category (another tab) is animated: the old hotspots fade
  // out, then the new ones pop in, one after another, as the tab's picture
  // lands (src/styles/hotspots.css). The first filter just sets them.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let swapTimer = 0;
  let shownCategory = null;
  const settle = (hotspot) => {
    hotspot.removeAttribute(LEAVING_ATTR);
    hotspot.removeAttribute(ENTERING_ATTR);
    hotspot.style.removeProperty('--hotspot-delay');
  };
  const filter = () => {
    const project =
      root.getAttribute('data-hotspots-project') ||
      root.getAttribute('data-hotspots-solution') ||
      projectOf(hotspots[0]);
    const category = categorised ? currentCategory() : '';
    if (open) shut(open);
    clearTimeout(swapTimer);
    const animate = !reduced && shownCategory !== null && category !== shownCategory;
    shownCategory = category;
    const setHidden = (hotspot, hidden) => {
      itemOf(hotspot).hidden = hidden;
      if (badges.has(hotspot)) badges.get(hotspot).hidden = hidden;
    };
    if (!animate) {
      hotspots.forEach((hotspot) => {
        settle(hotspot);
        setHidden(hotspot, !shows(hotspot, project, category));
      });
      return;
    }
    const leaving = hotspots.filter((h) => !itemOf(h).hidden && !shows(h, project, category));
    const entering = hotspots.filter((h) => itemOf(h).hidden && shows(h, project, category));
    leaving.forEach((hotspot) => {
      settle(hotspot);
      hotspot.setAttribute(LEAVING_ATTR, '');
    });
    swapTimer = window.setTimeout(
      () => {
        leaving.forEach((hotspot) => {
          settle(hotspot);
          setHidden(hotspot, true);
        });
        entering.forEach((hotspot, index) => {
          settle(hotspot);
          hotspot.style.setProperty('--hotspot-delay', `${index * SWAP.stagger}s`);
          hotspot.setAttribute(ENTERING_ATTR, '');
          setHidden(hotspot, false);
        });
      },
      leaving.length ? SWAP.wait : 0
    );
  };
  hotspots.forEach((hotspot) =>
    listen(hotspot, 'animationend', (event) => {
      if (event.target === hotspot && hotspot.hasAttribute(ENTERING_ATTR)) settle(hotspot);
    })
  );
  filter();
  const watcher = new MutationObserver(filter);
  watcher.observe(root, {
    attributes: true,
    attributeFilter: ['data-hotspots-project', 'data-hotspots-solution', 'data-hotspots-category'],
  });
  cleanups.push(() => {
    watcher.disconnect();
    clearTimeout(swapTimer);
  });
  // tabs.js reports each change of tab (and its first, as it starts).
  if (tabs) listen(tabs, 'tabs:change', filter);

  // ── On the photo: X / Y are shares of the photo as it's drawn, cropped to
  // fill the box (object-fit: cover — e.g. a landscape photo in a phone's
  // tall box) or not, so a hotspot stays on its spot at any size. One whose
  // spot is cropped out of view is hidden. Each category's hotspots sit on
  // their own tab's photo.
  const photos = tabs ? Array.from(tabs.querySelectorAll(SELECTORS.tabPhoto)) : [];
  const ownPhoto = root.querySelector(SELECTORS.photo);
  const photoOf = (category) => {
    const index = tabButtons.findIndex((button) => categoryOfButton(button) === category);
    return photos[index] || photos[0] || ownPhoto;
  };
  const drawn = (img) => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    const whole = { left: 0, top: 0, width, height };
    if (!img?.naturalWidth || !width || !height) return whole;
    const frame =
      img.offsetParent === root
        ? {
            left: img.offsetLeft,
            top: img.offsetTop,
            width: img.offsetWidth,
            height: img.offsetHeight,
          }
        : whole;
    const style = getComputedStyle(img);
    const fit = style.objectFit;
    if (fit !== 'cover' && fit !== 'contain') return frame;
    const scale = (fit === 'cover' ? Math.max : Math.min)(
      frame.width / img.naturalWidth,
      frame.height / img.naturalHeight
    );
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    // object-position: a share of the room left over (50% = centred), or px.
    const [px, py] = style.objectPosition.split(' ');
    const offset = (value, room) =>
      value?.endsWith('%')
        ? (Number.parseFloat(value) / 100) * room
        : Number.parseFloat(value) || 0;
    return {
      left: frame.left + offset(px ?? '50%', frame.width - w),
      top: frame.top + offset(py ?? '50%', frame.height - h),
      width: w,
      height: h,
    };
  };
  const toBox = (img, x, y) => {
    const d = drawn(img);
    return { left: d.left + (x / 100) * d.width, top: d.top + (y / 100) * d.height };
  };
  const placePhotos = () => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    live.forEach(({ hotspot, x, y }) => {
      const at = toBox(photoOf(categoryOf(hotspot)), x, y);
      hotspot.style.left = `${at.left}px`;
      hotspot.style.top = `${at.top}px`;
      const outside = at.left < 0 || at.top < 0 || at.left > width || at.top > height;
      hotspot.toggleAttribute(OUTSIDE_ATTR, outside);
      const badge = badges.get(hotspot);
      if (badge) {
        badge.style.left = hotspot.style.left;
        badge.style.top = hotspot.style.top;
      }
    });
    if (open) place(open);
  };
  placePhotos();
  [ownPhoto, ...photos].filter(Boolean).forEach((img) => {
    if (!img.complete) listen(img, 'load', placePhotos);
  });
  if (typeof ResizeObserver !== 'undefined') {
    const resize = new ResizeObserver(placePhotos);
    resize.observe(root);
    cleanups.push(() => resize.disconnect());
  }

  // ── Position picker (?hotspots=edit).
  const editing = new URLSearchParams(window.location.search).get('hotspots') === 'edit';
  let picked = null;
  if (editing) {
    root.setAttribute(EDIT_ATTR, '');
    const badge = (text, at, picked = false) => {
      const el = document.createElement('div');
      el.setAttribute('data-hotspots-badge', picked ? 'picked' : '');
      el.textContent = text;
      el.style.left = `${at.left}px`;
      el.style.top = `${at.top}px`;
      root.append(el);
      return el;
    };
    live.forEach(({ hotspot, x, y }) =>
      badges.set(hotspot, badge(`X ${x} · Y ${y}`, toBox(photoOf(categoryOf(hotspot)), x, y)))
    );
    filter();
    // The X / Y of a spot on the photo showing (the current tab's).
    listen(root, 'click', (event) => {
      if (event.target.closest(SELECTORS.hotspot)) return;
      const box = root.getBoundingClientRect();
      const at = { left: event.clientX - box.left, top: event.clientY - box.top };
      const d = drawn(photoOf(categorised ? currentCategory() : ''));
      const x = Math.round(((at.left - d.left) / d.width) * 100);
      const y = Math.round(((at.top - d.top) / d.height) * 100);
      picked?.remove();
      picked = badge(`X ${x} · Y ${y} — copied`, at, true);
      navigator.clipboard?.writeText(`X position: ${x}, Y position: ${y}`).catch(() => {
        picked.textContent = `X ${x} · Y ${y}`;
      });
    });
  }

  return () => {
    cleanups.forEach((fn) => fn());
    badges.forEach((el) => el.remove());
    picked?.remove();
    root.removeAttribute(EDIT_ATTR);
    hotspots.forEach((hotspot) => {
      itemOf(hotspot).hidden = false;
      settle(hotspot);
      [READY_ATTR, OPEN_ATTR, FLIP_X_ATTR, FLIP_Y_ATTR, OUTSIDE_ATTR].forEach((name) =>
        hotspot.removeAttribute(name)
      );
      hotspot.style.removeProperty('left');
      hotspot.style.removeProperty('top');
    });
    live.forEach(({ card }) => {
      card.style.removeProperty('left');
      card.style.removeProperty('right');
    });
    live.forEach(({ toggle }) => toggle.removeAttribute('aria-expanded'));
    added.forEach(([el, name]) => el.removeAttribute(name));
  };
}

/**
 * Wire every [data-hotspots] on the page, or only those inside `scope` (content
 * added later, e.g. the project modal). Safe to call repeatedly.
 */
export function initHotspots(scope = document) {
  if (typeof document === 'undefined') return;
  scope.querySelectorAll(SELECTORS.root).forEach((root) => {
    if (instances.has(root)) return;
    const cleanup = initHotspotsRoot(root);
    if (cleanup) instances.set(root, cleanup);
  });
}

/** Take them all back off, or only those inside `scope`. */
export function cleanupHotspots(scope) {
  instances.forEach((cleanup, root) => {
    if (scope && !scope.contains(root)) return;
    cleanup();
    instances.delete(root);
  });
}
