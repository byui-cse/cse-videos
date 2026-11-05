/**
 * The home page's wall of stills and the topic cards: which reel goes where.
 * Both are fixed by the data, so every build of the same list draws the same
 * page.
 */

/**
 * A seeded random number generator (mulberry32), so the wall's shuffle is
 * the same on every build.
 * @param {number} seed
 * @returns {() => number} numbers from 0 up to 1
 */
export const seededRandom = (seed) => {
    let state = seed | 0;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Chosen with the 36 reels of November 2026 so a typical search ("portfolio")
// lights reels on the first screen at 1440, and so neither the two
// informational-interview reels nor two Career Quest boards sit side by side
// in the six-, four- or three-column wall.
export const WALL_SEED = 14473;

/**
 * The videos in their wall order: shuffled so the wall reads as a feed, not
 * as the dated index under it.
 * @template T
 * @param {T[]} videos newest first
 * @param {number} [seed]
 * @returns {T[]}
 */
export const wallOrder = (videos, seed = WALL_SEED) => {
    const random = seededRandom(seed);
    const slots = videos.map((_, index) => index);

    for (let i = slots.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    return slots.map((index) => videos[index]);
};

/**
 * The stills on each topic card. The most used topics (`wide`) show two
 * reels, the rest one. Topics with the fewest reels choose first, each taking
 * its newest reel that no other card has taken yet, so the cards repeat as
 * few stills as they can; a topic whose reels are all taken reuses its newest.
 * @template {{ id: string, tags: string[] }} V
 * @param {{ slug: string, name: string, count: number }[]} tags
 * @param {V[]} videos newest first
 * @param {Set<string>} wide slugs that show two reels
 * @returns {Map<string, V[]>}
 */
export const topicStills = (tags, videos, wide) => {
    const used = new Set();
    const chosen = new Map();
    const scarceFirst = [...tags].sort((a, b) => a.count - b.count || a.name.localeCompare(b.name, "en"));

    for (const tag of scarceFirst) {
        const list = videos.filter((video) => video.tags.includes(tag.slug));
        const fresh = list.filter((video) => !used.has(video.id));
        const pick = [...fresh, ...list.filter((video) => used.has(video.id))].slice(0, wide.has(tag.slug) ? 2 : 1);

        for (const video of pick) {
            used.add(video.id);
        }

        chosen.set(tag.slug, pick);
    }

    return chosen;
};
