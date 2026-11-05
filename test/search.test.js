import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { escapeHtml, html, linkify, raw } from "../lib/html.js";
import { searchWords } from "../lib/site.js";
import { matches, normalize, words } from "../src/js/search.js";

describe("html", () => {
    it("escapes every value placed in a template", () => {
        const title = `<script>alert("x")</script> & 'more'`;
        assert.equal(
            String(html`<h1 title="${title}">${title}</h1>`),
            '<h1 title="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;more&#39;">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;more&#39;</h1>'
        );
    });

    it("keeps nested templates and lists as HTML", () => {
        const items = ["a", "<b>"].map((item) => html`<li>${item}</li>`);
        assert.equal(String(html`<ul>${items}</ul>`), "<ul><li>a</li><li>&lt;b&gt;</li></ul>");
    });

    it("renders null, undefined and false as nothing, and raw() as is", () => {
        assert.equal(String(html`[${null}${undefined}${false}${raw("<br>")}${0}]`), "[<br>0]");
    });

    it("escapes the five special characters", () => {
        assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
    });
});

describe("linkify", () => {
    it("links web addresses and leaves brackets and end punctuation outside", () => {
        assert.equal(
            String(linkify("by Pavili255 (https://commons.wikimedia.org/wiki/User:Pavili255), see https://example.com/a.")),
            'by Pavili255 (<a href="https://commons.wikimedia.org/wiki/User:Pavili255">https://commons.wikimedia.org/wiki/User:Pavili255</a>), see <a href="https://example.com/a">https://example.com/a</a>.'
        );
    });

    it("escapes the text around links and never links other schemes", () => {
        assert.equal(String(linkify("<b> javascript:alert(1) & http://x.org/?a=1&b=2")), '&lt;b&gt; javascript:alert(1) &amp; <a href="http://x.org/?a=1&amp;b=2">http://x.org/?a=1&amp;b=2</a>');
        assert.equal(String(linkify("no links here")), "no links here");
    });

    it("keeps parentheses that belong to the address", () => {
        assert.equal(
            String(linkify("see (https://en.wikipedia.org/wiki/Foo_(bar)).")),
            'see (<a href="https://en.wikipedia.org/wiki/Foo_(bar)">https://en.wikipedia.org/wiki/Foo_(bar)</a>).'
        );
    });

    it("can't break out of the href with quotes", () => {
        assert.equal(String(linkify(`https://x.org/"onmouseover="alert(1)`)), '<a href="https://x.org/">https://x.org/</a>&quot;onmouseover=&quot;alert(1)');
    });
});

describe("search", () => {
    it("lowercases and drops accents", () => {
        assert.equal(normalize("Résumé TIPS"), "resume tips");
    });

    it("splits on anything that isn't a letter or digit, without repeats", () => {
        assert.deepEqual(words("Career Quest, Part 1: #job-search career"), ["career", "quest", "part", "1", "job", "search"]);
        assert.deepEqual(words("  "), []);
    });

    const video = words("Career Quest, Part 2: Your portfolio is your sword career-quest job-search portfolio");

    it("matches every word typed against the start of a word", () => {
        assert.equal(matches(video, "portfolio"), true);
        assert.equal(matches(video, "PORT"), true);
        assert.equal(matches(video, "career port"), true);
        assert.equal(matches(video, "folio"), false);
        assert.equal(matches(video, "portfolio interview"), false);
    });

    it("matches common endings against singular video words", () => {
        for (const [query, singular] of [
            ["resumes", "resume"],
            ["jobs", "job"],
            ["careers", "career"],
            ["interviewing", "interview"],
            ["studies", "study"],
            ["portfolios", "portfolio"],
            ["completed", "complete"]
        ]) {
            assert.equal(matches(words(singular), query), true, query);
        }
    });

    it("does not shorten terms below three characters", () => {
        assert.equal(matches(words("air"), "ai"), true);
        assert.equal(matches(words("main"), "ai"), false);
        assert.equal(matches(words("css"), "cs"), true);
        assert.equal(matches(words("course"), "cs"), false);
        assert.equal(matches(words("build"), "bus"), false);
    });

    it("treats tag spellings and hashtags like plain words", () => {
        assert.equal(matches(video, "job-search"), true);
        assert.equal(matches(video, "#portfolio"), true);
    });

    it("matches everything when the search is empty or only punctuation", () => {
        assert.equal(matches(video, ""), true);
        assert.equal(matches(video, "  #  "), true);
    });

    it("ignores accents in what is typed", () => {
        assert.equal(matches(words("resume tips"), "résumé"), true);
    });

    it("matches words with apostrophes whether or not they are typed", () => {
        const title = words("Don't wait until senior year: Maddie's summer");
        assert.deepEqual(title.slice(0, 2), ["dont", "wait"]);

        for (const query of ["dont wait", "don't", "don’t", "maddies", "maddie's", "don"]) {
            assert.equal(matches(title, query), true, query);
        }
    });

    it("keeps C++ and C# as words instead of the letter c", () => {
        const languages = words("Learning C++ and C# with #coding");
        assert.deepEqual(languages, ["learning", "c++", "and", "c#", "with", "coding"]);
        assert.equal(matches(words("Career Quest"), "c++"), false);
        assert.equal(matches(words("Career Quest"), "c#"), false);
        assert.equal(matches(languages, "c++"), true);
        assert.equal(matches(languages, "c"), true);
        assert.equal(matches(words("c++"), "c#"), false);
        assert.equal(matches(words("c#"), "c++"), false);
    });

    it("finds the same videos for job and jobs in the video library", () => {
        const videos = JSON.parse(readFileSync(new URL("../data/videos.json", import.meta.url), "utf8"));
        const indexed = videos.map((video) => searchWords(video).split(" "));
        const count = (query) => indexed.filter((videoWords) => matches(videoWords, query)).length;
        const jobCount = count("job");
        const jobsCount = count("jobs");

        assert.ok(jobCount > 0);
        assert.equal(jobsCount, jobCount);
    });
});
