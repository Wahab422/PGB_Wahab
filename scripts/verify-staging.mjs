// Verifies the Resources page on staging against the LOCAL dev bundle.
//   pnpm dev                       (terminal 1: serves http://127.0.0.1:3000)
//   pnpm verify:resources          (terminal 2; CHROME_PATH overrides the Chrome binary)
// Launches its own Chrome with Chrome's loopback permission off — a normal
// browser blocks an https page from loading the 127.0.0.1 bundle.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const SITE = process.env.SITE_URL || 'https://bridgewall-vovi.webflow.io';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await fetch('http://127.0.0.1:3000/index.js', { method: 'HEAD' });
} catch {
  console.error('Dev server is not running. Start it with `pnpm dev`, then rerun.');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'bridgewall-verify-')),
  args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'],
});

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : detail ? `  (${detail})` : ''}`);
};

// What a visitor sees: rendered cards and visible product / category blocks.
const snapshot = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('[data-resources]');
    const shown = (el) => el.getClientRects().length > 0;
    const cards = [...root.querySelectorAll('[data-resource-id]')].filter(shown);
    return {
      ready: root.hasAttribute('data-resources-ready'),
      positions: cards.length,
      unique: new Set(cards.map((c) => c.dataset.resourceId)).size,
      products: [...root.querySelectorAll('[data-resource-product]')]
        .filter(shown)
        .map((p) => p.dataset.resourceProduct),
      rows: [...root.querySelectorAll('[data-resource-section]')].filter(shown).length,
      count: root.querySelector('[data-resource-count]')?.textContent ?? null,
      empty: shown(root.querySelector('[data-resource-empty]') || document.createElement('i')),
    };
  });

const pickProduct = async (page, value) => {
  await page.evaluate(
    (v) =>
      document
        .querySelector(`[data-resources] input[fs-list-field="product"][fs-list-value="${v}"]`)
        .click(),
    value
  );
  await wait(1500);
  return snapshot(page);
};

async function runFilters(page) {
  const all = await snapshot(page);
  check('helper ready (data-resources-ready)', all.ready);
  check('All shows every published card', all.positions > 0, `positions=${all.positions}`);
  check('All count matches unique cards', all.count === String(all.unique), `count=${all.count}`);
  const aqua = await pickProduct(page, 'AQUA');
  check('AQUA shows only AQUA cards', aqua.positions > 0 && aqua.positions < all.positions);
  check('AQUA hides other products', aqua.products.join() === 'AQUA', aqua.products.join());
  const back = await pickProduct(page, '');
  check('All restores everything', back.positions === all.positions);
  const input = await page.$('[data-resources] .filter-input');
  await input.type('zzzzqq');
  await wait(1500);
  const none = await snapshot(page);
  check('impossible search hides every card', none.positions === 0, `positions=${none.positions}`);
  check('impossible search shows the empty message', none.empty);
  check('impossible search hides all products', none.products.length === 0);
  const clear = await page.$('[data-resources] [fs-list-element="clear"]');
  check('Clear filters button exists', Boolean(clear));
  if (clear) {
    await clear.click();
    await wait(1500);
    check('Clear restores everything', (await snapshot(page)).positions === all.positions);
  }
}

const fresh = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Turnstile|challenges\.cloudflare|font-size:0/.test(m.text()))
      console.log('  console.error:', m.text().slice(0, 200));
  });
  return page;
};

console.log('— Direct load /resources');
let page = await fresh();
await page.goto(`${SITE}/resources?devMode=true`, { waitUntil: 'networkidle2' });
await wait(2500);
await runFilters(page);
await page.close();

console.log('— Page transition: home → /resources (Barba, no reload)');
page = await fresh();
await page.goto(`${SITE}/?devMode=true`, { waitUntil: 'networkidle2' });
await wait(2500);
await page.evaluate(() => {
  window.__noReload = true;
  document.querySelector('a[href$="/resources"]').click();
});
await wait(4500);
check(
  'arrived without a page reload',
  await page.evaluate(() => window.__noReload === true && location.pathname === '/resources')
);
await runFilters(page);
await page.close();

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
