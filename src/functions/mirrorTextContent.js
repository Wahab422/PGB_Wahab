/**
 * Mirror Text Content
 * Keeps the text of one or more elements in sync with a source element, grouped
 * by a shared id. Initialized globally from src/global/index.js.
 *
 * Markup:
 *   [mirror-textcontent-id="price"][mirror-textcontent="src"]   — the source
 *   [mirror-textcontent-id="price"][mirror-textcontent="dest"]  — receives the text
 *   [mirror-textcontent-id="price"][mirror-textcontent="dest"]  — (any number of dests)
 *
 * For each distinct mirror-textcontent-id value:
 * - The element marked [mirror-textcontent="src"] is the source. If more than one
 *   src exists for the same id, only the FIRST (in DOM order) is used and a
 *   warning is logged.
 * - Every [mirror-textcontent="dest"] with that id gets the source's textContent.
 *
 * Live: the source's text can change at any time — a MutationObserver on each
 * source re-mirrors to its destinations on every change (and dests are re-queried
 * each sync, so dests added later are picked up too). Call cleanupMirrorTextContent()
 * on teardown / re-init to disconnect the observers.
 */

import { logger } from '../utils/logger';

const GROUP_ATTR = 'mirror-textcontent-id';
const ROLE_ATTR = 'mirror-textcontent';

let observers = [];

function escapeAttr(value) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : String(value).replace(/"/g, '\\"');
}

// Push the source's current text into every dest sharing its id. Dests are
// re-queried each call so ones added after init still receive updates.
function applyToDests(id, value) {
  const selector = `[${GROUP_ATTR}="${escapeAttr(id)}"][${ROLE_ATTR}="dest"]`;
  document.querySelectorAll(selector).forEach((dest) => {
    if (dest.textContent !== value) dest.textContent = value;
  });
}

export function mirrorTextContent() {
  // Idempotent: drop any observers from a previous run before re-scanning.
  cleanupMirrorTextContent();
  if (typeof document === 'undefined') return;

  const elements = document.querySelectorAll(`[${GROUP_ATTR}]`);
  if (!elements.length) return;

  // Group elements by their shared id value.
  const groups = new Map();
  elements.forEach((el) => {
    const id = el.getAttribute(GROUP_ATTR);
    if (!id) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(el);
  });

  groups.forEach((members, id) => {
    const sources = members.filter((el) => el.getAttribute(ROLE_ATTR) === 'src');
    if (!sources.length) return; // nothing to mirror from

    if (sources.length > 1) {
      logger.warn(
        `[MirrorTextContent] Multiple [${ROLE_ATTR}=src] for id "${id}" — only the first is used as the source.`
      );
    }

    const src = sources[0];
    const sync = () => applyToDests(id, src.textContent);
    sync(); // initial copy

    // The source text can change at any time (child/text edits, subtree).
    const observer = new MutationObserver(sync);
    observer.observe(src, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
  });

  if (observers.length > 0) {
    logger.log(`🪞 Mirror text content: syncing ${observers.length} source(s)`);
  }
}

export function cleanupMirrorTextContent() {
  observers.forEach((observer) => observer.disconnect());
  observers = [];
}
