import { isEmptyText, stripZeroWidth } from '../utils/text';

function populateSubheading(subTemplate, srcHeading) {
  const subClone = subTemplate.cloneNode(true);
  subClone.removeAttribute('rich-content');
  subClone.innerText = srcHeading.innerText;
  return subClone;
}

function populateList(listTemplate, srcList) {
  const listClone = listTemplate.cloneNode(true);
  listClone.removeAttribute('rich-content');

  const itemTemplate = listClone.querySelector('[rich-content="item"]');
  if (!itemTemplate) return listClone;

  srcList.querySelectorAll('li').forEach((li) => {
    // Skip blank <li>s Webflow leaves behind (they rendered as empty bullets).
    if (isEmptyText(li.textContent)) return;
    const itemClone = itemTemplate.cloneNode(true);
    itemClone.removeAttribute('rich-content');

    const itemText = itemClone.querySelector('[rich-content="item-text"]');
    if (itemText) itemText.innerHTML = li.innerHTML;

    listClone.insertBefore(itemClone, itemTemplate);
  });

  itemTemplate.remove();
  return listClone;
}

function populateParagraphList(listTemplate, paragraphs) {
  const listClone = listTemplate.cloneNode(true);
  listClone.removeAttribute('rich-content');

  const itemTemplate = listClone.querySelector('[rich-content="item"]');
  if (!itemTemplate) return listClone;

  paragraphs.forEach((p) => {
    const itemClone = itemTemplate.cloneNode(true);
    itemClone.removeAttribute('rich-content');

    const itemText = itemClone.querySelector('[rich-content="item-text"]');
    if (itemText) itemText.innerHTML = p.innerHTML;

    listClone.insertBefore(itemClone, itemTemplate);
  });

  itemTemplate.remove();
  return listClone;
}

function populateRichContent() {
  const srcs = document.querySelectorAll('[rich-content="src"]');

  srcs.forEach((src) => {
    const id = src.getAttribute('rich-content-id');
    if (id === null) return;
    // CSS.escape: a quote or backslash in the id would otherwise throw.
    const template = document.querySelector(
      `[rich-content="dest-template"][rich-content-id="${CSS.escape(id)}"]`
    );
    if (!template) return;

    const parent = template.parentElement;
    const h3s = src.querySelectorAll('h3');

    const isCourseTitle = (text) => {
      const t = stripZeroWidth(text).trim().toLowerCase();
      return t === 'course' || t === 'courses';
    };

    const clones = [];

    h3s.forEach((h3) => {
      if (isEmptyText(h3.innerText)) return;

      const clone = template.cloneNode(true);
      clone.removeAttribute('rich-content');

      const titleEl = clone.querySelector('[rich-content="title"]');
      if (titleEl) titleEl.innerText = h3.innerText;

      const blockEl = clone.querySelector('[rich-content="block"]');
      if (blockEl) {
        const listTemplate = blockEl.querySelector('[rich-content="list"]');
        const subTemplate = blockEl.querySelector('[rich-content="h4"]');
        blockEl.innerHTML = '';

        const isSubheading = (n) => n.nodeType === 1 && (n.tagName === 'H4' || n.tagName === 'H5');

        let node = h3.nextSibling;
        while (node && !(node.nodeType === 1 && node.tagName === 'H3')) {
          if (node.nodeType === 1 && (node.tagName === 'UL' || node.tagName === 'OL')) {
            if (listTemplate) blockEl.appendChild(populateList(listTemplate, node));
            node = node.nextSibling;
          } else if (isSubheading(node)) {
            if (subTemplate) blockEl.appendChild(populateSubheading(subTemplate, node));
            node = node.nextSibling;
          } else if (node.nodeType === 1 && node.tagName === 'P') {
            const paragraphs = [];
            while (node && node.nodeType === 1 && node.tagName === 'P') {
              if (!isEmptyText(node.innerText)) paragraphs.push(node);
              node = node.nextSibling;
            }
            if (listTemplate) blockEl.appendChild(populateParagraphList(listTemplate, paragraphs));
          } else {
            blockEl.appendChild(node.cloneNode(true));
            node = node.nextSibling;
          }
        }
      }

      clones.push({ clone, isCourse: isCourseTitle(h3.innerText) });
    });

    // Course groups go first, otherwise keep original document order.
    clones
      .filter((c) => c.isCourse)
      .concat(clones.filter((c) => !c.isCourse))
      .forEach(({ clone }) => parent.insertBefore(clone, template));

    template.remove();
    src.remove();
  });
}

export { populateRichContent };
