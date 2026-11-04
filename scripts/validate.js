/**
 * Checks data/videos.json and lists every problem it finds.
 * Run with `npm run validate`.
 */
import { loadVideos, validateVideos } from "../lib/videos.js";
import { DATA_FILE, plural } from "./build.js";

try {
    const videos = await loadVideos(DATA_FILE);
    const errors = validateVideos(videos);

    if (errors.length > 0) {
        console.error(`data/videos.json has ${plural(errors.length, "problem")}:`);

        for (const error of errors) {
            console.error(`  ${error}`);
        }

        process.exitCode = 1;
    } else {
        console.log(`data/videos.json is valid (${plural(videos.length, "video")}).`);
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
