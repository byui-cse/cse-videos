import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { html, linkify, smartQuotes } from "../lib/html.js";

describe("linkify", () => {
    it("links named https credits and bare URLs together", () => {
        assert.equal(String(linkify("[Author](https://example.com/A_(B)) and https://example.org/.")),
            '<a href="https://example.com/A_(B)">Author</a> and <a href="https://example.org/">https://example.org/</a>.');
    });

    it("escapes labels, targets, and surrounding text", () => {
        assert.equal(String(linkify('<script> [A & B](https://example.com/?a=1&b=2)')),
            '&lt;script&gt; <a href="https://example.com/?a=1&amp;b=2">A &amp; B</a>');
    });

    it("leaves non-https and malformed bracket links as escaped text", () => {
        for (const text of ["[x](http://example.com)", "[x](javascript:alert(1))",
            "[x](https://example.com", "[x](https://)", '[x](https://example.com/"onclick)']) {
            assert.equal(String(linkify(text)), String(html`${text}`));
        }
    });

    it("preserves balanced URL parentheses and trims sentence punctuation", () => {
        assert.equal(String(linkify("(https://example.com/A_(B)).")),
            '(<a href="https://example.com/A_(B)">https://example.com/A_(B)</a>).');
    });
});

describe("smartQuotes", () => {
    it("converts quotations and contractions", () => {
        assert.equal(smartQuotes('Don\'t say "it\'s not my job".'), "Don’t say “it’s not my job”.");
        assert.equal(smartQuotes("'A quote' and students' work"), "‘A quote’ and students’ work");
    });

    it("leaves URLs and bracket targets untouched", () => {
        assert.equal(smartQuotes('[Bob\'s "photo"](https://example.com/Bob\'s_(photo))'),
            '[Bob’s “photo”](https://example.com/Bob\'s_(photo))');
        assert.equal(smartQuotes("https://example.com/Bob's-photo"), "https://example.com/Bob's-photo");
        assert.equal(smartQuotes('"https://example.com/photo"'), "“https://example.com/photo”");
    });

    it("still escapes markup after typography is applied", () => {
        assert.equal(String(html`${smartQuotes('<b>"hello" & goodbye</b>')}`),
            "&lt;b&gt;“hello” &amp; goodbye&lt;/b&gt;");
    });
});
