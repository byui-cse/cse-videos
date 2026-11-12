import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { videoPage } from "../lib/render.js";
import { addressParts } from "../lib/pages/video.js";
import { withoutUnusableSource } from "../src/js/player.js";

const reel = (overrides = {}) => ({
    id: "a-reel",
    title: "Try real-world problems",
    description: "Students take on a problem from a real company.",
    instagram: "https://www.instagram.com/reel/REEL/",
    length: "0:22",
    datePosted: "2026-07-09",
    tags: ["student-projects", "job-search"],
    ...overrides
});
const siteOf = (videos, siteUrl = "https://byui-cse.github.io/cse-videos/") => ({
    videos,
    tags: [],
    names: { "student-projects": "Student projects", "job-search": "Job search", quest: "Quest" },
    covers: new Map(videos.map((video) => [video.id, { width: 480, height: 750 }])),
    siteUrl
});
const band = (page) => page.slice(page.indexOf('<section class="player-band"'), page.indexOf("</section>", page.indexOf('<section class="player-band"')));

describe("video page band", () => {
    it("puts the back link, title and Copy link before the player, and the record after it", () => {
        const video = reel();
        const part = band(videoPage(siteOf([video]), video));
        const at = (text) => {
            const index = part.indexOf(text);
            assert.ok(index >= 0, text);
            return index;
        };

        assert.ok(at("data-back") < at('<h1 class="player-band__title"'));
        assert.ok(at('<h1 class="player-band__title"') < at("data-copy-link"));
        assert.ok(at("data-copy-link") < at("data-player"));
        assert.ok(at("data-player") < at('<div class="record">'));
        assert.ok(at('<div class="record">') < at("record__caption"));
        assert.ok(at("record__caption") < at('<dl class="docket">'));
    });

    it("holds the whole record, so no band below it repeats a caption", () => {
        const video = reel();
        const page = videoPage(siteOf([video]), video);

        assert.match(band(page), /<h2 class="visually-hidden" id="record-title">About this video<\/h2>/);
        assert.match(band(page), /<p>Students take on a problem from a real company\.<\/p>/);
        assert.ok(!page.includes("Caption as posted"));
        assert.equal(page.match(/class="record"/g).length, 1);
    });

    it("says the date and length once, and leaves the player line to say where it plays", () => {
        const video = reel();
        const part = band(videoPage(siteOf([video]), video));

        assert.equal(part.match(/datetime="2026-07-09"/g).length, 1);
        assert.equal(part.match(/datetime="PT22S"/g).length, 1);
        assert.match(part, /<p class="player-band__facts"><span>Posted <time datetime="2026-07-09">July 9, 2026<\/time><\/span> <span><span aria-hidden="true">· <\/span><time datetime="PT22S">/);
        assert.ok(!part.includes("<dt>Posted</dt>"));
        assert.ok(!part.includes("<dt>Length</dt>"));
        assert.ok(!part.includes("Plays on"));
        assert.match(part, /<p class="player__only" data-only-on>Only on Instagram<\/p>/);
    });

    it("keeps one Copy link on the page, beside the title", () => {
        const video = reel();
        const page = videoPage(siteOf([video]), video);
        const own = band(page);

        assert.equal(own.match(/data-copy-link/g).length, 1);
        assert.ok(!own.includes("data-copy="));
    });

    it("keeps a hyphenated word in the title on one line", () => {
        const video = reel();
        assert.match(videoPage(siteOf([video]), video), /id="page-title">Try <span>real-world<\/span> problems<\/h1>/);

        const plain = reel({ title: "Meet Brother Crosby" });
        assert.match(videoPage(siteOf([plain]), plain), /id="page-title">Meet Brother Crosby<\/h1>/);
    });

    it("draws the poster at the screen's width on a phone, where the player runs edge to edge", () => {
        const video = reel();
        const page = videoPage(siteOf([video]), video);
        assert.match(page, /<source type="image\/avif" srcset="[^"]+" sizes="\(max-width: 699px\) 100vw, \(max-width: 1099px\) 328px, 400px">/);
    });

    it("puts the series steps in the record, after the caption", () => {
        const part = (number) => ({
            ...reel(),
            id: `quest-part-${number}`,
            title: `Quest, Part ${number}: Step ${number}`,
            description: `Step ${number} of the quest, in a sentence.`,
            series: "quest",
            part: number,
            tags: ["quest"]
        });
        const videos = [part(1), part(2), part(3)];
        const page = band(videoPage(siteOf(videos), videos[1]));

        assert.ok(page.indexOf("record__caption") < page.indexOf('<nav class="steps"'));
        assert.ok(page.indexOf('<nav class="steps"') < page.indexOf('<dl class="docket">'));
        assert.match(page, /<p class="player-band__series"><a href="\.\.\/\.\.\/tags\/quest\/">Quest<\/a>, part 2 of 3<\/p>/);
        assert.ok(!page.includes("<dt>Series</dt>"));
    });
});

describe("the address to send", () => {
    it("breaks into the site, then one piece per folder", () => {
        assert.deepEqual(addressParts("https://byui-cse.github.io/cse-videos/videos/not-my-job/"),
            ["https://byui-cse.github.io/", "cse-videos/", "videos/", "not-my-job/"]);
        assert.deepEqual(addressParts("http://localhost:5190/videos/a/"), ["http://localhost:5190/", "videos/", "a/"]);
        assert.deepEqual(addressParts("videos/a/"), ["videos/", "a/"]);
    });

    it("rejoins to the address exactly", () => {
        for (const address of ["https://byui-cse.github.io/cse-videos/videos/informational-interviews-what-to-avoid/", "videos/x/", "https://example.com/"]) {
            assert.equal(addressParts(address).join(""), address);
        }
    });

    it("is written in the docket as those pieces", () => {
        const video = reel({ id: "not-my-job" });
        assert.match(videoPage(siteOf([video]), video), /<span class="docket__link" data-page-url><span>https:\/\/byui-cse\.github\.io\/<\/span><span>cse-videos\/<\/span><span>videos\/<\/span><span>not-my-job\/<\/span><\/span>/);
    });
});

describe("an unusable ?source=", () => {
    const page = "https://byui-cse.github.io/cse-videos/videos/a/";

    it("is taken out when the video doesn't have that player, or the value is unknown", () => {
        assert.equal(withoutUnusableSource(`${page}?source=youtube`, ["instagram"]), page);
        assert.equal(withoutUnusableSource(`${page}?source=bogus`, ["youtube", "instagram"]), page);
        assert.equal(withoutUnusableSource(`${page}?source=`, ["youtube", "instagram"]), page);
    });

    it("is taken out on a video with one player, where it can change nothing", () => {
        assert.equal(withoutUnusableSource(`${page}?source=instagram`, ["instagram"]), page);
    });

    it("stays when it picks one of the video's two players", () => {
        assert.equal(withoutUnusableSource(`${page}?source=youtube`, ["youtube", "instagram"]), null);
        assert.equal(withoutUnusableSource(`${page}?source=instagram`, ["youtube", "instagram"]), null);
    });

    it("leaves a clean address alone and keeps everything else", () => {
        assert.equal(withoutUnusableSource(page, ["instagram"]), null);
        assert.equal(withoutUnusableSource(`${page}?source=youtube&q=x#main`, ["instagram"]), `${page}?q=x#main`);
    });
});
