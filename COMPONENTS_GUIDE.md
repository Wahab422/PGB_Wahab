# Components Guide

This guide explains the difference between **global code** and **reusable components** in this starter template.

## Folder Structure

```
src/
├── global/           # Code that runs on EVERY page
│   ├── index.js      # Global initializer
│   ├── lenis.js      # Smooth scroll (always loaded)
│   ├── navbar.js     # Navbar (always loaded)
│   └── footer.js     # Footer (always loaded)
│
├── components/       # Reusable components (import where needed)
│   ├── accordion.js  # Accordion (import per-page)
│   ├── swiper.js     # Swiper carousel (import per-page)
│   └── gsap.js       # GSAP animations (import per-page)
│
├── pages/            # Page-specific code
│   ├── home.js       # Home page
│   ├── about.js      # About page
│   ├── contact.js    # Contact page
│   └── faq.js        # FAQ page (imports accordion)
│
└── utils/            # Helper functions
    └── helpers.js    # Utility functions
```

## Global vs. Components

### Global Code (`src/global/`)

**Use for:** Code that MUST run on every single page

**Examples:**

- ✅ Navbar (appears on all pages)
- ✅ Footer (appears on all pages)
- ✅ Smooth scroll (enhances all pages)
- ✅ Analytics tracking
- ✅ Cookie consent
- ✅ Authentication checks

**Loaded:** Automatically on all pages

### Reusable Components (`src/components/`)

**Use for:** Code that's only needed on specific pages

**Examples:**

- ✅ Accordions (FAQ, product details)
- ✅ Swiper carousels (image galleries, testimonials)
- ✅ GSAP animations (scroll effects, parallax, timelines)
- ✅ Tabs (content sections)
- ✅ Modals/Popups
- ✅ Forms (contact, checkout)
- ✅ Data tables

**Loaded:** Only when you import them

## Why This Matters

### Performance

- **Global code** loads on every page → Keep it minimal!
- **Components** only load where needed → Better performance!

### Organization

- **Global code** = Always-needed functionality
- **Components** = Optional, reusable pieces
- **Pages** = Page-specific logic

## How to Use Components

### Step 1: Create a Component

Create a new file in `src/components/`:

```javascript
// src/components/tabs.js
export function initTabs() {
  console.log('Tabs initialized');

  // Your tabs logic here
  const tabs = document.querySelectorAll('[data-tab]');
  // ...
}
```

### Step 2: Import in Your Page

Import and use it only on pages that need it:

```javascript
// src/pages/product.js
import { initTabs } from '../components/tabs';

export function initProductPage() {
  console.log('Product page initialized');

  // Initialize tabs on this page
  initTabs();

  // Page-specific code here
}
```

### Step 3: Register the Page

Don't forget to register your page in `src/index.js`:

```javascript
import { initProductPage } from './pages/product';

const pageRegistry = {
  home: initHomePage,
  about: initAboutPage,
  contact: initContactPage,
  product: initProductPage, // Add this
};
```

### Step 4: Add Data Attribute in Webflow

Add `data-page="product"` to the `<body>` tag in Webflow.

## Example: Accordion Component

The accordion is a perfect example of a reusable component.

### ❌ Wrong (Global - loads on every page)

```javascript
// src/global/index.js
import { initAccordion } from './accordion';

export function initGlobal() {
  initAccordion(); // ❌ Loads on ALL pages even if not needed
}
```

### ✅ Correct (Component - import where needed)

```javascript
// src/pages/faq.js
import { initAccordion } from '../components/accordion';

export function initFaqPage() {
  initAccordion(); // ✅ Only loads on FAQ page
}
```

## When to Make Something Global

Ask yourself:

1. **Does it appear on EVERY page?**
   - Yes → Global
   - No → Component

2. **Is it essential for ALL pages?**
   - Yes → Global
   - No → Component

3. **Will users ALWAYS need it?**
   - Yes → Global
   - No → Component

### Examples

| Feature       | Global or Component? | Why?                      |
| ------------- | -------------------- | ------------------------- |
| Navbar        | ✅ Global            | Appears on every page     |
| Footer        | ✅ Global            | Appears on every page     |
| Smooth Scroll | ✅ Global            | Enhances all pages        |
| Analytics     | ✅ Global            | Track all pages           |
| Accordion     | ❌ Component         | Only on FAQ/details pages |
| Tabs          | ❌ Component         | Only on specific pages    |
| Modal         | ❌ Component         | Only where needed         |
| Carousel      | ❌ Component         | Only on home/gallery      |
| Contact Form  | ❌ Component         | Only on contact page      |

## Best Practices

### 1. Keep Global Code Minimal

```javascript
// ✅ Good - only essentials
export function initGlobal() {
  initLenis(); // Smooth scroll
  initNavbar(); // Navigation
  initFooter(); // Footer
}

// ❌ Bad - too much stuff
export function initGlobal() {
  initLenis();
  initNavbar();
  initFooter();
  initAccordion(); // ❌ Not on all pages
  initTabs(); // ❌ Not on all pages
  initModal(); // ❌ Not on all pages
  initCarousel(); // ❌ Not on all pages
}
```

### 2. Import Components Per-Page

```javascript
// ✅ Good - explicit imports
export function initProductPage() {
  import { initTabs } from '../components/tabs';
  import { initCarousel } from '../components/carousel';

  initTabs();
  initCarousel();
}
```

### 3. Use Utils for Helpers

```javascript
// src/utils/validation.js
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Use in any page or component
import { validateEmail } from '../utils/validation';
```

## Creating New Components

### Component Template

```javascript
// src/components/my-component.js

/**
 * My Component
 * Description of what it does
 *
 * Usage in Webflow:
 * 1. Add data-my-component to the container
 * 2. Add data-my-component-item to each item
 *
 * Usage in code:
 * import { initMyComponent } from '../components/my-component';
 * initMyComponent();
 */

export function initMyComponent() {
  const containers = document.querySelectorAll('[data-my-component]');

  if (!containers.length) return;

  console.log('✅ My Component initialized');

  containers.forEach((container) => {
    // Your component logic here
  });
}
```

### Using the Component

```javascript
// src/pages/my-page.js
import { initMyComponent } from '../components/my-component';

export function initMyPage() {
  initMyComponent();
}
```

## Summary

- **Global** = Runs on every page (navbar, footer, smooth scroll)
- **Components** = Import only where needed (accordion, tabs, modals)
- **Pages** = Page-specific logic
- **Utils** = Helper functions

**Keep global code minimal for better performance!** 🚀
