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

// Chosen with the 36 reels of November 2026 so neither the two
// informational-interview reels nor two Career Quest boards sit side by side
// in the walls' fourteen-, nine- or six-column layouts.
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

// The Video wall's columns at each width (src/css/components/wall.css):
// 1100 px and wider, 700 to 1099 px, and narrower.
export const WALL_COLUMNS = { wide: 14, mid: 9, narrow: 6 };

// One row of the widest wall. Its columns are lifted past the top of the
// stage, so this row holds echoes and every video's own still starts below it.
export const WALL_LEAD = WALL_COLUMNS.wide;

// The fewest stills the Video wall draws: nine rows of the widest wall
// (fourteen and twenty-one rows at the narrower ones), enough to fill a
// landscape screen. On a taller screen the wall stops at its last full row and
// the page goes on below it.
export const WALL_STILLS = WALL_COLUMNS.wide * 9;

/**
 * How many stills the Video wall draws for this many videos: a whole number
 * of WALL_STILLS (a multiple of 14, 9 and 6, so every row is full at every
 * width), with at least one row of echoes under the last video's own still.
 * @param {number} videos
 */
export const wallTotal = (videos) => WALL_STILLS * Math.max(1, Math.ceil((WALL_LEAD + videos + WALL_LEAD) / WALL_STILLS));

// The home page's card: six rows of nine (nine rows of six on a phone), so
// its columns reach the foot of the card even where the card is 4:3.
export const CARD_STILLS = 54;

/**
 * A wall's stills: `lead` echoes first, then every video once in its wall
 * order, then more echoes until there are `total`, so the wall has no gaps. Echoes start half way along the order and each later pass
 * starts further along, so no copy lands beside, over or under a still of the
 * same video at any of the walls' column counts.
 * @template T
 * @param {T[]} videos in wall order
 * @param {number} total how many stills the wall draws, at least
 * @param {number} [lead] echoes before the videos' own stills
 * @returns {{ video: T, echo: boolean }[]}
 */
export const wallFill = (videos, total, lead = 0) => {
    const count = videos.length;

    if (count === 0) {
        return [];
    }

    const half = Math.floor(count / 2);
    const step = Math.max(1, half - 1);
    const stills = [];

    for (let slot = 0; slot < lead; slot += 1) {
        stills.push({ video: videos[(slot + half) % count], echo: true });
    }

    for (const video of videos) {
        stills.push({ video, echo: false });
    }

    for (let index = count; stills.length < total; index += 1) {
        const pass = Math.floor(index / count);
        stills.push({ video: videos[(index + pass * step) % count], echo: true });
    }

    return stills;
};

/**
 * The rows the Video wall needs at each width, as CSS custom properties the
 * build adds to the stylesheet (the pages' policy allows no inline styles):
 * how many rows hold the lead and every video's own still, so the stage is
 * at least that tall, and how many full rows the wall draws, so it is never
 * taller than its stills.
 * @param {number} videos how many videos
 * @param {number} total how many stills the wall draws
 * @param {number} [lead]
 * @returns {string}
 */
export const wallStageCss = (videos, total, lead = WALL_LEAD) => {
    const drawn = videos === 0 ? 0 : total;
    const rules = Object.entries(WALL_COLUMNS).flatMap(([name, columns]) => [
        `--wall-rows-${name}:${Math.ceil((videos === 0 ? 0 : lead + videos) / columns)}`,
        `--wall-full-${name}:${Math.floor(drawn / columns)}`
    ]);

    return `.wall-stage{${rules.join(";")}}`;
};
