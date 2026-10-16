/**
 * Custom eases shared between components.
 */

import { CustomEase } from 'gsap/CustomEase';
import { gsap } from './gsapCore';

gsap.registerPlugin(CustomEase);

// telhaclarke.com.au's "fastInOut": a quick start that settles slowly. The
// buttons' motion — the sticky button (components/stickyButton.js) and the
// "more projects" button's label (animations/moreProject.js).
export const FAST_IN_OUT = CustomEase.create(
  'fastInOut',
  'M0,0 C0.094,0.026 0.124,0.127 0.157,0.29 0.197,0.486 0.254,0.8 0.348,0.884 0.42,0.949 0.374,1 1,1'
);
