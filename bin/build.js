const esbuild = require('esbuild');
const fs = require('fs');

// Configuration
const ENTRY_POINTS = ['src/index.js', 'src/index.css'];
// Vercel serves `dist/` (see `vercel.json`), so build there.
const OUTPUT_DIR = 'dist';
const DEV_MODE = process.argv.includes('--dev');
const DEV_SERVER_HOST = 'localhost';
const DEV_SERVER_PORT = 3000;
const ENABLE_LIVE_RELOAD = DEV_MODE && !process.argv.includes('--no-live-reload');

// esbuild configuration
const buildConfig = {
  entryPoints: ENTRY_POINTS,
  bundle: true,
  minify: !DEV_MODE,
  sourcemap: DEV_MODE,
  target: ['es2020'],
  outdir: OUTPUT_DIR,
  entryNames: '[name]',
  // ES modules + code splitting: every dynamic import() — the page modules in
  // src/index.js, the on-demand components in global/index.js, Embla,
  // SplitText — becomes its own chunk that the browser fetches only when that
  // code runs, and code shared between chunks is emitted once. The entry
  // (dist/index.js) must therefore be loaded as a module script: the Webflow
  // loader sets script.type = 'module' (see README). Chunk names are
  // content-hashed, so vercel.json can cache them forever.
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  platform: 'browser',
  logLevel: 'info',
  // Performance optimizations
  treeShaking: true,
  metafile: !DEV_MODE, // Generate metadata for analysis
  // Strip debug logging in production but keep console.warn/console.error, so
  // logger.error / handleError still leave a trace on the live site.
  drop: DEV_MODE ? [] : ['debugger'],
  pure: DEV_MODE ? [] : ['console.log', 'console.info', 'console.debug'],
  legalComments: 'none', // Remove comments in production
};

// Live reload script injected in dev mode. The banner lands at the top of
// every output file (entry AND chunks), so it guards itself to connect once.
// Note: module scripts loaded cross-origin need CORS — esbuild's dev server
// sends Access-Control-Allow-Origin up to 0.24; from 0.25 on, pass
// `cors: { origin: 'https://vovi-scl.webflow.io' }` to ctx.serve().
const liveReloadScript = `
(function() {
  if (window.__sclLiveReload) return;
  window.__sclLiveReload = true;
  const source = new EventSource('http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}/esbuild');
  source.addEventListener('change', () => {
    location.reload();
  });
  source.addEventListener('error', (e) => {
    if (e.target.readyState === EventSource.CLOSED) {
      console.log('[Live Reload] Connection closed');
    }
  });
  console.log('[Live Reload] Listening for changes...');
})();
`;

async function build() {
  try {
    // Clean output dir so old chunk files don't linger
    try {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }

    if (DEV_MODE) {
      console.log('🚀 Starting development mode...\n');

      // Create context for watch mode
      const ctx = await esbuild.context({
        ...buildConfig,
        banner: ENABLE_LIVE_RELOAD
          ? {
              js: liveReloadScript,
            }
          : undefined,
      });

      // Enable watch mode
      await ctx.watch();

      // Serve files with live reload
      const { host, port } = await ctx.serve({
        servedir: OUTPUT_DIR,
        port: DEV_SERVER_PORT,
        host: DEV_SERVER_HOST,
      });

      console.log(`✅ Development server running at http://${host}:${port}`);
      if (!ENABLE_LIVE_RELOAD) {
        console.log('ℹ️ Live reload disabled (use --no-live-reload to keep it disabled)');
      }
      console.log(`📦 Add this to your Webflow project settings:\n`);
      console.log(`<script src="http://${host}:${port}/index.js"></script>`);
      console.log(`<link rel="stylesheet" href="http://${host}:${port}/index.css">`);
      console.log('');
      console.log('👀 Watching for changes...\n');
    } else {
      console.log('🏗️  Building for production...\n');
      await esbuild.build(buildConfig);
      console.log('✅ Production build complete!\n');
      console.log(
        `📦 Upload dist/index.js and dist/index.css to your hosting and add them to Webflow project settings.\n`
      );
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
