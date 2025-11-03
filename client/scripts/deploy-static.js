#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const deployRoot = join(root, "deploy");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = join(deployRoot, timestamp);
const latestDir = join(deployRoot, "latest");

const info = msg => console.log(`[deploy] ${msg}`);

const cleanDir = target => {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
};

const ensureDir = target => {
  mkdirSync(target, { recursive: true });
};

try {
  info("Building static assets with Vite...");
  execSync("npx vite build", { stdio: "inherit", cwd: root });

  info("Preparing deploy directory...");
  ensureDir(deployRoot);
  cleanDir(releaseDir);
  ensureDir(releaseDir);

  info(`Copying dist/ to deploy/${timestamp}...`);
  cpSync(distDir, releaseDir, { recursive: true });

  info("Refreshing deploy/latest snapshot...");
  cleanDir(latestDir);
  cpSync(releaseDir, latestDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "dist",
    releaseDir: `deploy/${timestamp}`,
    latestDir: "deploy/latest"
  };
  writeFileSync(join(deployRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

  info("Static bundle is ready for upload.");
  info(`-> Upload deploy/${timestamp} or deploy/latest to your static host.`);
} catch (error) {
  console.error("[deploy] Build failed:", error.message);
  process.exitCode = 1;
}
