# PGB Design System — Figma → Webflow

Project Giving Back (PGB). Status: **Phase 1 approved 2026-10-16** (decisions in §11). Nothing has been built or changed in Webflow or Figma yet.

| Source | Role | Access |
|---|---|---|
| Webflow **MCP Test project - Wahab** (`6ad1b57fbbe6f73cf378d7c5`) | Target. It is the agency **starter template** | MCP: read ✅ |
| Webflow **Bridgewall** (`6ab0fe6211be29c7dc45d3de`) | Built from the same starter. Real example of the system in use | MCP: read ✅ (earlier in the session) |
| Webflow **Copy of SCL - Last** (`6aaab58b76a1c4f14bf166a3`) | Primary reference. Built from the same starter, then evolved | MCP: read ✅ (see §9) |
| Published: bridgewall-vovi.webflow.io, civicleadership.utexas.edu, daniellubetzky.com, fedtech.io | Secondary references | `reference/<site>/` (HTML + CSS, curl) |
| Figma **PGB - Wahab Test file** (`heYeWQsLkUouDVC11lmjFo`) | Design to build | read ✅ |
| Figma **SCL - Website (External)** (`nf9Q4SO4piU4Pk7yZLf3qo`) | Example of Figma variable setup | read ✅ |

Raw research: `reference/_notes/` (published-site analysis, plus Bridgewall and SCL variable and class dumps).

> **Webflow MCP access:** the connector authorizes one site at a time. Right now it's connected to SCL. The **target must be reconnected before Phase 3.**

**Decisions so far (2026-10-16):**
- Keep the **Gen A starter** system that is already in the target project. Fill it with PGB values. Don't delete anything.
- Breakpoints are Desktop / Tablet / Mobile, plus a fluid root based on the 1728 design.
- The final homepage is Figma frame `1:3489`.
- Scope is the homepage only, static (no CMS).
- Use the Iskry TEST trial fonts for now.
- JS loads from a new PGB Vercel project.

---

## 1. Layout structure

### 1.1 Page skeleton (starter template, confirmed on target Home)

```
body                                   (data-page="home" set in page settings for the JS router)
└─ div.page                            ← "Dev - Page Starter" component root
   ├─ [Global CSS]                     component: global <style> (fluid root, helpers, attribute utilities)
   ├─ [Dev | Refrense Grid]            component: dev-only column overlay
   ├─ div.css (HtmlEmbed)              page-level <style>
   └─ main.main
      ├─ div.nav                       nav lives INSIDE main (fixed)
      ├─ section.section[.theme-*]     ← "Dev - Section Starter" component (Class prop = theme combo)
      │  ├─ div.bg                     optional absolute media layer (img/video), sibling of .content
      │  └─ div.content[.for-<ctx>]    THE container: flex column, padding + gap live here
      │     └─ section-specific elements (content-head, content-body, grid, …)
      └─ footer.section                footer also inside main
```

Rules seen on all four reference sites:
- **`.section` has no padding.** It only sets `background-color: var(--_theme---bg--primary)` and `color: var(--_theme---accent--primary)`. Its theme comes from a combo (`theme-dark`, `theme-brand`).
- **`.content` holds the section rhythm.** It is `display:flex; flex-direction:column; padding: var(--_spacing---section--80) var(--_spacing---global); gap: var(--_spacing---gap--64)`.
- **Several `.content` blocks** in one section are fine (Bridgewall uses `content.for-header` followed by `content.for-xp`).
- **Full-bleed sections** (carousels, hero media) may skip `.content`. Bridgewall has `section.section.theme-dark > div.solution-carousel-outer`.
- **`div.bg`** is `position:absolute; inset:0`. It holds background media and overlays.
- **Sticky stacks:** `div.track` wraps sticky sections (`.section.is-sticky`). Bridgewall only.
- **`.section.has-nav-space`** adds `padding-top: navbar height` for the first section under the fixed nav.

### 1.2 Variations
| Variation | Where | Use when |
|---|---|---|
| `section.section > div.content-wrap.theme-dark > div.content` | Daniel Lubetzky | Rounded "card" sections with an overlap (`.overlap-top{margin-top:-1rem}`). Not needed for PGB |
| `div.section > section…` | Lubetzky, Civic Leadership footer | Wrapping a section in a section. Avoid unless needed |
| `.content` with `max-width` + `margin:auto` | Gen B (FedTech/SCL) | Not in the starter. The starter uses full-width `.content` with `--_spacing---global` side padding |

---

## 2. Class naming convention

**Grammar:** kebab-case and component-first: `block`, `block-element`, `block-element-sub`.
- Examples: `project-block`, `project-block-fig`, `project-block-text`, `footer-menu-block`.
- No prefixes (no `u-` or `c-`). No BEM `__`, except for imported snippets.

**Combo / modifier classes** always sit on a base class:
| Family | Meaning | Examples |
|---|---|---|
| `for-<context>` | Context-specific variant (most common) | `content.for-hero`, `fig.for-story`, `grid.for-gallery` |
| `is-<x>` | Variant/size/state | `icon.is-24px`, `content.is-full`, `btn.is-secondary` |
| `theme-<mode>` | Switches the Theme variable mode | `section.theme-dark`, `section.theme-brand` |
| `v2`, `v3` | Design version of a component | `hotspot-icon.v2` |
| `_<ratio/cols>` | Numeric (Webflow can't start a class with a digit) | `grid._2-column`, `layout-grid._5-4-3`, `fig._1-78-1` |
| `p-NN` / `pt-` / `pb-` / `g-NN` | Override `.content` padding/gap with tokens | `content.p-32`, `content.pb-0`, `content.g-48` |
| `weight-NNN` | Weight tweak on a type class | `style-body-regular.weight-500` |
| `has-<x>` / `no-<x>` | Opt in/out | `section.has-nav-space` |

**Global utilities** (keep these few): `style-*` (type), `color-*` (theme text colours), `weight-*`, `hide`, `overflow-hidden`, `absolute-link`, `bg`.

**State classes** are toggled by JS: `active`, `open`, `is-scrolled`, `w--current`.

**Behaviour hooks are attributes, never classes:** `data-split-text`, `data-fade`, `data-parallax`, `data-carousel`, `data-accordion*`, `data-modal-*`, `hide-mobile="1"`. JS must never select by style class.

### 2.1 Classes that already exist in the target (reuse first)
- **Layout:** `page`, `main`, `section` (+`theme-dark`, `theme-brand`), `content`, `content-head`, `content-body`, `content-headshot`, `grid` (+`_2-column`), `bg`, `absolute-link`, `overflow-hidden`
- **Type:** `style-display`, `style-h1`…`style-h6`, `style-body-regular`, `style-body-medium`, `style-body-large` (+`weight-500/600`), `chiptext`, `weight-500`, `weight-600`
- **Buttons:** `btn` (Text Style mode "Button", theme button tokens, radius `3`), `button-inner` (3rem tall, 12/24 padding), `button-group`, `icon` (+`is-20/24/32/48/52px`)
- **Components:** `accordion*`, `carousel*`, `slide`, `video-player`, `video-controls`, `video-overlay`, `video-src`, `ui-*`
- **Style guide:** `sg-*`, `style-guide-*`, `dev-debug`, `rf-grid`, `rf-column`

---

## 3. Webflow variables (Gen A starter)

### 3.1 How the names are encoded
- `--<name>` means the default collection (Colors). Groups use `/`, which becomes `--`: `Neutral/100` → `--neutral--100`.
- `--_<collection>---<group>--<name>` is used for every other collection. Examples: `--_theme---bg--primary`, `--_typo---line-height--h1`.

### 3.2 Collections in the target today
| Collection | Modes | Contents (current placeholder values) |
|---|---|---|
| **Colors** | Base | `Black`, `White`, `Transparent`, `Brand/100–300` (#003bff blues), `Neutral/100–500` (greys) |
| **Theme** | **Base, Dark, Brand** | `BG/Primary`, `BG/Secondary`, `BG/Tertiary`, `Accent /Primary` (note: stray space in the name), `Accent/1–3`, `Button/BG, Border, Text Color`, `Secondary Button/BG, Border, Text Color`, `Outline Button/BG, Border, Text Color`. All alias Colors |
| **Spacing** | Base, **T**, **L** | `Global` (1.5rem → L 1rem), `Grid Margin`, `Grid Gutter` (1.25 → L 1), numeric `2–160`, `None`, `Gap/12–80`, `Section/64, 80` |
| **Border Radius** | Base, **L** | `Round` (100%), `32`, `24`, `16`, `12`, `8`, `5`, `3`, `None` |
| **Size** | Base, T, L | `Container - 1280px` (80rem) |
| **Typo** | Base, **T**, **L** | Sizes `Display`, `H1–H6`, `Body/Regular, Medium, Large`, `Other/Text Chip`, `Other/Button`. Groups `line-height/*`, `font-weight/*`, `letter-spacing/*` per style |
| **Text Style** | Base + one mode per style: Display, H1–H6, Medium, Large, Chip Text, Button | 5 variables: `font-family`, `font-size`, `line-height`, `font-weight`, `letter-spacing`. Each mode aliases the matching Typo variables. `font-family` is Arial everywhere |

### 3.3 How the modes are wired (confirmed on target and Bridgewall)
- **Breakpoint modes** are set on the `body` tag. At **medium (≤991)**, Spacing, Typo and Size switch to **T**. At **small (≤767)**, Spacing, Typo, Size and Border Radius switch to **L**. **Tiny (≤479)** has no override, so it inherits L.
- **Theme modes** are set by a combo class. `body` uses Theme Base. `section.theme-dark` uses Dark and `section.theme-brand` uses Brand. Components can also bind their own mode (Bridgewall's `.nav` and `.fig` force Dark).
- **Text Style modes** are set by the type class. Each type class (`style-h1`, `h1` tag, `btn`, `chiptext`…) binds `font-*` to `--_text-style---*` and sets one Text Style mode. So `style-h1` gives H1 values, and `btn` gives Button values. To restyle a type ramp, change the Typo variables. Never override per class.
- **Responsive overrides:** Bridgewall adds per-breakpoint combos such as `style-h1.h2-mobile`. This is rare; the variables do the work.

### 3.4 Fluid root (Global CSS component)
`html{font-size: calc(var(--base)*1rem + var(--coefficient)*1vw)}` scales everything set in rem.
- Bridgewall's segments (also designed at 1728) give 16px at 1728.
- They also lock 16px at 990, 767 (mobile design 440) and 440.
- PGB uses the same 1728 basis, so **1rem = 16px at 1728**. All variables are in rem.

---

## 4. Breakpoints

| Figma mode (Phase 2) | Webflow breakpoint | Variable mode | Notes |
|---|---|---|---|
| **Desktop** (1728 design) | main (base) | Base | Fluid root scales this from ~991 up to 4000px |
| **Tablet** | medium ≤ 991 | T | No tablet design in Figma, so values must be derived (question Q5) |
| **Mobile** | small ≤ 767 (and tiny ≤ 479) | L | No mobile design in Figma (Q5) |

- Webflow also has large, xl and xxl breakpoints (≥1280/1440/1920). The system doesn't use them, because the fluid root handles large screens.
- Per-class layout changes (grid columns, flex direction) go on the class at medium/small/tiny. Values always use variables.

---

## 5. Typography, spacing and colour patterns

- **Typography:** fonts reach classes only through `--_text-style---font-family`. Tags and `style-*` classes share rules, so heading level and look are independent. For example, `h2` can carry `style-body-large`.
- **Spacing:** the scale is numeric (`--_spacing---24`). Use `Section/*` for vertical section padding, `Gap/*` for flex/grid gaps, and `Global` for the page side gutter. Section overrides are `.content` combos (`p-NN`, `pb-NN`, `g-NN`).
- **Colour:** two tiers. Colors are primitives, and Theme is semantic. Elements bind **only Theme variables**. Colors are referenced only by Theme.

---

## 6. Example Figma file (SCL - Website External): how variables are set up

| Collection | Modes | Pattern |
|---|---|---|
| **Sections** | 6 breakpoint modes: HD Desktop >1921, Desktop 1441–1920, Laptop 1281–1440, Small Laptops 768–1280, Tablet 381–768, Mobile <480 | `Dividers/Wrapper`, `Dividers/Container`, `Dividers/Container Margin`, `Dividers/Wrapper Margin`, `Dividers/Grid Gutter`, `Divider Vertical Margins/128…32` |
| **Spacing** | same 6 | `128…0` numeric. Scope GAP |
| **Corners** | same 6 | `100…0` numeric. Scope CORNER_RADIUS |
| **Colours** | Default | Flat brand names (`Site BG`, `Off Black`, `Limestone 1–4`, `Carbon`, `Blue`, `White-28`…). Scopes are fills/stroke |
| **Typography** | same 6 | `Fonts/Headings, Body, Buttons, Labels` (STRING), `Typscales/*` (FONT_SIZE), `Line Heights/*` (LINE_HEIGHT) |
| **Text styles** (14) | — | `H1 (Big)`, `H1 (Smaller)`, `H2`–`H6`, `Sub heading`, `P1 (Regular)`, `P1 (Medium)`, `P2`, `P3`, `Buttons`, `Labels`. Each binds fontFamily, fontSize, lineHeight and paragraphSpacing to variables |

What I'll copy from it:
- Collections split by token type.
- Breakpoint modes on the responsive collections.
- Explicit scopes on every variable.
- Text styles bound to variables.

What I'll change:
- Collection and variable **names** follow the Webflow starter (Gen A), not SCL's Gen B names.
- 3 modes instead of 6 (your decision).

---

## 7. Target Figma inventory (PGB - Wahab Test file)

**File:** one page ("Page 1") with no variables, text styles, paint styles or local components. The instances used are `Nav` ×12, `Footer` ×13 and `Button` ×32.

**Page groups (label frames `.` mark each group):**
| Page | Final design (1728) | Other frames |
|---|---|---|
| Homepage | **`1:3489`** ✅ final | `1:827` (alt version), `Option 1–4` (section variants), `V2 · 01 Home` (1440 wireframe) |
| Garden index | `1:2161` "Index pg" | `V2 · 02` wireframe |
| Garden specific | `1:1183` | `V2 · 03` wireframe, `Designer block — 2/3 designers` |
| Documentary | `1:1850`, `1:1339` | `Hover state`, `V2 · 05` |
| Book | `1:1764` | `grid 1:1835`, `V2 · 04` |
| About us | `1:1470` | `V2 · 06` |

### 7.1 Homepage `1:3489` sections
| # | Figma layer | Content | Bg | Proposed Webflow structure |
|---|---|---|---|---|
| 0 | `Nav` (instance) | Stone pill with Gardens / About us / Hortophilia (NEW badge) / Gardens for Good. Wordmark "PROJECT GIVING BACK" in the centre. "Explore the book" button with an arrow box | transparent | `div.nav` (fixed, inside `main`) |
| 1 | `Section / Title` | "GOOD CAUSES. EXTRAORDINARY GARDENS." Iskry 64 uppercase, centred. Padding 160 top / 48 bottom | cream | `section.section.has-nav-space > div.content.for-title > h1.style-h1` |
| 2 | `Section / Hero` | Full-bleed image/video. "Unmute" + sound button bottom-left. Caption bottom-centre (Geist Light 20, white) | image | `section.section.for-hero > div.bg > video/img` + `div.content.for-hero` (controls + caption) |
| 3 | `Section / Ethos` | "Our Ethos" label. Centred intro (Geist 20). 4 staggered photos (260/544/402/402 wide, top-aligned, gap 24). Padding 32/24/128/24, gaps 80 and 160 | cream | `section.section > div.content.for-ethos > div.content-head + div.ethos-gallery > div.ethos-fig._*` |
| 4 | `grid` (book) | "The Book" label. "GARDENS" + "FOR GOOD" (Iskry 70, cream) either side of the book cover. Paragraph + "Learn more" button. **5 hidden 1340px image frames** (probably for a scroll animation; Q8) | olive #3a3923 | `section.section.theme-dark.for-book > div.content.for-book` |
| 5 | `Section / Featured gardens` → `Featured content` | "Featured Gardens" label. Intro (Geist 18) + "View all Gardens" button. 2 garden cards: The WaterAid Garden (tall image) and a second card with a "Learn more" hotspot and 3 specimen chips (Species, Soil type…) | stone #e3e1d4 | `section.section.theme-brand > div.content.for-featured > div.content-head + div.garden-cards > div.garden-card` |
| 6 | (inside Featured) `Frame 2121463982` | "Hortophilia" full-bleed image with a 20% black overlay. Hand-lettered logo (image). Paragraph + "Learn more" | image | `section.section.for-hortophilia > div.bg + div.content` |
| 7 | `Footer` (instance, nested in Featured in Figma) | Logo mark. Links / Get in touch columns. Big "PROJECT GIVING BACK" wordmark. Cookies / Privacy / legal / socials | olive | `footer.section.theme-dark > div.content.for-footer-top + div.content.for-footer-bottom` |
| — | stray | Two "Built for purpose" texts and a duplicate `Nav` instance at the bottom of the frame | — | **ignore** |

### 7.2 Homepage type specs (visible text only)
| Use | Font | Size / line-height / tracking | Case | Colour |
|---|---|---|---|---|
| Book words "GARDENS / FOR GOOD" | Iskry TEST Three | 70 / 98.9 (1.41) / −3% | UPPER | cream |
| Page title | Iskry TEST Three | 64 / 56 (0.88) / −3% | UPPER | olive |
| Intro paragraph | Geist Regular | 20 / 29 (1.45) / 0 | — | olive |
| Hero caption | Geist Light | 20 / 34.7 (1.74) / 0 | — | white |
| Featured intro | Geist Regular | 18 / 23 (1.28) / −0.16px | — | olive |
| Section label ("Our Ethos"), card title | Geist Medium | 16 / 22 (1.38) / −0.5px | Title | olive / cream |
| Body / captions | Geist Regular | 15 / 19 (1.27) / −0.16px | — | olive / white |
| Nav + footer links | Geist Regular/Medium | 14 / 20.7 (1.48) / −0.1px | — | olive / cream / stone |
| Buttons ("View all Gardens", "Unmute", "Explore the book") | Geist Regular | 14 / 14 (1) / −0.28px | — | olive / stone |
| Buttons ("Learn more") | **Neue Haas Unica W1G** Regular | 14 / 14 / −0.28px | — | #373f1d |
| Specimen chips | Geist Regular | 12 / auto / −1% | — | #a9ac9e label, olive value |
| "NEW" badge | Geist Regular | 9 / 17.9 | — | white |

### 7.3 Homepage colours
cream `#f5eee9` (page bg) · stone `#e3e1d4` (Featured bg, nav pill, buttons) · olive `#3a3923` (text, book and footer bg) · deep olive `#373f1d` (button text) · sage grey `#a9ac9e` (chip labels) · white · black at 20% (image overlay).

Across all the final 1728 frames there are more: `#34372b`, `#3e4330`, `#272b25`, `#2b3227`, `#3e3d27`, `#666b56`, `#271c16`, `#020202`, plus off-whites `#f3f2eb`, `#f5f1e8`, `#fcfaf6`, `#fafafa`, `#eae6dc` (see Q3).

### 7.4 Homepage spacing and radius
- **Side gutter:** 24, so content is 1680 wide inside 1728. The starter's `Global` is already 1.5rem = 24px.
- **Section paddings:** 160 / 48 (title), 32 / 24 / 128 / 24 (Ethos, Featured).
- **Gaps:** 24, 80, 100, 128, 160.
- **Nav:** padding 16 / 32, height 72. The pill is 40 tall.
- **Buttons:** 30 tall (24 in the book section), padding 4 / 10. The arrow box is a separate square.
- **Radius:** **2px** almost everywhere (buttons, nav pill, images). Stray values: 0.3, 1, 2.1, 2.8, 4.1.

---

## 8. Mapping: Figma variables → Webflow variables

Phase 2 creates these in Figma. Names mirror the Webflow starter, so `Theme/BG/Primary` in Figma is `--_theme---bg--primary` in Webflow. Figma modes: Desktop = Base, Tablet = T, Mobile = L.

> Values in **bold** come from the homepage design. "Q5" cells mean I'll propose the tablet and mobile values in the Phase 2 report for your review.

### 8.1 Colors (Webflow collection "Colors", Figma collection "Colors", 1 mode)
| Figma variable | Webflow variable | CSS | Value |
|---|---|---|---|
| `White` | `White` (exists) | `--white` | #ffffff |
| `Black` | `Black` (exists) | `--black` | #000000 |
| `Transparent` | `Transparent` (exists) | `--transparent` | rgba(255,255,255,0) |
**Decision (Q3): one token per distinct colour in the final 1728 designs.** Names are family/step, where 50 is the lightest and 950 the darkest. Opacity variants follow SCL's `Navy 12%` style.

| Figma variable = Webflow variable | CSS | Value | Used on |
|---|---|---|---|
| `Cream/50` | `--cream--50` | #fcfaf6 | inner pages |
| `Cream/75` | `--cream--75` | #f5f1e8 | inner pages |
| `Cream/100` | `--cream--100` | **#f5eee9** | **homepage** page bg |
| `Stone/50` | `--stone--50` | #f3f2eb | inner pages |
| `Stone/75` | `--stone--75` | #eae6dc | inner pages (text on dark) |
| `Stone/100` | `--stone--100` | **#e3e1d4** | **homepage** Featured bg, nav pill, buttons |
| `Sage/400` | `--sage--400` | **#a9ac9e** | **homepage** chip labels |
| `Olive/400` | `--olive--400` | #666b56 | inner pages |
| `Olive/600` | `--olive--600` | #3e4330 | inner pages |
| `Olive/650` | `--olive--650` | #3e3d27 | inner pages |
| `Olive/700` | `--olive--700` | **#3a3923** | **homepage** text, book and footer bg |
| `Olive/750` | `--olive--750` | **#373f1d** | **homepage** button text |
| `Olive/800` | `--olive--800` | #34372b | inner pages (dark bg) |
| `Olive/900` | `--olive--900` | #2b3227 | inner pages |
| `Olive/950` | `--olive--950` | #272b25 | inner pages (text, strokes) |
| `Bark/900` | `--bark--900` | #271c16 | inner pages |
| `Ink/900` | `--ink--900` | #0a0a08 | inner pages |
| `Ink/950` | `--ink--950` | #020202 | inner pages (text) |
| `White`, `Black`, `Transparent` | `--white`, `--black`, `--transparent` | exist | all |
| `Black 20%` | `--black-20` | rgba(0,0,0,.2) | **homepage** image overlay |
| `Stone 62%`, `Stone 23%` | `--stone-62`, `--stone-23` | #e3e1d4 at 62% / 23% | text/lines on dark |
| `Cream 67%`, `Cream 16%` | `--cream-67`, `--cream-16` | #f5eee9 at 67% / 16% | text/lines on dark |
| `White 60%` | `--white-60` | #ffffff at 60% | captions on images |
| `Olive 10%` | `--olive-10` | #373f1d at 10% | tints |

**Confirm in Phase 2:** single-use values (1–3 uses each), which may sit inside illustrations or mockups rather than the UI. They are `#696313`, `#bebd87`, `#c7b972`, `#fffef1`, `#57503e`, `#5f6450`, `#282a22`, `#383737`, `#333231`, `#6a6c62`, `#666551`, `#e3e0d4`, `#fafafa`, `#3e3d27 @5%` and `#272b25 @73%`. `#d9d9d9` is Figma's default image-placeholder fill, so it isn't a token.

**Decision (Q2):** the starter placeholders `Brand/100–300` and `Neutral/100–500` get **removed**. Theme aliases them, so in Phase 3 Theme is re-pointed to the PGB colours first, and the placeholders are deleted after that. You approved this on 2026-10-16.

### 8.2 Theme (modes Base / Dark / Brand, in both Figma and Webflow)
| Figma / Webflow variable | CSS | Base (cream sections) | Dark (book, footer) | Brand (featured) |
|---|---|---|---|---|
| `BG/Primary` | `--_theme---bg--primary` | Cream/100 | Olive/700 | Stone/100 |
| `BG/Secondary` | `--_theme---bg--secondary` | Stone/100 | Olive/800 | Cream/100 |
| `BG/Tertiary` | `--_theme---bg--tertiary` | Olive/700 | Cream/100 | Olive/700 |
| `Accent /Primary` | `--_theme---accent--primary` | Olive/700 | Cream/100 | Olive/700 |
| `Accent/1` | `--_theme---accent--1` | Olive/750 | Stone/100 | Olive/750 |
| `Accent/2` | `--_theme---accent--2` | Sage/400 | Stone 62% | Sage/400 |
| `Accent/3` | `--_theme---accent--3` | White | White | White |
| `Button/BG` | `--_theme---button--bg` | Stone/100 | Stone/100 | Cream/100 |
| `Button/Border` | `--_theme---button--border` | Transparent | Transparent | Transparent |
| `Button/Text Color` | `--_theme---button--text-color` | Olive/700 | Olive/700 | Olive/700 |
| `Secondary Button/*`, `Outline Button/*` | | Kept, re-pointed to PGB colours (dark nav button "Explore the book" = Olive/700 bg + Stone/100 text) |

### 8.3 Spacing (modes Desktop/Tablet/Mobile ↔ Base/T/L)
| Figma | Webflow | CSS | Desktop | Tablet | Mobile |
|---|---|---|---|---|---|
| `Global` | `Global` (exists) | `--_spacing---global` | 1.5rem (24) | 1.5rem | 1rem |
| `Grid Gutter` | `Grid Gutter` (exists) | `--_spacing---grid-gutter` | **1.5rem (24)** (currently 1.25) | Q5 | Q5 |
| `Section/160` | **new** | `--_spacing---section--160` | **10rem** | Q5 | Q5 |
| `Section/128` | **new** | `--_spacing---section--128` | **8rem** | Q5 | Q5 |
| `Section/48` | **new** | `--_spacing---section--48` | **3rem** | Q5 | Q5 |
| `Section/32` | **new** | `--_spacing---section--32` | **2rem** | | |
| `Gap/160`, `Gap/128`, `Gap/100` | **new** | `--_spacing---gap--160/128/100` | **10 / 8 / 6.25rem** | Q5 | Q5 |
| `Gap/80`, `Gap/24` … | exist | | 5rem, 1.5rem | | |
| `2…160`, `None` | exist | `--_spacing---N` | unchanged | | |

### 8.4 Border Radius (Figma modes Desktop/Mobile ↔ Base/L)
| Figma | Webflow | CSS | Value |
|---|---|---|---|
| `2` | **new** `2` | `--_border-radius---2` | **0.125rem** (the PGB default) |
| `3`, `5`, `8`…`32`, `Round`, `None` | exist | | unchanged |

### 8.5 Size + Z-indices (Q11: adopted from SCL)
| Figma | Webflow | CSS | Value |
|---|---|---|---|
| `Size/Navbar Height` | **new** in Size | `--_size---navbar-height` | **4.5rem (72)**, T = same, L = Q5 |
| `Size/Container - 1280px` | exists | `--_size---container-1280px` | unchanged |
| `Z-indices/nav`, `subnav`, `modal`, `modal-level-2` | **new collection** Z-indices (1 mode) | `--_z-indices---nav` … | 100000 / 99999 / 100001 / 100002 (SCL values. SCL sets subnav to 100000, the same as nav; PGB uses 99999, which is what civicleadership publishes) |

SCL's `Section` collection and a radius T mode are **not** adopted.

### 8.6 Typo + Text Style (Figma text styles bind to the Typo variables)
| Figma text style | Webflow class / Text Style mode | Typo size var | Desktop value | line-height | weight | tracking | font |
|---|---|---|---|---|---|---|---|
| `Display` | `style-display` / Display | `Display` | **4.375rem (70)** | **1.0** (Q6: Figma's 1.41 looks like an unset auto value) | 400 | −0.13rem (−3%) | Iskry |
| `H1` | `style-h1`, `h1` / H1 | `H1` | **4rem (64)** | **0.88** | 400 | −0.12rem (−3%) | Iskry |
| `H6` (label) | `style-h6` / H6 | `H6` | **1rem (16)** | 1.38 | 500 | −0.03125rem | Geist |
| `Body/Large` | `style-body-large` / Large | `Body/Large` | **1.25rem (20)** | 1.45 | 400 | 0 | Geist |
| `Body/Medium` | `style-body-medium` / Medium | `Body/Medium` | **1.125rem (18)** | 1.28 | 400 | −0.01rem | Geist |
| `Body/Regular` | `style-body-regular`, `body` / Base | `Body/Regular` | **0.9375rem (15)** | 1.27 | 400 | −0.01rem | Geist |
| `Body/Small` | **new** `style-body-small` / **new mode Small** | **new** `Body/Small` | **0.875rem (14)** | 1.48 | 400 | −0.00625rem | Geist |
| `Button` | `btn` / Button | `Other/Button` | **0.875rem (14)** | 1 | 400 | −0.0175rem | Geist (Q7: Neue Haas Unica dropped) |
| `Chip Text` | `chiptext` / Chip Text | `Other/Text Chip` | **0.75rem (12)** | 1.2 | 400 | −1% | Geist |
| H2–H5 | `style-h2…h5` | | Not used on the homepage. Values come later from inner pages | | | | |

**Text Style `font-family`** becomes per mode: Display/H1 = Iskry, the rest = Geist. The default (Base) is Geist.

### 8.7 PGB Figma library → Webflow (decision 2026-10-16: the library is the Figma source of truth)
The design file already links to a remote **PGB library** (not subscribed in this file; links came in with the copied designs). Its collections are Colours, Spacing, Sections, Corners and Typography. Collections from other kits that also show up (Primitive, Semantic, UI Styles, Color Schemes, Primitives, Spacing & Sizing, and the Roboto `Text/*` styles) are **not** PGB and are ignored.

**Library modes → Webflow:**

| Library mode | Webflow mode |
|---|---|
| HD Desktop (>1921) | Base (same values as Desktop, except `Dividers/Wrapper` 1728 vs 1440) |
| Desktop (1441–1920) | Base |
| Tablet (381–768) | T (≤991) |
| Mobile (<480) | L (≤767) |

The library's tablet and mobile values replace the Q5 proposals wherever a library variable exists.

| Library | Webflow | Values D / T / M |
|---|---|---|
| Colours/`Paper` | Colors `Cream/100` | #f5eee9 |
| Colours/`Sand` | Colors `Stone/100` | #e3e1d4 |
| Colours/`Ink` | Colors `Olive/700` | #3a3923 |
| Colours/`Stone` | Colors `Sage/400` | #a9ac9e |
| Colours/`White`, `Site BG` | Colors `White` | #ffffff |
| Colours/`Text Colour` | Colors (new) `Charcoal/900` *to confirm* | #333231 |
| Spacing/`N` (0,1,4,6,8,10,12,14,16,24,28,32,48,64,80,100,128) | Spacing `N` (`--_spacing---N`) | e.g. 100 = 100/64/64, 128 = 128/80/80, 48 = 48/34/34 |
| Sections/`Divider Vertical Margins/64…160` | Spacing `Section/N` | 160 = 160/140/80, 128 = 128/100/64, 100 = 100/80/64, 80 = 80/48/48, 64 = 64/48/48 |
| Sections/`Dividers/Grid Gutter` | Spacing `Grid Gutter` | 24/20/16 |
| Sections/`Dividers/Wrapper Margin` | Spacing `Global` | 24/32/20 (the starter has 24/24/16) |
| Sections/`Dividers/Wrapper`, `Grid Span 1–7`, `Grid Offset 1 col` | Grid columns on `.content` (not variables) *to confirm* | Wrapper 1728/1440/768/440 |
| Corners/`2`, `6` | Border Radius `2` (new), `6` (new) | 2, 6 at every size |

| Library text style | Webflow class | Spec |
|---|---|---|
| `Shared/Body` | `style-body-regular` / `body` | Geist 15/19, −0.16 |
| `Shared/Small` | `style-body-small` | Geist 14/20.7, −0.1 |
| `Shared/Small Medium` | `style-body-small` + `weight-500` | Geist Medium 14/20.7 |
| `H3/Desktop` | `style-body-large` (named H3 in the library) *to confirm* | Geist 20/29 (T 19/27, M 18/25) |
| `Shared/Eyebrows` (and the unbound duplicate `eyebrow`) | `style-h6` | Geist Medium 16/22, −0.5, Title Case (T 15/21, M 14/20) |
| `Shared/Buttons` | `btn` | Geist 14/14, −0.28 |
| `Shared/Hero caption` | new `style-caption` | Geist Light 20/34.7 (T 18/30, M 16/26) |
| `Shared/Tag` | new `style-tag` (the 9px NEW badge) | Geist 9/17.9 |

**Applied (2026-10-16)** to homepage `1:3489` on Page 1. Remote Nav, Footer and Button instances aren't touched. Page 2 (`16:1319`) is the user's reference copy and is never edited. Its homepage `16:3986` was briefly rebound, then reverted to its earlier local bindings.

**Not in the library** (kept on the local collections for now): `Body/Medium` 18/23, `Chip Text` 12/14.4, `Olive/750` #373f1d, `Black 20%`, the Medium 16 card titles (no non-eyebrow style), and Display/H1 (Iskry, missing font).

---

## 9. Primary reference (SCL) vs the starter and the published sites

### 9.1 Key finding: SCL evolved from the same starter
SCL's collection IDs are **identical** to the target starter's. It's the same starter, renamed and extended:

| Starter (target) | SCL ("Copy of SCL - Last") | What changed |
|---|---|---|
| Colors | Colors | Same collection. SCL has flat brand names (`Navy`, `Limestone 1–4`, `Burnt Orange`, `Text Grey`, `Border-Beige`…) plus a few groups (`Primary/Orange 1`, `Text/primary`). Aliases like `Site BG → White` |
| Typo (Base/T/L) | Typo (Base/T/L) | Same collection. Sizes `H1 - XL`, `H1 - Big`, `H1–H6`, `Body/P1–P3`, `Other/Label, Headshot, Button`. Groups are **capitalised** (`Line Height/*`, `Letter Spacing/*`). Adds `Font/Heading`, `Font/Body` (FontFamily). No font-weight group. One `clamp()` token (`H4-22-20`) |
| Spacing (Base/T/L) | Spacing (Base/T/L) | Same collection, but **flat numeric only** (`0…132`) with **T/L values on most steps** (128 → 5rem, 64 → 3/2.5rem…). `Global`, `Gap/*` and `Section/*` were removed |
| Border Radius (Base/L) | **Corner** (Base/**T**/L) | Renamed. Adds a T mode and steps 0/3/5/6/8/10/12/14/16/24/32/48/100/Round |
| Size (Base/T/L) | **Other** (Base/T/L/**Mob**) | Renamed. `nav-height`, `banner-height`, `nav-v`. Mob mode at tiny |
| Theme (Base/Dark/Brand) | **Theme** (Base/**Navy**), a *new* collection | Rebuilt as flat semantic names: `Bg`, `BG 2`, `Text Heading`, `Text Body`, `Text Body 2`, `Text Contrast`, `Border`, `Border 2–4`, `Accent`, `Active color`, `Active accent`, `Custom Accent`. Plus `button-primary/*` and `button-secondary/*` (background, text, border, plus `-hover` variants) |
| Text Style (mode per style) | — (**removed**) | Type classes bind `Typo` vars directly. `style-h1 { font-size: H1; line-height: Line Height/H1; letter-spacing: Letter Spacing/H1; font-family: "Gt Sectra" }`. The font family is hard-coded, not bound to the `Font/Heading` var |
| — | **Section** (Base/T/L), new | `Divider/Container` 90rem, `Divider/Container Margin` (2vw/2rem/1.25rem), `Divider/Grid Gutter` (1.25vw/1.25rem), `Divider/Wrapper Margin` 0, `Divider Vertical/Hero Top, 128…32` |
| — | **Z-indices**, new | `nav`, `subnav`, `modal`, `modal-level-2` |

### 9.2 SCL wiring (verified in the Designer)
- **Breakpoint modes on `body`:**
  - medium: Spacing, Typo, Other, Section and Corner switch to **T**.
  - small: the same collections switch to **L**.
  - tiny: Section stays at **L** and Other switches to **Mob**.
- **Theme:** `body` is Base. `section.theme-navy` sets Navy and re-binds bg/color.
- **`.section`:** `position:relative; z-index:1; overflow:clip; padding-inline: Divider/Wrapper Margin; background: Theme/Bg; color: Theme/Text Body`.
- **`.content`:** `display:flex; column; width:100%; margin-inline:auto; padding-block: Divider Vertical/*; padding-inline: Divider/Container Margin; gap: Spacing/64`. Overrides: `.content.p-32 { padding-block: Divider Vertical/32 }`, with a different var at small. Compound combos also exist, like `.content.p-32-g-100`.
- **`.container`:** `max-width: Divider/Container; margin auto; padding-inline: Container Margin`.
- **Skeleton (Home):** `body[data-page="home"] > div.page > [Global CSS] + [Dev | Refrense Grid] + div.css + main.main > [Navbar] (component with variant, Nav Banner slot) + section.section.theme-navy > div.content.for-home + div.bg + …`.
  - Most sections are **components**: `Section - Video Section`, `Section - Our People`, `Section - What our students say` (Class prop = `bg-light-beige`), and `CTA + Footer`.
  - Hidden sections stay in the page (`visibility:false`).
- **Classes:** 2,089 styles (1,046 global, 1,018 combo).
  - Combo families: `for-*` (161), `is-*` (142), `v2/v3` (131), `g-N` (37), `gap-N`, `mw-Nrem`, `no-*`, `has-*`, `p-N`/`pt-N`, `mob-*`, `column-fill-N`, `N-column`.
  - 49 BEM `__` classes (nav/menu/banner components). Only 2 `u-` classes.
- **SCL isn't perfectly clean:** there are hard-coded values (`font-family:"Gt Sectra"`, `letter-spacing:-0.325px` on `.form-btn`, `.content-2.p-32{2rem}`, `section-2` with literal colours). **We follow the rules in §10, not these exceptions.**

### 9.3 Comparison summary
| Topic | Starter / Bridgewall | SCL (primary) | **PGB follows** |
|---|---|---|---|
| Collections | Colors, Theme, Spacing, Border Radius, Size, Typo, Text Style | Colors, Theme (new), Spacing, Corner, Other, Typo, Section, Z-indices | **Starter collections** (your decision). Optionally adopt SCL's additions (Q11) |
| Type wiring | Text Style modes | Direct Typo vars, hard-coded font | **Text Style modes** (keeps the font in a variable) |
| Theme | Grouped `BG/`, `Accent/`, `Button/` + 3 modes | Flat semantic + `button-primary/secondary` + 2 modes | **Starter Theme** (Base/Dark/Brand fits PGB's 3 backgrounds) |
| Spacing responsiveness | Only `Global`, `Gap/*`, `Section/*` change at T/L | Most numeric steps change at T/L | Starter, with the T/L values I'll propose (Q5) |
| Container | Full-width `.content` + `Global` padding | `.content` padding = `Container Margin`; `.container` max-width 90rem | Starter (the PGB design is full-bleed, 24px gutters) |
| Breakpoint modes | T at medium, L at small | T at medium, L at small, Mob at tiny (Other) | T/L, matching your 3 Figma modes |
| Skeleton + section components | Dev - Page Starter / Dev - Section Starter | Same, plus real section components with props | **Same skeleton.** Build PGB sections as components only where they repeat (nav, footer, buttons) |
| Fluid root | 1728 basis | 1440 basis | 1728 |

### 9.4 Published sites vs the Designer
The downloaded civicleadership CSS agrees with what's in SCL's Designer. The fluid root (1440 basis, segments up to 1920) and the `theme-navy` and `bg-light-beige` combos are the same. There's one export quirk: published CSS shows **deleted** variables as `\<deleted|…\>` escapes. They aren't in the Designer and should be ignored. FedTech uses the same Gen B pattern, plus attribute theming (`theme="light"`) in external CSS. SCL has the same `theme="light"` attribute on a hidden section.

Other notes:
- **Repo vs prompt:** the prompt mentions jsDelivr, but the repo loads from Vercel with a `?devMode=true` switch. You chose a new Vercel project. `src/index.html` still points at `bridgewall.vercel.app`, and `AGENTS.md` and `webflow-deploy.json` still say bridgewall / vovi-scl. These get updated in Phase 5.
- **`.gitignore`:** it ignores `docs/*` (except `resources-guide.md`) and `.claude`, so this file isn't committed (Q10).

---

## 10. Hard rules (carried into every phase)

1. Every page is `div.page > main.main > section.section > div.content`. Nav and footer go inside `main`.
2. Reuse existing classes first. A new class follows `block-element` kebab-case. Modifiers are `for-*`, `is-*`, `theme-*`, `_*` combos.
3. Every colour, font size, spacing value and radius is a variable. No hard-coded values, no inline styles, no per-class font overrides.
4. Elements bind Theme colours, never Colors primitives.
5. Typography only comes through Text Style modes and Typo variables.
6. Responsive behaviour comes from T/L variable modes plus class tweaks at medium/small/tiny.
7. Semantic HTML: one `h1`, ordered headings, alt text, `button` for actions and `a` for navigation.
8. JS targets data attributes only. It respects `prefers-reduced-motion`, and a missing element or failed script never breaks the page.
9. Never publish, and never delete classes, variables, pages or CMS items without explicit approval. Report MCP failures; don't work around them.

---

## 11. Decisions (answered 2026-10-16, doc approved)

| # | Question | Decision |
|---|---|---|
| 1 | Structure (§1–§3, §10) | **Approved.** Key rules copied into `CLAUDE.md` |
| 2 | Starter placeholder colours | **Remove** `Brand/100–300` and `Neutral/100–500`, and add only the PGB colours that are needed. In Phase 3, Theme is re-pointed first, then the placeholders are deleted |
| 3 | Near-duplicate colours | **Keep each as its own token.** See §8.1. Single-use values get confirmed in the Phase 2 report |
| 4 | Off-scale spacing and radii | **Snap to the nearest scale value** (spacing 4/6/8/12/16/20/24, radius 2). Every snap gets listed in the Phase 2 report |
| 5 | Tablet and mobile values | **I propose the T/L values** in the Phase 2 report, and you review them |
| 6 | Iskry line-height | **Separate per style:** H1 = 0.88, Display = 1.0 |
| 7 | Button font | **Geist everywhere.** Neue Haas Unica is dropped |
| 8 | Hidden image frames in the book section | **Scroll animation.** Build them as image layers behind the book, driven by GSAP in Phase 5 (`data-*` attributes) |
| 9 | Hero media | **Background video, file to come.** Use the Figma image as the poster for now. The Unmute/sound controls stay |
| 10 | Docs in git | **Whitelisted** in `.gitignore` (`!docs/design-system.md`) |
| 11 | SCL additions | **Adopt** the Z-indices collection and `Size/Navbar Height`. **Skip** the radius T mode and SCL's Section collection |

### Next: Phase 2 (Figma variables)
Create the Figma collections **Colors**, **Theme** (Base/Dark/Brand), **Spacing**, **Border Radius**, **Size**, **Typo** (Desktop/Tablet/Mobile) and **Z-indices**, plus text styles bound to the Typo variables. Every variable gets explicit scopes. Then bind the homepage values, and report every snap, the single-use colours, and the proposed T/L values for your review.
