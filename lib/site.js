/**
 * Turns the video list into what the pages show: tags with counts, dates,
 * lengths, search words, and the links for each player.
 */
import { words } from "../src/js/search.js";
import { instagramCode, youtubeId } from "./videos.js";

// The browser counts results with the same wording.
export { plural } from "../src/js/state.js";

/**
 * The start of a text, cut at a word and ending in "...", for page summaries.
 * @param {string} text
 * @param {number} max
 */
export const summary = (text, max = 160) => {
    const flat = text.replace(/\s+/g, " ").trim();

    if (flat.length <= max) {
        return flat;
    }

    const cut = flat.slice(0, max - 3);
    const space = cut.lastIndexOf(" ");
    return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}...`;
};

/**
 * A tag's display name. data/tags.json can name a tag ("ai": "AI");
 * otherwise the slug is spelled out: "job-search" becomes "Job search".
 * @param {string} slug
 * @param {Record<string, string>} [names]
 * @returns {string}
 */
export const tagName = (slug, names = {}) => {
    if (Object.hasOwn(names, slug)) {
        return names[slug];
    }

    const spaced = slug.replaceAll("-", " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Every tag in use, with how many videos have it, sorted by name.
 * @param {{ tags: string[] }[]} videos
 * @param {Record<string, string>} [names]
 * @returns {{ slug: string, name: string, count: number }[]}
 */
export const collectTags = (videos, names = {}) => {
    const counts = new Map();

    for (const video of videos) {
        for (const slug of video.tags) {
            counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
    }

    return [...counts]
        .map(([slug, count]) => ({ slug, name: tagName(slug, names), count }))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.slug.localeCompare(b.slug));
};

/**
 * The most used tags first, for the short list on the home page.
 * @param {{ slug: string, name: string, count: number }[]} tags
 * @param {number} limit
 */
export const popularTags = (tags, limit) =>
    [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en")).slice(0, limit);

/**
 * Newest posted first. Videos posted the same day go by date created, then title.
 * @template {{ title: string, datePosted: string, dateCreated?: string }} T
 * @param {T[]} videos
 * @returns {T[]}
 */
export const newestFirst = (videos) => [...videos].sort((a, b) =>
    b.datePosted.localeCompare(a.datePosted)
    || (b.dateCreated ?? "").localeCompare(a.dateCreated ?? "")
    || a.title.localeCompare(b.title, "en"));

/**
 * "2026-10-26" as "October 26, 2026" (long) or "Oct 26, 2026" (medium).
 * @param {string} isoDate
 * @param {"long" | "medium"} [style]
 */
export const formatDate = (isoDate, style = "long") =>
    new Intl.DateTimeFormat("en-US", { dateStyle: style, timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));

/**
 * "1:05" as the ISO 8601 duration "PT1M5S", for <time datetime>.
 * @param {string} length "m:ss" or "h:mm:ss"
 */
export const isoDuration = (length) => {
    const parts = length.split(":").map(Number);
    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
    let out = "PT";

    if (hours > 0) {
        out += `${hours}H`;
    }

    if (minutes > 0) {
        out += `${minutes}M`;
    }

    if (seconds > 0 || out === "PT") {
        out += `${seconds}S`;
    }

    return out;
};

/**
 * "1:05" read out as "1 minute 5 seconds".
 * @param {string} length
 */
export const spokenLength = (length) => {
    const parts = length.split(":").map(Number);
    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
    const say = (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"}`;

    return [
        hours > 0 && say(hours, "hour"),
        minutes > 0 && say(minutes, "minute"),
        (seconds > 0 || (hours === 0 && minutes === 0)) && say(seconds, "second")
    ].filter(Boolean).join(" ");
};

/**
 * Every word someone might search for to find this video, space separated.
 * @param {{ title: string, description?: string, tags: string[], attributions?: string[] }} video
 * @param {Record<string, string>} [names]
 */
export const searchWords = (video, names = {}) => words([
    video.title,
    video.description ?? "",
    ...video.tags,
    ...video.tags.map((slug) => tagName(slug, names)),
    ...(video.attributions ?? [])
].join(" ")).join(" ");

/**
 * A caption split into paragraphs at blank lines, each a list of its lines.
 * @param {string} text
 * @returns {string[][]}
 */
export const paragraphs = (text) => text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

/**
 * A stat key as a label: "newPeople" or "new-people" become "New people".
 * @param {string} key
 */
export const statName = (key) => {
    const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").toLowerCase().trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Shorts are tall; everything else on YouTube is 16:9.
 * @param {string} link
 * @returns {"tall" | "wide"}
 */
export const youtubeShape = (link) => (new URL(link).pathname.startsWith("/shorts/") ? "tall" : "wide");

/**
 * The address each player loads. YouTube plays from the privacy-enhanced
 * domain, which sets no cookies until someone presses play.
 * @param {{ youtube?: string, instagram?: string }} video
 * @returns {{ youtube?: string, instagram?: string }}
 */
export const embedUrls = (video) => {
    const urls = {};

    if (video.youtube) {
        urls.youtube = `https://www.youtube-nocookie.com/embed/${youtubeId(video.youtube)}?rel=0&playsinline=1`;
    }

    if (video.instagram) {
        urls.instagram = `https://www.instagram.com/p/${instagramCode(video.instagram)}/embed/`;
    }

    return urls;
};

/**
 * The picture for a video's card: its file in covers/ when there is one,
 * otherwise YouTube's thumbnail, otherwise none. For Shorts that is oar2.jpg,
 * the tall frame; hqdefault.jpg is a wide frame with the Short in the middle.
 * @param {{ id: string, youtube?: string }} video
 * @param {boolean} hasCoverFile
 * @param {string} root path back to the site root, like "../../"
 * @returns {{ src: string, width: number, height: number } | null}
 */
export const cover = (video, hasCoverFile, root) => {
    if (hasCoverFile) {
        return { src: `${root}covers/${video.id}.jpg`, width: 540, height: 844 };
    }

    if (video.youtube) {
        const id = youtubeId(video.youtube);

        return youtubeShape(video.youtube) === "tall"
            ? { src: `https://i.ytimg.com/vi/${id}/oar2.jpg`, width: 720, height: 1280 }
            : { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 };
    }

    return null;
};
