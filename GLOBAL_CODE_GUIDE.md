# Global Code Guide

This guide explains how to add code that runs on **every page** in your Webflow project.

## What is Global Code?

Global code is JavaScript that executes on **all pages** regardless of the `data-page` attribute. This is perfect for:

- ✅ Smooth scrolling (Lenis - already included!)
- ✅ Navbar functionality (mobile menu, active links, etc.)
- ✅ Footer components (newsletter forms, back-to-top button)
- ✅ Analytics/tracking scripts
- ✅ Cookie consent banners
- ✅ Chat widgets
- ✅ Search functionality
- ✅ Authentication checks
- ✅ Any component that appears on multiple pages

**Note:** Components that are only used on specific pages (like accordions, tabs, modals) should be in `src/components/` and imported per-page, not in global code.

## How It Works

The execution flow is:

```
Page loads
    ↓
1. Global code runs (src/global/)
    ├── Lenis Smooth Scroll
    ├── Navbar
    ├── Footer
    └── Other global components
    ↓
2. Page-specific code runs (src/pages/)
    └── May import components from src/components/
```

This means Lenis, navbar, footer, and other global components are always initialized **before** any page-specific code.

## Adding Global Code

### Option 1: Edit Existing Global Files

Edit `src/global/navbar.js` or `src/global/footer.js`:

```javascript
// src/global/navbar.js
export function initNavbar() {
  console.log('Navbar initialized');

  // Your navbar code here
  const menuToggle = document.querySelector('[data-menu-toggle]');
  menuToggle.addEventListener('click', () => {
    // Handle menu click
  });
}
```

### Option 2: Create a New Global Component

1. **Create a new file** in `src/global/`, e.g., `src/global/analytics.js`:

```javascript
// src/global/analytics.js
export function initAnalytics() {
  console.log('Analytics initialized');

  // Google Analytics, Facebook Pixel, etc.
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
}
```

2. **Import and call it** in `src/global/index.js`:

```javascript
// src/global/index.js
import { initNavbar } from './navbar';
import { initFooter } from './footer';
import { initAnalytics } from './analytics'; // Add this

export function initGlobal() {
  console.log('🌐 Initializing global components...');

  initNavbar();
  initFooter();
  initAnalytics(); // Add this
}
```

3. **Done!** Your analytics will now run on every page.

## Real-World Examples

### Lenis Smooth Scroll (Already Included!)

Lenis is **pre-configured** and works automatically on all pages! It provides buttery-smooth scrolling.

**Automatic usage:**

```html
<!-- In Webflow, just use regular anchor links -->
<a href="#contact">Contact Us</a>

<!-- Or add data-scroll-to to any button -->
<button data-scroll-to="#pricing">View Pricing</button>
<button data-scroll-to="top">Back to Top</button>
```

**Programmatic scrolling in your page code:**

```javascript
import { scrollTo, scrollToTop, stopLenis, startLenis } from '../global/lenis';

export function initHomePage() {
  // Scroll to an element when button is clicked
  const ctaButton = document.querySelector('[data-cta]');
  ctaButton.addEventListener('click', () => {
    scrollTo('#pricing');
  });

  // Scroll with custom offset and duration
  scrollTo('#about', { offset: -100, duration: 2 });

  // Stop scrolling when modal opens
  const modal = document.querySelector('[data-modal]');
  modal.addEventListener('open', () => {
    stopLenis(); // Disable scrolling
  });

  modal.addEventListener('close', () => {
    startLenis(); // Re-enable scrolling
  });
}
```

### Mobile Menu with Overlay

```javascript
// src/global/navbar.js
export function initNavbar() {
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const overlay = document.querySelector('[data-menu-overlay]');

  if (!menuToggle || !mobileMenu) return;

  const openMenu = () => {
    mobileMenu.classList.add('is-open');
    if (overlay) overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    menuToggle.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = () => {
    mobileMenu.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-visible');
    document.body.style.overflow = '';
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  menuToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
      closeMenu();
    }
  });
}
```

### Cookie Consent Banner

```javascript
// src/global/cookies.js
export function initCookieConsent() {
  const banner = document.querySelector('[data-cookie-banner]');
  const acceptBtn = document.querySelector('[data-cookie-accept]');

  if (!banner || !acceptBtn) return;

  // Check if user already accepted
  if (localStorage.getItem('cookiesAccepted') === 'true') {
    banner.style.display = 'none';
    return;
  }

  // Show banner
  banner.style.display = 'block';

  // Handle accept
  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('cookiesAccepted', 'true');
    banner.style.display = 'none';
  });
}
```

### Newsletter Form in Footer

```javascript
// src/global/footer.js
export function initFooter() {
  const form = document.querySelector('[data-newsletter-form]');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput.value;

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email');
      return;
    }

    // Send to your backend
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        alert('Thanks for subscribing!');
        form.reset();
      }
    } catch (error) {
      console.error('Newsletter signup error:', error);
    }
  });
}
```

### Search Functionality

```javascript
// src/global/search.js
export function initSearch() {
  const searchToggle = document.querySelector('[data-search-toggle]');
  const searchModal = document.querySelector('[data-search-modal]');
  const searchInput = document.querySelector('[data-search-input]');
  const searchClose = document.querySelector('[data-search-close]');

  if (!searchToggle || !searchModal) return;

  // Open search
  searchToggle.addEventListener('click', () => {
    searchModal.classList.add('is-open');
    searchInput.focus();
  });

  // Close search
  const closeSearch = () => {
    searchModal.classList.remove('is-open');
  };

  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });

  // Handle search
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    console.log('Searching for:', query);
    // Implement your search logic
  });
}
```

## Data Attributes in Webflow

To make your global code work in Webflow, you need to add data attributes to your elements:

### Navbar Example

1. In Webflow, select your mobile menu button
2. Add a custom attribute: `data-menu-toggle`
3. Select your mobile menu container
4. Add a custom attribute: `data-mobile-menu`

### Active Link Example

1. Select each navigation link
2. Add a custom attribute: `data-nav-link` with value `home`, `about`, `contact`, etc.
3. The global navbar code will automatically highlight the active link!

## Troubleshooting

**Global code not running:**

- Check the browser console for errors
- Make sure you imported and called the function in `src/global/index.js`
- Verify your data attributes match what's in the code

**Code runs multiple times:**

- Make sure you're not duplicating the initialization
- Check that you're only importing the function once

**Elements not found:**

- The DOM might not be ready yet (rare, but possible)
- Add a check: `if (!element) return;`

## Best Practices

1. **Always check if elements exist** before adding event listeners
2. **Use data attributes** instead of classes for JavaScript hooks
3. **Clean up event listeners** if needed (rarely necessary)
4. **Keep it modular** - one file per component
5. **Test on all pages** to ensure global code doesn't break anything

## Summary

- **Global code** = Runs on every page
- **Page-specific code** = Runs only on pages with matching `data-page`
- **Location**: `src/global/` folder
- **How to add**: Create file → Import in `src/global/index.js`
- **Use for**: Smooth scrolling (Lenis), navbar, footer, analytics, anything that appears on multiple pages
- **Lenis**: Already included and configured - all anchor links smooth scroll automatically!
