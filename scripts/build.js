/**
 * Builds the site into dist/: copies src/, bundles the CSS into one file,
 * and writes the checked video list. Run with `npm run build`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "lightningcss";
import { loadVideos, validateVideos } from "../lib/videos.js";

export const SRC = fileURLToPath(new URL("../src", import.meta.url));
export const DIST = fileURLToPath(new URL("../dist", import.meta.url));
export const DATA_FILE = fileURLToPath(new URL("../data/videos.json", import.meta.url));

const CSS_DIR = path.join(SRC, "css");
const STAGING = `${DIST}.tmp`;

// Lowers CSS nesting and other newer syntax for browsers from about 2021 on.
const TARGETS = { chrome: 100 << 16, firefox: 100 << 16, safari: 15 << 16 };

export const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * @returns {Promise<{ videos: number }>}
 */
export const build = async () => {
    const videos = await loadVideos(DATA_FILE);
    const errors = validateVideos(videos);

    if (errors.length > 0) {
        const list = errors.map((error) => `  ${error}`).join("\n");
        throw new Error(`data/videos.json has ${plural(errors.length, "problem")}:\n${list}`);
    }

    // Build into a staging folder and swap it in at the end, so the dev server
    // never serves a half-written dist/.
    await fs.rm(STAGING, { recursive: true, force: true });

    // The CSS is bundled below, so its source files aren't copied.
    await fs.cp(SRC, STAGING, {
        recursive: true,
        filter: (source) => source !== CSS_DIR && path.basename(source) !== ".DS_Store"
    });

    const { code } = bundle({ filename: path.join(CSS_DIR, "main.css"), minify: true, targets: TARGETS });
    await fs.mkdir(path.join(STAGING, "css"), { recursive: true });
    await fs.writeFile(path.join(STAGING, "css", "main.css"), code);

    await fs.mkdir(path.join(STAGING, "data"), { recursive: true });
    await fs.writeFile(path.join(STAGING, "data", "videos.json"), JSON.stringify(videos));

    await fs.rm(DIST, { recursive: true, force: true });
    await fs.rename(STAGING, DIST);

    return { videos: videos.length };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const { videos } = await build();
        console.log(`Built dist/ with ${plural(videos, "video")}.`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
