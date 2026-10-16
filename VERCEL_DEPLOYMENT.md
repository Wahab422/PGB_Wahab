# Vercel Deployment Guide

This guide explains how to deploy your project to Vercel and get the file URL for use in Webflow.

## 📦 Build Output

Your project builds to:

- **File**: `dist/index.js`
- **Directory**: `dist/`

## 🚀 Deploying to Vercel

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy**:

   ```bash
   vercel
   ```

   For production deployment:

   ```bash
   vercel --prod
   ```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will auto-detect the settings from `vercel.json`

### Option 3: Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your repository
4. Vercel will use the `vercel.json` configuration automatically

## 🔗 Getting Your File URL

After deployment, your file will be available at:

### Production URL

```
https://your-project-name.vercel.app/index.js
```

### Preview URLs

```
https://your-project-name-git-branch.vercel.app/index.js
```

### Custom Domain (if configured)

```
https://your-custom-domain.com/index.js
```

## 📝 Using in Webflow

### Step 1: Get Your Vercel URL

After deploying, Vercel will provide you with a URL. The file URL format is:

```
https://[your-project-name].vercel.app/index.js
```

**Example:**

```
https://webflow-starter.vercel.app/index.js
```

### Step 2: Add to Webflow

1. Go to your Webflow project settings
2. Navigate to **Custom Code**
3. Add this before the closing `</body>` tag:

```html
<script type="module" src="https://your-project-name.vercel.app/index.js"></script>
```

**Replace `your-project-name` with your actual Vercel project name.** The bundle is an ES module with code-split chunks, so `type="module"` is required. For the SCL site, paste the loader in `src/index.html` instead (it also handles `?devMode=true`).

### Step 3: Verify

1. Publish your Webflow site
2. Open the published site
3. Check the browser console for initialization messages:
   - `🌐 Initializing global components...`
   - `🏠 Home page initialized` (or your page name)

## 🔧 Vercel Configuration

Your `vercel.json` is already configured with:

- ✅ **Build Command**: `pnpm build`
- ✅ **Output Directory**: `dist`
- ✅ **Cache Headers**: Optimized caching for `index.js`
- ✅ **CORS Headers**: Allows cross-origin requests

## 📊 Deployment Workflow

### Development

```bash
# Local development
pnpm dev
# Use: http://localhost:3000/index.js
```

### Production Build

```bash
# Build for production
pnpm build
# Output: dist/index.js
```

### Deploy

```bash
# Deploy to Vercel
vercel --prod
# Get URL from Vercel dashboard
```

## 🔍 Finding Your Vercel URL

### Method 1: Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to **Deployments** tab
4. Click on the latest deployment
5. Copy the **Production URL** or **Preview URL**
6. Append `/index.js` to the URL

**Example:**

- Deployment URL: `https://webflow-starter.vercel.app`
- File URL: `https://webflow-starter.vercel.app/index.js`

### Method 2: Vercel CLI

After deploying, the CLI will show you the URL:

```bash
$ vercel --prod

🔍  Inspect: https://vercel.com/your-team/your-project/...
✅  Production: https://your-project.vercel.app [copied to clipboard]
```

### Method 3: Project Settings

1. Go to your project in Vercel dashboard
2. Click **Settings**
3. Go to **Domains**
4. Your production domain is listed there
5. Use: `https://your-domain/index.js`

## 🎯 URL Examples

### Production

```
https://webflow-starter.vercel.app/index.js
```

### Preview (Git Branch)

```
https://webflow-starter-git-main.vercel.app/index.js
```

### Custom Domain

```
https://cdn.yourdomain.com/index.js
```

## 🔄 Updating Your Script

When you update your code:

1. **Push changes to Git**:

   ```bash
   git add .
   git commit -m "Update code"
   git push
   ```

2. **Vercel auto-deploys** (if GitHub integration is set up)

3. **Or manually deploy**:

   ```bash
   vercel --prod
   ```

4. **The URL stays the same** - Vercel uses immutable deployments

## ⚡ Performance Optimization

Your `vercel.json` includes optimized headers:

- **Cache-Control**: `public, max-age=31536000, immutable`
  - Files are cached for 1 year
  - Perfect for production builds

- **CORS**: `Access-Control-Allow-Origin: *`
  - Allows Webflow to load the script

## 🐛 Troubleshooting

### File Not Found (404)

1. **Check the URL** - Make sure you're using `/index.js` not `/dist/index.js`
2. **Verify deployment** - Check Vercel dashboard for successful deployment
3. **Check build** - Ensure `dist/index.js` exists after build

### CORS Errors

- Your `vercel.json` already includes CORS headers
- If issues persist, check Webflow's custom code settings

### Cache Issues

- Vercel uses immutable URLs (content-based hashing)
- Clear browser cache if needed
- Use incognito mode to test

### Build Failures

1. Check Vercel build logs
2. Ensure `pnpm` is available (or update to `npm`)
3. Verify all dependencies in `package.json`

## 📝 Quick Reference

### Build Command

```bash
pnpm build
```

### Output File

```
dist/index.js
```

### Vercel URL Format

```
https://[project-name].vercel.app/index.js
```

### Webflow Script Tag

```html
<script type="module" src="https://[project-name].vercel.app/index.js"></script>
```

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Webflow Custom Code](https://university.webflow.com/lesson/custom-code)

## 💡 Pro Tips

1. **Use Environment Variables** - Store sensitive data in Vercel environment variables
2. **Set up Preview Deployments** - Test changes before production
3. **Monitor Deployments** - Use Vercel's analytics to track performance
4. **Custom Domain** - Add your own domain for a professional URL
5. **Automatic Deployments** - Connect GitHub for automatic deployments on push
