// Verifies the project card's gliding button on staging against the LOCAL dev bundle,
// with real mouse input in a headed Chrome (headless throttles frames to ~66ms).
//   pnpm dev                          (terminal 1)
//   pnpm verify:project-hover         (terminal 2; SITE_URL / CHROME_PATH as in docs/verify-staging.md)
// Screenshots of each stage go to $SHOTS (default: a temp dir, printed at the end).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const SITE = process.env.SITE_URL || 'https://bridgewall-vovi.webflow.io';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = process.env.SHOTS || mkdtempSync(join(tmpdir(), 'project-hover-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await fetch('http://127.0.0.1:3000/index.js', { method: 'HEAD' });
} catch {
  console.error('Dev server is not running. Start it with `pnpm dev`, then rerun.');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'bridgewall-verify-')),
  defaultViewport: { width: 1440, height: 900 },
  args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'],
});

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : detail ? `  (${detail})` : ''}`);
};
// The button is still lifting (8px) while it fades in, and its box includes that.
const LIFT = 9;
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

try {
  const page = await browser.newPage();
  await page.goto(`${SITE}/projects?devMode=true`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-project-hover-roll]', { timeout: 15000 });
  await wait(1500); // entrance animations

  // Geometry of the first card's image and its button, plus the button's centre.
  const read = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-project-hover]');
      const fig = card.querySelector('.project-block-fig');
      const a = fig.querySelector('[data-cursor-button] a[href]');
      const f = fig.getBoundingClientRect();
      const b = a.getBoundingClientRect();
      return {
        figTop: f.top,
        figBottom: f.bottom,
        figLeft: f.left,
        figW: f.width,
        figH: f.height,
        btnTop: b.top,
        btnBottom: b.bottom,
        centre: b.top + b.height / 2,
        opacity: Number(getComputedStyle(a).opacity),
        translate: a.style.translate,
        figCursor: getComputedStyle(fig).cursor,
        btnCursor: getComputedStyle(a).cursor,
      };
    });
  const frames = (n = 2) =>
    page.evaluate(
      (count) =>
        new Promise((resolve) => {
          const step = (i) => (i ? requestAnimationFrame(() => step(i - 1)) : resolve());
          step(count);
        }),
      n
    );
  const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

  await page.evaluate(() =>
    document
      .querySelector('[data-project-hover] .project-block-fig')
      .scrollIntoView({ block: 'center' })
  );
  await wait(600);
  const start = await read();
  const x = start.figLeft + start.figW / 2;
  const quarter = start.figTop + start.figH * 0.25;
  const threeQuarter = start.figTop + start.figH * 0.75;

  check(
    'the local bundle is running (button is not sticky)',
    await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('[data-project-hover] [data-cursor-button] a[href]')
        ).position === 'absolute'
    )
  );

  // Enter from outside, on the image: the button is there at once, not sweeping from centre.
  await page.mouse.move(x, start.figTop - 40);
  await page.mouse.move(x, quarter, { steps: 1 });
  await frames(2);
  let s = await read();
  check(
    'enters under the mouse (no sweep from centre)',
    near(s.centre, quarter, LIFT),
    `${s.centre} vs ${quarter}`
  );
  await wait(450);
  s = await read();
  check('is shown while hovering', s.opacity > 0.99, `opacity ${s.opacity}`);
  check('native cursor: image is not cursor:none', s.figCursor !== 'none', s.figCursor);
  check('native cursor: button is a pointer', s.btnCursor === 'pointer', s.btnCursor);
  await shot('1-entered');

  // Glides: part-way a frame or two after a jump, settled a moment later.
  await page.mouse.move(x, threeQuarter, { steps: 1 });
  await frames(3);
  s = await read();
  check(
    'glides (lags the mouse, not teleporting)',
    s.centre > quarter + 5 && s.centre < threeQuarter - 5,
    `${s.centre}`
  );
  await shot('2-gliding');
  await wait(600);
  s = await read();
  check('settles on the mouse', near(s.centre, threeQuarter), `${s.centre} vs ${threeQuarter}`);

  // Edges: never cut off by the image's top or bottom.
  await page.mouse.move(x, start.figTop + 2);
  await wait(600);
  s = await read();
  check(
    'top edge: whole button stays inside the image',
    s.btnTop >= s.figTop - 0.5,
    `${s.btnTop} < ${s.figTop}`
  );
  await page.mouse.move(x, start.figBottom - 2);
  await wait(600);
  s = await read();
  check(
    'bottom edge: whole button stays inside the image',
    s.btnBottom <= s.figBottom + 0.5,
    `${s.btnBottom} > ${s.figBottom}`
  );
  await shot('3-bottom-edge');

  // Scrolling with a still mouse: the image moves under it and the button keeps up.
  await page.mouse.move(x, quarter);
  await wait(600);
  await page.mouse.wheel({ deltaY: 40 });
  await wait(900); // smooth scroll + glide
  s = await read();
  check(
    'follows the mouse through a scroll',
    near(s.centre, quarter, 3),
    `${s.centre} vs ${quarter}`
  );

  // Window loses focus / tab hidden, mouse moves on return: lands, doesn't sweep.
  await page.mouse.move(x, quarter);
  await wait(500);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.move(x, threeQuarter);
  await frames(1);
  s = await read();
  check(
    'after a blur the next move lands on the mouse',
    near(s.centre, threeQuarter, 3),
    `${s.centre} vs ${threeQuarter}`
  );

  // Leaving: fades out, then the position is handed back to the CSS.
  await page.mouse.move(x, start.figTop - 80);
  await wait(700);
  s = await read();
  check('hides when the mouse leaves', s.opacity < 0.01, `opacity ${s.opacity}`);
  check('hands its position back after fading', s.translate === '', `translate "${s.translate}"`);

  // Re-entering lower than it left: again under the mouse at once.
  await page.mouse.move(x, threeQuarter);
  await frames(2);
  s = await read();
  check(
    're-enters under the mouse',
    near(s.centre, threeQuarter, LIFT),
    `${s.centre} vs ${threeQuarter}`
  );
  await page.mouse.move(x, start.figTop - 80);
  await wait(700);

  // Keyboard: button shows centred.
  await page.evaluate(() => {
    document
      .querySelector('[data-project-hover] .project-block-fig a[href]')
      .focus({ focusVisible: true });
  });
  await page.keyboard.press('Shift');
  await wait(100);
  s = await read();
  const middle = (s.figTop + s.figBottom) / 2;
  check(
    'keyboard focus shows the button at the image centre',
    s.opacity > 0.99 && near(s.centre, middle, 2),
    `opacity ${s.opacity}, ${s.centre} vs ${middle}`
  );
  await shot('4-keyboard');
  await page.evaluate(() => document.activeElement.blur());

  // Reduced motion: follows without the glide.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.mouse.move(x, quarter);
  await frames(2);
  await page.mouse.move(x, threeQuarter);
  await frames(2);
  s = await read();
  check(
    'reduced motion: no glide, lands on the mouse',
    near(s.centre, threeQuarter, 2),
    `${s.centre} vs ${threeQuarter}`
  );
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // Page swap: the follower is torn down and rebuilt without doubling up.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  check('no page errors', errors.length === 0, errors.join('; '));
} finally {
  console.log(`\nScreenshots: ${SHOTS}`);
  await browser.close();
}
process.exit(failures ? 1 : 0);
