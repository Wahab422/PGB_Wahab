@AGENTS.md

# PGB (Project Giving Back): Figma → Webflow rules

Full reference: `docs/design-system.md` (approved 2026-10-16). Raw research: `reference/_notes/`.

- **Webflow target:** "MCP Test project - Wahab" `6ad1b57fbbe6f73cf378d7c5`, built on the agency starter template.
- **Primary reference:** "Copy of SCL - Last" `6aaab58b76a1c4f14bf166a3`.
- **Figma design:** `heYeWQsLkUouDVC11lmjFo`. The final homepage is frame `1:3489`; the 1440 "V2" frames are wireframes.
- **Figma variable example:** `nf9Q4SO4piU4Pk7yZLf3qo`.
- The Webflow MCP connector authorizes **one site at a time**. Check `list_sites` before working and ask the user to reconnect if the site you need is missing.

## Layout structure
```
body[data-page]
└─ div.page   (Global CSS + Dev | Refrense Grid components, div.css embed)
   └─ main.main
      ├─ div.nav                         (fixed, inside main)
      ├─ section.section[.theme-dark|.theme-brand]
      │  ├─ div.bg                       (optional absolute media layer)
      │  └─ div.content[.for-<ctx>]      (padding + gap live here, never on .section)
      └─ footer.section
```

## Naming
- kebab-case, component-first: `block`, `block-element`, `block-element-sub`. No `u-`/`c-` prefixes, no BEM `__`.
- Modifiers are combo classes:
  - `for-<context>`, `is-<variant>`, `theme-<mode>`, `v2`
  - `_<ratio/cols>` (e.g. `_2-column`)
  - `p-NN` / `pt-NN` / `pb-NN` / `g-NN` on `.content`
  - `weight-NNN`, `has-*`, `no-*`
- Type classes are `style-display`, `style-h1…h6`, `style-body-*`, `chiptext`. Buttons are `btn` > `button-inner`.
- Reuse existing classes first. Create a new class only when nothing fits.

## Variables (Gen A starter: keep it, fill it, never delete)
- **Collections:** Colors (primitives), Theme (Base/Dark/Brand), Spacing, Border Radius, Size, Typo (Base/T/L), Text Style (one mode per type style).
- **Breakpoint modes are set on `body`:** T at medium ≤991, L at small ≤767.
- **Figma modes** map as Desktop = Base, Tablet = T, Mobile = L.
- **Fluid root** is based on the 1728 design (1rem = 16px at 1728). All values are in rem.
- Elements bind **Theme** colours, never Colors primitives. Type only comes through Text Style modes and Typo variables.

## Hard rules
1. Every colour, font size, spacing value and radius is a variable. No hard-coded values, no inline styles, no per-class font overrides. Avoid unnecessary combos.
2. Handle tablet and mobile for every section: variable modes first, then class tweaks at medium/small/tiny.
3. Semantic HTML: one `h1`, ordered headings, alt text, `button` for actions, `a` for navigation.
4. JS targets **data attributes only** (`data-split-text`, `data-fade`, …). It respects `prefers-reduced-motion`, and a missing element or failed script must never break the page. Code ships through the repo's Vercel loader (`src/index.html`).
5. **Never publish** without explicit approval. **Never delete** classes, variables, pages or CMS items without asking.
6. If the design is unclear or conflicts with the system, **ask; don't guess**. If an MCP action fails, report what failed rather than working around it.
7. Build one page at a time, section by section. Stop after each phase or page with a summary of the classes and variables used.
