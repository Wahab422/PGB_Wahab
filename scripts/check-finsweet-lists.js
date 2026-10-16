const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require(process.cwd() + '/node_modules/esbuild');
const code = esbuild.transformSync(fs.readFileSync('src/global/finsweetLists.js', 'utf8'), {
  format: 'cjs',
}).code;
let refreshes = 0,
  removals = 0,
  restarts = 0,
  hasList = true;
const hook = [];
const list = {
  wrapperElement: { isConnected: true },
  addHook(name, callback) {
    assert.equal(name, 'afterRender');
    hook.push(callback);
    return () => removals++;
  },
};
const window = { FinsweetAttributes: [] };
const fixtureExports = {};
const context = {
  window,
  document: { querySelector: () => (hasList ? {} : null) },
  module: { exports: fixtureExports },
  exports: fixtureExports,
  require: (name) =>
    name.includes('resourceLists')
      ? { initResourceLists: () => () => {} }
      : name.includes('scrollRefresh')
        ? { requestScrollRefresh: () => refreshes++ }
        : {
            logger: {
              error: (error) => {
                throw error;
              },
            },
          },
};
vm.runInNewContext(code, context);
const feature = context.module.exports;
const settle = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  feature.initFinsweetLists();
  const queued = window.FinsweetAttributes[0][1];
  feature.cleanupFinsweetLists();
  queued([list]);
  assert.equal(hook.length, 0, 'stale bootstrap callback must not attach');
  const oldList = { wrapperElement: { isConnected: false } };
  window.FinsweetAttributes = {
    modules: {
      list: {
        loading: Promise.resolve([oldList]),
        restart: async () => {
          restarts++;
          return hasList ? [list] : [];
        },
      },
    },
  };
  feature.initFinsweetLists();
  await settle();
  assert.equal(hook.length, 1);
  hook[0]();
  assert.equal(refreshes, 2);
  window.FinsweetAttributes.modules.list.loading = Promise.resolve([list]);
  feature.initFinsweetLists();
  await settle();
  assert.equal(restarts, 1, 'connected instances preserve filtered-out items');
  assert.equal(removals, 1);
  assert.equal(hook.length, 2);
  hasList = false;
  list.wrapperElement.isConnected = false;
  feature.initFinsweetLists();
  await settle();
  assert.equal(removals, 2);
  assert.equal(restarts, 2);
  delete window.FinsweetAttributes.modules.list;
  hasList = true;
  list.wrapperElement.isConnected = true;
  window.FinsweetAttributes.load = async (name) => {
    assert.equal(name, 'list');
    return [list];
  };
  feature.initFinsweetLists();
  await settle();
  assert.equal(hook.length, 3);
  feature.cleanupFinsweetLists();
  assert.equal(removals, 3);
  console.log('PASS: bootstrap, stale callbacks, page swaps, hook cleanup, first list page');
})();
