/* eslint-disable no-console */
/**
 * Logger Utility
 * Conditional console logging based on environment
 * Automatically removed in production builds
 */

const windowOverride =
  typeof window !== 'undefined' && typeof window.__APP_DEBUG_LOGS__ !== 'undefined'
    ? Boolean(window.__APP_DEBUG_LOGS__)
    : undefined;

// Treat undefined `process` (browser) as dev by default so logs work locally.
const isDev =
  windowOverride ?? (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production');

/**
 * Logger object with conditional logging
 */
export const logger = {
  /**
   * Log message (only in development)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warning (only in development)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log error (always logged, even in production)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log info (only in development)
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
