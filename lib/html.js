/**
 * A small HTML template tag for building pages. Every value placed into a
 * template is escaped unless it is already HTML made by this tag, so text
 * from data/videos.json can never add markup to a page.
 */
const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
};

/**
 * @param {unknown} value
 * @returns {string}
 */
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);

class SafeHtml {
    /** @param {string} value */
    constructor(value) {
        this.value = value;
    }

    toString() {
        return this.value;
    }
}

/**
 * Marks a string as finished HTML. Only for markup this code writes itself.
 * @param {string} value
 */
export const raw = (value) => new SafeHtml(String(value));

/**
 * null, undefined and false render as nothing, so templates can use
 * `condition && html\`...\``. Lists render one after another.
 * @param {unknown} value
 * @returns {string}
 */
const render = (value) => {
    if (value === null || value === undefined || value === false) {
        return "";
    }

    if (value instanceof SafeHtml) {
        return value.value;
    }

    if (Array.isArray(value)) {
        return value.map(render).join("");
    }

    return escapeHtml(value);
};

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml}
 */
export const html = (strings, ...values) => {
    let out = strings[0];

    values.forEach((value, index) => {
        out += render(value) + strings[index + 1];
    });

    return new SafeHtml(out);
};

// Only http and https addresses become links. Trailing punctuation and an
// unmatched closing bracket stay outside the link, as in
// "(https://example.com/)." while "https://en.wikipedia.org/wiki/A_(b)" keeps its own.
const URL_PATTERN = /https?:\/\/[^\s<>"'[\]]+/g;

/**
 * Trims what a sentence put after an address.
 * @param {string} url
 */
const trimUrl = (url) => {
    let out = url;

    for (;;) {
        const trimmed = out.replace(/[.,;:!?]+$/, "");
        const opens = trimmed.split("(").length - 1;
        const closes = trimmed.split(")").length - 1;
        const next = trimmed.endsWith(")") && closes > opens ? trimmed.slice(0, -1) : trimmed;

        if (next === out) {
            return out;
        }

        out = next;
    }
};

/**
 * Text with its web addresses turned into links, and everything else escaped.
 * Credits need this: Creative Commons licenses ask for a link to the license.
 * @param {string} text
 * @returns {SafeHtml}
 */
export const linkify = (text) => {
    const parts = [];
    let last = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
        const url = trimUrl(match[0]);
        parts.push(text.slice(last, match.index), html`<a href="${url}">${url}</a>`);
        last = match.index + url.length;
    }

    parts.push(text.slice(last));
    return html`${parts}`;
};
