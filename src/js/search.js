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
 * A short form of a typed word, when removing its ending leaves enough letters.
 * @param {string} term
 * @returns {string}
 */
const stem = (term) => {
    if (/[+#]/.test(term)) {
        return "";
    }

    const ending = term.match(/(?:ing|ed|es|s)$/)?.[0];
    const shorter = term.endsWith("ies") ? `${term.slice(0, -3)}y` : ending ? term.slice(0, -ending.length) : "";
    return shorter.length >= 3 ? shorter : "";
};

/**
 * True when every word typed, or its light stem, starts some word in the video.
 * An empty search matches everything.
 * @param {string[]} videoWords
 * @param {string} query
 * @returns {boolean}
 */
export const matches = (videoWords, query) =>
    words(query).every((term) => {
        const shorter = stem(term);
        return videoWords.some((word) => word.startsWith(term) || (shorter && word.startsWith(shorter)));
    });
