# Webflow Starter Template

A modern starter template for Webflow projects with page-based routing, build system, and development server.

## Features

✨ **Page-based routing** - Automatically loads page-specific code based on `data-page` attribute
🎯 **Lenis smooth scroll** - Premium buttery-smooth scrolling library included
🎵 **Accordion component** - Flexible accordion with image sync built-in
🎠 **Embla carousels** - Carousels, marquees and fades from data attributes
🎬 **GSAP animations** - Professional animations with ScrollTrigger for scroll effects
✂️ **Code splitting** - Page code and components download only on the pages that use them
🔥 **Live reload** - Automatically refreshes the browser when you save changes
📦 **Build & minify** - Production-ready minified output with esbuild
⚡ **Performance optimized** - 60fps animations, minimal bundle size
🎨 **Code quality** - ESLint and Prettier pre-configured
🚀 **Fast development** - Local development server with instant updates
📝 **Plain JavaScript** - No TypeScript, just modern ES6+ JavaScript

## Getting Started

### Prerequisites

- Node.js 20+ (CI uses 24)
- pnpm (the only package manager for this repo — Vercel, Webflow deploy and CI all use it)

### Installation

1. Clone or download this repository
2. Install dependencies:

```bash
pnpm install
```

### Development Mode

Start the development server with live reload:

```bash
pnpm dev
```

This will:

- Build your code in development mode (with source maps)
- Start a local server at `http://localhost:3000`
- Watch for file changes and rebuild automatically
- Enable live reload in the browser

### Production Build

Build minified code for production:

```bash
pnpm build
```

The output is in `dist/`: `index.js` (the entry), `index.css`, and `chunks/`
(code-split ES modules — page code and components are only downloaded on pages
that use them). `pnpm lint` must pass; CI (`.github/workflows/ci.yml`) runs
lint and build on every push and pull request.

## How to Use in Webflow

The bundle is an **ES module**, so it must be loaded with `type="module"` — a
classic `<script>` can't parse it. The site's loader snippet (live Vercel build
by default, local dev server with `?devMode=true`) lives in
[`src/index.html`](src/index.html); paste that into Webflow's site-wide footer
code.

### 1. During Development

Run `pnpm dev`, then open the site once with `?devMode=true` (and
`?devMode=false` to switch back). Or, for a one-off test:

```html
<script type="module" src="http://localhost:3000/index.js"></script>
```

### 2. In Production

#### Option A: Deploy to Vercel (Recommended)

1. **Deploy to Vercel**:

   ```bash
   # Install Vercel CLI (if not installed)
   npm i -g vercel

   # Deploy
   vercel --prod
   ```

2. **Get your Vercel URL**:

   ```bash
   pnpm vercel:url
   # Or specify project name:
   pnpm vercel:url --project your-project-name
   ```

3. **Add to Webflow**:
   ```html
   <script type="module" src="https://your-project-name.vercel.app/index.js"></script>
   ```

📖 **See VERCEL_DEPLOYMENT.md for complete Vercel deployment guide!**

#### Option B: Other Hosting

1. Run `pnpm build` to create the production build
2. Upload the whole `dist/` folder (`index.js`, `index.css` and `chunks/`) to
   your hosting, with `Access-Control-Allow-Origin: *` on the JS files (module
   scripts loaded cross-origin need CORS)
3. Add the script tag to your Webflow project settings:

```html
<script type="module" src="https://your-domain.com/index.js"></script>
```

### 3. Set Page Attributes

Add a `data-page` attribute to the `<body>` tag in Webflow's page settings:

**Home page:**

```html
<body data-page="home"></body>
```

**About page:**

```html
<body data-page="about"></body>
```

**Contact page:**

```html
<body data-page="contact"></body>
```

The script will automatically detect the page and run the corresponding code!

## Project Structure

```
.
├── bin/
│   └── build.js          # esbuild config (ES modules + code splitting)
├── src/
│   ├── index.js          # Entry: page router (data-page → page chunk)
│   ├── index.css         # Small global stylesheet
│   ├── index.html        # Webflow loader snippet (Site settings → Footer code)
│   ├── global/           # Runs on every page
│   │   ├── index.js      # Global init + on-demand components
│   │   ├── lenis.js      # Lenis smooth scroll + scroll restoration
│   │   ├── navbar.js     # Navbar
│   │   └── footer.js     # Footer
│   ├── components/       # Shared UI (carousel, tabs, modals, load more, gsap, …)
│   ├── functions/        # Features (video players, people modal, …)
│   ├── pages/            # Page-specific code — one chunk per page
│   └── utils/            # Helpers (logger, focus, motion, text, …)
├── dist/                 # Build output (generated; served by Vercel)
└── package.json
```

## Adding Global Code (Runs on Every Page)

For code that should run on **every page** (like navbar, footer, analytics, etc.), add it to the `src/global/` folder:

1. Edit `src/global/navbar.js` or `src/global/footer.js` with your code
2. Or create a new global component file, e.g., `src/global/analytics.js`:

```javascript
export function initAnalytics() {
  console.log('Analytics initialized');
  // Your analytics code here
}
```

3. Import and call it in `src/global/index.js`:

```javascript
import { initNavbar } from './navbar';
import { initFooter } from './footer';
import { initAnalytics } from './analytics';

export function initGlobal() {
  console.log('🌐 Initializing global components...');

  initNavbar();
  initFooter();
  initAnalytics(); // Add this line
}
```

**That's it!** The global code will now run on every page automatically, before any page-specific code.

## Adding a New Page

For code that should run on **one specific page**, add it to the `src/pages/` folder:

1. Create a new file in `src/pages/`, e.g., `src/pages/services.js`:

```javascript
export function initServicesPage() {
  console.log('Services page initialized');

  // Your page-specific code here
}
```

2. Register it in `src/index.js`:

```javascript
const pageRegistry = {
  home: () => import('./pages/home').then((m) => m.initHomePage),
  // …
  services: () => import('./pages/services').then((m) => m.initServicesPage), // Add this line
};
```

Each entry is a dynamic `import()`, so the page's code becomes its own chunk and downloads only on that page.

3. Add `data-page="services"` to your Webflow page's `<body>` tag

A page that needs no page-specific code (everything on it is handled globally) doesn't get a module — add its `data-page` value to `PAGES_WITHOUT_PAGE_CODE` in `src/index.js` instead. An unknown `data-page` value logs a console warning.

## Utility Functions

The template includes helpful utility functions in `src/utils/helpers.js`:

- `debounce()` - Limit function execution rate
- `throttle()` - Control function call frequency
- `isInViewport()` - Check if element is visible
- `animateNumber()` - Animate numbers (counters)
- `smoothScrollTo(trigger, target, offset)` - Bind Lenis-powered scroll to triggers
- `getQueryParams()` - Get URL query parameters
- `waitForElement()` - Wait for element to appear in DOM

### Example Usage

```javascript
import { debounce, smoothScrollTo } from '../utils/helpers';

export function initHomePage() {
  // Debounced scroll handler
  const handleScroll = debounce(() => {
    console.log('Scrolled!');
  }, 300);

  window.addEventListener('scroll', handleScroll);

  // Smooth scroll to section (Lenis aware, native fallback)
  smoothScrollTo('[data-scroll-to]', '#about', 100);
}
```

## Scripts

- `pnpm dev` - Start development server with live reload
- `pnpm build` - Build for production (minified)
- `pnpm lint` - Check code for errors
- `pnpm lint:fix` - Auto-fix linting errors
- `pnpm format` - Format code with Prettier
- `pnpm vercel:url` - Get your Vercel file URL

## Code Quality

The project includes ESLint and Prettier for code quality and formatting:

- **ESLint**: Catches errors and enforces best practices
- **Prettier**: Automatically formats your code

Run `pnpm lint` before committing to catch any issues.

## Code Execution Order

Understanding the execution order helps you structure your code better:

```
1. Global Code (src/global/) → Runs on EVERY page
   ├── Lenis Smooth Scroll
   ├── Navbar
   ├── Footer
   └── Other always-needed components

2. Reusable Components (src/components/) → Import where needed
   └── Accordion, Tabs, Modals, etc.

3. Page-Specific Code (src/pages/) → Runs only on specific pages
   └── Based on data-page attribute
```

**Example:**

- On the home page with `data-page="home"`:
  1. Global components run (navbar, footer, etc.)
  2. Then `initHomePage()` runs

- On a page with no page-specific code, e.g. `data-page="about"`:
  1. Global components run (navbar, footer, etc.)
  2. Nothing else — `about` is listed in `PAGES_WITHOUT_PAGE_CODE`

## Lenis Smooth Scroll

Lenis is **automatically enabled** on all pages for buttery-smooth scrolling! Here's how to use it:

### Automatic Smooth Scrolling

All pages now have premium smooth scrolling enabled by default. No setup required!

### Anchor Links

All anchor links automatically use Lenis smooth scroll:

```html
<!-- In Webflow, just add an ID to your section -->
<section id="about">...</section>

<!-- Then link to it anywhere -->
<a href="#about">Go to About</a>
```

### Scroll Buttons

Add `data-scroll-to` attribute to any button:

```html
<!-- Scroll to a specific section -->
<button data-scroll-to="#contact">Contact Us</button>

<!-- Special values -->
<button data-scroll-to="top">Back to Top</button>
<button data-scroll-to="bottom">Scroll to Bottom</button>
```

### Programmatic Scrolling

Use Lenis functions in your page-specific code:

```javascript
// Import Lenis helper functions
import { scrollTo, scrollToTop, scrollToBottom } from '../global/lenis';

export function initHomePage() {
  const button = document.querySelector('[data-my-button]');

  button.addEventListener('click', () => {
    // Scroll to an element
    scrollTo('#my-section');

    // With custom options
    scrollTo('#my-section', {
      offset: -100, // Custom offset
      duration: 2, // Custom duration in seconds
    });

    // Scroll to top
    scrollToTop();

    // Scroll to bottom
    scrollToBottom();
  });
}
```

### Stop/Start Lenis

Useful for modals or when you need to disable scrolling:

```javascript
import { stopLenis, startLenis } from '../global/lenis';

// Stop scrolling (e.g., when opening a modal)
stopLenis();

// Start scrolling again (e.g., when closing a modal)
startLenis();
```

## Accordion Component

A flexible, CSS-based accordion component with optional image sync. It's initialised globally (`src/global/index.js`), so accordions work on any page from Webflow attributes — no page code needed.

### Basic Accordion

Add data attributes in Webflow:

1. **Container**: `data-accordion-list="css"`
2. **Each item**: `data-accordion`
3. **Toggle/Header**: `data-accordion-toggle`
4. **Content panel**: `data-accordion-content`

**Example structure:**

```
div [data-accordion-list="css"]
├── div [data-accordion]
│   ├── div [data-accordion-toggle] → Clickable header
│   └── div [data-accordion-content] → Expandable content
├── div [data-accordion]
│   ├── div [data-accordion-toggle]
│   └── div [data-accordion-content]
```

### Configuration Options

Add these to the container (`data-accordion-list="css"`):

```html
<!-- Only one panel open at a time -->
<div data-accordion-list="css" data-accordion-close-siblings="true">
  <!-- First panel starts open -->
  <div data-accordion-list="css" data-accordion-first-active="true">
    <!-- Keep at least one panel open -->
    <div data-accordion-list="css" data-accordion-collapsible="false">
      <!-- Use hover instead of click -->
      <div data-accordion-list="css" data-accordion-event="hover"></div>
    </div>
  </div>
</div>
```

### Accordion with Image Sync

Perfect for feature showcases! Images sync with accordion states automatically.

```html
<div data-accordion-imgs>
  <!-- Your accordion -->
  <div data-accordion-list="css">...</div>

  <!-- Your images (in same order as accordion items) -->
  <img data-accordion-img src="feature-1.jpg" />
  <img data-accordion-img src="feature-2.jpg" />
  <img data-accordion-img src="feature-3.jpg" />
</div>
```

**Required CSS:**

```css
/* Hide inactive content */
[data-accordion='not-active'] [data-accordion-content] {
  display: none;
  max-height: 0;
}

/* Show active content */
[data-accordion='active'] [data-accordion-content] {
  display: block;
  max-height: 1000px;
}

/* Hide inactive images */
[data-accordion-img='not-active'] {
  display: none;
}

/* Show active image */
[data-accordion-img='active'] {
  display: block;
}
```

## Carousels

Carousels, marquees and fade sliders are built on [Embla](https://www.embla-carousel.com/) from `[data-carousel]` markup. They're set up globally wherever that markup appears, and the carousel code (Embla included) downloads only on pages that have one. Markup and options are documented at the top of `src/components/carousel.js`. Auto-advancing carousels get a pause/play control (WCAG 2.2.2) and never auto-advance under `prefers-reduced-motion`.

### Mask Slider

A full-bleed image/video slider with a GSAP "mask reveal": each slide's `.img-wrap` and its `.img` counter-translate, so the picture holds still while its edge wipes across. It is set up globally wherever `[data-mask-slider]` appears, and its code downloads only on those pages. Styles are in `src/styles/mask-slider.css`, scoped to `[data-mask-slider]`.

```html
<div data-mask-slider aria-label="Campus gallery" data-duration="1.1" data-parallax="100">
  <div class="slide">
    <div class="img-wrap"><img class="img" src="…" alt="…" /></div>
  </div>
  <div class="slide">
    <div class="img-wrap"><video class="img" src="…" muted loop playsinline></video></div>
  </div>
  <!-- Optional. Omit them and default Prev / Next buttons are rendered. -->
  <button class="btn-prevslide" type="button">Prev</button>
  <button class="btn-nextslide" type="button">Next</button>
</div>
```

You can also create it from code, which renders the slides for you:

```javascript
import { createMaskSlider } from '../components/maskSlider';

const slider = createMaskSlider(document.querySelector('#hero-slider'), {
  slides: [{ src: 'https://picsum.photos/seed/1/1600/900', alt: 'Hills', type: 'image' }],
  duration: 1.1, // seconds
  ease: 'Pagtrans', // CustomEase ".645,.045,.355,1", or any GSAP ease
  parallax: 100, // % of the media's counter-move; 50 = the picture drifts as it reveals
  initialIndex: 0,
  onChange: (index) => {},
  className: '', // extra class(es) on the root
  label: 'Image slider', // aria-label
});
slider.next();
slider.prev();
slider.goTo(2);
slider.destroy();
```

| Option         | Data attribute       | Default          |
| -------------- | -------------------- | ---------------- |
| `duration`     | `data-duration`      | `1.1`            |
| `ease`         | `data-ease`          | `'Pagtrans'`     |
| `parallax`     | `data-parallax`      | `100`            |
| `initialIndex` | `data-initial-index` | `0`              |
| `label`        | `aria-label`         | `'Image slider'` |

Slides wrap around, ← / → work while the slider has focus, input during a transition is ignored, and under `prefers-reduced-motion` slides switch instantly. Each change fires `maskslider:change` on the root (`detail.index`), and `getMaskSlider(el)` returns the instance for a markup slider. Try it with `pnpm demo`, then open http://127.0.0.1:3001/mask-slider.html.

## GSAP Animations

GSAP and ScrollTrigger are bundled and set up globally (`src/global/index.js` → `handleGlobalAnimation()` in `src/components/gsap.js`), so scroll animations work on every page from Webflow attributes alone — no page code needed. Each lives in its own module in `src/animations/`, with its options at the top of the file:

| Attribute                    | What it does                                                              | Module           |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------- |
| `[data-stagger-in=".child"]` | the items rise in one after another as they scroll into view              | `stagger.js`     |
| `[data-fade]`                | fades in on scroll-in (`data-fade="up"` rises too)                        | `fade.js`        |
| `[data-counter]`             | the number in its text counts up when it scrolls into view                | `counter.js`     |
| `[data-zoom-in]`             | settles from a slight zoom as it fades in                                 | `zoomIn.js`      |
| `[data-parallax]`            | sinks slower than the page as its section scrolls away                    | `parallax.js`    |
| `[data-scroll-fade]`         | drifts up and fades out as its section scrolls away                       | `scrollFade.js`  |
| `[data-float]`               | drifts past the page as it scrolls by (`"auto"`, `"-40 200"` = by column) | `float.js`       |
| `[data-reveal-image]`        | an image frame opens upward on scroll-in, then drifts inside              | `imageReveal.js` |
| `[data-split-text]`          | the text rises in line by line                                            | `splitText.js`   |

Under `prefers-reduced-motion` they're skipped — the content simply shows.

### Advanced: Programmatic Animations

```javascript
import { gsap } from '../utils/gsapCore';

export function initHomePage() {
  gsap
    .timeline()
    .from('.hero-title', { opacity: 0, y: 100 })
    .from('.hero-subtitle', { opacity: 0, y: 50 }, '-=0.5')
    .from('.hero-button', { opacity: 0, scale: 0.8 }, '-=0.3');

  gsap.to('.hero-art', {
    y: 200,
    scrollTrigger: { trigger: '.hero', scrub: true },
  });
}
```

## Examples

### Global Navbar Code (Runs Everywhere)

```javascript
// src/global/navbar.js
export function initNavbar() {
  // Mobile menu toggle
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      mobileMenu.classList.toggle('is-open');
    });
  }

  // Highlight active page
  const currentPage = document.body.getAttribute('data-page');
  const navLinks = document.querySelectorAll('[data-nav-link]');

  navLinks.forEach((link) => {
    if (link.getAttribute('data-nav-link') === currentPage) {
      link.classList.add('is-active');
    }
  });
}
```

### Home Page - Scroll Animation

```javascript
export function initHomePage() {
  const animateOnScroll = () => {
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight;

      if (isVisible) {
        element.classList.add('is-visible');
      }
    });
  };

  window.addEventListener('scroll', animateOnScroll);
  animateOnScroll();
}
```

### Contact Page - Form Validation

```javascript
export function initContactPage() {
  const form = document.querySelector('[data-contact-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    // Handle form submission
  });
}
```

## Tips & Best Practices

1. **Use data attributes** - Use `data-*` attributes in Webflow to target elements instead of classes
2. **Keep it modular** - Each page should only contain code specific to that page
3. **Use utilities** - Leverage the helper functions for common tasks
4. **Lenis is automatic** - Anchor links scroll smoothly (native scrolling under reduced motion)
5. **GSAP is automatic** - Scroll animations work from data attributes on every page
6. **Performance** - Components and page code download only on the pages that use them
7. **Test in dev mode** - Always test with `pnpm dev` before building for production
8. **Minify for production** - Always use `pnpm build` for production code

## Troubleshooting

**Script not loading in Webflow:**

- Make sure the development server is running (`pnpm dev`)
- Check that the script URL is correct in Webflow settings
- The script must load as `type="module"` (see `src/index.html`) — a classic script can't parse the bundle
- Check browser console for errors

**Page code not running:**

- Verify the `data-page` attribute is set correctly
- Check browser console for the initialization message
- Make sure the page is registered in `pageRegistry` in `src/index.js` (an unknown `data-page` logs a console warning)

**Live reload not working:**

- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Restart the development server

## License

MIT

## Credits

Inspired by the [Finsweet Developer Starter](https://github.com/finsweet/developer-starter) template.
