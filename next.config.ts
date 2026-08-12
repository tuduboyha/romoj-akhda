import type { NextConfig } from "next";

// GitHub Pages serves this site from https://<user>.github.io/romoj-akhda/,
// so the build needs to know to prefix all routes/assets with that subpath.
// Only applied inside GitHub Actions — local `next dev` is unaffected.
const REPO_NAME = "romoj-akhda";
const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: isGithubActions ? `/${REPO_NAME}` : "",
  assetPrefix: isGithubActions ? `/${REPO_NAME}/` : "",
  env: {
    // next/image with unoptimized:true doesn't auto-prefix basePath onto raw
    // src values, so components read this to build correct image URLs themselves.
    NEXT_PUBLIC_BASE_PATH: isGithubActions ? `/${REPO_NAME}` : "",
  },
};

export default nextConfig;
