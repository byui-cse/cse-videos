import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instagramCode, isDate, validateVideos, youtubeId } from "../lib/videos.js";

const video = (overrides = {}) => ({
    id: "career-quest-part-1",
    title: "Career Quest, Part 1",
    youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    datePosted: "2026-10-28",
    tags: ["career-quest", "getting-hired"],
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
        const errors = validateVideos([video(), video()]);
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
            video({ id: "career-quest-part-2", series: "career-quest", part: 2 })
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
            video({ id: "another-part", series: "career-quest", part: 1 })
        ]);

        assert.deepEqual(errors, [
            'video 2 (another-part): another video already uses part 1 in series "career-quest"'
        ]);
        assert.deepEqual(validateVideos([
            video({ series: "career-quest", part: 1 }),
            video({ id: "other-series", series: "another-series", part: 1 })
        ]), []);
    });
});
