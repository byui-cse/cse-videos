import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { tagPage, videoPage } from "../lib/render.js";
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
        const order = [...page.matchAll(/href="\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);

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

    it("links home with ./ so the site name and Videos link clear a search", async () => {
        const page = await read("index.html");
        assert.match(page, /<a class="brand" href="\.\/">/);
        assert.match(page, /<a class="site-nav__link" href="\.\/" aria-current="page">Videos<\/a>/);
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
    it("list every tag with its count", async () => {
        const page = await read("tags/index.html");
        assert.match(page, /href="job-search\/">Job search<\/a>\s*<span class="tag-index__count">2 videos/);
        assert.match(page, /href="ai\/">AI<\/a>\s*<span class="tag-index__count">1 video</);
    });

    it("show only the videos with that tag, newest first", async () => {
        const page = await read("tags/job-search/index.html");
        const order = [...page.matchAll(/href="\.\.\/\.\.\/videos\/([\w-]+)\/"/g)].map((match) => match[1]);
        assert.deepEqual(order, ["sample-short", "older-reel"]);
        assert.match(page, /<h1 class="page-head__title" id="page-title">Job search<\/h1>/);
        assert.equal(structuredData(page)[0]["@type"], "BreadcrumbList");
    });

    it("name the tag once on screen, with the list heading for screen readers", async () => {
        const page = await read("tags/job-search/index.html");
        assert.match(page, /<h2 class="visually-hidden" id="listing-heading" tabindex="-1">Videos tagged Job search<\/h2>/);
        assert.ok(!page.includes("<p class=\"page-head__note\">Videos tagged"));
    });

    it("underline Tags in the header without calling the tag page the Tags page", async () => {
        const page = await read("tags/job-search/index.html");
        assert.match(page, /<a class="site-nav__link site-nav__link--section" href="\.\.\/\.\.\/tags\/">Tags<\/a>/);
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
    const cards = (page) => [...page.matchAll(/<li class="video-card"[^>]*data-order="(\d+)">[\s\S]*?href="\.\.\/\.\.\/videos\/([\w-]+)\/"/g)]
        .map((match) => ({ id: match[2], order: Number(match[1]) }));

    it("open on Part 1, keep newest-first positions for the sort, and count the parts", () => {
        const page = tagPage(site, { slug: "quest", name: "Quest", count: 3 });

        assert.deepEqual(cards(page), [
            { id: "quest-part-1", order: 2 },
            { id: "quest-part-2", order: 1 },
            { id: "quest-part-3", order: 0 }
        ]);
        assert.match(page, /<ul class="video-grid" data-video-list data-default-order="oldest">/);
        assert.match(page, /<option value="newest">Newest first<\/option>\s*<option value="oldest" selected>Oldest first<\/option>/);
        assert.match(page, /<p class="page-head__note">3 parts<span aria-hidden="true"> · <\/span><a href="\.\.\/">See all tags<\/a><\/p>/);
    });

    it("are only tags whose every video is a part of that series", () => {
        for (const slug of ["job-search", "story"]) {
            const page = tagPage(site, { slug, name: slug, count: 0 });
            const shown = cards(page);

            assert.deepEqual(shown.map((card) => card.order), shown.map((card, index) => index), slug);
            assert.equal(shown[0].id, slug === "story" ? "quest-part-3" : "other", slug);
            assert.match(page, /<ul class="video-grid" data-video-list>/, slug);
            assert.ok(!page.includes(" selected"), slug);
            assert.match(page, /<p class="page-head__note"><a href="\.\.\/">See all tags<\/a><\/p>/, slug);
        }
    });
});

describe("every page", () => {
    it("tints the phone browser bar navy and preloads both fonts, like the CS & SE site", async () => {
        for (const file of ["index.html", "tags/index.html", "videos/lecture/index.html", "404.html"]) {
            const page = await read(file);
            assert.match(page, /<meta name="theme-color" content="#004c86" media="\(prefers-color-scheme: light\)">/, file);
            assert.match(page, /fonts\/source-sans-3-latin-wght-normal\.woff2" as="font"/, file);
            assert.match(page, /fonts\/source-serif-4-latin-wght-normal\.woff2" as="font"/, file);
        }
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
        assert.match(page, /href="https:\/\/cesprivacy\.org\/ces-institutions-privacy-notice">Privacy</);
        assert.match(page, /href="https:\/\/www\.byui\.edu\/legal\/">Legal</);
    });

    it("link out to YouTube and Instagram", async () => {
        const page = await read("videos/sample-short/index.html");
        assert.match(page, /href="https:\/\/www\.youtube\.com\/shorts\/dQw4w9WgXcQ">Open on YouTube</);
        assert.match(page, /href="https:\/\/www\.instagram\.com\/reel\/DZYXMdzMV0w\/">Open on Instagram</);
    });

    it("underline Videos in the header", async () => {
        const page = await read("videos/lecture/index.html");
        assert.match(page, /<a class="site-nav__link site-nav__link--section" href="\.\.\/\.\.\/">Videos<\/a>/);
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
        assert.match(page, /href="\/cse-videos\/tags\/">Tags</);
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
            assert.doesNotMatch(page, /class="video__description/);
            const fallback = "A 39-second video from BYU-Idaho Computer Science and Engineering, posted September 17, 2026.";
            assert.ok(page.includes(`<meta name="description" content="${fallback}">`));
            assert.ok(page.includes(`<meta property="og:description" content="${fallback}">`));
        }
        assert.match(render({ description: "", length: undefined }), /A video from BYU-Idaho/);
        assert.match(render({ description: "Career Quest - Part 4: More to learn." }), /class="video__description/);
    });

    it("renders escaped named credit links with no raw URL text", () => {
        const page = render({ attributions: ['Photo by [A & B](https://example.com/photo), used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)'] });
        assert.match(page, /<a href="https:\/\/example.com\/photo">A &amp; B<\/a>/);
        assert.doesNotMatch(page, />https:\/\/example.com|>https:\/\/creativecommons/);
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
