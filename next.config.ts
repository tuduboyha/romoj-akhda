import type { NextConfig } from "next";

// GitHub Pages serves this site from https://<user>.github.io/santal-radio/,
// so the build needs to know to prefix all routes/assets with that subpath.
// Only applied inside GitHub Actions — local `next dev` is unaffected.
const REPO_NAME = "santal-radio";
const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: isGithubActions ? `/${REPO_NAME}` : "",
  assetPrefix: isGithubActions ? `/${REPO_NAME}/` : "",
};

export default nextConfig;
