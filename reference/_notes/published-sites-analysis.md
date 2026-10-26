# Design-System Convention: Analysis of 4 Webflow Sites (Vovi agency)

Sources: `reference/{bridgewall,civicleadership,daniellubetzky,fedtech}/` (index + 2 inner pages + `site.css` each).
I parsed them with Node scripts kept in the scratchpad. Nothing in the repo was changed.
Short names below: **BW** = bridgewall, **CL** = civicleadership, **DL** = daniellubetzky, **FT** = fedtech.

The sites split into two generations of the same system. Both share the skeleton, the class grammar and the custom-code layer:

- **Gen A (BW, DL):** "token-mode" system. It has `_theme` with grouped `bg/accent/button` tokens, a `_text-style` collection bound to text classes through modes, `_typo` with full line-height/weight/tracking tokens, and `_spacing---section--NN` / `_spacing---gap--NN`.
- **Gen B (CL, FT):** "divider/section" system. It has a `_section---divider*` collection for container/gutter/vertical padding, `_corner` for radii, a flat numeric `_spacing---NN` scale, and no `_text-style` collection. CL keeps a flat `_theme`; FT has no `_theme` and themes through a `theme=""` attribute in external CSS.

---

## 0. Cross-site consensus (TL;DR)

| Aspect | Convention |
|---|---|
| Page skeleton | `body > div.page > (div.css.w-embed ×2) > main.main > [nav] + section.section… + footer.section` |
| Nav placement | Inside `main.main`, as the first child (`div.nav` in BW/DL/FT, `div.nav-wrap` component in CL). It is `position:fixed`. |
| Footer placement | Inside `main.main`, as `footer.section` (BW, FT), wrapped in a plain `div` (CL), or inside `div.section.overlap-top > section.content-wrap.theme-dark > div.content.for-footer` (DL) |
| Section | `section.section` (sometimes `div.section`). It is `position:relative`, has theme bg/color, and has **no padding** (Gen B adds horizontal `--_section---divider--wrapper-margin`). |
| Container | `div.content`. It is a flex column with gap, and **section padding lives here** (vertical + horizontal). It is the only "container"; Gen B adds `max-width` + `margin:auto`. |
| Background layer | `div.bg` / `img.bg` (`position:absolute; inset:0`) as a sibling of `.content` inside the section |
| Class grammar | Component-first, hyphen-separated: `component`, `component-element`, `component-element-sub` (`footer-menu-block`, `hotspot-card-text`). Modifiers are **combo classes**: `for-<context>`, `is-<state/variant>`, `v2/v3`, `_<ratio/columns>`, `theme-<mode>`, plus padding/gap combos `p-32`, `pb-24`, `g-32`. |
| Utilities | `style-*` (typography), `color-*` / `text-color-*`, `bg-*`, `weight-*`, `max-width-*` / `mw-*`, `hide`, `hide-mobile*`, `relative-z*`, `absolute-link`, `overflow-hidden`, `align-center`, `u-hide-if-empty*` |
| Webflow internals | `w-inline-block`, `w-dyn-list/items/item`, `w-embed`, `w-richtext`, `w-variant-<uuid>` (component variants), `data-wf--<component>--variant="<name>"` |
| Variables | Webflow variable export: `--<name>` for the Base collection, `--_<collection>---<group>--<name>` for other collections |
| Modes | Theme modes are re-declared on class selectors (`.section.theme-dark { all 26 --_theme--- vars }`). Breakpoint modes are re-declared on `body` inside `@media` blocks. |
| Breakpoints | Webflow defaults only: `max-width:991px`, `767px`, `479px` (plus Webflow's built-in `min-width:768px` lightbox rules). No 1280/1440/1920 Webflow breakpoints. |
| Fluid scaling | Custom code in `div.css.w-embed` makes `html{font-size}` fluid (`calc(var(--base)*1rem + var(--coefficient)*1vw)`) between design widths. Everything is in `rem`, so the whole site scales. `clamp()` is almost never used. |
| Responsive typography | Variables change at breakpoints (`body{--_typo---h1:…}` inside `@media`) plus the fluid root. Per-class font-size overrides are rare. |
| Custom attributes | Extensive attribute-driven JS/CSS (`data-anim`, `data-split-text`, `data-carousel`, `data-accordion*`, `data-modal-*`, `hide-mobile="1"`, `for-mobile="1"`, `transition-delay="N"`, `text-balance`, `fade-hori`, …). JS is an external bundle (Vercel / own CDN) plus Finsweet Attributes. |

---

## 1. Layout nesting

### 1.1 Global skeleton (identical on all 12 pages)

```
body[data-page="home|about|…"]          (CL, FT only; BW/DL body has no attrs)
└─ div.page                              (BW: [data-barba="wrapper"])
   ├─ div.css.w-embed  → <style> global custom CSS (fluid root, helpers, attribute utilities)
   ├─ div.css.w-embed  → <style> (2nd, often empty / page-specific)
   └─ main.main                          (BW: [data-barba="container"][data-barba-namespace="home|about|template"])
      ├─ div.nav | div.nav-wrap          (nav lives INSIDE main)
      ├─ section.section …               (content sections)
      └─ footer.section                  (footer also inside main)
   (FT: div.modal[data-modal-name] and div.hide.w-embed can sit at the div.page level)
noscript > iframe (GTM, CL/FT)
```

CSS for the skeleton: `.main{overflow:clip}` (BW, CL, FT). In DL the rule is on `.page{overflow:clip}`.

### 1.2 Section / container CSS (core rules)

| | `.section` | `.content` |
|---|---|---|
| BW | `position:relative; z-index:2; background-color:var(--_theme---bg--primary); color:var(--_theme---accent--primary)` | `display:flex; flex-flow:column; gap:var(--_spacing---gap--64); padding:var(--_spacing---section--80) var(--_spacing---global); position:relative; z-index:2` (no max-width; widths come from vw-based grids) |
| DL | `background-color:var(--_theme---button--bg)` (dark backdrop, visible behind rounded overlaps). Theme bg lives on `.content-wrap` | same as BW (`padding:var(--_spacing---section--80) var(--_spacing---global)`, gap `--_spacing---gap--64`) |
| CL | `position:relative; overflow:clip; padding-inline:var(--_section---divider--wrapper-margin); background-color:var(--_theme---bg); color:var(--_theme---text-body)` | `width:100%; margin-inline:auto; padding:var(--_section---divider-vertical--64) var(--_section---divider--container-margin); gap:var(--_spacing---64); flex column` |
| FT | `position:relative; padding-inline:var(--_section---divider--wrapper-margin)` | `width:100%; max-width:var(--_section---divider--container)` (93.75rem); `margin-inline:auto; padding:var(--_section---divider-vertical--80) var(--_section---divider--container-margin); gap:var(--_spacing---64); border-left/right:1px solid var(--limestone-2); overflow:clip` (bordered-column look) |

`.bg`: BW `pointer-events:none; position:absolute; inset:0`. CL `background-color:var(--navy); position:absolute`. FT `z-index:1; background-color:var(--lighter-green); position:absolute; inset:0`. DL `display:flex; centered; position:absolute; inset:0`.

### 1.3 Representative class chains

**Bridgewall**
1. `div.page > main.main > section.section.for-hero[data-hero] > div.content.for-hh > div.hh-text[data-scroll-fade] > h1.hh-text-head > div.style-h3[data-split-text=lines]` with sibling `div.bg.for-h[data-parallax] > img.hero-img[data-zoom-in]`
2. `main.main > div.track > section.section.for-purpose > div.content.for-purpose > div.layout-grid.for-purpose > h2.eyebrow + div.purpose-body > h3.style-h5`. This is a sticky stack: `div.track` wraps sticky sections, and `.section.for-purpose{position:sticky;height:100vh}`.
3. `main.main > div.track > section.section.theme-dark[data-tabs-comp][data-entrance] > div.solution-carousel-outer[data-carousel] > div.w-dyn-list > div.solution-carousel-wrapper.w-dyn-items > div.solution-carousel-item.w-dyn-item`. This section has **no `.content`**: a full-bleed carousel.
4. `main.main > section.section > div.content.pb-global > div.content-head > h2.style-body-regular > span.color-primary-dull`
5. `main.main > section.section#section-features > div.content.for-header > div.content-head …` followed by a second `div.content.for-xp[data-feature-tabs] > div.bg > img.bg`. Several `.content` blocks can sit in one section.
6. `main.main > section.section > div.content > div.layout-grid._1fr-5[data-tabs-comp] > div.fig.for-exp + div.experience-text > h2.style-h5.mw-24`
7. `main.main > section.section.theme-dark#project-cta-section > div.content.for-p-cta > div.p-cta-item …` with a sibling `div.bg > img.cta-bg`
8. Footer: `main.main > footer.section > div.content.for-footer-top > div.footer-head + div.footer-menu > nav.footer-menu-block > ul.footer-links-list > li.footer-link-item`, then `div.content.for-footer-bottom`
- About: `section.section.for-hero > div.content.is-full.for-about > div.hero-text > h1 + h2.style-h5.color-primary-dull` with sibling `img.bg`. Also `section.section > div.content.p-10 > div.layout-grid._5-4-3 > div.fig.for-story`.
- Modal is also inside main: `section.modal#project-modal[data-modal-name=project] > div.modal-content`.

**Civicleadership**
1. `main.main > div.nav-wrap.w-variant-…#nav[data-nav-wrap][data-wf--navbar--variant=transparent] > div.nav-content__wrap …` (BEM-ish nav component)
2. `main.main > section.section.theme-navy > div.content.for-home > h1.home-hero-head > div.rotating-texts[data-rotate-stop]`, with siblings `div.bg > div.hero-bg-overlay`, `div.video-wrap.no-radius`, `div.nav-banner__slot.is-hero-nav-banner > div.nav-banner__wrap > div.nav-banner__contain.container`
3. `main.main > section.section#challenge > div.content.p-32 > div.side-grid.v2 > div.side-fig + div.side-text`
4. `main.main > section.section.bg-light-beige > div.content > div.border-content-text.for-explore > div.border-divider-grid.for-explore > div.content-headshot.g-24 + div.divider-border-outer.out-64 + div.explore-content`
5. `main.main > section.section#our-people > div.content > div.content-headshot.v2 > div.position-relative.width-fit[data-wf--headshot-label--variant=base] > h2.headshot` (a "headshot" is the small eyebrow label component)
6. `main.main > div.section > div.content.for-home-news > div.border-divider-grid.border-full.for-latest-news > div.flex-vertical.gap-28.relative-z1`
7. `main.main > section.section#faqs > div.content > div.grid-layout.for-faqs > div.content-head + div.faqs-list-wrap[data-custom-loadmore=list]`
8. Inner: `section.section#Overview > div.content.p-32-g-100 > div.grid-layout._2-8-2` and `section.section.theme-navy#requirements > div.content.p-32 > div.grid-layout._8-4`
9. Footer: `main.main > div > footer.section.bg-light-beige > section.section.overflow-hidden > div.content.for-cta …`, then `div.content.for-footer > div.footer-grid`. This is a nested section inside the footer.

**Daniellubetzky** (adds a `content-wrap` padding/theme layer)
1. `main.main > div.nav > div.nav-bg + div.nav-content + div.menu-content` (plus a nav-scoped `div.css.w-embed`)
2. `main.main > div.section > section.content-wrap.theme-dark > div.content.for-hero > div.content-headshot > h1 > div.hero-h-wrap`, with siblings `div.hero-bg > div.hero-bg-ele` and `div.grain-texture`
3. `main.main > section.section > div.content-wrap.theme-dark > div.content.p-32 > div.episode-content > div.episode-content-head[data-anim]`
4. `main.main > div.section.overlap-top > section.content-wrap > div.content.for-intro > div.content-head-wap > div.content-head.for-intro > h2.style-h2`. Here `.overlap-top{margin-top:-1rem}` gives stacked rounded cards; `[cliped-section]{clip-path:inset(1rem round .5rem)}` is set by attribute.
5. `main.main > div.section.overlap-top > section.content-wrap.theme-dark > div.content.for-intro …` with sibling `div.bg > div.bg-overlay + div.bg.w-background-video`
6. `main.main > div.section.overlap-top#subscribe-now > section.content-wrap > div.content.for-cta > div.cta-content > div.form-block-wrap[data-wf--form---signup-form--variant=base]`
7. About: `section.section.theme-dark > div.content-wrap.theme-dark > div.content.for-about > div.hero-h-wrap > h1.style-h2`
8. Footer: `main.main > div.section.overlap-top > section.content-wrap.theme-dark > div.content.for-footer > div.footer-head > div.footer-menu > div.footer-menu-block`
- In DL the tag/class pairing flips: sometimes `div.section > section.content-wrap`, sometimes `section.section > div.content-wrap`.

**Fedtech**
1. `main.main > div.nav > div.nav-content` (with `div.modal[data-modal-name=newsletter]` inside nav)
2. `main.main > section.section > div.content.for-hero > div.content-head.is-hero > div.content-headshot > h1.style-h1-big + h2.style-h6.color-white-75`, with sibling `div.bg-wrap > div.bg-wide-img > img`
3. `main.main > section.section > div.content.for-trusted[data-carousel=marquee] > div.slider-wrapper.is-logos.w-dyn-list > div.slider.for-t-logos.w-dyn-items > div.trusted-logo-block.for-slider.w-dyn-item`
4. `main.main > section.section > div.content.g-32.bg-limestone-1 > h2.style-h4 + div.testimonials-block[data-carousel][data-fade][data-autoplay]` (the bg color is on the container, not the section)
5. `main.main > section.section > div.content > div.content-headshot._5-column > h3.style-h2 > span.color-limestone-4`, then `div.divider-border` and `div.grid > div.text-block`
6. `main.main > section.section[data-home-tabs][theme=light] > div.content.bg-lime-1 > div.tabs > div.tabs-menu > div.tab-btn.active`
7. `main.main > section.section > div.content > div.stack-grid > div.card.is-featured > div.block-text + a.absolute-link`
8. Footer: `main.main > footer.section[data-wf--footer--variant=base] > section.content.p-128 …`, then `section.content.for-footer > div.footer-head + div.links-menu + div.footer-bottom` and `div.bg-wrap`. Here `.content` is placed on a `<section>` tag.
- About: `section.section.has-nav-space > div.content.for-about > div.content-head.for-about-hero`. `.has-nav-space{padding-top:var(--_other---nav-height)}` is shared with CL and BW.
- Modals reuse the system: `div.modal > div.modal-content.full > div.section > div.content.for-modal`.

### 1.4 Variations noted
- **Sections without `.content`:** BW carousels (`section.section.theme-dark > div.solution-carousel-outer`) and `section.modal`.
- **Multiple `.content` per section:** BW `for-header` + `for-xp`, CL footer, FT footer (`p-128` + `for-footer`).
- **Padding wrapper layer:** only DL has one (`.content-wrap` between section and content, carrying theme bg plus rounded clip via `[cliped-section]`). BW has `[clipped-section]` (spelled correctly), which does `clip-path: inset(var(--_spacing---global) round var(--_border-radius---4))` and gives `.content` `--_spacing---global-2` side padding.
- **Sticky stacking:** BW `div.track` holds sticky sections. `.section.is-sticky{position:sticky;top:0}`.
- **`div.section` vs `section.section`:** both are used. `div.section` appears when a section wraps another `<section>` (DL) or for news/modals.
- **Nav offset:** `.section.has-nav-space { padding-top: var(--_other---navbar-height | nav-height) }` (all four).
- **No generic `.container` class** in Gen A. Gen B has `.container` (CL: `max-width:var(--_section---divider--container)` + margin vars; FT: `max-width:50rem`), but it is rarely used. `.content` is the real container.

---

## 2. Class naming convention

### 2.1 Grammar
- **Separator:** hyphen-only kebab-case (`footer-link-item`, `hotspot-card-fig`). Mostly no BEM `__`, with exceptions: CL nav/menu components (`nav-banner__wrap`, `menu-panel__heading`, `nav-content__wrap`: 45 classes) and FT program/sidebar components (`program-card__wrap`, `sidebar-overview__row`: 59 classes). BW has only `marquee__scroll`/`marquee__collection` (from an imported snippet). DL has none.
- **Component pattern:** `block` > `block-element` > `block-element-sub`. Examples: `project-block`, `project-block-fig`, `project-block-text`, `project-block-foot`; `episode-card`, `episode-card-bg`, `episode-card-bg-border`; `team-block`, `team-block-img`, `team-block-gradient`. Recurring vocabulary on all sites: `content-head`, `content-headshot`, `content-body`, `fig`, `bg`, `btn`, `btn-inner`, `eyebrow`, `grid`, `block`, `block-text`, `card`, `modal`, `modal-content`, `accordion`, `accordion-head/-body/-content`, `carousel-outer/-wrapper`, `slider`, `footer-head/-menu/-bottom`, `nav`, `menu`, `menu-link`, `richtext`.
- **Odd/legacy names:** `headshot` means "small label/eyebrow" (`h2.headshot`, `content-headshot` = heading group). `content-head-wap` (typo, DL), `borderd-*` (CL), `cliped-section` (DL) vs `clipped-section` (BW).

### 2.2 Modifier / combo classes (always combined with a base class)
| Family | Meaning | Examples |
|---|---|---|
| `for-<context>` | Context/instance-specific variant (the most used modifier) | `content.for-hero`, `content.for-footer-top`, `fig.for-story`, `grid.for-reviews`, `icon.for-faq`, `eyebrow.for-programs` (BW 31, CL 99, DL 27, FT 93 distinct) |
| `is-<x>` | Variant or state | `content.is-full`, `btn.is-secondary`, `btn.is-video-return`, `video-wrap.is-reduced`, `content-head.is-sideby`, `card.is-featured`, `divider-border.is-white-15`, `section.is-dark/is-navy`, `ui-icon-svg.is-loading/is-paused`, DL timeline years `is-1980` |
| `v1/v2/v3/v4` | Design version of a component | `hotspot-icon v2`, `footer-link v2`, `slider-indicator v2`, `style-h4 v2`, `platform-cta v3` |
| `_<n>` | Underscore-prefixed number/ratio (Webflow can't start a class with a digit) | Aspect: `fig _1-78-1` (1.78:1), `side-fig _1-30-1`. Columns: `layout-grid _5-4-3`, `grid-layout _2-10`/`_8-4`/`_2-8-2` (12-col spans), `_1fr-5`, `_3-1fr`. Size: `hover-icons _8px`. Duplicate: `corner-curve _2`, `cta-side-img _4` |
| `theme-<mode>` | Theme mode switch | `section theme-dark`, `theme-light`, `theme-base` (BW); `theme-navy`, `theme-invert` (CL); `content-wrap theme-dark` (DL) |
| spacing combos on `.content` | Override section padding/gap; only defined as `.content.<x>` | `p-10`, `p-32`, `p-48`, `p-64`, `p-80`, `p-100`, `p-128`, `pb-0/10/24/32/100`, `pt-0/16/32/128`, `pb-global`, `g-14/32/48/80/128`, compound `p-32-g-100`, `p-80-g-80`, `p-100-g-48`, `pt-64-pb-32`, `pt-48-pb-10` |
| `has-<x>` | Structural opt-in | `section.has-nav-space`, `section.has-border-top`, `has-border-top-mobile` |
| `no-<x>` | Opt-out | `video-wrap no-radius`, `content.for-hero.no-pod` |

**How they look in markup:** `class="content for-footer-top"`, `class="section theme-dark"`, `class="btn w-inline-block btn is-secondary"`, `class="style-p2 color-text-heading weight-medium"`, `class="eyebrow color-primary-dull"`, `class="divider-border is-white-15 relative-z3"`.

**Component variant artifacts:** Webflow Components with variants add `w-variant-<uuid>` to elements (`btn w-variant-b24d5eb8-… w-inline-block btn`). CSS targets them as `.btn:where(.w-variant-…)`. The base class appears twice (`btn … btn`, `icon for-faq icon for-faq`) because the component root class and the instance class are concatenated. The variant name goes in `data-wf--<component>--variant="<variant>"` on the root (`data-wf--link-button--variant="outline"`, `data-wf--navbar--variant="transparent"`, `data-wf--pill-button--variant="dark-outline"`, `data-wf--headshot-label--variant="base"`, `data-wf--form---signup-form--variant="v2"`, which contains a folder `form/signup-form`).

### 2.3 State classes (toggled by JS)
`active` (`tab-btn active`, `profile-modal active`), `open` (`.nav.open`, `.dropdown.open`, `.menu-dropdown.open`, `.modal:not(.open)`), `is-scrolled`/`is-open` (`[data-nav-wrap].is-scrolled`), `w--current` (Webflow current link), `loading-done` on body (CL), `ready` on `html` (`html:not(.ready) [data-anim]{opacity:0}`), `is-list-loading`/`is-list-starting` (FT CMS filtering), Webflow `w-mod-js`/`w-mod-touch` on `html`.

### 2.4 Utility families (standalone classes)
| Family | BW | CL | DL | FT |
|---|---|---|---|---|
| Typography `style-*` | `style-display`, `style-h1-big`, `style-h1…h6`, `style-body-large/regular/small(-2/-3)`, `style-button-text` | `style-h1-big`, `style-h1…h6`, `style-p1/p2/p3`, `style-label`, `style-text-button`, `style-sub-h`, `style-highlight`, `style-smaller` | `style-display`, `style-h1…h6`, `style-body-p1/p2/regular` | `style-h1-big`, `style-h1…h6`, `style-p1/p2/p3`, `style-label`, `style-button-text`, `style-sub-h`, `style-cap` |
| Text color | `color-primary`, `color-primary-dull`, `color-tertiary`, `color-disable-2` (all theme vars) | `color-text-heading(-2)`, `color-text-body(-2)`, `color-accent`, `color-text-navy`, `color-white`, `text-color-grey(2)`, `text-color-navy` | (`coloe-white-20`, typo) | `color-text-grey`, `color-white(-28/-50/-75)`, `color-limestone-1/2/4`, `color-carbon`, `color-light-violet`, `color-inherit` |
| Background | `bg`, `bg-sphere`, `bg-blur-overlay` (decor) | `bg-light-beige`, `bg-navy`, `bg-blue`, `bg-pink`, `bg-biege`, `bg-overlay`, `bg-decor` | `bg-overlay`, `bg-shine`, `bg-sideglow-overlay` | `bg-limestone-1`, `bg-lime-1`, `bg-wrap`, `bg-wide-img`, `bg-overlay`, `bg-cover-box` |
| Weight | `weight-500/600` | `weight-500`, `weight-medium`, `font-heading` | `weight-300/500/medium/semibold` | `weight-400/500/700` |
| Max-width | `mw-24` | `max-width-160…814` (px names, rem values: `max-width-300{max-width:18.75rem}`), `mw-15rem…mw-49rem`, `mw-auto/none` | none | `max-width-434/448/496`, `mw-26rem`, `mw-fill` |
| Gap (standalone) | none | `g-24` (flex column + gap), `gap-8…gap-80`, `flex-vertical` (gap 14) | `g-16` | `g-4`, `g-20`, `gap-16/64` |
| Layout helpers | `overflow-hidden`, `absolute-link`, `fit-contain`, `height-fill` | `position-relative`, `relative`, `relative-z1`, `width-fit/full/auto`, `column-fill-3…9` (vw widths), `overflow-clip/hidden/visible`, `align-*` | `absolute-link`, `overflow-hidden`, `align-center`, `opacity-50` | `absolute`, `absolute-bottom`, `absolute-link`, `relative-z3`, `z-1/2`, `fill-column-4/6`, `opacity-70` |
| Visibility | `hide`, plus embed `.hide-tablet`, `.hide-mobile-landscape`, `.hide-mobile` | `hide`, `hide-mobile`, `show-mobile`, `u-hide-if-empty`, `u-icon` | `hide` | `hide`, `hide-mobile-landscape`, `u-hide-if-empty-cms` |
| Style-guide page | `sg-*`, `style-guide-*` (present in CSS of all four, unused on downloaded pages) | same | same | same |

The `u-` prefix is rare: only `u-hide-if-empty`, `u-hide-if-empty-cms` and `u-icon`, mirrored as attributes `[u-hide-if-empty]` in custom code. This is **not** a Client-First/Lumos `u-` utility system.

### 2.5 Most frequent classes (aggregated over the 3 pages per site)
- **BW (217 unique):** `timeline-cuts-line` 231, `w-dyn-item` 101, `hotspot-icon` 96, `bg` 94, `eyebrow` 86, `v2` 57, `btn` 52, `hotspot*` 48, `w-inline-block` 47, `color-primary-dull` 43, `content` 36, `style-body-regular` 33, `footer-link` 30, `btn-text` 27, `section` 22. Top combos: `hotspot-icon v2` 48, `btn w-inline-block btn` 20, `btn-icon arrow-svg` 17, `eyebrow color-primary-dull` 16, `content for-header` 5.
- **CL (494 unique):** `w-inline-block` 232, `w-dyn-item` 144, `btn` 118, `icon` 112, `text-link` 87, `social-list__icon` 75, `for-faq` 73, `w-richtext` 70, `w-embed` 66, `button-inner` 65, `v2` 64, `button-icon` 62, `u-hide-if-empty` 59, `style-p2` 55, `section` 32, `content` 31, `style-label` 30, `style-p1` 30. Combos: `button-icon u-hide-if-empty` 56, `btn w-inline-block btn` 47, `position-relative width-fit` 28, `style-p1 medium` 25, `style-p2 color-text-heading` 14.
- **DL (260 unique):** `w-inline-block` 109, `footer-link` 32, `w-embed` 31, `style-h4` 30, `style-body-p2` 29, `v2` 29, `platform-cta-icon` 27, `style-body-p1` 25, `btn` 24, `w-variant-b24d5eb8…` 21, `style-h2` 17, `section`/`content-wrap`/`content` 15 each. Combos: `style-h4 v2` 18, `slide for-timeline` 15, `content-wrap theme-dark` 10, `style-body-p1 weight-500` 9, `section overlap-top` 8.
- **FT (423 unique):** `corner-curve` 466, `hover-icon` 314, `w-dyn-item` 282, `w-inline-block` 209, `_2` 203, `color-text-grey` 168, `hover-icons` 157, `style-label` 153, `absolute` 134, `style-p2` 111, `eyebrow` 105, `_8px` 102, `for-eyebrow` 97, `style-p1` 90, `btn` 78. Combos: `corner-curve _2` 159, `hover-icons _8px` 99, `corner-curve for-eyebrow` 97, `style-p2 color-text-grey` 88, `style-p1 medium` 66, `btn w-inline-block btn` 39.

---

## 3. CSS custom properties

### 3.1 Webflow encoding (as observed)
```
--<name>                         Base (default) collection, ungrouped   --white, --navy, --dark
--<group>--<name>                Base collection, group/folder          --grey--50, --black--10, --white--75
--_<collection>---<name>         Other collection, ungrouped            --_spacing---16, --_corner---32
--_<collection>---<group>--<name> Other collection + group              --_theme---bg--primary, --_typo---line-height--h1
```
- `_` prefix = non-default collection. Collection names are slugified (`Border Radius` → `_border-radius`, `Z-Indices` → `_z-indices`, `Text Style` → `_text-style`).
- `---` (3 hyphens) separates the collection from the variable path. `--` (2 hyphens) separates a group folder from the variable (Webflow's `Group / Name`). Folders can nest: `--_section---divider-vertical--hero-top`.
- **Deleted variables still export**, escaped: `--blue--100\<deleted\|variable-870ef79c-…\>`, `--_theme---bg--secondary\<deleted\|…\>`. Treat them as noise.
- **Modes export as re-declarations:**
  - *Class-bound mode* means the full collection is re-declared on the class selector: `.section.theme-dark { --_theme---bg--primary: var(--dark); …all 26 vars }`.
  - *Breakpoint mode* (responsive variables) means the collections are re-declared on `body` inside each `@media` block (`@media (max-width:991px){ body{ --_typo---h1: … } }`).
  - The default mode is on `:root` and is repeated on `body` (BW: 31 theme+text-style vars on `body`).

### 3.2 Bridgewall (`:root` = 167 vars)
- **Base colors:** `--white`, `--black:#000`, `--transparent:#fff0`, `--dark:#242424`. `--grey--50/100/200/300/800/900`. `--black--10/20/30/40/50/80` and `--white--10/20/30/40/50/80` (alpha ramps). Deleted: `--blue--100…300`, `--neutral--100…500`, `--style-guide--02`.
- **`_theme` (26):** `bg--primary` (`var(--white)`), `bg--secondary` (`var(--grey--50)`). `accent--primary` (text, `var(--dark)`), `accent--primary-dull` (`color-mix(in srgb,var(--_theme---accent--primary)50%,transparent)`), `accent--secondary`, `accent--tertiary`, `accent--border`, `accent--border-2`, `accent--disable(-2/-3)`, `accent--icon-box`. `button--border/bg/text-color`. `secondary-button--border/bg/text-color/hover-border/hover-bg/hover-text-color`. `outline-button--border/bg/text-color`.
- **`_text-style` (5):** `font-family`, `font-size`, `line-height`, `font-weight`, `letter-spacing` (default → body tokens).
- **`_typo`:** sizes `display 5rem`, `h1-big 3.375`, `h1 2.5`, `h2 1.5`, `h3 1.5`, `h4/h5/h6 1.25`. `body--regular 1rem`, `body--small .6875`, `body--large 1.25`. `other--eyebrow .75`, `other--button .75`. `line-height--{display,h1-big,h1…h6,regular,small,large,eyebrow,button}`, `font-weight--{…}` (all 400, eyebrow 500), `letter-spacing--{…}` (display `-.4rem` … eyebrow `+.0625rem`).
- **`_spacing`:** ungrouped `2,4,5,6,8,10,12,14,16,20,24,32,48,64,80,100,160`, `none`, `global .75rem`, `global-2 1.75rem`, `grid-margin` (`var(--_spacing---global)`), `grid-gutter .75rem`. `section--10/24/32/48/64/80/160`. `gap--12/16/18/24/32/48/64/80/90/100`.
- **`_border-radius`:** `none, 2, 3, 4, 6, 8, 12, 16, 24, 32, round(100%)`.
- **`_other`:** `navbar-height 5.125rem`, `blur--3/20`, `container-1280px 80rem` (declared but unused).

### 3.3 Daniellubetzky (`:root` = 147 vars), same structure as BW
- **Base:** `--white`, `--black`, `--transparent`, `--dark-green #10211f`, `--dark-green-2`, `--bright-teal #99ffe8`, `--bright-teal-2`, `--off-white(-2/-3)`, `--border-dark`, `--border-light`, `--dark--90/70`, `--white--90/70`.
- **`_theme` (21):** `bg--primary/secondary`, `accent--primary/secondary/border/disable/brand/90/70`, `button--bg/text-color/icon-box/bg-hover`, `secondary-button--bg/text-color/icon-box`, `outline-button--border/bg/text-color`.
- **`_text-style` (5)**, same as BW.
- **`_typo`:** `display 13.75rem`, `h1 10.25`, `h2 7.5`, `h3 5.25`, `h4 4`, `h5 2`, `h6 1.125`. `body--regular/p1/p2`. `other--headshot/button`. `line-height--*`, `font-weight--*` (body 300), `letter-spacing--*`.
- **`_spacing`:** like BW (`global 3.75rem`, `global-2`, `grid-gutter 1.25rem`, `200 12.5rem`, `section--32…160` incl. `100`/`128`, `gap--12…80` incl. `56`).
- **`_border-radius`** (`none…32, round`). **`_size`:** `container-1280px` (BW calls this collection `_other`).

### 3.4 Civicleadership (`:root` = 157 vars)
- **Base (flat brand names, no groups):** `--navy #021a27`, `--burnt-orange #ce4f00`, `--orange #f5780f`, `--light-beige #eeece3`, `--beige`, `--border-navy`, `--border-beige`, `--text-navy`, `--text-grey`, `--text-grey-2`, `--carbon`, `--off-black`, `--limestone-1…4`, `--blue #000261`, `--light-violet`, `--blue-border`, `--error`, `--border-grey(-light)`, `--navy-12`, `--blue-50`, `--site-bg` (`var(--white)`), `--lime-hover`. Grouped: `--primary--orange-1` (`var(--burnt-orange)`), `--text--primary`.
- **`_theme` (flat semantic + 2 groups, 26 vars):** `text-heading`, `text-body`, `text-body-2`, `text-contrast`, `bg`, `bg-2`, `border`, `border-2/3/4`, `accent`, `active-accent`, `custom-accent`, `active-color`. `button-primary--border/background/text/border-hover/background-hover/text-hover`. `button-secondary--` (same 6).
- **`_typo`:** `h1 3.375rem`, `h2 2.5`, `h3 1.75`, `h4 1.375`, `h5 1.25`, `h6 .9375`, `h1-big 4.375`, `h1-xl 5.5`, `h4-22-20: clamp(1.25rem,.625rem + .625vw,1.375rem)` (the only clamp in any site). `body--p1 .9375`, `body--p2 .8125`, `body--p3 .6875`. `font--heading "Gt Sectra"`, `font--body Bentonsans`. `line-height--{p1,p2,p3,h1…h6,h1-big,h1-smaller,label,button}`, `letter-spacing--{…}`. `other--label/button/headshot`. No font-weight group.
- **`_spacing`:** `0,1,2,4,6,8,10,12,14,16,18,20,24,28,30,32,40,48,64,80,100,128,132` (no `section--`/`gap--` groups).
- **`_section`:** `divider--container 90rem`, `divider--container-margin 2vw`, `divider--grid-gutter 1.25vw`, `divider--wrapper-margin 0`. `divider-vertical--32/48/64/80/100/128/hero-top(10rem)`.
- **`_corner`:** `0,3,5,6,8,10,12,14,16,24,32,48,100,round`.
- **`_other`:** `nav-height 5.75rem`, `banner-height`, `dvh-w-fallback 100dvh`, `nav-v`.
- **`_z-indices`:** `nav 100000`, `subnav 99999`, `modal 100001`, `modal-level-2 100002`.

### 3.5 Fedtech (`:root` = 98 vars), the leanest
- **Base:** `--white`, `--carbon`, `--blue`, `--black`, `--limestone-1…4`, `--off-black`, `--text-grey`, `--lighter-green`, `--lime-hover`, `--light-violet(-50)`, `--blue-border`, `--red-pastel/label`, `--green-pastel/label`, `--yellow`, `--brown-label`, `--orange`, `--teal`, `--purple`, `--golden`, `--video-brand`, `--site-bg`. `--white--15/25/28/50/60/75`.
- **No `_theme` and no `_text-style` collection.** Theming is done through the `theme="light|blue|invert"` attribute, styled in external `assets.fedtech.io/index.css`, which is not in the download.
- **`_typo`:** `h1 3rem`, `h2 2.5`, `h3 1.8125`, `h4 1.375`, `h5 1.25`, `h6 1.125`, `h1-big 4`. `body--p1/p2/p3`. `other--label/button/headshot`. No line-height/weight/tracking tokens; those are hard-coded per class.
- **`_spacing`:** `0,1,2,4,6,8,10,12,14,16,18,20,24,28,32,48,56,64,80,100,128`.
- **`_section`:** `divider--container 93.75rem`, `divider--container-margin 6.25rem`, `divider--grid-gutter 1.25rem`, `divider--wrapper-margin 2rem`. `divider-vertical--24/32/48/64/80/100/128`.
- **`_corner`**, **`_other`** (`nav-height 5rem`, `startup-accordion-head-height`).

### 3.6 Modes
**Theme modes (class-bound):**
- BW "Dark" mode (`bg--primary:var(--dark)`, `accent--primary:var(--white)`, `button--bg:var(--white)` …) is applied on `.section.theme-dark`, `.section.for-hero`, `.section.for-contact`, `.content.for-xp`, `.slide.for-intro`, `.nav`, `.fig`, `.solution-card`, `.solution-card-foot`, `.more-project`, `.slider-indicator.v2`, `.sg-row.theme-dark`. The "Base/Light" mode re-applies on `.theme-base`, `.nav.theme-light`, `.fp-text.theme-light`, `.solution-card.theme-light`, `.tab-menu-absolute.theme-light`, `.btn.theme-base`, `.nav-foot`, `.more-project-cta`. Responsive switching also happens: `@media (max-width:767px){ .nav{dark}, .nav.open{light}, .menu{light} }`.
- DL "Dark" is on `.content-wrap.theme-dark`, `.nav`, `.platform-cta.v2`, `.platform-cta-card`, `.podcast-social-icon.is-dark`, `.cta-text`. "Light" is on `.menu`, `.platform-cta.v3`, `.platform-cta-card-box`, and on the hover variant `.btn:hover:where(.w-variant-…)`. `.platform-cta.v3` flips to dark at ≤991.
- CL "Navy" (`text-heading:white`, `bg:navy`, `text-body:text-navy`) is on `.section.theme-navy`, `.section.is-navy`, `.section.is-dark` (text-body white), `.theme-invert.theme-dark`, `.video-wrap`, `.card-quote`, `.cover-block(-2)`, `.content-box`, `.team-accordion`, `.leadership-collection-item`, `.academic-cta`, `.nav-wrap:where(.w-variant-…)` (the transparent nav variant), `.sub-nav-links__wrap.is-dark/.is-navy`. "Default/Light" re-applies on `.theme-invert`, `.card`, `.lead-block`, `.review-card`, `.req-content-card`, `.map-cta`, `.nav-menu__wrap`, `.menu-content__inner`, `.academic-cta.v2`.
- FT uses the attribute `theme="light"` (on 14 `section.section`), `theme="blue"` (`section`, `content`, `testimonials-block`, `arrow-overlay`) and `theme="invert"`, plus `theme-inherit="1|0"` on eyebrows/buttons/corner icons and `theme-text="White"` (embed CSS forces white text).

**Text-style modes (Gen A only):** each text class re-declares the 5 `--_text-style---*` vars, then reads them. Example (BW):
```css
h1, .style-h1 { font-family:var(--_text-style---font-family); font-size:var(--_text-style---font-size); …
  --_text-style---font-size:var(--_typo---h1); --_text-style---line-height:var(--_typo---line-height--h1); … }
.eyebrow, .btn, .tag, .menu-link, .footer-link, .tab-btn { --_text-style---font-family:Jetbrainsmono,…; --_text-style---font-size:var(--_typo---other--eyebrow|button) … }
```
Modes can switch per breakpoint: `@media (max-width:767px){ .style-h1.h2-mobile {→ h2 tokens}; .menu-link {→ h3 tokens}; .menu-btn {→ eyebrow} }`.

**Breakpoint modes:** see §4. Collections re-declared on `body` per `@media`.

**color-mix:** BW `--_theme---accent--primary-dull: color-mix(in srgb, var(--_theme---accent--primary) 50%, transparent)`. **clamp:** only CL `--_typo---h4-22-20`.

---

## 4. Breakpoints

### 4.1 Media queries in `site.css` (all four)
| Query | Rules: BW / CL / DL / FT | What changes |
|---|---|---|
| `@media screen and (max-width:991px)` | 43 / 194 / 51 / 198 | `body{}` breakpoint-mode variables; widths (vw→auto), `display`, `grid-template-columns` (3→2), `grid-area`, nav/menu, some padding |
| `@media screen and (max-width:767px)` | 119 / 564 / 123 / 269 | Main mobile restack: `flex-flow:column`, `display`, `width`, `grid-row/column-gap`, `padding-*`, `aspect-ratio`, `align-*`, `position:static` on sticky sections, plus `body{}` vars (typo, spacing, radius, nav-height) |
| `@media screen and (max-width:479px)` | 23 / 185 / 23 / 97 | `grid-template-columns:1fr`, widths, small tweaks; CL/FT also `body{}` vars (`_section---divider*`, `nav-height`) |
| `@media (min-width:768px)` | 8 each | Webflow built-in lightbox only |
| `@supports not selector(:popover-open)` | 1 | Webflow built-in |

No custom larger breakpoints (1280/1440/1920) exist in Webflow. Large-screen scaling is handled by the fluid root.

### 4.2 Variables changed per breakpoint (diff vs `:root`)
- **BW ≤991:** `_typo---display 5→3.375rem`, `h1-big 3.375→2.5`, `h3 1.5→3`, `h4 1.25→2`, `_spacing---section--160 10→5rem`. **≤767:** `display→3`, `h4→1.5`, `h6→1.125`, `section--80/64/48→2.75rem`, `section--160→3.75`, `gap--64→3`, `gap--80/90→3.75`, `global-2→1.5`, radius `32→1.5, 24→1.25, 16→.75, 12→.5`, `navbar-height→3.87rem`.
- **DL ≤991:** `_spacing---global 3.75→2.75rem`, `global-2`, `letter-spacing--h1`. **≤767:** `display 13.75→6rem`, `h1 10.25→5.125`, `h2 7.5→4.1875`, `h3 5.25→3.375`, `h5 2→1.5`, `global→1rem`, `grid-margin/gutter→1rem`, `gap--56/64→2`, `gap--80→3.75`, radii.
- **CL ≤991:** the whole `_spacing` scale shrinks (`128→5`, `100→4`, `80→3.375`, `64→3`, `48→2.375`, …), `h1 3.375→3`, `h1-big→3.5`, `h1-xl→4`, `h4/h5/h6` grow, `h4-22-20→var(--_typo---h4)`, `divider--container-margin 2vw→2rem`, `grid-gutter 1.25vw→1.25rem`. **≤767:** `h1→2.5`, `h2→2`, `h3→1.5`, `body--p1/p2→1rem`, `p3→.8125`, `container-margin→1.25rem`, `hero-top 10→8rem`, `nav-height 5.75→4rem`, `_corner` 16/24/32/48 shrink. **≤479:** repeats divider/nav values.
- **FT ≤991:** spacing scale shrinks (`128→5`, `100→4`, `80→3.375`, `64→2.375`, …), `h1 3→2.125`, `h2 2.5→1.875`, `h3→1.625`, `h1-big 4→2.5`, `divider--container-margin 6.25→2rem`, `divider-vertical--*` shrink. **≤767:** `body--p1 .9375→1.125` (body text grows on mobile), `container-margin→1.5`, `grid-gutter→.75`, `wrapper-margin→0`, vertical dividers shrink further, `nav-height→4.25`, corners. **≤479:** repeats divider values.

### 4.3 Fluid root (custom code in `div.css.w-embed`)
```css
:root{ --font-from:…; --font-to:…; --vw-from:calc(W1/100); --vw-to:calc(W2/100);
  --coefficient:calc((var(--font-to) - var(--font-from)) / (var(--vw-to) - var(--vw-from)));
  --base:calc((var(--font-from) - var(--vw-from) * var(--coefficient)) / 16); }
html{ font-size:calc(var(--base) * 1rem + var(--coefficient) * 1vw); }
```
- **BW & DL** ("Figma Design on 1728px"): 16px at 1728. Segments `@media (max-width:4000px)` 16→37.04, `1728px` 9.17→16, `990px` 12.4→16, `767px` 16→27.89 (base 440 mobile design), `440px` 8.73→16, `240px`.
- **CL:** 16px at 1440. Segments 1920 (19→22), 1440 (16→19), 1440→992 (11.02→16), 991 (12.39→16), 767 (10→17), 479 (13→17), 280.
- **FT:** global CSS is external (`<link rel="stylesheet" href="https://assets.fedtech.io/index.css">` in the css embed), so its fluid root isn't visible. It presumably uses the same snippet.

**Conclusion:** responsive typography is **variables changed at Webflow breakpoints plus a fluid rem root**. `clamp()` is effectively unused (one CL token). Per-class `font-size` overrides in media queries are rare (BW 1, CL ~6, DL 4).

---

## 5. Typography

| | Heading font | Body font | Secondary font | How it's wired |
|---|---|---|---|---|
| BW | Suisse Intl (`Suisseintltrial`) 400 | Suisse Intl | JetBrains Mono (eyebrow, btn, tag, menu-link, footer-link, tab-btn, dropdowns; uppercase eyebrow, `letter-spacing:+.0625rem`) | `_text-style` modes + `_typo` tokens |
| DL | Thorowgood Grotesque (`"Thorowgoodgrotesque Trial"`), `text-transform:uppercase` on h1–h5/display | PP Neue York (`Ppneueyork`), weight 300 | (h6, btn, body use Neue York) | `_text-style` modes + `_typo` |
| CL | GT Sectra (`Gt Sectra`) 400 | Benton Sans (`Bentonsans`) 400/500 | — | `_typo` tokens referenced directly in class rules (`font-size:var(--_typo---h1); line-height:var(--_typo---line-height--h1); letter-spacing:var(--_typo---letter-spacing--h1)`); headings also `color:var(--_theme---text-heading)` |
| FT | Matter 400/500/600 | Inter 400–700 | — | `_typo` sizes only; line-height/letter-spacing hard-coded per class (`.style-h2{line-height:1.1}`, `.style-h3{letter-spacing:-.02719rem}`) |

- **Heading classes** mirror tags: `h1…h6` and `.style-h1…h6` get identical rules, so semantics and look are decoupled (`h2.eyebrow`, `h3.style-h5`, `h1 > div.style-h3`). Extras: `style-display`, `style-h1-big`, `style-h1-xl` (CL token), `style-sub-h`.
- **Body classes:** Gen A uses `style-body-regular/large/small` (BW) or `style-body-p1/p2/regular` (DL). Gen B uses `style-p1/p2/p3`. **Labels:** `style-label` (CL/FT), `eyebrow`, `headshot`, `style-button-text` / `style-text-button`.
- **Weights** come via `weight-*` combo (`style-p1 medium` is a combo modifier named `medium`; `style-p2 color-text-heading weight-medium`).
- **Text-wrap and clamp helpers** are attribute utilities from custom code: `text-balance`, `text-pretty`, `text-nowrap`, `text-break`, `text-style-2lines/3lines/4lines` (line clamp).
- **Letter-spacing:** negative tracking on everything except mono eyebrows. Values are in rem (`-.075rem` h1 BW; `-.205rem` h1 DL).

---

## 6. Spacing

- **Section rhythm lives on `.content`, not `.section`.**
  - Gen A: `padding: var(--_spacing---section--80) var(--_spacing---global)`, gap `--_spacing---gap--64`.
  - Gen B: `padding: var(--_section---divider-vertical--64|80) var(--_section---divider--container-margin)`, gap `--_spacing---64`.
- **Overrides are combo classes on `.content`** that map to tokens. Examples:
  - `.content.p-32 { padding-top/bottom: var(--_spacing---section--32) }` (Gen A) / `var(--_section---divider-vertical--32)` (Gen B)
  - `.content.pb-global { padding-bottom: var(--_spacing---global) }`
  - `.content.g-32 { gap: var(--_spacing---gap--32) }`
  - `.content.p-100-g-48 { padding-block: …100; gap: …48 }`
  - Responsive tweaks: `@media (max-width:767px){ .content.p-32 { padding-block: var(--_section---divider-vertical--48) } }` (CL)
- **Horizontal gutters:**
  - BW: `--_spacing---global .75rem` (tight edge), `--_spacing---global-2 1.75rem` (text inset).
  - DL: `global 3.75rem → 1rem` on mobile.
  - CL: `divider--container-margin 2vw`.
  - FT: `divider--container-margin 6.25rem` + `wrapper-margin 2rem`.
- **Container max-widths:**
  - BW and DL have none on `.content`. They declare `container-1280px:80rem` but never use it; columns are vw-based (`layout-grid._5-4-3{grid-template-columns:1fr 32.4vw 24.2vw}`).
  - CL: `.content` is full width; `.container` uses `--_section---divider--container 90rem`; layout grids use vw (`grid-layout._2-10{15vw minmax(0,1fr)}`, `column-fill-6{width:47.1vw}`).
  - FT: `.content{max-width:var(--_section---divider--container)}` = 93.75rem.
- **Grids:**
  - `.grid` (3-col, gap `--_spacing---grid-gutter` / `--_section---divider--grid-gutter`); collapses to 2 at ≤991 (FT), 1 at ≤767 (BW/FT) or ≤479.
  - `.layout-grid` (BW, 2-col + `_ratio` modifiers).
  - `.grid-layout` (CL, 12-col-span named modifiers `_2-10`, `_8-4`, `_1-4-7`, `_2-8-2`, `_5-5-2`, `_6-4`).
  - `.grid.for-<context>`.
- **Gap utilities:** inner groups use gap via component classes (`content-head{gap:var(--_spacing---24)}`, `content-headshot{gap:…20}`, `flex-vertical{gap:…14}`), plus standalone `g-24`/`gap-28` (CL), `g-16` (DL), `g-4/g-20` (FT).
- **Scale values:**
  - Gen A: 2/4/5/6/8/10/12/14/16/20/24/32/48/64/80/100/160(/200), section 10–160, gap 12–100.
  - Gen B: 0/1/2/4/6/8/10/12/14/16/18/20/24/28/30/32/40/48/56/64/80/100/128/132, with divider-vertical 24–128 + hero-top.
- **Radius:** `_border-radius` (Gen A) / `_corner` (Gen B), with keys `none|0, 2/3/4/5/6/8/10/12/14/16/24/32/48/100, round`. Larger radii shrink at ≤767.

---

## 7. Color usage

- **Two tiers.** Primitives sit in the Base collection (`--navy`, `--grey--50`, `--white--20`). The semantic theme lives in `_theme` (Gen A/CL). Components consume **only theme tokens** where a theme exists: `.btn{border:1px solid var(--_theme---button--border); background-color:var(--_theme---button--bg); color:var(--_theme---button--text-color)}`, `.section{background-color:var(--_theme---bg--primary); color:var(--_theme---accent--primary)}`. Base-color vars are only referenced by theme vars and by a few `bg-*` / `color-*` utilities.
- **Section background switching:**
  1. **Theme mode class** on the section or wrapper (`section.section.theme-dark`, `section.section.theme-navy`, `section.content-wrap.theme-dark`). This flips bg, text, buttons and borders together for all descendants.
  2. **Component-bound mode**: a component class re-declares the theme (`.nav`, `.fig`, `.card-quote`, `.solution-card`) so it is self-themed anywhere.
  3. **Plain bg utility** (no text flip): `section.section.bg-light-beige` (CL), `div.content.bg-limestone-1` / `content.bg-lime-1` (FT, on the container, which gives inset colored panels framed by the bordered columns).
  4. **Attribute theming** (FT only): `section[theme="light|blue|invert"]`, children with `theme-inherit="1"`, and `[theme-text="White"]`.
  5. **Background media layer**: `div.bg` / `img.bg` / `div.bg-wrap` absolutely positioned behind `.content`, plus overlays (`bg-overlay`, `hero-bg-overlay`, `grain-texture`, `bg-shine`).
- **Text color utilities** point at theme tokens in Gen A (`color-primary-dull → --_theme---accent--primary-dull`) and mostly at primitives in FT (`color-text-grey → --text-grey`, `color-white-75 → --white--75`). CL mixes both (`color-text-heading → theme`, `text-color-grey2 → primitive`).

---

## 8. Custom attributes and custom code

### 8.1 Embed structure
- Every page starts `div.page` with **two `div.css.w-embed`** holding `<style>`. The first is the global layer (fluid root, `--ease: cubic-bezier(.22,.6,.36,1)`, `--ease2`, font smoothing, attribute utilities, richtext resets, accordion/modal/marquee CSS). Size: BW 8.7 KB, CL 27 KB, DL similar to BW; FT loads `assets.fedtech.io/index.css` instead.
- `<head>` styles hold the load-animation guards: `html:not(.ready) [data-anim]{opacity:0}`, `[transition-delay="0…35"]{transition-delay:…}`, `@media (prefers-reduced-motion:no-preference)` failsafes (BW `bw-intro-failsafe`).
- Component-scoped embeds: `div.nav > div.css.w-embed` (nav states), section-local `div.css.w-embed` / `div.hide.w-embed` (marquee item widths, testimonial slider, card link overlay), `div.testimonial-bg-gradient.w-embed` (FT, per item). Icons/videos also come in `w-embed` (`div.icon.w-embed > svg`, `div.w-embed > video`).
- **JS:** Webflow runtime plus jQuery 3.5.1, then an external bundle:
  - BW: a loader that switches between `http://127.0.0.1:3000/index.js` (when `?devMode=true` is stored in localStorage) and `https://bridgewall.vercel.app/`
  - CL: `scl-nine-smoky.vercel.app` (module + `index.css`), Lottie, Finsweet Attributes (`fs-list`)
  - DL: Lenis 1.2.3, webfont.js, and a `.txt`-hosted script on the Webflow CDN
  - FT: `assets.fedtech.io/index.js`, Finsweet (`fs-list`, `fs-rangeslider`), HubSpot forms, iubenda, GTM
  - BW also uses Barba page transitions (`data-barba="wrapper|container"`, `data-barba-namespace`).

### 8.2 Attribute vocabulary
- **Animation:** `data-anim`, `data-anim-opacity/scale/rotate/hero-image`, `data-stagger`, `anim-stagger=".selector"`, `stagger-item`, `stagger-amount`, `anim-element(-up)`, `data-split-text="lines"` + `data-split-text-delay`, `split-line="blur"`, `split-wave-text`, `data-reveal-image(-depth)`, `data-entrance` / `data-entrance-item` / `data-entrance-picture`, `data-parallax`, `parallax-element`, `scroll-parallax`, `data-zoom-in`, `data-scroll-fade`, `data-fade="up"`, `data-float`, `transition-delay="N"`, `from-y="3vw"`, `counter-anim`, `hover-scale`/`hover-scale-img`, `hover-border-glow(-size/-width)`, `line-hover`, `btn-animate-svg`, `divider-anim`.
- **Components:**
  - Carousels: `data-carousel(=marquee)` + `data-carousel-wrapper/-container/-dot(s)`, `carousel`, `carousel-wrapper`, `carousel-btns`, `carousel-prev-btn/-next-btn`, `data-slide-cursor`, `data-slide-classes`, `data-autoplay(-delay)`, `data-fade`
  - Tabs: `data-tabs-comp/-btn/-content/-img/-effect`, `tabs-comp`, `tabs-btn`, `tabs-content`
  - Accordions: `data-accordion(="active")`, `data-accordion-toggle/-body/-list="css"/-close-siblings/-first-active/-collapsible`
  - Modals: `data-modal-name/-target/-close/-close-outside/-content/-item`, `modal`, `open-modal`, `close-modal`
  - Marquees: `data-marquee-*`, `marquee`, `v-marquee`
  - Navigation: `data-nav-wrap`, `data-nav-no-hide`, `nav`, `menu-btn`, `data-scroll-to`, `data-back-to-top`
  - Load-more: `data-custom-loadmore`, `basic-list-load-more*`
  - Video: `video-wrap`, `video-toggle-btn`, `play-icon`/`pause-icon`, `audio-btn`
  - Feature tabs and hotspots (BW): `data-feature-tabs*`, `data-hotspot*`
- **Responsive visibility (attribute-based):** `hide-mobile="1|0"`, `for-mobile="1|0"`, `hide-tablet="1"`, `for-tablet="1|0"`, `hide-mobile-p="1"`. The embed CSS maps them to display:none at 991/767/479. They are mirrored by classes `.hide`, `.hide-tablet`, `.hide-mobile-landscape`, `.hide-mobile`. These look like component props exposed as attributes, which is why `="0"` values appear.
- **Layout/visual helpers:** `clipped-section` / `cliped-section`, `global-padding-v2`, `color-inherit`, `hide-scrollbar`, `fade`, `fade-hori(-left/-right)`, `fade-vert(-top/-bottom)`, `text-balance`, `text-pretty`, `text-style-Nlines`, `z-index-2`, `u-hide-if-empty(-cms)`, `u-hide-if-not-empty(-cms)`, `border-top="1|0"`, `small="1"`, `secondary`.
- **Page identity:** `body[data-page="home|about|civicHonor|programdetail"]` (CL, FT).
- **Webflow:** `data-wf--<component>--variant`, `data-w-id` (IX2 ids), `data-wf-page/site/domain`, `data-wf-ignore` (bg video), `fs-list-*` (Finsweet).

---

## 9. Differences between the four sites

| | Bridgewall | Daniellubetzky | Civicleadership | Fedtech |
|---|---|---|---|---|
| Generation | A | A | B | B (leanest) |
| Collections | Base, `_theme`, `_text-style`, `_typo`, `_spacing`, `_border-radius`, `_other` | Base, `_theme`, `_text-style`, `_typo`, `_spacing`, `_border-radius`, `_size` | Base, `_theme`, `_typo`, `_spacing`, `_section`, `_corner`, `_other`, `_z-indices` | Base, `_typo`, `_spacing`, `_section`, `_corner`, `_other` |
| Theme tokens | grouped `bg--/accent--/button--/secondary-button--/outline-button--` (26) | same family (21) | flat `text-heading/text-body/bg/border/accent` + `button-primary--/button-secondary--` (26) | none (attribute `theme=""`, external CSS) |
| Theme switch class | `theme-dark`, `theme-light`, `theme-base`, `for-hero` | `content-wrap.theme-dark`, `is-dark` | `theme-navy`, `is-navy`, `is-dark`, `theme-invert` | `[theme="light|blue|invert"]`, `theme-inherit` |
| Section structure | `section.section > div.content`, sticky `div.track` | `section/div.section(.overlap-top) > content-wrap(.theme-dark) > div.content` | `section.section > div.content`, footer wrapped in plain div | `section.section > div.content` (bordered, max-width), `.content` also on `<section>` in footer |
| Container width | vw grids, no max-width | vw, no max-width | `--_section---divider--container 90rem` (on `.container`), vw grids | `.content` max-width 93.75rem |
| Typography wiring | text-style modes; Suisse + JetBrains Mono | text-style modes; Thorowgood (uppercase) + PP Neue York | direct `_typo` vars incl. line-height/tracking; GT Sectra + Benton Sans | `_typo` sizes only; Matter + Inter |
| Body text classes | `style-body-regular/large/small` | `style-body-p1/p2/regular` | `style-p1/p2/p3`, `style-label` | `style-p1/p2/p3`, `style-label` |
| Spacing tokens | `section--`, `gap--`, `global/-2` | same + `200`, `section--100/128` | flat `_spacing---N` + `_section---divider-vertical--N` | same as CL |
| Fluid root | 1728 design, 6 segments | identical to BW | 1440 design, 1920 cap | external (not visible) |
| BEM `__` | barely | none | nav/menu (45) | program/sidebar (59) |
| Distinctives | Barba transitions, hotspots, devMode loader | `overlap-top` stacked cards, grain texture, glow hovers | z-index tokens, huge utility set (`max-width-NNN`, `column-fill-N`, 76 `_ratio` classes), Lottie | `corner-curve` decoration (466 uses), bordered columns, HubSpot, many Finsweet filters |
| Size | 217 classes, 895 CSS rules | 260 / 935 | 494 / 3404 | 423 / 1966 |

### Takeaways for reproducing the convention
1. Build the skeleton `div.page > main.main > section.section > div.content`, with nav and footer inside `main`, and `div.bg` siblings for media.
2. Put section padding and gap on `.content` via tokens. Override with `.content.p-NN` / `.content.pb-NN` / `.content.g-NN` combos.
3. Name components `block-element-sub`. Modify with `for-<context>`, `is-<variant>`, `v2`, `_<ratio>`, `theme-<mode>`. Keep global utilities few (`style-*`, `color-*`, `bg-*`, `weight-*`, `hide*`).
4. Variables: Base primitives plus `_theme` (bg/accent/button groups), `_typo` (size + line-height + font-weight + letter-spacing groups), `_text-style` modes, `_spacing` (numeric + `section--` + `gap--`), `_border-radius`. Gen B adds `_section---divider*` for container/gutter/vertical rhythm.
5. Responsiveness: Webflow default breakpoints only (991/767/479). Change variables per breakpoint on `body` and use the fluid `html{font-size}` embed. Avoid clamp and per-class font overrides.
6. Drive behaviour with attributes (`data-anim`, `data-carousel`, `data-accordion`, `data-modal-*`, `hide-mobile="1"`), backed by a global CSS embed and an external JS bundle.
