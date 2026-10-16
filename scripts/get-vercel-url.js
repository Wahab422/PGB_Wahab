#!/usr/bin/env node

/**
 * Get Vercel File URL
 *
 * This script helps you get the correct Vercel URL for your built file.
 *
 * Usage:
 *   node scripts/get-vercel-url.js
 *   node scripts/get-vercel-url.js --project my-project
 */

const readFileSync = require('fs').readFileSync;
const path = require('path');

// Get project name from package.json or command line
function getProjectName() {
  // Try command line argument first
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  if (projectIndex !== -1 && args[projectIndex + 1]) {
    return args[projectIndex + 1];
  }

  // Try to get from package.json
  try {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    return packageJson.name || 'webflow-starter';
  } catch (error) {
    return 'webflow-starter';
  }
}

// Get Vercel URL from environment or construct it
function getVercelUrl() {
  const projectName = getProjectName();

  // Check for VERCEL_URL environment variable (set by Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/index.js`;
  }

  // Construct URL from project name
  // Replace underscores and spaces with hyphens
  const urlSafeName = projectName.replace(/[_\s]/g, '-').toLowerCase();
  return `https://${urlSafeName}.vercel.app/index.js`;
}

// Main function
function main() {
  console.log('\n📦 Vercel File URL\n');
  console.log('='.repeat(50));

  const url = getVercelUrl();

  console.log(`\n✅ Your Vercel file URL:\n`);
  console.log(`   ${url}\n`);
  console.log('='.repeat(50));

  console.log(`\n📝 Add this to your Webflow project settings:\n`);
  console.log(`   <script src="${url}"></script>\n`);

  console.log('💡 Tips:');
  console.log('   - Replace the project name with your actual Vercel project name');
  console.log('   - Check Vercel dashboard for the exact URL');
  console.log('   - Use --project flag to specify project name:');
  console.log(`     node scripts/get-vercel-url.js --project your-project-name\n`);

  // Check if running on Vercel
  if (process.env.VERCEL) {
    console.log('🌐 Running on Vercel!');
    console.log(`   Production URL: https://${process.env.VERCEL_URL}/index.js`);
    if (process.env.VERCEL_BRANCH) {
      console.log(`   Branch: ${process.env.VERCEL_BRANCH}`);
    }
  }

  console.log('');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { getVercelUrl, getProjectName };
