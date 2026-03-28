const path = require("path")

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    webpackBuildWorker: false,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {},
  webpack: (config) => {
    // Resolve modules from the root node_modules (npm workspaces hoisting)
    config.resolve.modules.push(path.resolve(__dirname, "../node_modules"))
    return config
  },
}

module.exports = nextConfig
