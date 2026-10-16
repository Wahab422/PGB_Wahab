import { handleError, backToTop } from '../utils/helpers';
import { requestScrollRefresh } from '../utils/scrollRefresh';
import { logger } from '../utils/logger';

const cleanupFunctions = [];

export function initFooter() {
  logger.log('🦶 Footer initialized');

  const backToTopButtons = document.querySelectorAll('[data-back-to-top]');
  if (backToTopButtons.length) {
    const handleClick = () => {
      backToTop();
    };

    backToTopButtons.forEach((button) => {
      button.addEventListener('click', handleClick, { passive: true });
      cleanupFunctions.push(() => {
        button.removeEventListener('click', handleClick);
      });
    });
  }

  const footer = document.querySelector('footer');
  if (footer && typeof window.IntersectionObserver === 'function') {
    let hasScheduledRefresh = false;
    const footerObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || hasScheduledRefresh) return;
        hasScheduledRefresh = true;
        requestScrollRefresh();
        footerObserver.disconnect();
      },
      { threshold: 0.1 }
    );

    footerObserver.observe(footer);
    cleanupFunctions.push(() => {
      footerObserver.disconnect();
    });
  }
}

export function cleanupFooter() {
  cleanupFunctions.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      handleError(error, 'Footer Cleanup');
    }
  });
  cleanupFunctions.length = 0;
}
