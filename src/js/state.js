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
 * isn't a known order falls back to the page's default.
 * @param {string} search like "?q=portfolio&sort=oldest"
 * @param {"newest" | "oldest"} [defaultOrder]
 * @returns {{ query: string, order: "newest" | "oldest" }}
 */
export const readListParams = (search, defaultOrder = "newest") => {
    const params = new URLSearchParams(search);
    const order = params.get("sort");

    return {
        query: (params.get("q") ?? "").trim(),
        order: ORDERS.includes(order ?? "") ? /** @type {"newest" | "oldest"} */ (order) : defaultOrder
    };
};

/**
 * The address for a search and order. Defaults are left out, so the plain
 * list keeps a plain address.
 * @param {string} href
 * @param {string} query
 * @param {"newest" | "oldest"} order
 * @param {"newest" | "oldest"} [defaultOrder]
 */
export const listUrl = (href, query, order, defaultOrder = "newest") => {
    const url = new URL(href);

    if (query === "") {
        url.searchParams.delete("q");
    } else {
        url.searchParams.set("q", query);
    }

    if (order === defaultOrder) {
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
 * True for "youtube" or "instagram".
 * @param {unknown} value
 * @returns {value is "youtube" | "instagram"}
 */
export const isSource = (value) => typeof value === "string" && SOURCES.includes(value);

/**
 * The player a video page opens on. A ?source= request this video has wins,
 * so a shared link plays what its sender saw; then the viewer's saved
 * preference, if this video has it; then the page's default. Never a source
 * the video lacks.
 * @param {{ requested: string | null, preferred: string | null, available: string[], fallback: string }} options
 * @returns {string | null}
 */
export const chooseSource = ({ requested, preferred, available, fallback }) => {
    const usable = available.filter(isSource);
    return [requested, preferred, fallback].find((source) => isSource(source) && usable.includes(source)) ?? usable[0] ?? null;
};

/**
 * The one player a video has when the viewer prefers the other, so the page
 * can say why the preference wasn't used. Null otherwise.
 * @param {{ preferred: string | null, available: string[] }} options
 * @returns {string | null}
 */
export const onlySource = ({ preferred, available }) => {
    const usable = available.filter(isSource);
    return usable.length === 1 && isSource(preferred) && usable[0] !== preferred ? usable[0] : null;
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
 * The visible state of a player after its current frame has been shown.
 * @param {{ source: string, elapsedMs: number, sawInstagramMessage: boolean }} options
 * @returns {"loading" | "ready" | "slow"}
 */
export const playerState = ({ source, elapsedMs, sawInstagramMessage }) => {
    if (source === "youtube" || sawInstagramMessage) {
        return "ready";
    }

    return source === "instagram" && elapsedMs >= 10000 ? "slow" : "loading";
};

/**
 * Phones with a share sheet use it; other devices copy the link.
 * @param {{ canShare: boolean, coarsePointer: boolean }} options
 * @returns {"share" | "copy"}
 */
export const shareMode = ({ canShare, coarsePointer }) => canShare && coarsePointer ? "share" : "copy";

/**
 * True for a plain click with the main button. With Cmd, Ctrl, Shift or Alt
 * held the browser opens a new tab or window or downloads the link, so a page
 * should leave the click alone; the same goes for one another handler took.
 * @param {{ button: number, metaKey: boolean, ctrlKey: boolean, shiftKey: boolean, altKey: boolean, defaultPrevented: boolean }} click
 */
export const isPlainClick = (click) => click.button === 0
    && !click.metaKey && !click.ctrlKey && !click.shiftKey && !click.altKey
    && !click.defaultPrevented;

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
