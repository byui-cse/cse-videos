import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { breadcrumbs, jsonLd, robotsTxt, sitemapXml, videoObject, websiteSchema } from "../lib/seo.js";
import { homePage, notFoundPage, videoPage } from "../lib/render.js";

const pageSite = {
    videos: [{ id: "example", title: "Example", datePosted: "2026-11-01", tags: [], youtube: "https://youtu.be/dQw4w9WgXcQ" }],
    tags: [],
    names: {},
    covers: new Map([["example", { width: 480, height: 750 }]]),
    siteUrl: "https://example.com/cse-videos/"
};

describe("page sharing metadata", () => {
    it("uses the share image on home and keeps a video's cover", () => {
        const home = homePage(pageSite);
        const video = videoPage(pageSite, pageSite.videos[0]);

        assert.match(home, /<meta property="og:image" content="https:\/\/example\.com\/cse-videos\/share\.jpg">/);
        assert.match(home, /<meta property="og:image:alt" content="CSE Videos">/);
        assert.match(home, /<meta name="twitter:card" content="summary_large_image">/);
        assert.match(video, /<meta property="og:image" content="https:\/\/example\.com\/cse-videos\/covers\/example\.jpg">/);
    });

    it("does not assign a canonical address or structured data to missing pages", () => {
        const page = notFoundPage(pageSite);

        assert.match(page, /<meta name="robots" content="noindex">/);
        assert.doesNotMatch(page, /rel="canonical"|property="og:url"|application\/ld\+json/);
    });
});

describe("structured data", () => {
    it("escapes script-closing text and JSON line separators without changing the parsed value", () => {
        const caption = "Watch </script><script>alert(1)</script> & <more>\u2028\u2029";
        const markup = String(jsonLd({ caption }));

        assert.equal(markup.match(/<\/script>/g)?.length, 1);
        assert.ok(!markup.includes("<more>"));
        assert.ok(!markup.includes("\u2028"));
        assert.ok(!markup.includes("\u2029"));
        assert.match(markup, /\\u003c\/script\\u003e/);
        assert.deepEqual(JSON.parse(markup.slice(markup.indexOf(">") + 1, -"</script>".length)), { caption });
    });

    it("builds a video from actual metadata and prefers the YouTube player", () => {
        const schema = videoObject({
            video: {
                title: "A video",
                description: "A caption",
                youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                instagram: "https://www.instagram.com/reel/DZYXMdzMV0w/",
                datePosted: "2026-10-19",
                length: "1:05"
            },
            thumbnailUrl: "https://example.com/cover.jpg",
            url: "https://example.com/videos/a-video/"
        });

        assert.equal(schema["@type"], "VideoObject");
        assert.equal(schema.name, "A video");
        assert.equal(schema.description, "A caption");
        assert.equal(schema.thumbnailUrl, "https://example.com/cover.jpg");
        assert.equal(schema.uploadDate, "2026-10-19");
        assert.equal(schema.duration, "PT1M5S");
        assert.equal(schema.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
        assert.equal(schema.url, "https://example.com/videos/a-video/");
        assert.deepEqual(schema.publisher, {
            "@type": "Organization",
            name: "BYU-Idaho Computer Science and Engineering",
            url: "https://www.byui.edu/computer-science-engineering/"
        });
    });

    it("uses the title as a missing caption and omits absent video fields", () => {
        const schema = videoObject({ video: { title: "Only a title" } });

        assert.equal(schema.description, "Only a title");
        for (const property of ["thumbnailUrl", "uploadDate", "duration", "embedUrl", "url"]) {
            assert.ok(!Object.hasOwn(schema, property), property);
        }

        const captionOnly = videoObject({ video: { description: "Only a caption" } });
        assert.equal(captionOnly.description, "Only a caption");
        const linked = videoObject({ video: { description: "Thanks to [Jane](https://example.com/jane)" } });
        assert.equal(linked.description, "Thanks to Jane");
        assert.ok(!Object.hasOwn(captionOnly, "name"));
    });

    it("builds the site search action and ordered breadcrumbs", () => {
        const website = websiteSchema("https://example.com/library/");
        const trail = breadcrumbs([
            { name: "Videos", url: "https://example.com/library/" },
            { name: "A video", url: "https://example.com/library/videos/a-video/" }
        ]);

        assert.equal(website["@type"], "WebSite");
        assert.equal(website.name, "CSE Videos");
        assert.equal(website.potentialAction["@type"], "SearchAction");
        assert.equal(website.potentialAction.target, "https://example.com/library/?q={search_term_string}");
        assert.equal(website.potentialAction["query-input"], "required name=search_term_string");
        assert.equal(trail["@type"], "BreadcrumbList");
        assert.deepEqual(trail.itemListElement.map(({ position, name, item }) => [position, name, item]), [
            [1, "Videos", "https://example.com/library/"],
            [2, "A video", "https://example.com/library/videos/a-video/"]
        ]);
    });
});

describe("crawler files", () => {
    it("escapes sitemap addresses and includes dates only when present", () => {
        const xml = sitemapXml([
            { url: "https://example.com/?a=1&b=<two>", lastmod: "2026-10-19" },
            { url: "https://example.com/tags/" }
        ]);

        assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
        assert.match(xml, /<loc>https:\/\/example\.com\/\?a=1&amp;b=&lt;two&gt;<\/loc><lastmod>2026-10-19<\/lastmod>/);
        assert.equal(xml.match(/<lastmod>/g)?.length, 1);
    });

    it("allows all crawlers and references the sitemap only with an address", () => {
        assert.equal(robotsTxt(null), "User-agent: *\nAllow: /\n");
        assert.equal(robotsTxt("https://example.com/library/"), "User-agent: *\nAllow: /\nSitemap: https://example.com/library/sitemap.xml\n");
    });
});
