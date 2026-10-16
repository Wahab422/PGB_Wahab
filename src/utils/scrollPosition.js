/**
 * ScrollTrigger positions measured from where an element rests, not from
 * wherever an animation is holding it.
 *
 * ScrollTrigger reads its trigger's on-screen box, transforms included. An
 * element that something moves — a float, the #section-projects drift, a
 * stagger's from-y, its own scrubbed tween held at its start during a refresh
 * — is then measured off by that offset, and fires early / late with markers
 * drawn in the wrong place. Used by src/animations/imageReveal.js and
 * src/animations/float.js.
 */

/**
 * The element's page top by layout alone: offsetTop ignores transforms. A
 * position: sticky element (or ancestor) that's currently pinned reports its
 * pinned offsetTop, so those are measured as position: relative for the
 * moment — same offsetParent, no pin — and put straight back.
 */
export function layoutTop(el) {
  const unpinned = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'sticky') {
      unpinned.push([node, node.style.position]);
      node.style.position = 'relative';
    }
  }
  let top = 0;
  for (let node = el; node; node = node.offsetParent) {
    top += node.offsetTop + (node.offsetParent ? node.offsetParent.clientTop : 0);
  }
  unpinned.forEach(([node, position]) => {
    node.style.position = position;
  });
  return top;
}

// A plain "<element edge> <screen edge>" position: top / center / bottom / N% /
// Npx on each side, e.g. "top 85%".
const SIMPLE_POSITION =
  /^(top|center|bottom|-?\d*\.?\d+(%|px)?)\s+(top|center|bottom|-?\d*\.?\d+(%|px)?)$/;

/**
 * A ScrollTrigger start / end for `el`, measured from where it rests: the same
 * "top 85%" position, plus the px that undo any transform on the element or
 * its ancestors at the moment ScrollTrigger measures it (worked out on each
 * refresh, right before it measures). The trigger point is then exact, and
 * the markers are drawn on the element's real edges. Positions in another form
 * (e.g. "top+=100 bottom") are handed to ScrollTrigger as written.
 */
export function restingPosition(el, position) {
  const text = String(position).trim();
  if (!SIMPLE_POSITION.test(text)) return position;
  const [own, screen] = text.split(/\s+/);
  return () => {
    const shift = Math.round(layoutTop(el) - (el.getBoundingClientRect().top + window.scrollY));
    if (!shift) return text;
    return `${own}${shift > 0 ? '+=' : '-='}${Math.abs(shift)} ${screen}`;
  };
}
