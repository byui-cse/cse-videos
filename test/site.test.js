import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    collectTags,
    cover,
    embedUrls,
    formatDate,
    isoDuration,
    newestFirst,
    paragraphs,
    plural,
    popularTags,
    searchWords,
    spokenLength,
    statName,
    summary,
    tagName,
    youtubeShape
} from "../lib/site.js";

describe("tags", () => {
    it("names a tag from data/tags.json, or spells out its slug", () => {
        assert.equal(tagName("ai", { ai: "AI" }), "AI");
        assert.equal(tagName("job-search"), "Job search");
        assert.equal(tagName("constructor"), "Constructor");
    });

    it("counts each tag and sorts by name", () => {
        const videos = [
            { tags: ["portfolio", "job-search"] },
            { tags: ["ai", "job-search"] },
            { tags: ["job-search"] }
        ];

        assert.deepEqual(collectTags(videos, { ai: "AI" }), [
            { slug: "ai", name: "AI", count: 1 },
            { slug: "job-search", name: "Job search", count: 3 },
            { slug: "portfolio", name: "Portfolio", count: 1 }
        ]);
    });

    it("lists the most used tags first", () => {
        const tags = [
            { slug: "a", name: "A", count: 1 },
            { slug: "b", name: "B", count: 5 },
            { slug: "c", name: "C", count: 5 }
        ];

        assert.deepEqual(popularTags(tags, 2).map((tag) => tag.slug), ["b", "c"]);
    });
});

describe("newestFirst", () => {
    it("sorts by date posted, then date created, then title", () => {
        const videos = [
            { title: "Old", datePosted: "2026-06-01" },
            { title: "B", datePosted: "2026-10-01" },
            { title: "A", datePosted: "2026-10-01" },
            { title: "Made later", datePosted: "2026-10-01", dateCreated: "2026-09-30" },
            { title: "New", datePosted: "2026-10-20" }
        ];

        assert.deepEqual(newestFirst(videos).map((video) => video.title), ["New", "Made later", "A", "B", "Old"]);
    });

    it("doesn't change the list it was given", () => {
        const videos = [{ title: "A", datePosted: "2026-01-01" }, { title: "B", datePosted: "2026-02-01" }];
        newestFirst(videos);
        assert.equal(videos[0].title, "A");
    });
});

describe("dates and lengths", () => {
    it("formats dates without shifting the day", () => {
        assert.equal(formatDate("2026-10-26"), "October 26, 2026");
        assert.equal(formatDate("2026-01-01", "medium"), "Jan 1, 2026");
    });

    it("writes lengths as ISO durations", () => {
        assert.equal(isoDuration("0:45"), "PT45S");
        assert.equal(isoDuration("1:05"), "PT1M5S");
        assert.equal(isoDuration("2:00"), "PT2M");
        assert.equal(isoDuration("1:02:30"), "PT1H2M30S");
        assert.equal(isoDuration("0:00"), "PT0S");
    });

    it("reads lengths out in words", () => {
        assert.equal(spokenLength("0:45"), "45 seconds");
        assert.equal(spokenLength("1:01"), "1 minute 1 second");
        assert.equal(spokenLength("1:00:00"), "1 hour");
    });

    it("counts in words", () => {
        assert.equal(plural(1, "video"), "1 video");
        assert.equal(plural(0, "video"), "0 videos");
    });
});

describe("text", () => {
    it("splits a caption into paragraphs and lines", () => {
        assert.deepEqual(paragraphs("First line\nsecond line\n\n\nNext paragraph\r\n"), [
            ["First line", "second line"],
            ["Next paragraph"]
        ]);
    });

    it("shortens long text at a word", () => {
        assert.equal(summary("Short."), "Short.");
        assert.equal(summary("one two three four five six", 15), "one two...");
    });

    it("turns stat keys into labels", () => {
        assert.equal(statName("newPeople"), "New people");
        assert.equal(statName("projects"), "Projects");
        assert.equal(statName("new-people"), "New people");
    });

    it("collects every searchable word of a video", () => {
        const words = searchWords({
            title: "Your résumé",
            description: "Make it one page.",
            tags: ["job-search", "ai"],
            attributions: ["Music by Someone"]
        }, { ai: "AI" }).split(" ");

        for (const word of ["your", "resume", "page", "job", "search", "ai", "someone"]) {
            assert.ok(words.includes(word), word);
        }
    });
});

describe("players and covers", () => {
    it("knows Shorts are tall", () => {
        assert.equal(youtubeShape("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "tall");
        assert.equal(youtubeShape("https://youtu.be/dQw4w9WgXcQ"), "wide");
    });

    it("builds the embed addresses", () => {
        assert.deepEqual(embedUrls({
            youtube: "https://youtu.be/dQw4w9WgXcQ?si=abc",
            instagram: "https://www.instagram.com/reel/DZYXMdzMV0w/?igsh=1"
        }), {
            youtube: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1",
            instagram: "https://www.instagram.com/p/DZYXMdzMV0w/embed/"
        });
        assert.deepEqual(embedUrls({ instagram: "https://www.instagram.com/p/DZYXMdzMV0w/" }), {
            instagram: "https://www.instagram.com/p/DZYXMdzMV0w/embed/"
        });
    });

    it("prefers a cover file, then the YouTube thumbnail", () => {
        const video = { id: "a", youtube: "https://youtu.be/dQw4w9WgXcQ" };
        assert.deepEqual(cover(video, true, "../../"), { src: "../../covers/a.jpg", width: 540, height: 844 });
        assert.deepEqual(cover(video, false, ""), { src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", width: 480, height: 360 });
        assert.equal(cover({ id: "b" }, false, ""), null);
    });

    it("uses the tall thumbnail for Shorts", () => {
        const short = { id: "c", youtube: "https://www.youtube.com/shorts/dQw4w9WgXcQ" };
        assert.deepEqual(cover(short, false, ""), { src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/oar2.jpg", width: 720, height: 1280 });
    });
});
