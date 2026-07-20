import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    // ESLint se valida en CI/local; no bloquea el build de producción en Vercel.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
