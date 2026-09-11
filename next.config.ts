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
    // Page-data collection forks one worker per CPU and each one loads this
    // app's whole module graph. Measured on this tree: peak RSS across the build
    // is ~2.34 GB at five workers and ~2.26 GB at two, and the heaviest worker
    // needs more than 1 GB of V8 heap (a 1024 MB cap OOMs, 1536 MB passes).
    //
    // So capping workers is worth about 86 MB — real, but nowhere near the whole
    // story. The build simply needs ~2.3 GB, and on a box that does not have it
    // the kernel takes the process at this exact stage: exit 255, no error text,
    // which is the same signature nixpacks.toml already warns about. Kept
    // because 86 MB of headroom costs about a minute of build time, not because
    // it makes a 2 GB box sufficient. It does not.
    cpus: 2,
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
