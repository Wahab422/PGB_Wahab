# SCL front-end audit

**Date:** 2026-09-25
**Code audited:** `main` @ `b645207` ("Follow up"). The working tree was clean.
**Live site checked:** https://vovi-scl.webflow.io. It serves a bundle byte-for-byte the same size as a local build of HEAD (297,083 B), so what's live is this commit.
**Changes made:** none at audit time.
**Update (same day):** quick wins 1–6 and 8–11 are now applied in the working tree (not committed). Each was built, linted and checked on staging pages running the local build. #7 is a Webflow Designer task. See §2 for the adjusted #8.

**How to read the findings:**

- **Confirmed** means I traced the code path. **Live** means I also saw it on the staging site. **Suspected** means it needs a runtime check, which I name.
- File references use `path:line` against `b645207`.
- Effort: **S** is ≤ 30 min, **M** is ≤ half a day, **L** is more.

---

## 0. Orientation

|                     |                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What this is**    | A vanilla-JS enhancement layer for a **Webflow-hosted** site (UT Austin School of Civic Leadership). Webflow owns the HTML/CSS; this repo adds behaviour through `data-*` / custom attributes.                                                                                                                            |
| **Framework**       | None. No React, so the React-specific checks (keys, memo, effects) don't apply. I mapped them to their vanilla equivalents: listeners, observers, rAF loops, DOM writes.                                                                                                                                                  |
| **Language**        | Plain JS (ES2020 target). No TypeScript; `jsconfig.json` has `"checkJs": false`.                                                                                                                                                                                                                                          |
| **Build**           | esbuild **0.19.12** via `bin/build.js`. It produces **one IIFE** (`format: 'iife'`, `splitting: false`), minified, with `drop: ['console','debugger']` in production.                                                                                                                                                     |
| **Package manager** | Three are in play: `pnpm-lock.yaml` (Vercel uses `pnpm install`), `package-lock.json`, and `webflow-deploy.json` (`bun install`). `node_modules` is pnpm (pnpm 11.10, Node 24.18).                                                                                                                                        |
| **Router**          | `src/index.js:12-48`: a `data-page` attribute on `<body>` or `<html>` → a lookup table of 30 page modules. It uses dynamic `import()`, but the IIFE build inlines every page (§3.1 P1).                                                                                                                                   |
| **State**           | Module-level variables per component. No store.                                                                                                                                                                                                                                                                           |
| **Styling**         | Webflow CSS, plus `src/index.css` (99 lines) and CSS injected by JS (e.g. `accordion.js:95-154`).                                                                                                                                                                                                                         |
| **Runtime libs**    | Bundled: **GSAP 3.12.5 + ScrollTrigger** (on `window`), **@studio-freight/lenis 1.0.42**.<br>From CDN at runtime: **Embla** (unpinned), **pdf.js 3.11.174** (mobile only), **Mapbox GL 3.4.0** (contact page).<br>Loaded by Webflow outside this repo: jQuery 3.5.1, Finsweet Attributes v2, GTM/GA4, Lottie (home only). |
| **Tests / CI**      | **None.** No test runner, no `.github/`, no CI config.                                                                                                                                                                                                                                                                    |
| **Lint**            | ESLint 8.57 flat config + Prettier. **`pnpm lint` fails today** with 116 problems (§3.3 B4).                                                                                                                                                                                                                              |
| **Deploy**          | Vercel serves `dist/`. Webflow loads `<script src="https://scl-nine-smoky.vercel.app/" defer>`: the **root URL**, not `/index.js`, answered with the JS bundle by config that isn't in this repo (§3.4 C9).                                                                                                               |
| **Entry points**    | `src/index.js` (JS) and `src/index.css`. `src/index.html` is not an entry; it's a leftover (§3.4 C5).                                                                                                                                                                                                                     |

**Hot paths (weighted accordingly):**

- **Every page:**
  - `src/global/index.js` runs skip link, Lenis (a rAF loop for the life of the page), `navbar.js`, footer, both load-more components, nest, image download, `modal-basic`, the PDF link modal and viewer, video fullscreen, share links, accordion, rich list, mirror text, and GSAP global reveals. That's **62 ScrollTrigger instances on home**, 58 on a major page, 47 on people/contact and 37 on news (measured live).
  - `tabs.js` then runs.
- **Most pages:**
  - `initCarousel()` is called by **21 of 30** page modules.
  - `sectionVideoPlayer` runs on 9 pages plus the people modal.
  - `testimonialsCustomSlider` runs on 9 pages, `regularVideoPlayer` on 5, and `listVideos` on home and people.
  - `handlePeopleModal` runs on people, the Ackerman program page and seminars.
- **Critical render path:**
  - The bundle is `defer` at the end of `<body>`, so it doesn't block parsing, but all behaviour waits for it.
  - `index.css` is a `<link rel=stylesheet>` in `<head>` from the Vercel origin (preconnected).

---

## 1. Summary

1. **Overall health:**
   - **Strengths:** careful, heavily commented code with a lot of recent accessibility work. Skip link, accordion, tabs keyboarding, the PDF viewer and the section video player are genuinely good.
   - **Gaps:** that work stops at the edges. On the live site several core controls still can't be used from a keyboard, and production has zero error visibility.
2. **Fix first: keyboard blockers.**
   - The mobile/tablet **"Menu" button and panel "Back" are `<div>`s**; this also hits desktop users zoomed to ~150–200%.
   - **Closed modals stay in the Tab order**, and 6 of 7 modals on /news open only by mouse.
   - The **people modal** has no focus handling.
   - **Tabs built from CMS lists** fail axe critical checks.
   - **Two of the three video players** are click-only.
3. **Fix first: silent failure.**
   - **Embla loads from jsDelivr with no version pin while v9 is at RC.** When v9 ships, every carousel can break without a deploy.
   - The production build strips `console.error`.
   - Page code runs only if a Designer-set `data-page` matches the lookup table. **One live major page has no `data-page`, so its carousel and video never start.**
4. **Fix first: motion.**
   - The home autoplay carousel and marquee, the video preview loops and the Life-at-SCL traditions rotate **with no pause control** (WCAG 2.2.2, Level A).
   - Lenis, global reveals and parallax **ignore `prefers-reduced-motion`**.
5. **Performance is acceptable but not "minimal".**
   - One **290 KiB min / 87 KiB brotli** bundle (38% GSAP, ~29% page-only code shipped everywhere), revalidated on every view.
   - The real runtime costs are rAF loops that never idle, preview videos playing off-screen, and eager Mapbox on /contact.

---

## 2. Quick wins (high impact, ≤ 30 min each)

| #   | Change                                                                                                                                                                                                                                                                         | Where                                                       | Fixes                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Pin Embla: `embla-carousel@8.6.0/embla-carousel.umd.js`                                                                                                                                                                                                                        | `src/utils/jsdelivr.js:34-35`                               | B1: carousels breaking when v9 becomes `latest`          |
| 2   | Set `modal.inert = true` when closed and `false` when open, next to the existing `aria-hidden` writes                                                                                                                                                                          | `src/components/modal-basic.js:344-346`, `:423-425`, `:550` | A2 (axe `aria-hidden-focus` ×7 on /news, ×1 on /contact) |
| 3   | In `applyTablistRole`, also set `role="none"` on every element between the tablist and each tab (the Webflow `w-dyn-item` `role="listitem"` wrappers)                                                                                                                          | `src/components/tabs.js:838-844`                            | A5 (axe critical ×15 on /majors/major-in-civics-honors)  |
| 4   | Upgrade `[data-nav-open]` and `[navbar-menu-panel-back]` to `role="button"` + `tabindex="0"` + Enter/Space, and set `aria-expanded` on open/close. Reuse the pattern already in `lenis.js:175-178` + `:311-317`.                                                               | `src/global/navbar.js:233-235`, `:272-284`                  | A1                                                       |
| 5   | Same upgrade for non-interactive `[data-modal-target]` triggers. Stop putting `aria-pressed` on them.                                                                                                                                                                          | `src/components/modal-basic.js:572-595`, `:683`, `:695`     | A3, A-low                                                |
| 6   | Keep errors in production: `drop: DEV_MODE ? [] : ['debugger']` plus `pure: ['console.log','console.info','console.debug']`                                                                                                                                                    | `bin/build.js:29`                                           | C1                                                       |
| 7   | In Webflow: add `data-page` to /majors/major-in-civics-honors (its sibling /majors/major-in-great-books-honors uses `majors`). Decide what `data-page="catch-all"` on /apply-now should map to.                                                                                | Webflow page settings                                       | B2 (carousel + video dead on that page)                  |
| 8   | Stop toggling `aria-hidden` on `#map-wrap`. Make `.map-content` inert **only when collapsed at ≥768 px**. Below 768 px it's the always-visible location list and must stay interactive; that was verified live, and the original "always inert" idea would have broken phones. | `src/pages/contact.js:70`, `:76`                            | A8                                                       |
| 9   | People modal: add a request token so a slower earlier fetch can't overwrite a newer one                                                                                                                                                                                        | `src/functions/handlePeopleModal.js:260-283`                | C2                                                       |
| 10  | Delete the unexplained 100 ms sleep that delays all page-specific init (check nothing visibly depends on it)                                                                                                                                                                   | `src/global/index.js:90`                                    | P8                                                       |
| 11  | `innerText` → `textContent` in the rich-list loop (forced layout per `<li>`)                                                                                                                                                                                                   | `src/functions/populateRichList.js:52`                      | P9                                                       |

---

## 3. Findings

### 3.1 Performance

**Measured (production build, same config as `bin/build.js`, output to a scratch folder):**

| Output      | Minified                  | gzip -9  | brotli   |
| ----------- | ------------------------- | -------- | -------- |
| `index.js`  | **297,083 B (290.1 KiB)** | 99,653 B | 86,657 B |
| `index.css` | 2,952 B                   | –        | –        |

- **GSAP share:** core 50.5 + ScrollTrigger 33.3 + CSSPlugin 18.2 + Observer 8.6 = **110.6 KiB (38%)**.
- **Lenis:** 11.2 KiB.
- **Largest own modules:** `carousel.js` 20.1, `tabs.js` 12.0, `sectionVideoPlayer.js` 11.2, `gsap.js` 8.3, `pdfViewer.js` 8.2, `accordion.js` 7.4, `modal-basic.js` 7.4 KiB.
- **Page-only code:** 85.6 KiB is reachable only from page modules (excluding Lenis, which is dynamically imported but used on every page).

#### P1 · Every page downloads and parses every page's code: **Medium** · Confirmed (build + metafile)

- **Where:** `bin/build.js:22` `format: 'iife',` and `:27` `splitting: false, // IIFE doesn't support splitting`, against the lazy table in `src/index.js:12-48` (`home: () => import('./pages/home')…`).
- **Evidence:** esbuild turns each `import()` into `Promise.resolve().then(() => (init_x(), x_exports))` (I grepped the output: 0 real `import(` calls remain).
  - Page-only code that a page does **not** need: home's own page-only closure is 52.3 KiB, about 31.8, news 20.4, article 20.5, contact 6.2.
  - Contact therefore ships ~80 KiB min (~25 KiB brotli) it never runs.
- **Symptom:** extra download, parse and compile on mobile for every page. The README's "loads page-specific code" and "minimal bundle size" claims aren't what ships.
- **Fix:**
  1. Build: `format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]'`.
  2. Webflow: `<script type="module" src="…/index.js">`.
  3. Vercel headers: `Access-Control-Allow-Origin: *` on `/chunks/(.*)`, because module scripts cross-origin need CORS; `Cache-Control: public, max-age=31536000, immutable` on hashed chunks.
- **Tension:** a single IIFE is simple and was clearly deliberate. The honest payoff is 20–80 KiB min per page, plus cacheable chunks. **Do it together with P2, not alone.**
- **Effort:** M.

#### P2 · The script and stylesheet are revalidated on every page view: **Medium** · Confirmed (config + live headers)

- **Where:** `vercel.json:11-14`, the same rule for `/index.css` at `:25-28`:

  ```json
  "key": "Cache-Control",
  "value": "public, max-age=0, must-revalidate"
  ```

  - The live root URL that Webflow actually loads returns the same header.

- **Why it costs:**
  - Each navigation makes a conditional request before the 297 KB bundle can run.
  - Worse, `index.css` is a render-blocking `<link>` in `<head>`, so its revalidation round trip sits in front of first paint on every page. A preconnect exists, which helps.
  - In my session the script request took ~2.8 s start to end on a cold load and the CSS ~1.2 s. That's anecdotal network and not representative, but it shows these requests are on the critical path.
- **Fix:**
  - **With P1:** keep the entry at `max-age=0` but tiny, and mark the hashed chunks immutable.
  - **Without P1:** `public, max-age=300, stale-while-revalidate=86400`. Deploys show within 5 min; Safari ignores SWR and falls back to max-age.
  - **Optionally:** move the 80 lines of `index.css` into Webflow site-wide `<style>` so first paint has no second-origin dependency.
- **Tension:** `max-age=0` gives instant deploy visibility with an unversioned URL. That's a real product need; pick a staleness window deliberately.
- **Effort:** S.

#### P3 · Scroll-reveal content is hidden by JS after first paint (FOUC guard commented out): **Medium** · Confirmed (code) / Suspected (visible flash, LCP)

- **Where:** `src/components/gsap.js:348-353`:

  ```js
  gsap.set(elements, {
    // y: '1.75rem',
    // x: '0',
    opacity: 0,
  ```

  - The guard that would pre-hide these elements is commented out at `gsap.js:68-88`. Its own comment says the element "paints fully visible, then blinks out the moment GSAP applies its hidden from-state."
  - Init is also serialized behind the 100 ms sleep (P8).

- **Symptom:** above-the-fold `[anim-element]` / `.anim-element` content (and `[anim-stagger]` children, `:294-297`) appears, vanishes when the bundle runs, then fades back after a 0.25 s delay plus 0.75 s. If the LCP element is one of them, LCP moves to the end of the fade.
- **Runtime check:** a Performance recording on a throttled mobile profile. I couldn't get paint/LCP entries from the embedded browser (see "What I couldn't verify").
- **Fix:** don't hide elements already in the viewport at init. Check `getBoundingClientRect().top < innerHeight` once for the batch and skip their `opacity:0`. Or restore the guard as an inline `<style>` in Webflow `<head>` with the existing 5 s failsafe.
- **Effort:** S–M.

#### P4 · rAF loops that never idle; progress bars animate `width`: **Medium** · Confirmed

- **Where:**
  - `src/components/carousel.js:803` `fill.style.width = \`${progress}%\`;`runs every frame, plus three`setAttribute`s (`:805-811`).
  - Marquee `:548` `rafId = requestAnimationFrame(tick);` reschedules even while paused, and under reduced motion (`:542`).
  - Neither loop pauses off-screen or in a hidden tab.
  - Same `width` pattern at `tabs.js:459` (`transition: width ${ms}ms linear`), `accordion.js:150-153` (keyframes on `width`), and the video progress bars (`sectionVideoPlayer.js:270`, `regularVideoPlayer.js:168`, `listVideos.js:369`).
- **Live:** home has an autoplay carousel and a marquee.
- **Symptom:** style, layout and paint every frame for the life of the page, competing with Lenis and ScrollTrigger during scroll. That means jank and battery drain on phones.
- **Fix:**
  - Carousel progress: `fill.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}], {duration, easing:'linear'})` with `transform-origin:left`. `pause()`/`play()` then give you hover-resume for free.
  - Write the `data-*` attributes once per slide.
  - Add one IntersectionObserver per autoplay/marquee slider, and stop the marquee loop while paused.
- **Effort:** M.

#### P5 · Preview videos download and play off-screen, ahead of the hero: **Medium** · Confirmed

- **Where:**
  - `src/functions/sectionVideoPlayer.js:1036` `startPreview();` starts every looping preview at init. Its only observer is for zoom.
  - `listVideos.js:352` `obs.unobserve(entry.target);` means a loop never pauses after its first appearance.
  - `regularVideoPlayer.js` pauses off-screen but never resumes previews.
  - `home.js:214-227` deliberately delays the hero video until idle, but section previews start at init and win the bandwidth.
- **Symptom:** mobile data and decode spent on videos nobody is looking at, including ones inside closed modals.
- **Fix:** one shared observer: in view → set `src` if needed and play the preview; out of view → pause the preview. Keep "don't pause the main video" as is.
- **Effort:** M.

#### P6 · Full-page HTML fetched and parsed on hover, and for every nest placeholder: **Medium** · Confirmed

- **People modal:**
  - `handlePeopleModal.js:291-300` prefetches on every `mouseenter` (capture) and `focusin`, with no hover intent.
  - The cache stores only the resolved value (`:240`, `:251`), so a hover-then-click fetches twice.
  - Each fetch downloads a whole Webflow page and runs `DOMParser` on the main thread (`:242-248`).
- **Nest:** `src/components/nest.js:89-112` fetches every `[data-nest-target]` source page on load, with no viewport gating or concurrency cap. It is de-duplicated per URL, which is good.
- **Symptom:** sweeping a 40-card grid starts about 40 full-page fetches and parses.
- **Fix:**
  - Cache the promise, and delete it on rejection.
  - Add a ~100 ms hover-intent timer.
  - Use `fetch(url, { priority: 'low' })` for prefetches.
  - Gate nest placeholders with `observeInView`.
- **Effort:** S.

#### P7 · Mapbox GL is loaded eagerly on /contact with no fallback: **Medium** · Confirmed

- **Where:**
  - `src/pages/contact.js:110` is a module-scope IIFE that injects Mapbox v3.4.0 CSS and JS (`:114-115`, `:139-146`) and runs `new mapboxgl.Map({ container: 'map', … antialias: true })` (`:152-160`), whether or not the map is ever scrolled to.
  - Every view is a billed map load.
- **Fix:** wrap it in `initMap()` behind `observeInView(mapEl, initMap, { rootMargin: '400px 0px' })`, load it with `loadScript`, and drop `antialias`. The fallback is covered in C3.
- **Effort:** M.

#### P8 · Artificial 100 ms sleep delays all page-specific init: **Low** · Confirmed

- **Where:** `src/global/index.js:90` `await new Promise((resolve) => setTimeout(resolve, 100));`.
  - `src/index.js:64` does `await initGlobal()` before any page module runs, so carousels, videos and the people modal all start ≥ 100 ms later, after every global animation is wired.
  - There's no comment explaining why.
- **Fix:** delete it, or document what it's waiting for (Webflow IX? Finsweet?) and wait for that signal instead.
- **Effort:** S.

#### P9 · Layout thrash in the rich-list expansion: **Low** · Confirmed

- **Where:** `src/functions/populateRichList.js:51-56`:

  ```js
  items.forEach((li) => {
    if (isEmptyText(li.innerText || li.textContent || '')) return;
    …
    list.insertBefore(clone, itemTemplate);
  ```

  - `innerText` forces layout, and each `insertBefore` invalidates it again, so there's one forced layout per `<li>` on page init.

- **Fix:** use `textContent`.
- **Effort:** S.

#### P10 · Each people-modal open creates new IntersectionObservers for the whole page: **Low** · Confirmed

- **Where:**
  - `handlePeopleModal.js:275` `applyBorderAnimation();` → `gsap.js:893` `document.querySelectorAll(BORDER_SELECTOR)` → `observeInView` per element.
  - `helpers.js:179` creates a new observer each time.
  - Already-animated elements aren't skipped, and observers for removed modal content are never disconnected.
- **Symptom:** the observer count grows with every profile viewed. This is the only real "leak" found; the site does full page loads, so the other teardown gaps don't matter.
- **Fix:** `applyBorderAnimation(root = document)`, skip `.border-animate`, and use one shared observer per `rootMargin`.
- **Effort:** S.

**Low, batched** (all Confirmed, all S):

- **`applyScrollToAriaLabels` on every resize event:** it re-queries, measures and writes attributes every resize frame (`lenis.js:188-195`). Debounce it.
- **Lenis and GSAP run separate rAF loops:** Lenis's loop (`lenis.js:387-392`) is not synced with GSAP. The standard wiring is `lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0)`. Scrubbed parallax (`gsap.js:473`, `scrub: 0.2`) masks most of the one-frame lag. Suspected, low value alone; do it with the Lenis upgrade (B3).
- **Video scrubbing:**
  - It reads `getBoundingClientRect()` right after writing `width` and seeks on every `mousemove` (`sectionVideoPlayer.js:270`, `:287`, `:315`; same in the other two players).
  - Fix: measure once at drag start, and apply one seek per frame.

---

### 3.2 Accessibility (WCAG 2.2 AA)

#### A. Automated results: axe-core 4.10.2 on the live staging site

Rule sets: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`. Axe was injected in the browser; nothing was added to the repo.

| Page                               | Violations (impact · rule · count)                                                                                                                                                                                                                               | Source                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **/**                              | serious `target-size` ×3 · moderate `heading-order` ×2 · critical `input-button-name` ×1 · serious `scrollable-region-focusable` ×1                                                                                                                              | Webflow markup; `navbar-menu-panel` is empty until `navbar.js` fills it |
| **/people**                        | critical `input-button-name` · serious `scrollable-region-focusable` · moderate `heading-order`                                                                                                                                                                  | Webflow                                                                 |
| **/contact**                       | serious **`aria-hidden-focus` ×1 (`#modal-1`)** · serious `link-name` ×5 (social icons) · critical `input-button-name` · serious `scrollable-region-focusable` · moderate `heading-order`                                                                        | **repo (`modal-basic`)** + Webflow                                      |
| **/majors/major-in-civics-honors** | critical **`aria-required-parent` ×14** · critical **`aria-required-children` ×1 (`.lead-tab-btns-grid`)** · serious `link-name` ×2 · serious `target-size` ×5 · critical `input-button-name` · serious `scrollable-region-focusable` · moderate `heading-order` | **repo (`tabs.js`)** + Webflow                                          |
| **/news**                          | serious **`aria-hidden-focus` ×7 (`#modal-1`…)** · critical **`aria-allowed-attr` ×6 (`div[data-modal-target]`)** · serious `target-size` ×3 · critical `input-button-name` · serious `scrollable-region-focusable` · moderate `heading-order`                   | **repo (`modal-basic`)** + Webflow                                      |

- **Correction:** the runs above happened while the browser pane was hidden (0 px viewport), so axe couldn't evaluate `color-contrast`.
  - Re-running /news at 1280 px found **serious `color-contrast` ×14**, all Webflow colours at ~11.5 px text:
    - brand orange `#ce4f00` on white or white on orange: **4.42:1** (needs 4.5:1)
    - grey `#898881` on white: **3.55:1**
    - orange on beige `#eeece3`: **3.74:1**
  - Other pages likely have the same failures. See §3.2 C.
- **Also measured live:** all 40 `<img>`s on home have `alt`, 28 are `loading="lazy"`, and **0 of 40 have `width`/`height` attributes**. Fonts use `font-display: swap`; videos use `preload="none"`.
- **Keyboard spot check (real Tab presses on home):** the skip link, logo, the five `.menu-btn`s, Apply Now and search all showed the browser's default focus ring (`outline: auto`). That's despite the global ring being commented out (A16).

#### B. Manual findings

##### A1 · The mobile/tablet menu can't be opened or navigated from the keyboard: **Critical** · Confirmed (code + live)

- **Where:** `src/global/navbar.js:233-235`:

  ```js
  const onNavOpenClick = () => {
    navWrap.classList.toggle(NAV_OPEN_CLASS);
  };
  ```

  - Only `click` is bound (`:280`, `:283`).
  - Live markup: `<div data-nav-open="" class="nav-btn is-secondary">…Menu…` (no role, tabindex or `aria-expanded`). The panel Back control `[navbar-menu-panel-back]` is also a `<div>`.
  - Nothing moves focus into the panel, handles Escape, or returns focus on close.

- **Symptom:** below 991 px, keyboard, switch and voice-control users can't reach site navigation. That includes desktop users zoomed to ~150–200%. Screen readers hear no button and no state. WCAG 2.1.1, 4.1.2 (A); 1.4.10.
- **Fix:**
  - Follow the repo's own convention (`lenis.js:175-178`, `sectionVideoPlayer.js:59-74`): give non-native controls `role="button"`, `tabindex="0"` and an Enter/Space bridge.
  - Set `aria-expanded` and `aria-controls` on `[data-nav-open]`.
  - On open, move focus to the first menu item. Escape closes and returns focus. Category click focuses the panel header; Back returns focus to the category button.
- **Effort:** S–M.

##### A2 · Closed modals remain focusable: **High** · Confirmed (code + live + axe)

- **Where:**
  - `src/components/modal-basic.js:423-425` (close) and `:550` (init) set only `aria-hidden="true"`:
    ```js
    modal.setAttribute('data-modal-status', STATUS_INACTIVE);
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    ```
  - Live, a closed `#modal-1` on /news is `display:flex; opacity:0; pointer-events:none; visibility:visible`, and not inert.
- **Symptom:** Tab walks into invisible modal content, where screen readers announce nothing (axe `aria-hidden-focus`: 7 on /news, 1 on /contact). WCAG 2.4.3, 4.1.2.
- **Fix:** mirror `navbar.js:104`: `modal.inert = !open`.
- **Effort:** S.

##### A3 · Six of the seven modals on /news open only with a mouse: **High** · Confirmed (live + axe)

- **Where:** `src/components/modal-basic.js:585-594` adds `aria-controls`, `aria-haspopup` and `aria-expanded` to whatever carries `[data-modal-target]`.
  - Live, the Forum issue triggers (Spring 2026 … Summer 2024) are empty overlay divs: `<div data-modal-target="spring-2026" class="anchor-link-overlay" aria-controls="modal-1" aria-haspopup="dialog" … aria-expanded="false"></div>`.
  - They have no role, tabindex or name, and there is no other keyboard path to those modals.
- **Symptom:** keyboard users can't open past Forum issues (2.1.1). Axe reports `aria-allowed-attr` ×6.
- **Fix:** in `enhanceTargetAccessibility`, upgrade non-`a`/`button` triggers the same way as A1. Take the name from the card heading or `data-modal-label`, or better, make the Webflow overlay a `<button>`.
- **Effort:** S.

##### A4 · The people modal has no dialog semantics, no focus handling and no scroll lock: **High** · Confirmed (code)

- **Where:**
  - Open is `src/functions/handlePeopleModal.js:181-183` (`modalContainer.innerHTML = containerHTML; peopleModal.classList.add('open');`).
  - Close is `:230-232`, which clears `innerHTML`.
  - The file never calls `.focus()`, never sets `role="dialog"`, `aria-modal` or `inert`, and never traps Tab. Escape does work (`:347`).
  - The cards are `role="button"` divs (`:14-17`) that actually navigate (`pushState` to `/people/{slug}`, `:282`).
- **Symptom:**
  - Enter on a card opens the modal silently, and Tab continues through the page behind it.
  - On close, the focused close button is deleted, so focus drops to `<body>`.
  - Ctrl/middle-click on a card can't open a profile in a new tab.
  - Scrolling was **refuted live**: the modal's scroll container already has `data-lenis-prevent` in the markup.
- **Fix:**
  - Reuse `modal-basic`'s `trapFocus` / `lockScroll` / focus restore (`modal-basic.js:618`, `:126`, `:461`), or move this modal to `<dialog>.showModal()` (B6).
  - Restore focus **before** clearing `innerHTML`.
  - Longer term, make the cards `<a href="/people/{slug}">` and intercept only plain left-clicks.
- **Effort:** M.

##### A5 · Tabs rendered from CMS lists fail required ARIA structure: **High** · Confirmed (live + axe)

- **Where:** `src/components/tabs.js:838-844` sets `role="tablist"` on the closest common ancestor (`:852-860`, `:873-874`):

  ```js
  const applyTablistRole = (el, fallbackLabel) => {
    if (!el) return;
    el.setAttribute('role', 'tablist');
  ```

  - Live on /majors/major-in-civics-honors: `.lead-tab-btns-grid.w-dyn-items[role=tablist] > DIV[role=listitem] > DIV[role=tab]`. The Webflow `listitem` wrappers now sit between the tablist and its tabs.

- **Symptom:** screen readers don't expose these as a tab set: no "tab 2 of 5", and arrow-key expectations are broken. Axe reports critical `aria-required-children` ×1 and `aria-required-parent` ×14. This is the gap left by commit `abf49db`.
- **Fix:** after picking the tablist, walk from each tab up to the tablist and set `role="none"` on each intermediate element. The same idea as the accordion's comment at `accordion.js:218-219`, applied in reverse.
- **Effort:** S.

##### A6 · The regular and list video players are click-only and unnamed: **High** · Confirmed (code)

- **Where:**
  - `src/functions/regularVideoPlayer.js:451-454`:
    ```js
    allToggleBtns.forEach((btn) => {
      btn.setAttribute('data-state', 'paused');
      addCleanup(btn, 'click', toggleVideo);
    });
    ```
  - `listVideos.js:618-621` is identical. `setBtnsState` never sets a name (`regularVideoPlayer.js:176`, `listVideos.js:377`).
  - Commit `480c212` fixed only `sectionVideoPlayer.js:1010-1021`, which is the pattern to copy.
- **Symptom:** on home, majors, biology, internal transfers, undergraduate studies and people, testimonial and list videos can't be played from a keyboard, and screen readers find nothing to press (2.1.1, 4.1.2).
- **Fix:** move `enhanceControlA11y` / `activateOnEnterOrSpace` into `src/utils/`, call it in both players, and set `aria-label` in both `setBtnsState`.
- **Effort:** S–M.

##### A7 · Moving content with no pause mechanism (WCAG 2.2.2, Level A): **High** · Confirmed (code + live)

- **Carousels:**
  - Pause is opt-in: `carousel.js:658` `const pauseOnHover = slider.hasAttribute('data-pause-on-hover');`. There is no rotation-control button anywhere, and autoplay starts at `:1308`.
  - The marquee pauses on mouse hover only (`:583-584`), and only if the attribute is set (`:490`).
  - **Live on home:** one `[data-carousel~=marquee]` and one `data-autoplay` carousel, **neither with `data-pause-on-hover`**.
- **Video preview loops:** `sectionVideoPlayer.js:896-902` autoplays muted loops by default. Pressing the toggle starts the full video rather than pausing the loop. `listVideos.js:333-337` and `regularVideoPlayer.js:475-477` do the same.
- **Life at SCL traditions:** `lifeAtSCL.js:133-134` has 5 s autoplay that pauses on mouse hover only (`:299-316`), never on focus, with no button.
- **Symptom:** content moves or changes indefinitely, and keyboard, touch and screen-reader users can't stop it.
- **Fix:**
  - Inject or wire a real Pause/Play `<button>` for any autoplay or marquee, and make the focus-within pause always on.
  - For video loops, provide a pause for the preview, or stop it after ~5 s.
- **Effort:** M.

##### A8 · The contact map hides its own controls from screen readers: **High** · Confirmed (code)

- **Where:** `src/pages/contact.js:76` `mapWrap.setAttribute('aria-hidden', 'true');` on close.
  - `#map-wrap` contains `#map-expand-btn` (`:65`) and `.map-controls` (zoom, `:95`), which stay focusable and clickable while collapsed.
- **Symptom:** after the first close, screen readers can't find the expand button, the zoom buttons or the map, while Tab still lands on them (4.1.2, 1.3.1).
- **Fix:** toggle `inert` (plus `aria-hidden`) on `.map-content` only.
- **Effort:** S.

##### A9 · Modal focus can fail silently, and the trap can leak: **Medium** · Confirmed (code + live)

- **Where:**
  - `src/components/modal-basic.js:599-600` `const target = focusable[0] || modal;`.
  - `getFocusableElements` (`:647-651`) filters only by the element's own `aria-hidden`/`disabled`. It doesn't check rendering, `<object>` fallback content, or ancestors.
- **Live on /news:** the first "focusable" in an open Forum modal is the fallback `<a>` inside the `<object>` PDF, which isn't rendered. `focus()` did nothing and `document.activeElement` stayed `<body>`.
- **Symptom:** focus stays behind the modal, and `trapFocus` (`:633-642`) compares against unfocusable first/last elements, so Tab escapes into the page.
- **Fix:**
  - Filter with `el.checkVisibility?.() !== false && !el.closest('object')`.
  - After focusing, check `modal.contains(document.activeElement)` and fall back to focusing the dialog (`tabindex="-1"`).
  - Every modal needs a focusable close button; the Forum modals have none.
- **Effort:** S.

##### A10 · `prefers-reduced-motion` is ignored by the site-wide motion systems: **Medium** · Confirmed

- **Where:**
  - Lenis smooth wheel and 1.2 s animated anchor scrolls: `lenis.js:372-384`, `:212`, and the native fallback `:215` `window.scrollTo({ top, behavior: 'smooth' });`.
  - Global GSAP reveals and **scrubbed parallax with scale 1.1**: `gsap.js:342-375`, `:458-476`.
  - Number counters: `gsap.js:742-788`.
  - Accordion CSS transition: `accordion.js:100`.
  - Video preview loops (A7).
  - Rotating text still rotates; only the slide is removed (`rotatingTexts.js:87-89`, `:143`).
  - Smooth `scrollTo` in `lifeAtSCL.js:89` and `contact.js:339`.
- **Already correct:** tabs, carousel autoplay, both load-mores, the home hero and lifeAtSCL autoplay. So the convention exists, but the global layer doesn't follow it.
- **Fix:**
  - One `prefersReducedMotion()` in `utils/`.
  - Skip Lenis under `reduce`.
  - Wrap global reveals and parallax in `gsap.matchMedia()` with a `reduce` branch that sets final states.
  - Pass `behavior: reduce ? 'auto' : 'smooth'` to native scrolls.
- **Effort:** M.

##### A11 · A user-stopped carousel autoplay restarts itself: **Medium** · Confirmed (code)

- **Where:**
  - `carousel.js:769-774` (`startProgressBar`) never checks `autoplayStoppedByInteraction`, and `onSelect` restarts it (`:1399-1401`).
  - `resume` ignores stop reasons (`:1299-1302`).
  - `aria-live` is set to `polite` on stop and never reset (`:1281`).
- **Symptom:**
  - After "stop on interaction", the next manual slide change restarts rotation forever, and screen readers announce every auto-advance.
  - A testimonial video can be cut off when hover/focus leaves (`testimonialsCustomSlider.js:180`).
- **Fix:** a set of stop reasons (`user`, `external`, `hold`) and a single `canRun()` gate.
- **Effort:** M.

##### A12 · The section player's hidden controls are still tabbable, and focus is dropped on state swaps: **Medium** · Confirmed (code)

- **Where:**
  - `sectionVideoPlayer.js:1003` `gsap.set(controlsGroup, { opacity: 0, pointerEvents: 'none' });` hides them visually while `:63` keeps them `tabindex="0"`.
  - The toggle you pressed becomes `display:none` (`:631`) and focus isn't moved.
- **Symptom:** Tab lands on an invisible "Play video" and "Return to preview", and focus is lost after Start/Return (2.4.3, 2.4.7).
- **Fix:** use `autoAlpha` / `inert` like `regularVideoPlayer.js:186`, and move focus between the overlay and controls toggles.
- **Effort:** S.

##### A13 · The contact map is mouse-only: **Medium** · Confirmed (markers) / Suspected (panel items)

- **Where:** markers are created as `<div>` (`contact.js:366`) with only `mouseenter`/`mouseleave`/`click` (`:400`, `:409`, `:414`). The file has no `keydown` handler, and Escape doesn't collapse the expanded map.
- **Fix:**
  - Build markers as `<button type="button" aria-label=…>`.
  - Mirror hover with `focus`/`blur`.
  - Escape → `onMapClose()`, and return focus to `#map-expand-btn`.
- **Effort:** M.

##### A14 · Load-more doesn't move focus; the button disappears while focused: **Medium** · Confirmed (code)

- **Where:**
  - `src/components/listloadmore.js:315-316` (`if (visibleCount >= items.length) { hideButton(button);`) runs on the focused button.
  - `basicListLoadMore.js:152` does the same, with no announcement at all.
  - New items are inserted **before** the button, so the next Tab skips them.
  - The live region in `listloadmore.js:268-290` is good.
- **Fix:** after revealing, focus the first new item (`tabindex="-1"` on its heading or link).
- **Effort:** S.

##### A15 · The home `<h1>` is read as "Education forLifeLibertyGoodFreedom": **Medium** · Confirmed (live)

- **Where:** `src/functions/rotatingTexts.js:84-92` stacks all words in the DOM with no ARIA.
- **Symptom:** that concatenation is what screen readers (and search snippets) get for the page's main heading.
- **Fix:** put `aria-hidden="true"` on the rotating stack and add a visually hidden sibling ("Education for life, liberty, the good and freedom").
- **Effort:** S.

##### A16 · The global focus indicator was commented out, apparently by accident: **Medium** · Confirmed (code) / partly mitigated (live)

- **Where:** `src/index.css:3-15` (`/* :focus { outline: 2px solid var(--navy, #021a27) !important; … */`).
  - It was commented out in `6096d2d` ("Improve accordion A11y; add forum page"), whose message doesn't mention it.
  - The removed comment documented that Webflow CSS resets outlines, and that `scroll-margin-top` kept focused elements from hiding under the fixed header (2.4.11).
- **Live:** the browser default ring shows on the header controls I tested. Webflow still has `outline: 0` on `.w-input`, `.w-select`, `.w-nav-button`, `.w-tab-link`, `.w-dropdown-*` and `.w-slider-*` (one instance on home, the menu search input).
- **Fix:** restore it, or confirm the removal was intended (see Open questions) and re-add at least `scroll-margin-top`.
- **Effort:** S.

##### A17 · Desktop nav: hover opens a menu, and clicking the same button closes it: **Medium** · Confirmed (code) / Suspected (how often users hit it)

- **Where:** `src/global/navbar.js:133-138` (`onMouseEnter` → `setOpen(entry, true)`) plus `:115-122` (`const willOpen = !isOpen(entry); … setOpen(entry, willOpen);`).
- **Symptom:** a mouse user who points at "Academics" and clicks sees the panel open on hover, then close on click.
- **Fix:** in `onBtnClick`, ignore a click-to-close within ~300 ms of a hover-open, or make click always open while the pointer is inside.
- **Effort:** S.

##### A18 · Captions: none in any live player: **High if confirmed** · Suspected

- **Where:** none of the three live players touches `textTracks`. **0 `<track>` elements** on home, people or majors (live).
- **Runtime check:** are captions burned into the video files? If not, speech videos fail 1.2.2 (A).
- **Effort:** M, plus caption files.

**Low, batched:**

- **Tab names:** tabs get `aria-label="${label} tab button"` (`tabs.js:918`). Live example: "Government & Policy tab button". Screen readers then say "…tab button, tab". Drop the suffix. S.
- **`aria-pressed` on modal triggers:** set on all modal triggers (`modal-basic.js:683`, `:695`). That turns links into "toggle buttons" and is invalid on `<a>`. Keep `aria-expanded` only. S.
- **Scrubbers:** not exposed to assistive tech, and mouse/touch only (`sectionVideoPlayer.js:1024-1025`, same in the others). Needs `role="slider"`, value text and arrow keys. M (do it with a shared control module).
- **Catalog dropdowns (`dropdown.js`):**
  - Click-opened, then Tab out: stays open (`:134-136`, `:170`).
  - Hover mode can't be opened by click (`:221-233`).
  - Close-on-select drops focus (`:237`).
  - S.
- **Direct `/people/{slug}` visits:** they skip the modal's accessibility and video wiring (`peopleTemplate.js:14-24`). S–M.
- **Scroll-to labels:** `[data-scroll-to]` labels are derived from the target id (`lenis.js:165-168`). Live on majors they contain the visible text ("Scroll to Course Highlights"), so 2.5.3 passes today; it only breaks if an id stops matching its label. Leave it, and check when ids change.
- **Marquee clones:** `aria-hidden` but not `inert` (`carousel.js:507-511`). No focusables in the clones on home today. Set `inert` and strip ids. S.
- **PDF reader:** the pdf.js reader is canvas-only (`pdfViewer.js:63-64`). **Tension:** it's deliberate, and the download link is the accessible alternative. Add `role="img"` + `aria-label="Page N of M"` per canvas. S.

#### C. Outside this repo (Webflow Designer), found by axe or live checks

- **Text contrast (1.4.3):** the brand orange `#ce4f00` is just under AA for small text (4.42:1), and the grey `#898881` (3.55:1) and orange on beige (3.74:1) fail clearly. A slightly darker orange passes, as do larger or bolder text and a darker grey. This is a brand/Designer decision.
- **Search submit:** `<input type="submit" value="">` has no accessible name, on every page (critical `input-button-name`).
- **Footer heading:** the footer CTA heading skips a level, on every page.
- **Link names:**
  - Social icon links have no names (/contact).
  - `.link[aria-label=""]` gives a link an empty name.
  - Generic labels such as `aria-label="Article Link block"` and `aria-label="button"` override real link text on home cards (2.4.4, 2.5.3).
- **Images:** no `width`/`height` attributes on any image (40/40 on home), which risks CLS unless the CSS reserves space.
- **Broken link:** **`/career-success` returns 404** and is linked from home.
- **Missing `data-page`:** **/majors/major-in-civics-honors has no `data-page`** (see B2).
- **Scrollable panel:** `.navbar-menu-panel` is a scrollable region with no focusable content until a category is chosen (`scrollable-region-focusable`).

---

### 3.3 Better ways to do it now

#### B1 · Embla loads unpinned from a CDN, and a CDN failure is silent: **High** · Confirmed

- **Where:** `src/utils/jsdelivr.js:33-35`:

  ```js
  embla: {
    version: 'latest',
    js: 'https://cdn.jsdelivr.net/npm/embla-carousel/embla-carousel.umd.js',
  ```

  - npm today: `latest` = 8.6.0, **`next` = 9.0.0-rc03**. When v9 is promoted, this URL starts serving a new major on production within jsDelivr's cache window, with no deploy. It's also not guaranteed the UMD path survives.
  - No script anywhere uses SRI (`loadScript`, `helpers.js:745-772`).

- **On failure:**
  - `loadScript` resolves for any existing tag, **including one that failed** (`helpers.js:748-751`), so retries never refetch.
  - `jsdelivr.js` then marks the library loaded.
  - `carousel.js:448` doesn't await or catch.
  - Prev/next buttons and dots stay visible and do nothing.
- **Fix:**
  - Pin `embla-carousel@8.6.0` (quick win 1).
  - Better: bundle Embla from npm (≈ 7 KiB gz), which removes the failure mode and the third-party dependency.
  - In `loadScript`, keep a `Map<src, Promise>` and remove the tag on error.
- **Effort:** S (pin) / S–M (bundle).

#### B2 · Component init is tied to a Designer-set `data-page`, and misses fail silently: **Medium** · Confirmed (code + live)

- **Where:**
  - `src/index.js:71-75` returns when there's no `data-page`, with only a `logger.warn`, which is stripped in production.
  - An unknown value also only warns (`:89-91`).
  - 21 of 30 page modules are near-identical wrappers that call `initCarousel()`, the testimonials slider and/or video players.
- **Live:**
  - I fetched 38 pages. **/majors/major-in-civics-honors** has no `data-page` but contains `[data-carousel]`, `[video-section]` and `[tabs-comp]`. Embla never loaded, the marquee has no clones, and the video toggles are inert `<div>`s.
  - /apply-now has `data-page="catch-all"`, which isn't registered (harmless today; only a global accordion).
- **Fix:** do what `global/index.js` already does for accordion and tabs. Init carousels, section video, testimonials and list videos **by DOM presence** in the global pass, and keep `data-page` for genuinely page-specific code (contact map, lifeAtSCL, home hero).
- **Tension:** the registry is the repo's organising idea; this narrows it rather than removing it.
- **Effort:** M.

#### B3 · Lenis: a renamed package, a no-op option, and an implicit scroll-lock contract: **Medium** · Confirmed

- **Package:** `package.json:22` `"@studio-freight/lenis": "^1.0.42"`. npm marks it deprecated: "renamed to 'lenis'", which is now at 1.3.26.
- **No-op option:** `lenis.js:379` `smoothTouch: !pointer,` doesn't exist in this version (`syncTouch` does). The repo already knows (commit `49aaced`).
- **Scroll lock:**
  - `modal-basic` locks scroll by calling `stopLenis()` (`modal-basic.js:126-137`).
  - I checked the installed Lenis source (`lenis.mjs`, `onVirtualScroll`): when stopped, it calls `preventDefault()` on **every** wheel/touch event unless the path contains `[data-lenis-prevent]`.
  - So any tall modal is unscrollable unless an author remembered that attribute in Webflow. The people modal has it; `modal-basic` never adds it. Suspected for other modals.
- **Upgrading buys:** a maintained package, working `syncTouch`, an `autoRaf`/`prevent` option and GSAP-ticker integration (P-low).
- **Upgrading costs:** option renames and re-testing the iOS contact-map issue.
- **Now:** add `data-lenis-prevent` to the modal root in `openModal`.
- **Effort:** S (attribute) / M (upgrade).

#### B4 · Tooling is configured but not enforced: **Medium** · Confirmed (ran it)

- **Lint is red:** `eslint src` reports **116 problems**: 86 `prettier/prettier`, 13 `prefer-const`, 12 `no-unused-vars` (e.g. `contact.js:3`, `catalog.js:3`, `ackerman.js:5`, six functions in `gsap.js`) and 5 `no-console`.
  - `prettier --check .` flags 17 files.
  - With `--max-warnings=0`, `pnpm lint` exits 1, so nobody is running it. There's no CI to run it for them.
- **Rule coverage:** `eslint.config.js` doesn't extend `js.configs.recommended`, so `no-undef`, `no-unreachable` and `no-empty` are all off.
- **Tests:** none (see C6).
- **Outdated:** ESLint 8 has been end-of-life since Oct 2024 (latest 10.x); esbuild is 0.19 (latest 0.28).
- **Unused dependencies:**
  - `three` (never imported; `public/sphere.js` is a stray demo).
  - `live-server` (never used; it pulls the deprecated chokidar-2 tree listed in `pnpm-lock.yaml`).
- **Package managers:** three are in use (pnpm, npm lockfile, bun in `webflow-deploy.json`), so their installs can drift.
- **Fix, in order:**
  1. `prettier --write .` plus `eslint --fix` (no behaviour change).
  2. Remove the unused imports.
  3. A 10-line GitHub Action running `pnpm lint && pnpm build`.
  4. Pick one package manager and delete the other lockfile.
  5. Remove `three` and `live-server`.
  6. ESLint 9/10 with `js.configs.recommended` and `globals.browser`.
- **Effort:** S (steps 1–3) / M (upgrade).

#### B5 · The code overrides the browser's scroll restoration, so Back loses your place: **Medium** · Confirmed

- **Where:**
  - `lenis.js:417-419` `history.scrollRestoration = 'manual';`.
  - `resetScrollPosition()` runs at script eval (`index.js:9`), at init (`index.js:60`, `lenis.js:421`, `:394`) and on every `pageshow` (`lenis.js:620-622`), including bfcache restores.
- **Symptom:** open a news article from page 3 of the list, press Back, and you land at the top of the list. Same for people and load-more lists.
- **Tension:** this is probably deliberate, to keep ScrollTrigger and Lenis state consistent.
- **Fix:** for `event.persisted` bfcache restores, do nothing, because layout and GSAP state are intact. For normal loads, restore `sessionStorage`-saved `scrollY` after `ScrollTrigger.refresh()` instead of forcing 0.
- **Effort:** M.

#### B6 · Native `<dialog>` for the people modal (and eventually `modal-basic`): **Low–Medium**

- **What it gives:** `showModal()` provides top-layer rendering, an inert page behind, contained focus, Escape and a `::backdrop` for free. That would structurally fix A2, A4 and A9.
- **Cost:** Webflow markup and styling changes; it's M–L for `modal-basic` because many modals share it.
- **Recommendation:** use `<dialog>` for the people modal, which has none of these today. For `modal-basic`, do the targeted fixes (quick wins 2 and 5, A9) now.
- **Effort:** M.

#### B7 · Upgrade GSAP 3.12.5 → 3.15: **Low**

- **What it buys:** every GSAP plugin (SplitText included) has been free since 3.13.
- **Current mismatch:** the SplitText path loads a **3.13** file against the bundled **3.12.5** core (`gsap.js:60`). That path is dead code today (`applySplitLineAnimation` is never called), so it's latent.
- **Recommendation:** not worth doing alone; do it with B3.
- **Effort:** S–M.

#### B8 · Keep pdf.js pinned at 3.x: done well, **no change**

- **Where:** `pdfViewer.js:86-98` pins 3.11.174 for Safari < 16.4, and `:582` mitigates CVE-2024-4367 with `isEvalSupported: false`.
- **Tension (documented):** upstream is on 6.x.
- **Recommendation:** revisit once pre-16.4 iOS traffic is negligible.

---

### 3.4 Also checked

#### C1 · Production has no error visibility: **High** · Confirmed (build output)

- **Where:**
  - `bin/build.js:29` `drop: DEV_MODE ? [] : ['console', 'debugger'], // Remove console.log in production`.
  - `src/utils/logger.js:42-47` promises "Log error (always logged, even in production)".
  - I grepped the production bundle: **0** `console.*` references remain.
- **Consequence:** every `handleError` → `logger.error` (about 45 files) is a silent catch in production.
- **Also:** page modules put several features in one try/catch (`people.js:14-17`, `AckermanProgram.js:16-18`, `home.js:24-34`), so one throw disables unrelated features invisibly.
- **Fix:**
  - Quick win 6.
  - Wrap each feature separately (a `safe(fn, label)` helper).
  - Optionally send `handleError` to GA4 (`gtag('event','exception',{description, fatal:false})`); gtag is already on the page.
- **Effort:** S.

#### C2 · Async and state races: **Medium** · Confirmed (code)

- **People modal:**
  - There's no request token (`handlePeopleModal.js:260-283`). If you click A then B and A resolves last, you see A.
  - A double-click pushes `/people/A` twice.
  - Close _pushes_ the list URL (`:234-236`), so history becomes `[list, A, list]` and Back replays profiles. It also drops the query and hash (`:21`).
  - Fix: `++seq` token; close with `history.back()` when `history.state?.peopleModalSlug`; capture `pathname + search + hash`. S.
- **Section video player:**
  - Return on a `[no-autoplay]` section leaves the full video playing on loop (`sectionVideoPlayer.js:939-942`).
  - A slow first `play()` resolving after Return marks the preview "playing" and starts a progress loop that never ends (`:855-860`).
  - Fix: `else video.pause()` plus a play token. S.
- **Regular player:** `autoplay-on-view` overrides a user's pause and mutes them (`regularVideoPlayer.js:520-535` checks only `video.paused`, not `hasStarted`). S.
- **Testimonials:** re-setup on every intersection and resize resets a playing video (`testimonialsCustomSlider.js:145-148`, `:166-168` → `:79-93`). S.
- **Media keys and picture-in-picture:** these desync the section and regular player UI; the section player has no `playing` listener (`:1028-1032`). S.
- **Rotating text:** a count-limited rotation restarts on tab return (`rotatingTexts.js:154-156`). Home uses `data-rotate-count="1"`, so this is live. S.

#### C3 · Loading, empty and error states: **Medium** · Confirmed

- **People modal:**
  - Nothing happens between click and open, and failures are silent (`handlePeopleModal.js:264-266`, `:284-286`, both stripped).
  - Cards with an empty `data-people-name` become focusable no-op "buttons" (`:14-17` vs `:321`).
  - Fix: `aria-busy` + a loading class; on failure, navigate to `/people/{slug}`.
- **Section video:** a failed play leaves a black box with a play icon; there's no rollback, unlike `regularVideoPlayer.js:342-350` (`sectionVideoPlayer.js:861-863`). No player listens for `error`.
- **Mapbox:** there's no `#map` check, no `map.on('error')`, and no static fallback (`contact.js:139-160`). Campus networks and privacy extensions often block it.
- **Carousel CDN failure:** covered in B1.
- **Done well:** nest failures fall back to the original link (`nest.js:103-107`), and the PDF viewer restores the native embed on failure (`pdfViewer.js:597-604`).

#### C4 · Duplicated logic that has drifted: **Medium** · Confirmed

- **Two load-more components:**
  - `listloadmore.js:89-96` hides items with `el.hidden` only.
  - `basicListLoadMore.js:63-66` documents that exact approach as broken on Webflow ("The [hidden] attribute's UA `display:none` is overridden by any authored display…") and forces `display:none` inline.
  - Meanwhile only `listloadmore` has the live-region announcement.
  - If a Webflow item class sets `display`, `listloadmore` "hides" items that stay visible, but `aria-hidden` (Suspected: check a list that uses `data-custom-loadmore`).
  - Fix: merge them into one module.
- **Three video players:** the drift is laid out in the table below.
  - Copy-pasted helpers: `formatTime`, `setProgress`, the scrub handlers and the poster fallback.
- **`isEmptyText`:** exists twice (`populateRichList.js:27`, `peoplePopulateRichContent.js:50`). The people version doesn't skip blank `<li>`s (`peoplePopulateRichContent.js:15`), so only profiles show empty bullets.
- **Reduced-motion check:** inlined in 10+ places.
- **Script loading:** `contact.js:124-147` reimplements `loadScript`.

|                        | section         | regular                      | list                  |
| ---------------------- | --------------- | ---------------------------- | --------------------- |
| Keyboard + live labels | yes             | **no**                       | **no**                |
| First `play()` fails   | stays "started" | full rollback                | rollback              |
| `playing` listener     | none            | state only                   | state + progress      |
| Pause off-screen       | none            | yes (never resumes previews) | none after first view |
| Lazy source            | no              | no                           | yes                   |

#### C5 · Dead code and leftovers: **Low** · Confirmed (metafile)

- **16 source files are never imported** (≈ 4,000 lines):
  - `global/navbar/` (8 files, the old navbar; `global/index.js:7-9` warns about its import-resolution trap)
  - `global/finsweet.js`
  - `components/swiper.js`, `toc.js`, `articleAnchors.js`, `videoPlayer.js` (1,040 lines), `animContentDivider.js`
  - `utils/performance.js`
  - `pages/ackerman.js`
- **Unused helpers:** 16 `helpers.js` exports are unused (tree-shaken, so they cost upkeep only).
- **`gsap.js`:** six unused functions and about 150 commented-out lines.
- **Stale README:** it advertises Swiper and lazy page loading.
- **Test route:** `test` ships in the production router (`index.js:47`).
- **Stray artifacts (≈ 1.6 MB):** `public/` (a stale 137 KB unminified build, plus a three.js demo with non-English comments), `example/`, `package/`, `vidstack-*.tgz`, `vidstack-esm.js`.
- **`src/index.html`:** this is the template of the `?devMode=true` loader that the live Webflow site uses (the live copy points at `127.0.0.1:3000/index.js` and `scl-nine-smoky.vercel.app`).
  - The repo copy still has another project's URLs (`https://tokenz-site.vercel.app/bootstrap.js`, `:4`), so pasting it as-is would load the wrong project's code.
  - Update it to match the live loader.
- **Fix:** delete in one reviewed commit (after confirming `navbar/` is truly abandoned).
- **Effort:** S.

#### C6 · Tests: **none**

**Risky, uncovered code:** router/registry, `modal-basic`, `tabs`, carousel autoplay state, the people modal race, and the build config.

**Tests that would have caught findings above:**

- A jsdom plus `axe-core` unit test per component: A2, A3, A5 and marquee clones.
- A test that the built bundle still contains `console.error`: C1.
- A reducer-style test for carousel stop reasons: A11.
- A "click A, click B, resolve A last" test: C2.

**Suggestion:** Vitest + jsdom + `vitest-axe`. That's M to set up, then S per component.

#### C7 · Unsafe DOM: nothing actionable

- **`innerHTML`:** every use takes same-origin Webflow HTML or CMS content (`nest.js:109`, `handlePeopleModal.js:182`, `peoplePopulateRichContent.js:20`, `:41`, `populateRichList.js:55`), which is the same trust boundary as the page.
- **`target="_blank"`:** all have `rel="noopener"`.
- **One unescaped selector:** `peoplePopulateRichContent.js:61-63` builds an attribute selector without `CSS.escape`; a quote in an id throws. S.

#### C8 · Leftovers

- **Raw `console.*`:** `handlePeopleModal.js:252`, `:265`, `:285`; `contact.js:134`, `:144`. They're stripped in production anyway, but they bypass `logger`.
- **Commented-out blocks:** `gsap.js:68-88`, `:416-449`, `:491-575`; `index.css:3-15`.
- **No debug flags ship,** apart from `?pdfjs=1`, which is intentional and documented.

#### C9 · Config and environment assumptions: **Low** · Confirmed (live) / Open question

- **Undocumented root URL:** Webflow loads the bundle from the **root URL** `https://scl-nine-smoky.vercel.app/`, which returns the JS with status 200. `vercel.json` has no rewrite, and the README says to use `/index.js`, so this depends on dashboard or project config nobody documented.
- **Mapbox token:** a public `pk.` token is hard-coded (`contact.js:111-112`, starts `pk.eyJ1I…`). Public tokens are normal, but this one belongs to the agency's `vovi-dev` Mapbox account. Restrict it to the production and `*.webflow.io` URLs, and plan a handoff to a client-owned account.
- **Secrets:** none in tracked files. `.env*` is gitignored; I did not open `.env.local`.
- **`pnpm-workspace.yaml`:** contradicts itself on esbuild builds (`allowBuilds: esbuild: false` and `onlyBuiltDependencies: - esbuild`).

**SSR / hydration:** not applicable (client-only enhancement of static HTML).

---

## 4. Not worth fixing, and why

- **Teardown and leak paths:** every `cleanup*()` / `destroy*()` in page modules, carousels and rotators. The site does full page loads, and the router never calls them. The only real growth is P10.
- **`handleSubNavSticky` and the navbar `is-scrolled` listeners** (`global/index.js:106-131`, `navbar.js:319-333`): passive, rAF-throttled, one read and one class toggle. An IntersectionObserver sentinel would be marginally nicer and isn't worth the churn.
- **Accordion `grid-template-rows` transition** (`accordion.js:97-101`): it does lay out each frame for 0.6 s, but on a small subtree. It's the standard technique and it handles unknown heights. Only add the reduced-motion override (A10).
- **`innerHTML` of CMS or same-origin HTML:** same trust boundary as the page (C7).
- **TypeScript migration:** L cost for a DOM-enhancement layer with little data modelling. If you want some type checking, `// @ts-check` on `utils/` is the cheap version.
- **Replacing GSAP with CSS scroll-driven animations or View Transitions:** GSAP is already paid for (bundled), used by 60+ triggers per page, and the site's animation vocabulary depends on it. Browser support for scroll-driven animations is still uneven for this audience.
- **Rewriting `modal-basic` on `<dialog>` right now:** the targeted fixes (quick wins 2 and 5, A9) get most of the benefit for a fraction of the risk. Do `<dialog>` for the people modal only (B6).
- **Splitting the bundle on its own:** listed as P1, but the payoff is modest (≈ 7–25 KiB brotli per page). Do it only together with the cache-policy change (P2).
- **The section player's documented dead "fullscreen takeover" code** (`sectionVideoPlayer.js:437-624`): the repo marks it as kept on purpose.
- **The full video looping silently after Return, and main videos with sound playing off-screen:** product decisions, not bugs.
- **Sequential `await`s in page modules** (`home.js:30-34`, `people.js:14-15`): the awaited functions are effectively synchronous (`ensureGSAPLoaded` is sync code marked `async`). There's no network waterfall to parallelise; the real issue is the shared try/catch (C1).
- **`twitter.com/intent` → `x.com`, `.gitignore` duplicates, Lottie loading:** harmless. Lottie loads only on home, which is correct.
- **pdf.js 3.x:** see B8.

---

## 5. Open questions

1. **Focus ring:** was removing the global `:focus` ring in `6096d2d` intentional? If so, where are focus styles meant to live now (Webflow?), and should `scroll-margin-top` come back on its own?
2. **The 100 ms sleep** (`global/index.js:90`): what is it waiting for?
3. **Component init:** should components initialise by DOM presence (B2), or is `data-page` meant to stay the single switch? Either way, what should `catch-all` (/apply-now) run, and is the missing `data-page` on /majors/major-in-civics-honors a Designer slip?
4. **Captions:** are they burned into the testimonial, people and section videos? If not, A18 becomes High.
5. **Vercel root URL:** where is the root-URL → bundle mapping configured, and who owns it?
6. **Scroll reset:** is "always land at the top, even on Back" a product requirement (B5)?
7. **Attribute usage in Webflow** that I couldn't see from the repo:
   - `data-tabs-autoplay` (needs a pause control)
   - `data-nest-target` (P6 scale)
   - `data-dropdown-event="hover"`
   - marquees containing links
   - `data-custom-loadmore` lists whose items have a `display` class (C4)
8. **Reveal flash (P3):** does any Webflow class pre-hide `[anim-element]` before JS runs? That decides whether P3's flash is visible.

### What I ran, and what I couldn't verify

**Ran:**

- A production build (same esbuild config, output to a scratch folder so your `dist/` wasn't touched), with a metafile analysis.
- gzip and brotli sizing.
- `eslint src` and `prettier --check .`.
- `npm view` for current versions and deprecations.
- A read of the installed Lenis source.
- On https://vovi-scl.webflow.io:
  - axe on 5 pages
  - keyboard Tab walk on home
  - computed focus styles
  - resource and header inspection
  - `data-page` survey of 38 URLs
  - modal and trigger inspection on /news
  - tablist structure on majors
  - carousel, video and track counts

**Couldn't verify:**

- **Core Web Vitals (LCP, CLS, INP):** the embedded browser returned no paint or LCP entries, and the pane was hidden for part of the session, which also throttles rAF and IntersectionObserver.
- **iOS and Android device behaviour:** fullscreen, touch scroll, the `.map-content` issue.
- **Screen readers:** no NVDA, JAWS or VoiceOver testing.
- **Colour contrast and 200%/400% zoom / 320 px reflow:** these live in Webflow CSS and I didn't check them visually.
- **Tests:** there are none to run.

These are best done next with a Lighthouse or WebPageTest mobile run and a quick VoiceOver pass on home, /news, /people and a major page.

---

_Next step: tell me which findings to fix, and I'll do them in small, reviewable batches, running `pnpm build` (and lint, once it's green) after each._
