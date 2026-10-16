import { populateRichContent } from './peoplePopulateRichContent';
import { initSectionVideoPlayer } from './sectionVideoPlayer';
import { getLenis, startLenis, stopLenis } from '../global/lenis';
import { getInitialFocusTarget, trapTabKey } from '../utils/focus';
import { logger } from '../utils/logger';

// Page scroll lock while the modal is open: Lenis when it's running, else
// (reduced motion, or Lenis failed to load) plain overflow:hidden.
function lockPageScroll() {
  if (getLenis()) stopLenis();
  else document.documentElement.style.overflow = 'hidden';
}

function unlockPageScroll() {
  if (getLenis()) startLenis();
  else document.documentElement.style.overflow = '';
}

export function handlePeopleModal() {
  const peopleModal = document.querySelector('#people-modal');

  if (!peopleModal) return;

  // The grid of profile cards that open this modal (and, through it, each
  // person's video) are plain divs in the Webflow markup — static content, so
  // one pass at init is enough, unlike the modal's own internals which are
  // re-tagged by enhanceAccessibility() every time they're (re)loaded.
  document.querySelectorAll('[data-people-name]').forEach((el) => {
    // Cards with an empty slug (e.g. the non-SCL Teachers Seminar people)
    // open nothing — don't turn them into focusable no-op buttons.
    if (!el.getAttribute('data-people-name')) return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });

  // Dialog semantics, set once — the shell persists and only #modal-container's
  // content is swapped per person. data-lenis-prevent lets everything inside
  // the modal scroll natively while Lenis holds the page behind it still.
  peopleModal.setAttribute('role', 'dialog');
  peopleModal.setAttribute('aria-modal', 'true');
  peopleModal.setAttribute('data-lenis-prevent', '');
  peopleModal.inert = !peopleModal.classList.contains('open');
  // The card (or whatever had focus) that opened the modal — focus goes back
  // there on close.
  let returnFocusTo = null;

  // The page this modal lives on. Captured once since this same component
  // runs on /people, /ackerman, /teachers-seminar, etc. listPageUrl adds the
  // query + hash (e.g. an active filter) as they were when the modal opened.
  const listPagePath = window.location.pathname;
  let listPageUrl = listPagePath;

  const peopleCache = {};
  // Bumped on every open request and on every close. A fetch that resolves
  // after a newer click (or after the modal was closed / Back was pressed) is
  // stale and dropped — otherwise a slow response for person A could open over
  // person B, and a double-click pushed the same /people/{slug} entry twice.
  let loadSeq = 0;
  // Slug of the person currently shown, so re-clicking them is a no-op.
  let currentSlug = null;
  // The card whose profile is loading: aria-busy + .is-loading until it opens.
  let loadingTrigger = null;
  let modalVideoCleanup = null;
  let modalVideoEventCleanup = null;
  let videoExpandedState = false;
  let originalVideoWidth = null;

  function expandVideo() {
    if (videoExpandedState) return;
    const peopleModalVideo = peopleModal.querySelector('[people-modal-video]');
    if (!peopleModalVideo) return;

    originalVideoWidth = peopleModalVideo.getBoundingClientRect().width;
    videoExpandedState = true;
    peopleModal.classList.add('video-expand');
    peopleModalVideo
      .querySelectorAll('[expand-video-btn]')
      .forEach((btn) => btn.setAttribute('aria-label', 'Collapse video'));

    const gsap = window.gsap;
    if (gsap) {
      gsap.killTweensOf(peopleModalVideo);
      gsap.to(peopleModalVideo, { width: '100%', duration: 0.5, ease: 'power2.inOut' });
      animateModalVideoPanelIn();
    } else {
      peopleModalVideo.style.width = '100%';
    }
  }

  // .modal-video (the name/quote panel revealed by .video-expand) has a 0s CSS
  // transition, so it snaps in instantly while the video panel beside it grows
  // over 0.5s. Layer a GSAP fade + stagger on top so the reveal actually animates.
  function getModalVideoRevealTargets() {
    const modalVideoPanel = peopleModal.querySelector('.modal-video');
    if (!modalVideoPanel) return { modalVideoPanel: null, children: [] };
    const children = modalVideoPanel.querySelectorAll(
      '.modal-header, .modal-video-headshot, .modal-video-head h2'
    );
    return { modalVideoPanel, children };
  }

  function animateModalVideoPanelIn() {
    const gsap = window.gsap;
    const { modalVideoPanel, children } = getModalVideoRevealTargets();
    if (!gsap || !modalVideoPanel || !children.length) return;

    gsap.killTweensOf([modalVideoPanel, ...children]);
    gsap.set(children, { opacity: 0, y: 12 });
    gsap
      .timeline()
      .to(modalVideoPanel, { opacity: 1, duration: 0.35, ease: 'power1.out' })
      .to(
        children,
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.08 },
        '-=0.2'
      );
  }

  function animateModalVideoPanelOut() {
    const gsap = window.gsap;
    const { modalVideoPanel, children } = getModalVideoRevealTargets();
    if (!gsap || !modalVideoPanel || !children.length) return;

    gsap.killTweensOf([modalVideoPanel, ...children]);
    gsap
      .timeline({
        onComplete: () =>
          gsap.set([modalVideoPanel, ...children], { clearProps: 'opacity,transform' }),
      })
      .to(children, { opacity: 0, y: 8, duration: 0.2, ease: 'power1.in', stagger: 0.04 })
      .to(modalVideoPanel, { opacity: 0, duration: 0.25, ease: 'power1.in' }, '-=0.1');
  }

  function shrinkVideo() {
    if (!videoExpandedState) return;
    const peopleModalVideo = peopleModal.querySelector('[people-modal-video]');
    if (!peopleModalVideo) return;

    const videoEl = peopleModalVideo.querySelector('.video-element');
    if (videoEl) videoEl.pause();

    const targetWidth = originalVideoWidth;
    videoExpandedState = false;
    originalVideoWidth = null;
    peopleModal.classList.remove('video-expand');
    peopleModalVideo
      .querySelectorAll('[expand-video-btn]')
      .forEach((btn) => btn.setAttribute('aria-label', 'Expand video'));

    const gsap = window.gsap;
    if (gsap) {
      gsap.killTweensOf(peopleModalVideo);
      gsap.to(peopleModalVideo, {
        width: targetWidth !== null ? targetWidth : peopleModalVideo.getBoundingClientRect().width,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => gsap.set(peopleModalVideo, { clearProps: 'width' }),
      });
      animateModalVideoPanelOut();
    } else {
      peopleModalVideo.style.width = '';
    }
  }

  function toggleVideoExpand() {
    if (videoExpandedState) {
      shrinkVideo();
    } else {
      expandVideo();
    }
  }

  // Keyboard + screen-reader support: these controls are plain divs in the
  // Webflow markup (no role/tabindex/label), so tag them each time the modal's
  // content is (re)loaded.
  function enhanceAccessibility() {
    const tag = (el, label) => {
      if (!el) return;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      if (label) el.setAttribute('aria-label', label);
    };
    peopleModal
      .querySelectorAll('[video-toggle-btn]')
      .forEach((el) =>
        tag(el, el.getAttribute('data-state') === 'playing' ? 'Pause video' : 'Play video')
      );
    peopleModal.querySelectorAll('[expand-video-btn]').forEach((el) => tag(el, 'Expand video'));
    tag(peopleModal.querySelector('#return-btn'), 'Return to profile view');
    tag(peopleModal.querySelector('#modal-close-btn'), 'Close');
  }

  function stopModalVideo() {
    const peopleModalVideo = peopleModal.querySelector('[people-modal-video]');
    if (peopleModalVideo && window.gsap) window.gsap.killTweensOf(peopleModalVideo);
    const videoEl = peopleModalVideo && peopleModalVideo.querySelector('.video-element');
    if (videoEl) videoEl.pause();
    const { modalVideoPanel, children } = getModalVideoRevealTargets();
    if (window.gsap && modalVideoPanel) window.gsap.killTweensOf([modalVideoPanel, ...children]);

    if (modalVideoEventCleanup) {
      modalVideoEventCleanup();
      modalVideoEventCleanup = null;
    }
    if (modalVideoCleanup) {
      modalVideoCleanup();
      modalVideoCleanup = null;
    }
    videoExpandedState = false;
    originalVideoWidth = null;
    peopleModal.classList.remove('video-expand');
  }

  // Name the dialog after the person: the injected heading whose text also
  // appears on the card that opened it (the content also has an unrelated
  // quote heading, so "first heading" would be wrong).
  function labelDialog(trigger) {
    const cardText = (trigger?.textContent || '').replace(/\s+/g, ' ');
    const nameHeading = Array.from(
      peopleModal.querySelectorAll('#modal-container h1, #modal-container h2, #modal-container h3')
    ).find((h) => {
      const text = h.textContent.replace(/\s+/g, ' ').trim();
      return text && cardText.includes(text);
    });
    if (nameHeading) {
      if (!nameHeading.id) nameHeading.id = 'people-modal-name';
      peopleModal.setAttribute('aria-labelledby', nameHeading.id);
      peopleModal.removeAttribute('aria-label');
    } else {
      peopleModal.removeAttribute('aria-labelledby');
      peopleModal.setAttribute('aria-label', 'Profile');
    }
    return nameHeading || null;
  }

  // Move focus into the dialog: onto the person's name (so screen readers
  // start at the top of a long bio), else the first control, else the dialog.
  function focusDialog(nameHeading) {
    requestAnimationFrame(() => {
      if (!peopleModal.classList.contains('open')) return;
      let target = nameHeading || getInitialFocusTarget(peopleModal) || peopleModal;
      if (target === nameHeading || target === peopleModal) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (!peopleModal.contains(document.activeElement)) {
        target = peopleModal;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  function openModal(containerHTML, trigger) {
    // A previous person's player may still be running (RAF loop, listeners) if
    // this fires without an intervening closeModal() - tear it down first so
    // instances never pile up.
    stopModalVideo();

    const wasOpen = peopleModal.classList.contains('open');
    if (!wasOpen) {
      const active = document.activeElement;
      returnFocusTo = trigger || (active && active !== document.body ? active : null);
      lockPageScroll();
    }

    const modalContainer = peopleModal.querySelector('#modal-container');
    if (modalContainer) modalContainer.innerHTML = containerHTML;
    peopleModal.inert = false;
    peopleModal.classList.add('open');
    const nameHeading = labelDialog(trigger);

    const modalVideoEl = peopleModal.querySelector('[people-modal-video]');
    if (modalVideoEl) {
      initSectionVideoPlayer({ rootElements: [modalVideoEl] }).then((cleanup) => {
        modalVideoCleanup = cleanup;
      });

      const videoEl = modalVideoEl.querySelector('.video-element');
      if (videoEl) {
        const onPlay = () => {
          if (!videoEl.loop) {
            modalVideoEl.classList.add('video-start');
            // Playing in the ~200px sidebar is a poor viewing experience, and
            // the name/quote header (.modal-video) only shows once expanded -
            // pressing play is the point at which the user commits to watching.
            expandVideo();
          }
          modalVideoEl
            .querySelectorAll('[video-toggle-btn]')
            .forEach((btn) => btn.setAttribute('aria-label', 'Pause video'));
        };
        const onStop = () => {
          modalVideoEl.classList.remove('video-start');
          modalVideoEl
            .querySelectorAll('[video-toggle-btn]')
            .forEach((btn) => btn.setAttribute('aria-label', 'Play video'));
        };
        videoEl.addEventListener('play', onPlay);
        videoEl.addEventListener('pause', onStop);
        videoEl.addEventListener('ended', onStop);
        modalVideoEventCleanup = () => {
          videoEl.removeEventListener('play', onPlay);
          videoEl.removeEventListener('pause', onStop);
          videoEl.removeEventListener('ended', onStop);
        };
      }
    }

    enhanceAccessibility();
    focusDialog(nameHeading);
  }

  // skipHistory: true when called from the popstate handler below — the URL
  // already changed (the browser did it via back/forward), so pushing again
  // would fight the navigation instead of following it.
  function closeModal({ skipHistory = false } = {}) {
    loadSeq += 1; // drop any open still in flight
    setLoadingTrigger(null);
    currentSlug = null;
    const wasOpen = peopleModal.classList.contains('open');
    const focusWasInside = peopleModal.contains(document.activeElement);
    stopModalVideo();
    peopleModal.classList.remove('open');
    peopleModal.inert = true;
    // Restore focus BEFORE clearing the content — clearing deletes the focused
    // close button, which would otherwise drop focus to <body>.
    if (focusWasInside && returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
    if (wasOpen) unlockPageScroll();
    const modalContainer = peopleModal.querySelector('#modal-container');
    if (modalContainer) modalContainer.innerHTML = '';

    if (skipHistory) return;
    if (history.state?.peopleModalSlug) {
      // The open pushed this entry — step back to the list entry instead of
      // pushing a new one, so Back after closing leaves the page rather than
      // replaying the profile. (The popstate this fires finds the modal
      // already closed and does nothing.)
      history.back();
    } else if (window.location.pathname !== listPagePath) {
      history.pushState({ peopleListPage: true }, '', listPageUrl);
    }
  }

  function setLoadingTrigger(trigger) {
    if (loadingTrigger) {
      loadingTrigger.classList.remove('is-loading');
      loadingTrigger.removeAttribute('aria-busy');
    }
    loadingTrigger = trigger;
    if (trigger) {
      trigger.classList.add('is-loading');
      trigger.setAttribute('aria-busy', 'true');
    }
  }

  // The profile couldn't be loaded in place — go to the person's own page
  // (what the card stands for anyway) rather than leaving the click dead.
  // From Back/Forward the address bar already shows that URL, so replace.
  function openProfilePage(slug, { replace = false } = {}) {
    const url = `/people/${slug}`;
    if (replace) window.location.replace(url);
    else window.location.assign(url);
  }

  async function fetchPeopleContent(slug) {
    if (peopleCache[slug]) return peopleCache[slug];

    const res = await fetch(`/people/${slug}`);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const content = doc.querySelector('[people-modal-container]');

    if (content) {
      peopleCache[slug] = content.innerHTML;
      logger.log(`People content fetched: ${slug}`);
    }

    return peopleCache[slug] || null;
  }

  // skipHistory: true when called from the popstate handler below (the URL
  // already reflects this slug via browser navigation, so don't push again).
  async function loadPeopleContent(slug, { skipHistory = false, trigger = null } = {}) {
    // Already showing this person (a double-click, or a re-click) — nothing to do.
    if (slug === currentSlug && peopleModal.classList.contains('open')) return;

    const seq = ++loadSeq;
    setLoadingTrigger(trigger);

    let content = null;
    try {
      content = await fetchPeopleContent(slug);
      if (!content) throw new Error('No [people-modal-container] in the fetched page');
    } catch (err) {
      logger.error(`[People modal] Failed to load "${slug}":`, err);
    }
    if (seq !== loadSeq) return; // superseded by a newer open, or closed meanwhile
    setLoadingTrigger(null);

    if (!content) {
      openProfilePage(slug, { replace: skipHistory });
      return;
    }

    // Back/forward opens have no clicked card — use this person's card on
    // the page, if any, for the dialog's name and the focus return target.
    const card = trigger || document.querySelector(`[data-people-name="${CSS.escape(slug)}"]`);
    openModal(content, card);
    currentSlug = slug;
    populateRichContent();

    // Swap the address bar to the person's own shareable URL without an
    // actual navigation — /people/{slug} is a real page (same one this
    // content was fetched from), so pasting/reloading it lands the visitor
    // straight on the person's page instead of the empty list.
    if (!skipHistory) {
      const url = `/people/${slug}`;
      if (history.state?.peopleModalSlug) {
        // Switching person while the modal is open: swap the entry rather than
        // stacking one per person, so one Back (or close) returns to the list.
        history.replaceState({ peopleModalSlug: slug }, '', url);
      } else {
        listPageUrl = window.location.pathname + window.location.search + window.location.hash;
        history.pushState({ peopleModalSlug: slug }, '', url);
      }
    }
  }

  // Keyboard users get the same prefetch-on-approach benefit hover gives mouse
  // users — focusin bubbles, so this is one listener, not one per card.
  document.addEventListener(
    'mouseenter',
    function (e) {
      if (!(e.target instanceof Element)) return;

      const trigger = e.target.closest('[data-people-name]');
      if (!trigger) return;

      const slug = trigger.getAttribute('data-people-name');
      // A failed prefetch is retried (and reported) by the click itself.
      if (slug) fetchPeopleContent(slug).catch(() => {});
    },
    true
  );

  document.addEventListener('focusin', function (e) {
    if (!(e.target instanceof Element)) return;

    const trigger = e.target.closest('[data-people-name]');
    if (!trigger) return;

    const slug = trigger.getAttribute('data-people-name');
    if (slug) fetchPeopleContent(slug).catch(() => {});
  });

  document.addEventListener('click', function (e) {
    if (!(e.target instanceof Element)) return;

    const trigger = e.target.closest('[data-people-name]');
    if (trigger) {
      const slug = trigger.getAttribute('data-people-name');
      if (!slug) return;

      loadPeopleContent(slug, { trigger });
      return;
    }

    if (e.target.closest('#modal-close-btn, .modal-close-overlay')) {
      closeModal();
      return;
    }

    if (peopleModal.classList.contains('open')) {
      if (e.target.closest('[expand-video-btn]')) {
        toggleVideoExpand();
        return;
      }

      if (e.target.closest('#return-btn')) {
        shrinkVideo();
        return;
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    // Keep Tab inside the open modal (aria-modal alone doesn't stop Tab from
    // walking into the page behind the overlay).
    if (e.key === 'Tab' && peopleModal.classList.contains('open')) {
      trapTabKey(e, peopleModal);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') {
      if (e.key === 'Escape' && peopleModal.classList.contains('open')) closeModal();
      return;
    }
    if (!(e.target instanceof Element)) return;

    // The grid trigger opens the modal, so it has to work whether or not the
    // modal is already open; everything else here lives inside it.
    if (e.target.closest('[data-people-name]')) {
      e.preventDefault();
      e.target.click();
      return;
    }

    if (!peopleModal.classList.contains('open')) return;
    if (!e.target.closest('[video-toggle-btn], [expand-video-btn], #return-btn, #modal-close-btn'))
      return;

    // These are divs with role="button", not native buttons - keydown
    // wouldn't otherwise activate them, and native buttons scroll on Space.
    e.preventDefault();
    e.target.click();
  });

  // Back/forward buttons: a state carrying a slug means the browser navigated
  // to that person's pushed URL — open (or switch to) them; no state (or a
  // state marking the list page) means it navigated back to the list — close.
  window.addEventListener('popstate', (e) => {
    const slug = e.state?.peopleModalSlug;
    if (slug) {
      loadPeopleContent(slug, { skipHistory: true });
    } else if (peopleModal.classList.contains('open')) {
      closeModal({ skipHistory: true });
    }
  });
}
