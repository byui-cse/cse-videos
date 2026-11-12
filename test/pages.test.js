import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { homePage, notFoundPage, tagPage, tagsPage, videoPage, videoWallPage } from "../lib/render.js";
import { CARD_FRONT, CARD_STILLS, WALL_LEAD, WALL_STILLS } from "../lib/wall.js";
import { build, SRC, siteUrlFrom } from "../scripts/build.js";

const VIDEOS = [
    {
        id: "sample-short",
        title: "Career Quest, Part 1",
        description: "First line\nsecond line\n\nA <b>bold</b> claim & more",
        youtube: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        instagram: "https://www.instagram.com/reel/DZYXMdzMV0w/",
        length: "1:05",
        attributions: ["Music from the Instagram library", "Photo used under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)"],
        datePosted: "2026-10-19",
        tags: ["career-quest", "job-search"],
        stats: { newPeople: 3 }
    },
    {
        id: "older-reel",
        title: "An <older> reel",
        instagram: "https://www.instagram.com/reel/DcjKo-giQjh/",
        datePosted: "2026-08-27",
        tags: ["job-search"]
    },
    {
        id: "lecture",
        title: "A lecture",
        youtube: "https://www.youtube.com/watch?v=abcdefghijk",
        datePosted: "2026-11-01",
        tags: ["ai"]
    }
];

let dir;
let out;
let result;
let srcDir;

const read = (file) => fs.readFile(path.join(out, file), "utf8");
const structuredData = (page) => [...page.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));

before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "cse-videos-"));
    out = path.join(dir, "dist");
    srcDir = path.join(dir, "src");
    await fs.cp(SRC, srcDir, { recursive: true });
    await fs.copyFile(path.join(SRC, "covers", "career-quest-part-1.jpg"), path.join(srcDir, "covers", "older-reel.jpg"));
    await fs.writeFile(path.join(dir, "videos.json"), JSON.stringify(VIDEOS));
    await fs.writeFile(path.join(dir, "tags.json"), JSON.stringify({ ai: "AI", "career-quest": "Career Quest", "job-search": "Job search" }));

    result = await build({
        dataFile: path.join(dir, "videos.json"),
        tagsFile: path.join(dir, "tags.json"),
        srcDir,
        outDir: out,
        siteUrl: "https://byui-cse.github.io/cse-videos"
    });
});

after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
});

describe("build", () => {
    it("writes a page for the home list, the video wall, the tags, every tag, and every video", async () => {
        const files = [
            "index.html",
            "wall/index.html",
            "404.html",
            "tags/index.html",
            "tags/ai/index.html",
            "tags/career-quest/index.html",
            "tags/job-search/index.html",
            "videos/sample-short/index.html",
            "videos/older-reel/index.html",
            "videos/lecture/index.html",
            "css/main.css",
            "js/main.js",
            "js/search.js",
            "js/wall.js",
            "data/videos.json"
        ];

        for (const file of files) {
            await fs.access(path.join(out, file));
        }

        assert.deepEqual(
            { videos: result.videos, tags: result.tags, pages: result.pages },
            { videos: 3, tags: 3, pages: 10 }
        );
    });

    it("refuses to build a reel without a cover", async () => {
        await assert.rejects(build({
            dataFile: path.join(dir, "videos.json"),
            tagsFile: path.join(dir, "tags.json"),
            srcDir: SRC,
            outDir: path.join(dir, "missing-cover")
        }), /older-reel has no cover/);
    });

    it("refuses bad data with every problem listed", async () => {
        await fs.writeFile(path.join(dir, "bad.json"), JSON.stringify([{ id: "x" }]));
        await assert.rejects(
            build({ dataFile: path.join(dir, "bad.json"), tagsFile: path.join(dir, "tags.json"), outDir: path.join(dir, "bad-out") }),
            /data\/videos\.json has 4 problems/
        );
    });

    it("reads SITE_URL with or without the trailing slash", () => {
        assert.equal(siteUrlFrom("https://byui-cse.github.io/cse-videos"), "https://byui-cse.github.io/cse-videos/");
        assert.equal(siteUrlFrom(undefined), null);
        assert.throws(() => siteUrlFrom("byui-cse.github.io"), /SITE_URL/);
        assert.throws(() => siteUrlFrom("ftp://example.com/"), /SITE_URL/);
    });

    it("sizes the Video wall's stage from the number of videos in the stylesheet", async () => {
        const css = await read("css/main.css");
        assert.ok(css.trimEnd().endsWith(".wall-stage{--wall-rows-wide:2;--wall-full-wide:9;--wall-rows-mid:2;--wall-full-mid:14;--wall-rows-narrow:3;--wall-full-narrow:21}"));
    });

    it("writes a sitemap for every public page, without lastmod dates", async () => {
        const xml = await read("sitemap.xml");
        const base = "https://byui-cse.github.io/cse-videos/";
        const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

        assert.deepEqual(locations, [
            base,
            `${base}wall/`,
            `${base}tags/`,
            `${base}tags/ai/`,
            `${base}tags/career-quest/`,
            `${base}tags/job-search/`,
            `${base}videos/sample-short/`,
            `${base}videos/older-reel/`,
            `${base}videos/lecture/`
        ]);
        assert.equal(xml.includes("<lastmod>"), false);
        assert.equal(xml.match(/<url>/g)?.length, 9);
    });

    it("writes robots.txt with the sitemap address", async () => {
        assert.equal(await read("robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://byui-cse.github.io/cse-videos/sitemap.xml\n");
    });

    it("writes robots.txt without a sitemap and omits structured data without SITE_URL", async () => {
        const localOut = path.join(dir, "local-dist");
        await build({
            dataFile: path.join(dir, "videos.json"),
            tagsFile: path.join(dir, "tags.json"),
            srcDir,
            outDir: localOut,
            siteUrl: ""
        });

        assert.equal(await fs.readFile(path.join(localOut, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\n");
        await assert.rejects(fs.access(path.join(localOut, "sitemap.xml")), { code: "ENOENT" });
        const page = await fs.readFile(path.join(localOut, "videos", "sample-short", "index.html"), "utf8");
        assert.deepEqual(structuredData(page), []);
    });
});

describe("home page", () => {
    it("lists every video, newest first, with its search words", async () => {
        const page = await read("index.html");
        const grid = page.slice(page.indexOf("data-video-list"));
        const order = [...grid.matchAll(/class="tile__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);

        assert.deepEqual(order, ["lecture", "sample-short", "older-reel"]);
        assert.match(page, /data-search="[^"]*\bcareer\b[^"]*\bquest\b/);
        assert.match(page, /data-order="0"/);
    });

    it("escapes titles", async () => {
        const page = await read("index.html");
        assert.ok(page.includes("An &lt;older&gt; reel"));
        assert.ok(!page.includes("<older>"));
    });

    it("hides the search form, and the line about it, until JavaScript can run it", async () => {
        const page = await read("index.html");
        assert.match(page, /<form class="search hero__search" role="search" action="\.\/" method="get" data-search-form data-needs-js hidden>/);
        assert.match(page, /<p class="hero__lede" data-needs-js hidden>/);
        assert.match(page, /name="q"/);
    });

    it("puts the headline, a line on the search, the search and the counts beside a card holding the wall", async () => {
        const page = await read("index.html");
        const hero = page.slice(page.indexOf('<section class="hero"'), page.indexOf('<section class="index"'));
        assert.match(hero, /<h1 class="hero__title" id="page-title"><span class="hero__line">Find the right video<\/span> <span class="hero__line hero__line--accent">for a student<\/span><\/h1>\s*<p class="hero__lede" data-needs-js hidden>Search by topic, title or caption, then copy a link to send\.<\/p>\s*<form class="search hero__search"/);
        assert.match(hero, /<ul class="hero__facts">\s*<li data-results>3 videos<\/li>\s*<li><a href="\.\/tags\/">3 topics<\/a><\/li>\s*<\/ul>/);
        assert.match(hero, /<div class="hero__media">\s*<div class="hero__card">\s*<ul class="wall wall--card" aria-hidden="true" data-wall>/);
    });

    it("puts the way to the video wall under the card, off its stills, beside the label that names a still", async () => {
        const page = await read("index.html");
        const hero = page.slice(page.indexOf('<section class="hero"'), page.indexOf('<section class="index"'));
        const card = hero.slice(hero.indexOf('<div class="hero__card">'), hero.indexOf('<div class="hero__under">'));
        assert.ok(!card.includes("hero__open"));
        assert.ok(!card.includes("data-wall-caption"));
        assert.match(card, /<\/ul>\s*<\/div>\s*$/);
        assert.match(hero, /<div class="hero__under">\s*<p class="hero__pointing" aria-hidden="true" data-wall-caption><\/p>\s*<a class="hero__open" href="\.\/wall\/">Open the video wall <svg class="arrow-icon"[^>]*aria-hidden="true"/);
    });

    it("links home with ./ so the site name and All videos link clear a search", async () => {
        const page = await read("index.html");
        assert.match(page, /<a class="wordmark" href="\.\/">/);
        assert.match(page, /<a class="site-nav__link" href="\.\/" aria-current="page"><span class="site-nav__wide">All videos<\/span><span class="site-nav__narrow">Videos<\/span><\/a>/);
        assert.ok(!page.includes('href=""'));
    });

    it("links each tag page", async () => {
        const page = await read("index.html");
        assert.match(page, /href="\.\/tags\/job-search\/">Job search</);
        assert.match(page, /href="\.\/tags\/career-quest\/">Career Quest</);
    });

    it("has sharing details with full addresses", async () => {
        const page = await read("index.html");
        assert.match(page, /<link rel="canonical" href="https:\/\/byui-cse\.github\.io\/cse-videos\/">/);
        assert.match(page, /<meta http-equiv="Content-Security-Policy"/);
        assert.equal(structuredData(page)[0]["@type"], "WebSite");
    });
});

describe("tag pages", () => {
    // One of Job search's videos has no length, so no running time is shown.
    it("list every tag with its count, the most used first", async () => {
        const page = await read("tags/index.html");
        assert.match(page, /href="job-search\/">Job search<\/a><\/h2>\s*<p class="topic__meta"><span class="visually-hidden">2 videos<\/span><span aria-hidden="true">2 videos<\/span>/);
        assert.match(page, /href="ai\/">AI<\/a><\/h2>\s*<p class="topic__meta"><span class="visually-hidden">1 video<\/span>/);
        assert.ok(page.indexOf('href="job-search/"') < page.indexOf('href="ai/"'));
    });

    it("show only the videos with that tag, newest first", async () => {
        const page = await read("tags/job-search/index.html");
        const order = [...page.matchAll(/href="\.\.\/\.\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);
        assert.deepEqual(order, ["sample-short", "older-reel"]);
        assert.match(page, /<h1 class="tag-hero__title" id="page-title">Job search<\/h1>/);
        assert.equal(structuredData(page)[0]["@type"], "BreadcrumbList");
    });

    it("name the tag once, and head the list with its order", async () => {
        const page = await read("tags/job-search/index.html");
        assert.match(page, /<h2 class="section-title section-title--small" id="listing-heading" tabindex="-1" data-heading-newest="Newest first" data-heading-oldest="Oldest first">Newest first<\/h2>/);
        assert.equal(page.match(/>Job search</g).length, 1);
    });

    it("underline Topics in the header without calling the tag page the Topics page", async () => {
        const page = await read("tags/job-search/index.html");
        assert.match(page, /<a class="site-nav__link site-nav__link--section" href="\.\.\/\.\.\/tags\/">Topics<\/a>/);
        assert.ok(!page.includes('aria-current="page"'));
    });
});

describe("series tag pages", () => {
    const part = (number) => ({
        id: `quest-part-${number}`,
        title: `Quest, Part ${number}`,
        instagram: `https://www.instagram.com/reel/QUEST${number}/`,
        datePosted: `2026-10-2${number}`,
        tags: ["quest", "story", "job-search"],
        series: "quest",
        part: number
    });
    const other = { id: "other", title: "Other", instagram: "https://www.instagram.com/reel/OTHER/", datePosted: "2026-11-01", tags: ["job-search"] };
    const videos = [part(2), part(3), part(1), other];
    const site = { videos, tags: [], names: {}, covers: new Map(videos.map((video) => [video.id, { width: 480, height: 750 }])), siteUrl: null };
    const cards = (page) => [...page.matchAll(/<li class="tile"[^>]*data-order="(\d+)">[\s\S]*?href="\.\.\/\.\.\/videos\/([\w-]+)\/"/g)]
        .map((match) => ({ id: match[2], order: Number(match[1]) }));

    it("open on Part 1, keep newest-first positions for the sort, and count the parts", () => {
        const page = tagPage(site, { slug: "quest", name: "Quest", count: 3 });

        assert.deepEqual(cards(page), [
            { id: "quest-part-1", order: 2 },
            { id: "quest-part-2", order: 1 },
            { id: "quest-part-3", order: 0 }
        ]);
        assert.match(page, /<ol class="grid" data-video-list data-default-order="oldest">/);
        // Always in part order, so no order menu.
        assert.ok(!page.includes("data-sort"));
        assert.match(page, /<p class="tag-hero__count" data-results>3 parts<\/p>/);
        assert.match(page, /id="listing-heading" tabindex="-1">In part order<\/h2>/);
        assert.match(page, /<p class="tag-hero__crumb"><a href="\.\.\/">Topics<\/a><\/p>/);
    });

    it("are only tags whose every video is a part of that series", () => {
        for (const slug of ["job-search", "story"]) {
            const page = tagPage(site, { slug, name: slug, count: 0 });
            const shown = cards(page);

            assert.deepEqual(shown.map((card) => card.order), shown.map((card, index) => index), slug);
            assert.equal(shown[0].id, slug === "story" ? "quest-part-3" : "other", slug);
            assert.match(page, /<ol class="grid" data-video-list>/, slug);
            assert.ok(!page.includes(" selected"), slug);
            assert.match(page, /<p class="tag-hero__count" data-results>\d+ videos?<\/p>/, slug);
        }
    });
});

describe("series on other pages", () => {
    const part = (number) => ({
        id: `quest-part-${number}`,
        title: `Quest, Part ${number}: Step ${number}`,
        instagram: `https://www.instagram.com/reel/QUEST${number}/`,
        length: "0:30",
        datePosted: `2026-10-2${number}`,
        tags: ["quest", "job-search"],
        series: "quest",
        part: number
    });
    const other = { id: "other", title: "Other", instagram: "https://www.instagram.com/reel/OTHER/", datePosted: "2026-11-01", tags: ["job-search"], length: "0:15" };
    const lone = { id: "lone", title: "Lone", instagram: "https://www.instagram.com/reel/LONE/", datePosted: "2026-09-01", tags: ["music"], length: "0:15" };
    const videos = [part(2), part(3), part(1), other, lone];
    const site = { videos, tags: [], names: { quest: "Quest" }, covers: new Map(videos.map((video) => [video.id, { width: 480, height: 750 }])), siteUrl: null };

    it("show the home page's series in part order, with facts from the data", () => {
        const page = homePage(site);
        const section = page.slice(page.indexOf('<section class="quest" id="quest"'));
        const boards = [...section.matchAll(/class="board__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);

        assert.deepEqual(boards, ["quest-part-1", "quest-part-2", "quest-part-3"]);
        assert.match(section, /3 parts, posted one a day from <time datetime="2026-10-21">October 21<\/time>&nbsp;to&nbsp;<time datetime="2026-10-23">23, 2026<\/time>\. Watch them in order: 1 minute 30 seconds in all\./);
        assert.match(section, /<span class="board__title">Step 1<\/span>/);
        assert.match(section, /<span class="board__meta"><time datetime="2026-10-21">Oct 21, 2026<\/time><span aria-hidden="true"> · <\/span><time datetime="PT30S">/);
        assert.ok(!section.includes("That is all"));
        // The series' own page is the last of its actions.
        assert.match(section, /<p class="quest__actions">.*<a class="quest__page" href="\.\/tags\/quest\/">Quest on its own page<\/a><\/p>/);
        assert.ok(!section.includes("quest__end"));
        assert.match(page, /<a class="site-nav__link" href="#quest">Quest<\/a>/);
        assert.match(page, /<li data-results>5 videos, 2 minutes in all<\/li>/);
    });

    it("say when a series was posted with its year once, across months and years", () => {
        const spanOf = (dates) => {
            const parts = dates.map((date, index) => ({ ...part(index + 1), datePosted: date }));
            const page = homePage({ ...site, videos: [...parts, other] });
            return page.match(/<p class="quest__lede">(.*?)<\/p>/)[1];
        };

        assert.match(spanOf(["2026-09-30", "2026-10-01"]), /posted one a day from <time datetime="2026-09-30">September 30<\/time> to&nbsp;<time datetime="2026-10-01">October 1, 2026<\/time>\./);
        assert.match(spanOf(["2026-12-20", "2027-01-05"]), /posted from <time datetime="2026-12-20">December 20, 2026<\/time> to&nbsp;<time datetime="2027-01-05">January 5, 2027<\/time>\./);
        assert.match(spanOf(["2026-10-02"]), /1 part, posted <time datetime="2026-10-02">October 2, 2026<\/time>\./);
        // Parts posted the same day have one date, never "October 19 to 19".
        assert.match(spanOf(["2026-10-19", "2026-10-19"]), /2 parts, posted <time datetime="2026-10-19">October 19, 2026<\/time>\./);
        assert.match(spanOf(["2026-10-19", "2026-10-19", "2026-10-20"]), /3 parts, posted from <time datetime="2026-10-19">October 19<\/time>&nbsp;to&nbsp;<time datetime="2026-10-20">20, 2026<\/time>\./);
    });

    it("introduce Career Quest in words, the parts counted from the data", () => {
        const quest = videos.filter((video) => video.series).map((video) => ({ ...video, series: "career-quest", tags: ["career-quest", "job-search"] }));
        const page = homePage({ ...site, videos: [...quest, other], names: { "career-quest": "Career Quest" } });
        assert.match(page, /<p class="quest__lede">A job search told as a game, in three parts, posted one a day from /);
    });

    it("fold the index on phones after thirteen videos, the lead tile and six full rows, with a button for the rest", () => {
        const many = Array.from({ length: 14 }, (_, index) => ({ ...lone, id: `v${index}`, title: `Video ${index}` }));
        const page = homePage({ ...site, videos: many, covers: new Map() });
        assert.match(page, /data-phone-fold="13"/);
        assert.match(page, /<p class="index__more" data-show-all-row hidden><button class="button button--light" type="button" data-show-all>Show all 14 videos<\/button><\/p>/);
        assert.ok(!homePage(site).includes("data-show-all"));
    });

    it("put the page's address in the facts, in pieces that break after a slash", () => {
        const page = videoPage({ ...site, siteUrl: "https://example.com/" }, lone);
        assert.match(page, /<dt>Link to send<\/dt><dd><span class="docket__link" data-page-url><span>https:\/\/example\.com\/<\/span><span>videos\/<\/span><span>lone\/<\/span><\/span><\/dd>/);
    });

    it("leave the series section and its links out when there is no series", () => {
        const page = homePage({ ...site, videos: [other, lone] });
        assert.ok(!page.includes('class="quest"'));
        assert.ok(!page.includes("#quest"));
    });

    it("give a part its place, the parts beside it, and the rest in part order", () => {
        const page = videoPage(site, part(2));

        assert.match(page, /<p class="player-band__series"><a href="\.\.\/\.\.\/tags\/quest\/">Quest<\/a>, part 2 of 3<\/p>/);
        assert.match(page, /<h1 class="player-band__title" id="page-title">Step 2<\/h1>/);
        assert.match(page, /<a class="steps__link" href="\.\.\/\.\.\/videos\/quest-part-1\/" rel="prev">Previous: Part 1<span class="visually-hidden">, Step 1<\/span><\/a>/);
        assert.match(page, /<a class="steps__link" href="\.\.\/\.\.\/videos\/quest-part-3\/" rel="next">Next: Part 3/);

        const series = page.slice(page.indexOf('id="series-title"'), page.indexOf('id="related-title"'));
        const tiles = [...series.matchAll(/class="tile(?: tile--current)?" data-id="([\w-]+)"/g)].map((match) => match[1]);
        assert.deepEqual(tiles, ["quest-part-1", "quest-part-2", "quest-part-3"]);
        assert.match(series, /<li class="tile tile--current" data-id="quest-part-2"/);
        assert.match(series, /<span class="tile__now">Playing on this page<\/span>/);
    });

    it("list related videos that share a topic, outside the series, named by the shared topic", () => {
        const page = videoPage(site, part(1));
        const related = page.slice(page.indexOf('id="related-title"'));

        assert.match(related, /id="related-title">More on Job search<\/h2>/);
        assert.deepEqual([...related.matchAll(/class="tile" data-id="([\w-]+)"/g)].map((match) => match[1]), ["other"]);
        assert.ok(!videoPage(site, part(1)).includes("rel=\"prev\""));
        assert.ok(!videoPage(site, lone).includes('id="related-title"'));
        assert.ok(!videoPage(site, lone).includes('id="series-title"'));
    });

    it("offer AVIF and WebP copies with sizes on every still, and the JPEG as the fallback", () => {
        const page = homePage(site);
        const pictures = [...page.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((match) => match[1]);

        assert.ok(pictures.length >= videos.length * 2);

        for (const picture of pictures) {
            assert.match(picture, /^<source type="image\/avif" srcset="[^"]+-240\.avif 240w, [^"]+-360\.avif 360w, [^"]+-480\.avif 480w" sizes="[^"]+"><source type="image\/webp" srcset="[^"]+" sizes="[^"]+"><img[^>]* src="\.\/covers\/[\w-]+\.jpg"/);
        }

    });

    it("load the card's front stills at once, preload none and hurry none, and leave the rest until a search brings them forward", () => {
        const many = Array.from({ length: CARD_FRONT + 4 }, (_, index) => ({ ...lone, id: `v${index}`, title: `Video ${index}` }));
        const covers = new Map(many.map((video) => [video.id, { width: 480, height: 750 }]));
        const page = homePage({ ...site, videos: many, covers });
        const wall = page.slice(page.indexOf("data-wall"), page.indexOf("</ul>", page.indexOf("data-wall")));
        const loading = [...wall.matchAll(/<img [^>]*loading="(\w+)"/g)].map((match) => match[1]);

        assert.deepEqual(loading, [...Array(CARD_FRONT).fill("eager"), ...Array(loading.length - CARD_FRONT).fill("lazy")]);
        assert.ok(!page.includes('rel="preload" as="image"'));
        assert.ok(!wall.includes("fetchpriority"));
    });

    it("put every video on the card's wall once, then echoes to fill it, as links, in a fixed shuffle", () => {
        const page = homePage(site);
        const wall = page.slice(page.indexOf("data-wall"), page.indexOf("</ul>", page.indexOf("data-wall")));
        const own = [...wall.matchAll(/<li class="wall__still" data-id="[\w-]+"><a class="wall__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);
        const all = [...wall.matchAll(/class="wall__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);

        assert.deepEqual([...own].sort(), videos.map((video) => video.id).sort());
        assert.equal(all.length, CARD_STILLS);
        assert.deepEqual(all.slice(0, videos.length), own);
        assert.deepEqual(all, [...homePage(site).matchAll(/class="wall__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]));
        assert.match(wall, /<span class="wall__caption">Quest, Part 1: Step 1<\/span>/);
        // The index has every video for the keyboard; the wall is for the pointer.
        assert.match(page, /<ul class="wall wall--card" aria-hidden="true" data-wall>/);
        assert.equal(wall.match(/class="wall__link" href="[^"]+" tabindex="-1"/g).length, CARD_STILLS);
        assert.ok(!page.includes("Skip past the wall"));
    });
});

describe("every page", () => {
    it("tints the phone browser bar BYU-I blue and preloads both fonts", async () => {
        for (const file of ["index.html", "tags/index.html", "videos/lecture/index.html", "404.html"]) {
            const page = await read(file);
            assert.match(page, /<meta name="theme-color" content="#0065b0">/, file);
            assert.match(page, /fonts\/sofia-sans-semi-condensed-latin-wght-normal\.woff2" as="font"/, file);
            assert.match(page, /fonts\/sofia-sans-latin-wght-normal\.woff2" as="font"/, file);
        }
    });

    it("link the placeholder icon, and hold the first paint for the script and its preloaded modules", async () => {
        assert.match(await read("favicon.svg"), /<text[^>]*>CSE<\/text>/);

        for (const file of ["index.html", "tags/index.html", "videos/lecture/index.html"]) {
            const page = await read(file);
            const root = file === "index.html" ? "./" : file === "tags/index.html" ? "../" : "../../";
            assert.ok(page.includes(`<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">`), file);
            assert.ok(page.includes(`<script type="module" src="${root}js/main.js" blocking="render"></script>`), file);
            const preloaded = [...page.matchAll(/<link rel="modulepreload" href="[./]*js\/([\w-]+\.js)">/g)].map((match) => match[1]);
            const modules = (await fs.readdir(path.join(srcDir, "js"))).filter((name) => name !== "main.js").sort();
            assert.deepEqual(preloaded, modules, file);
        }
    });

    it("ships the fonts with their licenses", async () => {
        for (const file of ["fonts/LICENSE-sofia-sans.txt", "fonts/LICENSE-sofia-sans-semi-condensed.txt"]) {
            assert.match(await read(file), /SIL Open Font License/, file);
        }
    });

    it("has no style attributes or style elements, so the policy's style-src 'self' holds", async () => {
        for (const file of ["index.html", "wall/index.html", "tags/index.html", "tags/job-search/index.html", "videos/sample-short/index.html", "404.html"]) {
            const page = await read(file);
            assert.doesNotMatch(page, /\sstyle=/, file);
            assert.doesNotMatch(page, /<style/, file);
        }
    });
});

describe("player preference switch", () => {
    const header = (page) => page.slice(page.indexOf('<header class="site-header">'), page.indexOf("</header>"));
    const siteOf = (videos) => ({ videos, tags: [], names: {}, covers: new Map(), siteUrl: null });

    it("is in every page's header, hidden until JavaScript runs, once some video has both links", async () => {
        assert.ok(VIDEOS.some((video) => video.youtube && video.instagram));

        for (const file of ["index.html", "tags/index.html", "tags/ai/index.html", "videos/lecture/index.html", "videos/older-reel/index.html", "404.html"]) {
            const part = header(await read(file));
            assert.match(part, /<div class="source-preference" role="group" aria-labelledby="play-videos-on" data-source-preference data-needs-js hidden>/, file);
            assert.match(part, /<span class="source-preference__label" id="play-videos-on">Play videos on<\/span>/, file);
            assert.match(part, /<button class="source-preference__button" type="button" data-preference-button="youtube" aria-pressed="false">YouTube<\/button>/, file);
            assert.match(part, /<button class="source-preference__button" type="button" data-preference-button="instagram" aria-pressed="false">Instagram<\/button>/, file);
            assert.equal(part.match(/data-preference-button=/g).length, 2, file);
        }
    });

    it("is left out when no video has both links", () => {
        const videos = VIDEOS.filter((video) => !(video.youtube && video.instagram));
        assert.deepEqual(videos.map((video) => video.id), ["older-reel", "lecture"]);
        const site = siteOf(videos);
        const pages = [homePage(site), tagsPage(site), tagPage(site, { slug: "ai", name: "AI", count: 1 }), notFoundPage(site), ...videos.map((video) => videoPage(site, video))];

        for (const page of pages) {
            assert.ok(page.includes('<header class="site-header">'));
            assert.ok(!page.includes("data-source-preference"));
            assert.ok(!page.includes("data-preference-button"));
            assert.ok(!page.includes("Play videos on"));
        }
    });

    it("appears for a single video with both links among many without", () => {
        const site = siteOf([VIDEOS[1], VIDEOS[2], VIDEOS[0]]);
        assert.match(header(videoPage(site, VIDEOS[1])), /data-source-preference/);
        assert.match(header(homePage(site)), /data-source-preference/);
    });
});

describe("content security policy", () => {
    const policy = (page) => page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1].replaceAll("&#39;", "'");
    const scriptSrc = (page) => policy(page).split("; ").find((directive) => directive.startsWith("script-src "));
    const inlineScripts = (page) => [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

    it("allows the Instagram message queue on Instagram video pages by the hash of its text", async () => {
        for (const file of ["videos/sample-short/index.html", "videos/older-reel/index.html"]) {
            const page = await read(file);
            const scripts = inlineScripts(page);
            assert.equal(scripts.length, 1, file);
            assert.match(scripts[0], /window\.instagramMessages/, file);
            const hash = createHash("sha256").update(scripts[0]).digest("base64");
            assert.equal(scriptSrc(page), `script-src 'self' 'sha256-${hash}'`, file);
            // A policy in a meta tag covers only what comes after it.
            assert.ok(page.indexOf("Content-Security-Policy") < page.indexOf("<script>"), file);
            assert.ok(page.indexOf("<script>") < page.indexOf("</head>"), file);
        }
    });

    it("keeps inline scripts and hashes off pages without an Instagram player", async () => {
        for (const file of ["index.html", "tags/index.html", "tags/job-search/index.html", "404.html", "videos/lecture/index.html"]) {
            const page = await read(file);
            assert.deepEqual(inlineScripts(page), [], file);
            assert.equal(scriptSrc(page), "script-src 'self'", file);
            assert.ok(!page.includes("sha256-"), file);
        }
    });
});

describe("video pages", () => {
    it("play YouTube first and offer Instagram when there are both", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /<iframe class="player__iframe" src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0&amp;playsinline=1"/);
        assert.match(page, /data-instagram-src="https:\/\/www\.instagram\.com\/p\/DZYXMdzMV0w\/embed\/"/);
        assert.match(page, /data-youtube-shape="tall"/);
        assert.match(page, /data-source-button="instagram" aria-pressed="false">Instagram</);
    });

    it("play Instagram when that is the only link, without a source switch", async () => {
        const page = await read("videos/older-reel/index.html");
        assert.match(page, /data-source="instagram"/);
        assert.ok(!page.includes("data-source-button"));
    });

    it("show 16:9 videos as wide", async () => {
        const page = await read("videos/lecture/index.html");
        assert.match(page, /data-youtube-shape="wide"/);
    });

    it("keep the caption's paragraphs and line breaks, escaped", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /<p>First line<br>second line<\/p>/);
        assert.match(page, /<p>A &lt;b&gt;bold&lt;\/b&gt; claim &amp; more<\/p>/);
    });

    it("show the date, length, tags, credits, and stats", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /<time datetime="2026-10-19">October 19, 2026<\/time>/);
        assert.match(page, /<time datetime="PT1M5S"><span aria-hidden="true">1:05<\/span><span class="visually-hidden">1 minute 5 seconds<\/span><\/time>/);
        assert.match(page, /href="\.\.\/\.\.\/tags\/career-quest\/">Career Quest</);
        assert.match(page, /<li>Music from the Instagram library<\/li>/);
        assert.match(page, /<li>Photo used under CC BY-SA 4\.0 \(<a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/">https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/<\/a>\)<\/li>/);
        assert.match(page, /<dt>New people<\/dt><dd>3<\/dd>/);
    });

    it("use the tall YouTube thumbnail for a Short with no cover file", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /<img class="player__poster" src="https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/oar2\.jpg"/);
    });

    it("link the privacy notice and legal page in the footer", async () => {
        const page = await read("videos/lecture/index.html");
        assert.match(page, /href="https:\/\/cesprivacy\.org\/ces-institutions-privacy-notice">Privacy notice</);
        assert.match(page, /href="https:\/\/www\.byui\.edu\/legal\/">Legal and terms of use</);
    });

    it("link out to YouTube and Instagram", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /href="https:\/\/www\.youtube\.com\/shorts\/dQw4w9WgXcQ">Open on YouTube</);
        assert.match(page, /href="https:\/\/www\.instagram\.com\/reel\/DZYXMdzMV0w\/">Open on Instagram</);
    });

    it("underline All videos in the header", async () => {
        const page = await read("videos/lecture/index.html");
        assert.match(page, /<a class="site-nav__link site-nav__link--section" href="\.\.\/\.\.\/"><span class="site-nav__wide">All videos<\/span>/);
    });

    it("use the YouTube thumbnail for the sharing preview when there is no cover file", async () => {
        const page = await read("videos/lecture/index.html");
        assert.match(page, /<meta property="og:image" content="https:\/\/i\.ytimg\.com\/vi\/abcdefghijk\/hqdefault\.jpg">/);
        assert.match(page, /<meta property="og:url" content="https:\/\/byui-cse\.github\.io\/cse-videos\/videos\/lecture\/">/);
        assert.match(page, /<meta property="og:image:width" content="480">/);
        assert.match(page, /<meta property="og:image:height" content="360">/);
        assert.match(page, /<meta property="og:image:alt" content="A lecture">/);
        assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
        assert.match(page, /<meta name="twitter:image" content="https:\/\/i\.ytimg\.com\/vi\/abcdefghijk\/hqdefault\.jpg">/);
        assert.match(page, /<meta name="twitter:title" content="A lecture">/);
        assert.match(page, /<meta name="twitter:description"/);
        assert.match(page, /<meta property="og:type" content="video.other">/);
    });

    it("writes parseable VideoObject and breadcrumb data with absolute addresses", async () => {
        const page = await read("videos/sample-short/index.html");
        const [video, trail] = structuredData(page);

        assert.equal(video["@type"], "VideoObject");
        assert.equal(video.description, VIDEOS[0].description);
        assert.equal(video.thumbnailUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/oar2.jpg");
        assert.equal(video.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
        assert.equal(video.url, "https://byui-cse.github.io/cse-videos/videos/sample-short/");
        assert.equal(trail["@type"], "BreadcrumbList");
        assert.equal(trail.itemListElement[0].item, "https://byui-cse.github.io/cse-videos/");
        assert.equal(trail.itemListElement[1].item, video.url);
        assert.match(page, /<meta name="twitter:card" content="summary">/);
    });
});

describe("video wall page", () => {
    it("names every video once as a link the keyboard reaches, and hides the echoes that fill the screen", async () => {
        const page = await read("wall/index.html");
        const start = page.indexOf("data-wall-page");
        const wall = page.slice(start, page.indexOf("</ul>", start));
        const stills = [...wall.matchAll(/<li class="wall__still( wall__still--echo)?" data-id="([\w-]+)"([^>]*)><a class="wall__link" href="\.\.\/videos\/([\w-]+)\/"( tabindex="-1")? data-reel-link>/g)];
        const real = stills.filter((match) => !match[1]);
        const echoes = stills.filter((match) => match[1]);

        assert.match(page, /<ul class="wall wall--page" aria-label="Every video" data-wall data-wall-page>/);
        assert.equal(stills.length, WALL_STILLS);
        // The top row is lifted past the stage's edge, so it holds echoes.
        assert.ok(stills.slice(0, WALL_LEAD).every((match) => match[1]));
        assert.ok(stills.slice(WALL_LEAD, WALL_LEAD + VIDEOS.length).every((match) => !match[1]));
        assert.deepEqual(real.map((match) => match[2]).sort(), VIDEOS.map((video) => video.id).sort());

        for (const match of real) {
            assert.equal(match[2], match[4]);
            assert.match(match[3], /^ data-search="[^"]+"$/);
            assert.equal(match[5], undefined);
        }

        for (const match of echoes) {
            assert.equal(match[3], ' aria-hidden="true"');
            assert.equal(match[5], ' tabindex="-1"');
        }

        assert.match(wall, /<span class="wall__caption">An &lt;older&gt; reel<\/span>/);
    });

    it("puts its name, the search and the count first, and underlines Video wall in the header", async () => {
        const page = await read("wall/index.html");
        assert.ok(page.indexOf('id="page-title"') < page.indexOf("data-wall-page"));
        assert.match(page, /<h1 class="band__title" id="page-title">Video wall<\/h1>\s*<p class="band__pointing" aria-hidden="true" data-wall-caption><\/p>/);
        assert.match(page, /<form class="search" role="search" action="\.\/" method="get" data-search-form data-needs-js hidden>/);
        assert.match(page, /<p class="band__count" data-results>3 videos<\/p>/);
        assert.match(page, /<p class="visually-hidden" data-announce role="status"><\/p>/);
        assert.match(page, /<a class="site-nav__link" href="\.\.\/wall\/" aria-current="page"><span class="site-nav__wide">Video wall<\/span><span class="site-nav__narrow">Wall<\/span><\/a>/);
        assert.match(page, /<title>Video wall \| CSE Videos<\/title>/);
        assert.match(page, /<link rel="canonical" href="https:\/\/byui-cse\.github\.io\/cse-videos\/wall\/">/);
    });

    it("is linked from the header and footer of every page", async () => {
        for (const [file, root] of [["index.html", "./"], ["tags/index.html", "../"], ["tags/ai/index.html", "../../"], ["videos/lecture/index.html", "../../"]]) {
            const page = await read(file);
            const href = `${root}wall/`.replaceAll(".", "\\.").replaceAll("/", "\\/");
            assert.match(page, new RegExp(`<a class="site-nav__link" href="${href}"><span class="site-nav__wide">Video wall<\\/span>`), file);
            assert.match(page, new RegExp(`<li><a href="${href}">Video wall<\\/a><\\/li>`), file);
        }
    });

    it("loads the first row at its widest at once, hurries the first two rows on a phone, loads each video's own still as its echo there, and leaves the rest lazy", () => {
        const many = Array.from({ length: 36 }, (_, index) => ({ id: `v${index}`, title: `Video ${index}`, instagram: `https://www.instagram.com/reel/V${index}/`, datePosted: "2026-11-01", tags: ["x"] }));
        const page = videoWallPage({ videos: many, tags: [], names: {}, covers: new Map(many.map((video) => [video.id, { width: 480, height: 750 }])), siteUrl: null });
        const start = page.indexOf("data-wall-page");
        const stills = [...page.slice(start, page.indexOf("</ul>", start)).matchAll(/<li class="wall__still( wall__still--echo)?" data-id="([\w-]+)".*?(<img [^>]*>)/g)]
            .map(([, echo, id, img]) => ({ echo: Boolean(echo), id, img }));
        // The videos on the first row at the widest, and whether each is hurried.
        const lead = new Map(stills.slice(0, WALL_LEAD).map(({ id }, slot) => [id, slot < 12]));

        assert.equal(stills.length, WALL_STILLS);
        assert.equal(lead.size, WALL_LEAD);
        stills.forEach(({ echo, id, img }, slot) => {
            const early = slot < WALL_LEAD || (!echo && lead.has(id));
            assert.match(img, early ? /loading="eager"/ : /loading="lazy"/, `${slot}`);
            assert.equal(img.includes('fetchpriority="high"'), slot < WALL_LEAD ? slot < 12 : early && lead.get(id), `${slot}`);
        });
        // The own stills share their echoes' pictures, so nothing more loads at once.
        const files = new Set(stills.filter(({ img }) => img.includes('loading="eager"')).map(({ img }) => img.match(/src="([^"]+)"/)[1]));
        assert.equal(files.size, WALL_LEAD);
        assert.equal(stills.filter(({ echo, img }) => !echo && img.includes('loading="eager"')).length, WALL_LEAD);
        assert.ok(!page.includes('rel="preload" as="image"'));
    });

    it("fills a small library's wall with echoes, and draws an empty library without any", () => {
        const one = { id: "solo", title: "Solo", instagram: "https://www.instagram.com/reel/SOLO/", datePosted: "2026-11-01", tags: ["x"] };
        const site = { videos: [one], tags: [], names: {}, covers: new Map(), siteUrl: null };
        const page = videoWallPage(site);
        assert.equal(page.match(/<li class="wall__still/g).length, WALL_STILLS);
        assert.equal(page.match(/wall__still--echo/g).length, WALL_STILLS - 1);

        const empty = videoWallPage({ ...site, videos: [] });
        assert.equal(empty.match(/<li class="wall__still/g), null);
        assert.match(empty, /<p class="band__count" data-results>0 videos<\/p>/);
    });
});

describe("404 page", () => {
    it("links from the site's root path, since it can be served at any depth", async () => {
        const page = await read("404.html");
        assert.match(page, /href="\/cse-videos\/">See all videos</);
        assert.match(page, /<link rel="stylesheet" href="\/cse-videos\/css\/main\.css">/);
        assert.match(page, /href="\/cse-videos\/tags\/">Topics</);
        assert.ok(!page.includes("<base"));
    });

    it("keeps the skip link on the page", async () => {
        const page = await read("404.html");
        assert.match(page, /<a class="skip-link" href="#main">/);
    });
});


describe("video text hygiene", () => {
    const site = { videos: [], tags: [], names: {}, covers: new Map(), siteUrl: "https://example.com/" };
    const render = (overrides) => videoPage(site, { ...VIDEOS[0], ...overrides });

    it("omits repeated titles and series labels and builds sharing descriptions from data", () => {
        for (const description of ["Showcase: Micro Mouse!", "Career Quest - Part 4:"]) {
            const page = render({ title: "Showcase micro-mouse", description, length: "0:39", datePosted: "2026-09-17" });
            assert.doesNotMatch(page, /class="record__caption/);
            const fallback = "A 39-second video from BYU-Idaho Computer Science and Engineering, posted September 17, 2026.";
            assert.ok(page.includes(`<meta name="description" content="${fallback}">`));
            assert.ok(page.includes(`<meta property="og:description" content="${fallback}">`));
        }
        assert.match(render({ description: "", length: undefined }), /A video from BYU-Idaho/);
        assert.match(render({ description: "Career Quest - Part 4: More to learn." }), /class="record__caption/);
    });

    it("renders escaped named credit links with no raw URL text", () => {
        const page = render({ attributions: ['Photo by [A & B](https://example.com/photo), used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)'] });
        const credits = page.slice(page.indexOf("<dt>Credits</dt>"), page.indexOf("</dd>", page.indexOf("<dt>Credits</dt>")));
        assert.match(credits, /<a href="https:\/\/example.com\/photo">A &amp; B<\/a>/);
        assert.doesNotMatch(credits, />https:\/\/example.com|>https:\/\/creativecommons/);
    });

    it("keeps link markup out of the sharing description", () => {
        const page = render({ description: "Thanks to [Jane](https://example.com/jane) for the music." });
        assert.ok(page.includes('<meta name="description" content="Thanks to Jane for the music.">'));
        assert.ok(page.includes('<a href="https://example.com/jane">Jane</a>'));
    });

    it("uses curly quotes in visible and sharing text", () => {
        const page = render({ title: 'Don\'t say "no"', description: 'It\'s a "start".' });
        assert.ok(page.includes("Don’t say “no”"));
        assert.ok(page.includes('content="It’s a “start”."'));
    });

    it("uses real cover dimensions for cards and sharing metadata", async () => {
        const page = await read("videos/older-reel/index.html");
        const cover = "https://byui-cse.github.io/cse-videos/covers/older-reel.jpg";
        assert.match(page, new RegExp(`<meta property="og:image" content="${cover}">`));
        assert.match(page, new RegExp(`<meta name="twitter:image" content="${cover}">`));
        const video = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
            .map((match) => JSON.parse(match[1]))
            .find((data) => data["@type"] === "VideoObject");
        assert.equal(video.thumbnailUrl, cover);
        assert.match(await read("tags/job-search/index.html"), /<meta property="og:image" content="https:\/\//);
        assert.match(page, /property="og:image:width" content="480"/);
        assert.match(page, /property="og:image:height" content="750"/);
        assert.match(await read("index.html"), /covers\/older-reel.jpg"[^>]*width="480" height="750"/);
    });
});
