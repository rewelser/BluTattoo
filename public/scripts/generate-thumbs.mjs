/**
 * This script uses sharp (ran `npm i -D sharp`). 
 * It generates 4 default thumbnail sizes, put inside public/uploads/_thumbs/artists/{widths} 
 * by default.
 * 
 * We have this script run in both predev & prebuild (package.json). The thumbs bypass 
 * content.config.ts by dint of having the same src name as their original version.
 * Look to const thumb in [slug].astro for usage.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

// More targets can be added later
const TARGETS = [
  {
    name: "artists",
    inputDir: path.join(PUBLIC_DIR, "uploads", "artists"),
    outputDir: path.join(PUBLIC_DIR, "uploads", "_thumbs", "artists"),
  },
];

// Widths to generate
const WIDTHS = [240, 360, 480, 720];

// Extensions to include (skip svg/icons/etc)
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Recursive directory walk (recursive in case of subdirectory)
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// recursive: true = ensure all missing parent folders too
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// 
/**
 * Computes a relative path; preserves structure
 * Example:
 * baseDir: .../public/uploads/artists
 * absFile: .../public/uploads/artists/portfolio/zirk1.jpeg
 * relPath becomes: portfolio/zirk1.jpeg
 * 
 */
function relFrom(baseDir, absFile) {
  return path.relative(baseDir, absFile).split(path.sep).join("/");
}

// Generate thumbs for a single file
async function generateThumbsForFile(absFile, relPath, outBaseDir) {
  const ext = path.extname(absFile).toLowerCase();
  if (!IMG_EXTS.has(ext)) return;

  // For each width: write to outBaseDir/{width}/{relPath}
  for (const w of WIDTHS) {
    const outFile = path.join(outBaseDir, String(w), relPath);
    ensureDir(path.dirname(outFile));

    // Skip if output exists and is newer than input (fast incremental builds)
    if (fs.existsSync(outFile)) {
      const inStat = fs.statSync(absFile);
      const outStat = fs.statSync(outFile);
      if (outStat.mtimeMs >= inStat.mtimeMs) continue;
    }

    const img = sharp(absFile, { failOn: "none" });

    // Resize by width, preserve aspect ratio.
    // "withoutEnlargement" avoids upscaling small originals.
    await img
      .resize({ width: w, withoutEnlargement: true })
      .toFile(outFile);
  }
}

async function main() {
  let processed = 0;

  for (const t of TARGETS) {
    if (!fs.existsSync(t.inputDir)) {
      console.warn(`[thumbs] Missing inputDir: ${t.inputDir}`);
      continue;
    }

    const files = walk(t.inputDir);
    console.log(`[thumbs] ${t.name}: found ${files.length} files`);

    for (const absFile of files) {
      const relPath = relFrom(t.inputDir, absFile);
      try {
        await generateThumbsForFile(absFile, relPath, t.outputDir);
        processed++;
      } catch (e) {
        console.warn(`[thumbs] Failed: ${absFile}`);
        console.warn(e?.message ?? e);
      }
    }
  }

  console.log(`[thumbs] done. processed ${processed} files (widths: ${WIDTHS.join(", ")})`);
}

main();
