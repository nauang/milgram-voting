import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Placeholders até o upload real pelo /admin (seed usa placehold.co/.../png)
    remotePatterns: [{ protocol: "https", hostname: "placehold.co", pathname: "/**" }],
  },
  // A CSP do §8.4 entra aqui na etapa de segurança.
};

export default nextConfig;
