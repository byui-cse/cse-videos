/**
 * What to watch next: the other parts of a series, and videos that share
 * the rarest tags with the one being watched.
 */
import { newestFirst } from "./site.js";

/**
 * Videos in this series, in part order.
 * @param {{ series?: string, part?: number }} video
 * @param {{ series?: string, part?: number }[]} videos
 */
export const seriesParts = (video, videos) => video.series === undefined
    ? []
    : videos.filter((item) => item.series === video.series).sort((a, b) => a.part - b.part);

/**
 * The parts immediately before and after this video.
 * @param {{ id: string, series?: string, part?: number }} video
 * @param {{ id: string, series?: string, part?: number }[]} videos
 */
export const seriesNeighbors = (video, videos) => {
    const parts = seriesParts(video, videos);
    const index = parts.findIndex((item) => item.id === video.id);

    return {
        previous: index > 0 ? parts[index - 1] : null,
        next: index >= 0 ? parts[index + 1] ?? null : null
    };
};

/**
 * Other videos with shared tags, ranked by how rare those tags are.
 * @param {{ id: string, tags: string[], series?: string }} video
 * @param {{ id: string, title: string, datePosted: string, dateCreated?: string, tags: string[], series?: string }[]} videos
 * @param {{ limit?: number }} [options]
 */
export const relatedVideos = (video, videos, { limit = 6 } = {}) => {
    const counts = new Map();

    for (const item of videos) {
        for (const tag of new Set(item.tags)) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }

    const tags = new Set(video.tags);
    const scored = newestFirst(videos)
        .filter((item) => item.id !== video.id && (video.series === undefined || item.series !== video.series))
        .map((item) => ({
            item,
            score: [...new Set(item.tags)].reduce((total, tag) =>
                total + (tags.has(tag) ? Math.log(videos.length / counts.get(tag)) : 0), 0)
        }))
        .filter(({ score }) => score > 0);

    return scored.sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, limit))
        .map(({ item }) => item);
};
