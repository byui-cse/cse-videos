/**
 * The video list in data/videos.json: loading it and checking every entry.
 * The build and CI both run these checks, so a typo fails before it reaches
 * the live site.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { textLinks } from "./html.js";
import { readJpegSize } from "./jpeg.js";

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
    "series",
    "part",
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

/** @param {string} text */
const hasBrokenCreditLink = (text) => {
    let brackets = 0;

    for (let index = 0; index < text.length; index++) {
        if (text[index] === "[") {
            brackets++;
        } else if (text[index] === "]") {
            if (--brackets < 0 || /^\]\s*(?:\(|https?:\/\/)/.test(text.slice(index))) {
                return true;
            }
        }
    }

    return brackets !== 0;
};

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

    if (Array.isArray(video.attributions)) {
        for (const credit of video.attributions.filter(isText)) {
            const links = textLinks(credit).filter((token) => token.bracket);
            let remainder = credit;

            for (const token of [...links].reverse()) {
                remainder = remainder.slice(0, token.start) + remainder.slice(token.end);
            }

            if (hasBrokenCreditLink(remainder)) {
                problems.push('"attributions" links must use [text](https://url), with matching brackets and an https address');
            }
        }
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

    if (video.series !== undefined && (typeof video.series !== "string" || !SLUG.test(video.series))) {
        problems.push('"series" must be lowercase words joined by hyphens');
    }

    if (video.part !== undefined && (!Number.isInteger(video.part) || video.part < 1)) {
        problems.push('"part" must be a whole number, 1 or more');
    }

    if (video.series === undefined && video.part !== undefined) {
        problems.push('"part" needs a "series"');
    }

    if (video.series !== undefined && video.part === undefined) {
        problems.push('"series" needs a "part"');
    }

    if (typeof video.series === "string" && SLUG.test(video.series)
        && Array.isArray(video.tags) && !video.tags.includes(video.series)) {
        problems.push(`"series" must also be one of the tags, so its tag page lists every part: add "${video.series}" to "tags"`);
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
 * The closest allowed tag to a mistyped one: a prefix match first, then
 * the fewest single-letter edits (at most two). Null when nothing is close.
 * @param {string} tag
 * @param {string[]} allowed
 * @returns {string | null}
 */
const closestTag = (tag, allowed) => allowed
    .map((name) => ({
        name,
        prefix: tag.length >= 3 && (name.startsWith(tag) || tag.startsWith(name)),
        distance: editDistance(tag, name)
    }))
    .filter((candidate) => candidate.prefix || (candidate.distance <= 2
        && (Math.max(tag.length, candidate.name.length) - candidate.distance)
            / Math.max(tag.length, candidate.name.length) > 0.4))
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || a.distance - b.distance || a.name.localeCompare(b.name))[0]?.name ?? null;

/**
 * Checks the whole list. An empty result means it is valid. When the tag
 * names from data/tags.json are given, every tag must be one of them.
 * @param {unknown} videos
 * @param {Record<string, string>} [names]
 * @returns {string[]}
 */
export const validateVideos = (videos, names) => {
    if (!Array.isArray(videos)) {
        return ["the file must contain a list of videos"];
    }

    const errors = [];
    const ids = new Set();
    const links = { instagram: new Set(), youtube: new Set() };
    const linkReaders = { instagram: instagramCode, youtube: youtubeId };
    const allowedTags = isPlainObject(names) ? Object.keys(names) : null;
    const seriesParts = new Map();

    videos.forEach((video, index) => {
        const id = isPlainObject(video) && typeof video.id === "string" ? video.id : null;
        const label = id ? `video ${index + 1} (${id})` : `video ${index + 1}`;

        for (const problem of checkVideo(video)) {
            errors.push(`${label}: ${problem}`);
        }

        if (!isPlainObject(video)) {
            return;
        }

        for (const [field, read] of Object.entries(linkReaders)) {
            const code = read(video[field]);

            if (code === null) {
                continue;
            }

            if (links[field].has(code)) {
                errors.push(`${label}: another video already uses the same ${field} link`);
            }

            links[field].add(code);
        }

        if (allowedTags !== null && Array.isArray(video.tags)) {
            for (const tag of video.tags) {
                if (typeof tag !== "string" || !SLUG.test(tag) || allowedTags.includes(tag)) {
                    continue;
                }

                const suggestion = closestTag(tag, allowedTags);
                errors.push(`${label}: tag "${tag}" isn't in data/tags.json.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`);
            }
        }

        if (id !== null) {
            if (ids.has(id)) {
                errors.push(`${label}: another video already uses the id "${id}"`);
            }

            ids.add(id);
        }

        if (typeof video.series === "string" && SLUG.test(video.series)
            && Number.isInteger(video.part) && video.part > 0) {
            const parts = seriesParts.get(video.series) ?? new Set();

            if (parts.has(video.part)) {
                errors.push(`${label}: another video already uses part ${video.part} in series "${video.series}"`);
            }

            parts.add(video.part);
            seriesParts.set(video.series, parts);
        }
    });

    for (const [series, parts] of seriesParts) {
        for (let part = 1; part <= Math.max(...parts); part++) {
            if (!parts.has(part)) {
                errors.push(`series "${series}" has no part ${part}; number the parts 1, 2, 3 and so on`);
            }
        }
    }

    return errors;
};

/**
 * Checks the allowed tags and their display names. An empty result means it is valid.
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
 * Reads the allowed tag names; a missing file leaves no allowed tags.
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

/**
 * The number of single-letter edits that turn one tag into another.
 * @param {string} a
 * @param {string} b
 */
const editDistance = (a, b) => {
    let row = Array.from({ length: b.length + 1 }, (_, index) => index);
    let previous = row;

    for (let i = 0; i < a.length; i++) {
        const next = [i + 1];

        for (let j = 0; j < b.length; j++) {
            let distance = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j]));

            if (i > 0 && j > 0 && a[i] === b[j - 1] && a[i - 1] === b[j]) {
                distance = Math.min(distance, previous[j - 1] + 1);
            }

            next.push(distance);
        }

        previous = row;
        row = next;
    }

    return row[b.length];
};

const COVER_RATIO = 480 / 750;
const COVER_MAX_BYTES = 150 * 1024;
const IMAGE_FILE = /\.(?:jpe?g|png|webp|gif|avif)$/i;

/**
 * Checks src/covers: every video without a YouTube link needs <id>.jpg,
 * shaped 480:750 (within 2%) and no bigger than 150 KB. Files no video uses
 * are warnings. Returns the true size of each cover for the pages.
 * @param {{ id: string, youtube?: string }[]} videos
 * @param {string} srcDir
 * @returns {Promise<{ covers: Map<string, { width: number, height: number }>, errors: string[], warnings: string[] }>}
 */
export const checkCovers = async (videos, srcDir) => {
    const directory = path.join(srcDir, "covers");
    let files = [];

    try {
        files = await fs.readdir(directory);
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    const errors = [];
    const warnings = [];
    const covers = new Map();
    const expectedFiles = new Set(videos.map((video) => `${video.id}.jpg`));

    for (const file of files.filter((name) => IMAGE_FILE.test(name) && !expectedFiles.has(name))) {
        warnings.push(`No video uses cover ${file}`);
    }

    for (const video of videos) {
        const expected = `${video.id}.jpg`;

        if (!files.includes(expected)) {
            if (!video.youtube) {
                const nearMisses = files.filter((file) => path.parse(file).name.toLowerCase() === video.id.toLowerCase());
                const hint = nearMisses.length > 0 ? `; found ${nearMisses.join(", ")}; rename it to ${expected}` : "";
                errors.push(`${video.id} has no cover: add src/covers/${expected} or a YouTube link${hint}`);
            }

            continue;
        }

        const file = path.join(directory, expected);

        try {
            const size = await readJpegSize(file);
            covers.set(video.id, size);

            if (Math.abs(size.width / size.height / COVER_RATIO - 1) > 0.02) {
                errors.push(`${expected} is ${size.width}x${size.height}; covers are 480x750 (the same shape within 2%)`);
            }

            if ((await fs.stat(file)).size > COVER_MAX_BYTES) {
                errors.push(`${expected} is over 150 KB; save it smaller`);
            }
        } catch (error) {
            errors.push(`${expected}: ${error.message}`);
        }
    }

    return { covers, errors, warnings };
};
