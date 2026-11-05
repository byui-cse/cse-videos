import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkCovers, instagramCode, isDate, validateVideos, youtubeId } from "../lib/videos.js";

const video = (overrides = {}) => ({
    id: "career-quest-part-1",
    title: "Career Quest, Part 1",
    youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    datePosted: "2026-10-28",
    tags: ["career-quest", "job-search"],
    ...overrides
});

describe("youtubeId", () => {
    it("reads the ID from every common link shape", () => {
        const links = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc123",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ"
        ];

        for (const link of links) {
            assert.equal(youtubeId(link), "dQw4w9WgXcQ", link);
        }
    });

    it("rejects links that aren't a single YouTube video", () => {
        const links = [
            "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/@byui-cse",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/playlist?list=PL123",
            "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
            "https://www.instagram.com/reel/DZYXMdzMV0w/",
            "not a link",
            42
        ];

        for (const link of links) {
            assert.equal(youtubeId(link), null, String(link));
        }
    });
});

describe("instagramCode", () => {
    it("reads the code from post and reel links", () => {
        assert.equal(instagramCode("https://www.instagram.com/reel/DZYXMdzMV0w/"), "DZYXMdzMV0w");
        assert.equal(instagramCode("https://instagram.com/p/DZYXMdzMV0w"), "DZYXMdzMV0w");
        assert.equal(instagramCode("https://www.instagram.com/reels/DcjKo-giQjh/"), "DcjKo-giQjh");
        assert.equal(instagramCode("https://www.instagram.com/byui.cse/reel/DZYXMdzMV0w/?igsh=xyz"), "DZYXMdzMV0w");
    });

    it("rejects profiles and other sites", () => {
        assert.equal(instagramCode("https://www.instagram.com/byui.cse/"), null);
        assert.equal(instagramCode("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
        assert.equal(instagramCode("http://www.instagram.com/reel/DZYXMdzMV0w/"), null);
    });
});

describe("isDate", () => {
    it("accepts real dates written as YYYY-MM-DD", () => {
        assert.equal(isDate("2026-10-28"), true);
        assert.equal(isDate("2028-02-29"), true);
    });

    it("rejects impossible dates and other formats", () => {
        for (const value of ["2026-02-30", "2026-13-01", "10/28/2026", "2026-10-28T12:00", "", null]) {
            assert.equal(isDate(value), false, String(value));
        }
    });
});

describe("validateVideos", () => {
    it("accepts an empty list and a complete entry", () => {
        assert.deepEqual(validateVideos([]), []);
        assert.deepEqual(validateVideos([
            video({
                description: "Students try to get hired.",
                instagram: "https://www.instagram.com/reel/DZYXMdzMV0w/",
                length: "1:05",
                attributions: ["Music from the Instagram business library"],
                dateCreated: "2026-10-20",
                stats: { people: 3, projects: 0 }
            })
        ]), []);
    });

    it("accepts a video with only an Instagram link", () => {
        const { youtube, ...rest } = video();
        assert.deepEqual(validateVideos([{ ...rest, instagram: "https://www.instagram.com/reel/DZYXMdzMV0w/" }]), []);
    });

    it("requires the file to be a list", () => {
        assert.deepEqual(validateVideos({ videos: [] }), ["the file must contain a list of videos"]);
    });

    it("names the video and the problem", () => {
        const errors = validateVideos([video({ datePosted: "October 28" })]);
        assert.deepEqual(errors, ['video 1 (career-quest-part-1): "datePosted" must be a date like "2026-10-28"']);
    });

    it("catches missing required fields", () => {
        const errors = validateVideos([{}]);
        assert.equal(errors.length, 5);
        assert.ok(errors.every((error) => error.startsWith("video 1: ")));
    });

    it("catches misspelled fields", () => {
        const errors = validateVideos([video({ titel: "Typo" })]);
        assert.deepEqual(errors, ['video 1 (career-quest-part-1): unknown field "titel"']);
    });

    it("catches duplicate ids", () => {
        const errors = validateVideos([video(), video({ youtube: "https://youtu.be/abcdefghijk" })]);
        assert.deepEqual(errors, ['video 2 (career-quest-part-1): another video already uses the id "career-quest-part-1"']);
    });

    it("checks ids, tags, length, and stats", () => {
        const cases = [
            [{ id: "Career Quest" }, '"id" must be lowercase words joined by hyphens'],
            [{ tags: [] }, '"tags" must list at least one tag'],
            [{ tags: ["Getting Hired"] }, 'tag "Getting Hired" must be lowercase words joined by hyphens'],
            [{ tags: ["career-quest", "career-quest"] }, '"tags" lists the same tag twice'],
            [{ length: "65 seconds" }, '"length" must look like'],
            [{ length: "1:75" }, '"length" must look like'],
            [{ stats: { people: -1 } }, 'stat "people" must be a whole number'],
            [{ stats: { people: 2.5 } }, 'stat "people" must be a whole number'],
            [{ attributions: "Bro. C." }, '"attributions" must be a list of text'],
            [{ youtube: "https://www.youtube.com/@byui-cse" }, '"youtube" must be an https link to a YouTube video'],
            [{ youtube: undefined }, 'needs a "youtube" or "instagram" link']
        ];

        for (const [overrides, expected] of cases) {
            const errors = validateVideos([video(overrides)]);
            assert.equal(errors.length, 1, JSON.stringify(overrides));
            assert.ok(errors[0].includes(expected), `${errors[0]} should mention ${expected}`);
        }
    });

    it("accepts hour-long lengths", () => {
        assert.deepEqual(validateVideos([video({ length: "1:02:30" })]), []);
    });

    it("accepts numbered parts in a series", () => {
        assert.deepEqual(validateVideos([
            video({ series: "career-quest", part: 1 }),
            video({ id: "career-quest-part-2", youtube: "https://youtu.be/abcdefghijk", series: "career-quest", part: 2 })
        ]), []);
    });

    it("checks series and part values and requires them together", () => {
        const cases = [
            [{ series: "Career Quest", part: 1 }, '"series" must be lowercase words joined by hyphens'],
            [{ series: "career-quest", part: 0 }, '"part" must be a whole number, 1 or more'],
            [{ series: "career-quest", part: 1.5 }, '"part" must be a whole number, 1 or more'],
            [{ series: "career-quest", part: "1" }, '"part" must be a whole number, 1 or more'],
            [{ part: 1 }, '"part" needs a "series"'],
            [{ series: "career-quest" }, '"series" needs a "part"']
        ];

        for (const [overrides, expected] of cases) {
            assert.deepEqual(validateVideos([video(overrides)]), [
                `video 1 (career-quest-part-1): ${expected}`
            ]);
        }
    });

    it("rejects duplicate part numbers within the same series", () => {
        const errors = validateVideos([
            video({ series: "career-quest", part: 1 }),
            video({ id: "another-part", youtube: "https://youtu.be/abcdefghijk", series: "career-quest", part: 1 })
        ]);

        assert.deepEqual(errors, [
            'video 2 (another-part): another video already uses part 1 in series "career-quest"'
        ]);
        assert.deepEqual(validateVideos([
            video({ series: "career-quest", part: 1 }),
            video({ id: "other-series", youtube: "https://youtu.be/abcdefghijk", tags: ["another-series"], series: "another-series", part: 1 })
        ]), []);
    });

    it("requires the series to be one of the video's tags", () => {
        assert.deepEqual(validateVideos([video({ tags: ["job-search"], series: "career-quest", part: 1 })]), [
            'video 1 (career-quest-part-1): "series" must also be one of the tags, so its tag page lists every part: add "career-quest" to "tags"'
        ]);
    });

    it("rejects a series that skips a part number", () => {
        assert.deepEqual(validateVideos([
            video({ series: "career-quest", part: 1 }),
            video({ id: "career-quest-part-3", youtube: "https://youtu.be/abcdefghijk", series: "career-quest", part: 3 })
        ]), ['series "career-quest" has no part 2; number the parts 1, 2, 3 and so on']);
    });
});


describe("data hygiene", () => {
    it("rejects duplicate video links, including alternate URL forms", () => {
        for (const [field, first, second] of [
            ["youtube", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"],
            ["instagram", "https://instagram.com/reel/abc/", "https://instagram.com/p/abc/?igsh=123"]
        ]) {
            const errors = validateVideos([
                video({ youtube: undefined, [field]: first }),
                video({ id: "second", youtube: undefined, [field]: second })
            ]);
            assert.deepEqual(errors, [`video 2 (second): another video already uses the same ${field} link`]);
        }
    });

    it("suggests only close tags from the real tag list", async () => {
        const names = JSON.parse(await fs.readFile(new URL("../data/tags.json", import.meta.url), "utf8"));
        const suggestion = (tag) => validateVideos([video({ tags: [tag] })], names)[0]?.match(/Did you mean "([^"]+)"/)?.[1] ?? null;

        assert.equal(suggestion("ux"), null);
        assert.equal(suggestion("cs"), null);
        assert.equal(suggestion("ml"), null);
        assert.equal(suggestion("internship"), "internships");
        assert.equal(suggestion("netwroking"), "networking");
        assert.equal(suggestion("ia"), "ai");
        assert.equal(suggestion("resumes"), "resume");
    });

    it("suggests known tags by prefix and edit distance", () => {
        for (const tag of ["internship", "internshps"]) {
            assert.deepEqual(validateVideos([video({ tags: [tag] })], { internships: "Internships" }), [
                `video 1 (career-quest-part-1): tag "${tag}" isn't in data/tags.json. Did you mean "internships"?`
            ]);
        }
        assert.deepEqual(validateVideos([video({ tags: ["zzzz"] })], {}), [
            'video 1 (career-quest-part-1): tag "zzzz" isn\'t in data/tags.json.'
        ]);
    });

    it("rejects malformed credit links and unsafe protocols", () => {
        for (const credit of ["[name](http://example.com)", "[name](javascript:alert(1))",
            "[name](https://example.com", "[name]https://example.com)", "[name](https://)", "[](https://example.com)"]) {
            assert.deepEqual(validateVideos([video({ attributions: [credit] })]), [
                'video 1 (career-quest-part-1): "attributions" links must use [text](https://url), with matching brackets and an https address'
            ]);
        }
        assert.deepEqual(validateVideos([video({ attributions: ["[A & B](https://example.com/A_(B))"] })]), []);

        for (const credit of ["[name] (https://example.com)", "name](https://example.com)", "[name(https://example.com)"]) {
            assert.equal(validateVideos([video({ attributions: [credit] })]).length, 1, credit);
        }
    });

    it("accepts plain square brackets in credits", () => {
        for (const credit of ["Song: Elektronomia - Sky High [NCS Release]", "Music: Some Artist - Song [Remix]",
            "Photo [cropped] by [Jane](https://example.com/jane)"]) {
            assert.deepEqual(validateVideos([video({ attributions: [credit] })]), [], credit);
        }
    });

    it("checks missing, misnamed, malformed, oversized and incorrectly shaped covers", async (t) => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cover-check-"));
        t.after(() => fs.rm(dir, { recursive: true, force: true }));
        const item = video({ id: "sample", youtube: undefined, instagram: "https://instagram.com/reel/abc/" });
        let result = await checkCovers([item], dir);
        assert.deepEqual(result.errors, ["sample has no cover: add src/covers/sample.jpg or a YouTube link"]);
        assert.deepEqual((await checkCovers([video()], dir)).errors, []);
        await fs.mkdir(path.join(dir, "covers"));
        const source = new URL("../src/covers/career-quest-part-1.jpg", import.meta.url);
        for (const extension of ["JPG", "jpeg", "png"]) {
            const near = path.join(dir, "covers", `sample.${extension}`);
            await fs.copyFile(source, near);
            result = await checkCovers([item], dir);
            assert.match(result.errors[0], new RegExp(`found sample\\.${extension}; rename it to sample.jpg`));
            assert.deepEqual(result.warnings, [`No video uses cover sample.${extension}`]);
            await fs.rm(near);
        }
        const file = path.join(dir, "covers", "sample.jpg");
        await fs.copyFile(source, file);
        result = await checkCovers([item], dir);
        assert.deepEqual(result.errors, []);
        assert.deepEqual(result.covers.get("sample"), { width: 480, height: 750 });
        const bytes = await fs.readFile(file);
        await fs.writeFile(file, Buffer.concat([bytes, Buffer.alloc(150 * 1024)]));
        assert.deepEqual((await checkCovers([item], dir)).errors, ["sample.jpg is over 150 KB; save it smaller"]);
        const frame = bytes.findIndex((value, index) => value === 0xff && [0xc0, 0xc2].includes(bytes[index + 1]));
        bytes.writeUInt16BE(750, frame + 7);
        await fs.writeFile(file, bytes);
        assert.deepEqual((await checkCovers([item], dir)).errors, ["sample.jpg is 750x750; covers are 480x750 (the same shape within 2%)"]);
        await fs.writeFile(file, "not a jpeg");
        assert.match((await checkCovers([item], dir)).errors[0], /sample.jpg: .*not a readable JPEG/);
    });
});
