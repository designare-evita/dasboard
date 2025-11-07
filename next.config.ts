import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ✅ HIER BEGINNT DIE KORREKTUR
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // Diese Wildcard erlaubt ALLE Hostnamen über HTTPS
        hostname: '**', 
      },
      {
        protocol: 'http',
        // Diese Wildcard erlaubt ALLE Hostnamen über HTTP
        hostname: '**',
      },
    ],
  },
  // ✅ HIER ENDET DIE KORREKTUR
};

export default nextConfig;
