import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@opentelemetry/auto-instrumentations-node'],
  webpack: (config, { isServer }) => {
    // Fix OpenTelemetry module resolution issues
    if (isServer) {
      config.externals = [...(config.externals || []), '@opentelemetry/auto-instrumentations-node'];
    }
    return config;
  },
};

export default nextConfig;
