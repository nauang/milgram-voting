import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "placehold.co", pathname: "/**" }],
  },
  // Permite que o Chromium headless (Lighthouse) acesse HMR via 127.0.0.1
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
