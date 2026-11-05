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

/**
 * Trims what a sentence put after an address.
 * @param {string} url
 */
const trimUrl = (url) => {
    let out = url;

    for (;;) {
        const trimmed = out.replace(/[.,;:!?']+$/, "");
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

    for (const token of textLinks(text)) {
        parts.push(text.slice(last, token.start));
        parts.push(token.valid ? html`<a href="${token.url}">${token.label}</a>` : token.text);
        last = token.end;
    }

    parts.push(text.slice(last));
    return html`${parts}`;
};

// Two kinds of link are found in text. A bare http or https address links to
// itself; trailing punctuation and an unmatched closing bracket stay outside
// it, so "(https://example.com/)." links the address alone while
// "https://en.wikipedia.org/wiki/A_(b)" keeps its own brackets. A bracket link,
// [text](https://url), shows the text; it must be https, or it stays plain text.
const LINK_START = /\[[^[\]\n]*\]\(|https?:\/\/[^\s<>"“”‘’[\]]+/g;

/**
 * True for an https address that is safe to put in a link.
 * @param {string} url
 */
const isHttpsUrl = (url) => {
    if (!/^https:\/\//.test(url) || /[\s<>"]/.test(url)) {
        return false;
    }

    try {
        return new URL(url).protocol === "https:";
    } catch {
        return false;
    }
};

/**
 * The end of a bracket link's address: the index just past its closing
 * bracket, counting brackets inside the address. Stops at a line break.
 * @param {string} text
 * @param {number} from the index after "]("
 * @returns {{ end: number, closed: boolean }}
 */
const linkTargetEnd = (text, from) => {
    let depth = 1;
    let end = from;

    while (end < text.length && depth > 0 && text[end] !== "\n") {
        if (text[end] === "(") {
            depth++;
        } else if (text[end] === ")") {
            depth--;
        }

        end++;
    }

    return { end, closed: depth === 0 };
};

/**
 * Every link in a piece of text, in order: where it starts and ends, the text
 * it shows, its address, and whether it is safe to make into a link.
 * @param {string} text
 * @returns {{ start: number, end: number, label: string, url: string, valid: boolean, bracket: boolean, text: string }[]}
 */
export const textLinks = (text) => {
    const tokens = [];
    const pattern = new RegExp(LINK_START);
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const start = match.index;

        if (match[0].startsWith("[")) {
            const label = match[0].slice(1, -2);
            const { end, closed } = linkTargetEnd(text, pattern.lastIndex);
            const url = text.slice(pattern.lastIndex, closed ? end - 1 : end);
            const valid = closed && label.trim() !== "" && isHttpsUrl(url);

            tokens.push({ start, end, label, url, valid, bracket: true, text: text.slice(start, end) });
            pattern.lastIndex = end;
        } else {
            const url = trimUrl(match[0]);
            const end = start + url.length;

            tokens.push({ start, end, label: url, url, valid: true, bracket: false, text: url });
            pattern.lastIndex = end;
        }
    }

    return tokens;
};

/**
 * Curly quotes and apostrophes for one stretch of prose. The character
 * before the stretch decides whether a quote at its start opens or closes.
 * @param {string} value
 * @param {string} previous
 */
const curl = (value, previous) => (previous + value)
    .replace(/([\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, "$1’")
    .replace(/(^|[\s([{>])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{>])'/g, "$1‘")
    .replace(/'/g, "’")
    .slice(previous.length);

/**
 * Text with straight quotes made curly ("it's" to "it’s"), leaving web
 * addresses and the address half of [text](url) links exactly as they are.
 * @param {string} text
 * @returns {string}
 */
export const smartQuotes = (text) => {
    let out = "";
    let last = 0;

    for (const token of textLinks(text)) {
        out += curl(text.slice(last, token.start), text[last - 1] ?? "");
        out += token.bracket ? token.text.replace(token.label, curl(token.label, "")) : token.text;
        last = token.end;
    }

    return out + curl(text.slice(last), text[last - 1] ?? "");
};
