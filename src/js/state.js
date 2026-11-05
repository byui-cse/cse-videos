/**
 * The parts of the list and player that don't touch the page: reading and
 * writing the address, and the wording of the results count. Shared by the
 * build and the browser, and covered by tests.
 */

const ORDERS = ["newest", "oldest"];
const SOURCES = ["youtube", "instagram"];

/**
 * "1 video", "2 videos".
 * @param {number} count
 * @param {string} word
 */
export const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The search and sort order in an address's query string. Anything that
 * isn't a known order falls back to newest first.
 * @param {string} search like "?q=portfolio&sort=oldest"
 * @returns {{ query: string, order: "newest" | "oldest" }}
 */
export const readListParams = (search) => {
    const params = new URLSearchParams(search);
    const order = params.get("sort");

    return {
        query: (params.get("q") ?? "").trim(),
        order: ORDERS.includes(order ?? "") ? /** @type {"newest" | "oldest"} */ (order) : "newest"
    };
};

/**
 * The address for a search and order. Defaults are left out, so the plain
 * list keeps a plain address.
 * @param {string} href
 * @param {string} query
 * @param {"newest" | "oldest"} order
 */
export const listUrl = (href, query, order) => {
    const url = new URL(href);

    if (query === "") {
        url.searchParams.delete("q");
    } else {
        url.searchParams.set("q", query);
    }

    if (order === "newest") {
        url.searchParams.delete("sort");
    } else {
        url.searchParams.set("sort", order);
    }

    return url.href;
};

/**
 * The results count: "36 videos", "5 of 36 videos match “port”", or
 * "No videos match “x”".
 * @param {number} shown
 * @param {number} total
 * @param {string} query
 */
export const countText = (shown, total, query) => {
    if (query === "") {
        return plural(total, "video");
    }

    return shown === 0 ? `No videos match “${query}”` : `${shown} of ${plural(total, "video")} match “${query}”`;
};

/**
 * The player a link asks for with ?source=, if this video has it.
 * @param {string} search
 * @param {string[]} available
 * @returns {string | null}
 */
export const requestedSource = (search, available) => {
    const source = new URLSearchParams(search).get("source") ?? "";
    return SOURCES.includes(source) && available.includes(source) ? source : null;
};

/**
 * The address with the chosen player. The default player is left out.
 * @param {string} href
 * @param {string} source
 * @param {string} defaultSource
 */
export const playerUrl = (href, source, defaultSource) => {
    const url = new URL(href);

    if (source === defaultSource) {
        url.searchParams.delete("source");
    } else {
        url.searchParams.set("source", source);
    }

    return url.href;
};

/**
 * Phones with a share sheet use it; other devices copy the link.
 * @param {{ canShare: boolean, coarsePointer: boolean }} options
 * @returns {"share" | "copy"}
 */
export const shareMode = ({ canShare, coarsePointer }) => canShare && coarsePointer ? "share" : "copy";

/**
 * A list page that led to this video, if it belongs to this site.
 * @param {string} referrer
 * @param {string} here
 * @returns {{ href: string, kind: "results" | "tag" | "home" } | null}
 */
export const backTarget = (referrer, here) => {
    if (!referrer) {
        return null;
    }

    try {
        const current = new URL(here);
        const previous = new URL(referrer);
        const videoPath = current.pathname.match(/^(.*\/)videos\/[^/]+\/$/);

        if (!videoPath || previous.origin !== current.origin) {
            return null;
        }

        const root = videoPath[1];
        const isHome = previous.pathname === root;
        const isTag = previous.pathname.startsWith(root)
            && /^tags\/[^/]+\/$/.test(previous.pathname.slice(root.length));

        if (!isHome && !isTag) {
            return null;
        }

        const kind = readListParams(previous.search).query !== "" ? "results" : isTag ? "tag" : "home";
        return { href: referrer, kind };
    } catch {
        return null;
    }
};

/**
 * The height in an Instagram player's MEASURE message, or null. The message
 * is a JSON string like {"details":{"height":583},"type":"MEASURE"}.
 * @param {unknown} data
 * @returns {number | null}
 */
export const measuredHeight = (data) => {
    let message = data;

    if (typeof message === "string") {
        try {
            message = JSON.parse(message);
        } catch {
            return null;
        }
    }

    const height = Number(message?.details?.height);
    return message?.type === "MEASURE" && Number.isFinite(height) && height > 100 && height < 5000 ? Math.ceil(height) : null;
};
