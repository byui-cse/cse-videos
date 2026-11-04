/**
 * The video list in data/videos.json: loading it and checking every entry.
 * The build and CI both run these checks, so a typo fails before it reaches
 * the live site.
 */
import fs from "node:fs/promises";

const FIELDS = new Set([
    "id",
    "title",
    "description",
    "youtube",
    "instagram",
    "length",
    "attributions",
    "datePosted",
    "dateCreated",
    "tags",
    "stats"
]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LENGTH = [/^\d+:[0-5]\d$/, /^\d+:[0-5]\d:[0-5]\d$/];
const YOUTUBE_ID = /^[\w-]{11}$/;
const INSTAGRAM_PATH = /^\/(?:[\w.]+\/)?(?:p|reel|reels)\/([\w-]+)\/?$/;

/**
 * @param {string} value
 * @returns {URL | null}
 */
const parseUrl = (value) => {
    if (typeof value !== "string") {
        return null;
    }

    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url : null;
    } catch {
        return null;
    }
};

/**
 * The 11 character video ID from any common YouTube link
 * (watch, youtu.be, shorts, embed, live), or null if it isn't one.
 * @param {string} value
 * @returns {string | null}
 */
export const youtubeId = (value) => {
    const url = parseUrl(value);

    if (!url) {
        return null;
    }

    const host = url.hostname.replace(/^(?:www|m)\./, "");
    let id = null;

    if (host === "youtu.be") {
        id = url.pathname.slice(1);
    } else if (host === "youtube.com") {
        id = url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1];
    }

    return id && YOUTUBE_ID.test(id) ? id : null;
};

/**
 * The short code from an Instagram post or reel link, or null if it isn't one.
 * @param {string} value
 * @returns {string | null}
 */
export const instagramCode = (value) => {
    const url = parseUrl(value);

    if (!url || url.hostname.replace(/^www\./, "") !== "instagram.com") {
        return null;
    }

    return url.pathname.match(INSTAGRAM_PATH)?.[1] ?? null;
};

/**
 * True for a real calendar date written as YYYY-MM-DD.
 * @param {unknown} value
 */
export const isDate = (value) => {
    if (typeof value !== "string" || !DATE.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const isText = (value) => typeof value === "string" && value.trim() !== "";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * @param {unknown} video
 * @returns {string[]} what is wrong with this entry
 */
const checkVideo = (video) => {
    if (!isPlainObject(video)) {
        return ["must be an object"];
    }

    const problems = [];

    for (const key of Object.keys(video)) {
        if (!FIELDS.has(key)) {
            problems.push(`unknown field "${key}"`);
        }
    }

    if (typeof video.id !== "string" || !SLUG.test(video.id)) {
        problems.push('"id" must be lowercase words joined by hyphens, like "career-quest-part-1"');
    }

    if (!isText(video.title)) {
        problems.push('"title" is required');
    }

    if (video.description !== undefined && typeof video.description !== "string") {
        problems.push('"description" must be text');
    }

    if (video.youtube === undefined && video.instagram === undefined) {
        problems.push('needs a "youtube" or "instagram" link');
    }

    if (video.youtube !== undefined && youtubeId(video.youtube) === null) {
        problems.push('"youtube" must be an https link to a YouTube video');
    }

    if (video.instagram !== undefined && instagramCode(video.instagram) === null) {
        problems.push('"instagram" must be an https link to an Instagram post or reel');
    }

    if (video.length !== undefined && !LENGTH.some((pattern) => pattern.test(video.length))) {
        problems.push('"length" must look like "1:05" or "1:02:30"');
    }

    if (video.attributions !== undefined
        && !(Array.isArray(video.attributions) && video.attributions.every(isText))) {
        problems.push('"attributions" must be a list of text');
    }

    if (!isDate(video.datePosted)) {
        problems.push('"datePosted" must be a date like "2026-10-28"');
    }

    if (video.dateCreated !== undefined && !isDate(video.dateCreated)) {
        problems.push('"dateCreated" must be a date like "2026-10-28"');
    }

    if (!Array.isArray(video.tags) || video.tags.length === 0) {
        problems.push('"tags" must list at least one tag');
    } else {
        for (const tag of video.tags) {
            if (typeof tag !== "string" || !SLUG.test(tag)) {
                problems.push(`tag ${JSON.stringify(tag)} must be lowercase words joined by hyphens`);
            }
        }

        if (new Set(video.tags).size !== video.tags.length) {
            problems.push('"tags" lists the same tag twice');
        }
    }

    if (video.stats !== undefined) {
        if (!isPlainObject(video.stats)) {
            problems.push('"stats" must be an object of counts');
        } else {
            for (const [name, count] of Object.entries(video.stats)) {
                if (!Number.isInteger(count) || count < 0) {
                    problems.push(`stat "${name}" must be a whole number, 0 or more`);
                }
            }
        }
    }

    return problems;
};

/**
 * Checks the whole list. An empty result means it is valid.
 * @param {unknown} videos
 * @returns {string[]}
 */
export const validateVideos = (videos) => {
    if (!Array.isArray(videos)) {
        return ["the file must contain a list of videos"];
    }

    const errors = [];
    const ids = new Set();

    videos.forEach((video, index) => {
        const id = isPlainObject(video) && typeof video.id === "string" ? video.id : null;
        const label = id ? `video ${index + 1} (${id})` : `video ${index + 1}`;

        for (const problem of checkVideo(video)) {
            errors.push(`${label}: ${problem}`);
        }

        if (id !== null) {
            if (ids.has(id)) {
                errors.push(`${label}: another video already uses the id "${id}"`);
            }

            ids.add(id);
        }
    });

    return errors;
};

/**
 * Checks data/tags.json, which gives tags a display name when spelling out
 * the slug isn't right, like "ai": "AI". An empty result means it is valid.
 * @param {unknown} names
 * @returns {string[]}
 */
export const validateTagNames = (names) => {
    if (!isPlainObject(names)) {
        return ['the file must contain an object of tag names, like { "ai": "AI" }'];
    }

    const errors = [];

    for (const [slug, name] of Object.entries(names)) {
        if (!SLUG.test(slug)) {
            errors.push(`tag ${JSON.stringify(slug)} must be lowercase words joined by hyphens`);
        }

        if (!isText(name)) {
            errors.push(`tag "${slug}" needs a name`);
        }
    }

    return errors;
};

/**
 * Reads and parses a JSON file.
 * @param {string} file
 * @returns {Promise<unknown>}
 */
const loadJson = async (file) => {
    const text = await fs.readFile(file, "utf8");

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${file} is not valid JSON: ${error.message}`);
    }
};

/**
 * Reads and parses the video list.
 * @param {string} file
 * @returns {Promise<unknown>}
 */
export const loadVideos = (file) => loadJson(file);

/**
 * Reads the tag names. The file is optional; without it every tag is named
 * from its slug.
 * @param {string} file
 * @returns {Promise<unknown>}
 */
export const loadTagNames = async (file) => {
    try {
        return await loadJson(file);
    } catch (error) {
        if (error.code === "ENOENT") {
            return {};
        }

        throw error;
    }
};
