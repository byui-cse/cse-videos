/**
 * Search matching, shared by the build and the browser. The build writes the
 * words of each video into the page; the browser matches what someone types
 * against them.
 */

/**
 * Lowercase, with accents removed, so "Résumé" matches "resume".
 * @param {string} text
 * @returns {string}
 */
export const normalize = (text) => String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The distinct words in a piece of text, split the same way for a video and
 * for a search:
 * - apostrophes are dropped, so "don't" and "dont" are the same word;
 * - + and # stay inside a word, so "c++" and "c#" don't shrink to "c";
 * - a leading # goes, so "#portfolio" is "portfolio";
 * - anything else that isn't a letter or digit separates words, so
 *   "job-search" is "job" and "search".
 * @param {string} text
 * @returns {string[]}
 */
export const words = (text) => [...new Set(normalize(text)
    .replace(/['‘’ʼ]/g, "")
    .split(/[^\p{L}\p{N}+#]+/u)
    .map((word) => word.replace(/^#+/, ""))
    .filter(Boolean))];

/**
 * Short forms of a typed word, with at least three letters each.
 * @param {string} term
 * @returns {string[]}
 */
const stems = (term) => {
    if (/[+#]/.test(term)) {
        return [];
    }

    let candidates = [];

    if (term.endsWith("ies")) {
        candidates = [`${term.slice(0, -3)}y`];
    } else if (/(?:ss|x|z|ch|sh)es$/.test(term)) {
        candidates = [term.slice(0, -2)];
    } else if (term.endsWith("s") && !term.endsWith("ss")) {
        candidates = [term.slice(0, -1)];
    } else if (/(?:ing|ed)$/.test(term)) {
        const base = term.replace(/(?:ing|ed)$/, "");
        candidates = [base];

        if (/([bdgmnprt])\1$/.test(base)) {
            candidates.push(base.slice(0, -1));
        }

        if (/[bcdfghjklmnpqrstvwxyz]$/.test(base)) {
            candidates.push(`${base}e`);
        }
    }

    return candidates.filter((candidate) => candidate.length >= 3);
};

/**
 * True when every word typed, or one of its light stems, starts some word in the video.
 * An empty search matches everything.
 * @param {string[]} videoWords
 * @param {string} query
 * @returns {boolean}
 */
export const matches = (videoWords, query) =>
    words(query).every((term) => {
        const candidates = [term, ...stems(term)];
        return videoWords.some((word) => candidates.some((candidate) => word.startsWith(candidate)));
    });
