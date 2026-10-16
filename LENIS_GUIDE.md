# Lenis Smooth Scroll Guide

Complete guide to using Lenis smooth scroll in your Webflow project.

## What is Lenis?

[Lenis](https://github.com/studio-freight/lenis) is a premium smooth scroll library that provides buttery-smooth scrolling with momentum and easing. It's already **pre-configured and enabled** on all pages in this starter template!

## Scroll devices vs touch devices

- **Scroll devices** (desktop with mouse or trackpad): Lenis is used for smooth, momentum-based scrolling. It loads on first user interaction.
- **Touch devices** (mobile, tablet): Lenis is **not** loaded. The site uses **native browser scroll** for better performance and familiar touch behavior. Anchor links and `data-scroll-to` still work via native smooth scroll.

Detection uses the media query `(hover: hover) and (pointer: fine)` so laptops with a trackpad get Lenis; phones and tablets get native scroll.

## Features

✅ **Automatic smooth scrolling** on scroll devices (desktop)  
✅ **Native scroll** on touch devices (mobile, tablet)  
✅ **Momentum scrolling** with natural physics (desktop only)  
✅ **Anchor link support** - all `#section` links smooth scroll (Lenis or native)  
✅ **Custom scroll buttons** with `data-scroll-to`  
✅ **Programmatic API** for custom scroll behaviors (when Lenis is active)  
✅ **Stop/Start control** for modals and overlays  
✅ **Zero configuration required** - works out of the box!

## Basic Usage

### Anchor Links (Automatic)

All anchor links automatically use Lenis smooth scroll:

```html
<!-- In Webflow: -->
<!-- 1. Add an ID to your section -->
<section id="about">...</section>

<!-- 2. Link to it anywhere -->
<a href="#about">Go to About Section</a>
```

The scroll will automatically:

- Use smooth momentum scrolling
- Account for navbar height
- Work on all pages

### Scroll Buttons

Add `data-scroll-to` attribute to any element:

```html
<!-- Scroll to a specific section -->
<button data-scroll-to="#contact">Contact Us</button>
<div data-scroll-to="#pricing">View Pricing</div>

<!-- Special values -->
<button data-scroll-to="top">Back to Top</button>
<button data-scroll-to="bottom">Go to Bottom</button>
```

## Advanced Usage

### Programmatic Scrolling

Use Lenis functions in your page-specific code:

```javascript
// Import Lenis helper functions
import { scrollTo, scrollToTop, scrollToBottom } from '../global/lenis';

export function initHomePage() {
  // Scroll to element on button click
  const ctaButton = document.querySelector('[data-cta]');
  ctaButton.addEventListener('click', () => {
    scrollTo('#pricing');
  });

  // Scroll with custom options
  scrollTo('#about', {
    offset: -100, // Offset in pixels
    duration: 2, // Duration in seconds (default: 1.2)
  });

  // Scroll to top/bottom
  scrollToTop();
  scrollToBottom();
}
```

### Stop/Start Lenis

Useful for modals, overlays, or when you need to disable scrolling:

```javascript
import { stopLenis, startLenis } from '../global/lenis';

export function initContactPage() {
  const modal = document.querySelector('[data-modal]');
  const openButton = document.querySelector('[data-modal-open]');
  const closeButton = document.querySelector('[data-modal-close]');

  // Open modal
  openButton.addEventListener('click', () => {
    modal.classList.add('is-open');
    stopLenis(); // Disable scrolling
    document.body.style.overflow = 'hidden';
  });

  // Close modal
  closeButton.addEventListener('click', () => {
    modal.classList.remove('is-open');
    startLenis(); // Re-enable scrolling
    document.body.style.overflow = '';
  });
}
```

### Access Lenis Instance

For advanced customization, you can access the Lenis instance directly:

```javascript
import { getLenis } from '../global/lenis';

export function initHomePage() {
  const lenis = getLenis();

  // Listen to scroll events
  lenis.on('scroll', (e) => {
    console.log('Scrolling:', e.scroll);
  });

  // Check scroll direction
  console.log('Direction:', lenis.direction); // 1 for down, -1 for up

  // Get current scroll position
  console.log('Scroll position:', lenis.scroll);

  // Destroy Lenis (rarely needed)
  lenis.destroy();
}
```

## Configuration

Lenis is pre-configured in `src/global/lenis.js` with optimal settings:

```javascript
new Lenis({
  duration: 1.2, // Animation duration (seconds)
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical', // 'vertical' or 'horizontal'
  smoothWheel: true, // Smooth mouse wheel scrolling
  wheelMultiplier: 1, // Mouse wheel sensitivity
  smoothTouch: false, // Touch device smoothing (can be janky)
  touchMultiplier: 2, // Touch sensitivity
  infinite: false, // Infinite scrolling
});
```

### Customizing Configuration

To customize Lenis settings, edit `src/global/lenis.js`:

```javascript
// src/global/lenis.js
lenis = new Lenis({
  duration: 1.5, // Make it slower
  wheelMultiplier: 0.5, // Less sensitive to mouse wheel
  smoothTouch: true, // Enable touch smoothing (experimental)
});
```

## Real-World Examples

### Smooth Scroll Navigation Menu

```javascript
// src/global/navbar.js
export function initNavbar() {
  const navLinks = document.querySelectorAll('[data-nav-link]');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      if (href.startsWith('#')) {
        e.preventDefault();

        // Lenis automatically handles the smooth scroll
        // Just trigger the link or use scrollTo
        const target = document.querySelector(href);
        if (target) {
          import('../global/lenis').then(({ scrollTo }) => {
            scrollTo(target);
          });
        }
      }
    });
  });
}
```

### Hero Section Scroll Button

```javascript
// src/pages/home.js
import { scrollTo } from '../global/lenis';

export function initHomePage() {
  const scrollButton = document.querySelector('[data-hero-scroll]');

  scrollButton.addEventListener('click', () => {
    scrollTo('#services', {
      offset: -80, // Account for navbar
      duration: 1.5,
    });
  });
}
```

### Parallax with Lenis

```javascript
import { getLenis } from '../global/lenis';

export function initHomePage() {
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  const lenis = getLenis();

  lenis.on('scroll', ({ scroll }) => {
    parallaxElements.forEach((el) => {
      const speed = el.getAttribute('data-parallax') || 0.5;
      const y = scroll * speed;
      el.style.transform = `translateY(${y}px)`;
    });
  });
}
```

### Scroll Progress Indicator

```javascript
import { getLenis } from '../global/lenis';

export function initHomePage() {
  const progressBar = document.querySelector('[data-scroll-progress]');
  const lenis = getLenis();

  lenis.on('scroll', ({ scroll, limit }) => {
    const progress = (scroll / limit) * 100;
    progressBar.style.width = `${progress}%`;
  });
}
```

### Modal with Scroll Lock

```javascript
import { stopLenis, startLenis } from '../global/lenis';

export function initContactPage() {
  const modal = document.querySelector('[data-modal]');
  const triggers = document.querySelectorAll('[data-modal-trigger]');
  const closeButtons = document.querySelectorAll('[data-modal-close]');

  // Open modal
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      modal.classList.add('is-open');
      stopLenis();
      document.body.style.overflow = 'hidden';
    });
  });

  // Close modal
  closeButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  function closeModal() {
    modal.classList.remove('is-open');
    startLenis();
    document.body.style.overflow = '';
  }
}
```

## Webflow Setup

### Step 1: Add IDs to Sections

In Webflow Designer:

1. Select the section you want to scroll to
2. In the Settings panel, add an ID (e.g., `about`, `services`, `contact`)

### Step 2: Add Links

For navigation links:

1. Select the link
2. Set the link to `#about` (or whatever your section ID is)
3. That's it! Lenis handles the rest automatically

For buttons:

1. Select the button
2. Add a custom attribute: `data-scroll-to` with value `#about`

### Step 3: Test

Publish your Webflow site and test the smooth scrolling!

## Troubleshooting

**Smooth scroll not working:**

- Make sure the development server is running (`npm run dev`)
- Check browser console for errors
- Verify the script is loaded in Webflow
- Check that anchor links have valid targets

**Scrolling feels janky:**

- Try adjusting the `duration` in `src/global/lenis.js`
- Disable `smoothTouch` if on mobile
- Check for conflicting scroll libraries

**Modal/overlay scrolling issues:**

- Make sure you're calling `stopLenis()` when opening
- Make sure you're calling `startLenis()` when closing
- Check that `overflow: hidden` is applied to body

**Can't scroll on mobile:**

- Set `smoothTouch: false` in Lenis config
- Mobile devices can be finicky with smooth scroll libraries

## Performance Tips

1. **RAF Loop**: Lenis runs on requestAnimationFrame (RAF) for smooth 60fps scrolling
2. **Debounce events**: If you're doing heavy calculations on scroll, use debounce
3. **Use will-change**: Add `will-change: transform` to elements you're animating
4. **Avoid layout thrashing**: Read DOM properties before writing

## API Reference

### Functions

- `scrollTo(target, options)` - Scroll to element or selector
- `scrollToTop()` - Scroll to top of page
- `scrollToBottom()` - Scroll to bottom of page
- `stopLenis()` - Stop/pause Lenis scrolling
- `startLenis()` - Start/resume Lenis scrolling
- `getLenis()` - Get the Lenis instance for advanced usage

### Options for scrollTo()

```javascript
{
  offset: 0,        // Offset in pixels
  duration: 1.2,    // Duration in seconds
  immediate: false, // Skip animation
  lock: false,      // Lock scroll during animation
  force: false,     // Force scroll even if at target
}
```

## Learn More

- [Lenis GitHub Repository](https://github.com/studio-freight/lenis)
- [Lenis Documentation](https://github.com/studio-freight/lenis#usage)
- [Studio Freight Website](https://www.studiofreight.com/)

## Summary

- ✅ Lenis is **pre-configured** and works automatically
- ✅ All anchor links smooth scroll by default
- ✅ Use `data-scroll-to` for custom scroll buttons
- ✅ Import helpers for programmatic scrolling
- ✅ Use `stopLenis()`/`startLenis()` for modals
- ✅ Access the instance with `getLenis()` for advanced features
