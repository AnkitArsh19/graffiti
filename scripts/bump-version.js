#!/usr/bin/env node

/**
 * Version bumper script for Graffiti Desktop & Frontend
 * Usage:
 *   node scripts/bump-version.js <new-version>
 *   node scripts/bump-version.js minor
 *   node scripts/bump-version.js patch
 *
 * Example:
 *   node scripts/bump-version.js 0.2.0
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const pkgJsonPath = path.join(rootDir, "graffiti-frontend", "package.json");
const tauriConfPath = path.join(rootDir, "graffiti-frontend", "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "graffiti-frontend", "src-tauri", "Cargo.toml");
const readmePath = path.join(rootDir, "README.md");
const appTsxPath = path.join(rootDir, "graffiti-frontend", "src", "App.tsx");

// Read current version from package.json
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
const currentVersion = pkg.version;

let targetVersion = process.argv[2];

if (!targetVersion) {
  console.log(`Current version: ${currentVersion}`);
  console.log(`Usage: node scripts/bump-version.js <new-version | patch | minor | major>`);
  process.exit(1);
}

const [major, minor, patch] = currentVersion.split(".").map(Number);

if (targetVersion === "patch") {
  targetVersion = `${major}.${minor}.${patch + 1}`;
} else if (targetVersion === "minor") {
  targetVersion = `${major}.${minor + 1}.0`;
} else if (targetVersion === "major") {
  targetVersion = `${major + 1}.0.0`;
}

// Clean leading 'v' if present
if (targetVersion.startsWith("v")) {
  targetVersion = targetVersion.slice(1);
}

if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  console.error(`Invalid version format: "${targetVersion}". Expected semver e.g. 0.2.0`);
  process.exit(1);
}

console.log(`Bumping version: ${currentVersion} -> ${targetVersion}`);

// 1. Update package.json
pkg.version = targetVersion;
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`✓ Updated ${pkgJsonPath}`);

// 2. Update tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
  tauriConf.version = targetVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
  console.log(`✓ Updated ${tauriConfPath}`);
}

// 3. Update Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, "utf-8");
  cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log(`✓ Updated ${cargoTomlPath}`);
}

// 4. Update README.md
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, "utf-8");
  const oldVersionRegex = new RegExp(`v${currentVersion.replace(/\./g, "\\.")}`, "g");
  readme = readme.replace(oldVersionRegex, `v${targetVersion}`);
  readme = readme.replace(new RegExp(`_${currentVersion.replace(/\./g, "\\.")}_`, "g"), `_${targetVersion}_`);
  fs.writeFileSync(readmePath, readme);
  console.log(`✓ Updated ${readmePath}`);
}

// 5. Update App.tsx DESKTOP_VERSION constant if present
if (fs.existsSync(appTsxPath)) {
  let appTsx = fs.readFileSync(appTsxPath, "utf-8");
  if (appTsx.includes("DESKTOP_VERSION")) {
    appTsx = appTsx.replace(/const DESKTOP_VERSION = "[^"]+";/, `const DESKTOP_VERSION = "${targetVersion}";`);
    fs.writeFileSync(appTsxPath, appTsx);
    console.log(`✓ Updated ${appTsxPath}`);
  }
}

// 6. Sync Cargo.lock
try {
  console.log("Syncing Cargo.lock via cargo check...");
  execSync("cargo check", {
    cwd: path.join(rootDir, "graffiti-frontend", "src-tauri"),
    stdio: "inherit",
  });
  console.log("✓ Synced Cargo.lock");
} catch (err) {
  console.warn("Notice: cargo check did not complete (cargo might not be in PATH or dev server is busy).");
}

console.log(`\nSuccessfully bumped Graffiti to v${targetVersion}!`);
