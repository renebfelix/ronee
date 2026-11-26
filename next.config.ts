import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env:{
    RONEE_NEXT_PUBLIC_FIREBASE_API_KEY: process.env.RONEE_NEXT_PUBLIC_FIREBASE_API_KEY,
    RONEE_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.RONEE_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    RONEE_NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.RONEE_NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    RONEE_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.RONEE_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    RONEE_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.RONEE_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    RONEE_NEXT_PUBLIC_FIREBASE_APP_ID: process.env.RONEE_NEXT_PUBLIC_FIREBASE_APP_ID,
    RONEE_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.RONEE_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    RONEE_NEXT_PUBLIC_VAULT_KEY: process.env.RONEE_NEXT_PUBLIC_VAULT_KEY,
    RONEE_NEXT_PUBLIC_IMGBB_API_KEY: process.env.RONEE_NEXT_PUBLIC_IMGBB_API_KEY,
  },
  sassOptions: {
    // Permite `@use "abstracts" as *;` em qualquer módulo SCSS.
    loadPaths: [path.join(process.cwd(), "src/styles")],
    includePaths: [path.join(process.cwd(), "src/styles")],
  },
  async redirects() {
    // A raiz leva ao dashboard; o AuthGuard manda para o login se não houver sessão.
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  async headers() {
    return [
      {
        // O service worker nunca pode ficar preso em cache, senão atualizações não chegam.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Digital Asset Links da TWA (Android verifica este arquivo).
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
