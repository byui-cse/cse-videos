/**
 * Checks data/videos.json and data/tags.json and lists every problem it finds.
 * Run with `npm run validate`.
 */
import { loadTagNames, loadVideos, validateTagNames, validateVideos } from "../lib/videos.js";
import { DATA_FILE, plural, TAGS_FILE } from "./build.js";

/**
 * @param {string} name
 * @param {string[]} errors
 */
const report = (name, errors) => {
    console.error(`${name} has ${plural(errors.length, "problem")}:`);

    for (const error of errors) {
        console.error(`  ${error}`);
    }

    process.exitCode = 1;
};

try {
    const videos = await loadVideos(DATA_FILE);
    const videoErrors = validateVideos(videos);

    if (videoErrors.length > 0) {
        report("data/videos.json", videoErrors);
    } else {
        console.log(`data/videos.json is valid (${plural(videos.length, "video")}).`);
    }

    const names = await loadTagNames(TAGS_FILE);
    const nameErrors = validateTagNames(names);

    if (nameErrors.length > 0) {
        report("data/tags.json", nameErrors);
    } else if (Array.isArray(videos)) {
        const used = new Set(videos.flatMap((video) => (Array.isArray(video?.tags) ? video.tags : [])));
        const unused = Object.keys(names).filter((slug) => !used.has(slug));

        console.log(`data/tags.json is valid (${plural(Object.keys(names).length, "name")}).`);

        if (unused.length > 0) {
            console.warn(`  No video uses these named tags yet: ${unused.join(", ")}`);
        }
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
