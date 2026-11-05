/**
 * Builds the site into dist/: copies src/, bundles the CSS into one file,
 * and writes a page for the home list, the tag list, every tag, and every
 * video. Run with `npm run build`.
 *
 * Set SITE_URL (the deploy workflow does) to add full links for sharing
 * previews, like https://byui-cse.github.io/cse-videos/.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "lightningcss";
import { homePage, notFoundPage, tagPage, tagsPage, videoPage } from "../lib/render.js";
import { robotsTxt, sitemapXml } from "../lib/seo.js";
import { collectTags, plural } from "../lib/site.js";
import { checkCovers, loadTagNames, loadVideos, validateTagNames, validateVideos } from "../lib/videos.js";

export { plural };

export const SRC = fileURLToPath(new URL("../src", import.meta.url));
export const DIST = fileURLToPath(new URL("../dist", import.meta.url));
export const DATA_FILE = fileURLToPath(new URL("../data/videos.json", import.meta.url));
export const TAGS_FILE = fileURLToPath(new URL("../data/tags.json", import.meta.url));

// Lowers CSS nesting and other newer syntax for browsers from about 2021 on.
const TARGETS = { chrome: 100 << 16, firefox: 100 << 16, safari: 15 << 16 };

/**
 * The site's address with a trailing slash, or null when it isn't set.
 * @param {string | undefined} value
 * @returns {string | null}
 */
export const siteUrlFrom = (value) => {
    if (!value) {
        return null;
    }

    let url;

    try {
        url = new URL(value);
    } catch {
        throw new Error(`SITE_URL must be a full address like https://byui-cse.github.io/cse-videos/, not ${JSON.stringify(value)}`);
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`SITE_URL must start with https://, not ${JSON.stringify(value)}`);
    }

    url.search = "";
    url.hash = "";
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
};

/**
 * Throws with every problem in a data file, one per line.
 * @param {string} file
 * @param {string[]} errors
 */
const failOn = (file, errors) => {
    if (errors.length > 0) {
        const list = errors.map((error) => `  ${error}`).join("\n");
        throw new Error(`${file} has ${plural(errors.length, "problem")}:\n${list}`);
    }
};

/**
 * @param {string} file
 * @param {string} contents
 */
const writeFile = async (file, contents) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
};

/**
 * @param {{ dataFile?: string, tagsFile?: string, srcDir?: string, outDir?: string, siteUrl?: string }} [options]
 * @returns {Promise<{ videos: number, tags: number, pages: number, warnings: string[] }>}
 */
export const build = async ({
    dataFile = DATA_FILE,
    tagsFile = TAGS_FILE,
    srcDir = SRC,
    outDir = DIST,
    siteUrl = process.env.SITE_URL
} = {}) => {
    const videos = await loadVideos(dataFile);

    const names = await loadTagNames(tagsFile);
    failOn("data/tags.json", validateTagNames(names));

    failOn("data/videos.json", validateVideos(videos, names));
    const { covers, errors, warnings } = await checkCovers(videos, srcDir);
    failOn("src/covers", errors);
    const site = {
        videos,
        tags: collectTags(videos, names),
        names,
        covers,
        siteUrl: siteUrlFrom(siteUrl)
    };

    // Build into a staging folder and swap it in at the end, so the dev server
    // never serves a half-written site.
    const staging = `${outDir}.tmp`;
    const cssDir = path.join(srcDir, "css");
    await fs.rm(staging, { recursive: true, force: true });

    // The CSS is bundled below, so its source files aren't copied.
    await fs.cp(srcDir, staging, {
        recursive: true,
        filter: (source) => source !== cssDir && path.basename(source) !== ".DS_Store"
    });

    const { code } = bundle({ filename: path.join(cssDir, "main.css"), minify: true, targets: TARGETS });
    await writeFile(path.join(staging, "css", "main.css"), code);

    await writeFile(path.join(staging, "data", "videos.json"), JSON.stringify(videos));
    await writeFile(path.join(staging, "data", "tags.json"), JSON.stringify(names));

    const pages = new Map([
        ["index.html", homePage(site)],
        ["tags/index.html", tagsPage(site)],
        ["404.html", notFoundPage(site)]
    ]);

    for (const tag of site.tags) {
        pages.set(`tags/${tag.slug}/index.html`, tagPage(site, tag));
    }

    for (const video of videos) {
        pages.set(`videos/${video.id}/index.html`, videoPage(site, video));
    }

    for (const [file, contents] of pages) {
        await writeFile(path.join(staging, file), contents);
    }

    await writeFile(path.join(staging, "robots.txt"), robotsTxt(site.siteUrl));

    if (site.siteUrl) {
        // No lastmod: a posting date isn't when a page last changed (an edited
        // title or tag changes pages without moving it), and a wrong lastmod is
        // worse than none.
        const entries = [
            { url: site.siteUrl },
            { url: `${site.siteUrl}tags/` },
            ...site.tags.map((tag) => ({ url: `${site.siteUrl}tags/${tag.slug}/` })),
            ...videos.map((video) => ({ url: `${site.siteUrl}videos/${video.id}/` }))
        ];
        await writeFile(path.join(staging, "sitemap.xml"), sitemapXml(entries));
    }

    await fs.rm(outDir, { recursive: true, force: true });
    await fs.rename(staging, outDir);

    return { videos: videos.length, tags: site.tags.length, pages: pages.size, warnings };
};

// Runs only as `node scripts/build.js`, not when another script imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const { videos, tags, pages, warnings } = await build();

        for (const warning of warnings) {
            console.warn(`Warning: ${warning}`);
        }

        console.log(`Built dist/ with ${plural(videos, "video")}, ${plural(tags, "tag")}, and ${plural(pages, "page")}.`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
