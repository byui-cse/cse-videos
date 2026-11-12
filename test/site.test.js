import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readJpegSize } from "../lib/jpeg.js";
import { writeShareImage } from "../lib/images.js";
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
    sameText,
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
        assert.deepEqual(cover(video, { width: 480, height: 750 }, "../../"), { src: "../../covers/a.jpg", width: 480, height: 750 });
        assert.deepEqual(cover(video, false, ""), { src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", width: 480, height: 360 });
        assert.equal(cover({ id: "b" }, false, ""), null);
    });

    it("uses the tall thumbnail for Shorts", () => {
        const short = { id: "c", youtube: "https://www.youtube.com/shorts/dQw4w9WgXcQ" };
        assert.deepEqual(cover(short, false, ""), { src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/oar2.jpg", width: 720, height: 1280 });
    });
});


describe("caption and cover helpers", () => {
    it("compares captions without case, punctuation or spacing", () => {
        assert.equal(sameText("Career Quest - Part 4:", "career quest part 4"), true);
        assert.equal(sameText("Showcase: Micro Mouse", "SHOWCASE micro-mouse!"), true);
        assert.equal(sameText("Part 4", "Part 5"), false);
    });

    it("reads dimensions from an actual cover and rejects non-JPEG files", async () => {
        assert.deepEqual(await readJpegSize(new URL("../src/covers/career-quest-part-1.jpg", import.meta.url)), {
            width: 480, height: 750
        });
        await assert.rejects(readJpegSize(new URL("../data/tags.json", import.meta.url)), /not a readable JPEG/);
    });

    it("indexes caption link text without the address", () => {
        const text = searchWords({ title: "Photo", tags: [], description: "Thanks to [Jane](https://example.com/janesite)" });
        assert.equal(text.includes("jane"), true);
        assert.equal(text.includes("janesite"), false);
        assert.equal(text.includes("https"), false);
    });

    it("indexes credit labels without indexing their addresses", () => {
        const text = searchWords({ title: "Photo", tags: [], attributions: [
            "[Pavili255](https://commons.wikimedia.org/wiki/User:Pavili255), [CC BY-SA 4.0](https://creativecommons.org/)",
            "Music https://example.com/license"
        ] });
        assert.match(text, /pavili255/);
        assert.match(text, /cc by sa/);
        assert.doesNotMatch(text, /https|wiki|example|creativecommons/);
    });
});

describe("sharing image", () => {
    it("composes a repeatable 1200 by 630 JPEG from cover stills", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "share-image-"));
        const srcDir = fileURLToPath(new URL("../src", import.meta.url));
        const covers = new Map([
            ["career-quest-part-2", { width: 480, height: 750 }],
            ["career-quest-part-1", { width: 480, height: 750 }]
        ]);

        try {
            await writeShareImage({ covers, srcDir, outDir: dir });
            const first = await fs.readFile(path.join(dir, "share.jpg"));
            assert.deepEqual(await readJpegSize(path.join(dir, "share.jpg")), { width: 1200, height: 630 });
            await writeShareImage({ covers, srcDir, outDir: dir });
            assert.deepEqual(await fs.readFile(path.join(dir, "share.jpg")), first);
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});

/**
 * A tiny JPEG with just the segments readJpegSize reads: an optional EXIF
 * orientation, a frame header, and the start of the scan.
 */
const jpegBytes = ({ marker = 0xc0, precision = 8, width = 480, height = 750, orientation = null, byteOrder = "MM" } = {}) => {
    const parts = [Buffer.from([0xff, 0xd8])];

    if (orientation !== null) {
        const little = byteOrder === "II";
        const tiff = Buffer.alloc(26);
        tiff.write(byteOrder, 0, "ascii");
        little ? tiff.writeUInt16LE(42, 2) : tiff.writeUInt16BE(42, 2);
        little ? tiff.writeUInt32LE(8, 4) : tiff.writeUInt32BE(8, 4);
        little ? tiff.writeUInt16LE(1, 8) : tiff.writeUInt16BE(1, 8);
        little ? tiff.writeUInt16LE(0x0112, 10) : tiff.writeUInt16BE(0x0112, 10);
        little ? tiff.writeUInt16LE(3, 12) : tiff.writeUInt16BE(3, 12);
        little ? tiff.writeUInt32LE(1, 14) : tiff.writeUInt32BE(1, 14);
        little ? tiff.writeUInt16LE(orientation, 18) : tiff.writeUInt16BE(orientation, 18);
        const body = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
        const head = Buffer.from([0xff, 0xe1, 0, 0]);
        head.writeUInt16BE(body.length + 2, 2);
        parts.push(head, body);
    }

    const frame = Buffer.from([0xff, marker, 0, 17, precision, 0, 0, 0, 0, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    frame.writeUInt16BE(height, 5);
    frame.writeUInt16BE(width, 7);
    parts.push(frame, Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0xff, 0xd9]));
    return Buffer.concat(parts);
};

describe("readJpegSize", () => {
    const sizeOf = async (options) => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jpeg-size-"));
        const file = path.join(dir, "test.jpg");

        try {
            await fs.writeFile(file, jpegBytes(options));
            return await readJpegSize(file);
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    };

    it("reads a baseline frame", async () => {
        assert.deepEqual(await sizeOf({}), { width: 480, height: 750 });
    });

    it("swaps width and height for rotated EXIF orientations, in either byte order", async () => {
        assert.deepEqual(await sizeOf({ width: 750, height: 480, orientation: 6 }), { width: 480, height: 750 });
        assert.deepEqual(await sizeOf({ width: 750, height: 480, orientation: 8, byteOrder: "II" }), { width: 480, height: 750 });
        assert.deepEqual(await sizeOf({ orientation: 1 }), { width: 480, height: 750 });
    });

    it("accepts 8-bit extended frames and rejects other precisions", async () => {
        assert.deepEqual(await sizeOf({ marker: 0xc1 }), { width: 480, height: 750 });
        await assert.rejects(sizeOf({ marker: 0xc1, precision: 12 }), /8-bit/);
    });

    it("ignores malformed EXIF data", async () => {
        assert.deepEqual(await sizeOf({ orientation: 6, byteOrder: "XX" }), { width: 480, height: 750 });
    });
});
