import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // WICHTIG: Damit @react-pdf/renderer im App Router funktioniert
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: "designare",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true
});
