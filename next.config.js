/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deriv/core'],
  turbopack: {
    root: process.cwd(),
  },
}

module.exports = nextConfig
