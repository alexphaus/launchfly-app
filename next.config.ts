import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@opentelemetry/auto-instrumentations-node', 'pdfkit', '@browserbasehq/stagehand'],
  
  // Performance optimizations
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // Compression and optimization
  compress: true,
  poweredByHeader: false,
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react'],
    // turbo: {}, // Use turbo for Turbopack configuration if needed
  },
  
  // Silence the Turbopack/Webpack conflict error since we have serverExternalPackages
  // which works for both.
  // @ts-ignore - NextConfig type might not have updated for this specific field yet in all versions
  turbopack: {},

  webpack: (config, { isServer }) => {
    // Fix OpenTelemetry module resolution issues
    if (isServer) {
      config.externals = [...(config.externals || []), '@opentelemetry/auto-instrumentations-node'];
    }
    
    return config;
  },

  
  // Headers for better caching and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300',
          },
        ],
      },
      {
        // Copilot responses are per-user; the later rule wins for the same header key.
        source: '/api/copilot/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
