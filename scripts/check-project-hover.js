const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

// Listener bookkeeping on every target the follower touches.
const live = new Set();
const target = (name) => ({
  name,
  addEventListener: (type) => live.add(`${name}:${type}`),
  removeEventListener: (type) => live.delete(`${name}:${type}`),
});
const styles = new Map();
const button = {
  ...target('button'),
  style: { removeProperty: (p) => styles.delete(p) },
};
const fig = {
  ...target('fig'),
  querySelector: () => button,
};
const card = {
  querySelector: (selector) => (selector === '.project-block-fig' ? fig : null),
};
let hoverCleanups = 0;
const context = {
  module: { exports: {} },
  document: { ...target('document'), querySelectorAll: () => [card] },
  matchMedia: () => ({ matches: false }),
  addEventListener: target('window').addEventListener,
  removeEventListener: target('window').removeEventListener,
  cancelAnimationFrame() {},
  require: () => ({ bindHover: () => () => hoverCleanups++ }),
};
const code = esbuild.transformSync(fs.readFileSync('src/components/projectHover.js', 'utf8'), {
  format: 'cjs',
}).code;
vm.runInNewContext(code, context);
const feature = context.module.exports;

feature.initProjectHovers();
const bound = live.size;
assert.ok(bound === 6, 'follower listens on image, button, window and document');
feature.initProjectHovers();
assert.equal(live.size, bound, 'repeated init must not duplicate listeners');
styles.set('translate', '0 5px');
feature.cleanupProjectHovers();
assert.equal(live.size, 0, 'cleanup must remove every listener');
assert.equal(styles.has('translate'), false, 'cleanup must hand the button back to the CSS');
assert.equal(hoverCleanups, 1);
feature.initProjectHovers();
assert.equal(live.size, bound, 'page swaps must bind a fresh follower');
feature.cleanupProjectHovers();
console.log('PASS: follower init, repeat init, cleanup, page re-entry');
