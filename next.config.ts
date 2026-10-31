import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Imagens provisórias dos personagens.
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },

      // Imagens oficiais enviadas ao Supabase Storage.
      {
        protocol: "https",
        hostname: "pjvfmvpzpybmiufueoeq.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/characters/**",
        search: "",
      },
    ],
  },

  // Permite que o Chromium headless (Lighthouse)
  // acesse HMR pelos endereços locais.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
