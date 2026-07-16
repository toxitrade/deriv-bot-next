const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages / any static host
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pages serves the site under /deriv-bot-next/
  basePath: process.env.GITHUB_PAGES ? '/deriv-bot-next' : '',
  assetPrefix: process.env.GITHUB_PAGES ? '/deriv-bot-next/' : '',
  transpilePackages: ['@deriv/core'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['localhost', '10.42.0.1', '10.42.0.131'],
}

module.exports = nextConfig
