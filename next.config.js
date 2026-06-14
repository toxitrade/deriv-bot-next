const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deriv/core'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['10.42.0.1', '10.42.0.131'],
}

module.exports = nextConfig
