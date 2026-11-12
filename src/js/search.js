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
 * - dots inside acronyms go, so "a.i." is "ai";
 * - anything else that isn't a letter or digit separates words, so
 *   "job-search" is "job" and "search".
 * @param {string} text
 * @returns {string[]}
 */
export const words = (text) => [...new Set(normalize(text)
    .replace(/['‘’ʼ]/g, "")
    .replace(/\b(?:\p{L}\.)+\p{L}\.?(?!\p{L})/gu, (acronym) => acronym.replaceAll(".", ""))
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

const STOP_WORDS = new Set(["video", "videos", "reel", "reels", "the", "a", "an", "of", "for", "and", "to", "on", "in"]);

/**
 * True when every useful query word matches a video word, allowing light
 * stems on either side. Filler words and lone letters are dropped when
 * something else was typed; lone digits stay, so "part 3" finds Part 3.
 * An empty search matches everything.
 * @param {string[]} videoWords
 * @param {string} query
 * @returns {boolean}
 */
export const matches = (videoWords, query) => {
    const typed = words(query);
    const useful = typed.filter((term) => !/^\p{L}$/u.test(term) && !STOP_WORDS.has(term));
    // The video's words and their stems, worked out once for every term.
    const forms = videoWords.flatMap((word) => [word, ...stems(word)]);

    return (useful.length ? useful : typed).every((term) =>
        [term, ...stems(term)].some((candidate) => forms.some((form) => form.startsWith(candidate))));
};
