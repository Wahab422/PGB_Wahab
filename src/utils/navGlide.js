/**
 * Nav glide registry — which glide highlight (src/global/navbar.js) an item
 * belongs to, so a component can take the pill over for a while: the
 * [nav-submenu] dropdown grows it into its body. A glide is:
 *   highlight    the pill
 *   wanted()     the item under the pointer / keyboard focus now, or null
 *   hold()       stop gliding: the component moves the pill itself; returns
 *                where it is right now, { rect, opacity } (mid-glide included)
 *   mark(item)   the item the pill counts as being on (data-nav-hover-on)
 *   release(on)  hand it back, the pill now on item `on` (null: hidden); it
 *                glides on from there to whichever item is wanted
 */

const glides = new WeakMap();

export function setNavGlide(item, glide) {
  if (glide) glides.set(item, glide);
  else glides.delete(item);
}

/** The glide `item` is one of the items of, or null. */
export function getNavGlide(item) {
  return glides.get(item) || null;
}
