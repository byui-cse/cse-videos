import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { COVER_FORMATS, coverSources, derivativePath, derivativeWidths, writeCoverDerivatives } from "../lib/images.js";
import { clock, formatDate, lengthSeconds, libraryLine, listFacts, oneADay, partTitle, runningTime } from "../lib/site.js";
import { seededRandom, topicStills, wallOrder } from "../lib/wall.js";

const SRC = new URL("../src/", import.meta.url).pathname;

describe("running times", () => {
    it("reads and writes clock times", () => {
        assert.equal(lengthSeconds("1:05"), 65);
        assert.equal(lengthSeconds("1:02:05"), 3725);
        assert.equal(clock(171), "2:51");
        assert.equal(clock(9), "0:09");
        assert.equal(clock(3725), "1:02:05");
    });

    it("adds up a list, or gives none when a length is missing", () => {
        assert.equal(runningTime([{ length: "0:30" }, { length: "0:29" }]), 59);
        assert.equal(runningTime([]), 0);
        assert.equal(runningTime([{ length: "0:30" }, {}]), null);
    });

    it("says a list's size and running time in words and short", () => {
        const parts = [{ length: "0:30" }, { length: "0:29" }, { length: "0:33" }, { length: "0:30" }, { length: "0:49" }];
        assert.deepEqual(listFacts(parts, "part"), { long: "5 parts, 2 minutes 51 seconds", short: "5 parts · 2:51", count: "5 parts", time: "2:51" });
        assert.deepEqual(listFacts([{ length: "0:30" }, {}]), { long: "2 videos", short: "2 videos", count: "2 videos", time: null });
        assert.deepEqual(listFacts([{ length: "1:00" }]), { long: "1 video, 1 minute", short: "1 video · 1:00", count: "1 video", time: "1:00" });
    });

    it("sums the whole library to the minute", () => {
        const videos = Array.from({ length: 36 }, () => ({ length: "0:42" }));
        assert.equal(libraryLine(videos), "36 videos, 25 minutes in all");
        assert.equal(libraryLine([{ length: "0:20" }, { length: "0:15" }]), "2 videos, 35 seconds in all");
        assert.equal(libraryLine([{ length: "0:20" }, {}]), "2 videos");
        assert.equal(libraryLine([]), "0 videos");
    });
});

describe("series wording", () => {
    it("writes dates with their weekday", () => {
        assert.equal(formatDate("2026-10-19", "full"), "Monday, October 19, 2026");
        assert.equal(formatDate("2026-10-21", "weekday"), "Wednesday, Oct 21, 2026");
    });

    it("knows when parts went up one a day", () => {
        const day = (date) => ({ datePosted: date });
        assert.equal(oneADay([day("2026-10-19"), day("2026-10-20"), day("2026-10-21")]), true);
        assert.equal(oneADay([day("2026-10-31"), day("2026-11-01")]), true);
        assert.equal(oneADay([day("2026-10-19"), day("2026-10-21")]), false);
        assert.equal(oneADay([day("2026-10-19")]), false);
    });

    it("drops the series and part from a part's title, and nothing else", () => {
        assert.equal(partTitle("Career Quest, Part 1: Every job hunt needs three things", "Career Quest"), "Every job hunt needs three things");
        assert.equal(partTitle("Career Quest Part 12: The end", "Career Quest"), "The end");
        assert.equal(partTitle("Career Quest, Part 2", "Career Quest"), "Career Quest, Part 2");
        assert.equal(partTitle("A (b) quest, Part 1: Go", "A (b) quest"), "Go");
        assert.equal(partTitle("Other, Part 1: Go", "Career Quest"), "Other, Part 1: Go");
    });
});

describe("the wall", () => {
    it("draws the same numbers from the same seed", () => {
        const a = seededRandom(14473);
        const b = seededRandom(14473);
        const first = [a(), a(), a()];
        assert.deepEqual(first, [b(), b(), b()]);
        assert.ok(first.every((value) => value >= 0 && value < 1));
        assert.notDeepEqual(first, [seededRandom(1)(), seededRandom(1)(), seededRandom(1)()]);
    });

    it("shuffles every video into the wall exactly once, the same way each build", () => {
        const videos = Array.from({ length: 36 }, (_, index) => ({ id: `v${index}` }));
        const order = wallOrder(videos);
        assert.deepEqual([...order].sort((a, b) => a.id.localeCompare(b.id)), [...videos].sort((a, b) => a.id.localeCompare(b.id)));
        assert.notDeepEqual(order, videos);
        assert.deepEqual(wallOrder(videos), order);
        assert.deepEqual(wallOrder([]), []);
    });

    it("gives each topic card its own still where it can, scarce topics first", () => {
        const videos = [
            { id: "new", tags: ["jobs", "rare"] },
            { id: "mid", tags: ["jobs"] },
            { id: "old", tags: ["jobs", "other"] }
        ];
        const tags = [
            { slug: "jobs", name: "Jobs", count: 3 },
            { slug: "rare", name: "Rare", count: 1 },
            { slug: "other", name: "Other", count: 1 }
        ];
        const stills = topicStills(tags, videos, new Set(["jobs"]));
        assert.deepEqual(stills.get("other").map((video) => video.id), ["old"]);
        assert.deepEqual(stills.get("rare").map((video) => video.id), ["new"]);
        assert.deepEqual(stills.get("jobs").map((video) => video.id), ["mid", "new"]);
    });
});

describe("cover copies", () => {
    it("never makes a copy wider than its source", () => {
        assert.deepEqual(derivativeWidths(480), [240, 360, 480]);
        assert.deepEqual(derivativeWidths(600), [240, 360, 480]);
        assert.deepEqual(derivativeWidths(300), [240, 300]);
        assert.deepEqual(derivativeWidths(200), [200]);
    });

    it("lists AVIF then WebP, smallest first, from the page's root", () => {
        assert.deepEqual(coverSources("a-reel", { width: 480 }, "../../"), [
            { type: "image/avif", srcset: "../../covers/a-reel-240.avif 240w, ../../covers/a-reel-360.avif 360w, ../../covers/a-reel-480.avif 480w" },
            { type: "image/webp", srcset: "../../covers/a-reel-240.webp 240w, ../../covers/a-reel-360.webp 360w, ../../covers/a-reel-480.webp 480w" }
        ]);
        assert.equal(derivativePath("x", 240, "webp"), "covers/x-240.webp");
    });

    it("writes every copy at its width and reuses the cache on the next build", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cse-covers-"));

        try {
            const covers = new Map([["career-quest-part-1", { width: 480, height: 750 }]]);
            const cacheDir = path.join(dir, "cache");
            const outDir = path.join(dir, "out");
            assert.equal(await writeCoverDerivatives({ covers, srcDir: SRC, outDir, cacheDir }), 6);

            const { default: sharp } = await import("sharp");
            for (const width of [240, 360, 480]) {
                for (const extension of ["avif", "webp"]) {
                    const meta = await sharp(path.join(outDir, derivativePath("career-quest-part-1", width, extension))).metadata();
                    assert.equal(meta.width, width, `${width} ${extension}`);
                    assert.equal(meta.height, Math.round(width * 750 / 480), `${width} ${extension}`);
                    assert.equal(meta.format, extension === "avif" ? "heif" : "webp");
                }
            }

            const cached = await fs.readdir(cacheDir);
            assert.equal(cached.length, 6);
            const again = path.join(dir, "again");
            await writeCoverDerivatives({ covers, srcDir: SRC, outDir: again, cacheDir });
            assert.deepEqual((await fs.readdir(cacheDir)).sort(), cached.sort());
            assert.equal((await fs.readdir(path.join(again, "covers"))).length, 6);

            // New encoder settings make new copies instead of reusing the old ones.
            const sharper = COVER_FORMATS.map((format) => ({ ...format, options: { ...format.options, quality: format.options.quality + 10 } }));
            await writeCoverDerivatives({ covers, srcDir: SRC, outDir: path.join(dir, "sharper"), cacheDir, formats: sharper });
            assert.equal((await fs.readdir(cacheDir)).length, 12);
            const effort = COVER_FORMATS.map((format) => ({ ...format, options: { ...format.options, effort: 2 } }));
            await writeCoverDerivatives({ covers, srcDir: SRC, outDir: path.join(dir, "effort"), cacheDir, formats: effort });
            assert.equal((await fs.readdir(cacheDir)).length, 18);
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});
