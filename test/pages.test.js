import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { homePage, notFoundPage, tagPage, tagsPage, videoPage } from "../lib/render.js";
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
    it("writes a page for the home list, the tags, every tag, and every video", async () => {
        const files = [
            "index.html",
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
            "data/videos.json"
        ];

        for (const file of files) {
            await fs.access(path.join(out, file));
        }

        assert.deepEqual(
            { videos: result.videos, tags: result.tags, pages: result.pages },
            { videos: 3, tags: 3, pages: 9 }
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

    it("writes a sitemap for every public page, without lastmod dates", async () => {
        const xml = await read("sitemap.xml");
        const base = "https://byui-cse.github.io/cse-videos/";
        const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

        assert.deepEqual(locations, [
            base,
            `${base}tags/`,
            `${base}tags/ai/`,
            `${base}tags/career-quest/`,
            `${base}tags/job-search/`,
            `${base}videos/sample-short/`,
            `${base}videos/older-reel/`,
            `${base}videos/lecture/`
        ]);
        assert.equal(xml.includes("<lastmod>"), false);
        assert.equal(xml.match(/<url>/g)?.length, 8);
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

    it("hides the search form until JavaScript can run it", async () => {
        const page = await read("index.html");
        assert.match(page, /<form class="search" role="search" action="\.\/" method="get" data-search-form data-needs-js hidden>/);
        assert.match(page, /name="q"/);
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
        assert.match(section, /3 parts, posted one a day from <time datetime="2026-10-21">Wednesday, October 21, 2026<\/time> to <time datetime="2026-10-23">Friday, October 23, 2026<\/time>\. Watch them in order: 1 minute 30 seconds in all\./);
        assert.match(section, /<span class="board__title">Step 1<\/span>/);
        assert.ok(!section.includes("That is all"));
        assert.match(section, /<p class="quest__end"><a href="\.\/tags\/quest\/">Quest on its own page<\/a><\/p>/);
        assert.match(page, /<a class="site-nav__link" href="#quest">Quest<\/a>/);
        assert.match(page, /<p class="band__count" data-results>5 videos, 2 minutes in all<\/p>/);
    });

    it("introduce Career Quest in words, the parts counted from the data", () => {
        const quest = videos.filter((video) => video.series).map((video) => ({ ...video, series: "career-quest", tags: ["career-quest", "job-search"] }));
        const page = homePage({ ...site, videos: [...quest, other], names: { "career-quest": "Career Quest" } });
        assert.match(page, /<p class="quest__lede">A job search told as a game, in three parts, posted one a day from /);
    });

    it("fold the index on phones after twelve videos, with a button for the rest", () => {
        const many = Array.from({ length: 14 }, (_, index) => ({ ...lone, id: `v${index}`, title: `Video ${index}` }));
        const page = homePage({ ...site, videos: many, covers: new Map() });
        assert.match(page, /data-phone-fold="12"/);
        assert.match(page, /<p class="index__more" data-show-all-row hidden><button class="button button--light" type="button" data-show-all>Show all 14 videos<\/button><\/p>/);
        assert.ok(!homePage(site).includes("data-show-all"));
    });

    it("put a Copy link for the page beside its address in the facts", () => {
        const page = videoPage({ ...site, siteUrl: "https://example.com/" }, lone);
        assert.match(page, /<dt>Link to send<\/dt><dd class="docket__send"><span class="docket__link" data-page-url>https:\/\/example\.com\/videos\/lone\/<\/span> <button class="text-button" type="button" data-copy="\.\/" data-copy-name="Lone" data-needs-js hidden>Copy link<span class="visually-hidden" data-copy-suffix> to Lone<\/span><\/button><\/dd>/);
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

        assert.match(page, /<link rel="preload" as="image" type="image\/avif" imagesrcset="[^"]+" imagesizes="[^"]+" fetchpriority="high">/);
    });

    it("put every video on the wall once, as a link, in a fixed shuffle", () => {
        const page = homePage(site);
        const wall = page.slice(page.indexOf("data-wall"), page.indexOf("</ul>", page.indexOf("data-wall")));
        const ids = [...wall.matchAll(/class="wall__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);

        assert.deepEqual([...ids].sort(), videos.map((video) => video.id).sort());
        assert.deepEqual(ids, [...homePage(site).matchAll(/class="wall__link" href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]));
        assert.match(wall, /<span class="wall__caption">Quest, Part 1: Step 1<\/span>/);
        // The index has every video for the keyboard; the wall is for the pointer.
        assert.match(page, /<ul class="wall" aria-hidden="true" data-wall>/);
        assert.equal(wall.match(/class="wall__link" href="[^"]+" tabindex="-1"/g).length, videos.length);
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
        for (const file of ["index.html", "tags/index.html", "tags/job-search/index.html", "videos/sample-short/index.html", "404.html"]) {
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
        assert.match(page, /<time datetime="2026-10-19">Monday, October 19, 2026<\/time>/);
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
