import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const sharedConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default function nextConfig(phase) {
  return {
    ...sharedConfig,
    // Keep `next dev` isolated from production builds. Otherwise, running
    // `next build` while the dev server is alive replaces its manifests and
    // makes every development asset under /_next/static return 404.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
