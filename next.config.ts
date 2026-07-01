import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/wasm-backed server deps out of the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
