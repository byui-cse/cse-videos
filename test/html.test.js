import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { html, linkify, plainText, smartQuotes } from "../lib/html.js";

describe("linkify", () => {
    it("links named https credits and bare URLs together", () => {
        assert.equal(String(linkify("[Author](https://example.com/A_(B)) and https://example.org/.")),
            '<a href="https://example.com/A_(B)">Author</a> and <a href="https://example.org/">https://example.org/</a>.');
    });

    it("escapes labels, targets, and surrounding text", () => {
        assert.equal(String(linkify('<script> [A & B](https://example.com/?a=1&b=2)')),
            '&lt;script&gt; <a href="https://example.com/?a=1&amp;b=2">A &amp; B</a>');
    });

    it("never makes a link from a non-https or malformed bracket link", () => {
        assert.equal(String(linkify("[x](javascript:alert(1))")), "[x](javascript:alert(1))");
        assert.equal(String(linkify("[x](https://)")), "[x](https://)");
        assert.equal(String(linkify("[](https://example.com)")),
            '[](<a href="https://example.com">https://example.com</a>)');
    });

    it("still links a bare address inside a broken bracket link", () => {
        assert.equal(String(linkify("[x](http://example.com) more")),
            '[x](<a href="http://example.com">http://example.com</a>) more');
        assert.equal(String(linkify("[x](https://example.com")),
            '[x](<a href="https://example.com">https://example.com</a>');
        assert.equal(String(linkify('[x](https://example.com/"onclick)')),
            '[x](<a href="https://example.com/">https://example.com/</a>&quot;onclick)');
    });

    it("keeps a possessive after a bare address out of the link", () => {
        assert.equal(String(linkify("see https://example.com/page's notes")),
            'see <a href="https://example.com/page">https://example.com/page</a>&#39;s notes');
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

    it("never expands $ patterns in link text", () => {
        assert.equal(smartQuotes("[Ca$$h $& `$` it's](https://example.com/)"), "[Ca$$h $& `$` it’s](https://example.com/)");
        assert.equal(String(linkify(smartQuotes("Music: [Tom $& Jerry](https://example.com/tj)"))),
            'Music: <a href="https://example.com/tj">Tom $&amp; Jerry</a>');
    });

    it("leaves a link label that is itself an address uncurled", () => {
        assert.equal(smartQuotes("[https://example.com/Conway's](https://example.com/Conway's)"),
            "[https://example.com/Conway's](https://example.com/Conway's)");
    });

    it("curls elisions and quotes after dashes, slashes and other quotes", () => {
        assert.equal(smartQuotes("rock 'n' roll"), "rock ’n’ roll");
        assert.equal(smartQuotes("music from the '90s, class of '26"), "music from the ’90s, class of ’26");
        assert.equal(smartQuotes('"\'Hello,\' she said"'), "“‘Hello,’ she said”");
        assert.equal(smartQuotes('a pause—"then this" and/"that"'), "a pause—“then this” and/“that”");
        assert.equal(smartQuotes("it's the students' turn; don't stop"), "it’s the students’ turn; don’t stop");
    });

    it("still escapes markup after typography is applied", () => {
        assert.equal(String(html`${smartQuotes('<b>"hello" & goodbye</b>')}`),
            "&lt;b&gt;“hello” &amp; goodbye&lt;/b&gt;");
    });
});

describe("plainText", () => {
    it("keeps link text and drops the address of valid bracket links", () => {
        assert.equal(plainText("By [Jane](https://example.com/jane) and https://x.org"), "By Jane and https://x.org");
    });

    it("leaves broken bracket links as written", () => {
        assert.equal(plainText("[x](javascript:alert(1)) stays"), "[x](javascript:alert(1)) stays");
        assert.equal(plainText("Sky High [NCS Release]"), "Sky High [NCS Release]");
    });
});
