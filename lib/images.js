/**
 * Smaller copies of the covers for the pages. Faculty add one JPEG to
 * src/covers; the build writes AVIF and WebP copies at the widths the design
 * draws a still, and every <picture> offers them with srcset and sizes. The
 * JPEG stays as the fallback. Copies are never committed: they are made into
 * dist/ and kept in a local cache so a rebuild only encodes what changed.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 240 CSS px is the wall and grid size; 360 the lead tile; 480 the source.
export const COVER_WIDTHS = [240, 360, 480];

export const COVER_FORMATS = [
    { type: "image/avif", extension: "avif", options: { quality: 50 } },
    { type: "image/webp", extension: "webp", options: { quality: 70 } }
];

export const CACHE_DIR = fileURLToPath(new URL("../node_modules/.cache/cse-videos/covers", import.meta.url));

// Raise this whenever the steps below change (how a copy is oriented, resized
// or encoded), so no copy made the old way is reused.
const PIPELINE_VERSION = 1;

/**
 * The widths to make from a cover this wide: never wider than the source,
 * since a copy can't add detail, and always at least one.
 * @param {number} sourceWidth
 * @returns {number[]}
 */
export const derivativeWidths = (sourceWidth) => {
    const largest = COVER_WIDTHS.at(-1);
    return [...new Set([...COVER_WIDTHS.filter((width) => width < sourceWidth), Math.min(sourceWidth, largest)])];
};

/**
 * Where one copy lives, relative to the site root.
 * @param {string} id
 * @param {number} width
 * @param {string} extension
 */
export const derivativePath = (id, width, extension) => `covers/${id}-${width}.${extension}`;

/**
 * The <source> list for a cover: one srcset per format, smallest first.
 * @param {string} id
 * @param {{ width: number }} size the source's size
 * @param {string} root path back to the site root
 * @returns {{ type: string, srcset: string }[]}
 */
export const coverSources = (id, size, root) => COVER_FORMATS.map(({ type, extension }) => ({
    type,
    srcset: derivativeWidths(size.width).map((width) => `${root}${derivativePath(id, width, extension)} ${width}w`).join(", ")
}));

/**
 * Runs `task` over `items`, at most `limit` at a time.
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} task
 */
const eachLimited = async (items, limit, task) => {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const item = items[next];
            next += 1;
            await task(item);
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/**
 * Writes every copy for every cover into outDir/covers. Each copy is encoded
 * once per source file and settings, then reused from the cache.
 * @param {{
 *   covers: Map<string, { width: number, height: number }>,
 *   srcDir: string, outDir: string, cacheDir?: string, formats?: typeof COVER_FORMATS
 * }} options
 * @returns {Promise<number>} how many files were written
 */
export const writeCoverDerivatives = async ({ covers, srcDir, outDir, cacheDir = CACHE_DIR, formats = COVER_FORMATS }) => {
    const { default: sharp } = await import("sharp");
    const jobs = [];

    await fs.mkdir(cacheDir, { recursive: true });
    await fs.mkdir(path.join(outDir, "covers"), { recursive: true });

    for (const [id, size] of covers) {
        const source = path.join(srcDir, "covers", `${id}.jpg`);
        const bytes = await fs.readFile(source);
        const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);

        for (const width of derivativeWidths(size.width)) {
            for (const format of formats) {
                // Everything that shapes the copy is in its name: the source,
                // the width, every encoder option, sharp's version and ours.
                const settings = JSON.stringify([PIPELINE_VERSION, sharp.versions.sharp, width, format.extension, format.options]);
                const key = createHash("sha256").update(settings).digest("hex").slice(0, 16);
                const cached = path.join(cacheDir, `${digest}-${key}.${format.extension}`);
                jobs.push({ bytes, width, format, cached, target: path.join(outDir, derivativePath(id, width, format.extension)) });
            }
        }
    }

    await eachLimited(jobs, 4, async ({ bytes, width, format, cached, target }) => {
        try {
            await fs.access(cached);
        } catch {
            const data = await sharp(bytes)
                .autoOrient()
                .resize({ width, withoutEnlargement: true })
                .toFormat(format.extension, format.options)
                .toBuffer();
            // Written aside and renamed, so a cancelled build never leaves half a file.
            const partial = `${cached}.${process.pid}.tmp`;
            await fs.writeFile(partial, data);
            await fs.rename(partial, cached);
        }

        await fs.copyFile(cached, target);
    });

    return jobs.length;
};

/**
 * Compose a sharing image from twelve covers with clear upper crops.
 * @param {{ covers: Map<string, { width: number, height: number }>, srcDir: string, outDir: string }} options
 */
export const writeShareImage = async ({ covers, srcDir, outDir }) => {
    const { default: sharp } = await import("sharp");
    const width = 1200;
    const height = 630;
    const columns = 4;
    const rows = 3;
    const tileWidth = width / columns;
    const tileHeight = height / rows;
    const preferred = [
        "ai-tools-before-you-graduate", "career-quest-part-1", "final-projects-week",
        "maddie-summer-internship", "meet-brother-crosby", "seth-taylor-internship-insight",
        "what-storm-is-coming", "showcase-project-trace", "showcase-ssh-arcade",
        "showcase-walking-robots", "summer-projects", "your-connections-matter"
    ];
    const available = [...covers.keys()].sort();
    const ids = [
        ...preferred.filter((id) => covers.has(id)),
        ...available.filter((id) => !preferred.includes(id))
    ].slice(0, columns * rows);
    const tiles = await Promise.all(ids.map(async (id, index) => ({
        input: await sharp(path.join(srcDir, "covers", `${id}.jpg`))
            .autoOrient()
            .resize(tileWidth, tileHeight, { fit: "cover", position: "north" })
            .toBuffer(),
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight
    })));

    await sharp({ create: { width, height, channels: 3, background: "#003763" } })
        .composite(tiles)
        .jpeg({ quality: 85, chromaSubsampling: "4:4:4" })
        .toFile(path.join(outDir, "share.jpg"));
};
