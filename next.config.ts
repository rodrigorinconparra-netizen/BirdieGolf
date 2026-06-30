import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake icon imports so the dev compiler doesn't process the whole barrel.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
